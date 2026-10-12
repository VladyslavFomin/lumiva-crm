// src/esign/esign-pdf.util.ts
import PDFDocument from 'pdfkit';
import { resolveUnicodePdfFont } from '../common/pdf-font.util';

export interface SignatureBlock {
  signerName: string;
  signedAt: Date;
  ip: string;
  userAgent: string;
}

/** Letterhead for commercial offers: tenant logo on the left, name + requisites on the right. */
export interface PdfHeader {
  orgName: string;
  requisites?: string | null;
  /** Absolute path to a PNG/JPEG logo (other formats are skipped — pdfkit can't embed them). */
  logoPath?: string | null;
}

export interface RenderedEsignPdf {
  buffer: Buffer;
  pageCount: number;
}

type BodyBlock = { kind: 'text'; text: string } | { kind: 'table'; rows: string[][] };

/** Consecutive tab-separated lines (e.g. {QUOTE_ITEMS}) become a table; everything else is text. */
export function splitBodyBlocks(body: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  for (const line of body.split('\n')) {
    const isRow = line.includes('\t');
    const last = blocks[blocks.length - 1];
    if (isRow) {
      const cells = line.split('\t');
      if (last?.kind === 'table') last.rows.push(cells);
      else blocks.push({ kind: 'table', rows: [cells] });
    } else if (last?.kind === 'text') {
      last.text += `\n${line}`;
    } else {
      blocks.push({ kind: 'text', text: line });
    }
  }
  return blocks;
}

const PAGE_LEFT = 56;
const PAGE_WIDTH = 595.28 - 56 * 2;

/** Draws a simple bordered table; the first row is the header. Column 2 (name) takes the
 * remaining width and wraps; numeric columns are right-aligned. */
function drawTable(doc: PDFKit.PDFDocument, rows: string[][]) {
  const cols = Math.max(...rows.map((r) => r.length));
  const fixed = cols === 6 ? [24, 0, 48, 82, 52, 90] : Array(cols).fill(0);
  const fixedSum = fixed.reduce((s, w) => s + w, 0);
  const flexCount = fixed.filter((w) => w === 0).length || 1;
  const widths = fixed.map((w) => (w === 0 ? (PAGE_WIDTH - fixedSum) / flexCount : w));
  const padX = 5;
  const padY = 4;
  doc.fontSize(9);

  rows.forEach((row, ri) => {
    const isHeader = ri === 0;
    const heights = row.map((cell, ci) => doc.heightOfString(cell || '', { width: widths[ci] - padX * 2 }));
    const h = Math.max(...heights, 10) + padY * 2;
    if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const y = doc.y;
    let x = PAGE_LEFT;
    if (isHeader) doc.rect(PAGE_LEFT, y, PAGE_WIDTH, h).fill('#f2f2f2');
    row.forEach((cell, ci) => {
      const align = ci >= 2 && cols === 6 ? 'right' : 'left';
      doc.fillColor(isHeader ? '#555' : '#111').text(cell || '', x + padX, y + padY, { width: widths[ci] - padX * 2, align });
      x += widths[ci];
    });
    doc.moveTo(PAGE_LEFT, y + h).lineTo(PAGE_LEFT + PAGE_WIDTH, y + h).strokeColor('#dddddd').lineWidth(0.5).stroke();
    doc.x = PAGE_LEFT;
    doc.y = y + h;
  });
  doc.fontSize(11).fillColor('#111');
  doc.moveDown(0.5);
}

function drawHeader(doc: PDFKit.PDFDocument, header: PdfHeader) {
  const top = doc.y;
  let logoBottom = top;
  if (header.logoPath && /\.(png|jpe?g)$/i.test(header.logoPath)) {
    try {
      doc.image(header.logoPath, PAGE_LEFT, top, { fit: [130, 52] });
      logoBottom = top + 52;
    } catch {
      /* unreadable logo — letterhead goes on without it */
    }
  }
  const textX = PAGE_LEFT + 150;
  const textW = PAGE_WIDTH - 150;
  doc.fontSize(12).fillColor('#111').text(header.orgName, textX, top, { width: textW, align: 'right' });
  if (header.requisites?.trim()) {
    doc.fontSize(8.5).fillColor('#666').text(header.requisites.trim(), textX, doc.y + 2, { width: textW, align: 'right', lineGap: 1 });
  }
  const bottom = Math.max(logoBottom, doc.y) + 10;
  doc.moveTo(PAGE_LEFT, bottom).lineTo(PAGE_LEFT + PAGE_WIDTH, bottom).strokeColor('#dddddd').lineWidth(0.7).stroke();
  doc.x = PAGE_LEFT;
  doc.y = bottom + 16;
  doc.fillColor('#111');
}

export function renderEsignPdf(
  title: string,
  bodyText: string,
  signature?: SignatureBlock,
  header?: PdfHeader | null,
): Promise<RenderedEsignPdf> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 56, size: 'A4', autoFirstPage: true, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('error', reject);

    const fontPath = resolveUnicodePdfFont();
    if (fontPath) doc.font(fontPath);

    if (header?.orgName) drawHeader(doc, header);
    doc.fontSize(18).text(title, PAGE_LEFT, doc.y, { align: 'left', width: PAGE_WIDTH });
    doc.moveDown(1);
    doc.fontSize(11).fillColor('#111');
    for (const block of splitBodyBlocks(bodyText)) {
      if (block.kind === 'table') drawTable(doc, block.rows);
      else doc.text(block.text, PAGE_LEFT, doc.y, { align: 'left', lineGap: 4, width: PAGE_WIDTH });
    }

    if (signature) {
      doc.moveDown(2);
      doc.moveTo(56, doc.y).lineTo(539, doc.y).strokeColor('#ddd').stroke();
      doc.moveDown(0.8);
      doc.fontSize(11).fillColor('#111').text('Подписано электронно', { continued: false });
      doc.moveDown(0.3);
      doc.fontSize(9).fillColor('#555');
      doc.text(`Подписал(а): ${signature.signerName}`);
      doc.text(`Дата и время: ${signature.signedAt.toLocaleString('ru-RU')}`);
      doc.text(`IP-адрес: ${signature.ip}`);
      doc.text(`Устройство: ${signature.userAgent}`);
      doc.moveDown(0.5);
      doc
        .fontSize(8)
        .fillColor('#888')
        .text(
          'Согласие подтверждено переходом по индивидуальной ссылке, отправленной на email подписанта, и нажатием кнопки «Подписать». Это является признанной формой электронной подписи по смыслу применимого законодательства об электронных документах.',
          { align: 'left' },
        );
    }

    // Must read the buffered range before .end() flushes it — the 'end' event fires
    // after the flush, at which point bufferedPageRange() has already reset to 0.
    const pageCount = doc.bufferedPageRange().count;
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), pageCount }));
    doc.end();
  });
}
