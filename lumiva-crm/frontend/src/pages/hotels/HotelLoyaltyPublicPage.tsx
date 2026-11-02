// Карта участника программы лояльности: уровень, баланс, путь до следующего уровня, история — по ссылке из письма
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import i18n, { ensureLanguageLoaded } from '../../i18n';
import { fetchLoyaltyPublic, type LoyaltyPublic } from '../../api/hotelLoyaltyPublic';
import './guest-request.css';

type L3 = 'ru' | 'en' | 'tr';
const LANG_KEY = 'lumiva-guest-lang';
const pick = (v?: string | null): L3 | null => (v === 'ru' || v === 'en' || v === 'tr' ? v : null);

export const HotelLoyaltyPublicPage: React.FC = () => {
  const { token = '' } = useParams();
  const [d, setD] = useState<LoyaltyPublic | null>(null);
  const [failed, setFailed] = useState(false);
  const [lang, setLang] = useState<L3>('en');
  const [ready, setReady] = useState(0);
  useEffect(() => {
    fetchLoyaltyPublic(token).then((x) => { setD(x); let s: L3 | null = null; try { s = pick(localStorage.getItem(LANG_KEY)); } catch { /* приватный режим */ } setLang(s || x.lang); }).catch(() => setFailed(true));
  }, [token]);
  useEffect(() => { void ensureLanguageLoaded(lang).then(() => setReady((x) => x + 1)); }, [lang]);
  const t = useMemo(() => i18n.getFixedT(lang), [lang, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const k = (key: string, o?: Record<string, unknown>) => t(`publicPages.hotelLoyalty.${key}`, o);
  const loc = lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-GB' : 'ru-RU';
  const chooseLang = (l: L3) => { setLang(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* приватный режим */ } };
  if (failed) return <div className="gr"><div className="gr-card gr-center"><h1>{k('invalid')}</h1><p>{k('invalidHint')}</p></div></div>;
  if (!d) return <div className="gr"><div className="gr-card gr-center"><div className="gr-spin" /></div></div>;
  const money = (v: number) => { try { return new Intl.NumberFormat(loc, { style: 'currency', currency: d.currency, maximumFractionDigits: 2 }).format(v); } catch { return `${v} ${d.currency}`; } };
  const n = d.next;
  const prog = n ? Math.max(...[n.minNights ? d.stats.nights / n.minNights : 0, n.minStays ? d.stats.stays / n.minStays : 0, n.minSpend ? d.stats.spend / n.minSpend : 0]) : 1;
  return (
    <div className="gr lp">
      <header className="gr-head">
        <div><div className="gr-hotel">{d.program}</div><div className="gr-room">{d.hotels.join(' · ')}</div></div>
        <div className="gr-langs">{(['tr', 'en', 'ru'] as L3[]).map((l) => <button key={l} type="button" className={lang === l ? 'on' : ''} onClick={() => chooseLang(l)}>{l.toUpperCase()}</button>)}</div>
      </header>
      <div className="gr-card lp-card">
        <div className="lp-top"><span>{k('hello', { name: d.guestFirstName })}</span><em className="lp-no">№ {d.number}</em></div>
        <div className="lp-tier">{d.tier?.name || k('member')}</div>
        {d.pointsEnabled && (
          <div className="lp-points"><b>{d.points.toLocaleString(loc)}</b><span>{k('points')}</span><em>≈ {money(d.points * d.pointValue)}{d.pendingPoints ? ` · ${k('pending', { n: d.pendingPoints.toLocaleString(loc) })}` : ''}</em></div>
        )}
        {d.tier && (d.tier.discountPct > 0 || d.tier.benefits.length > 0) && (
          <ul className="lp-benefits">
            {d.tier.discountPct > 0 && <li>{k('discount', { pct: d.tier.discountPct })}</li>}
            {d.tier.benefits.map((b) => <li key={b}>{b}</li>)}
          </ul>
        )}
      </div>
      {n && (
        <div className="gr-card">
          <div className="lp-next"><span>{k('nextTier', { name: n.name })}</span><b>{Math.min(100, Math.round(prog * 100))}%</b></div>
          <div className="lp-bar"><i style={{ width: `${Math.min(100, prog * 100)}%` }} /></div>
          <p className="gr-sub" style={{ margin: '8px 0 0' }}>{[n.minNights ? k('needNights', { have: d.stats.nights, need: n.minNights }) : '', n.minStays ? k('needStays', { have: d.stats.stays, need: n.minStays }) : ''].filter(Boolean).join(` ${k('or')} `)} · {k(`period.${d.tierPeriod}`)}</p>
        </div>
      )}
      {d.history.length > 0 && (
        <div className="gr-card">
          <div className="gr-l" style={{ marginTop: 0 }}>{k('history')}</div>
          {d.history.map((x, i) => (
            <div key={i} className="lp-h">
              <span>{new Date(x.date).toLocaleDateString(loc, { day: 'numeric', month: 'short' })}</span>
              <span>{k(`tx.${x.type}`)}{x.hotel ? ` · ${x.hotel}` : ''}{x.status === 'pending' ? ` · ${k('pendingShort')}` : ''}</span>
              <b className={x.points < 0 ? 'neg' : ''}>{x.points > 0 ? '+' : ''}{x.points.toLocaleString(loc)}</b>
            </div>
          ))}
        </div>
      )}
      <div className="gr-foot">{k('foot')}</div>
    </div>
  );
};
