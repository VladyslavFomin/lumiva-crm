import { BadRequestException } from '@nestjs/common';
import { isPpReferenceRowLabel, parseSheetDate, readRawRows, xlsxSheetNames } from './hotel-pricing-sheet.util';
import { normalizeNumericInput } from './hotel-number.util';
import { occupancyGuestsFromLabel } from './hotel-occupancy.util';

/**
 * Прайс-лист сезона из Excel целиком (формат турецких контрактов):
 *   строка с датами начала и строка с датами конца периодов (колонки), «Min. Geceleme» / «Release Süresi»;
 *   заголовок категории «Luxury Land View Room / 40 - 45 m²» (без цен), строка «PP in DBL», строки размещений
 *   с коэффициентом во второй колонке («1,6 / 2» — обычный / пиковый).
 * Отсюда: PP периода = PP минимальной категории, разница категорий, пиковые периоды (по ценам: 490 = 245 × 2),
 * ручные цены ячеек, которые не сходятся с формулой.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;
const EPS = 0.011;

function num(raw: string | undefined): number | null {
  const s = String(raw ?? '').trim();
  if (!s || !/\d/.test(s)) return null;
  const v = Number(normalizeNumericInput(s));
  return Number.isFinite(v) ? v : null;
}

/** «1,6 / 2» → [1.6, 2]; «2,5» → [2.5]; «1,6 / 2» с пробелами и без */
export function parseCoefficients(raw: string | undefined): [number, number | null] | null {
  const parts = String(raw ?? '').split(/[\/|]/).map((x) => num(x)).filter((x): x is number => x !== null && x > 0);
  if (!parts.length) return null;
  return [parts[0], parts[1] && Math.abs(parts[1] - parts[0]) > 1e-9 ? parts[1] : null];
}

