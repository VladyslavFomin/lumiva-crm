import React from 'react';
import { useTranslation } from 'react-i18next';
import { money } from '../partners/partnerUtils';
import type { HotelQuote } from '../../../api/hotels';

type Seg = { from: string; to: string; nights: number; price: number; source: string; discountPct?: number; pp?: number; childAmount?: number };

/** Соседние ночи с одинаковой ценой и источником — одной строкой: «1–3 нояб · 3 ночи · 120 € · сезон» */
function segments(q: HotelQuote): Seg[] {
  const out: Seg[] = [];
  for (const n of q.nights) {
    const last = out[out.length - 1];
    if (last && last.price === n.price && last.source === n.source && (last.discountPct || 0) === (n.discountPct || 0) && last.pp === n.pp && last.childAmount === n.childAmount) {
      last.to = n.date;
      last.nights += 1;
    } else {
      out.push({ from: n.date, to: n.date, nights: 1, price: n.price, source: n.source, discountPct: n.discountPct, pp: n.pp, childAmount: n.childAmount });
    }
  }
  return out;
}

/** Цена брони по ночам из прайса (или пометка «введена вручную» с кнопкой вернуться к прайсу) */
export const QuoteBreakdown: React.FC<{
  mode: 'auto' | 'manual';
  quote: HotelQuote | null;
  error?: string;
  currency?: string | null;
  netContract?: boolean;
  marketGroupName?: string;
  onAuto: () => void;
}> = ({ mode, quote, error, currency, netContract, marketGroupName, onAuto }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.priceEngine.${key}`, o);
  const loc = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const d = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(loc, { day: 'numeric', month: 'short' });
  if (mode === 'manual') {
    return (
      <div className="pe-box manual">
        <span>{k('manual')}</span>
        <button type="button" className="lnk" onClick={onAuto}>{k('toAuto')}</button>
      </div>
    );
  }
  if (error) return <div className="pe-box warn">{error}</div>;
  if (!quote) return <div className="pe-box muted">{k('fillDates')}</div>;
  const missing = quote.warnings.find((w) => w.code === 'no_price');
  const blocked = quote.warnings.find((w) => w.code === 'blocked');
  const fallback = quote.warnings.find((w) => w.code === 'group_fallback');
  const noOcc = quote.warnings.some((w) => w.code === 'no_occupancy');
  const minStay = quote.warnings.find((w) => w.code === 'min_stay');
  const release = quote.warnings.find((w) => w.code === 'release');
  const lowBudget = quote.warnings.find((w) => w.code === 'below_budget');
  return (
    <div className="pe-box">
      <div className="pe-head">
        <b>{k('auto')}</b>
        <span>{marketGroupName ? k('byGroup', { group: marketGroupName }) : k('byReference')}{quote.marketGroupGuessed ? ` · ${k('guessed')}` : ''}</span>
      </div>
      <div className="pe-rows">
        {segments(quote).map((g) => (
          <div key={g.from} className="pe-row">
            <span className="dt">{g.from === g.to ? d(g.from) : `${d(g.from)} – ${d(g.to)}`}</span>
            <span className="n">{k('nights', { count: g.nights })}</span>
            <span className={`src s-${g.source}`}>{k(`sources.${g.source}`)}{g.discountPct ? ` −${g.discountPct}%` : ''}</span>
            {g.pp && g.pp > 0 && Math.abs(g.pp - g.price) > 0.009 ? (
              <span className="pp" title={k('ppTitle')}>
                {k('ppLine', { pp: money(g.pp, currency, loc), coef: Math.round(((g.price - (g.childAmount || 0)) / g.pp) * 100) / 100 })}
                {g.childAmount ? ` ${k('ppChildren', { amount: money(g.childAmount, currency, loc) })}` : ''}
              </span>
            ) : <span className="pp" />}
            <b>{money(g.price, currency, loc)}</b>
          </div>
        ))}
      </div>
      {!!quote.childLines?.length && (
        <div className="pe-note">
          {k(quote.childPolicySource === 'contract' ? 'childrenByContract' : 'childrenByHotel')}{' '}
          {quote.childLines.map((c, i) => (
            <span key={c.childNo}>
              {i > 0 && ' · '}
              {c.age === null ? k('childNoAge', { n: c.childNo }) : k('childAge', { n: c.childNo, age: c.age })} — {c.reason === 'infant' ? k('childInfant') : c.share === 0 ? k('childFree') : c.share === 1 ? k('childAsAdult') : `${Math.round(c.share * 100)}%`}
            </span>
          ))}
        </div>
      )}
      <div className="pe-total"><span>{k('total')}</span><b>{money(quote.total, currency, loc)}</b></div>
      {netContract && <div className="pe-note">{k('netContract')}</div>}
      {missing && !noOcc && <div className="pe-note warn">{k('missing', { dates: missing.dates.map(d).join(', ') })}</div>}
      {blocked && <div className="pe-note warn">{k('blocked', { dates: blocked.dates.map(d).join(', ') })}</div>}
      {fallback && <div className="pe-note">{k('fallback')}</div>}
      {minStay && <div className="pe-note warn">{k('minStay', { count: minStay.value })}</div>}
      {release && <div className="pe-note warn">{k('release', { count: release.value })}</div>}
      {lowBudget && <div className="pe-note warn">{k('belowBudget', { dates: lowBudget.dates.map(d).join(', ') })}</div>}
      {noOcc && <div className="pe-note warn">{k('noOccupancy', { adults: quote.guests?.adults ?? '?', children: quote.guests?.children ?? 0 })}</div>}
    </div>
  );
};

/** Цена брони по ночам в карточке (priceMode=auto): те же сегменты, без кнопок */
export const NightlyRatesSummary: React.FC<{ nights: HotelQuote['nights']; currency?: string | null }> = ({ nights, currency }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.priceEngine.${key}`, o);
  const loc = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const d = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(loc, { day: 'numeric', month: 'short' });
  if (!nights?.length) return null;
  const segs = segments({ nights } as HotelQuote);
  return (
    <div className="pe-box compact">
      <div className="pe-head"><b>{k('auto')}</b></div>
      <div className="pe-rows">
        {segs.map((g) => (
          <div key={g.from} className="pe-row">
            <span className="dt">{g.from === g.to ? d(g.from) : `${d(g.from)} – ${d(g.to)}`}</span>
            <span className="n">{k('nights', { count: g.nights })}</span>
            <span className={`src s-${g.source}`}>{k(`sources.${g.source}`)}{g.discountPct ? ` −${g.discountPct}%` : ''}</span>
            <b>{money(g.price, currency, loc)}</b>
          </div>
        ))}
      </div>
    </div>
  );
};
