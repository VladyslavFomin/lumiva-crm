/* Общие блоки страниц «Решения» — порт Claude Design lp-kit.jsx (LpHero, LpProblem, LpSteps,
 * LpCompare, LpFaq, LpAi, LpCtaBox). Стили — pages/landing/lp-kit.css (всё под .lhv). */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PublicHeader } from '../../components/public/PublicHeader';
type HeaderKey = React.ComponentProps<typeof PublicHeader>['activeKey'];
import { PublicFooter } from '../../components/public/PublicFooter';
import { Icon, useScrollReveal } from '../landing/LandingSections';
import { landingDemoData, type LandingDemoText } from '../landing/landingDemo';
import { AuraDash, AuScaled } from '../aura/AuraDash';
import { AU_TEMPLATES } from '../aura/auraModel';
import { AiCharacter, AI_ROLE_PALETTE } from '../ai-employees/AiCharacter';
import '../landing/lp-kit.css';

export type SolItem = { b: string; s: string };
export type SolCard = { t: string; d: string; ic: string };
export type SolQA = { q: string; a: string };

export function useInView<T extends Element>(ref: React.RefObject<T | null>, threshold = 0.25) {
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

/** Один раз увидели — дальше true (для анимаций «въезда»). */
export function useSeenOnce<T extends Element>(ref: React.RefObject<T | null>, threshold = 0.3) {
  const on = useInView(ref, threshold);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (on) setSeen(true);
  }, [on]);
  return seen;
}

export function useTick(on: boolean, ms: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setI((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [on, ms]);
  return i;
}

function useCountUp(to: number, on: boolean, dur = 1300) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!on) return;
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
  }, [to, on, dur]);
  return v;
}

function Stat({ v, l, on, i }: { v: string; l: string; on: boolean; i: number }) {
  const n = Number(v);
  const x = useCountUp(Number.isFinite(n) ? n : 0, on, 1300 + i * 140);
  return (
    <div className="lp-stat">
      <b>{Number.isFinite(n) ? Math.round(x) : v}</b>
      <span>{l}</span>
    </div>
  );
}

export function Head({ k, t, d }: { k: string; t: string; d?: string }) {
  return (
    <div className="lp-sh lh-rv">
      <div className="lp-kick">
        <span className="lp-dot" />
        {k}
      </div>
      <h2>{t}</h2>
      {d && <p>{d}</p>}
    </div>
  );
}

export function Doing({ list, ms = 2600 }: { list: string[]; ms?: number }) {
  const i = useTick(true, ms);
  const k = i % list.length;
  return (
    <span key={k} className="lh-doing-t">
      {list[k]}
    </span>
  );
}

export function DemoNote({ children }: { children: React.ReactNode }) {
  return <div className="fv-demo">{children}</div>;
}

const Chev = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

