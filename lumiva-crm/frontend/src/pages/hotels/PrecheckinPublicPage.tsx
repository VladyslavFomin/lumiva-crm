// Публичная онлайн-регистрация по ссылке из письма: гости (паспорт фото или вручную), прибытие, пожелания, допродажи
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import i18n, { ensureLanguageLoaded } from '../../i18n';
import { cancelPrecheckinRequest, fetchPrecheckin, scanPrecheckinDocument, submitPrecheckin, type PrecheckinGuest, type PrecheckinInfo, type PrecheckinOffer } from '../../api/hotelPrecheckinPublic';
import './guest-request.css';

type L3 = 'ru' | 'en' | 'tr';
const LANG_KEY = 'lumiva-guest-lang';
const pick = (v?: string | null): L3 | null => (v === 'ru' || v === 'en' || v === 'tr' ? v : null);
const initialLang = (country: string | null): L3 => {
  try { const s = pick(localStorage.getItem(LANG_KEY)); if (s) return s; } catch { /* приватный режим */ }
  try { for (const l of navigator.languages || [navigator.language]) { const p = pick((l || '').slice(0, 2).toLowerCase()); if (p) return p; } } catch { /* нет navigator */ }
  return country === 'TR' ? 'tr' : ['RU', 'UA', 'BY', 'KZ'].includes(country || '') ? 'ru' : 'en';
};
const blank = (): PrecheckinGuest => ({ fullName: '', birthDate: '', gender: '', nationalityCode: null, documentType: 'passport', passportNumber: '', passportExpiry: '' });
const offerKey = (o: { kind: string; roomTypeId?: string; extraServiceId?: string }) => `${o.kind}:${o.roomTypeId || o.extraServiceId || ''}`;

