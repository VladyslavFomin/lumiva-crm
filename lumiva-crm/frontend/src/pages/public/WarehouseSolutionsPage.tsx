// «Решения → Склад» — дизайн Claude Design solutions-warehouse-v2.html (lp-solutions.jsx + lp-kit.jsx).
// Макет обещал ячейки, резервы и поставки в пути — их в продукте нет; страница описывает реальный склад:
// склады/точки, операции и перемещения, запись движений, пороги и уведомления, прогноз и ИИ-отдел «Склад».
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../landing/LandingSections';
import { WAREHOUSE_T, type WarehouseText } from './warehouseSolutionText';
import {
  AiSection, BarsCard, CardsSection, CompareSection, CtaBox, DemoNote, FaqSection, ModRow, Problem, SolutionHero, SolutionShell, StepsSection, useInView, useTick,
} from './solutionKit';

/* ─── визуал: остатки по складам, продажа → ниже порога → уведомление ─── */
// [товар, склад (0 основной / 1 магазин), остаток, минимум]
const STOCK: Array<[number, number, number, number]> = [
  [0, 0, 42, 10],
  [1, 0, 180, 50],
  [2, 1, 9, 6],
  [3, 0, 220, 80],
  [4, 1, 14, 6],
];
function StockVis({ tx }: { tx: WarehouseText }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref);
  const tick = useTick(on, 1400);
  const v = tx.stock.vis;
  const CYCLE = 9;
  const t = tick % CYCLE;
  const loc = Math.floor(tick / CYCLE) % 3; // 0 все, 1 основной, 2 магазин
  // сироп (индекс 2) продаётся: 9 → 7 → 5 → 3 → 0
  const SYRUP = [9, 9, 7, 5, 5, 3, 3, 0, 0];
  const qtyOf = (i: number) => (i === 2 ? SYRUP[t] : STOCK[i][2]);
  const sold = t > 0 && SYRUP[t] < SYRUP[t - 1];
  const rows = STOCK.map((r, i) => ({ r, i })).filter(({ r }) => loc === 0 || r[1] === loc - 1);
  const syrupQty = SYRUP[t];
  const toast = syrupQty === 0 ? 'out' : syrupQty <= STOCK[2][3] ? 'low' : null;
  return (
    <div className="fv" ref={ref}>
      <div className="wh-tabs">
        {[v.all, ...v.locs].map((l, i) => (
          <span key={l} className={i === loc ? 'on' : ''}>
            {l}
          </span>
        ))}
      </div>
      <div className="wh-tbl">
        <div className="wh-row">
          {v.cols.map((c) => (
            <span key={c}>{c}</span>
          ))}
          <span />
        </div>
        {rows.map(({ r, i }) => {
          const q = qtyOf(i);
          const st = q === 0 ? 'out' : q <= r[3] ? 'low' : 'ok';
          return (
            <div key={i} className={'wh-row' + (st === 'out' ? ' bad' : st === 'low' ? ' warn' : '')}>
              <span>{v.products[r[0]]}</span>
              <span>{v.locs[r[1]]}</span>
              <span>
                <b key={q} className="q">
                  {q}
                </b>
                {i === 2 && sold && (
                  <span key={'s' + tick} className="wh-sale">
                    −{SYRUP[t - 1] - q}
                  </span>
                )}
              </span>
              <span>{r[3]}</span>
              <span>
                <span className={'wh-pill ' + st}>{v.st[st]}</span>
              </span>
            </div>
          );
        })}
      </div>
      {toast && (loc === 0 || loc === 2) && (
        <div key={toast} className={'wh-toast' + (toast === 'out' ? ' out' : '')}>
          <i>
            <Icon name="bell" size={14} />
          </i>
          <span>
            <b>{toast === 'out' ? v.toastOut : v.toast}</b>
            <em>
              {v.products[2]} · {v.locs[1]} · {syrupQty} / {STOCK[2][3]}
            </em>
          </span>
        </div>
      )}
      <DemoNote>{tx.demoNote}</DemoNote>
    </div>
  );
}

/* ─── визуал: перемещение между складами и запись движений ─── */
function MovesVis({ tx }: { tx: WarehouseText }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref);
  const tick = useTick(on, 1500);
  const v = tx.moves.vis;
  const CYCLE = 9;
  const t = tick % CYCLE;
  const loop = Math.floor(tick / CYCLE);
  const moved = t >= 2;
  const from = moved ? 30 : 40;
  const to = moved ? 18 : 8;
  const shown = Math.min(v.rows.length, Math.max(0, t - 1));
  return (
    <div className="fv" ref={ref}>
      <div className="fv-h">
        <span>{v.transfer}</span>
        <b>
          {v.qty}: 10
        </b>
      </div>
      <div className="wh-tr">
        <div className="wh-box">
          <em>{v.from}</em>
          <b>{tx.stock.vis.locs[0]}</b>
          <strong>
            <span key={from}>{from}</span>
          </strong>
        </div>
        <div className="wh-lane">{t === 1 && <span key={loop} className="wh-pack">10</span>}</div>
        <div className="wh-box">
          <em>{v.to}</em>
          <b>{tx.stock.vis.locs[1]}</b>
          <strong>
            <span key={to}>{to}</span>
          </strong>
        </div>
      </div>
      <div className="fv-h" style={{ marginTop: 14, marginBottom: 0 }}>
        <span>{v.log}</span>
      </div>
      <div className="wh-log">
        {v.rows.slice(0, shown).map(([tm, kind, where, d, why], i) => (
          <div key={loop + '-' + i}>
            <time>{tm}</time>
            <b>{kind}</b>
            <span>
              {where}
              {why ? ` · ${why}` : ''}
            </span>
            <strong className={d > 0 ? 'p' : 'm'}>
              {d > 0 ? '+' : '−'}
              {Math.abs(d)}
            </strong>
          </div>
        ))}
      </div>
      <DemoNote>{tx.demoNote}</DemoNote>
    </div>
  );
}

