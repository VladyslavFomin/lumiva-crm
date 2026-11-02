// pdf.js (legacy-сборка — работает и в старых Safari): загрузка документа и отрисовка страниц в картинки
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfDoc = PDFDocumentProxy;

/** Документ по ссылке: страницы подгружаются частями (Range), весь файл сразу не качается */
export function openPdf(url: string): Promise<PdfDoc> {
  return pdfjsLib.getDocument({ url, disableAutoFetch: true, rangeChunkSize: 1 << 20, isEvalSupported: false }).promise;
}

/** Страница → JPEG (blob URL) шириной targetWidth CSS-пикселей с учётом плотности экрана (не больше 2×) */
export async function renderPage(doc: PdfDoc, pageNo: number, targetWidth: number): Promise<{ url: string; ratio: number }> {
  const page = await doc.getPage(pageNo);
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const scale = Math.max(0.2, (targetWidth * dpr) / base.width);
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  page.cleanup();
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/jpeg', 0.88));
  canvas.width = 0;
  canvas.height = 0;
  return { url: URL.createObjectURL(blob), ratio: base.height / base.width };
}

/** Обложка (первая страница) для превью файла при загрузке: JPEG до 640px и размер страницы */
export async function pdfCover(file: Blob): Promise<{ thumb: Blob; width: number; height: number } | null> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = 640 / Math.max(base.width, base.height);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const thumb: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.82));
    return thumb ? { thumb, width: Math.round(base.width), height: Math.round(base.height) } : null;
  } finally {
    void doc.destroy();
  }
}

/** Обложка уже загруженного PDF по ссылке (для старых файлов без превью) */
export async function pdfCoverFromUrl(url: string): Promise<{ thumb: Blob; width: number; height: number } | null> {
  const doc = await openPdf(url);
  try {
    const p1 = await doc.getPage(1);
    const base = p1.getViewport({ scale: 1 });
    const { url: img } = await renderPage(doc, 1, (640 * base.width) / Math.max(base.width, base.height) / Math.min(2, window.devicePixelRatio || 1));
    const thumb = await (await fetch(img)).blob();
    URL.revokeObjectURL(img);
    return { thumb, width: Math.round(base.width), height: Math.round(base.height) };
  } finally {
    void doc.destroy();
  }
}
