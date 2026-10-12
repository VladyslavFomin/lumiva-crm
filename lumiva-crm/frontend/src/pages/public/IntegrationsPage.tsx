// «Интеграции» — дизайн Claude Design integrations-v2.html (lh-int.jsx, lh-int.css).
// Каталог — реальные подключения (integrationsText.ts, по backend integration-hub-catalog.ts) со статусом
// «работает / бета / ИИ-отделы» и метками возможностей. Выдуманные коннекторы и цифры макета убраны.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon, SrvIc } from '../landing/LandingSections';
import { CATS, CONNECTORS, HUB_IDS, INT_T, type CatKey, type Conn, type IntText, type Lang } from './integrationsText';
import { CardsSection, CtaBox, FaqSection, Head, SolutionShell, useInView, useSeenOnce } from './solutionKit';

function Logo({ c, size = 40 }: { c: Conn; size?: number }) {
  if (c.svg) {
    return (
      <span className="in-lg" style={{ width: size, height: size, background: c.bg }}>
        <svg viewBox="0 0 36 36" width={size * 0.7} height={size * 0.7} aria-hidden>
          <SrvIc k={c.svg} />
        </svg>
      </span>
    );
  }
  return (
    <span className="in-lg" style={{ width: size, height: size, background: c.bg, color: c.fg, fontSize: size * (c.letter.length > 2 ? 0.28 : 0.34) }}>
      {c.letter}
    </span>
  );
}

function CountStat({ v, l, i, on }: { v: string; l: string; i: number; on: boolean }) {
  const to = Number(v);
  const [x, setX] = useState(0);
  useEffect(() => {
    if (!on || !Number.isFinite(to)) return;
    let raf = 0;
    let t0 = 0;
    const dur = 1300 + i * 120;
    const f = (t: number) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / dur);
      setX(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [on, to, i]);
  return (
    <div className="in-stat" style={{ animationDelay: 0.25 + i * 0.08 + 's' }}>
      <b>{Number.isFinite(to) ? Math.round(x) : v}</b>
      <span>{l}</span>
    </div>
  );
}

function Hero({ tx }: { tx: IntText }) {
  const ref = useRef<HTMLElement>(null);
  const on = useSeenOnce(ref, 0.1);
  const stats = tx.stats.map((s, i) => (i === 0 ? { ...s, v: String(CONNECTORS.length) } : s));
  return (
    <section className="in-hero" ref={ref}>
      <div className="lh-glow" />
      <div className="in-hero-c">
        <div className="in-kick">
          <span className="lh-live">
            <i />
          </span>
          {tx.kick} · {CONNECTORS.length}
        </div>
        <h1 className="in-h1">
          {tx.h1a}
          <br />
          <em>{tx.h1b}</em>
        </h1>
        <p className="in-sub">{tx.sub}</p>
        <div className="lh-cta in-cta">
          <a className="lh-btn lg" href="#catalog">
            {tx.cta1}
            <Icon name="arrow" size={15} stroke={2} />
          </a>
          <Link className="lh-btn gh lg" to="/contact">
            {tx.cta2}
          </Link>
        </div>
      </div>
      <div className="in-stats">
        {stats.map((s, i) => (
          <CountStat key={i} v={s.v} l={s.l} i={i} on={on} />
        ))}
      </div>
    </section>
  );
}

/* ─── живая схема: подключения вокруг CRM ─── */
function Hub({ tx, active }: { tx: IntText; active: CatKey | null }) {
  const nodes = HUB_IDS.map((id) => CONNECTORS.find((c) => c.id === id)!).filter(Boolean);
  const R = 150;
  const C = 200;
  const pos = nodes.map((_, k) => {
    const a = -Math.PI / 2 + k * ((2 * Math.PI) / nodes.length);
    return [C + R * Math.cos(a), C + R * Math.sin(a)];
  });
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref, 0.2);
  const [hot, setHot] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setHot((h) => (h + 1) % nodes.length), 1400);
    return () => clearInterval(t);
  }, [on, nodes.length]);
  return (
    <div className="in-hub" ref={ref}>
      <div className="in-hub-h">
        <span className="lh-k sm">{tx.hub.h}</span>
        <span className="lh-on">
          <i />
          {tx.hub.sync}
        </span>
      </div>
      <div className="in-hub-v">
        <svg viewBox="0 0 400 400" aria-hidden>
          <g className="in-orb">
            <circle cx={C} cy={C} r={R} className="in-orbit" />
          </g>
          {[60, 92, 124].map((r, i) => (
            <circle key={r} cx={C} cy={C} r={r} className="in-ring" style={{ animationDelay: i * 0.9 + 's' }} />
          ))}
          {pos.map(([x, y], k) => (
            <path key={'l' + k} id={'inL' + k} d={`M${x},${y} L${C},${C}`} className={'in-wire' + (k === hot ? ' hot' : '')} />
          ))}
          {pos.map((_, k) => (
            <g key={'p' + k}>
              <circle r="3.5" fill="#111113">
                <animateMotion dur="1.8s" begin={k * 0.23 + 's'} repeatCount="indefinite">
                  <mpath href={'#inL' + k} />
                </animateMotion>
              </circle>
              <circle r="3" fill="#fff" stroke="#3f7d12" strokeWidth="1.5">
                <animateMotion dur="2.4s" begin={k * 0.31 + 0.6 + 's'} repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                  <mpath href={'#inL' + k} />
                </animateMotion>
              </circle>
            </g>
          ))}
          <circle cx={C} cy={C} r="40" fill="#111113" />
          <path d={`M${C} ${C - 13}l3.6 9.4 9.4 3.6-9.4 3.6-3.6 9.4-3.6-9.4-9.4-3.6 9.4-3.6z`} fill="#c8f560" />
        </svg>
        {nodes.map((c, k) => (
          <div key={c.id} className={'in-node' + (k === hot ? ' hot' : '') + (active && c.cat !== active ? ' dim' : '')} style={{ left: pos[k][0] / 4 + '%', top: pos[k][1] / 4 + '%' }}>
            <Logo c={c} size={44} />
            <span>{c.name}</span>
          </div>
        ))}
      </div>
      <div className="in-hub-f">
        <em>{tx.hub.note}</em>
        <div className="in-hub-log">
          <span key={hot} className="lh-doing-t">
            <i />
            {nodes[hot].name} → CRM · {tx.hub.events[hot % tx.hub.events.length]}
          </span>
        </div>
      </div>
    </div>
  );
}

