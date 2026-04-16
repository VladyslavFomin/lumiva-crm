/**
 * Эвристика: в marketing_traffic нет поля country. До появления импорта гео
 * распределяем метрики по ISO2, если название кампании содержит явные маркеры страны.
 */
const RULES: Array<{ iso2: string; needles: string[] }> = [
  { iso2: 'TR', needles: ['türkiye', 'turkiye', 'turkey', 'турци'] },
  { iso2: 'GB', needles: ['ingiltere', 'england', 'united kingdom', 'great britain', 'великобритан', 'британ'] },
  { iso2: 'DE', needles: ['almanya', 'germany', 'deutschland', 'герман'] },
  { iso2: 'PL', needles: ['polonya', 'poland', 'polska', 'польш'] },
  { iso2: 'FR', needles: ['fransa', 'france', 'франц'] },
  { iso2: 'ES', needles: ['ispanya', 'spain', 'españa', 'espanha', 'испан'] },
  { iso2: 'IT', needles: ['italya', 'italy', 'italia', 'итал'] },
  { iso2: 'US', needles: ['abd', 'amerika', 'united states', ' u.s', 'usa ', ' usa'] },
  { iso2: 'NL', needles: ['hollanda', 'netherlands', 'holland', 'нидерланд'] },
  { iso2: 'BE', needles: ['belçika', 'belgium', 'бельги'] },
  { iso2: 'AT', needles: ['avusturya', 'austria', 'österreich', 'австри'] },
  { iso2: 'CH', needles: ['isviçre', 'switzerland', 'schweiz', 'швейцар'] },
  { iso2: 'SE', needles: ['isveç', 'sweden', 'sverige', 'швед'] },
  { iso2: 'NO', needles: ['norveç', 'norway', 'норвег'] },
  { iso2: 'DK', needles: ['danimarka', 'denmark', 'дани'] },
  { iso2: 'FI', needles: ['finlandiya', 'finland', 'suomi', 'финлянд'] },
  { iso2: 'GR', needles: ['yunanistan', 'greece', 'ελλάδα', 'грец'] },
  { iso2: 'PT', needles: ['portekiz', 'portugal', 'португал'] },
  { iso2: 'CZ', needles: ['çekya', 'czech', 'чех'] },
  { iso2: 'HU', needles: ['macaristan', 'hungary', 'венгр'] },
  { iso2: 'RO', needles: ['romanya', 'romania', 'румын'] },
  { iso2: 'BG', needles: ['bulgaristan', 'bulgaria', 'болгар'] },
  { iso2: 'UA', needles: ['ukrayna', 'ukraine', 'украин'] },
  { iso2: 'RU', needles: ['rusya', 'russia', 'росси'] },
  { iso2: 'AE', needles: ['bae', 'uae', 'dubai', 'абу-даби', 'эмират'] },
  { iso2: 'SA', needles: ['suudi', 'saudi', 'саудов'] },
  { iso2: 'EG', needles: ['misir', 'egypt', 'египет'] },
  { iso2: 'IL', needles: ['israil', 'israel', 'израил'] },
  { iso2: 'JP', needles: ['japonya', 'japan', 'япон'] },
  { iso2: 'CN', needles: ['çin', 'china', 'кита'] },
  { iso2: 'IN', needles: ['hindistan', 'india', 'инди'] },
  { iso2: 'AU', needles: ['avustralya', 'australia', 'австрал'] },
  { iso2: 'CA', needles: ['kanada', 'canada', 'канад'] },
  { iso2: 'BR', needles: ['brezilya', 'brazil', 'бразил'] },
  { iso2: 'MX', needles: ['meksika', 'mexico', 'мексик'] },
];

export function inferCountryIsoFromCampaign(campaign: string | null | undefined): string | null {
  const s = (campaign ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (!s.trim()) return null;
  for (const { iso2, needles } of RULES) {
    for (const n of needles) {
      if (s.includes(n)) return iso2;
    }
  }
  return null;
}

export type CountryTrafficAgg = {
  iso2: string;
  sessions: number;
  impressions: number;
  clicks: number;
};

/** Имена стран в world-atlas@2/countries-110m (поле `properties.name`). */
export const ISO2_TO_WORLD_ATLAS_NAME: Record<string, string> = {
  TR: 'Turkey',
  GB: 'United Kingdom',
  DE: 'Germany',
  PL: 'Poland',
  FR: 'France',
  ES: 'Spain',
  IT: 'Italy',
  US: 'United States of America',
  NL: 'Netherlands',
  BE: 'Belgium',
  AT: 'Austria',
  CH: 'Switzerland',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  GR: 'Greece',
  PT: 'Portugal',
  CZ: 'Czechia',
  HU: 'Hungary',
  RO: 'Romania',
  BG: 'Bulgaria',
  UA: 'Ukraine',
  RU: 'Russia',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  EG: 'Egypt',
  IL: 'Israel',
  JP: 'Japan',
  CN: 'China',
  IN: 'India',
  AU: 'Australia',
  CA: 'Canada',
  BR: 'Brazil',
  MX: 'Mexico',
};

export function aggregateTrafficByInferredCountry(
  rows: Array<{
    campaign: string | null;
    sessions: number;
    impressions: number;
    clicks: number;
  }>,
): { byCountry: Map<string, CountryTrafficAgg>; unassignedSessions: number; unassignedImpressions: number } {
  const byCountry = new Map<string, CountryTrafficAgg>();
  let unassignedSessions = 0;
  let unassignedImpressions = 0;
  for (const r of rows) {
    const iso = inferCountryIsoFromCampaign(r.campaign);
    const sess = r.sessions || 0;
    const imp = r.impressions || 0;
    const clk = r.clicks || 0;
    if (!iso) {
      unassignedSessions += sess;
      unassignedImpressions += imp;
      continue;
    }
    const cur = byCountry.get(iso) ?? { iso2: iso, sessions: 0, impressions: 0, clicks: 0 };
    cur.sessions += sess;
    cur.impressions += imp;
    cur.clicks += clk;
    byCountry.set(iso, cur);
  }
  return { byCountry, unassignedSessions, unassignedImpressions };
}
