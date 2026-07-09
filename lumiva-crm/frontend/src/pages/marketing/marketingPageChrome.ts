/**
 * Маркетинг: Swiss-light дизайн — белый, #222, тонкие линии, Inter Tight + JetBrains Mono.
 */

export const marketingPageShell = 'pb-2';

export const marketingKicker =
  'inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-[#888] mb-2 font-medium font-mono';
export const marketingH1 =
  'text-[26px] font-[600] tracking-[-0.025em] text-[#222] leading-[1.1]';
export const marketingLead = 'text-[13px] text-[#888] mt-1.5 max-w-2xl leading-[1.45]';

/** Разделитель секций: «КАНАЛЫ ──────────» */
export const marketingGrpTitle =
  'flex items-center gap-3 text-[10px] tracking-[0.14em] uppercase text-[#888] font-[500] font-mono mt-1 mb-3.5';

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
  'rounded-[14px] border border-[#e7e7e7] bg-white p-4 md:p-5';

export const marketingSectionTitle = 'text-sm font-semibold text-[#222222]';
export const marketingSectionSub = 'text-[11px] text-[#222222]/55 mt-0.5 leading-snug';
export const marketingMetaLine = 'text-[11px] text-[#222222]/50';

const kpiBase =
  'relative overflow-hidden rounded-[14px] border border-[#e7e7e7] bg-white p-5 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-[3px] before:content-[""]';

export const marketingKpiStripeBrand = `${kpiBase} before:bg-[#222222]`;
export const marketingKpiStripeViolet = `${kpiBase} before:bg-violet-500`;
export const marketingKpiStripeEmerald = `${kpiBase} before:bg-emerald-500`;
export const marketingKpiStripeDuo = `${kpiBase} before:bg-gradient-to-r before:from-violet-500 before:to-rose-500`;

/** Ячейка в hairline-полосе KPI (6 штук в одной рамке). */
export const marketingKpiCell =
  'px-[18px] py-4 border-r border-b border-[#e7e7e7]';

export const marketingKpiLabel =
  'font-mono text-[9.5px] font-[500] uppercase tracking-[0.1em] text-[#888]';
export const marketingKpiValue =
  'font-semibold text-[24px] tracking-[-0.025em] text-[#222] leading-none mt-2.5 tabular-nums';
export const marketingKpiHint = 'text-[10.5px] text-[#888] mt-1.5 leading-snug font-mono';

/** Обёртка таблицы: рамка + скругление + лёгкий inner-shadow */
export const marketingTableWrap =
  'rounded-[12px] border border-[#e7e7e7] overflow-hidden bg-white';

export const marketingThead =
  'bg-[#fafafa] border-b border-[#e7e7e7]';

export const marketingTh =
  'py-[10px] px-3.5 text-left text-[9.5px] font-[500] uppercase tracking-[0.1em] text-[#888] font-mono whitespace-nowrap';

/** Узкие числовые колонки */
export const marketingThNumeric =
  'py-2.5 px-2.5 text-right text-[9px] font-[500] uppercase tracking-[0.08em] text-[#888] font-mono whitespace-nowrap leading-tight';

export const marketingTd =
  'py-[11px] px-3.5 text-[12.5px] text-[#222] border-b border-[#f0f0f0] align-middle';

export const marketingTr = 'hover:bg-[#fafafa] transition-colors';

export const marketingEmptyBanner =
  'rounded-[10px] border border-dashed border-[#e7e7e7] bg-[#fafafa] px-4 py-3 text-[11px] text-[#888]';

export const marketingWarnBanner =
  'rounded-[10px] border border-amber-200/90 bg-amber-50 px-4 py-3 text-[11px] text-amber-900';
