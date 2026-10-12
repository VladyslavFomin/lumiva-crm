// «Решения → Товары» — дизайн Claude Design solutions-products-v2.html (lp-solutions.jsx + lp-kit.jsx).
// Из макета убрано то, чего нет в продукте (генерация EAN-13, синхронизация с маркетплейсами, «каталог на 50 000»,
// ИИ, ищущий дубли артикулов); добавлено реальное: 16 типов полей, цены в валютах, акции, опт, комплекты, переводы,
// модерация публикации, публичный API, фиды и вебхуки. Тексты — productsSolutionText.ts.
import React, { useRef } from 'react';
import { Icon } from '../landing/LandingSections';
import { PRODUCTS_T, type ProductsText } from './productsSolutionText';
import {
  AiSection, BarsCard, CardsSection, CompareSection, CtaBox, DemoNote, FaqSection, ModRow, Problem, SolutionHero, SolutionShell, StepsSection, useInView, useTick,
} from './solutionKit';
import { useTranslation } from 'react-i18next';

const CAT_COLORS = ['#ff6a33', '#3a6ff0', '#1f9d63'];

/* ─── визуал: дерево категорий и конструктор полей ─── */
function CatalogVis({ tx }: { tx: ProductsText }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref);
  const tick = useTick(on, 1100);
  const v = tx.catalog.vis;
  const CYCLE = 10;
  const t = tick % CYCLE;
  const open = t >= 1 ? (t >= 5 ? 1 : 0) : -1;
  const fields = v.field.slice(0, Math.min(v.field.length, Math.max(0, t - 1)));
  return (
    <div className="fv" ref={ref}>
      <div className="pc-wrap">
        <div className="pc-col">
          <b>{v.tree}</b>
          {v.cats.map(([n, c, subs], i) => (
            <React.Fragment key={n}>
              <div className={'pc-node' + (open === i ? ' on' : '')}>
                <i style={{ background: CAT_COLORS[i % 3] }} />
                {n}
                <em>
                  {c} {v.items}
                </em>
              </div>
              {open === i && subs.length > 0 && (
                <div className="pc-sub" key={'s' + i + '-' + Math.floor(tick / CYCLE)}>
                  {subs.map((s) => (
                    <div key={s} className="pc-node">
                      <i style={{ background: CAT_COLORS[i % 3], opacity: 0.5 }} />
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="pc-col">
          <b>{v.fields}</b>
          {fields.map(([n, ty]) => (
            <div key={n + Math.floor(tick / CYCLE)} className="pc-field">
              <span>{n}</span>
              <code>{ty}</code>
            </div>
          ))}
          <div className="pc-types">
            {v.types.map((ty) => (
              <span key={ty}>+ {ty}</span>
            ))}
          </div>
        </div>
      </div>
      <DemoNote>{tx.demoNote}</DemoNote>
    </div>
  );
}

/* ─── визуал: генерация вариантов размер × цвет ─── */
function VariantVis({ tx }: { tx: ProductsText }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref);
  const tick = useTick(on, 700);
  const v = tx.variants.vis;
  const CYCLE = 18;
  const t = tick % CYCLE;
  const sizesOn = Math.min(v.sizes.length, t);
  const colorsOn = Math.min(v.colors.length, Math.max(0, t - 3));
  const press = t === 6;
  const rowsShown = t >= 7 ? Math.min(6, t - 6) : 0;
  const combos = v.colors.flatMap(([cn, hex], ci) => v.sizes.map((s, si) => ({ cn, hex, s, ci, si })));
  return (
    <div className="fv" ref={ref}>
      <div className="fv-h">
        <span>{v.attrs}</span>
      </div>
      <div className="pv-attrs">
        <div className="pv-attr">
          <b>{v.size}</b>
          {v.sizes.map((s, i) => (
            <span key={s} className={'pv-chip' + (i < sizesOn ? ' on' : '')}>
              {s}
            </span>
          ))}
        </div>
        <div className="pv-attr">
          <b>{v.color}</b>
          {v.colors.map(([n, hex], i) => (
            <span key={n} className={'pv-chip' + (i < colorsOn ? ' on' : '')}>
              <i style={{ background: hex }} />
              {n}
            </span>
          ))}
        </div>
      </div>
      <span className={'pv-gen' + (press ? ' press' : '')}>
        {v.gen} · {v.sizes.length} × {v.colors.length}
      </span>
      {rowsShown > 0 && (
        <div className="pv-tbl">
          <div className="pv-row">
            {v.cols.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          {combos.slice(0, rowsShown).map((c, i) => (
            <div key={i} className="pv-row">
              <span>
                <i style={{ background: c.hex }} />
                {c.s} · {c.cn}
              </span>
              <span>
                <code>
                  SN-{c.ci ? 'SND' : 'BLK'}-{c.s}
                </code>
              </span>
              <span>{[12, 18, 7, 4, 9, 3][i]}</span>
              <span>{c.s === 'L' ? '€89' : <em>{v.base}</em>}</span>
            </div>
          ))}
        </div>
      )}
      <DemoNote>{tx.demoNote}</DemoNote>
    </div>
  );
}

/* ─── визуал: публикация через модерацию → сайты, фиды, вебхук ─── */
const SITES = ['shop.example.com', 'outlet.example.com', 'b2b.example.com'];
function PublishVis({ tx }: { tx: ProductsText }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref);
  const tick = useTick(on, 1100);
  const v = tx.publish.vis;
  const CYCLE = 10;
  const t = tick % CYCLE;
  const step = t < 2 ? 0 : t < 4 ? 1 : 2;
  const live = step === 2;
  return (
    <div className="fv" ref={ref}>
      <div className="pb-card">
        <span className="pb-img">
          <Icon name="box" size={20} />
        </span>
        <span>
          <b>{v.product}</b>
          <code>SN-WHT-099 · €79</code>
        </span>
      </div>
      <div className="pb-steps">
        {v.steps.map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            )}
            <span className={'pb-step' + (i < step ? ' done' : '') + (i === step ? ' cur' : '') + (i === step && i === 2 ? ' last' : '')}>{s}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="pb-note">↳ {v.reject}</div>
      <div className="pb-out">
        <div className="pb-line">
          <b>{v.sites}</b>
          <div>
            {SITES.map((s, i) => (
              <span key={s} className={'pb-tag' + (live && t >= 5 + i && i < 2 ? ' on' : '') + (i === 2 ? ' off' : '')}>
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="pb-line">
          <b>{v.feeds}</b>
          <div>
            <span className={'pb-tag' + (live && t >= 7 ? ' on' : '')}>google.xml</span>
            <span className={'pb-tag' + (live && t >= 7 ? ' on' : '')}>woocommerce.csv</span>
          </div>
        </div>
        <div className="pb-line">
          <b>{v.hooks}</b>
          <div>
            <span className={'pb-tag' + (live && t >= 8 ? ' on' : '')}>product.published → 200</span>
          </div>
        </div>
      </div>
      <DemoNote>{tx.demoNote}</DemoNote>
    </div>
  );
}

export default function ProductsSolutionsPage() {
  const { i18n, t } = useTranslation();
  const code = (i18n.language || 'ru').slice(0, 2);
  const lang = code === 'en' || code === 'tr' ? code : 'ru';
  const tx = PRODUCTS_T[lang];
  const pc = tx.pair.cat;
  const pm = tx.pair.margin;
  return (
    <SolutionShell activeKey="products">
      <SolutionHero
        crumbs={tx.crumbs}
        kicker={tx.kicker}
        t1={tx.t1}
        t2={tx.t2}
        sub={tx.sub}
        tryFree={tx.tryFree}
        demo={tx.demo}
        demoNote={tx.demoNote}
        url="crm.lumiva.agency/products"
        tplIndex={3}
        dashTitle={t('crm.aura.tpl.stock.name')}
        stats={tx.stats}
      />
      <Problem {...tx.prob} />
      <ModRow k={tx.catalog.k} t={tx.catalog.t} lede={tx.catalog.lede} items={tx.catalog.items}>
        <CatalogVis tx={tx} />
      </ModRow>
      <CardsSection {...tx.card} />
      <div style={{ marginTop: 30 }}>
        <ModRow rev k={tx.variants.k} t={tx.variants.t} lede={tx.variants.lede} items={tx.variants.items}>
          <VariantVis tx={tx} />
        </ModRow>
      </div>
      <ModRow k={tx.publish.k} t={tx.publish.t} lede={tx.publish.lede} items={tx.publish.items}>
        <PublishVis tx={tx} />
      </ModRow>
      <CardsSection {...tx.work} />
      <section className="lp-sec">
        <div className="lp-pair">
          <div className="lh-rv">
            <BarsCard title={pc.title} legend={[{ c: '#111113', l: pc.items }]} rows={pc.rows.map(([n, c]) => ({ n, segs: [c], max: 86, meta: '', val: String(c) }))} />
          </div>
          <div className="lh-rv" style={{ transitionDelay: '.1s' }}>
            <BarsCard
              title={pm.title}
              legend={[{ c: '#e04848', l: pm.cost }, { c: '#9fdc3c', l: pm.price }]}
              rows={pm.rows.map(([n, p, c]) => ({ n, segs: [c, p - c], max: 96, meta: `${pm.cost} €${c} · ${Math.round(((p - c) / p) * 100)}%`, val: '€' + p }))}
            />
          </div>
        </div>
      </section>
      <StepsSection {...tx.steps} />
      <CompareSection {...tx.compare} />
      <AiSection role="crm_analyst" hireHref="/features" {...tx.ai} />
      <FaqSection {...tx.faq} />
      <CtaBox k={tx.cta.k} t={tx.cta.t} demo={tx.demo} tryFree={tx.tryFree} />
    </SolutionShell>
  );
}
