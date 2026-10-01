// src/bookings/booking-time.util.ts
// Время в часовом поясе проекта/локации бронирования. Сервер (docker) живёт в UTC, а рабочие часы,
// график мастеров и «завтра в 16:00» клиента — местное время салона, поэтому getHours()/getDay()
// сервера для них не годятся.

export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

const fmtCache = new Map<string, Intl.DateTimeFormat>();

export function safeTimeZone(tz?: string | null): string {
  const z = String(tz || '').trim();
  if (!z) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: z });
    return z;
  } catch {
    return 'UTC';
  }
}

function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  /** YYYY-MM-DD */
  ymd: string;
  /** HH:mm */
  hm: string;
  weekday: WeekdayKey;
  /** минуты от полуночи */
  minutes: number;
}

export function zonedParts(date: Date, tz: string): ZonedParts {
  const p: Record<string, string> = {};
  for (const part of fmt(tz).formatToParts(date)) p[part.type] = part.value;
  const hour = p.hour === '24' ? '00' : p.hour;
  return {
    ymd: `${p.year}-${p.month}-${p.day}`,
    hm: `${hour}:${p.minute}`,
    weekday: (p.weekday || 'Sun').slice(0, 3).toLowerCase() as WeekdayKey,
    minutes: Number(hour) * 60 + Number(p.minute),
  };
}

/** Смещение пояса относительно UTC в миллисекундах в момент date. */
function offsetMs(date: Date, tz: string): number {
  const p: Record<string, string> = {};
  for (const part of fmt(tz).formatToParts(date)) p[part.type] = part.value;
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour === '24' ? '0' : p.hour), Number(p.minute), Number(p.second));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Местные дата+время в поясе tz → момент UTC (с учётом перехода на летнее время). */
export function zonedToUtc(ymd: string, hm: string, tz: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const [h, mi] = hm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h || 0, mi || 0);
  let ts = guess - offsetMs(new Date(guess), tz);
  const again = guess - offsetMs(new Date(ts), tz);
  if (again !== ts) ts = again;
  return new Date(ts);
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

export function weekdayOfYmd(ymd: string): WeekdayKey {
  const [y, m, d] = ymd.split('-').map(Number);
  return WEEKDAY_KEYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function hmToMinutes(s: string): number {
  const [h, m] = String(s || '').split(':').map((n) => Number(n) || 0);
  return h * 60 + m;
}

export function minutesToHm(n: number): string {
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
export const HM_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
