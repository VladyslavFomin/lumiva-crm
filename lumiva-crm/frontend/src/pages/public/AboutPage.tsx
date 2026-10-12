// «О нас» — дизайн Claude Design about-v2.html (lh-pages.jsx AboutPage, lh-pages.css).
// Цифры, история и стек — из проверенных текстов (aboutText.ts); выдуманное в макете (500+ клиентов, 99.9% uptime,
// хранение в РФ, Kubernetes, бэкап каждые 6 часов, «ответ за час») заменено реальными фактами.
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../landing/LandingSections';
import { AiCharacter, AI_ROLE_PALETTE } from '../ai-employees/AiCharacter';
import { ABOUT_T, type AboutText } from './aboutText';
import { CardsSection, Head, SolutionShell, useSeenOnce } from './solutionKit';

function Count({ v, on, i }: { v: string; on: boolean; i: number }) {
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
  return <>{Number.isFinite(to) ? Math.round(x) : v}</>;
}

function Hero({ tx }: { tx: AboutText }) {
  const ref = useRef<HTMLElement>(null);
  const on = useSeenOnce(ref, 0.1);
  const navigate = useNavigate();
  return (
    <section className="in-hero pg-hero" ref={ref}>
      <div className="lh-glow" />
      <div className="in-hero-c">
        <div className="in-kick">
          <span className="lh-live">
            <i />
          </span>
          {tx.kick}
        </div>
        <h1 className="in-h1">
          {tx.t1}
          <br />
          <em>{tx.t2}</em>
        </h1>
        <p className="in-sub">{tx.sub}</p>
        <div className="lh-cta in-cta">
          <button type="button" className="lh-btn lg" onClick={() => navigate('/?mode=signup')}>
            {tx.cta1}
            <Icon name="arrow" size={15} stroke={2} />
          </button>
          <Link className="lh-btn gh lg" to="/contact">
            {tx.cta2}
          </Link>
        </div>
      </div>
      <div className="in-stats">
        {tx.stats.map((s, i) => (
          <div key={s.l} className="in-stat" style={{ animationDelay: 0.25 + i * 0.08 + 's' }}>
            <b>
              <Count v={s.v} on={on} i={i} />
            </b>
            <span>{s.l}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* история: линия «заполняется» по мере прокрутки */
function Timeline({ tx }: { tx: AboutText }) {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const f = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setP(Math.min(1, Math.max(0, (window.innerHeight * 0.65 - r.top) / r.height)));
    };
    f();
    window.addEventListener('scroll', f, { passive: true });
    window.addEventListener('resize', f);
    return () => {
      window.removeEventListener('scroll', f);
      window.removeEventListener('resize', f);
    };
  }, []);
  const n = tx.history.length;
  return (
    <div className="ab-tl" ref={ref}>
      <div className="ab-tl-line">
        <span style={{ height: p * 100 + '%' }} />
      </div>
      {tx.history.map(([y, t], i) => {
        const on = p >= i / (n - 1) - 0.02;
        return (
          <div key={y} className={'ab-tl-i' + (on ? ' on' : '')}>
            <span className="ab-tl-y">{y}</span>
            <div className="ab-tl-c">
              <p>{t}</p>
              {i === n - 1 && (
                <span className="ab-tl-now">
                  <span className="lh-live">
                    <i />
                  </span>
                  {tx.now}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AboutPage() {
  const { i18n } = useTranslation();
  const code = (i18n.language || 'ru').slice(0, 2);
  const tx = ABOUT_T[code === 'en' || code === 'tr' ? code : 'ru'];
  const pal = AI_ROLE_PALETTE.lead_manager;
  return (
    <SolutionShell activeKey="about">
      <Hero tx={tx} />

      <section className="lp-sec">
        <div className="ab-mission lh-rv">
          <div className="ab-mission-g" />
          <div className="lh-k">{tx.missionK}</div>
          <blockquote>{tx.mission}</blockquote>
          <div className="ab-mission-a">
            <span className="lh-fl-av sm" style={{ background: pal.bg, position: 'relative', overflow: 'hidden' }}>
              <AiCharacter role="lead_manager" mood="on" />
            </span>
            <span>{tx.missionA}</span>
          </div>
        </div>
      </section>

      <section className="lp-sec">
        <Head k={tx.valuesK} t={tx.valuesT} />
        <div className="ab-vals">
          {tx.values.map(([t, d, ic], i) => (
            <div key={t} className="ab-val lh-rv" style={{ transitionDelay: i * 0.07 + 's' }}>
              <span className="ab-val-ic">
                <Icon name={ic} size={20} />
              </span>
              <b>{t}</b>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <CardsSection {...tx.today} />

      <section className="lp-sec">
        <Head k={tx.histK} t={tx.histT} />
        <Timeline tx={tx} />
      </section>

      <CardsSection {...tx.data} />

      <section className="lp-sec">
        <div className="ab-tech lh-rv">
          <div>
            <div className="lh-k">{tx.techK}</div>
            <h2>{tx.techT}</h2>
            <p>{tx.techD}</p>
          </div>
          <div className="ab-tech-g">
            {tx.tech.map(([l, s]) => (
              <div key={l}>
                <b>
                  <i />
                  {l}
                </b>
                <p>{s}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-sec">
        <div className="lp-ctab lh-rv">
          <div className="lh-glow b" />
          <div>
            <div className="lp-kick">
              <span className="lp-dot" />
              {tx.cta.k}
            </div>
            <h2>{tx.cta.t}</h2>
          </div>
          <div className="lp-ctab-a">
            <Link className="lh-btn lg" to="/contact">
              {tx.cta.demo}
              <Icon name="arrow" size={15} stroke={2} />
            </Link>
            <Link className="lh-btn gh lg" to="/features">
              {tx.cta.features}
            </Link>
          </div>
        </div>
      </section>
    </SolutionShell>
  );
}
