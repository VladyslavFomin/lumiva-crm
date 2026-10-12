// «Решения → Продажи» — дизайн Claude Design solutions-sales-v2.html (lp-solutions.jsx + lp-kit.jsx).
// Выдуманные метрики макета (+27% сделок, точность прогноза, вероятностная модель) заменены реальными
// возможностями: мультисайт, каналы, одобрение/отклонение продаж, отслеживание. Тексты — salesSolutionText.ts.
import React, { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../landing/LandingSections';
import { SALES_T, SITES, type SalesText } from './salesSolutionText';
import {
  AiSection, BarsCard, CardsSection, CompareSection, CtaBox, FaqSection, ModRow, Problem, SolutionHero, SolutionShell, StepsSection, useInView, useTick,
} from './solutionKit';

/* ─── визуал: заявки с нескольких сайтов в одну базу ─── */
function SitesVis({ tx }: { tx: SalesText }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref);
  const tick = useTick(on, 1700);
  const v = tx.sites.vis;
  const L = v.leads;
  const shown = Array.from({ length: 4 }, (_, j) => L[(((tick - j) % L.length) + L.length) % L.length]);
  const cur = shown[0];
  const counts = useMemo(() => {
    const c = [18, 11, 7];
    for (let j = 0; j < tick; j++) c[L[j % L.length].site] += 1;
    return c;
  }, [tick, L]);
  return (
    <div className="fv" ref={ref}>
      <div className="fv-h">
        <span>{v.h}</span>
        <b>{SITES.length + 1}</b>
      </div>
      <div className="sv-sites">
        {SITES.map((s, i) => (
          <div key={s} className={'sv-site' + (cur.site === i ? ' on' : '')}>
            <b>{s}</b>
            <em>
              <i />
              {counts[i]}
            </em>
          </div>
        ))}
      </div>
      <div className="sv-sites" style={{ marginTop: 8, gridTemplateColumns: '1fr' }}>
        <div className="sv-site off">
          <b>old-landing.example.com</b>
          <em>
            <i />
            {v.off}
          </em>
        </div>
      </div>
      <div className="sv-arrow">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 4v16M6 14l6 6 6-6" />
        </svg>
      </div>
      <div className="sv-inbox">
        <div className="sv-inbox-h">
          <span>{v.inbox}</span>
          <span>Lumiva CRM</span>
        </div>
        {shown.map((l, j) => (
          <div key={tick - j} className={'sv-lead' + (j === 0 ? ' new' : '')}>
            <b>{l.n}</b>
            <time>{j === 0 ? v.now : `${j * 3} ${v.min}`}</time>
            <small>
              <span className="s">{SITES[l.site]}</span>
              <span>{l.src}</span>
              <span>{l.utm}</span>
            </small>
          </div>
        ))}
      </div>
      <div className="fv-demo">{tx.demoNote}</div>
    </div>
  );
}

