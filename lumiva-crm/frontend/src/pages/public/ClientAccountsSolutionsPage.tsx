// «Решения → Счета клиентов» — дизайн Claude Design solutions-client-accounts-v2.html (lp-solutions.jsx + lp-kit.jsx).
// Модуль = связка CRM с личным кабинетом клиента на WordPress (backend modules/ccp). Из макета убрано то, чего нет:
// другие валюты, лимиты и холды, PDF-выписки и акты сверки, банковский API, связь со сделками, ИИ-ассистент по счетам.
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CLIENT_ACCOUNTS_T, type ClientAccountsText } from './clientAccountsSolutionText';
import {
  BarsCard, CardsSection, CompareSection, CtaBox, DemoNote, FaqSection, ModRow, Problem, SolutionHero, SolutionShell, StepsSection, useInView, useSeenOnce, useTick,
} from './solutionKit';

function money(n: number, cur: 'EUR' | 'USD', loc: string, sign = false) {
  const s = (cur === 'EUR' ? '€' : '$') + Math.abs(n).toLocaleString(loc);
  return sign ? (n < 0 ? '−' : '+') + s : s;
}

/* ─── hero: карточка счёта клиента ─── */
function HeroVis({ tx, loc }: { tx: ClientAccountsText; loc: string }) {
  const h = tx.hero;
  return (
    <div className="ca-hero">
      <div className="ca-head">
        <span>
          <b>{h.client}</b>
          <em>{h.acc}</em>
        </span>
        <span className="ca-sync">
          <i />
          {h.active}
        </span>
      </div>
      <div className="ca-bals">
        <div className="ca-bal">
          <em>{h.bal} · EUR</em>
          <strong>{money(48200, 'EUR', loc)}</strong>
          <code>IBAN LT12 3456 •••• 4521</code>
        </div>
        <div className="ca-bal">
          <em>{h.bal} · USD</em>
          <strong>{money(31750, 'USD', loc)}</strong>
          <code>IBAN LT98 7654 •••• 0193</code>
        </div>
      </div>
      <div className="ca-ops">
        <b>{h.ops}</b>
        {h.rows.map(([t, m, a, st]) => (
          <div key={t} className="ca-op">
            <span>
              <b>{t}</b>
              <em>{m}</em>
            </span>
            <span className={'ca-st ' + st}>{st === 'done' ? tx.card.vis.st.done : tx.card.vis.st.progress}</span>
            <strong className={a.startsWith('+') ? 'p' : ''}>{a}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── визуал: карточка клиента, статус операции меняется ─── */
function CardVis({ tx, loc }: { tx: ClientAccountsText; loc: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref);
  const tick = useTick(on, 1500);
  const v = tx.card.vis;
  const t = tick % 6;
  const st0 = t < 2 ? 'progress' : 'done';
  const eur = 48200 - (t >= 2 ? 1860 : 0);
  return (
    <div className="fv" ref={ref}>
      <div className="ca-head">
        <span>
          <b>{v.client}</b>
          <em>{v.email}</em>
        </span>
        <span className="ca-sync">
          <i />
          {tx.hero.active}
        </span>
      </div>
      <div className="ca-bals">
        <div className="ca-bal">
          <em>{tx.hero.bal} · EUR</em>
          <strong key={eur}>{money(eur, 'EUR', loc)}</strong>
          <code>LT12 3456 •••• 4521</code>
        </div>
        <div className="ca-bal">
          <em>{tx.hero.bal} · USD</em>
          <strong>{money(31750, 'USD', loc)}</strong>
          <code>LT98 7654 •••• 0193</code>
        </div>
      </div>
      <div className="ca-prof">
        {v.prof.map(([k, val]) => (
          <span key={k}>
            {k}: <b>{val}</b>
          </span>
        ))}
      </div>
      <div className="ca-ops">
        <b>{v.ops}</b>
        {v.rows.map(([n, cur, amt], i) => {
          const st = i === 0 ? st0 : 'done';
          return (
            <div key={n} className="ca-op">
              <span>
                <b>{n}</b>
                <em>{cur}</em>
              </span>
              <span key={st} className={'ca-st ' + st}>
                {v.st[st as 'done' | 'progress']}
              </span>
              <strong className={amt > 0 ? 'p' : ''}>{money(amt, cur as 'EUR' | 'USD', loc, true)}</strong>
            </div>
          );
        })}
      </div>
      <DemoNote>{tx.demoNote}</DemoNote>
    </div>
  );
}

/* ─── визуал: синхронизация CRM ↔ личный кабинет ─── */
function SyncVis({ tx }: { tx: ClientAccountsText }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref);
  const tick = useTick(on, 1500);
  const v = tx.sync.vis;
  const n = v.rows.length;
  const k = tick % (n + 2);
  const shown = Math.min(n, k);
  const cur = k > 0 && k <= n ? v.rows[k - 1] : null;
  const toCrm = cur ? cur[0].includes('CRM') : true;
  const crmItems = v.rows.slice(0, shown).filter((r) => r[0].includes('CRM'));
  const portalItems = v.rows.slice(0, shown).filter((r) => !r[0].includes('CRM'));
  return (
    <div className="fv" ref={ref}>
      <div className="sy-grid">
        <div className="sy-side">
          <b>{v.portal}</b>
          {portalItems.map((r) => (
            <div key={r[1]} className="sy-item new">
              {r[1]}
            </div>
          ))}
        </div>
        <div className="sy-lane">{cur && <span key={k} className={'sy-pk ' + (toCrm ? 'r' : 'l')}>{toCrm ? '→' : '←'}</span>}</div>
        <div className="sy-side">
          <b>{v.crm}</b>
          {crmItems.map((r) => (
            <div key={r[1]} className="sy-item new">
              {r[1]}
            </div>
          ))}
        </div>
      </div>
      <div className="fv-h" style={{ marginTop: 14, marginBottom: 0 }}>
        <span>{v.log}</span>
      </div>
      <div className="sy-log">
        {v.rows.slice(0, shown).map(([dir, txt]) => (
          <div key={txt}>
            <code>{dir}</code>
            <span>{txt}</span>
          </div>
        ))}
      </div>
      <DemoNote>{tx.demoNote}</DemoNote>
    </div>
  );
}

/* ─── визуал: аналитика клиента ─── */
function AnalyticsVis({ tx }: { tx: ClientAccountsText }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeenOnce(ref);
  const v = tx.analytics.vis;
  const data: Array<[number, number]> = [
    [32, 21],
    [28, 26],
    [41, 31],
    [38, 25],
  ];
  const mx = 45;
  return (
    <div className="fv" ref={ref}>
      <div className="fv-h">
        <span>{v.h}</span>
      </div>
      <div className="ax-kpis">
        {v.kpis.map(([l, val], i) => (
          <div key={l} className="ax-kpi">
            <em>{l}</em>
            <strong className={i === 2 ? 'p' : ''}>{val}</strong>
          </div>
        ))}
      </div>
      <div className="ax-chart">
        {data.map(([a, b], i) => (
          <div key={i} className="ax-col">
            <i style={{ height: seen ? (a / mx) * 100 + '%' : 0, background: '#1f9d63', transitionDelay: i * 0.1 + 's' }} />
            <i style={{ height: seen ? (b / mx) * 100 + '%' : 0, background: '#e04848', transitionDelay: i * 0.1 + 0.1 + 's' }} />
          </div>
        ))}
      </div>
      <div className="ax-lbl">
        {v.months.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
      <div className="lp-legend">
        <span>
          <i style={{ background: '#1f9d63' }} />
          {v.in}
        </span>
        <span>
          <i style={{ background: '#e04848' }} />
          {v.out}
        </span>
      </div>
      <DemoNote>{tx.demoNote}</DemoNote>
    </div>
  );
}

export default function ClientAccountsSolutionsPage() {
  const { i18n } = useTranslation();
  const code = (i18n.language || 'ru').slice(0, 2);
  const lang = code === 'en' || code === 'tr' ? code : 'ru';
  const tx = CLIENT_ACCOUNTS_T[lang];
  const loc = lang === 'en' ? 'en-US' : lang === 'tr' ? 'tr-TR' : 'ru-RU';
  const sp = tx.pair.spend;
  const tr = tx.pair.tr;
  const k = (n: number) => '€' + (n / 1000).toLocaleString(loc, { maximumFractionDigits: 1 }) + 'K';
  return (
    <SolutionShell activeKey="client-accounts">
      <SolutionHero
        crumbs={tx.crumbs}
        kicker={tx.kicker}
        t1={tx.t1}
        t2={tx.t2}
        sub={tx.sub}
        tryFree={tx.tryFree}
        demo={tx.demo}
        demoNote={tx.demoNote}
        url="crm.lumiva.agency/client-accounts"
        tplIndex={0}
        dashTitle=""
        stats={tx.stats}
        visual={<HeroVis tx={tx} loc={loc} />}
      />
      <Problem {...tx.prob} />
      <ModRow k={tx.card.k} t={tx.card.t} lede={tx.card.lede} items={tx.card.items}>
        <CardVis tx={tx} loc={loc} />
      </ModRow>
      <CardsSection {...tx.ops} />
      <div style={{ marginTop: 30 }}>
        <ModRow rev k={tx.sync.k} t={tx.sync.t} lede={tx.sync.lede} items={tx.sync.items}>
          <SyncVis tx={tx} />
        </ModRow>
      </div>
      <ModRow k={tx.analytics.k} t={tx.analytics.t} lede={tx.analytics.lede} items={tx.analytics.items}>
        <AnalyticsVis tx={tx} />
      </ModRow>
      <CardsSection {...tx.access} />
      <section className="lp-sec">
        <div className="lp-pair">
          <div className="lh-rv">
            <BarsCard
              title={sp.title}
              legend={[{ c: '#111113', l: sp.eur }, { c: '#3a6ff0', l: sp.usd }]}
              rows={sp.rows.map(([n, e, u]) => ({ n, segs: [e, u], max: 38000, meta: `USD ${k(u).replace('€', '$')}`, val: k(e) }))}
            />
          </div>
          <div className="lh-rv" style={{ transitionDelay: '.1s' }}>
            <BarsCard
              title={tr.title}
              legend={[{ c: '#1f9d63', l: tr.inc }, { c: '#e04848', l: tr.out }]}
              rows={tr.rows.map(([n, a, b]) => ({ n, segs: [a, b], max: 72000, meta: `${tr.inc} ${k(a)} · ${tr.out} ${k(b)}`, val: (a - b >= 0 ? '+' : '−') + k(Math.abs(a - b)) }))}
            />
          </div>
        </div>
      </section>
      <StepsSection {...tx.steps} />
      <CompareSection {...tx.compare} />
      <FaqSection {...tx.faq} />
      <CtaBox k={tx.cta.k} t={tx.cta.t} demo={tx.demo} tryFree={tx.tryFree} />
    </SolutionShell>
  );
}