function Catalog({ tx, lang }: { tx: IntText; lang: Lang }) {
  const [cat, setCat] = useState<CatKey | null>(null);
  const [q, setQ] = useState('');
  const segRef = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState({ l: 0, t: 0, w: 0, h: 0 });
  useLayoutEffect(() => {
    const box = segRef.current;
    if (!box) return;
    const m = () => {
      const el = box.querySelector<HTMLElement>('button.on');
      if (el) setInd({ l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
    };
    m();
    const ro = new ResizeObserver(m);
    ro.observe(box);
    return () => ro.disconnect();
  }, [cat, lang]);
  const ql = q.trim().toLowerCase();
  const list = CONNECTORS.filter((c) => (!cat || c.cat === cat) && (!ql || c.name.toLowerCase().includes(ql) || c.d[lang].toLowerCase().includes(ql)));
  const count = (k: CatKey) => CONNECTORS.filter((c) => c.cat === k).length;
  return (
    <section className="lp-sec in-cat" id="catalog">
      <div className="in-cat-bar lh-rv">
        <div className="in-chips" ref={segRef}>
          <span className="in-chips-ind" style={{ transform: `translate(${ind.l}px,${ind.t}px)`, width: ind.w, height: ind.h }} />
          <button type="button" className={!cat ? 'on' : ''} onClick={() => setCat(null)}>
            {tx.all}
            <em>{CONNECTORS.length}</em>
          </button>
          {CATS.map((k) => (
            <button type="button" key={k} className={cat === k ? 'on' : ''} onClick={() => setCat(cat === k ? null : k)}>
              {tx.cats[k]}
              <em>{count(k)}</em>
            </button>
          ))}
        </div>
        <label className="in-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx.search} aria-label={tx.search} />
        </label>
      </div>
      <p className="in-legend lh-rv">{tx.legend}</p>
      <div className="in-cat-g">
        <div className="in-tiles" key={(cat || 'all') + ql}>
          {list.map((c, i) => (
            <div key={c.id} className="in-tile" style={{ animationDelay: Math.min(i, 20) * 0.02 + 's' }}>
              <Logo c={c} />
              <span className={'in-tile-st ' + c.status}>{tx.st[c.status]}</span>
              <b>{c.name}</b>
              <span>{c.d[lang]}</span>
              {c.caps.length > 0 && (
                <div className="in-caps">
                  {c.caps.map((cp) => (
                    <i key={cp}>{tx.caps[cp]}</i>
                  ))}
                </div>
              )}
            </div>
          ))}
          {!list.length && (
            <div className="in-empty">
              {tx.empty} <Link to="/contact">{tx.emptyLink}</Link>.
            </div>
          )}
        </div>
        <div className="in-cat-side lh-rv">
          <Hub tx={tx} active={cat} />
        </div>
      </div>
    </section>
  );
}

function How({ tx }: { tx: IntText }) {
  const ref = useRef<HTMLElement>(null);
  const on = useSeenOnce(ref, 0.3);
  const [s, setS] = useState(-1);
  useEffect(() => {
    if (!on) return;
    let k = 0;
    const t = setInterval(() => {
      setS(k++);
      if (k > 3) clearInterval(t);
    }, 450);
    return () => clearInterval(t);
  }, [on]);
  return (
    <section className="lp-sec" ref={ref}>
      <Head k={tx.how.k} t={tx.how.t} />
      <div className="in-how">
        <div className="in-how-line">
          <span style={{ width: (Math.max(0, s) / 3) * 100 + '%' }} />
        </div>
        {tx.how.items.map(([t, d, ic], i) => (
          <div key={t} className={'in-step' + (i <= s ? ' on' : '')}>
            <div className="in-step-h">
              <span className="in-step-ic">
                <Icon name={ic === 'eye' ? 'target' : ic === 'zap' ? 'bolt' : ic} size={18} />
              </span>
              <span className="in-step-n">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <b>{t}</b>
            <p>{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function IntegrationsPage() {
  const { i18n } = useTranslation();
  const code = (i18n.language || 'ru').slice(0, 2);
  const lang: Lang = code === 'en' || code === 'tr' ? code : 'ru';
  const tx = INT_T[lang];
  return (
    <SolutionShell activeKey="integrations">
      <Hero tx={tx} />
      <Catalog tx={tx} lang={lang} />
      <CardsSection {...tx.what} />
      <How tx={tx} />
      <CardsSection {...tx.api} />
      <FaqSection {...tx.faq} />
      <CtaBox k={tx.cta.k} t={tx.cta.t} demo={tx.cta.b1} tryFree={tx.cta.b2} />
    </SolutionShell>
  );
}
