import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchRepAgent, type RepAgentState, type RepAiStatus, type RepPlatform } from '../../../api/hotelReputation';

/** Префикс ключей переводов раздела «Отзывы». */
export function useRepT() {
  const { t, i18n } = useTranslation();
  const r = (k: string, opts?: Record<string, unknown>) => t(`crm.hotels.reputation.${k}`, opts as any) as string;
  return { r, t, lang: i18n.language };
}

export const PLATFORM_META: Record<RepPlatform, { label: string; abbr: string; bg: string; fg?: string }> = {
  google: { label: 'Google', abbr: 'G', bg: '#4285F4' },
  holidaycheck: { label: 'HolidayCheck', abbr: 'HC', bg: '#0b3f9c' },
  tripadvisor: { label: 'Tripadvisor', abbr: 'TA', bg: '#00AF87' },
  yandex: { label: 'Yandex', abbr: 'Я', bg: '#FC3F1D' },
  expedia: { label: 'Expedia', abbr: 'Ex', bg: '#FDCC16', fg: '#191e3b' },
  check24: { label: 'Check24', abbr: 'C24', bg: '#063773' },
  otelpuan: { label: 'Otelpuan', abbr: 'OP', bg: '#e2231a' },
  booking: { label: 'Booking.com', abbr: 'B.', bg: '#003580' },
};

export const PlatformBadge: React.FC<{ platform: RepPlatform; compact?: boolean }> = ({ platform, compact }) => {
  const m = PLATFORM_META[platform];
  return (
    <span className="rp-plat" title={m.label}>
      <i style={{ background: m.bg, color: m.fg || '#fff' }}>{m.abbr}</i>
      {!compact && m.label}
    </span>
  );
};

export function scoreClass(v: number | null, negBelow = 6) {
  if (v == null) return 'none';
  if (v < negBelow) return 'bad';
  if (v < 8) return 'mid';
  return 'good';
}

const fmtRaw = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/** Оценка: 0–10 крупно + исходная шкала площадки мелко. */
export const Score: React.FC<{ rating10: number | null; raw?: number | null; scale?: number | null; negBelow?: number }> = ({ rating10, raw, scale, negBelow }) => (
  <span className="rp-score">
    <b className={scoreClass(rating10, negBelow)}>{rating10 == null ? '—' : rating10.toFixed(1)}</b>
    {raw != null && scale ? <small>{fmtRaw(raw)}/{scale}</small> : null}
  </span>
);

export function fmtDate(iso: string | null | undefined, lang: string, withTime = false) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-GB' : 'ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function fmtRepIndex(value: number | null | undefined, lang: string) {
  if (value == null || !Number.isFinite(value)) return '—';
  const locale = lang.startsWith('tr') ? 'tr-TR' : lang.startsWith('en') ? 'en-GB' : 'ru-RU';
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(value);
}

export function fmtHours(h: number | null | undefined, r: (k: string, o?: any) => string) {
  if (h == null) return '—';
  if (h < 1) return r('units.minutes', { n: Math.max(1, Math.round(h * 60)) });
  if (h < 48) return r('units.hours', { n: Math.round(h) });
  return r('units.days', { n: Math.round(h / 24) });
}

export const Delta: React.FC<{ v: number | null | undefined; invert?: boolean; suffix?: string; digits?: number }> = ({ v, invert, suffix = '', digits = 2 }) => {
  if (v == null || !Number.isFinite(v)) return null;
  const good = invert ? v < 0 : v > 0;
  const cls = Math.abs(v) < 1e-9 ? 'flat' : good ? 'up' : 'down';
  return (
    <span className={`rp-delta ${cls}`}>
      {v > 0 ? '+' : v < 0 ? '−' : '±'}
      {Math.abs(v).toFixed(digits)}
      {suffix}
    </span>
  );
};

/** Вкладки раздела: Лента · Дашборд · Настройки. */
export const ReputationTabs: React.FC<{ active: 'feed' | 'dashboard' | 'settings'; urgent?: number }> = ({ active, urgent }) => {
  const navigate = useNavigate();
  const { r } = useRepT();
  const tabs: Array<{ k: 'feed' | 'dashboard' | 'settings'; label: string; path: string }> = [
    { k: 'feed', label: r('tabs.feed'), path: '/hotels/reviews' },
    { k: 'dashboard', label: r('tabs.dashboard'), path: '/hotels/reviews/dashboard' },
    { k: 'settings', label: r('tabs.settings'), path: '/hotels/reviews/settings' },
  ];
  return (
    <div data-tour="rv-tabs" className="htl-detail-tabs rp-tabs">
      {tabs.map((x) => (
        <div key={x.k} className={`htl-detail-tab${active === x.k ? ' active' : ''}`} onClick={() => navigate(x.path)}>
          {x.label}
          {x.k === 'feed' && urgent ? <span className="rp-tab-badge">{urgent}</span> : null}
        </div>
      ))}
    </div>
  );
};

