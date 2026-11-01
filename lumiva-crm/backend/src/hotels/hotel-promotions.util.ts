import type { HotelPromotion, HotelPromotionType } from './hotel-promotion.entity';

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export type PromotionRule = Pick<
  HotelPromotion,
  | 'id' | 'type' | 'name' | 'discountPct' | 'freeNights' | 'bookFrom' | 'bookTo' | 'stayFrom' | 'stayTo' | 'stayRule'
  | 'minNights' | 'maxNights' | 'minDaysBefore' | 'maxDaysBefore' | 'combinable' | 'prepaymentPct' | 'prepaymentDueDate'
  | 'prepaymentDueDays' | 'marketGroupIds' | 'roomTypeIds' | 'ratePlanIds' | 'sellDirect' | 'sellWebsite' | 'active'
>;

export interface PromotionContext {
  checkIn: string;
  checkOut: string;
  /** дата брони по времени отеля */
  bookedOn: string;
  roomTypeId: string;
  marketGroupId: string | null;
  ratePlanId: string | null;
  salesChannel: 'direct' | 'website';
}

/** Почему акция не подошла — для подсказки «почему нет скидки» */
export type PromotionBlocker =
  | 'inactive' | 'channel' | 'room' | 'market' | 'rate_plan' | 'book_window' | 'lead_time' | 'min_nights' | 'max_nights' | 'stay_window';

/** Применённая акция — снимок в брони (имя и условия на момент брони) */
export interface AppliedPromotion {
  id: string;
  type: HotelPromotionType;
  name: string;
  discountPct: number;
  freeNights: number;
  /** скидка гостю по этой акции, в валюте отеля */
  amount: number;
  prepaymentPct: number;
  prepaymentDueDate: string | null;
}

export interface PromotionNight {
  /** итоговая скидка ночи, % (бесплатная ночь — 100) */
  pct: number;
  free: boolean;
  amount: number;
}

/** Ночи акции: по правилу «заезд в периоде» — все ночи, иначе — только ночи внутри периода проживания */
export function promotionNights(p: Pick<PromotionRule, 'stayFrom' | 'stayTo' | 'stayRule'>, dates: string[]): boolean[] {
  const inside = (d: string) => (!p.stayFrom || d >= p.stayFrom) && (!p.stayTo || d <= p.stayTo);
  if (p.stayRule === 'arrival') {
    const ok = dates.length > 0 && inside(dates[0]);
    return dates.map(() => ok);
  }
  return dates.map(inside);
}

/** Условия брони, которые акция проверяет целиком (без цен) */
export function promotionBlockers(p: PromotionRule, ctx: PromotionContext, dates: string[]): PromotionBlocker[] {
  const out: PromotionBlocker[] = [];
  if (!p.active) out.push('inactive');
  if ((ctx.salesChannel === 'website' && !p.sellWebsite) || (ctx.salesChannel === 'direct' && !p.sellDirect)) out.push('channel');
  if (p.roomTypeIds?.length && !p.roomTypeIds.includes(ctx.roomTypeId)) out.push('room');
  if (p.marketGroupIds?.length && (!ctx.marketGroupId || !p.marketGroupIds.includes(ctx.marketGroupId))) out.push('market');
  if (p.ratePlanIds?.length && (!ctx.ratePlanId || !p.ratePlanIds.includes(ctx.ratePlanId))) out.push('rate_plan');
  if ((p.bookFrom && ctx.bookedOn < p.bookFrom) || (p.bookTo && ctx.bookedOn > p.bookTo)) out.push('book_window');
  const lead = daysBetween(ctx.bookedOn, ctx.checkIn);
  if ((p.minDaysBefore !== null && p.minDaysBefore !== undefined && lead < p.minDaysBefore) || (p.maxDaysBefore !== null && p.maxDaysBefore !== undefined && lead > p.maxDaysBefore)) out.push('lead_time');
  if (dates.length < Math.max(1, p.minNights || 1)) out.push('min_nights');
  if (p.maxNights && dates.length > p.maxNights) out.push('max_nights');
  if (!promotionNights(p, dates).some(Boolean)) out.push('stay_window');
  return out;
}

/** Бесплатные ночи акции: за каждые полные minNights ночей периода — freeNights самых дешёвых из них */
function freeNightIdx(p: PromotionRule, prices: number[], eligible: boolean[], taken: Set<number>): number[] {
  const idx = prices.map((_, i) => i).filter((i) => eligible[i]);
  const blocks = Math.floor(idx.length / Math.max(1, p.minNights || 1));
  const count = Math.min(idx.length, blocks * Math.max(0, p.freeNights || 0));
  return idx
    .filter((i) => !taken.has(i))
    .sort((a, b) => prices[a] - prices[b] || a - b)
    .slice(0, count);
}

