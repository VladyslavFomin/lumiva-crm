import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchRepAgent, type RepAgentState, type RepPlatform } from '../../../api/hotelReputation';
import { AiCharacter } from '../../ai-employees/AiCharacter';
import { PLATFORM_META, useRepT } from './ReputationShared';
import './rv.css';

/** Общие части раздела «Отзывы» в дизайне hotel-reviews: рамка с метками, кнопки, вкладки, сегменты, счётчики. */
export const cx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

const LI: Record<string, React.ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></>,
  x: <><path d="M18 6L6 18" /><path d="M6 6l12 12" /></>,
  chev: <path d="M6 9l6 6 6-6" />,
  arrow: <><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>,
  check: <path d="M20 6L9 17l-5-5" />,
  ext: <><path d="M15 3h6v6" /><path d="M10 14L21 3" /><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /></>,
  download: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></>,
  refresh: <><path d="M21 12a9 9 0 11-2.6-6.4L21 8" /><path d="M21 3v5h-5" /></>,
  sparkle: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />,
  copy: <><rect x="9" y="9" width="12" height="12" /><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" /></>,
  send: <><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></>,
  globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15 15 0 010 20 15 15 0 010-20z" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></>,
  bell: <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></>,
  link: <><path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7" /></>,
  users: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.9" /><path d="M16 3.1a4 4 0 010 7.8" /></>,
  building: <><rect x="4" y="2" width="16" height="20" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" /></>,
  cpu: <><rect x="4" y="4" width="16" height="16" /><rect x="9" y="9" width="6" height="6" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" /></>,
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  pen: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></>,
  translate: <><path d="M5 8l6 6" /><path d="M4 14l6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="M22 22l-5-10-5 10" /><path d="M14 18h6" /></>,
};
export const Ico: React.FC<{ n: string; s?: number }> = ({ n, s = 15 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{LI[n]}</svg>
);

const Corners = () => <><i className="c tl" /><i className="c tr" /><i className="c bl" /><i className="c br" /></>;

/** Рамка с метками «+» по углам. */
export const Frame: React.FC<React.HTMLAttributes<HTMLDivElement> & { as?: 'div' | 'section' }> = ({ className, children, as = 'div', ...p }) =>
  React.createElement(as, { className: cx('bp', className), ...p }, <Corners />, children);

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { pri?: boolean; sm?: boolean; gh?: boolean; icon?: string }> = ({ pri, sm, gh, icon, children, className, ...p }) => (
  <button type="button" className={cx('rb', pri && 'pri bp', sm && 'sm', gh && 'gh', className)} {...p}>
    {pri && <Corners />}
    {icon && <Ico n={icon} s={sm ? 13 : 15} />}
    {children}
  </button>
);

export const PlatformBadge: React.FC<{ p: RepPlatform | string; compact?: boolean }> = ({ p, compact }) => {
  const m = PLATFORM_META[p as RepPlatform] || { label: p, abbr: String(p).slice(0, 2).toUpperCase(), bg: '#98989b' };
  return (
    <span className="rv-plat" title={m.label}>
      <i style={{ background: m.bg, color: (m as any).fg || '#fff' }}>{m.abbr}</i>
      {!compact && m.label}
    </span>
  );
};

export const scoreClass = (v: number | null | undefined, nb = 6) => (v == null ? 'none' : v < nb ? 'bad' : v < 8 ? 'mid' : 'good');
const fmtRaw = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
export const Score: React.FC<{ v: number | null | undefined; raw?: number | null; scale?: number | null; nb?: number; size?: number }> = ({ v, raw, scale, nb = 6, size }) => {
  const fmt = useNumFmt();
  return (
    <span className="rv-score">
      <b className={scoreClass(v, nb)} style={size ? { fontSize: size } : undefined}>{fmt(v, 1)}</b>
      {raw != null && scale ? <small>{fmtRaw(raw)}/{scale}</small> : null}
    </span>
  );
};

export function useNumFmt() {
  const { lang } = useRepT();
  const loc = lang.startsWith('tr') ? 'tr-TR' : lang.startsWith('en') ? 'en-GB' : 'ru-RU';
  return (v: number | null | undefined, d = 0) => (v == null || !Number.isFinite(v) ? '—' : v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d }));
}

