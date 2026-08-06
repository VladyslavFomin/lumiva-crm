import { existsSync } from 'fs';

/** TTF с кириллицей: Alpine (font-dejavu), Debian/Ubuntu. Shared by every pdfkit-based PDF
 * generator in the backend (products price lists, esign documents, automation reports, hotel
 * folios) — previously duplicated verbatim in each of those files. */
export function resolveUnicodePdfFont(): string | null {
  const candidates = [
    '/usr/share/fonts/TTF/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/dejavu/ttf/DejaVuSans.ttf',
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}
