/**
 * Ключи ячеек календаря — всегда локальная календарная дата YYYY-MM-DD,
 * без toISOString() (иначе смещение на соседний день в части часовых поясов).
 */

export function toLocalDateKey(input: string | Date | null | undefined): string {
  if (input === null || input === undefined) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type LocalYMD = { y: number; m: number; d: number };

/** Разбор значения поля: YYYY-MM-DD как локальная дата; иначе Date.parse → локальные компоненты. */
export function parseToLocalYMD(raw: string | null | undefined): LocalYMD | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const y = Number(ymd[1]);
    const mo = Number(ymd[2]);
    const d = Number(ymd[3]);
    if (y >= 1000 && y <= 9999 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return { y, m: mo, d };
    }
  }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
}

function ymdToKey(p: LocalYMD): string {
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/** Все календарные дни от start до end включительно (локальное время). */
export function enumerateInclusiveLocalDayKeys(start: LocalYMD, end: LocalYMD): string[] {
  const out: string[] = [];
  const t0 = new Date(start.y, start.m - 1, start.d).getTime();
  const t1 = new Date(end.y, end.m - 1, end.d).getTime();
  const lo = Math.min(t0, t1);
  const hi = Math.max(t0, t1);
  const cursor = new Date(lo);
  while (cursor.getTime() <= hi) {
    out.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** Одна дата или диапазон [start, end] по двум строкам (вторая пустая = один день). */
export function dayKeysFromStartEndStrings(
  startRaw: string | null | undefined,
  endRaw?: string | null,
): string[] {
  const start = parseToLocalYMD(startRaw);
  if (!start) return [];
  const end = parseToLocalYMD(endRaw);
  if (!endRaw || !String(endRaw).trim() || !end) {
    return [ymdToKey(start)];
  }
  return enumerateInclusiveLocalDayKeys(start, end);
}

/**
 * Разбор значения {@code <input type="datetime-local">}: локальные компоненты,
 * без неоднозначного {@code Date.parse} в части браузеров.
 */
export function parseDatetimeLocalValue(raw: string | null | undefined): Date | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const h = Number(m[4]);
    const min = Number(m[5]);
    const sec = m[6] != null && m[6] !== '' ? Number(m[6]) : 0;
    if (
      [y, mo, d, h, min, sec].some((n) => Number.isNaN(n)) ||
      mo < 1 ||
      mo > 12 ||
      d < 1 ||
      d > 31 ||
      h < 0 ||
      h > 23 ||
      min < 0 ||
      min > 59 ||
      sec < 0 ||
      sec > 59
    ) {
      return null;
    }
    const dt = new Date(y, mo - 1, d, h, min, sec, 0);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
      return null;
    }
    return dt;
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
