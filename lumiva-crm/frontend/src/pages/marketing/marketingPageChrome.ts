/**
 * Маркетинг: светлая «редакционная» сетка под основной CRM (#222222, белые карточки, читаемые таблицы).
 */

export const marketingPageShell =
  'rounded-[28px] border border-[#222222]/10 bg-gradient-to-b from-white via-white to-slate-50/70 p-5 md:p-7 shadow-[0_24px_80px_rgba(34,34,34,0.07)]';

export const marketingKicker =
  'text-[11px] uppercase tracking-[0.22em] text-[#222222]/45 mb-1 font-medium';
export const marketingH1 = 'text-xl md:text-2xl font-semibold text-[#222222] tracking-tight';
export const marketingLead = 'text-sm text-[#222222]/65 mt-1 max-w-2xl leading-relaxed';

export const marketingFilterBar =
  'inline-flex flex-wrap items-center gap-1 rounded-full border border-[#222222]/12 bg-white px-1.5 py-1 shadow-[0_4px_24px_rgba(34,34,34,0.06)]';
export const marketingFilterLabel =
  'text-[11px] font-medium text-[#222222]/50 pl-2 pr-1 whitespace-nowrap';
export const marketingChipActive =
  'px-3.5 py-1.5 rounded-full text-[11px] font-semibold bg-[#222222] text-white shadow-[0_6px_22px_rgba(34,34,34,0.22)] transition-transform active:scale-[0.98]';
export const marketingChipInactive =
  'px-3.5 py-1.5 rounded-full text-[11px] font-medium text-[#222222]/65 hover:bg-[#222222]/[0.06] transition-colors';
export const marketingSelect =
  'max-w-[240px] truncate text-[11px] rounded-full border border-[#222222]/12 bg-slate-50 py-1.5 pl-3 pr-2 text-[#222222] focus:outline-none focus:ring-2 focus:ring-[#222222]/12';

export const marketingCard =
  'rounded-2xl border border-[#222222]/10 bg-white p-4 md:p-5 shadow-[0_10px_40px_rgba(34,34,34,0.05)]';

export const marketingSectionTitle = 'text-sm font-semibold text-[#222222]';
export const marketingSectionSub = 'text-[11px] text-[#222222]/55 mt-0.5 leading-snug';
export const marketingMetaLine = 'text-[11px] text-[#222222]/50';

const kpiBase =
  'relative overflow-hidden rounded-2xl border border-[#222222]/10 bg-white p-5 shadow-[0_10px_40px_rgba(34,34,34,0.06)] transition-shadow hover:shadow-[0_16px_52px_rgba(34,34,34,0.09)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-[3px] before:content-[""]';

export const marketingKpiStripeBrand = `${kpiBase} before:bg-[#222222]`;
export const marketingKpiStripeViolet = `${kpiBase} before:bg-violet-500`;
export const marketingKpiStripeEmerald = `${kpiBase} before:bg-emerald-500`;
export const marketingKpiStripeDuo = `${kpiBase} before:bg-gradient-to-r before:from-violet-500 before:to-rose-500`;

export const marketingKpiLabel =
  'text-[11px] font-medium uppercase tracking-[0.14em] text-[#222222]/45';
export const marketingKpiValue = 'text-2xl font-semibold tabular-nums text-[#222222] mt-2';
export const marketingKpiHint = 'text-[11px] text-[#222222]/50 mt-1.5 leading-snug';

/** Обёртка таблицы: рамка + скругление + лёгкий inner-shadow */
export const marketingTableWrap =
  'rounded-xl border border-[#222222]/10 overflow-hidden bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]';

export const marketingThead =
  'bg-gradient-to-b from-slate-50 to-slate-100/90 border-b border-[#222222]/10';

export const marketingTh =
  'py-3 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[#222222]/50';

/** Узкие числовые колонки: без переноса и с чуть более плотным трекингом */
export const marketingThNumeric =
  'py-2.5 px-2.5 text-right text-[9px] font-semibold uppercase tracking-[0.08em] text-[#222222]/50 whitespace-nowrap leading-tight';

export const marketingTd =
  'py-2.5 px-3 text-[11px] text-[#222222]/85 border-b border-slate-100 align-middle';

export const marketingTr = 'hover:bg-slate-50/90 transition-colors';

export const marketingEmptyBanner =
  'rounded-xl border border-dashed border-[#222222]/18 bg-slate-50/80 px-4 py-3 text-[11px] text-[#222222]/55';

export const marketingWarnBanner =
  'rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-[11px] text-amber-900';
