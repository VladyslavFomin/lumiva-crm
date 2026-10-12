/**
 * Месяцы, явно названные в тексте задачи/вопроса («за август и сентябрь», «Ağustos 2026»,
 * «2026-08», «last month»). Нужен ИИ-сотрудникам и ИИ-офису: их данные — фиксированный снимок
 * (последние 30 дней / всё время), и без данных за названный период модель придумывала цифры.
 */

const MONTHS: Array<{ re: RegExp; m: number }> = [
  { re: /январ|january|\bocak/i, m: 1 },
  { re: /феврал|february|şubat|subat/i, m: 2 },
  { re: /(?<![а-яё])март(?!ини)|\bmarch\b|\bmart\b/i, m: 3 },
  { re: /апрел|\bapril|\bnisan/i, m: 4 },
  { re: /(?<![а-яё])ма[йяе](?![а-яё])|\bmay\s+20\d\d|\bin\s+may\b|\bmayıs|\bmayis/i, m: 5 },
  { re: /(?<![а-яё])июн|\bjune\b|haziran/i, m: 6 },
  { re: /(?<![а-яё])июл|\bjuly\b|temmuz/i, m: 7 },
  { re: /август|august|ağustos|agustos/i, m: 8 },
  { re: /сентябр|september|eylül|eylul/i, m: 9 },
  { re: /октябр|october|\bekim\b/i, m: 10 },
  { re: /ноябр|november|kasım|kasim/i, m: 11 },
  { re: /декабр|december|aralık|aralik/i, m: 12 },
];

const pad = (n: number) => String(n).padStart(2, '0');
const monthKey = (y: number, m: number) => `${y}-${pad(m)}`;

/** Список месяцев YYYY-MM (по возрастанию, не больше 24), упомянутых в тексте. */
export function monthsMentioned(text: string, now = new Date()): string[] {
  const t = String(text || '');
  const curY = now.getUTCFullYear();
  const curM = now.getUTCMonth() + 1;
  const years = [...t.matchAll(/\b(20\d\d)\b/g)].map((m) => Number(m[1]));
  const out = new Set<string>();

  for (const { re, m } of MONTHS) {
    if (!re.test(t)) continue;
    if (years.length) {
      for (const y of new Set(years)) out.add(monthKey(y, m));
    } else {
      // Без года — ближайший прошедший такой месяц (в октябре «август» — этого года, «ноябрь» — прошлого).
      out.add(monthKey(m > curM ? curY - 1 : curY, m));
    }
  }
  for (const m of t.matchAll(/\b(20\d\d)-(0[1-9]|1[0-2])\b(?!-\d)/g)) out.add(`${m[1]}-${m[2]}`);
  for (const m of t.matchAll(/(?<![\d./])(0?[1-9]|1[0-2])[./](20\d\d)\b/g)) out.add(monthKey(Number(m[2]), Number(m[1])));
  if (/прошл\w* месяц|предыдущ\w* месяц|last month|previous month|geçen ay|gecen ay/i.test(t)) {
    out.add(curM === 1 ? monthKey(curY - 1, 12) : monthKey(curY, curM - 1));
  }
  if (/(этот|этом|текущ\w*) месяц|this month|current month|bu ay/i.test(t)) out.add(monthKey(curY, curM));

  return [...out].filter((k) => k <= monthKey(curY, curM)).sort().slice(-24);
}

/** Границы периода (YYYY-MM-DD) по списку месяцев. */
export function monthsRange(months: string[]): { from: string; to: string } | null {
  if (!months.length) return null;
  const [y, m] = months[months.length - 1].split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${months[0]}-01`, to: `${months[months.length - 1]}-${pad(last)}` };
}