/** Hero с превью дашборда Aura на демо-данных и строкой цифр. */
export function SolutionHero(p: {
  crumbs: [string, string];
  kicker: string;
  t1: string;
  t2: string;
  sub: string;
  tryFree: string;
  demo: string;
  demoNote: string;
  url: string;
  tplIndex: number;
  dashTitle: string;
  stats: Array<{ v: string; l: string }>;
  /** Свой визуал вместо дашборда Aura (когда у Aura нет данных для этого решения). */
  visual?: React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const heroV = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const statsSeen = useSeenOnce(statsRef, 0.2);
  const demo = t('landing.v5.demo', { returnObjects: true }) as LandingDemoText;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => landingDemoData(demo), [i18n.language]);
  const tpl = AU_TEMPLATES[p.tplIndex] || AU_TEMPLATES[0];
  const move = (e: React.MouseEvent) => {
    const el = heroV.current;
    if (!el || !window.matchMedia('(hover: hover)').matches) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };
  return (
    <section className="lp-hero has-v" onMouseMove={move}>
      <div className="lh-glow" />
      <div className="lp-hero-in">
        <div className="lp-hero-t">
          <nav className="lp-crumbs" aria-label="breadcrumb">
            <Link to="/">Lumiva CRM</Link>
            <Chev />
            <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>{p.crumbs[0]}</span>
            <Chev />
            <span>{p.crumbs[1]}</span>
          </nav>
          <div className="lp-kick">
            <span className="lp-dot" />
            {p.kicker}
          </div>
          <h1 className="lp-h1">
            {p.t1}
            <br />
            <em>{p.t2}</em>
          </h1>
          <p className="lp-sub">{p.sub}</p>
          <div className="lp-cta">
            <button type="button" className="lh-btn lg" onClick={() => navigate('/?mode=signup')}>
              {p.tryFree}
              <Icon name="arrow" size={15} stroke={2} />
            </button>
            <Link className="lh-btn gh lg" to="/contact">
              {p.demo}
            </Link>
          </div>
        </div>
        <div className="lp-hero-v" ref={heroV}>
          <div className="lp-shot">
            <div className="lh-chrome">
              <i />
              <i />
              <i />
              <span>{p.url}</span>
              <em>{p.demoNote}</em>
            </div>
            <div className="lp-shot-d">
              {p.visual ?? (
                <AuScaled width={1240}>
                  <AuraDash title={p.dashTitle} sources={tpl.sources} widgets={tpl.widgets} theme={tpl.theme} density="normal" data={data} period="30d" still />
                </AuScaled>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="lp-hero-s" ref={statsRef}>
        <div className="lp-stats">
          {p.stats.map((s, i) => (
            <Stat key={i} v={s.v} l={s.l} on={statsSeen} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function Problem({ k, t, d }: { k: string; t: string; d: string }) {
  return (
    <section className="lp-sec">
      <div className="lp-prob lh-rv">
        <div className="lp-kick">
          <span className="lp-dot" />
          {k}
        </div>
        <div>
          <h2>{t}</h2>
          <p>{d}</p>
        </div>
      </div>
    </section>
  );
}

/** Строка «текст + визуал» (как модуль на странице функций). */
export function ModRow({ k, t, lede, items, children, rev }: { k: string; t: string; lede: string; items: SolItem[]; children: React.ReactNode; rev?: boolean }) {
  return (
    <div className="ft-mods">
      <section className={'ft-mod' + (rev ? ' rev' : '')}>
        <div className="ft-mod-t lh-rv">
          <div className="lp-kick">
            <span className="lp-dot" />
            {k}
          </div>
          <h2>{t}</h2>
          <p className="ft-lede">{lede}</p>
          <ul>
            {items.map((b, i) => (
              <li key={b.b}>
                <i>{String(i + 1).padStart(2, '0')}</i>
                <span>
                  <b>{b.b}</b>
                  {b.s}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="ft-mod-v lh-rv">{children}</div>
      </section>
    </div>
  );
}

function Card({ c, n }: { c: SolCard; n: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mv = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--x', e.clientX - r.left + 'px');
    el.style.setProperty('--y', e.clientY - r.top + 'px');
  };
  return (
    <div ref={ref} className="lh-feat" onMouseMove={mv}>
      <span className="lh-feat-ic">
        <Icon name={c.ic} size={22} stroke={1.5} />
      </span>
      <div className="lh-feat-n">{n}</div>
      <b>{c.t}</b>
      <p>{c.d}</p>
    </div>
  );
}

export function CardsSection({ k, t, d, items }: { k: string; t: string; d?: string; items: SolCard[] }) {
  return (
    <section className="lp-sec" style={{ paddingTop: 90 }}>
      <Head k={k} t={t} d={d} />
      {/* сетка без пустых ячеек: 4 карточки → 2×2, «хвост» при 5/7 растягивается на остаток ряда */}
      <div className={'lh-feats lh-rv' + (items.length % 3 && items.length % 2 === 0 ? ' c2' : items.length % 3 ? ' tail' + (3 - (items.length % 3)) : '')}>
        {items.map((c, i) => (
          <Card key={c.t} c={c} n={String(i + 1).padStart(2, '0')} />
        ))}
      </div>
    </section>
  );
}

export function StepsSection({ k, t, d, n: stepWord, items }: { k: string; t: string; d?: string; n: string; items: Array<{ t: string; d: string }> }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref, 0.3);
  const [s, setS] = useState(0);
  const n = items.length;
  useEffect(() => {
    if (!on) return;
    const tm = setInterval(() => setS((x) => (x + 1) % n), 2400);
    return () => clearInterval(tm);
  }, [on, n]);
  return (
    <section className="lp-sec">
      <Head k={k} t={t} d={d} />
      <div style={{ paddingTop: 18 }}>
        <div className="lp-steps lh-rv" ref={ref} style={{ '--n': n } as React.CSSProperties}>
          <div className="lp-steps-bar">
            <span style={{ width: ((s + 1) / n) * 100 + '%' }} />
          </div>
          {items.map((x, i) => (
            <div
              key={x.t}
              role="button"
              tabIndex={0}
              className={'lp-step' + (i === s ? ' on' : '') + (i < s ? ' done' : '')}
              onClick={() => setS(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setS(i);
                }
              }}
            >
              <span className="lp-step-n">
                {stepWord} {i + 1}
              </span>
              <b>{x.t}</b>
              <p>{x.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CompareSection(p: { k: string; t: string; metric: string; a: string; b: string; rows: Array<{ metric: string; lumiva: string; typical: string }> }) {
  return (
    <section className="lp-sec">
      <Head k={p.k} t={p.t} />
      <div className="lp-cmp lh-rv">
        <div className="lp-cmp-h">
          <span>{p.metric}</span>
          <span className="me">{p.a}</span>
          <span>{p.b}</span>
        </div>
        {p.rows.map((r) => (
          <div key={r.metric} className="lp-cmp-r">
            <b>{r.metric}</b>
            <span className="me">
              <Icon name="check" size={14} stroke={2} />
              {r.lumiva}
            </span>
            <span className="no">{r.typical}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AiSection(p: { role: string; k: string; name: string; job: string; text: string; list: string[]; hire: string; aura?: string; hireHref?: string }) {
  const pal = AI_ROLE_PALETTE[p.role] || AI_ROLE_PALETTE.lead_manager;
  return (
    <section className="lp-sec">
      <div className="lp-ai lh-rv" style={{ '--pbg': pal.bg, '--pd': pal.d } as React.CSSProperties}>
        <div className="lp-ai-fig">
          <div className="lp-ai-bg" />
          <div className="lp-ai-ch">
            <AiCharacter role={p.role} mood="on" />
          </div>
        </div>
        <div className="lp-ai-t">
          <div className="lp-kick">
            <span className="lp-dot" />
            {p.k}
          </div>
          <h3>
            {p.name}
            <span>{p.job}</span>
          </h3>
          <p>{p.text}</p>
          <div className="lh-doing">
            <span className="lh-think">
              <i />
              <i />
              <i />
            </span>
            <Doing list={p.list} />
          </div>
          <div className="lp-ai-a">
            <a className="lh-btn" href={p.hireHref || '/#crew'}>
              {p.hire}
              <Icon name="arrow" size={14} stroke={2} />
            </a>
            {p.aura && (
              <a className="lh-btn gh" href="/#aura">
                <Icon name="spark" size={14} />
                {p.aura}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function FaqSection(p: { k: string; t: string; note: string; write: string; writeHref?: string; groups: Array<{ g: string; items: SolQA[] }> }) {
  const [o, setO] = useState('0-0');
  return (
    <section className="lp-sec">
      <div className="lp-faq">
        <div className="lp-faq-l lh-rv">
          <div className="lp-kick">
            <span className="lp-dot" />
            {p.k}
          </div>
          <h2>{p.t}</h2>
          <p>
            {p.note} {p.writeHref ? <a href={p.writeHref}>{p.write}</a> : <Link to="/contact">{p.write}</Link>}.
          </p>
        </div>
        <div className="lp-faq-r lh-rv">
          {p.groups.map((g, gi) => (
            <div key={g.g}>
              <div className="lp-faq-g">{g.g}</div>
              {g.items.map((f, i) => {
                const id = gi + '-' + i;
                const open = o === id;
                return (
                  <div key={id} className={'lp-faq-i' + (open ? ' o' : '')}>
                    <button type="button" onClick={() => setO(open ? '' : id)} aria-expanded={open}>
                      <span>{f.q}</span>
                      <i>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </i>
                    </button>
                    <div className="lp-faq-a">
                      <div>
                        <p>{f.a}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaBox({ k, t, demo, tryFree, demoTo = '/contact' }: { k: string; t: string; demo: string; tryFree: string; demoTo?: string }) {
  const navigate = useNavigate();
  return (
    <section className="lp-sec">
      <div className="lp-ctab lh-rv">
        <div className="lh-glow b" />
        <div>
          <div className="lp-kick">
            <span className="lp-dot" />
            {k}
          </div>
          <h2>{t}</h2>
        </div>
        <div className="lp-ctab-a">
          <Link className="lh-btn lg" to={demoTo}>
            {demo}
            <Icon name="arrow" size={15} stroke={2} />
          </Link>
          <button type="button" className="lh-btn gh lg" onClick={() => navigate('/?mode=signup')}>
            {tryFree}
          </button>
        </div>
      </div>
    </section>
  );
}

/** Оболочка страницы решения: шапка, .lhv с появлением при прокрутке, подвал. */
export function SolutionShell({ activeKey, children }: { activeKey: HeaderKey; children: React.ReactNode }) {
  const root = useRef<HTMLElement>(null);
  useScrollReveal(root);
  return (
    <div className="min-h-screen bg-white overflow-x-clip">
      <PublicHeader activeKey={activeKey} />
      <main className="lhv" ref={root}>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}

/** Карточка-график: строки с несколькими сегментами (демо-данные). */
export function BarsCard({ title, rows, legend }: { title: string; rows: Array<{ n: string; segs: number[]; max?: number; meta: string; val: string }>; legend: Array<{ c: string; l: string }> }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeenOnce(ref);
  const mx = Math.max(...rows.map((r) => r.max ?? r.segs.reduce((a, b) => a + b, 0)));
  return (
    <div className="lh-card" ref={ref}>
      <div className="lh-k sm">{title}</div>
      <div className="lp-bars-l">
        {rows.map((r, i) => (
          <div key={r.n}>
            <div className="lp-bar-h">
              <span>{r.n}</span>
              <em>{r.meta}</em>
              <b>{r.val}</b>
            </div>
            <div className="lp-bar-t">
              {r.segs.map((v, j) => (
                <span key={j} style={{ width: seen ? (v / mx) * 100 + '%' : 0, background: legend[j]?.c, transitionDelay: i * 0.1 + j * 0.1 + 's' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="lp-legend">
        {legend.map((x) => (
          <span key={x.l}>
            <i style={{ background: x.c }} />
            {x.l}
          </span>
        ))}
      </div>
    </div>
  );
}
