/**
 * Курс ЦБ Турции (TCMB) для счёта в валюте: по правилам VUK — döviz alış (ForexBuying) последнего бюллетеня.
 * Бюллетень выходит в рабочие дни ~15:30; today.xml — последний опубликованный. Кэш на 30 минут в памяти.
 */
const cache = new Map<string, { at: number; rate: number; date: string }>();

export async function tcmbForexBuying(currency: string): Promise<{ rate: number; date: string } | null> {
  const cur = String(currency || '').toUpperCase();
  if (!cur || cur === 'TRY') return null;
  const hit = cache.get(cur);
  if (hit && Date.now() - hit.at < 30 * 60_000) return { rate: hit.rate, date: hit.date };
  const url = process.env.TCMB_RATES_URL || 'https://www.tcmb.gov.tr/kurlar/today.xml';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const xml = await res.text();
    const date = (xml.match(/Date="(\d{2})\/(\d{2})\/(\d{4})"/) || []).slice(1);
    const block = xml.match(new RegExp(`<Currency[^>]*CurrencyCode="${cur}"[^>]*>([\\s\\S]*?)</Currency>`));
    if (!block) return null;
    const unit = Number((block[1].match(/<Unit>([\d.]+)<\/Unit>/) || [])[1]) || 1;
    const buying = Number((block[1].match(/<ForexBuying>([\d.]+)<\/ForexBuying>/) || [])[1]);
    if (!(buying > 0)) return null;
    const out = { rate: Math.round((buying / unit) * 1e6) / 1e6, date: date.length === 3 ? `${date[2]}-${date[0]}-${date[1]}` : '' };
    cache.set(cur, { at: Date.now(), ...out });
    return out;
  } catch {
    return null;
  }
}
