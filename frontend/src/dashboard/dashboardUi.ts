/**
 * В index.css тёмные bg-slate-900/800 принудительно делаются белыми (!important),
 * а text-white остаётся — получается белый текст на белом.
 * Используем lumiva-accent (не попадает под этот override).
 */
export const DASH_BTN_PRIMARY =
  'inline-flex items-center justify-center rounded-2xl bg-lumiva-accent text-white text-[11px] font-semibold py-2 px-3 border border-lumiva-accent hover:opacity-90 transition-opacity';

export const DASH_BTN_PRIMARY_SM =
  'rounded-xl bg-lumiva-accent text-white text-[11px] font-semibold px-3 py-1.5 border border-lumiva-accent hover:opacity-90 transition-opacity';

export const DASH_BADGE_DARK =
  'rounded-full bg-lumiva-accent px-2 py-0.5 text-[10px] font-semibold text-white';
