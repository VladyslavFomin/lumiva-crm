// «Решения → Маркетинг» — дизайн Claude Design solutions-marketing-v2.html (lp-solutions.jsx + lp-kit.jsx).
// Выдуманные цифры макета (4.6x ROAS, 97% охват атрибуции, модели атрибуции) заменены реальными возможностями:
// кабинеты и трафик, UTM до продажи, ROI по клиентам, SEO/соцсети/отзывы/рассылки. Тексты — marketingSolutionText.ts.
import React, { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../landing/LandingSections';
import { MARKETING_T, type MarketingText } from './marketingSolutionText';
import {
  AiSection, BarsCard, CardsSection, CompareSection, CtaBox, DemoNote, FaqSection, ModRow, Problem, SolutionHero, SolutionShell, StepsSection, useInView, useSeenOnce, useTick,
} from './solutionKit';

const CH = [
  { n: 'Google Ads', c: '#4285f4', impr: 182400, clicks: 6120, leads: 148, spend: 2480, camps: ['Search · Brand', 'Search · Services'] },
  { n: 'Meta Ads', c: '#0866ff', impr: 264800, clicks: 4980, leads: 132, spend: 1920, camps: ['Instagram · Reels', 'Facebook · Leads form'] },
  { n: 'Yandex Direct', c: '#fc3f1d', impr: 98300, clicks: 2210, leads: 71, spend: 1150, camps: ['Поиск · Москва', 'РСЯ · Ретаргетинг'] },
  { n: 'VK Ads', c: '#0077ff', impr: 71200, clicks: 1340, leads: 39, spend: 640, camps: ['Лента · Промо', 'Клипы · Охват'] },
];
const CURS: Array<{ code: string; sym: string; rate: number }> = [
  { code: 'EUR', sym: '€', rate: 1 },
  { code: 'TRY', sym: '₺', rate: 37 },
  { code: 'RUB', sym: '₽', rate: 95 },
];

function compact(n: number, loc: string) {
  return n.toLocaleString(loc, { notation: n >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 });
}

/* ─── визуал: кабинеты и трафик в одной валюте ─── */
function AdsVis({ tx, loc }: { tx: MarketingText; loc: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref);
  const tick = useTick(on, 1800);
  const cur = CURS[Math.floor(tick / 4) % CURS.length];
  const open = tick % CH.length;
  const v = tx.ads.vis;
  const money = (eur: number) => cur.sym + compact(Math.round(eur * cur.rate), loc);
  return (
    <div className="fv" ref={ref}>
      <div className="fv-h">
        <span>{v.h}</span>
        <span className="mk-cur" aria-label={v.cur}>
          {CURS.map((c) => (
            <span key={c.code} className={c.code === cur.code ? 'on' : ''}>
              {c.code}
            </span>
          ))}
        </span>
      </div>
      <div className="mk-tbl">
        <div className="mk-row">
          <span />
          {v.cols.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        {CH.map((r, i) => (
          <React.Fragment key={r.n}>
            <div className={'mk-row' + (i === open ? ' on' : '')}>
              <span>
                <b>
                  <i style={{ background: r.c }} />
                  {r.n}
                </b>
              </span>
              <span>{compact(r.impr, loc)}</span>
              <span>{compact(r.clicks, loc)}</span>
              <span>{r.leads}</span>
              <span>
                <span key={cur.code} className="mk-v">
                  {money(r.spend)}
                </span>
              </span>
            </div>
            {i === open &&
              r.camps.map((c, j) => (
                <div key={c} className="mk-camp" style={{ animationDelay: j * 0.06 + 's' }}>
                  <span>{c}</span>
                  <span>{compact(Math.round(r.impr * (j ? 0.38 : 0.62)), loc)}</span>
                  <span>{compact(Math.round(r.clicks * (j ? 0.4 : 0.6)), loc)}</span>
                  <span>{Math.round(r.leads * (j ? 0.35 : 0.65))}</span>
                  <span>{money(Math.round(r.spend * (j ? 0.42 : 0.58)))}</span>
                </div>
              ))}
          </React.Fragment>
        ))}
      </div>
      <div className="fv-h" style={{ marginTop: 12, marginBottom: 0 }}>
        <span>
          <span className="lh-live" style={{ display: 'inline-flex', marginRight: 6 }}>
            <i />
          </span>
          {v.synced}
        </span>
        <span>{CH.reduce((a, r) => a + r.leads, 0)} {tx.pair.ch.leads}</span>
      </div>
      <DemoNote>{tx.demoNote}</DemoNote>
    </div>
  );
}

/* ─── визуал: UTM-ссылка → лид → продажа ─── */
const UTM_FIELDS: Array<[string, string]> = [
  ['utm_source', 'google'],
  ['utm_medium', 'cpc'],
  ['utm_campaign', 'autumn_sale'],
];
function UtmVis({ tx }: { tx: MarketingText }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref);
  const tick = useTick(on, 90);
  const total = UTM_FIELDS.reduce((a, [, v]) => a + v.length, 0);
  const CYCLE = total + 70;
  const t = tick % CYCLE;
  let left = t;
  const typed = UTM_FIELDS.map(([, val]) => {
    const n = Math.max(0, Math.min(val.length, left));
    left -= val.length;
    return val.slice(0, n);
  });
  const done = t >= total;
  const showLead = t >= total + 14;
  const showSale = t >= total + 30;
  const v = tx.utm.vis;
  return (
    <div className="fv" ref={ref}>
      <div className="fv-h">
        <span>{v.builder}</span>
        {done && <b>{v.link}</b>}
      </div>
      <div className="mk-utm">
        {UTM_FIELDS.map(([k], i) => (
          <div key={k} className="mk-utm-f">
            <code>{k}</code>
            <span>
              {typed[i]}
              {!done && typed[i].length < UTM_FIELDS[i][1].length && (i === 0 || typed[i - 1].length === UTM_FIELDS[i - 1][1].length) && <i className="lh-caret" />}
            </span>
          </div>
        ))}
        {done && <div className="mk-link">shop.example.com/autumn?utm_source=google&amp;utm_medium=cpc&amp;utm_campaign=autumn_sale</div>}
      </div>
      <div className="mk-flow">
        {showLead && (
          <div className="mk-node">
            <i>
              <Icon name="user" size={14} />
            </i>
            <span>
              <b>
                {v.lead} · {v.leadName}
              </b>
              <em>
                <span>shop.example.com</span>
                <span>google / cpc</span>
                <span>autumn_sale</span>
              </em>
            </span>
          </div>
        )}
        {showSale && (
          <div className="mk-node ok">
            <i>
              <Icon name="check" size={14} stroke={2.4} />
            </i>
            <span>
              <b>
                {v.sale} · {v.saleTxt}
              </b>
              <em>
                <span>autumn_sale</span>
                <span>128 {v.clicks}</span>
              </em>
            </span>
          </div>
        )}
      </div>
      <DemoNote>{tx.demoNote}</DemoNote>
    </div>
  );
}

/* ─── визуал: ROI по клиентам ─── */
function RoiVis({ tx, loc }: { tx: MarketingText; loc: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeenOnce(ref);
  const v = tx.roi.vis;
  const rows: Array<[number, number, number]> = [
    [1800, 9400, 12],
    [2600, 11800, 8],
    [1200, 3100, -6],
    [900, 780, -14],
  ];
  const mx = Math.max(...rows.map((r) => Math.max(r[0], r[1])));
  const eur = (n: number) => '€' + n.toLocaleString(loc);
  return (
    <div className="fv" ref={ref}>
      <div className="fv-h">
        <span>{v.h}</span>
        <span className="lp-legend" style={{ marginTop: 0 }}>
          <span>
            <i style={{ background: '#e04848' }} />
            {v.spend}
          </span>
          <span>
            <i style={{ background: '#111113' }} />
            {v.rev}
          </span>
        </span>
      </div>
      <div className="mk-roi">
        {rows.map(([sp, rv, d], i) => {
          const roi = rv / sp;
          return (
            <div key={i} className="mk-roi-r">
              <b>{v.clients[i]}</b>
              <strong className={roi < 1 ? 'lo' : ''}>{roi.toLocaleString(loc, { maximumFractionDigits: 1 })}×</strong>
              <div className="mk-roi-bars">
                <div>
                  <i style={{ width: seen ? (rv / mx) * 100 + '%' : 0, background: '#111113', transitionDelay: i * 0.1 + 's' }} />
                </div>
                <div>
                  <i style={{ width: seen ? (sp / mx) * 100 + '%' : 0, background: '#e04848', transitionDelay: i * 0.1 + 0.1 + 's' }} />
                </div>
              </div>
              <div className="mk-roi-m">
                <span>
                  {v.rev} {eur(rv)}
                </span>
                <span>
                  {v.spend} {eur(sp)}
                </span>
                <span className={d >= 0 ? 'up' : 'down'}>
                  {d >= 0 ? '+' : '−'}
                  {Math.abs(d)}% {v.prev}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <DemoNote>{tx.demoNote}</DemoNote>
    </div>
  );
}

export default function MarketingPage() {
  const { i18n, t } = useTranslation();
  const code = (i18n.language || 'ru').slice(0, 2);
  const lang = code === 'en' || code === 'tr' ? code : 'ru';
  const tx = MARKETING_T[lang];
  const loc = lang === 'en' ? 'en-US' : lang === 'tr' ? 'tr-TR' : 'ru-RU';
  const ch = tx.pair.ch;
  const seo = tx.pair.seo;
  const seoRows = useMemo(
    () =>
      seo.pages.map((p, i) => {
        const clicks = [1240, 860, 610, 380][i];
        const impr = [18400, 14100, 12600, 7300][i];
        return { n: p, segs: [clicks], max: 1240, meta: `${impr.toLocaleString(loc)} ${seo.impr}`, val: clicks.toLocaleString(loc) };
      }),
    [seo, loc],
  );
  return (
    <SolutionShell activeKey="marketing">
      <SolutionHero
        crumbs={tx.crumbs}
        kicker={tx.kicker}
        t1={tx.t1}
        t2={tx.t2}
        sub={tx.sub}
        tryFree={tx.tryFree}
        demo={tx.demo}
        demoNote={tx.demoNote}
        url="crm.lumiva.agency/marketing/traffic"
        tplIndex={1}
        dashTitle={t('crm.aura.tpl.leads.name')}
        stats={tx.stats}
      />
      <Problem {...tx.prob} />
      <ModRow k={tx.ads.k} t={tx.ads.t} lede={tx.ads.lede} items={tx.ads.items}>
        <AdsVis tx={tx} loc={loc} />
      </ModRow>
      <CardsSection {...tx.sources} />
      <div style={{ marginTop: 30 }}>
        <ModRow rev k={tx.utm.k} t={tx.utm.t} lede={tx.utm.lede} items={tx.utm.items}>
          <UtmVis tx={tx} />
        </ModRow>
      </div>
      <ModRow k={tx.roi.k} t={tx.roi.t} lede={tx.roi.lede} items={tx.roi.items}>
        <RoiVis tx={tx} loc={loc} />
      </ModRow>
      <CardsSection {...tx.grow} />
      <section className="lp-sec">
        <div className="lp-pair">
          <div className="lh-rv">
            <BarsCard
              title={ch.title}
              legend={CH.map((r) => ({ c: r.c, l: r.n }))}
              rows={CH.map((r, i) => ({
                n: r.n,
                segs: CH.map((_, j) => (j === i ? r.spend : 0)),
                max: 2480,
                meta: `${r.leads} ${ch.leads} · €${(r.spend / r.leads).toLocaleString(loc, { maximumFractionDigits: 1 })} ${ch.cpl}`,
                val: '€' + r.spend.toLocaleString(loc),
              }))}
            />
          </div>
          <div className="lh-rv" style={{ transitionDelay: '.1s' }}>
            <BarsCard title={seo.title} legend={[{ c: '#3f7d12', l: seo.clicks }]} rows={seoRows} />
          </div>
        </div>
      </section>
      <StepsSection {...tx.steps} />
      <CompareSection {...tx.compare} />
      <AiSection role="marketing_analyst" {...tx.ai} />
      <FaqSection {...tx.faq} />
      <CtaBox k={tx.cta.k} t={tx.cta.t} demo={tx.demo} tryFree={tx.tryFree} />
    </SolutionShell>
  );
}