/** Скидка одной акции отдельно (для выбора лучшей из несуммируемых) */
function standalone(p: PromotionRule, prices: number[], dates: string[]): number {
  const eligible = promotionNights(p, dates);
  if (p.freeNights > 0) return freeNightIdx(p, prices, eligible, new Set()).reduce((s, i) => s + prices[i], 0);
  const pct = Math.min(90, Math.max(0, num(p.discountPct)));
  return prices.reduce((s, v, i) => s + (eligible[i] ? (v * pct) / 100 : 0), 0);
}

/**
 * Акции к цене брони по ночам: подходящие суммируемые — все, из несуммируемых — самая выгодная гостю (по сумме скидки).
 * Сначала бесплатные ночи (самые дешёвые в периоде), на остальные ночи — сумма % акций этой ночи (не больше 90 %).
 */
export function applyPromotions(rules: PromotionRule[], ctx: PromotionContext, dates: string[], prices: number[]) {
  const fits = rules.filter((p) => !promotionBlockers(p, ctx, dates).length && (num(p.discountPct) > 0 || p.freeNights > 0));
  const scored = fits.map((p) => ({ p, amount: standalone(p, prices, dates) })).filter((x) => x.amount > 0.004);
  const best = scored.filter((x) => !x.p.combinable).sort((a, b) => b.amount - a.amount)[0];
  const chosen = [...scored.filter((x) => x.p.combinable), ...(best ? [best] : [])].map((x) => x.p);

  const nights: PromotionNight[] = prices.map(() => ({ pct: 0, free: false, amount: 0 }));
  const perPromo = new Map<string, number>();
  const taken = new Set<number>();
  for (const p of chosen.filter((x) => x.freeNights > 0)) {
    for (const i of freeNightIdx(p, prices, promotionNights(p, dates), taken)) {
      taken.add(i);
      nights[i] = { pct: 100, free: true, amount: round2(prices[i]) };
      perPromo.set(p.id, (perPromo.get(p.id) || 0) + prices[i]);
    }
  }
  const pctPromos = chosen.filter((x) => !(x.freeNights > 0));
  prices.forEach((price, i) => {
    if (taken.has(i) || !(price > 0)) return;
    const on = pctPromos.filter((p) => promotionNights(p, dates)[i]);
    const raw = on.reduce((s, p) => s + Math.max(0, num(p.discountPct)), 0);
    if (!raw) return;
    const pct = Math.min(90, raw);
    const amount = (price * pct) / 100;
    nights[i] = { pct: round2(pct), free: false, amount: round2(amount) };
    // при упоре в 90 % скидка делится между акциями пропорционально их %
    for (const p of on) perPromo.set(p.id, (perPromo.get(p.id) || 0) + (amount * num(p.discountPct)) / raw);
  });

  const applied: AppliedPromotion[] = chosen
    .filter((p) => (perPromo.get(p.id) || 0) > 0.004)
    .map((p) => ({
      id: p.id,
      type: p.type,
      name: p.name,
      discountPct: num(p.discountPct),
      freeNights: p.freeNights || 0,
      amount: round2(perPromo.get(p.id) || 0),
      prepaymentPct: num(p.prepaymentPct),
      prepaymentDueDate: promotionDueDate(p, ctx.bookedOn),
    }));
  return { nights, applied, discount: round2(nights.reduce((s, n) => s + n.amount, 0)) };
}

/** Срок предоплаты акции: дата из условий, иначе через N дней после брони; не раньше даты брони */
export function promotionDueDate(p: Pick<PromotionRule, 'prepaymentPct' | 'prepaymentDueDate' | 'prepaymentDueDays'>, bookedOn: string): string | null {
  if (!(num(p.prepaymentPct) > 0)) return null;
  const due = p.prepaymentDueDate || addDays(bookedOn, Math.max(0, p.prepaymentDueDays || 0));
  return due < bookedOn ? bookedOn : due;
}

/** Предоплата по условиям акций брони: самый большой % от итога, срок — самый ранний */
export function promotionsPrepayment(applied: AppliedPromotion[] | null | undefined, total: number): { amount: number; dueDate: string | null } | null {
  const req = (applied || []).filter((a) => a.prepaymentPct > 0);
  if (!req.length || !(total > 0)) return null;
  const pct = Math.min(100, Math.max(...req.map((a) => a.prepaymentPct)));
  const dates = req.map((a) => a.prepaymentDueDate).filter((d): d is string => !!d).sort();
  return { amount: round2((total * pct) / 100), dueDate: dates[0] || null };
}

/** Предоплата брони из тарифа и акций: большая из сумм, самый ранний срок */
export function mergePrepayment(
  a: { amount: number; dueDate: string | null } | null,
  b: { amount: number; dueDate: string | null } | null,
): { amount: number; dueDate: string | null } | null {
  const list = [a, b].filter((x): x is { amount: number; dueDate: string | null } => !!x && x.amount > 0);
  if (!list.length) return a || b || null;
  const dates = list.map((x) => x.dueDate).filter((d): d is string => !!d).sort();
  return { amount: Math.max(...list.map((x) => x.amount)), dueDate: dates[0] || null };
}