export const PrecheckinPublicPage: React.FC = () => {
  const { token = '' } = useParams();
  const [info, setInfo] = useState<PrecheckinInfo | null>(null);
  const [failed, setFailed] = useState<'' | 'invalid' | 'closed'>('');
  const [lang, setLang] = useState<L3>('en');
  const [ready, setReady] = useState(0);
  const [guests, setGuests] = useState<PrecheckinGuest[]>([]);
  const [eta, setEta] = useState('');
  const [flight, setFlight] = useState('');
  const [transfer, setTransfer] = useState(false);
  const [requests, setRequests] = useState('');
  const [prefs, setPrefs] = useState<string[]>([]);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scanFor = useRef(0);

  const fill = (i: PrecheckinInfo) => {
    setInfo(i);
    const n = Math.max(1, i.reservation.pax);
    const list = i.guests.length ? i.guests.map((g) => ({ ...blank(), ...g })) : [{ ...blank(), fullName: i.reservation.guestName }];
    while (list.length < n) list.push(blank());
    setGuests(list);
    setEta(i.arrival.eta || '');
    setFlight(i.arrival.flight || '');
    setTransfer(i.arrival.needTransfer);
    setRequests(i.arrival.requests || '');
    setPrefs(i.arrival.preferences || []);
    setConsent(i.arrival.consent);
  };
  useEffect(() => {
    fetchPrecheckin(token)
      .then((i) => { fill(i); setLang(initialLang(i.reservation.guestCountry)); setDone(i.status === 'completed'); })
      .catch((e) => setFailed((e as { status?: number }).status === 410 ? 'closed' : 'invalid'));
  }, [token]);
  useEffect(() => { void ensureLanguageLoaded(lang).then(() => setReady((x) => x + 1)); }, [lang]);
  const t = useMemo(() => i18n.getFixedT(lang), [lang, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const k = (key: string, o?: Record<string, unknown>) => t(`publicPages.precheckin.${key}`, o);
  useEffect(() => { if (info) document.title = `${info.hotel.name} · ${k('title')}`; }, [info, lang, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const loc = lang === 'tr' ? 'tr-TR' : lang === 'ru' ? 'ru-RU' : 'en-GB';
  const money = (v: number) => { try { return new Intl.NumberFormat(loc, { style: 'currency', currency: info?.hotel.currency || 'EUR', maximumFractionDigits: 0 }).format(v); } catch { return `${Math.round(v)} ${info?.hotel.currency || ''}`; } };
  const d = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(loc, { day: 'numeric', month: 'long' });
  const chooseLang = (l: L3) => { setLang(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* приватный режим */ } };
  const setG = (i: number, p: Partial<PrecheckinGuest>) => setGuests((x) => x.map((g, j) => (j === i ? { ...g, ...p } : g)));
  const errText = (e: unknown) => {
    const code = (e as { code?: string }).code || '';
    return t(`publicPages.precheckin.err.${code}`, { defaultValue: (e as Error).message || k('err.generic') });
  };

  const onScan = async (f: File) => {
    const i = scanFor.current;
    setScanning(i);
    setError('');
    try {
      const s = await scanPrecheckinDocument(token, f, lang);
      setG(i, { fullName: s.fullName || guests[i].fullName, birthDate: s.birthDate || '', gender: s.sex || '', nationalityCode: s.nationalityCode, documentType: s.documentType, passportNumber: s.documentNumber || '', passportExpiry: s.expiryDate || '' });
      if (info) setInfo({ ...info, scansLeft: Math.max(0, info.scansLeft - 1) });
    } catch (e) {
      setError(errText(e));
    } finally {
      setScanning(null);
    }
  };

  const submit = async () => {
    if (!info) return;
    setBusy(true);
    setError('');
    try {
      const upsells = info.offers.filter((o) => picked[offerKey(o)]).map((o) => ({ kind: o.kind, roomTypeId: o.roomTypeId, extraServiceId: o.extraServiceId, quantity: picked[offerKey(o)] }));
      const r = await submitPrecheckin(token, { guests: guests.filter((g) => g.fullName.trim()), consent, language: lang, eta, flight, needTransfer: transfer, requests, preferences: prefs, upsells });
      fill(r);
      setPicked({});
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  if (failed) return <div className="gr"><div className="gr-card gr-center"><h1>{k(failed === 'closed' ? 'closed' : 'invalid')}</h1><p>{k(failed === 'closed' ? 'closedHint' : 'invalidHint')}</p></div></div>;
  if (!info) return <div className="gr"><div className="gr-card gr-center"><div className="gr-spin" /></div></div>;
  const r = info.reservation;
  const offerTitle = (o: PrecheckinOffer) => (o.kind === 'upgrade' ? k('upgradeTo', { name: o.name }) : o.kind === 'extra' ? o.name : k(`offer.${o.kind}`));
  const offerHint = (o: PrecheckinOffer) => (o.kind === 'early_checkin' ? k('earlyHint', { time: info.hotel.checkInTime || '14:00' }) : o.kind === 'late_checkout' ? k('lateHint', { time: info.hotel.checkOutTime || '12:00' }) : o.description || '');
  const priceText = (o: PrecheckinOffer) => (o.kind === 'upgrade' ? k('plusStay', { amount: money(o.amount) }) : o.unit === 'night' ? k('perNight', { amount: money(o.amount) }) : o.unit === 'person' ? k('perPerson', { amount: money(o.amount) }) : money(o.amount));
  const requested = new Set(info.requests.map((q) => q.kind === 'upgrade' ? 'upgrade' : q.name));
  const total = info.offers.reduce((s, o) => s + (picked[offerKey(o)] ? o.amount * (o.kind === 'extra' ? picked[offerKey(o)] : 1) : 0), 0);

  return (
    <div className="gr pc">
      <header className="gr-head">
        <div>
          <div className="gr-hotel">{info.hotel.name}</div>
          <div className="gr-room">{k('booking', { code: r.code })}</div>
        </div>
        <div className="gr-langs">
          {(['tr', 'en', 'ru'] as L3[]).map((l) => <button key={l} type="button" className={lang === l ? 'on' : ''} onClick={() => chooseLang(l)}>{l.toUpperCase()}</button>)}
        </div>
      </header>

      <div className="gr-card pc-stay">
        <div><span>{k('arrival')}</span><b>{d(r.checkIn)}</b><em>{k('from', { time: info.hotel.checkInTime || '14:00' })}</em></div>
        <div><span>{k('departure')}</span><b>{d(r.checkOut)}</b><em>{k('until', { time: info.hotel.checkOutTime || '12:00' })}</em></div>
        <div><span>{k('room')}</span><b>{r.roomTypeName}</b><em>{k('nights', { count: r.nights })}{r.boardType ? ` · ${r.boardType}` : ''}</em></div>
      </div>

      {done && (
        <div className="gr-card gr-center">
          <div className="gr-ok">✓</div>
          <h1>{k('doneTitle')}</h1>
          <p>{k('doneHint')}</p>
          <button type="button" className="gr-btn ghost" onClick={() => setDone(false)}>{k('edit')}</button>
        </div>
      )}

      {!!info.requests.length && (
        <div className="gr-card">
          <h2 className="pc-h2">{k('yourRequests')}</h2>
          {info.requests.map((q) => (
            <div key={q.id} className="pc-req">
              <div><b>{q.kind === 'upgrade' ? k('upgradeTo', { name: q.name }) : q.kind === 'extra' ? q.name : k(`offer.${q.kind}`)}</b><span>{money(q.amount)}</span></div>
              <span className={`pc-st s-${q.status}`}>{k(`req.${q.status}`)}</span>
              {q.status === 'requested' && <button type="button" className="pc-x" onClick={() => cancelPrecheckinRequest(token, q.id).then(fill).catch((e) => setError(errText(e)))}>{k('cancelReq')}</button>}
            </div>
          ))}
        </div>
      )}

      {!done && (
        <>
          <div className="gr-card">
            <h1>{k('title')}</h1>
            <p className="gr-sub">{k('subtitle')}</p>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onScan(f); e.target.value = ''; }} />
            {guests.map((g, i) => (
              <div key={i} className="pc-guest">
                <div className="pc-guest-head">
                  <b>{k('guestN', { n: i + 1 })}</b>
                  {info.scansLeft > 0 && (
                    <button type="button" className="pc-scan" disabled={scanning !== null} onClick={() => { scanFor.current = i; fileRef.current?.click(); }}>
                      {scanning === i ? k('scanning') : k('scan')}
                    </button>
                  )}
                </div>
                <label className="gr-l">{k('fullName')}</label>
                <input value={g.fullName} maxLength={200} onChange={(e) => setG(i, { fullName: e.target.value })} autoComplete="name" />
                <div className="pc-row">
                  <div><label className="gr-l">{k('birthDate')}</label><input type="date" value={g.birthDate} onChange={(e) => setG(i, { birthDate: e.target.value })} /></div>
                  <div><label className="gr-l">{k('gender')}</label>
                    <div className="gr-subs">{(['M', 'F'] as const).map((x) => <button key={x} type="button" className={g.gender === x ? 'on' : ''} onClick={() => setG(i, { gender: x })}>{k(`g${x}`)}</button>)}</div>
                  </div>
                </div>
                <div className="pc-row">
                  <div><label className="gr-l">{k('passport')}</label><input value={g.passportNumber} maxLength={40} onChange={(e) => setG(i, { passportNumber: e.target.value.toUpperCase() })} autoCapitalize="characters" /></div>
                  <div><label className="gr-l">{k('expiry')}</label><input type="date" value={g.passportExpiry} onChange={(e) => setG(i, { passportExpiry: e.target.value })} /></div>
                </div>
                <label className="gr-l">{k('nationality')}</label>
                <input value={g.nationalityCode || ''} maxLength={3} placeholder="DE, TR, RU…" onChange={(e) => setG(i, { nationalityCode: e.target.value.toUpperCase() || null })} />
              </div>
            ))}
            <button type="button" className="gr-btn ghost pc-add" onClick={() => setGuests([...guests, blank()])}>{k('addGuest')}</button>
          </div>

          <div className="gr-card">
            <h2 className="pc-h2">{k('arrivalTitle')}</h2>
            <div className="pc-row">
              <div><label className="gr-l">{k('eta')}</label><input type="time" value={eta} onChange={(e) => setEta(e.target.value)} /></div>
              <div><label className="gr-l">{k('flight')}</label><input value={flight} maxLength={40} placeholder="TK 1453" onChange={(e) => setFlight(e.target.value)} /></div>
            </div>
            <label className="pc-check"><input type="checkbox" checked={transfer} onChange={(e) => setTransfer(e.target.checked)} />{k('needTransfer')}</label>
            <label className="gr-l">{k('prefsTitle')}</label>
            <div className="gr-subs">
              {info.preferences.map((p) => <button key={p} type="button" className={prefs.includes(p) ? 'on' : ''} onClick={() => setPrefs(prefs.includes(p) ? prefs.filter((x) => x !== p) : [...prefs, p])}>{t(`crm.hotels.guests.pref.${p}`)}</button>)}
            </div>
            <label className="gr-l">{k('requests')}</label>
            <textarea rows={3} maxLength={2000} value={requests} onChange={(e) => setRequests(e.target.value)} placeholder={k('requestsPh')} />
          </div>

          {info.offers.length > 0 && (
            <div className="gr-card">
              <h2 className="pc-h2">{k('offersTitle')}</h2>
              <p className="gr-sub">{k('offersHint')}</p>
              {info.offers.map((o) => {
                const key = offerKey(o);
                const on = !!picked[key];
                const already = o.kind === 'upgrade' ? requested.has('upgrade') && info.requests.some((q) => q.kind === 'upgrade' && q.name === o.name) : requested.has(o.name);
                return (
                  <div key={key} className={`pc-offer${on ? ' on' : ''}`}>
                    <button type="button" className="pc-offer-main" disabled={already} onClick={() => setPicked((x) => {
                      const n = { ...x };
                      if (n[key]) delete n[key];
                      else {
                        if (o.kind === 'upgrade') for (const kk of Object.keys(n)) if (kk.startsWith('upgrade:')) delete n[kk];
                        n[key] = o.quantity;
                      }
                      return n;
                    })}>
                      <span className="pc-tick">{on || already ? '✓' : ''}</span>
                      <span className="pc-offer-text"><b>{offerTitle(o)}</b>{offerHint(o) && <em>{offerHint(o)}</em>}</span>
                      <span className="pc-price">{already ? k('requested') : priceText(o)}</span>
                    </button>
                    {on && o.kind === 'extra' && (
                      <div className="pc-qty">
                        <span>{o.unit === 'night' ? k('qtyNights') : o.unit === 'person' ? k('qtyPersons') : k('qty')}</span>
                        <button type="button" onClick={() => setPicked((x) => ({ ...x, [key]: Math.max(1, (x[key] || 1) - 1) }))}>−</button>
                        <b>{picked[key]}</b>
                        <button type="button" onClick={() => setPicked((x) => ({ ...x, [key]: Math.min(99, (x[key] || 1) + 1) }))}>+</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {total > 0 && <div className="pc-total">{k('offersTotal', { amount: money(total) })}</div>}
            </div>
          )}

          <div className="gr-card">
            <label className="pc-check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />{k('consent', { hotel: info.hotel.name })}</label>
            {error && <div className="gr-err">{error}</div>}
            <button type="button" className="gr-btn" disabled={busy || !consent || !guests[0]?.fullName.trim()} onClick={submit}>{busy ? k('sending') : k('submit')}</button>
          </div>
        </>
      )}
      {done && error && <div className="gr-err">{error}</div>}
      <footer className="gr-foot">{k('foot')}</footer>
    </div>
  );
};

export default PrecheckinPublicPage;
