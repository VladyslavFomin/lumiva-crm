import type { HotelChildPolicyRule } from './hotel-contract.entity';

/** Состав гостей ↔ вариант размещения (SGL, 2 AD, 2 AD + 1 CHD…). Та же разборка названия — в миграции 1794400000000. */

const ADULTS_RE = /(\d+)\s*(?:AD|ADL|ADT|ADULT|ВЗР|YET|YTŞ)/i;
const ADULTS_RANGE_RE = /(\d+)\s*[-–]\s*(\d+)\s*(?:AD|ADL|ADT|ADULT|ВЗР|YET|YTŞ)/i;
const CHILD_RE = /(\d+)\s*(?:CHD|CH|CHILD|РЕБ|ДЕТ|ÇCK|ÇOC)/i;
const INFANT_RE = /(\d+)\s*(?:INF|INFANT|BEBEK|МЛАД)/i;
const BAND_RE = /\(\s*(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*\)/g;

/** Младенец — ребёнок младше 2 лет (в прайсах «INF (00-01,99)»): бесплатно, но нужна детская кроватка (бэбикот) */
export const INFANT_MAX_AGE = 2;
export const isInfant = (age: number | null | undefined) => age !== null && age !== undefined && age < INFANT_MAX_AGE;

export interface OccupancyGuests {
  adults: number | null;
  /** «1 - 5 AD» — от 1 до 5 взрослых; иначе = adults */
  adultsMin: number | null;
  children: number;
  infants: number;
  /** возрастные полосы детей из названия «(02-11,99)», по одной на ребёнка; пусто — любой возраст */
  childBands: Array<{ from: number; to: number }>;
}

export function occupancyGuestsFromLabel(label: string | null | undefined): OccupancyGuests {
  const s = String(label || '');
  const range = ADULTS_RANGE_RE.exec(s);
  const a = ADULTS_RE.exec(s);
  let adults: number | null = a ? Number(a[1]) : null;
  if (adults === null) {
    if (/(SGL|SNG|SINGLE|TEK)/i.test(s)) adults = 1;
    else if (/(DBL|DOUBLE|TWN|TWIN|ÇİFT)/i.test(s)) adults = 2;
    else if (/(TRP|TRIPLE)/i.test(s)) adults = 3;
    else if (/(QUAD|QDR)/i.test(s)) adults = 4;
  }
  const c = CHILD_RE.exec(s);
  const inf = INFANT_RE.exec(s);
  // полосы детей — до упоминания младенца («+ 1 INF (00-01,99)» — это полоса младенца)
  const childPart = inf ? s.slice(0, inf.index) : s;
  const childBands = [...childPart.matchAll(BAND_RE)].map((m) => ({ from: Number(m[1].replace(',', '.')), to: Number(m[2].replace(',', '.')) }));
  return {
    adults,
    adultsMin: range ? Number(range[1]) : adults,
    children: c ? Number(c[1]) : 0,
    infants: inf ? Number(inf[1]) : 0,
    childBands,
  };
}

/** Возрасты детей → взрослые/дети по правилу отеля: возраст ≥ childMaxAge считается взрослым; неизвестный возраст — ребёнок. */
export function splitGuests(adults: number, childAges: Array<number | null> | null | undefined, childMaxAge: number) {
  const ages = Array.isArray(childAges) ? childAges : [];
  const grown = ages.filter((a) => a !== null && a !== undefined && Number(a) >= childMaxAge).length;
  const infants = ages.filter((a) => isInfant(a)).length;
  return { adults: Math.max(0, adults) + grown, children: ages.length - grown, grown, infants };
}

/** Каждый ребёнок попадает в свою полосу (неизвестный возраст — в любую); полос нет — подходит любой возраст */
function bandsFit(ages: Array<number | null>, bands: Array<{ from: number; to: number }>) {
  if (!bands.length) return true;
  const known = ages.filter((a): a is number => a !== null).sort((x, y) => x - y);
  // «2 CHD (02-11,99)» — одна полоса на всех детей
  const free = [...bands].sort((x, y) => x.from - y.from);
  while (free.length < known.length) free.push(free[free.length - 1]);
  for (const age of known) {
    const i = free.findIndex((b) => age >= b.from && age < Math.floor(b.to) + 1);
    if (i < 0) return false;
    free.splice(i, 1);
  }
  return true;
}

/**
 * Вариант размещения под состав: взрослые (или диапазон «1 - 5 AD») + дети с возрастами.
 * Порядок: размещение с младенцем («+ 1 INF») → младенец как ребёнок в полосе «(0-11,99)» → младенец сверх размещения
 * (бесплатно). Полосы возрастов из названия должны совпасть: «(02-11,99)» — младенцу не подходит.
 */
export function matchOccupancyByAges<T extends { adults: number | null; children: number; infants?: number | null; label: string }>(
  types: T[],
  adults: number,
  kidAges: Array<number | null>,
): T | null {
  const infants = kidAges.filter(isInfant);
  const others = kidAges.filter((a) => !isInfant(a));
  const parsed = types.map((o) => {
    const g = occupancyGuestsFromLabel(o.label);
    const max = o.adults ?? g.adults;
    return { o, min: g.adults === max ? g.adultsMin ?? max : max, max, children: o.adults !== null && o.adults !== undefined ? o.children || 0 : g.children, infants: o.infants ?? g.infants, bands: g.childBands };
  });
  const fitsAdults = (p: (typeof parsed)[number]) => p.max !== null && p.min !== null && adults >= p.min && adults <= p.max;
  const passes: Array<(p: (typeof parsed)[number]) => boolean> = [
    (p) => infants.length > 0 && p.infants === infants.length && p.children === others.length && bandsFit(others, p.bands),
    (p) => !p.infants && p.children === kidAges.length && bandsFit(kidAges, p.bands),
    (p) => infants.length > 0 && !p.infants && p.children === others.length && bandsFit(others, p.bands),
  ];
  for (const pass of passes) {
    const hit = parsed.find((p) => fitsAdults(p) && pass(p));
    if (hit) return hit.o;
  }
  return null;
}

/** Вариант размещения ровно под состав: столько же взрослых и детей (возраст не известен) */
export function matchOccupancy<T extends { adults: number | null; children: number; infants?: number | null; label: string }>(types: T[], adults: number, children: number): T | null {
  return matchOccupancyByAges(types, adults, Array.from({ length: children }, () => null));
}

/** Нормализация списка возрастов из запроса: целые 0..17 или null (возраст не указан), не больше 10 детей */
export function normalizeChildAges(raw: unknown): Array<number | null> {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 10).map((v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 && n <= 17 ? n : null;
  });
}

