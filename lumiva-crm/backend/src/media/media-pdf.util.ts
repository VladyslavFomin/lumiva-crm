import { execFile } from 'child_process';
import { open, rename, stat, unlink } from 'fs/promises';

const run = (args: string[], timeoutMs: number) =>
  new Promise<number>((resolve) => {
    execFile('qpdf', args, { timeout: timeoutMs }, (err) => resolve(err ? Number((err as { code?: unknown }).code ?? 1) || 1 : 0));
  });

/** Есть ли в файле подпись (/ByteRange) — перепаковка её сломает. Ищем потоково, без чтения всего файла в память. */
async function hasSignature(abs: string): Promise<boolean> {
  const fh = await open(abs, 'r');
  try {
    const buf = Buffer.alloc(1 << 20);
    let pos = 0;
    let tail = '';
    for (;;) {
      const { bytesRead } = await fh.read(buf, 0, buf.length, pos);
      if (!bytesRead) return false;
      const chunk = tail + buf.toString('latin1', 0, bytesRead);
      if (chunk.includes('/ByteRange')) return true;
      tail = chunk.slice(-16);
      pos += bytesRead;
    }
  } finally {
    await fh.close();
  }
}

/**
 * Перепаковка PDF для просмотра в браузере (qpdf --object-streams=generate): словари страниц собираются в
 * несколько компактных блоков. Без этого pdf.js у «пересохранённых» каталогов перед первой страницей читал
 * десятки разбросанных мест файла (10+ МБ на медленном канале), после — сотни килобайт. Страницы и картинки
 * не пережимаются. Подписанные и зашифрованные PDF не трогаем.
 * Возвращает новый размер файла или null, если файл оставлен как есть.
 */
export async function optimizePdfForWeb(abs: string, timeoutMs = 180_000): Promise<number | null> {
  if ((await run(['--is-encrypted', abs], 15_000)) === 0) return null;
  if (await hasSignature(abs)) return null;
  const tmp = `${abs}.opt-${process.pid}-${Date.now()}`;
  try {
    const code = await run(['--object-streams=generate', abs, tmp], timeoutMs);
    // 3 — предупреждения qpdf (мелкие огрехи исходника), файл при этом записан
    if (code !== 0 && code !== 3) return null;
    const st = await stat(tmp).catch(() => null);
    if (!st || st.size < 1024) return null;
    const fh = await open(tmp, 'r');
    const head = Buffer.alloc(5);
    await fh.read(head, 0, 5, 0);
    await fh.close();
    if (head.toString('latin1') !== '%PDF-') return null;
    await rename(tmp, abs);
    return st.size;
  } finally {
    await unlink(tmp).catch(() => undefined);
  }
}
