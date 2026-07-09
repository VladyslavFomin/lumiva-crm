/** Визуальная тема карточки канала (брендовые акценты + «премиальный» фон). */
export type MarketingChannelCardTheme = {
  topBorder: string;
  cardShadow: string;
  headerBg: string;
  monoTint: string;
  pill: string;
  /** Буква(ы) для логобейджа в шапке карточки и модалке. */
  logo: string;
  /** Hex-цвет бренда — используется как фон логобейджа. */
  brandColor: string;
};

const DEFAULT_THEME: MarketingChannelCardTheme = {
  topBorder: 'border-t-[3px] border-t-slate-700',
  cardShadow: 'shadow-[0_4px_16px_rgba(0,0,0,0.06)]',
  headerBg: 'bg-gradient-to-br from-slate-500/[0.07] via-white to-white',
  monoTint: 'text-slate-600/90',
  pill: 'bg-slate-100/90 text-slate-700 border-slate-200/90',
  logo: '·',
  brandColor: '#555',
};

const THEMES: Record<string, MarketingChannelCardTheme> = {
  ga4: {
    topBorder: 'border-t-[3px] border-t-[#0F9D58]',
    cardShadow: 'shadow-[0_4px_16px_rgba(0,0,0,0.06)]',
    headerBg: 'bg-gradient-to-br from-[#0F9D58]/[0.08] via-white to-white',
    monoTint: 'text-emerald-800/75',
    pill: 'bg-emerald-50/95 text-emerald-900 border-emerald-200/80',
    logo: 'A',
    brandColor: '#0F9D58',
  },
  meta_ads: {
    topBorder: 'border-t-[3px] border-t-[#0866FF]',
    cardShadow: 'shadow-[0_4px_16px_rgba(0,0,0,0.06)]',
    headerBg: 'bg-gradient-to-br from-[#0866FF]/[0.07] via-white to-white',
    monoTint: 'text-blue-900/70',
    pill: 'bg-blue-50/95 text-blue-900 border-blue-200/85',
    logo: 'M',
    brandColor: '#0866FF',
  },
  google_ads: {
    topBorder: 'border-t-[3px] border-t-[#EA4335]',
    cardShadow: 'shadow-[0_4px_16px_rgba(0,0,0,0.06)]',
    headerBg: 'bg-gradient-to-br from-[#EA4335]/[0.07] via-white to-white',
    monoTint: 'text-red-900/70',
    pill: 'bg-red-50/95 text-red-900 border-red-200/80',
    logo: 'G',
    brandColor: '#EA4335',
  },
  yandex_metrika: {
    topBorder: 'border-t-[3px] border-t-[#FC3F1D]',
    cardShadow: 'shadow-[0_4px_16px_rgba(0,0,0,0.06)]',
    headerBg: 'bg-gradient-to-br from-[#FC3F1D]/[0.07] via-white to-white',
    monoTint: 'text-orange-900/70',
    pill: 'bg-orange-50/95 text-orange-950 border-orange-200/85',
    logo: 'Я',
    brandColor: '#FC3F1D',
  },
  unknown: {
    topBorder: 'border-t-[3px] border-t-amber-500',
    cardShadow: 'shadow-[0_4px_16px_rgba(0,0,0,0.06)]',
    headerBg: 'bg-gradient-to-br from-amber-400/[0.09] via-white to-white',
    monoTint: 'text-amber-900/65',
    pill: 'bg-amber-50/95 text-amber-950 border-amber-200/90',
    logo: '?',
    brandColor: '#f59e0b',
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
  if (k === 'google_ads' || k.startsWith('google_ads_')) return THEMES.google_ads;
  return THEMES[k] ?? DEFAULT_THEME;
}

function channelSortGroup(ds: string): string {
  if (/^ga4_\d+$/.test(ds)) return 'ga4';
  if (ds === 'google_ads' || ds.startsWith('google_ads_')) return 'google_ads';
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
