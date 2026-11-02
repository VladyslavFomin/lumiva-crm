// Публичный опрос гостя по ссылке из письма автоматизации: оценка 1–5 и комментарий; довольным — ссылки на отзывы
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import i18n, { ensureLanguageLoaded } from '../../i18n';
import { fetchFeedback, openReview, submitFeedback, type HotelFeedbackInfo } from '../../api/hotelFeedbackPublic';
import './guest-request.css';

type L3 = 'ru' | 'en' | 'tr';
const LANG_KEY = 'lumiva-guest-lang';
const pick = (v?: string | null): L3 | null => (v === 'ru' || v === 'en' || v === 'tr' ? v : null);
const PLATFORM: Record<string, string> = { google: 'Google', tripadvisor: 'Tripadvisor', booking: 'Booking.com', holidaycheck: 'HolidayCheck', expedia: 'Expedia', hotels: 'Hotels.com', yandex: 'Яндекс', trustyou: 'TrustYou', zoover: 'Zoover', otelpuan: 'OtelPuan', tatilsepeti: 'Tatilsepeti' };

export const HotelFeedbackPublicPage: React.FC = () => {
  const { token = '' } = useParams();
  const [info, setInfo] = useState<HotelFeedbackInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [lang, setLang] = useState<L3>('en');
  const [ready, setReady] = useState(0);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    fetchFeedback(token)
      .then((i) => {
        setInfo(i); setScore(i.score || 0); setComment(i.comment || '');
        let s: L3 | null = null; try { s = pick(localStorage.getItem(LANG_KEY)); } catch { /* приватный режим */ }
        setLang(s || i.lang);
      })
      .catch(() => setFailed(true));
  }, [token]);
  useEffect(() => { void ensureLanguageLoaded(lang).then(() => setReady((x) => x + 1)); }, [lang]);
  const t = useMemo(() => i18n.getFixedT(lang), [lang, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const k = (key: string, o?: Record<string, unknown>) => t(`publicPages.hotelFeedback.${key}`, o);
  const chooseLang = (l: L3) => { setLang(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* приватный режим */ } };
  if (failed) return <div className="gr"><div className="gr-card gr-center"><h1>{k('invalid')}</h1><p>{k('invalidHint')}</p></div></div>;
  if (!info) return <div className="gr"><div className="gr-card gr-center"><div className="gr-spin" /></div></div>;
  const send = () => {
    if (!score) return;
    setBusy(true); setError('');
    submitFeedback(token, { score, comment }).then(setInfo).catch((e) => setError((e as Error).message)).finally(() => setBusy(false));
  };
  const review = (platform: string) => {
    openReview(token, platform).then((r) => { window.location.href = r.url; }).catch((e) => setError((e as Error).message));
  };
  return (
    <div className="gr fb">
      <header className="gr-head">
        <div>
          <div className="gr-hotel">{info.hotel}</div>
          <div className="gr-room">{k(`stage.${info.stage}`)}</div>
        </div>
        <div className="gr-langs">
          {(['tr', 'en', 'ru'] as L3[]).map((l) => <button key={l} type="button" className={lang === l ? 'on' : ''} onClick={() => chooseLang(l)}>{l.toUpperCase()}</button>)}
        </div>
      </header>
      {info.answered ? (
        <div className="gr-card gr-center">
          <div className="gr-ok">✓</div>
          <h1>{k('thanks', { name: info.guestFirstName })}</h1>
          <p>{info.score && info.score >= 4 ? k('happyHint') : k('sorryHint')}</p>
          {info.reviewLinks.length > 0 && (
            <div className="fb-reviews">
              {info.reviewLinks.map((x) => <button key={x.platform} type="button" className="gr-btn" onClick={() => review(x.platform)}>{k('reviewOn', { platform: PLATFORM[x.platform] || x.platform })}</button>)}
            </div>
          )}
          {error && <div className="gr-err">{error}</div>}
        </div>
      ) : (
        <div className="gr-card">
          <h1>{k('question', { name: info.guestFirstName })}</h1>
          <p className="gr-sub">{k('sub')}</p>
          <div className="fb-stars" role="radiogroup" aria-label={k('question', { name: '' })}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={score === n} aria-label={String(n)} className={n <= score ? 'on' : ''} onClick={() => setScore(n)}>★</button>
            ))}
          </div>
          {score > 0 && <div className="fb-label">{k(`score.${score}`)}</div>}
          <label className="gr-l">{score > 0 && score <= 3 ? k('commentBad') : k('comment')}</label>
          <textarea rows={4} value={comment} maxLength={3000} onChange={(e) => setComment(e.target.value)} />
          {error && <div className="gr-err">{error}</div>}
          <button type="button" className="gr-btn" disabled={busy || !score} onClick={send}>{k('send')}</button>
        </div>
      )}
      <div className="gr-foot">{info.hotel}</div>
    </div>
  );
};
