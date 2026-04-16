/** Визуальная тема карточки канала (брендовые акценты + «премиальный» фон). */
export type MarketingChannelCardTheme = {
  topBorder: string;
  cardShadow: string;
  headerBg: string;
  monoTint: string;
  pill: string;
};

const DEFAULT_THEME: MarketingChannelCardTheme = {
  topBorder: 'border-t-[3px] border-t-slate-700',
  cardShadow:
    'shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_22px_55px_-28px_rgba(15,23,42,0.22)]',
  headerBg: 'bg-gradient-to-br from-slate-500/[0.07] via-white to-slate-50/40',
  monoTint: 'text-slate-600/90',
  pill: 'bg-slate-100/90 text-slate-700 border-slate-200/90',
};

const THEMES: Record<string, MarketingChannelCardTheme> = {
  ga4: {
    topBorder: 'border-t-[3px] border-t-[#0F9D58]',
    cardShadow:
      'shadow-[0_0_0_1px_rgba(15,157,88,0.12),0_24px_60px_-26px_rgba(15,157,88,0.2)]',
    headerBg: 'bg-gradient-to-br from-[#0F9D58]/[0.1] via-white to-emerald-50/35',
    monoTint: 'text-emerald-800/75',
    pill: 'bg-emerald-50/95 text-emerald-900 border-emerald-200/80',
  },
  meta_ads: {
    topBorder: 'border-t-[3px] border-t-[#0866FF]',
    cardShadow:
      'shadow-[0_0_0_1px_rgba(8,102,255,0.14),0_24px_60px_-26px_rgba(8,102,255,0.22)]',
    headerBg: 'bg-gradient-to-br from-[#0866FF]/[0.09] via-white to-blue-50/40',
    monoTint: 'text-blue-900/70',
    pill: 'bg-blue-50/95 text-blue-900 border-blue-200/85',
  },
  google_ads: {
    topBorder: 'border-t-[3px] border-t-[#EA4335]',
    cardShadow:
      'shadow-[0_0_0_1px_rgba(234,67,53,0.12),0_24px_60px_-26px_rgba(234,67,53,0.18)]',
    headerBg: 'bg-gradient-to-br from-[#EA4335]/[0.08] via-white to-red-50/35',
    monoTint: 'text-red-900/70',
    pill: 'bg-red-50/95 text-red-900 border-red-200/80',
  },
  yandex_metrika: {
    topBorder: 'border-t-[3px] border-t-[#FC3F1D]',
    cardShadow:
      'shadow-[0_0_0_1px_rgba(252,63,29,0.14),0_24px_60px_-26px_rgba(252,63,29,0.2)]',
    headerBg: 'bg-gradient-to-br from-[#FC3F1D]/[0.09] via-white to-orange-50/40',
    monoTint: 'text-orange-900/70',
    pill: 'bg-orange-50/95 text-orange-950 border-orange-200/85',
  },
  unknown: {
    topBorder: 'border-t-[3px] border-t-amber-500',
    cardShadow:
      'shadow-[0_0_0_1px_rgba(245,158,11,0.18),0_24px_60px_-26px_rgba(180,83,9,0.14)]',
    headerBg: 'bg-gradient-to-br from-amber-400/[0.11] via-white to-amber-50/45',
    monoTint: 'text-amber-900/65',
    pill: 'bg-amber-50/95 text-amber-950 border-amber-200/90',
  },
};

/** Порядок колонок: рекламные и аналитика слева, «без канала» ближе к концу. */
export const MARKETING_CHANNEL_DS_ORDER = [
  'meta_ads',
  'google_ads',
  'ga4',
  'yandex_metrika',
  'yandex_metrica',
  'import',
  'manual',
  'unknown',
];

export function marketingChannelCardTheme(ds: string): MarketingChannelCardTheme {
  const k = (ds || 'unknown').trim();
  if (k === 'yandex_metrica') return THEMES.yandex_metrika;
  if (/^ga4_\d+$/.test(k)) return THEMES.ga4;
  return THEMES[k] ?? DEFAULT_THEME;
}

function channelSortGroup(ds: string): string {
  if (/^ga4_\d+$/.test(ds)) return 'ga4';
  return ds;
}

export function compareMarketingChannelDs(a: string, b: string): number {
  const ga = channelSortGroup(a);
  const gb = channelSortGroup(b);
  const ia = MARKETING_CHANNEL_DS_ORDER.indexOf(ga);
  const ib = MARKETING_CHANNEL_DS_ORDER.indexOf(gb);
  const sa = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
  const sb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
  if (sa !== sb) return sa - sb;
  return a.localeCompare(b);
}