/** «Luxury Land View Room / 40 - 45 m²» → имя, площадь текстом, м² (меньшее число) */
export function parseCategoryLabel(label: string): { name: string; area: string | null; sizeM2: number | null } {
  const s = label.replace(/\s+/g, ' ').trim();
  const AREA = /(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\s*(?:m²|m2|м²|м2|sqm|sq\.?\s*m|kv)/i;
  const m = AREA.exec(s);
  if (!m) return { name: s, area: null, sizeM2: null };
  const before = s.slice(0, m.index).replace(/[\s/|,;–-]+$/, '').trim();
  return { name: before || s, area: m[0].trim(), sizeM2: num(m[1]) };
}

export interface ParsedPriceListPeriod {
  startDate: string;
  endDate: string;
  ppBase: number;
  minNights: number | null;
  releaseDays: number | null;
  budgetPP: number | null;
  isPeak: boolean;
}

export interface ParsedPriceListRow {
  label: string;
  coefficient: number;
  peakCoefficient: number | null;
  adults: number | null;
  children: number;
  infants: number;
  /** ручные цены по индексу периода — ячейки, которые не сходятся с PP × коэффициент */
  overrides: Record<number, number>;
}

export interface ParsedPriceListCategory {
  name: string;
  area: string | null;
  sizeM2: number | null;
  isBase: boolean;
  /** разница PP с минимальной категорией (самая частая по периодам) */
  offset: number;
  /** свой PP по индексу периода, где разница другая */
  periodPP: Record<number, number>;
  pp: Array<number | null>;
  rows: ParsedPriceListRow[];
}

/** Строка раннего бронирования прайса: окно брони, период проживания, скидка, предоплата (% и срок) */
export interface ParsedEarlyBooking {
  /** «Tüm Oda Tipleri» / «All room types» — null (все), иначе название категории как в файле */
  roomType: string | null;
  bookFrom: string | null;
  bookTo: string | null;
  stayFrom: string | null;
  stayTo: string | null;
  discountPct: number;
  prepaymentPct: number;
  prepaymentDueDate: string | null;
  /** «Liste Gönderim Tarihi» — до какой даты отправить список гостей (для туроператоров) */
  listDate: string | null;
}

export interface ParsedPriceList {
  /** лист, с которого взят прайс, и все листы книги */
  sheet: string | null;
  sheets: string[];
  currency: string | null;
  periods: ParsedPriceListPeriod[];
  categories: ParsedPriceListCategory[];
  earlyBooking: ParsedEarlyBooking[];
  warnings: string[];
}

const MIN_NIGHTS_RE = /min\.?\s*(gece|konak|night|stay|ноч|прожив)|minimum\s*(stay|night)|мин\.?\s*ноч/i;
const RELEASE_RE = /release|релиз/i;
const BUDGET_RE = /b[üu]t[çc]e|budget|бюджет|maliyet/i;
/** квота партнёра по категории — не размещение */
const ALLOTMENT_RE = /allotment|kontenjan|квота/i;
/** дальше прайса — раннее бронирование и условия: не категории и не размещения */
const STOP_RE = /erken\s*rezerv|early\s*book|ранн\S*\s*брон|^\s*(not|notes?|примечани|şartlar|conditions)\b/i;

const EB_HEAD_RE = /erken\s*rezerv|early\s*book|ранн\S*\s*брон/i;
const ALL_ROOMS_RE = /t[üu]m\s*oda|all\s*room|все\s*(типы|номера|категории)/i;

/** Дата ячейки: ISO, дд.мм.гггг и дд.мм.гг (01.04.27 → 2027-04-01) */
export function parseLooseDate(raw: string | undefined): string | null {
  const s = String(raw ?? '').trim();
  const full = parseSheetDate(s);
  if (full) return full;
  const m = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2})(?!\d)/.exec(s);
  if (!m) return null;
  const iso = `20${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

/** «01.04.27 - 10.11.27» → [с, по] */
function parseDateRange(raw: string | undefined): [string | null, string | null] {
  const parts = String(raw ?? '').split(/\s+[-–—]\s+|\s*[–—]\s*|\s+-\s*|\s*-\s+/).map((x) => parseLooseDate(x));
  return parts.length >= 2 ? [parts[0], parts[1]] : [parts[0] ?? null, null];
}

/** Доля или проценты: 0,3 → 30; 30 → 30; «30%» → 30 */
function pctOf(raw: string | undefined): number | null {
  const v = num(String(raw ?? '').replace('%', ''));
  if (v === null || v < 0) return null;
  return round2(v <= 1 ? v * 100 : v);
}

/**
 * Блок «ERKEN REZERVASYON / EARLY BOOKING» под прайсом: строка заголовков (Oda Tipi | Rezervasyon Dönemi ×2 |
 * Konaklama Tarihi | EB İndirim Oranı | Liste Gönderim Tarihi | EB Ödeme Tarihi | Ödeme Tutarı), дальше строки условий
 * до пустой строки или примечаний «*». В первой строке окна брони бывает только «по» (бронь до 31.01).
 */
export function parseEarlyBookingBlock(rows: string[][], headIdx: number, warnings: string[]): ParsedEarlyBooking[] {
  let h = -1;
  for (let i = headIdx; i < Math.min(rows.length, headIdx + 4); i++) {
    if (rows[i].some((c) => /oda\s*tip|room\s*type|тип\s*номер/i.test(c || '')) && rows[i].some((c) => /ndirim|discount|ebd|скидк/i.test(c || ''))) {
      h = i;
      break;
    }
  }
  if (h < 0) {
    warnings.push('eb_no_header');
    return [];
  }
  const head = rows[h].map((c) => (c || '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim());
  const find = (re: RegExp) => head.findIndex((c) => re.test(c));
  const cRoom = find(/oda tip|room type|тип номер/);
  const bookCols = head.map((c, i) => (/rezervasyon dönem|rezervasyon donem|booking (window|period)|период брони|окно брони/.test(c) ? i : -1)).filter((i) => i >= 0);
  const cStay = find(/konaklama|stay|прожив/);
  const cDisc = find(/ndirim|discount|ebd|скидк/);
  const cList = find(/liste|list date|список/);
  const cPayDate = find(/ödeme tarih|odeme tarih|payment date|срок оплат|дата оплат/);
  const cPayPct = find(/ödeme tutar|odeme tutar|ödeme oran|payment ?%|payment (amount|rate)|предоплат|сумма оплат/);
  const out: ParsedEarlyBooking[] = [];
  for (let r = h + 1; r < rows.length; r++) {
    const row = rows[r];
    const label = (row[cRoom >= 0 ? cRoom : 0] || '').trim();
    if (!row.some((c) => (c || '').trim())) {
      if (out.length) break;
      continue;
    }
    if (label.startsWith('*')) break;
    const discountPct = cDisc >= 0 ? pctOf(row[cDisc]) : null;
    if (!discountPct) continue;
    // окно брони: две колонки (с / по) или одна; если дата одна — это «по»
    const bookDates = bookCols.map((c) => parseLooseDate(row[c]));
    let bookFrom: string | null = null;
    let bookTo: string | null = null;
    if (bookDates.length >= 2) [bookFrom, bookTo] = [bookDates[0], bookDates[1]];
    else if (bookDates.length === 1) {
      const range = parseDateRange(row[bookCols[0]]);
      [bookFrom, bookTo] = range[1] ? range : [null, range[0]];
    }
    if (bookFrom && !bookTo) [bookFrom, bookTo] = [null, bookFrom];
    const [stayFrom, stayTo] = cStay >= 0 ? parseDateRange(row[cStay]) : [null, null];
    const payPct = cPayPct >= 0 ? pctOf(row[cPayPct]) : null;
    out.push({
      roomType: !label || ALL_ROOMS_RE.test(label) ? null : label.replace(/\s+/g, ' '),
      bookFrom,
      bookTo,
      stayFrom,
      stayTo,
      discountPct: Math.min(90, discountPct),
      prepaymentPct: payPct ? Math.min(100, payPct) : 0,
      prepaymentDueDate: cPayDate >= 0 ? parseLooseDate(row[cPayDate]) : null,
      listDate: cList >= 0 ? parseLooseDate(row[cList]) : null,
    });
  }
  if (!out.length) warnings.push('eb_empty');
  return out;
}

/** Лист: явно выбранный, иначе первый, где есть строки дат периодов */
export async function parseHotelPriceListSheet(file: { buffer: Buffer; originalname?: string }, sheet?: string | null): Promise<ParsedPriceList> {
  const isXlsx = /\.xlsx?$/i.test(file.originalname || '');
  const sheets = isXlsx ? await xlsxSheetNames(file.buffer) : [];
  if (sheet && sheets.includes(sheet)) return { ...(await parseOne(file, sheet)), sheet, sheets };
  let firstError: unknown = null;
  for (const name of sheets.length ? sheets : [undefined]) {
    try {
      return { ...(await parseOne(file, name)), sheet: name ?? null, sheets };
    } catch (e) {
      firstError = firstError || e;
    }
  }
  throw firstError;
}

async function parseOne(file: { buffer: Buffer; originalname?: string }, sheet?: string): Promise<Omit<ParsedPriceList, 'sheet' | 'sheets'>> {
  const rows = await readRawRows(file, sheet);
  if (!rows.length) throw new BadRequestException({ code: 'HOTEL_PRICELIST_EMPTY', message: 'Файл пустой' });

  // строка начала и строка конца периодов: даты в одних и тех же колонках
  let startIdx = -1;
  let cols: number[] = [];
  for (let i = 0; i < Math.min(rows.length - 1, 30); i++) {
    const found: number[] = [];
    for (let c = 0; c < Math.max(rows[i].length, rows[i + 1].length); c++) {
      const a = parseSheetDate(rows[i][c] || '');
      const b = parseSheetDate(rows[i + 1][c] || '');
      if (a && b && b >= a) found.push(c);
    }
    if (found.length) {
      startIdx = i;
      cols = found;
      break;
    }
  }
  if (startIdx < 0) {
    throw new BadRequestException({ code: 'HOTEL_PRICELIST_NO_PERIODS', message: 'Не найдены строки с датами начала и конца периодов' });
  }
  const firstCol = Math.min(...cols);
  const head = rows.slice(0, startIdx + 2).flat().join(' ');
  const currency = /€|euro|\beur\b/i.test(head) ? 'EUR' : /\$|usd|dollar/i.test(head) ? 'USD' : /₺|\btl\b|\btry\b/i.test(head) ? 'TRY' : /£|gbp/i.test(head) ? 'GBP' : null;

  const periods = cols.map((c) => ({
    startDate: parseSheetDate(rows[startIdx][c])!,
    endDate: parseSheetDate(rows[startIdx + 1][c])!,
    minNights: null as number | null,
    releaseDays: null as number | null,
    budgetPP: null as number | null,
  }));

  type RawCat = { label: string; pp: Array<number | null>; budget: Array<number | null> | null; rows: Array<{ label: string; coef: string; values: Array<number | null> }> };
  const cats: RawCat[] = [];
  let globalBudget: Array<number | null> | null = null;
  const warnings: string[] = [];
  let earlyBooking: ParsedEarlyBooking[] = [];

  for (let r = startIdx + 2; r < rows.length; r++) {
    const row = rows[r];
    const label = (row[0] || '').trim();
    // коэффициент — между колонкой названия и первой колонкой периода
    const coefCell = row.slice(1, firstCol).map((x) => (x || '').trim()).find((x) => x && x !== label) || '';
    const values = cols.map((c) => num(row[c]));
    const hasValues = values.some((v) => v !== null);
    if (!label && !hasValues) continue;
    if (STOP_RE.test(label)) {
      // раннее бронирование под прайсом — отдельный блок условий
      const ebAt = rows.slice(r).findIndex((x) => EB_HEAD_RE.test((x[0] || '').trim()));
      if (ebAt >= 0) earlyBooking = parseEarlyBookingBlock(rows, r + ebAt, warnings);
      break;
    }
    if (label.startsWith('*')) continue;
    if (ALLOTMENT_RE.test(label)) continue;
    if (MIN_NIGHTS_RE.test(label) || MIN_NIGHTS_RE.test(coefCell)) {
      values.forEach((v, i) => (periods[i].minNights = v !== null ? Math.round(v) : null));
      continue;
    }
    if (RELEASE_RE.test(label) || RELEASE_RE.test(coefCell)) {
      values.forEach((v, i) => (periods[i].releaseDays = v !== null ? Math.round(v) : null));
      continue;
    }
    if (!hasValues) {
      // заголовок категории (обычно объединённая серая строка) — без цен
      if (label) cats.push({ label, pp: [], budget: null, rows: [] });
      continue;
    }
    if (BUDGET_RE.test(label)) {
      if (cats.length) cats[cats.length - 1].budget = values;
      else globalBudget = values;
      continue;
    }
    if (!label) continue;
    if (!cats.length) cats.push({ label: 'Standard', pp: [], budget: null, rows: [] });
    const cat = cats[cats.length - 1];
    if (isPpReferenceRowLabel(label) || /^pp\b/i.test(label)) {
      cat.pp = values;
      continue;
    }
    cat.rows.push({ label, coef: coefCell, values });
  }

  const usable = cats.filter((c) => c.rows.length || c.pp.some((v) => v !== null));
  if (!usable.length) throw new BadRequestException({ code: 'HOTEL_PRICELIST_NO_ROOMS', message: 'Не найдены категории номеров с ценами' });

  // PP категории: строка «PP in DBL», иначе из размещения с коэффициентом 2 (2 AD)
  for (const c of usable) {
    if (c.pp.some((v) => v !== null)) continue;
    const dbl = c.rows.find((x) => {
      const k = parseCoefficients(x.coef);
      return k && k[0] === 2 && k[1] === null;
    });
    if (dbl) c.pp = dbl.values.map((v) => (v !== null ? round2(v / 2) : null));
    else warnings.push(`no_pp:${c.label}`);
  }

  // минимальная категория — с наименьшим средним PP
  const avg = (xs: Array<number | null>) => {
    const ok = xs.filter((x): x is number => x !== null && x > 0);
    return ok.length ? ok.reduce((s, x) => s + x, 0) / ok.length : Infinity;
  };
  const priced = usable.filter((c) => Number.isFinite(avg(c.pp)));
  if (!priced.length) throw new BadRequestException({ code: 'HOTEL_PRICELIST_NO_PP', message: 'Не найден PP (строка «PP in DBL») ни у одной категории' });
  const base = priced.reduce((m, c) => (avg(c.pp) < avg(m.pp) ? c : m), priced[0]);
  const basePP = cols.map((_, i) => base.pp[i] ?? 0);
  const budgets = base.budget || globalBudget;

  // пиковые периоды: размещения с двумя коэффициентами — какой из них сходится с ценой
  const votes = cols.map(() => ({ peak: 0, normal: 0 }));
  for (const c of priced) {
    for (const x of c.rows) {
      const k = parseCoefficients(x.coef);
      if (!k || k[1] === null) continue;
      x.values.forEach((v, i) => {
        const pp = c.pp[i];
        if (v === null || !pp) return;
        const isNormal = Math.abs(v - round2(pp * k[0])) < EPS;
        const isPeak = Math.abs(v - round2(pp * k[1]!)) < EPS;
        if (isPeak && !isNormal) votes[i].peak++;
        else if (isNormal) votes[i].normal++;
      });
    }
  }
  const isPeak = votes.map((v) => v.peak > v.normal);

  const categories: ParsedPriceListCategory[] = priced.map((c) => {
    const diffs = cols.map((_, i) => (c.pp[i] && basePP[i] ? round2(c.pp[i]! - basePP[i]) : null));
    const freq = new Map<number, number>();
    for (const d of diffs) if (d !== null) freq.set(d, (freq.get(d) || 0) + 1);
    const offset = c === base ? 0 : [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
    const periodPP: Record<number, number> = {};
    if (c !== base) {
      diffs.forEach((d, i) => {
        if (c.pp[i] && (d === null || Math.abs(d - offset) > 0.005)) periodPP[i] = c.pp[i]!;
      });
    }
    const parsed = parseCategoryLabel(c.label);
    const rowsOut: ParsedPriceListRow[] = c.rows.map((x) => {
      let k = parseCoefficients(x.coef);
      if (!k) {
        // нет колонки коэффициентов — из первой цены периода
        const i = x.values.findIndex((v, j) => v !== null && !!c.pp[j]);
        k = i >= 0 ? [round2(x.values[i]! / c.pp[i]!), null] : [1, null];
      }
      const overrides: Record<number, number> = {};
      x.values.forEach((v, i) => {
        const pp = c.pp[i];
        if (v === null || !pp) return;
        const coef = isPeak[i] && k![1] ? k![1]! : k![0];
        if (Math.abs(v - round2(pp * coef)) >= EPS) overrides[i] = round2(v);
      });
      const g = occupancyGuestsFromLabel(x.label);
      return { label: x.label.replace(/\s+/g, ' ').trim(), coefficient: k[0], peakCoefficient: k[1], adults: g.adults, children: g.children, infants: g.infants, overrides };
    });
    return { name: parsed.name, area: parsed.area, sizeM2: parsed.sizeM2, isBase: c === base, offset, periodPP, pp: c.pp, rows: rowsOut };
  });

  return {
    currency,
    periods: periods.map((p, i) => ({
      startDate: p.startDate,
      endDate: p.endDate,
      ppBase: basePP[i],
      minNights: p.minNights,
      releaseDays: p.releaseDays,
      budgetPP: budgets?.[i] ?? null,
      isPeak: isPeak[i],
    })),
    categories,
    earlyBooking,
    warnings,
  };
}
