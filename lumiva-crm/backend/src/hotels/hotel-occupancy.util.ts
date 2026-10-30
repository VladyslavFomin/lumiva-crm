import type { HotelChildPolicyRule } from './hotel-contract.entity';

/** Состав гостей ↔ вариант размещения (SGL, 2 AD, 2 AD + 1 CHD…). Та же разборка названия — в миграции 1794400000000. */

const ADULTS_RE = /(\d+)\s*(?:AD|ADL|ADT|ADULT|ВЗР|YET|YTŞ)/i;
const CHILD_RE = /(\d+)\s*(?:CHD|CH|CHILD|РЕБ|ДЕТ|ÇCK|ÇOC)/i;

export function occupancyGuestsFromLabel(label: string | null | undefined): { adults: number | null; children: number } {
  const s = String(label || '');
  const a = ADULTS_RE.exec(s);
  let adults: number | null = a ? Number(a[1]) : null;
  if (adults === null) {
    if (/(SGL|SNG|SINGLE|TEK)/i.test(s)) adults = 1;
    else if (/(DBL|DOUBLE|TWN|TWIN|ÇİFT)/i.test(s)) adults = 2;
    else if (/(TRP|TRIPLE)/i.test(s)) adults = 3;
    else if (/(QUAD|QDR)/i.test(s)) adults = 4;
  }
  const c = CHILD_RE.exec(s);
  return { adults, children: c ? Number(c[1]) : 0 };
}

/** Возрасты детей → взрослые/дети по правилу отеля: возраст ≥ childMaxAge считается взрослым; неизвестный возраст — ребёнок. */
export function splitGuests(adults: number, childAges: Array<number | null> | null | undefined, childMaxAge: number) {
  const ages = Array.isArray(childAges) ? childAges : [];
  const grown = ages.filter((a) => a !== null && a !== undefined && Number(a) >= childMaxAge).length;
  return { adults: Math.max(0, adults) + grown, children: ages.length - grown, grown };
}

/** Вариант размещения ровно под состав: столько же взрослых и детей */
export function matchOccupancy<T extends { adults: number | null; children: number; label: string }>(types: T[], adults: number, children: number): T | null {
  return (
    types.find((o) => {
      const g = o.adults === null || o.adults === undefined ? occupancyGuestsFromLabel(o.label) : { adults: o.adults, children: o.children };
      return g.adults === adults && (g.children || 0) === children;
    }) || null
  );
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
  reason: 'rule' | 'no_rule' | 'no_age';
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
    if (age === null) {
      const cands = policy.filter((r) => !r.childNo || r.childNo === no);
      return { childNo: no, age, share: cands.length ? Math.max(...cands.map(share)) : 1, reason: 'no_age' as const };
    }
    const hit = policy.find((r) => r.childNo === no && age >= r.ageFrom && age < r.ageTo) || policy.find((r) => !r.childNo && age >= r.ageFrom && age < r.ageTo);
    return hit ? { childNo: no, age, share: share(hit), reason: 'rule' as const } : { childNo: no, age, share: 1, reason: 'no_rule' as const };
  });
}
