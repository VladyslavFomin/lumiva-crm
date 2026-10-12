/* Секции главной crm.lumiva.agency — порт Claude Design home-v2.html (components/lh-*.jsx).
 * Моушн взят из макета; данные — только проверенные (см. md: public site honesty audit):
 * без логотипов «клиентов», отзывов, «1 200+ клиентов», uptime и выдуманных результатов. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AuraDash, AuScaled } from '../aura/AuraDash';
import { AU_TEMPLATES } from '../aura/auraModel';
import { AiCharacter, AI_ROLE_PALETTE } from '../ai-employees/AiCharacter';
import { landingDemoData, type LandingDemoText } from './landingDemo';
import '../aura/aura.css';
import './landing-v5.css';

/* ─── icons ─── */
const P: Record<string, React.ReactNode> = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  spark: (
    <>
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12l5 5 9-10" />,
  play: <path d="M6 4l14 8-14 8V4z" />,
  funnel: <path d="M3 5h18l-7 9v6l-4-2v-4L3 5z" />,
  filter: <path d="M3 5h18l-7 9v6l-4-2v-4L3 5z" />,
  pipe: (
    <>
      <rect x="3" y="4" width="4" height="16" />
      <rect x="10" y="4" width="4" height="16" />
      <rect x="17" y="4" width="4" height="16" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M1 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      <path d="M16 3.5a4 4 0 010 7.5M23 21c0-3-1.5-5.5-4-7" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </>
  ),
  shield: <path d="M12 2l8 3v7c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5l8-3z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  bell: (
    <>
      <path d="M18 16V11a6 6 0 00-12 0v5l-2 3h16l-2-3z" />
      <path d="M10 21a2 2 0 004 0" />
    </>
  ),
  chat: <path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" />,
  box: (
    <>
      <path d="M3 8l9-5 9 5v8l-9 5-9-5z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </>
  ),
  cal: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  leads: <path d="M3 5h18l-7 8v6l-4-2v-4z" />,
  log: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
};
export const Icon: React.FC<{ name: string; size?: number; stroke?: number }> = ({ name, size = 16, stroke = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {P[name]}
  </svg>
);

/* ─── hooks ─── */
function useInView<T extends Element>(ref: React.RefObject<T | null>, threshold = 0.2) {
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setV(e.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return v;
}

function useCountUp(to: number, dur = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    let t0 = 0;
    const f = (t: number) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / dur);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [to, dur]);
  return v;
}

/** Появление .lh-rv при прокрутке (один раз). */
export function useScrollReveal(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 },
    );
    el.querySelectorAll('.lh-rv').forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [root]);
}

const Doing: React.FC<{ list: string[]; ms?: number }> = ({ list, ms = 2800 }) => {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % list.length), ms);
    return () => clearInterval(t);
  }, [list.length, ms]);
  return (
    <span key={i} className="lh-doing-t">
      {list[i]}
    </span>
  );
};

const Head: React.FC<{ k: string; t: string; d?: string }> = ({ k, t, d }) => (
  <div className="lh-sh lh-rv">
    <div className="lh-k">{k}</div>
    <h2>{t}</h2>
    {d && <p>{d}</p>}
  </div>
);

const Char: React.FC<{ role: string; className?: string }> = ({ role, className }) => (
  <span className={className} style={{ background: (AI_ROLE_PALETTE[role] || AI_ROLE_PALETTE.lead_manager).bg }}>
    <AiCharacter role={role} mood="on" />
  </span>
);

function useDemo() {
  const { t, i18n } = useTranslation();
  const tx = t('landing.v5.demo', { returnObjects: true }) as LandingDemoText;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => landingDemoData(tx), [i18n.language]);
}

export type Opener = (mode: 'login' | 'signup') => void;

/* ─── HERO ─── */
function HeroMeta({ l, v, s, text }: { l: string; v?: number; s?: string; text?: string }) {
  const x = useCountUp(v ?? 0, 1600);
  return (
    <div>
      <span>{l}</span>
      <b>{text ?? Math.round(x) + (s || '')}</b>
    </div>
  );
}

function Rot({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % words.length), 2400);
    return () => clearInterval(t);
  }, [words.length]);
  return (
    <span className="lh-rot">
      <span key={i}>{words[i]}</span>
    </span>
  );
}

