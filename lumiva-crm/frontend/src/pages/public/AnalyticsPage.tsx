// «Решения → Аналитика» — дизайн Claude Design solutions-analytics-v2.html (lp-solutions.jsx + lp-kit.jsx).
// Выдуманные цифры макета («80+ виджетов», «10 минут на дашборд», «0 выгрузок») заменены реальными возможностями:
// конструктор блоков, аналитика модулей, Aura, регулярные отчёты, точность цифр. Тексты — analyticsSolutionText.ts.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../landing/LandingSections';
import { landingDemoData, type LandingDemoText } from '../landing/landingDemo';
import { AuraDash, AuScaled } from '../aura/AuraDash';
import { AU_TEMPLATES } from '../aura/auraModel';
import { ANALYTICS_T, type AnalyticsText } from './analyticsSolutionText';
import {
  AiSection, BarsCard, CardsSection, CompareSection, CtaBox, DemoNote, FaqSection, ModRow, Problem, SolutionHero, SolutionShell, StepsSection, useInView, useTick,
} from './solutionKit';

/* ─── визуал: конструктор блоков с вкладками и растягиванием ─── */
const SPARK = 'M0,20 L12,16 L24,18 L36,10 L48,13 L60,6 L72,9 L84,3 L100,5';
function BuilderVis({ tx }: { tx: AnalyticsText }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref);
  const tick = useTick(on, 900);
  const v = tx.builder.vis;
  const CYCLE = 12;
  const t = tick % CYCLE;
  const added = Math.min(t, 5);
  const resized = t >= 7;
  const blocks: Array<{ k: number; span: number; rows: number; body: React.ReactNode }> = [
    { k: 0, span: 2, rows: 1, body: <strong>412</strong> },
    { k: 1, span: 4, rows: 1, body: <svg viewBox="0 0 100 24" preserveAspectRatio="none"><path d={SPARK} fill="none" stroke="#111113" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg> },
    { k: 2, span: resized ? 4 : 3, rows: 2, body: <div className="an-bars">{[100, 72, 40, 16].map((w) => <i key={w} style={{ width: w + '%' }} />)}</div> },
    { k: 3, span: resized ? 2 : 3, rows: 2, body: <div className="an-bars">{[90, 70, 55, 38].map((w) => <i key={w} style={{ width: w + '%', background: '#9fdc3c' }} />)}</div> },
    { k: 5, span: 6, rows: 1, body: <strong>= 27,6%</strong> },
  ];
  return (
    <div className="fv" ref={ref}>
      <div className="an-tabs">
        {v.tabs.map((x, i) => (
          <span key={x} className={i === (t >= 10 ? 1 : 0) ? 'on' : ''}>
            {x}
          </span>
        ))}
        <span className="add">+ {v.addTab}</span>
      </div>
      <div className="an-wrap">
        <div className="an-lib">
          <b>{v.lib}</b>
          {v.blocks.map((b, i) => (
            <span key={b} className={t > 0 && t <= 5 && i === [0, 1, 2, 3, 5][t - 1] ? 'on' : ''}>
              {b}
            </span>
          ))}
        </div>
        <div className="an-grid">
          {t < 10 &&
            blocks.slice(0, added).map((b, i) => (
              <div key={b.k} className={'an-blk' + (i === 2 && t >= 6 && t < 9 ? ' rs' : '')} style={{ gridColumn: `span ${b.span}`, gridRow: `span ${b.rows}` }}>
                <em>{v.blocks[b.k]}</em>
                {b.body}
              </div>
            ))}
          {t >= 10 && (
            <div className="an-blk" style={{ gridColumn: 'span 6', gridRow: 'span 3' }}>
              <em>{v.blocks[3]}</em>
              <div className="an-bars" style={{ top: 34 }}>
                {[94, 80, 66, 52, 40].map((w) => (
                  <i key={w} style={{ width: w + '%' }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="an-hint">↔ {v.resize}</div>
      <DemoNote>{tx.demoNote}</DemoNote>
    </div>
  );
}

/* ─── визуал: Aura собирает дашборд по запросу ─── */
const AURA_TPLS = [2, 0];
function AuraVis({ tx }: { tx: AnalyticsText }) {
  const { t, i18n } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const vis = useInView(ref);
  const demo = t('landing.v5.demo', { returnObjects: true }) as LandingDemoText;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => landingDemoData(demo), [i18n.language]);
  const prompts = tx.aura.vis.prompts;
  const stepsTx = tx.aura.vis.steps;
  const [st, setSt] = useState({ i: 0, ph: 'type' as 'type' | 'think' | 'build' | 'hold', c: 0, r: 0, s: 0 });
  const tpl = AU_TEMPLATES[AURA_TPLS[st.i]];
  const cur = prompts[st.i] || '';
  useEffect(() => {
    if (!vis) return;
    let tm: ReturnType<typeof setTimeout>;
    if (st.ph === 'type') tm = setTimeout(() => setSt((x) => (x.c >= cur.length ? { ...x, ph: 'think', s: 0 } : { ...x, c: x.c + 1 })), st.c >= cur.length ? 450 : 26);
    else if (st.ph === 'think') tm = setTimeout(() => setSt((x) => (x.s >= stepsTx.length - 1 ? { ...x, ph: 'build', r: 0 } : { ...x, s: x.s + 1 })), 380);
    else if (st.ph === 'build') tm = setTimeout(() => setSt((x) => (x.r >= tpl.widgets.length ? { ...x, ph: 'hold' } : { ...x, r: x.r + 1 })), 220);
    else tm = setTimeout(() => setSt((x) => ({ i: (x.i + 1) % AURA_TPLS.length, ph: 'type', c: 0, r: 0, s: 0 })), 3400);
    return () => clearTimeout(tm);
  }, [st, vis, cur.length, stepsTx.length, tpl.widgets.length]);
  return (
    <div className="fv an-aura" ref={ref}>
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
      <DemoNote>{tx.demoNote}</DemoNote>
    </div>
  );
}

/* ─── визуал: регулярный отчёт падает во входящие ─── */
const ATT = [
  { n: 'PDF', c: '#e04848' },
  { n: 'XLSX', c: '#1f9d63' },
  { n: 'CSV', c: '#3a6ff0' },
];
function ReportVis({ tx }: { tx: AnalyticsText }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref);
  const tick = useTick(on, 2600);
  const v = tx.reports.vis;
  const k = tick % v.types.length;
  const prev = (k + v.types.length - 1) % v.types.length;
  return (
    <div className="fv" ref={ref}>
      <div className="fv-h">
        <span>{v.h}</span>
        <span className="lh-on">
          <i />
          ON
        </span>
      </div>
      <div className="rp-cfg">
        {[
          [v.type, v.types[k]],
          [v.freq, v.freqs[k]],
          [v.to, v.tos[k]],
        ].map(([l, val]) => (
          <div key={l} className="rp-row">
            <code>{l}</code>
            <span>
              <b key={val}>{val}</b>
            </span>
          </div>
        ))}
      </div>
      <div className="rp-inbox">
        <div className="rp-inbox-h">
          <span>{v.mail}</span>
          <span>Lumiva CRM</span>
        </div>
        <div key={tick} className="rp-mail new">
          <div className="rp-mail-h">
            <b>
              {v.subject} · {v.types[k]}
            </b>
            <time>{v.sent}</time>
          </div>
          <div className="rp-att">
            {ATT.map((a) => (
              <span key={a.n}>
                <i style={{ background: a.c }} />
                report.{a.n.toLowerCase()}
              </span>
            ))}
          </div>
        </div>
        {tick > 0 && (
          <div className="rp-mail old">
            <div className="rp-mail-h">
              <b>
                {v.subject} · {v.types[prev]}
              </b>
              <time>{v.freqs[prev].split(',')[0]}</time>
            </div>
          </div>
        )}
      </div>
      <DemoNote>{tx.demoNote}</DemoNote>
    </div>
  );
}

export default function AnalyticsPage() {
  const { i18n, t } = useTranslation();
  const code = (i18n.language || 'ru').slice(0, 2);
  const lang = code === 'en' || code === 'tr' ? code : 'ru';
  const tx = ANALYTICS_T[lang];
  const loc = lang === 'en' ? 'en-US' : lang === 'tr' ? 'tr-TR' : 'ru-RU';
  const src = tx.pair.src;
  const team = tx.pair.team;
  return (
    <SolutionShell activeKey="analytics">
      <SolutionHero
        crumbs={tx.crumbs}
        kicker={tx.kicker}
        t1={tx.t1}
        t2={tx.t2}
        sub={tx.sub}
        tryFree={tx.tryFree}
        demo={tx.demo}
        demoNote={tx.demoNote}
        url="crm.lumiva.agency/bi"
        tplIndex={2}
        dashTitle={t('crm.aura.tpl.tv.name')}
        stats={tx.stats}
      />
      <Problem {...tx.prob} />
      <ModRow k={tx.builder.k} t={tx.builder.t} lede={tx.builder.lede} items={tx.builder.items}>
        <BuilderVis tx={tx} />
      </ModRow>
      <CardsSection {...tx.modules} />
      <div style={{ marginTop: 30 }}>
        <ModRow rev k={tx.aura.k} t={tx.aura.t} lede={tx.aura.lede} items={tx.aura.items}>
          <AuraVis tx={tx} />
        </ModRow>
      </div>
      <ModRow k={tx.reports.k} t={tx.reports.t} lede={tx.reports.lede} items={tx.reports.items}>
        <ReportVis tx={tx} />
      </ModRow>
      <CardsSection {...tx.trust} />
      <section className="lp-sec">
        <div className="lp-pair">
          <div className="lh-rv">
            <BarsCard
              title={src.title}
              legend={[{ c: '#111113', l: src.leads }, { c: '#9fdc3c', l: src.won }]}
              rows={src.rows.map(([n, l, w]) => ({ n, segs: [l - w, w], max: 148, meta: `${w} ${src.won}`, val: l.toLocaleString(loc) }))}
            />
          </div>
          <div className="lh-rv" style={{ transitionDelay: '.1s' }}>
            <BarsCard
              title={team.title}
              legend={[{ c: '#3a6ff0', l: team.calls }, { c: '#111113', l: team.deals }]}
              rows={team.rows.map(([n, c, d]) => ({ n, segs: [c, d], max: 76, meta: `${d} ${team.deals}`, val: `${c} ${team.calls}` }))}
            />
          </div>
        </div>
      </section>
      <StepsSection {...tx.steps} />
      <CompareSection {...tx.compare} />
      <AiSection role="crm_analyst" {...tx.ai} />
      <FaqSection {...tx.faq} />
      <CtaBox k={tx.cta.k} t={tx.cta.t} demo={tx.demo} tryFree={tx.tryFree} />
    </SolutionShell>
  );
}