/* ─── визуал: путь продажи, решение и журнал ─── */
type St = 'new' | 'pending' | 'confirmed' | 'cancelled' | 'refunded';
function ApprVis({ tx }: { tx: SalesText }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref);
  const tick = useTick(on, 1300);
  const v = tx.appr.vis;
  const STEPS = 7;
  const loop = Math.floor(tick / STEPS);
  const ph = tick % STEPS; // 0 new, 1 pending, 2 decision, 3..4 follow-ups, 5..6 hold
  const ok = loop % 2 === 0;
  const final: St = ok ? 'confirmed' : 'cancelled';
  const cur: St = ph === 0 ? 'new' : ph === 1 ? 'pending' : final;
  const path: St[] = ['new', 'pending', final];
  const idx = path.indexOf(cur);
  const log: Array<{ t: string; ic: string; who?: string; txt: string }> = [{ t: '13:58', ic: 'grid', txt: v.log.created }];
  if (ph >= 1) log.push({ t: '14:01', ic: 'clock', txt: v.log.pending });
  if (ph >= 2) log.push({ t: '14:02', ic: 'check', who: v.by, txt: ok ? v.log.confirmed : v.log.cancelled });
  if (ph >= 3) log.push({ t: '14:02', ic: 'bolt', txt: ok ? v.auto : v.mail });
  if (ph >= 4) log.push({ t: '14:02', ic: 'box', txt: v.woo });
  return (
    <div className="fv" ref={ref}>
      <div className="sv-sale">
        <div className="sv-sale-h">
          <b>{v.deal}</b>
          <strong>{v.amount}</strong>
        </div>
        <div className="sv-sale-m">
          {v.meta.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
        <div className="sv-path">
          {path.map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M9 6l6 6-6 6" />
                </svg>
              )}
              <span className={'sv-st ' + s + (i < idx ? ' done' : '') + (i === idx ? ' cur' : '')}>{v.st[s]}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="sv-log">
        {log.map((r, i) => (
          <div key={loop + '-' + i}>
            <time>{r.t}</time>
            <i>
              <Icon name={r.ic} size={12} />
            </i>
            <span>
              {r.who && <b>{r.who} · </b>}
              {r.txt}
            </span>
          </div>
        ))}
      </div>
      <div className="fv-demo">{tx.demoNote}</div>
    </div>
  );
}


export default function SalesSolutionsPage() {
  const { i18n, t } = useTranslation();
  const code = (i18n.language || 'ru').slice(0, 2);
  const tx = SALES_T[code === 'en' || code === 'tr' ? code : 'ru'];
  const m = tx.pair.mgr;
  const c = tx.pair.ch;
  return (
    <SolutionShell activeKey="sales">
      <SolutionHero
        crumbs={tx.crumbs}
        kicker={tx.kicker}
        t1={tx.t1}
        t2={tx.t2}
        sub={tx.sub}
        tryFree={tx.tryFree}
        demo={tx.demo}
        demoNote={tx.demoNote}
        url="crm.lumiva.agency/sales"
        tplIndex={0}
        dashTitle={t('crm.aura.tpl.sales.name')}
        stats={tx.stats}
      />
      <Problem {...tx.prob} />
      <ModRow k={tx.sites.k} t={tx.sites.t} lede={tx.sites.lede} items={tx.sites.items}>
        <SitesVis tx={tx} />
      </ModRow>
      <CardsSection {...tx.channels} />
      <div style={{ marginTop: 30 }}>
        <ModRow rev k={tx.appr.k} t={tx.appr.t} lede={tx.appr.lede} items={tx.appr.items}>
          <ApprVis tx={tx} />
        </ModRow>
      </div>
      <CardsSection {...tx.track} />
      <section className="lp-sec">
        <div className="lp-pair">
          <div className="lh-rv">
            <BarsCard
              title={m.title}
              legend={[{ c: '#111113', l: m.won }, { c: '#9fdc3c', l: m.rep }, { c: '#e04848', l: m.lost }]}
              rows={m.rows.map(([n, w, l, r]) => ({ n, segs: [w, r, l], meta: `${l} ${m.lost} · ${r} ${m.rep}`, val: String(w) }))}
            />
          </div>
          <div className="lh-rv" style={{ transitionDelay: '.1s' }}>
            <BarsCard
              title={c.title}
              legend={[{ c: '#111113', l: c.ok }, { c: '#e04848', l: c.cancel }, { c: '#7457f2', l: c.refund }]}
              rows={c.rows.map(([n, ok, can, ref]) => ({ n, segs: [ok, can, ref], max: 100, meta: `${can}% ${c.cancel} · ${ref}% ${c.refund}`, val: ok + '%' }))}
            />
          </div>
        </div>
      </section>
      <StepsSection {...tx.steps} />
      <CompareSection {...tx.compare} />
      <AiSection role="sales_manager" {...tx.ai} />
      <FaqSection {...tx.faq} />
      <CtaBox k={tx.cta.k} t={tx.cta.t} demo={tx.demo} tryFree={tx.tryFree} />
    </SolutionShell>
  );
}
