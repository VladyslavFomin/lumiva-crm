// Публичная страница «Заявка гостя» по QR-коду в номере: без входа, на языке гостя (ru/en/tr/de→en)
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import i18n, { ensureLanguageLoaded } from '../../i18n';
import { fetchGuestPublic, sendGuestPublic, type GuestPublicInfo } from '../../api/hotelGuestPublic';
import './guest-request.css';

type L3 = 'ru' | 'en' | 'tr';
const LANG_KEY = 'lumiva-guest-lang';
const pick = (v?: string | null): L3 | null => (v === 'ru' || v === 'en' || v === 'tr' ? v : null);
const initialLang = (country: string | null): L3 => {
  try { const s = pick(localStorage.getItem(LANG_KEY)); if (s) return s; } catch { /* ignore */ }
  try { for (const l of navigator.languages || [navigator.language]) { const p = pick((l || '').slice(0, 2).toLowerCase()); if (p) return p; } } catch { /* ignore */ }
  return country === 'TR' ? 'tr' : 'en';
};
const CATS = ['towels', 'cleaning', 'amenities', 'minibar', 'maintenance', 'noise', 'other'] as const;
const ICONS: Record<string, string> = { towels: 'M4 6h16v4H4zM6 10v8M18 10v8M9 14h6', cleaning: 'M14 3l7 7-9 9H5v-7zM9 8l7 7', amenities: 'M9 3h6v4H9zM7 7h10l-1 14H8z', minibar: 'M7 3h10v18H7zM7 10h10M10 6v2M10 13v3', maintenance: 'M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2.8-.7-.7-2.8z', noise: 'M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11', other: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v5M12 16h.01' };

export const GuestRequestPublicPage: React.FC = () => {
  const { token = '' } = useParams();
  const [info, setInfo] = useState<GuestPublicInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [lang, setLang] = useState<L3>('en');
  const [ready, setReady] = useState(0);
  const [cat, setCat] = useState<string | null>(null);
  const [sub, setSub] = useState('');
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<number | null>(null);

  useEffect(() => {
    fetchGuestPublic(token).then((i) => { setInfo(i); setLang(initialLang(i.country)); }).catch(() => setFailed(true));
  }, [token]);
  useEffect(() => { void ensureLanguageLoaded(lang).then(() => setReady((x) => x + 1)); }, [lang]);
  const t = useMemo(() => i18n.getFixedT(lang), [lang, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const k = (key: string, o?: Record<string, unknown>) => t(`publicPages.guestCare.${key}`, o);
  useEffect(() => { if (info) document.title = `${info.hotelName} · ${k('title')}`; }, [info, lang, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!cat) return;
    setBusy(true);
    setError('');
    try {
      const r = await sendGuestPublic(token, { category: cat, subcategory: cat === 'maintenance' ? sub || 'other' : undefined, text, guestName: name, lang });
      setSent(r.number);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === 'HOTEL_GUEST_REQUEST_LIMIT' ? k('limit') : code === 'HOTEL_GUEST_REQUEST_TEXT' ? k('needText') : k('sendError'));
    } finally {
      setBusy(false);
    }
  };
  const chooseLang = (l: L3) => { setLang(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ } };

  if (failed) return <div className="gr"><div className="gr-card gr-center"><h1>{k('invalid')}</h1><p>{k('invalidHint')}</p></div></div>;
  if (!info) return <div className="gr"><div className="gr-card gr-center"><div className="gr-spin" /></div></div>;
  return (
    <div className="gr">
      <header className="gr-head">
        <div>
          <div className="gr-hotel">{info.hotelName}</div>
          <div className="gr-room">{k('room', { room: info.room })}</div>
        </div>
        <div className="gr-langs">
          {(['tr', 'en', 'ru'] as L3[]).map((l) => <button key={l} type="button" className={lang === l ? 'on' : ''} onClick={() => chooseLang(l)}>{l.toUpperCase()}</button>)}
        </div>
      </header>
      {sent !== null ? (
        <div className="gr-card gr-center">
          <div className="gr-ok">✓</div>
          <h1>{k('sentTitle', { n: sent })}</h1>
          <p>{k('sentHint')}</p>
          <button type="button" className="gr-btn ghost" onClick={() => { setSent(null); setCat(null); setText(''); setSub(''); }}>{k('another')}</button>
        </div>
      ) : (
        <div className="gr-card">
          <h1>{k('title')}</h1>
          <p className="gr-sub">{k('subtitle')}</p>
          <div className="gr-cats">
            {CATS.map((c) => (
              <button key={c} type="button" className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICONS[c]} /></svg>
                <span>{k(`cat.${c}`)}</span>
              </button>
            ))}
          </div>
          {cat === 'maintenance' && (
            <div className="gr-subs">
              {info.maintenance.map((s) => <button key={s} type="button" className={sub === s ? 'on' : ''} onClick={() => setSub(s)}>{k(`maint.${s}`)}</button>)}
            </div>
          )}
          {cat && (
            <>
              <label className="gr-l">{k(cat === 'other' || cat === 'noise' ? 'textRequired' : 'textOptional')}</label>
              <textarea rows={3} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder={k('textPh')} />
              <label className="gr-l">{k('name')}</label>
              <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
              {error && <div className="gr-err">{error}</div>}
              <button type="button" className="gr-btn" disabled={busy || ((cat === 'other' || cat === 'noise') && !text.trim())} onClick={send}>{k('send')}</button>
            </>
          )}
        </div>
      )}
      <footer className="gr-foot">{k('foot')}</footer>
    </div>
  );
};

export default GuestRequestPublicPage;
