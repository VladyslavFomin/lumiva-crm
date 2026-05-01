/**
 * Разбор десятичных строк из Woo/import/Excel: 755, 755.00, 755,00, 1.755,00, 1,755.00
 */
export function parseDecimalString(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  let t = String(raw)
    .trim()
    .replace(/\s/g, '')
    .replace(/\u00a0/g, '');
  if (!t) return null;
  t = t.replace(/[₺$€£¥]/g, '');
  t = t.replace(/[A-Z]{3}$/i, '').trim();
  const neg = t.startsWith('-');
  t = t.replace(/^-/, '');
  t = t.replace(/[^\d.,]/g, '');
  if (!t) return null;

  const lastComma = t.lastIndexOf(',');
  const lastDot = t.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      t = t.replace(/\./g, '').replace(',', '.');
    } else {
      t = t.replace(/,/g, '');
    }
  } else if (lastComma >= 0) {
    const parts = t.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      t = `${parts[0].replace(/\./g, '')}.${parts[1]}`;
    } else {
      t = t.replace(/,/g, '');
    }
  } else if (lastDot >= 0) {
    const parts = t.split('.');
    if (parts.length > 2) {
      t = `${parts.slice(0, -1).join('')}.${parts[parts.length - 1]}`;
    }
  }

  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

export function formatDecimalForFlat(n: number, maxFraction = 6): string {
  if (!Number.isFinite(n)) return '';
  return String(Number(n.toFixed(maxFraction)));
}
