/** Сумма с валютой; без валюты — просто число с разделителями. */
export function money(v: number, currency: string | null | undefined, locale?: string) {
  const n = Number(v) || 0;
  if (!currency) return Math.round(n).toLocaleString(locale);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${Math.round(n).toLocaleString(locale)} ${currency.toUpperCase()}`;
  }
}

export const fmtDate = (d: string | null | undefined, locale: string) =>
  d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** Сегодня по локальной дате пользователя (не UTC: в Турции до 03:00 UTC-дата ещё вчерашняя) */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const addDaysIso = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
