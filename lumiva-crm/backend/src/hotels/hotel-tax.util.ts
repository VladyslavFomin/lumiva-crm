import type { Hotel } from './hotel.entity';

const r2 = (n: number) => Math.round(n * 100) / 100;

export type HotelTaxBreakdown = { base: number; accommodationTax: number; vat: number; total: number; accommodationTaxPct: number; vatPct: number };

/**
 * Налоги по сумме брони. Налог на проживание считается от суммы без налогов и входит в базу НДС
 * (так в Турции: konaklama vergisi включается в матрах KDV): итог = база × (1 + налог) × (1 + НДС).
 * pricesIncludeTax — сумма брони уже с налогами (выделяем), иначе налоги начисляются сверху.
 */
export function hotelTaxes(amount: number, hotel: Pick<Hotel, 'accommodationTaxPct' | 'vatPct' | 'pricesIncludeTax'> | null): HotelTaxBreakdown {
  const a = Math.max(0, Number(hotel?.accommodationTaxPct) || 0) / 100;
  const v = Math.max(0, Number(hotel?.vatPct) || 0) / 100;
  const factor = (1 + a) * (1 + v);
  const base = hotel?.pricesIncludeTax === false ? amount : amount / factor;
  const accommodationTax = base * a;
  const vat = (base + accommodationTax) * v;
  return { base: r2(base), accommodationTax: r2(accommodationTax), vat: r2(vat), total: r2(base + accommodationTax + vat), accommodationTaxPct: a * 100, vatPct: v * 100 };
}