export const Delta: React.FC<{ v: number | null | undefined; invert?: boolean; suffix?: string; digits?: number }> = ({ v, invert, suffix = '', digits = 2 }) => {
  const fmt = useNumFmt();
  if (v == null || !Number.isFinite(v)) return null;
  const good = invert ? v < 0 : v > 0;
  const c = Math.abs(v) < 1e-9 ? 'flat' : good ? 'up' : 'down';
  return <span className={`rv-delta ${c}`}>{v > 0 ? '+' : v < 0 ? '−' : '±'}{fmt(Math.abs(v), digits)}{suffix}</span>;
};

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export function useCountUp(target: number, dur = 1100) {
  const [v, setV] = useState(reduced() ? target : 0);
  useEffect(() => {
    if (reduced()) {
      setV(target);
      return;
    }
    let raf = 0;
    let t0 = 0;
    const from = 0;
    const step = (t: number) => {
      if (!t0) t0 = t;
      const k = Math.min(1, (t - t0) / dur);
      setV(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return v;
}
export const CountUp: React.FC<{ v: number | null | undefined; d?: number }> = ({ v, d = 0 }) => {
  const fmt = useNumFmt();
  const x = useCountUp(v ?? 0);
  return <>{v == null ? '—' : fmt(x, d)}</>;
};

function useMounted(delay = 60) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setM(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return m;
}
export const Track: React.FC<{ pct: number; color: string; h?: number }> = ({ pct, color, h }) => {
  const m = useMounted();
  return <span className="rv-track" style={h ? { height: h } : undefined}><i style={{ width: `${m ? Math.max(0, Math.min(100, pct)) : 0}%`, background: color }} /></span>;
};

/** Ширина контейнера графика: рисуем SVG в реальных пикселях, чтобы на широком экране не росли подписи. */
export function useBoxWidth<T extends HTMLElement = HTMLDivElement>(fallback = 440) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = (x: number) => setW(Math.max(280, Math.round(x)));
    set(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => set(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export const Tabs: React.FC<{ items: Array<{ k: string; label: string; badge?: number | null }>; active: string; onChange: (k: string) => void }> = ({ items, active, onChange }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [ink, setInk] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.rv-tab.on');
    if (el) setInk({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active, items.length]);
  return (
    <div className="rv-tabs" ref={ref} data-tour="rv-tabs">
      {items.map((t) => (
        <button key={t.k} type="button" className={cx('rv-tab', active === t.k && 'on')} onClick={() => onChange(t.k)}>
          {t.label}
          {t.badge ? <span className="rv-badge">{t.badge}</span> : null}
        </button>
      ))}
      <span className="rv-tab-ink" style={ink} />
    </div>
  );
};

export const Seg: React.FC<{ value: string; onChange: (k: string) => void; opts: Array<[string, React.ReactNode]> }> = ({ value, onChange, opts }) => (
  <div className="rv-seg">
    {opts.map(([k, l]) => <button key={k} type="button" className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}
  </div>
);

function useOutside(ref: React.RefObject<HTMLElement | null>, on: boolean, cb: () => void) {
  useEffect(() => {
    if (!on) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    const k = (e: KeyboardEvent) => e.key === 'Escape' && cb();
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
}

/** Фильтр-выпадашка с чекбоксами (single — один вариант). Поиск — если вариантов больше 8. */
export const Sel: React.FC<{
  allLabel: string;
  value: string[];
  onChange: (v: string[]) => void;
  options: Array<{ value: string; label: string; icon?: React.ReactNode }>;
  single?: boolean;
}> = ({ allLabel, value, onChange, options, single }) => {
  const { r } = useRepT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, open, () => setOpen(false));
  useEffect(() => {
    if (!open) setQ('');
  }, [open]);
  const picked = options.filter((o) => value.includes(o.value));
  const label = !picked.length ? allLabel : picked.length === 1 ? picked[0].label : r('multi.selected', { first: picked[0].label, n: picked.length - 1 });
  const tog = (v: string) => {
    if (single) {
      onChange(value[0] === v ? [] : [v]);
      setOpen(false);
      return;
    }
    const next = value.includes(v) ? value.filter((x) => x !== v) : [...value, v];
    onChange(options.map((o) => o.value).filter((x) => next.includes(x)));
  };
  const shown = q.trim() ? options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())) : options;
  return (
    <div className={cx('rv-sel', open && 'open')} ref={ref}>
      <button type="button" className={value.length ? 'set' : ''} onClick={() => setOpen((o) => !o)} aria-expanded={open} title={picked.map((p) => p.label).join(', ')}>
        <span className="lb">{label}</span>
        {value.length > 1 && <span className="cnt">· {value.length}</span>}
        <Ico n="chev" s={13} />
      </button>
      {open && (
        <div className="rv-pop" role="listbox" aria-multiselectable={!single}>
          {options.length > 8 && <input className="srch" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={r('multi.search')} />}
          {!single && (
            <div className="rv-opt" onClick={() => onChange([])}>
              <span className={cx('rv-ck', !value.length && 'on')}>{!value.length && <Ico n="check" s={10} />}</span>
              <span className="t">{allLabel}</span>
            </div>
          )}
          <div className="lst">
            {shown.map((o) => (
              <div key={o.value} className="rv-opt" role="option" aria-selected={value.includes(o.value)} onClick={() => tog(o.value)}>
                <span className={cx('rv-ck', value.includes(o.value) && 'on')}>{value.includes(o.value) && <Ico n="check" s={10} />}</span>
                {o.icon}
                <span className="t">{o.label}</span>
              </div>
            ))}
            {!shown.length && <div className="rv-opt" style={{ color: 'var(--n5)', cursor: 'default' }}>{r('multi.nothing')}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export const CardHead: React.FC<{ title: React.ReactNode; sub?: React.ReactNode; cls?: string; children?: React.ReactNode }> = ({ title, sub, cls, children }) => (
  <div className="rv-card-h">
    <div><h3 className={cls}>{title}</h3>{sub && <div className="sub">{sub}</div>}</div>
    {children && <div className="r">{children}</div>}
  </div>
);

/**
 * Строка ИИ-менеджера отзывов: персонаж + что он делает (по его реальным настройкам, печатается по фразе).
 * Не нанят / на паузе — так и пишем, со ссылкой «Нанять» / «Включить».
 */
export const AgentStrip: React.FC = () => {
  const { r } = useRepT();
  const navigate = useNavigate();
  const [st, setSt] = useState<RepAgentState | null>(null);
  useEffect(() => {
    fetchRepAgent().then(setSt).catch(() => setSt(null));
  }, []);
  const a = st?.agent || null;
  const w = st?.work;
  const active = !!a && a.status === 'active';
  const phrases = useMemo(() => {
    if (!a || !w) return [r('agentStrip.none')];
    if (!active) return [r('agentStrip.paused', { name: a.name })];
    return [
      w.drafts?.mode && w.drafts.mode !== 'off' ? r('rv.agent.drafts', { mode: r(`agentStrip.drafts.${w.drafts.mode}`) }) : r('rv.agent.noDrafts'),
      w.digest?.enabled ? r('rv.agent.digest', { time: w.digest.time }) : r('rv.agent.noDigest'),
      r('rv.agent.reminders', { h1: w.reminders?.firstHours ?? '—', h2: w.reminders?.escalateHours ?? '—' }),
    ];
  }, [a, w, active, r]);
  const [i, setI] = useState(0);
  const [txt, setTxt] = useState('');
  // ключ-строка: r() меняется между рендерами, а печать не должна перезапускаться на каждый кадр
  const key = phrases.join('\n');
  useEffect(() => {
    const list = key.split('\n');
    const full = list[i % list.length] || '';
    if (reduced()) {
      setTxt(full);
      return;
    }
    let n = 0;
    setTxt('');
    const t = setInterval(() => {
      n++;
      setTxt(full.slice(0, n));
      if (n >= full.length) clearInterval(t);
    }, 22);
    const nx = list.length > 1 ? setTimeout(() => setI((x) => x + 1), 5200) : undefined;
    return () => {
      clearInterval(t);
      if (nx) clearTimeout(nx);
    };
  }, [i, key]);
  if (!st) return null;
  const go = () => navigate(a ? `/ai-employees/${a.id}` : '/ai-employees');
  return (
    <Frame className={cx('rv-agent', !active && 'off')} onClick={go} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go()}>
      <div className="rv-agent-fig"><AiCharacter role="reviews_manager" mood={active ? 'on' : a ? 'pause' : 'idle'} /></div>
      <div className="tx">
        {a && <b>{a.name}</b>}
        <span className="live">{active ? r('rv.agent.live') : a ? r('rv.agent.paused') : r('rv.agent.none')}</span>
        <br />
        <span>{txt}<span className="rv-caret" style={{ display: 'inline-block', width: 5, height: 12, background: 'var(--acc)', marginLeft: 2, verticalAlign: -1, animation: 'rvPulse .8s steps(2) infinite' }} /></span>
      </div>
      <span className="go">{!a ? r('agentStrip.hire') : !active ? r('agentStrip.enable') : r('agentStrip.settings')} <Ico n="arrow" s={14} /></span>
    </Frame>
  );
};

/** Шапка раздела: кикер, заголовок капсом, подзаголовок, кнопки справа. */
export const RvHead: React.FC<{ title: string; sub: string; children?: React.ReactNode }> = ({ title, sub, children }) => {
  const { r } = useRepT();
  return (
    <div className="rv-head">
      <div>
        <div className="kick rv-kick"><span className="dot" />{r('rv.kicker')}</div>
        <h1 style={{ animation: 'rvIn .5s both' }}>{title}</h1>
        <p className="sub">{sub}</p>
      </div>
      {children && <div className="rv-head-r">{children}</div>}
    </div>
  );
};

/** Вкладки раздела: Лента · Дашборд · Настройки. */
export const RvTabs: React.FC<{ active: 'feed' | 'dashboard' | 'settings'; urgent?: number }> = ({ active, urgent }) => {
  const { r } = useRepT();
  const navigate = useNavigate();
  const paths = { feed: '/hotels/reviews', dashboard: '/hotels/reviews/dashboard', settings: '/hotels/reviews/settings' } as const;
  return (
    <Tabs
      active={active}
      onChange={(k) => navigate(paths[k as keyof typeof paths])}
      items={[
        { k: 'feed', label: r('tabs.feed'), badge: urgent },
        { k: 'dashboard', label: r('tabs.dashboard') },
        { k: 'settings', label: r('tabs.settings') },
      ]}
    />
  );
};
