// Публичная оплата брони по ссылке из письма / WhatsApp: сумма, бронь, «Оплатить» → страница платёжной системы
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import i18n, { ensureLanguageLoaded } from '../../i18n';
import { fetchHotelPay, startHotelPay, type HotelPayInfo } from '../../api/hotelPayPublic';
import './guest-request.css';

type L3 = 'ru' | 'en' | 'tr';
const LANG_KEY = 'lumiva-guest-lang';
const pick = (v?: string | null): L3 | null => (v === 'ru' || v === 'en' || v === 'tr' ? v : null);
const PROVIDER: Record<string, string> = { iyzico: 'iyzico', paytr: 'PayTR', yookassa: 'ЮKassa' };

export const HotelPayPublicPage: React.FC = () => {
  const { token = '' } = useParams();
  const [sp] = useSearchParams();
  const returned = sp.get('status');
  const [info, setInfo] = useState<HotelPayInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [lang, setLang] = useState<L3>('en');
  const [ready, setReady] = useState(0);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => fetchHotelPay(token).then((i) => {
    setInfo(i);
    setForm((f) => (f.email || f.name ? f : { name: i.buyer.name || '', email: i.buyer.email || '', phone: i.buyer.phone || '' }));
    return i;
  });
  useEffect(() => {
    load()
      .then((i) => { let s: L3 | null = null; try { s = pick(localStorage.getItem(LANG_KEY)); } catch { /* приватный режим */ } setLang(s || i.lang); })
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  // вернулись со страницы оплаты, а вебхук ещё в пути — подтягиваем статус несколько раз
  useEffect(() => {
    if (!info || info.status !== 'pending' || returned !== 'paid') return;
    let n = 0;
    const h = window.setInterval(() => { n += 1; void load().then((i) => { if (i.status !== 'pending' || n >= 12) window.clearInterval(h); }); }, 4000);
    return () => window.clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info?.status, returned]);
  useEffect(() => { void ensureLanguageLoaded(lang).then(() => setReady((x) => x + 1)); }, [lang]);
  const t = useMemo(() => i18n.getFixedT(lang), [lang, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const k = (key: string, o?: Record<string, unknown>) => t(`publicPages.hotelPay.${key}`, o);
  const loc = lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-GB' : 'ru-RU';
  const chooseLang = (l: L3) => { setLang(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* приватный режим */ } };

  if (failed) return <div className="gr"><div className="gr-card gr-center"><h1>{k('invalid')}</h1><p>{k('invalidHint')}</p></div></div>;
  if (!info) return <div className="gr"><div className="gr-card gr-center"><div className="gr-spin" /></div></div>;
  const money = (v: number) => { try { return new Intl.NumberFormat(loc, { style: 'currency', currency: info.currency }).format(v); } catch { return `${v} ${info.currency}`; } };
  const d = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' });

  const pay = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError(k('emailNeeded')); return; }
    setBusy(true);
    setError('');
    startHotelPay(token, { ...form, lang })
      .then((r) => { window.location.href = r.url; })
      .catch((e) => { setError((e as { code?: string }).code ? k(`errors.${(e as { code: string }).code}`, { defaultValue: (e as Error).message }) : (e as Error).message); setBusy(false); });
  };

  return (
    <div className="gr pc hp">
      <header className="gr-head">
        <div>
          <div className="gr-hotel">{info.hotel.name}</div>
          <div className="gr-room">{info.bookingCode ? k('booking', { code: info.bookingCode }) : info.guestName}</div>
        </div>
        <div className="gr-langs">
          {(['tr', 'en', 'ru'] as L3[]).map((l) => <button key={l} type="button" className={lang === l ? 'on' : ''} onClick={() => chooseLang(l)}>{l.toUpperCase()}</button>)}
        </div>
      </header>

      <div className="gr-card pc-stay">
        <div><span>{k('arrival')}</span><b>{d(info.checkIn)}</b></div>
        <div><span>{k('departure')}</span><b>{d(info.checkOut)}</b></div>
        <div><span>{k('room')}</span><b>{info.roomType || '—'}</b><em>{k('guests', { count: info.pax })}</em></div>
      </div>

      {info.status === 'paid' ? (
        <div className="gr-card gr-center">
          <div className="gr-ok">✓</div>
          <h1>{k('paidTitle')}</h1>
          <p>{k('paidHint', { amount: money(info.amount) })}</p>
        </div>
      ) : info.status !== 'pending' ? (
        <div className="gr-card gr-center">
          <h1>{k(info.status === 'expired' ? 'expiredTitle' : 'cancelledTitle')}</h1>
          <p>{k('closedHint')}</p>
        </div>
      ) : (
        <div className="gr-card">
          <div className="hp-amount">
            <span>{k(`kind.${info.kind}`)}</span>
            <b>{money(info.amount)}</b>
            {info.expiresAt && <em>{k('validUntil', { date: new Date(info.expiresAt).toLocaleDateString(loc, { day: 'numeric', month: 'long' }) })}</em>}
          </div>
          {returned === 'paid' && <div className="hp-note">{k('checking')}</div>}
          {(returned === 'failed' || info.lastAttempt?.status === 'failed') && <div className="gr-err">{k('failedTry')}</div>}
          <label className="gr-l">{k('name')}</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
          <label className="gr-l">{k('email')}</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" inputMode="email" />
          <label className="gr-l">{k('phone')}</label>
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" inputMode="tel" />
          {error && <div className="gr-err">{error}</div>}
          <button type="button" className="gr-btn" disabled={busy || !info.provider} onClick={pay}>{busy ? k('redirecting') : k('pay', { amount: money(info.amount) })}</button>
          <p className="hp-secure">{info.provider ? k('secure', { provider: PROVIDER[info.provider] || info.provider }) : k('noProvider')}</p>
        </div>
      )}
      <div className="gr-foot">{k('foot', { hotel: info.hotel.name })}</div>
    </div>
  );
};
