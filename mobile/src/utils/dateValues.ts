import { appLocale } from '../i18n/format';

// Stored formats (identical to the website, which shares the same `customFields` JSON):
//   date      → 'YYYY-MM-DD'
//   datetime  → 'YYYY-MM-DDTHH:mm' (local, no zone)
//   daterange → { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' | null }
// Parsing a bare 'YYYY-MM-DD' with `new Date(str)` means UTC midnight, which shows the previous day west of UTC —
// always parse date-only values as LOCAL midnight.

export interface DateRange {
  start: string | null;
  end: string | null;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoDate(v: unknown): Date | null {
  if (typeof v !== 'string' || !v) return null;
  const d = ISO_DAY.test(v) ? new Date(`${v}T00:00:00`) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toIsoDateTime(d: Date): string {
  return `${toIsoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Accepts the website's `{start,end}` and the legacy `{from,to}` shape; anything else → null (never `[object Object]`). */
export function normalizeRange(raw: unknown): DateRange | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const start = (r.start ?? r.from) as unknown;
  const end = (r.end ?? r.to) as unknown;
  const s = typeof start === 'string' && start ? start : null;
  const e = typeof end === 'string' && end ? end : null;
  return s || e ? { start: s, end: e } : null;
}

export function formatDay(d: Date, withYear = true): string {
  return d.toLocaleDateString(appLocale(), { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}

export function formatDateTime(d: Date): string {
  return `${formatDay(d)}, ${d.toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' })}`;
}

/** Same wording rules as the website's DateFieldPicker: `17 Sep – 24 Sep 2026`, or full years when they differ. */
export function formatRange(range: DateRange, fromWord: string, toWord: string): string {
  const s = parseIsoDate(range.start);
  const e = parseIsoDate(range.end);
  if (s && e) return s.getFullYear() === e.getFullYear() ? `${formatDay(s, false)} – ${formatDay(e)}` : `${formatDay(s)} – ${formatDay(e)}`;
  if (s) return `${fromWord} ${formatDay(s)}`;
  if (e) return `${toWord} ${formatDay(e)}`;
  return '—';
}

/** Inclusive number of days in a range (17→24 Sept = 8), or null if the range is open. */
export function rangeDays(range: DateRange): number | null {
  const s = parseIsoDate(range.start);
  const e = parseIsoDate(range.end);
  if (!s || !e) return null;
  return Math.round(Math.abs(e.getTime() - s.getTime()) / 86400000) + 1;
}