/** Сбор Apify на паузе — кончился месячный бюджет тарифа. */
export const ApifyPauseBanner: React.FC<{ pause: { reason: string | null; at: string | null } | null | undefined }> = ({ pause }) => {
  const { r, lang } = useRepT();
  if (!pause?.reason) return null;
  return (
    <div className="rp-note err" style={{ margin: '12px 0' }}>
      <b>{r('apifyPause.title')}</b> {r('apifyPause.text', { d: fmtDate(pause.at, lang, true) })}{' '}
      <a href="https://console.apify.com/billing" target="_blank" rel="noopener noreferrer">{r('apifyPause.link')} ↗</a>
    </div>
  );
};

/** Статус ИИ-разбора: без него пустые «темы» выглядели бы как «жалоб нет». */
export const AiStatusBanner: React.FC<{ status: RepAiStatus | null | undefined }> = ({ status }) => {
  const { r } = useRepT();
  const navigate = useNavigate();
  if (!status || (!status.failed && !status.pending)) return null;
  if (status.failed) {
    const noCredits = /credit|quota|billing|insufficient|api key|401|403/i.test(status.lastError || '');
    return (
      <div className="rp-note err" style={{ margin: '12px 0' }}>
        <b>{r('ai.status.failedTitle', { n: status.pending })}</b>{' '}
        {noCredits ? r('ai.status.noCredits') : r('ai.status.error', { e: (status.lastError || '').slice(0, 200) })}{' '}
        {noCredits && (
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/integrations-hub'); }}>{r('ai.status.connectKey')}</a>
        )}
      </div>
    );
  }
  return <div className="rp-note" style={{ margin: '12px 0' }}>{r('ai.status.pending', { n: status.pending })}</div>;
};

export function topicLabel(
  tp: { topic: string; label?: string | null; translations?: Partial<Record<'ru' | 'tr' | 'en', string>> },
  r: (k: string) => string,
  lang = 'ru',
) {
  if (tp.topic === 'other') return tp.label || r('topics.other');
  const locale = lang.startsWith('tr') ? 'tr' : lang.startsWith('en') ? 'en' : 'ru';
  const translated = tp.translations?.[locale];
  if (translated) return translated;
  const k = `topics.${tp.topic}`;
  const v = r(k);
  return v.endsWith(k) ? tp.label || tp.topic : v;
}

export const TOPIC_KEYS = [
  'cleanliness', 'room', 'bed_sleep', 'noise', 'breakfast', 'food', 'bar', 'all_inclusive', 'pool', 'beach',
  'animation', 'staff', 'reception', 'wifi', 'air_conditioning', 'value', 'location', 'transfer', 'spa', 'kids_club',
];

/** Строка статуса ИИ-менеджера отзывов: не нанят / на паузе / что делает (со ссылкой в профиль). */
export const ReviewsAgentStrip: React.FC = () => {
  const { r } = useRepT();
  const navigate = useNavigate();
  const [st, setSt] = useState<RepAgentState | null>(null);
  useEffect(() => {
    fetchRepAgent().then(setSt).catch(() => setSt(null));
  }, []);
  if (!st) return null;
  const a = st.agent;
  const w = st.work;
  const go = () => navigate(a ? `/ai-employees/${a.id}` : '/ai-employees');
  const text = !a
    ? r('agentStrip.none')
    : a.status !== 'active'
      ? r('agentStrip.paused', { name: a.name })
      : r('agentStrip.active', {
          name: a.name,
          time: w.digest.enabled ? w.digest.time : '—',
          h1: w.reminders.firstHours,
          h2: w.reminders.escalateHours,
          drafts: r(`agentStrip.drafts.${w.drafts.mode}`),
        });
  return (
    <div className={`rp-agent-strip${!a || a.status !== 'active' ? ' off' : ''}`} onClick={go}>
      <span className="av">{a?.avatarUrl ? <img src={a.avatarUrl} alt="" /> : 'AI'}</span>
      <span className="tx">{text}</span>
      <span className="go">{!a ? r('agentStrip.hire') : a.status !== 'active' ? r('agentStrip.enable') : r('agentStrip.settings')} →</span>
    </div>
  );
};