export function Hero({ onAuth, loggedIn, onOpenCrm }: { onAuth: Opener; loggedIn: boolean; onOpenCrm: () => void }) {
  const { t } = useTranslation();
  const wrap = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const data = useDemo();
  useEffect(() => {
    const f = () => wrap.current?.style.setProperty('--p', String(Math.min(1, window.scrollY / 520)));
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  const move = (e: React.MouseEvent) => {
    const el = stage.current;
    if (!el || !window.matchMedia('(hover: hover)').matches) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };
  const reset = () => {
    stage.current?.style.setProperty('--mx', '0');
    stage.current?.style.setProperty('--my', '0');
  };
  const tpl = AU_TEMPLATES[0];
  const metrics = t('landing.v5.metrics', { returnObjects: true }) as Array<{ l: string; v?: number; s?: string; t?: string }>;
  const feed = t('landing.v5.ticker', { returnObjects: true }) as string[][];
  return (
    <section className="lh-hero" ref={wrap}>
      <div className="lh-glow" />
      <div className="lh-hero-c">
        <a className="lh-pill" href="#aura">
          <span className="lh-pill-b">{t('landing.v5.pill')}</span>
          {t('landing.v5.pillText')}
          <Icon name="arrow" size={13} />
        </a>
        <h1 className="lh-h1">
          {t('landing.v5.h1a')}
          <br />
          {t('landing.v5.h1b')} <Rot words={t('landing.v5.words', { returnObjects: true }) as string[]} />
        </h1>
        <p className="lh-sub">{t('landing.v5.sub')}</p>
        <div className="lh-cta">
          {loggedIn ? (
            <>
              <button type="button" className="lh-btn lg" onClick={onOpenCrm}>
                {t('landing.v5.ctaOpen')}
                <Icon name="arrow" size={15} stroke={2} />
              </button>
              <button type="button" className="lh-btn gh lg" onClick={() => onAuth('login')}>
                {t('landing.v5.ctaAccount')}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="lh-btn lg" onClick={() => onAuth('signup')}>
                {t('landing.v5.ctaStart')}
                <Icon name="arrow" size={15} stroke={2} />
              </button>
              <button type="button" className="lh-btn gh lg" onClick={() => onAuth('login')}>
                {t('landing.v5.ctaLogin')}
              </button>
            </>
          )}
        </div>
        <div className="lh-hmeta">
          {metrics.map((m) => (
            <HeroMeta key={m.l} l={m.l} v={m.v} s={m.s} text={m.t} />
          ))}
        </div>
      </div>
      <div className="lh-stage" ref={stage} onMouseMove={move} onMouseLeave={reset}>
        <div className="lh-shot">
          <div className="lh-chrome">
            <i />
            <i />
            <i />
            <span>crm.lumiva.agency/aura</span>
            <em>{t('landing.v5.demoNote')}</em>
          </div>
          <div className="lh-shot-b">
            <div className="lh-rail">
              {['leads', 'chart', 'box', 'cal', 'chat', 'spark'].map((d, i) => (
                <span key={d} className={i === 5 ? 'on' : ''}>
                  <Icon name={d} size={15} />
                </span>
              ))}
            </div>
            <div className="lh-shot-d">
              <AuScaled width={1240}>
                <AuraDash title={t('landing.v5.heroDashTitle')} sources={tpl.sources} widgets={tpl.widgets} theme="lumiva" density="normal" data={data} period="30d" still />
              </AuScaled>
            </div>
          </div>
        </div>
        <div className="lh-fl lh-fl-a">
          <Char role="lead_manager" className="lh-fl-av" />
          <div>
            <b>Mila AI</b>
            <span className="lh-live">
              <i />
              <Doing list={t('landing.v5.flA', { returnObjects: true }) as string[]} />
            </span>
          </div>
        </div>
        <div className="lh-fl lh-fl-b">
          <span className="lh-fl-ic">
            <Icon name="spark" size={14} />
          </span>
          <div>
            <b>Aura</b>
            <span>{t('landing.v5.flB')}</span>
          </div>
        </div>
        <div className="lh-fl lh-fl-c">
          <span className="lh-fl-ok">
            <Icon name="check" size={13} stroke={2.4} />
          </span>
          <div>
            <b>{t('landing.v5.flCt')}</b>
            <span>{t('landing.v5.flCs')}</span>
          </div>
        </div>
      </div>
      <div className="lh-ticker">
        <div className="lh-ticker-in">
          {[...feed, ...feed].map((x, i) => (
            <span key={i} aria-hidden={i >= feed.length || undefined}>
              <i />
              <b>{x[0]}</b>
              {` ${x[1]} `}
              <u>{x[2]}</u>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── INTEGRATIONS (реальный каталог Integrations Hub, backend integration-hub-catalog.ts) ─── */
const INTEGRATIONS = ['WhatsApp', 'Telegram', 'Google Ads', 'Meta Ads', 'Yandex Direct', 'VK Ads', 'Google Analytics 4', 'WooCommerce', 'Shopify', 'WordPress', 'amoCRM', 'Bitrix24', 'HubSpot', 'Mailchimp', 'Slack', 'Google Sheets', 'Google Calendar', 'Outlook', 'Jira', '1C', 'Zapier', 'Make', 'iyzico', 'PayTR', 'YooKassa'];

export function Integrations() {
  const { t } = useTranslation();
  return (
    <section className="lh-int">
      <div className="lh-int-in">
        <div className="lh-int-l">
          <div className="lh-k">{t('landing.v5.intK')}</div>
          <span>{t('landing.v5.intS')}</span>
        </div>
        <div className="lh-int-m">
          <div className="lh-int-t">
            {[0, 1].map((k) => (
              <div key={k} aria-hidden={k === 1 || undefined}>
                {INTEGRATIONS.map((n) => (
                  <span key={n}>
                    <i />
                    {n}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── PLATFORM ─── */
export function Platform() {
  const { t } = useTranslation();
  const items = t('landing.v5.plat', { returnObjects: true }) as string[][];
  const meta = [
    ['#aura', 'spark'],
    ['#crew', 'chat'],
    ['#depts', 'box'],
  ];
  return (
    <section className="lh-sec" id="platform">
      <Head k={t('landing.v5.platK')} t={t('landing.v5.platT')} d={t('landing.v5.platD')} />
      <div className="lh-tri">
        {items.map(([title, desc], i) => (
          <a key={meta[i][0]} href={meta[i][0]} className="lh-tri-c lh-rv" style={{ transitionDelay: i * 0.08 + 's' }}>
            <div className="lh-tri-top">
              <span className="lh-tri-ic">
                <Icon name={meta[i][1]} size={18} />
              </span>
              <span className="lh-tri-n">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <h3>{title}</h3>
            <p>{desc}</p>
            <span className="lh-more">
              {t('landing.v5.more')}
              <Icon name="arrow" size={13} />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ─── MODULES 3×3 (тексты v4 — уже проверенные) ─── */
const FEATURE_ICONS = ['funnel', 'mail', 'chart', 'bolt', 'target', 'grid', 'pipe', 'chart', 'shield'];

function Feat({ n, title, desc, ic, i }: { n: string; title: string; desc: string; ic: string; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mv = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--x', e.clientX - r.left + 'px');
    el.style.setProperty('--y', e.clientY - r.top + 'px');
  };
  return (
    <div ref={ref} className="lh-feat" onMouseMove={mv} style={{ transitionDelay: (i % 3) * 0.06 + 's' }}>
      <span className="lh-feat-ic">
        <Icon name={ic} size={22} stroke={1.5} />
      </span>
      <div className="lh-feat-n">F / {n}</div>
      <b>{title}</b>
      <p>{desc}</p>
    </div>
  );
}

export function Modules() {
  const { t } = useTranslation();
  const feats = t('landing.v4.features', { returnObjects: true }) as Array<{ t: string; d: string }>;
  return (
    <section className="lh-sec" id="modules">
      <Head k={t('landing.v5.modK')} t={t('landing.v4.modulesTitle')} d={t('landing.v4.modulesSub')} />
      <div className="lh-feats lh-rv">
        {feats.map((f, i) => (
          <Feat key={i} n={String(i + 1).padStart(2, '0')} title={f.t} desc={f.d} ic={FEATURE_ICONS[i] || 'grid'} i={i} />
        ))}
      </div>
    </section>
  );
}

/* ─── AUTOMATION ─── */
const AUTO_ICONS = ['user', 'filter', 'users', 'mail', 'bell'];

export function Automation() {
  const { t } = useTranslation();
  const steps = t('landing.v4.autoSteps', { returnObjects: true }) as Array<{ label: string; sub: string }>;
  const acts = t('landing.v4.autoActions', { returnObjects: true }) as string[];
  const ref = useRef<HTMLElement>(null);
  const on = useInView(ref);
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!on) return;
    const tm = setInterval(() => setS((x) => (x + 1) % (steps.length + 1)), 1500);
    return () => clearInterval(tm);
  }, [on, steps.length]);
  return (
    <section className="lh-sec" id="auto" ref={ref}>
      <Head k={t('landing.v5.autoK')} t={t('landing.v4.autoTitle')} d={t('landing.v4.autoSub')} />
      <div className="lh-auto lh-rv">
        <div className="lh-card">
          <div className="lh-card-h">
            <div>
              <div className="lh-k sm">Automation · playbook</div>
              <b>{t('landing.v4.autoFlowTitle')}</b>
            </div>
            <span className="lh-on">
              <i />
              {t('landing.v5.autoActive')}
            </span>
          </div>
          <div className="lh-steps">
            <div className="lh-steps-line">
              <span style={{ width: (Math.min(s, steps.length - 1) / (steps.length - 1)) * 100 + '%' }} />
            </div>
            {steps.map((st, i) => (
              <div key={i} className={'lh-step' + (i < s ? ' done' : '') + (i === s ? ' cur' : '')}>
                <span className="lh-step-c">
                  <Icon name={AUTO_ICONS[i] || 'bolt'} size={16} />
                </span>
                <b>{st.label}</b>
                <em>{st.sub}</em>
              </div>
            ))}
          </div>
          <div className="lh-auto-ai">
            <Char role="lead_manager" className="lh-fl-av sm" />
            <span key={s >= steps.length ? 'd' : 'r'}>{s >= steps.length ? t('landing.v5.autoDone') : t('landing.v5.autoRun')}</span>
          </div>
        </div>
        <div className="lh-card">
          <div className="lh-k sm">{t('landing.v4.autoCardKicker')}</div>
          <b className="lh-card-t">{t('landing.v4.autoCardTitle')}</b>
          <ul className="lh-acts">
            {acts.map((a, i) => (
              <li key={i}>
                <em>{String(i + 1).padStart(2, '0')}</em>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ─── AURA ─── */
const AURA_TPLS = [0, 1, 2, 3]; // sales, leads, tv, stock

export function AuraShowcase({ onAuth }: { onAuth: Opener }) {
  const { t } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  const vis = useInView(box);
  const data = useDemo();
  const prompts = t('landing.v5.auraPrompts', { returnObjects: true }) as string[];
  const stepsTx = t('landing.v5.auraSteps', { returnObjects: true }) as string[];
  const [st, setSt] = useState({ i: 0, ph: 'type' as 'type' | 'think' | 'build' | 'hold', c: 0, r: 0, s: 0 });
  const tpl = AU_TEMPLATES[AURA_TPLS[st.i]];
  const cur = prompts[st.i] || '';
  useEffect(() => {
    if (!vis) return;
    let tm: ReturnType<typeof setTimeout>;
    if (st.ph === 'type') tm = setTimeout(() => setSt((x) => (x.c >= cur.length ? { ...x, ph: 'think', s: 0 } : { ...x, c: x.c + 1 })), st.c >= cur.length ? 500 : 26);
    else if (st.ph === 'think') tm = setTimeout(() => setSt((x) => (x.s >= stepsTx.length - 1 ? { ...x, ph: 'build', r: 0 } : { ...x, s: x.s + 1 })), 420);
    else if (st.ph === 'build') tm = setTimeout(() => setSt((x) => (x.r >= tpl.widgets.length ? { ...x, ph: 'hold' } : { ...x, r: x.r + 1 })), 220);
    else tm = setTimeout(() => setSt((x) => ({ i: (x.i + 1) % AURA_TPLS.length, ph: 'type', c: 0, r: 0, s: 0 })), 3600);
    return () => clearTimeout(tm);
  }, [st, vis, cur.length, stepsTx.length, tpl.widgets.length]);
  const pick = (i: number) => setSt({ i, ph: 'type', c: 0, r: 0, s: 0 });
  const list = t('landing.v5.auraList', { returnObjects: true }) as string[];
  return (
    <section className="lh-sec" id="aura">
      <div className="lh-split">
        <div className="lh-split-t lh-rv">
          <div className="lh-k">
            <Icon name="spark" size={13} />
            {t('landing.v5.auraK')}
          </div>
          <h2>{t('landing.v5.auraT')}</h2>
          <p>{t('landing.v5.auraD')}</p>
          <ul className="lh-list">
            {list.map((x) => (
              <li key={x}>
                <Icon name="check" size={14} stroke={2} />
                {x}
              </li>
            ))}
          </ul>
          <button type="button" className="lh-btn" onClick={() => onAuth('signup')}>
            {t('landing.v5.auraCta')}
            <Icon name="arrow" size={14} stroke={2} />
          </button>
        </div>
        <div className="lh-aura lh-rv" ref={box}>
          <div className="lh-prompt">
            <div className="lh-prompt-in">
              <span className="lh-prompt-ic">
                <Icon name="spark" size={15} />
              </span>
              <span className="lh-prompt-t">
                {cur.slice(0, st.c)}
                {st.ph === 'type' && <i className="lh-caret" />}
              </span>
              <span className={'lh-prompt-go' + (st.ph !== 'type' ? ' on' : '')}>
                <Icon name="arrow" size={14} stroke={2} />
              </span>
            </div>
          </div>
          <div className="lh-aura-steps">
            {stepsTx.map((s, i) => {
              const done = st.ph === 'build' || st.ph === 'hold' || (st.ph === 'think' && i < st.s);
              const now = st.ph === 'think' && i === st.s;
              return (
                <span key={s} className={(done ? 'done' : '') + (now ? ' cur' : '')}>
                  <i>{done && <Icon name="check" size={9} stroke={3} />}</i>
                  {s}
                </span>
              );
            })}
          </div>
          <div className="lh-aura-frame">
            <AuScaled width={1280}>
              <AuraDash
                key={st.i}
                title={t(`crm.aura.tpl.${tpl.id}.name`)}
                sources={tpl.sources}
                widgets={tpl.widgets}
                theme={tpl.theme}
                density={tpl.density || 'normal'}
                data={data}
                period={tpl.period || '30d'}
                reveal={st.ph === 'type' || st.ph === 'think' ? 0 : st.r}
                still
              />
            </AuScaled>
          </div>
          <div className="lh-aura-tabs">
            {AURA_TPLS.map((ti, i) => (
              <button type="button" key={ti} className={i === st.i ? 'on' : ''} onClick={() => pick(i)}>
                {t(`crm.aura.tpl.${AU_TEMPLATES[ti].id}.name`)}
              </button>
            ))}
            <span className="lh-demo-note">{t('landing.v5.demoNote')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── AI CREW ─── */
const CREW_ROLES = ['lead_manager', 'sales_manager', 'marketing_analyst', 'email_assistant'];

function CrewCard({ role, name, job, list, i }: { role: string; name: string; job: string; list: string[]; i: number }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const p = AI_ROLE_PALETTE[role] || AI_ROLE_PALETTE.lead_manager;
  const move = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || !window.matchMedia('(hover: hover)').matches) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--rx', ((e.clientY - r.top) / r.height - 0.5) * -5 + 'deg');
    el.style.setProperty('--ry', ((e.clientX - r.left) / r.width - 0.5) * 6 + 'deg');
  };
  const out = () => {
    ref.current?.style.setProperty('--rx', '0deg');
    ref.current?.style.setProperty('--ry', '0deg');
  };
  return (
    <div ref={ref} className="lh-crew-c lh-rv" style={{ transitionDelay: i * 0.08 + 's', '--pbg': p.bg, '--pd': p.d } as React.CSSProperties} onMouseMove={move} onMouseLeave={out}>
      <div className="lh-crew-p">
        <div className="lh-crew-bg" />
        <div className="lh-crew-fig">
          <AiCharacter role={role} mood="on" />
        </div>
        <span className="lh-crew-st">
          <i />
          {t('landing.v5.crewWork')}
        </span>
      </div>
      <div className="lh-crew-b">
        <div className="lh-crew-nm">{name}</div>
        <div className="lh-crew-job">{job}</div>
        <div className="lh-doing">
          <span className="lh-think">
            <i />
            <i />
            <i />
          </span>
          <Doing list={list} ms={2600 + i * 400} />
        </div>
        <div className="lh-crew-log">
          <Icon name="log" size={12} />
          {t('landing.v5.crewLog')}
        </div>
      </div>
    </div>
  );
}

export function Crew() {
  const { t } = useTranslation();
  const crew = t('landing.v5.crew', { returnObjects: true }) as Array<[string, string, string[]]>;
  return (
    <section className="lh-sec" id="crew">
      <Head k={t('landing.v5.crewK')} t={t('landing.v5.crewT')} d={t('landing.v5.crewD')} />
      <div className="lh-crew">
        {crew.map(([name, job, list], i) => (
          <CrewCard key={CREW_ROLES[i]} role={CREW_ROLES[i]} name={name} job={job} list={list} i={i} />
        ))}
      </div>
    </section>
  );
}

/* ─── AI DEPARTMENTS (Enterprise/Ultimate — ai-office planInfo) ─── */
export const SRV = ['meta', 'google', 'woo', 'vk', 'yandex', 'telegram'] as const;
const SRV_N: Record<(typeof SRV)[number], string> = { meta: 'Meta', google: 'Google', woo: 'WooCommerce', vk: 'VK', yandex: 'Yandex', telegram: 'Telegram' };
export const SrvIc = ({ k }: { k: (typeof SRV)[number] }) =>
  ({
    meta: <path d="M6 21c0-6 3-11 6.5-11 2.4 0 4 2.6 5.5 5.2 1.5-2.6 3.1-5.2 5.5-5.2C27 10 30 15 30 21c0 3-1.3 5-3.4 5-2.3 0-3.8-2.4-5.4-5.2L18 15.2l-3.2 5.6C13.2 23.6 11.7 26 9.4 26 7.3 26 6 24 6 21z" fill="none" stroke="#0866ff" strokeWidth="2.6" strokeLinejoin="round" />,
    google: (
      <g transform="translate(6 6) scale(.5)">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </g>
    ),
    woo: (
      <g>
        <rect x="3" y="9" width="30" height="16" rx="4" fill="#7f54b3" />
        <path d="M14 25l4 4v-4z" fill="#7f54b3" />
        <text x="18" y="21" textAnchor="middle" fontFamily="Inter Tight,sans-serif" fontWeight="800" fontSize="10" fill="#fff">
          Woo
        </text>
      </g>
    ),
    vk: (
      <g>
        <rect x="4" y="4" width="28" height="28" rx="8" fill="#0077ff" />
        <path d="M19.3 24.5c-6.2 0-9.7-4.2-9.9-11.3h3.1c.1 5.2 2.4 7.4 4.2 7.9v-7.9h2.9v4.5c1.8-.2 3.7-2.2 4.3-4.5h2.9c-.5 2.8-2.5 4.8-4 5.6 1.5.7 3.8 2.4 4.7 5.7h-3.2c-.7-2.2-2.4-3.9-4.7-4.1v4.1z" fill="#fff" />
      </g>
    ),
    yandex: (
      <g>
        <circle cx="18" cy="18" r="14" fill="#fc3f1d" />
        <text x="18" y="24.5" textAnchor="middle" fontFamily="Inter Tight,sans-serif" fontWeight="800" fontSize="18" fill="#fff">
          Я
        </text>
      </g>
    ),
    telegram: (
      <g>
        <circle cx="18" cy="18" r="14" fill="#29a9eb" />
        <path d="M10.5 17.6l13.3-5.2c.6-.2 1.2.2 1 1.1l-2.3 10.7c-.2.8-.7 1-1.3.6l-3.5-2.6-1.7 1.6c-.2.2-.4.3-.7.3l.3-3.6 6.5-5.9c.3-.3-.1-.4-.4-.2l-8 5-3.4-1c-.8-.3-.8-.8.2-1.1z" fill="#fff" />
      </g>
    ),
  })[k];
const DEP_COLORS = ['#ff6a33', '#1f9d63', '#3a6ff0', '#7457f2'];

export function Depts() {
  const { t } = useTranslation();
  const deps = t('landing.v5.depts', { returnObjects: true }) as string[][];
  const sx = (i: number) => 110 + i * 156;
  const dx = (j: number) => 140 + j * 240;
  return (
    <section className="lh-sec" id="depts">
      <Head k={t('landing.v5.deptK')} t={t('landing.v5.deptT')} d={t('landing.v5.deptD')} />
      <div className="lh-flow lh-rv">
        <div className="lh-flow-sc">
          <svg viewBox="0 0 1000 470" className="lh-flow-svg" role="img" aria-label={t('landing.v5.deptT')}>
            <defs>
              <radialGradient id="lhHub" cx="40%" cy="35%">
                <stop offset="0" stopColor="#3a3a40" />
                <stop offset="1" stopColor="#111113" />
              </radialGradient>
            </defs>
            {SRV.map((s, i) => (
              <path key={'a' + s} id={'lhA' + i} d={`M${sx(i)},78 C${sx(i)},160 500,140 500,186`} className="lh-wire" />
            ))}
            {DEP_COLORS.map((c, j) => (
              <path key={'b' + j} id={'lhB' + j} d={`M500,274 C500,320 ${dx(j)},310 ${dx(j)},360`} className="lh-wire" style={{ stroke: c, strokeOpacity: 0.35 }} />
            ))}
            {SRV.map((s, i) => (
              <circle key={'pa' + s} r="4" fill="#111113">
                <animateMotion dur="2.6s" begin={i * 0.37 + 's'} repeatCount="indefinite">
                  <mpath href={'#lhA' + i} />
                </animateMotion>
              </circle>
            ))}
            {DEP_COLORS.map((c, j) => (
              <g key={'pb' + j}>
                <circle r="4.5" fill={c}>
                  <animateMotion dur="2.2s" begin={j * 0.5 + 0.3 + 's'} repeatCount="indefinite">
                    <mpath href={'#lhB' + j} />
                  </animateMotion>
                </circle>
                <circle r="3" fill="#fff" stroke={c} strokeWidth="1.5">
                  <animateMotion dur="2.8s" begin={j * 0.6 + 1 + 's'} repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                    <mpath href={'#lhB' + j} />
                  </animateMotion>
                </circle>
              </g>
            ))}
            {SRV.map((s, i) => (
              <g key={s} className="lh-srv" transform={`translate(${sx(i) - 30},16)`}>
                <rect width="60" height="60" rx="16" />
                <g transform="translate(12,12)">
                  <SrvIc k={s} />
                </g>
                <title>{SRV_N[s]}</title>
              </g>
            ))}
            <g transform="translate(500,230)">
              <circle r="70" className="lh-hub-ring" />
              <circle r="70" className="lh-hub-ring r2" />
              <circle r="46" fill="url(#lhHub)" />
              <path d="M0-14l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#c8f560" />
              <rect x="-90" y="80" width="180" height="26" rx="13" className="lh-hub-pill" />
              <text y="98" textAnchor="middle" className="lh-hub-t">
                {t('landing.v5.deptHub')}
              </text>
            </g>
            {deps.map(([n, sub], j) => (
              <g key={n} transform={`translate(${dx(j) - 100},360)`}>
                <rect width="200" height="92" rx="16" className="lh-dep-r" />
                <rect x="16" y="18" width="10" height="10" rx="3" fill={DEP_COLORS[j]} />
                <text x="34" y="28" className="lh-dep-n">
                  {n}
                </text>
                <text x="16" y="66" className="lh-dep-s">
                  {sub}
                </text>
                {[0, 1, 2].map((k) => (
                  <circle key={k} cx={168 - k * 14} cy="28" r="7" fill={DEP_COLORS[j]} opacity={0.25 + k * 0.2} stroke="#fff" strokeWidth="2" />
                ))}
              </g>
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}

/* ─── GETTING STARTED (вместо «результатов клиентов» из макета — их нет) ─── */
export function Start() {
  const { t } = useTranslation();
  const steps = t('landing.v4.steps', { returnObjects: true }) as Array<{ v: string; l: string }>;
  return (
    <section className="lh-sec" id="start">
      <Head k={t('landing.v5.startK')} t={t('landing.v4.stepsTitle')} d={t('landing.v4.stepsSub')} />
      <div className="lh-nums">
        {steps.map((s, i) => (
          <div key={s.v} className="lh-num lh-rv" style={{ transitionDelay: i * 0.08 + 's' }}>
            <b>{s.v}</b>
            <span>{s.l}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── PRICING (реальные цены и годовые скидки 10/12/15/20% — BillingService.getYearlyDiscount) ─── */
const PLANS = [
  { id: 'standard', name: 'Standard', m: 14, y: 12.6, hot: false },
  { id: 'professional', name: 'Professional', m: 23, y: 20.24, hot: false },
  { id: 'enterprise', name: 'Enterprise', m: 40, y: 34, hot: true },
  { id: 'ultimate', name: 'Ultimate', m: 52, y: 41.6, hot: false },
];

export function Pricing({ onAuth }: { onAuth: Opener }) {
  const { t, i18n } = useTranslation();
  const [yr, setYr] = useState(false);
  const loc = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const fmt = (v: number) => '€' + v.toLocaleString(loc, { maximumFractionDigits: 2 });
  return (
    <section className="lh-sec" id="pricing">
      <div className="lh-sh lh-rv">
        <div className="lh-k">{t('landing.v4.pricingKicker')}</div>
        <h2>{t('landing.v4.pricingTitle')}</h2>
        <p>{t('landing.v4.pricingSub')}</p>
        <div className="lh-bill">
          <span className="lh-bill-ind" style={{ transform: `translateX(${yr ? '100%' : '0'})` }} />
          <button type="button" className={!yr ? 'on' : ''} onClick={() => setYr(false)}>
            {t('landing.v5.priceMonth')}
          </button>
          <button type="button" className={yr ? 'on' : ''} onClick={() => setYr(true)}>
            {t('landing.v5.priceYear')}
            <em>{t('landing.v5.priceUpTo')}</em>
          </button>
        </div>
      </div>
      <div className="lh-plans4">
        {PLANS.map((p, i) => (
          <div key={p.id} className={'lh-plan lh-rv' + (p.hot ? ' hot' : '')} style={{ transitionDelay: i * 0.07 + 's' }}>
            {p.hot && <span className="lh-plan-tag">{t('landing.v5.priceHot')}</span>}
            <div className="lh-plan-n">{p.name}</div>
            <div className="lh-plan-p">
              <b key={String(yr)} className="lh-pv">
                {fmt(yr ? p.y : p.m)}
              </b>
              <span>{t('landing.v4.perMonth')}</span>
            </div>
            <div className="lh-plan-y">{yr ? t('landing.v5.priceMonthly', { v: p.m }) : `${fmt(p.y)}${t('landing.v4.perMonth')} ${t('landing.v4.perYearNote')}`}</div>
            <p className="lh-plan-s">{t(`landing.v4.plans.${p.id}.sub`)}</p>
            <div className="lh-plan-x">{t('landing.v4.perUser')}</div>
            {p.id === 'ultimate' ? (
              <Link className="lh-btn block gh" to="/contact">
                {t(`landing.v4.plans.${p.id}.cta`)}
                <Icon name="arrow" size={13} stroke={2} />
              </Link>
            ) : (
              <button type="button" className={'lh-btn block' + (p.hot ? '' : ' gh')} onClick={() => onAuth('signup')}>
                {t(`landing.v4.plans.${p.id}.cta`)}
                <Icon name="arrow" size={13} stroke={2} />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── FINAL CTA ─── */
export function FinalCta({ onAuth, onDemo, loggedIn }: { onAuth: Opener; onDemo: () => void; loggedIn: boolean }) {
  const { t } = useTranslation();
  return (
    <section className="lh-start">
      <div className="lh-glow b" />
      <div className="lh-start-in lh-rv">
        <div className="lh-k">{t('landing.v5.endK')}</div>
        <h2>{t('landing.v5.endT')}</h2>
        <p>{t('landing.v5.endD')}</p>
        <div className="lh-cta">
          <button type="button" className="lh-btn lg" onClick={() => onAuth('signup')}>
            {t('landing.v4.ctaCreate')}
            <Icon name="arrow" size={15} stroke={2} />
          </button>
          <button type="button" className="lh-btn gh lg" onClick={onDemo}>
            {t('landing.v4.ctaDemo')}
            <Icon name="play" size={12} />
          </button>
        </div>
        {!loggedIn && (
          <button type="button" className="lh-link" onClick={() => onAuth('login')}>
            {t('landing.v5.endHave')}
          </button>
        )}
      </div>
    </section>
  );
}