const clampNum = (v: unknown, min: number, max: number, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

/** Правила детской политики из запроса (отель и контракт): возраст 0–18, 0–100 %, не больше 10 правил */
export function normalizeChildPolicy(raw: unknown): HotelChildPolicyRule[] {
  return (Array.isArray(raw) ? raw : [])
    .map((r: any): HotelChildPolicyRule => {
      const childNo = Math.round(clampNum(r?.childNo, 0, 4, 0));
      return {
        ageFrom: clampNum(r?.ageFrom, 0, 17, 0),
        ageTo: clampNum(r?.ageTo, 0, 18, 0),
        type: r?.type === 'percent' ? 'percent' : 'free',
        value: clampNum(r?.value, 0, 100, 0),
        ...(childNo ? { childNo } : {}),
      };
    })
    .filter((r) => r.ageTo > r.ageFrom)
    .sort((a, b) => (a.childNo || 0) - (b.childNo || 0) || a.ageFrom - b.ageFrom)
    .slice(0, 10);
}

export interface ChildRateLine {
  /** номер ребёнка по старшинству (1 — старший) */
  childNo: number;
  age: number | null;
  /** доля цены взрослого: 0 — бесплатно, 0.5 — 50 %, 1 — как взрослый */
  share: number;
  /** правило не нашлось — по цене взрослого; возраст не указан — по самой дорогой полосе */
  reason: 'rule' | 'no_rule' | 'no_age' | 'infant';
}

/**
 * Доля цены взрослого для каждого ребёнка: дети по старшинству (неизвестный возраст — в конце), правило для N-го ребёнка
 * важнее общего; возраст в [ageFrom; ageTo). Нет подходящей полосы — как взрослый; возраст не указан — самая дорогая полоса.
 */
export function childRateLines(policy: HotelChildPolicyRule[], childAges: Array<number | null>): ChildRateLine[] {
  const sorted = [...childAges].sort((a, b) => (b ?? -1) - (a ?? -1));
  const share = (r: HotelChildPolicyRule) => (r.type === 'free' ? 0 : r.value / 100);
  return sorted.map((age, i) => {
    const no = i + 1;
    if (isInfant(age)) return { childNo: no, age, share: 0, reason: 'infant' as const };
    if (age === null) {
      const cands = policy.filter((r) => !r.childNo || r.childNo === no);
      return { childNo: no, age, share: cands.length ? Math.max(...cands.map(share)) : 1, reason: 'no_age' as const };
    }
    const hit = policy.find((r) => r.childNo === no && age >= r.ageFrom && age < r.ageTo) || policy.find((r) => !r.childNo && age >= r.ageFrom && age < r.ageTo);
    return hit ? { childNo: no, age, share: share(hit), reason: 'rule' as const } : { childNo: no, age, share: 1, reason: 'no_rule' as const };
  });
}