/* ─── визуал: ИИ-отдел готовит заказ поставщику ─── */
function PoVis({ tx }: { tx: WarehouseText }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref);
  const tick = useTick(on, 1200);
  const v = tx.ai.vis;
  const CYCLE = 10;
  const t = tick % CYCLE;
  const rows = v.rows.slice(0, Math.min(v.rows.length, t));
  const mail = t >= 4;
  const press = t === 6;
  const sent = t >= 7;
  return (
    <div className="fv" ref={ref}>
      <div className="fv-h">
        <span>{v.h}</span>
        <span className="lh-on">
          <i />
          AI
        </span>
      </div>
      <div className="po-found">
        <b>{v.rows.length}</b>
        <span>{v.found}</span>
      </div>
      {rows.length > 0 && (
        <div className="po-rows">
          {rows.map(([n, q, why]) => (
            <div key={n}>
              <span>{n}</span>
              <span>+{q}</span>
              <span>{why}</span>
            </div>
          ))}
        </div>
      )}
      {mail && (
        <div className="po-mail">
          <div className="po-mail-h">
            <b>
              {v.mail} · {v.subj}
            </b>
            <span className={'po-st ' + (sent ? 'sent' : 'wait')} key={sent ? 's' : 'w'}>
              {sent ? v.sent : v.wait}
            </span>
          </div>
          <p>
            {v.supplier}: orders@supplier.example.com
            <br />
            {v.rows.map(([n, q]) => `${n} — ${q}`).join('; ')}
          </p>
          {!sent && <span className={'po-btn' + (press ? ' press' : '')}>{v.approve}</span>}
        </div>
      )}
      <DemoNote>{tx.demoNote}</DemoNote>
    </div>
  );
}

export default function WarehouseSolutionsPage() {
  const { i18n, t } = useTranslation();
  const code = (i18n.language || 'ru').slice(0, 2);
  const lang = code === 'en' || code === 'tr' ? code : 'ru';
  const tx = WAREHOUSE_T[lang];
  const loc = lang === 'en' ? 'en-US' : lang === 'tr' ? 'tr-TR' : 'ru-RU';
  const pl = tx.pair.loc;
  const top = tx.pair.top;
  const eur = (n: number) => '€' + n.toLocaleString(loc);
  return (
    <SolutionShell activeKey="warehouse">
      <SolutionHero
        crumbs={tx.crumbs}
        kicker={tx.kicker}
        t1={tx.t1}
        t2={tx.t2}
        sub={tx.sub}
        tryFree={tx.tryFree}
        demo={tx.demo}
        demoNote={tx.demoNote}
        url="crm.lumiva.agency/products/stock"
        tplIndex={3}
        dashTitle={t('crm.aura.tpl.stock.name')}
        stats={tx.stats}
      />
      <Problem {...tx.prob} />
      <ModRow k={tx.stock.k} t={tx.stock.t} lede={tx.stock.lede} items={tx.stock.items}>
        <StockVis tx={tx} />
      </ModRow>
      <CardsSection {...tx.ops} />
      <div style={{ marginTop: 30 }}>
        <ModRow rev k={tx.moves.k} t={tx.moves.t} lede={tx.moves.lede} items={tx.moves.items}>
          <MovesVis tx={tx} />
        </ModRow>
      </div>
      <ModRow k={tx.ai.k} t={tx.ai.t} lede={tx.ai.lede} items={tx.ai.items}>
        <PoVis tx={tx} />
      </ModRow>
      <CardsSection {...tx.more} />
      <section className="lp-sec">
        <div className="lp-pair">
          <div className="lh-rv">
            <BarsCard
              title={pl.title}
              legend={[{ c: '#111113', l: pl.value }]}
              rows={pl.rows.map(([n, u, val, low]) => ({ n, segs: [val], max: 18400, meta: `${u.toLocaleString(loc)} ${pl.units} · ${low} ${pl.low}`, val: eur(val) }))}
            />
          </div>
          <div className="lh-rv" style={{ transitionDelay: '.1s' }}>
            <BarsCard title={top.title} legend={[{ c: '#9fdc3c', l: pl.value }]} rows={top.rows.map(([n, val]) => ({ n, segs: [val], max: 5400, meta: '', val: eur(val) }))} />
          </div>
        </div>
      </section>
      <StepsSection {...tx.steps} />
      <CompareSection {...tx.compare} />
      <AiSection role="project_manager" hireHref="/#depts" {...tx.agent} />
      <FaqSection {...tx.faq} />
      <CtaBox k={tx.cta.k} t={tx.cta.t} demo={tx.demo} tryFree={tx.tryFree} />
    </SolutionShell>
  );
}
