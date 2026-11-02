import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { AuraBlockLayout, AuraCustomWidget, AuraStyle, AuraData, AuraDensity, AuraFilterKey, AuraFilters, AuraPeriod, AuraSourceKey, AuraTheme, AuraWidgetData, AuraWidgetResult } from '../../api/aura';
import { AU_GLASS, AU_PERIODS, auBucketLabel, auInitials, auIsDeco, auPack, type AuLayout, type AuPlaced } from './auraModel';
import { C, Cal, Check, Columns, Empty, Forecast, Gauge, Hero, Multi, Note, Ring, Section, SegBar, SparkTicks, Split, Status, Stream, TargetBar, fmtVal, pathOf, type Fmt } from './auraViz';
import { auView, hasData, type AuViewData } from './auraTransform';
import { AU_DATASET_COMPONENT, AU_SOURCE_COMPONENT, UnlockButton } from './AuraUnlock';

/** Темы, где мини-графики KPI рисуются штрихами, а линии — плавными кривыми. */
const TICK_THEMES = new Set<AuraTheme>(['mist', 'obsidian', 'nebula']);

/* ---------- примитивы ---------- */

function Spark({ data, color = 'var(--a-c1)' }: { data: number[]; color?: string }) {
  const id = useId().replace(/:/g, '');
  if (!data || data.length < 2) return <div className="dsh-spark dsh-spark-empty" />;
  const w = 100;
  const h = 36;
  const mx = Math.max(...data);
  const mn = Math.min(...data);
  const sp = mx - mn || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, mx === mn ? h / 2 : h - ((v - mn) / sp) * (h - 6) - 3]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  return (
    <svg className="dsh-spark dsh-reveal-x" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: color, stopOpacity: 0.22 }} />
          <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path className="dsh-draw" d={d} vectorEffect="non-scaling-stroke" style={{ fill: 'none', stroke: color, strokeWidth: 1.75, strokeLinejoin: 'round' }} />
    </svg>
  );
}

function deltaText(f: Fmt, d: { kind: 'pct' | 'pp'; value: number }) {
  const sign = d.value > 0 ? '+' : d.value < 0 ? '−' : '';
  const v = Math.abs(d.value).toLocaleString(f.lang.startsWith('en') ? 'en-US' : f.lang.startsWith('tr') ? 'tr-TR' : 'ru-RU', { maximumFractionDigits: 1 });
  return d.kind === 'pp' ? `${sign}${v} ${f.t('crm.aura.unit.pp')}` : `${sign}${v}%`;
}

/* ---------- тела виджетов ---------- */

function Kpi({ w, f, ticks, mode, target }: { w: Extract<AuraWidgetData, { type: 'kpi' }>; f: Fmt; ticks: boolean; mode?: string; target?: number }) {
  const useTicks = mode === 'kpi_ticks' || (mode !== 'kpi_line' && ticks);
  const spark = mode === 'kpi_bare' ? null : w.spark && w.spark.length > 1 ? useTicks ? <SparkTicks data={w.spark} /> : <Spark data={w.spark} /> : null;
  return (
    <div className={'dsh-kpi' + (mode === 'kpi_bare' ? ' dsh-kpi-bare' : '')}>
      <div className="dsh-kpi-v dsh-fit">{fmtVal(f, w.value, w.format, w.unit)}</div>
      {target ? <TargetBar value={w.value} target={target} format={w.format} f={f} /> : null}
      {spark || (mode === 'kpi_bare' || target ? null : <div className="dsh-spark dsh-spark-empty" />)}
    </div>
  );
}

function Line({ w, f, data, smooth, area }: { w: Extract<AuraWidgetData, { type: 'line' }>; f: Fmt; data: AuraData; smooth: boolean; area?: boolean }) {
  const id = useId().replace(/:/g, '');
  const [hv, setHv] = useState<number | null>(null);
  const series = [
    { name: f.t('crm.aura.series.current'), data: w.current, dash: false },
    { name: f.t('crm.aura.series.previous'), data: w.previous, dash: true },
  ].filter((s) => s.data.length > 0);
  const n = w.current.length;
  const W = 600;
  const H = 180;
  const mx = Math.max(1, ...w.current, ...w.previous) * 1.12;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * W : W / 2);
  const y = (v: number) => H - (v / mx) * H;
  const dl = w.prevTotal ? Math.round((w.total / w.prevTotal - 1) * 100) : null;
  const labels = data.period.labels;
  const move = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHv(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  };
  const step = Math.max(1, Math.ceil(n / 6));
  const i = hv ?? n - 1;
  return (
    <div className="dsh-line">
      <div className="dsh-line-top">
        <div className="dsh-line-big">
          <span className="dsh-big dsh-fit">{fmtVal(f, w.total, w.format, undefined, true)}</span>
          {dl != null && <span className={'dsh-pill ' + (dl >= 0 ? 'good' : 'bad')}>{(dl >= 0 ? '↑ ' : '↓ ') + Math.abs(dl) + '%'}</span>}
        </div>
        <div className="dsh-legend">
          {series.map((s, k) => (
            <span key={k}>
              <i className={s.dash ? 'dash' : ''} style={{ background: C[k] }} />
              {s.name}
            </span>
          ))}
        </div>
      </div>
      <div className="dsh-line-plot" onMouseMove={move} onMouseLeave={() => setHv(null)}>
        <div className="dsh-gridlines">
          <span />
          <span />
          <span />
          <span />
        </div>
        {n > 0 && (
          <svg className="dsh-reveal-x" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: 'var(--a-c1)', stopOpacity: area ? 0.42 : 0.2 }} />
                <stop offset="1" style={{ stopColor: 'var(--a-c1)', stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            {series.map((s, k) => {
              const d = pathOf(
                s.data.map((v, j) => [x(j), y(v)]),
                smooth,
              );
              return (
                <g key={k}>
                  {k === 0 && <path className="dsh-area" d={`${d} L${x(n - 1)},${H} L${x(0)},${H} Z`} fill={`url(#${id})`} />}
                  <path
                    className={k === 0 ? 'dsh-draw' : ''}
                    d={d}
                    vectorEffect="non-scaling-stroke"
                    style={{ fill: 'none', stroke: C[k], strokeWidth: s.dash ? 1.5 : 2.25, strokeDasharray: s.dash ? '3 5' : 'none', strokeLinecap: 'round', strokeLinejoin: 'round', opacity: s.dash ? 0.7 : 1 }}
                  />
                </g>
              );
            })}
          </svg>
        )}
        {n > 0 && (
          <>
            <span className="dsh-dot" style={{ left: (x(i) / W) * 100 + '%', top: (y(w.current[i]) / H) * 100 + '%' }} />
            {hv != null && (
              <>
                <span className="dsh-cross" style={{ left: (x(i) / W) * 100 + '%' }} />
                <div className="dsh-tip" style={{ left: (x(i) / W) * 100 + '%' }}>
                  <em>{labels[i] ? auBucketLabel(labels[i], data.period.granularity, f.lang) : ''}</em>
                  {series.map((s, k) => (
                    <div key={k}>
                      <i style={{ background: C[k] }} />
                      {s.name}
                      <b>{fmtVal(f, s.data[i], w.format, undefined, true)}</b>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
      <div className="dsh-xlabels">
        {labels.map((l, j) => (
          <span key={j}>{j % step === 0 || j === n - 1 ? auBucketLabel(l, data.period.granularity, f.lang) : ''}</span>
        ))}
      </div>
    </div>
  );
}

function Donut({ w, f, nameOf, pie }: { w: Extract<AuraWidgetData, { type: 'donut' }>; f: Fmt; nameOf: (it: { key?: string; name: string }) => string; pie?: boolean }) {
  const tot = w.items.reduce((a, b) => a + b.value, 0);
  if (!tot) return <Empty text={f.t('crm.aura.empty')} />;
  const R = pie ? 8 : 15.9;
  const gap = w.items.length > 1 ? (pie ? 0.6 : 1.4) : 0;
  let acc = 0;
  return (
    <div className="dsh-donut">
      <div className="dsh-donut-ring">
        <svg viewBox="0 0 42 42">
          {w.items.map((it, i) => {
            const p = (it.value / tot) * 100;
            const el = (
              <circle
                key={i}
                className="dsh-arc"
                cx="21"
                cy="21"
                r={R}
                pathLength={100}
                style={{ fill: 'none', stroke: C[i % 5], strokeWidth: pie ? 16 : 4.5, strokeDasharray: `${Math.max(0, p - gap)} ${100 - p + gap}`, strokeDashoffset: 25 - acc, animationDelay: `${i * 0.06}s` }}
              />
            );
            acc += p;
            return el;
          })}
        </svg>
        <div className={'dsh-donut-c' + (pie ? ' dsh-hide' : '')}>
          {(() => {
            const v = fmtVal(f, tot, w.format, undefined, true);
            // длинные суммы («141,3 тыс. €») не влезают в кольцо крупным кеглем
            return <b className={v.length > 9 ? 'dsh-sm2' : v.length > 6 ? 'dsh-sm1' : ''}>{v}</b>;
          })()}
          <span>{f.t('crm.aura.total')}</span>
        </div>
      </div>
      <div className="dsh-donut-leg">
        {w.items.map((it, i) => (
          <div key={i}>
            <i style={{ background: C[i % 5] }} />
            <span>{nameOf(it)}</span>
            <b>{Math.round((it.value / tot) * 100) + '%'}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bars({ w, f }: { w: Extract<AuraWidgetData, { type: 'bar' }>; f: Fmt }) {
  if (!w.items.length) return <Empty text={f.t('crm.aura.empty')} />;
  const mx = Math.max(1, ...w.items.map((i) => i.value));
  return (
    <div className="dsh-bars">
      {w.items.map((it, i) => (
        <div key={i} className="dsh-bar-row">
          <div className="dsh-bar-top">
            {w.people && <span className="dsh-av">{auInitials(it.name)}</span>}
            <span className="dsh-bar-l">{it.name === '—' ? f.t('crm.aura.noManager') : it.name}</span>
            <b>{fmtVal(f, it.value, w.format, w.unit, true)}</b>
          </div>
          <span className="dsh-bar-t">
            <span style={{ width: (it.value / mx) * 100 + '%', background: i === 0 ? 'var(--a-c1)' : 'var(--a-c1-soft)', animationDelay: `${i * 0.05}s` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

function Funnel({ w, f }: { w: Extract<AuraWidgetData, { type: 'funnel' }>; f: Fmt }) {
  const mx = w.steps[0]?.value || 0;
  if (!mx) return <Empty text={f.t('crm.aura.empty')} />;
  return (
    <div className="dsh-funnel">
      {w.steps.map((s, i) => (
        <div key={s.key} className="dsh-fun-col">
          <b className="dsh-fun-v dsh-fit">{fmtVal(f, s.value, 'int')}</b>
          <div className="dsh-fun-track">
            <span style={{ height: Math.max(8, (s.value / mx) * 100) + '%', opacity: 1 - i * 0.13, animationDelay: `${i * 0.06}s` }} />
          </div>
          <span className="dsh-fun-l">{f.t(`crm.aura.funnel.${s.key}`)}</span>
          <em className="dsh-fun-c">{i > 0 ? (w.steps[i - 1].value ? Math.round((s.value / w.steps[i - 1].value) * 100) : 0) + '%' : '100%'}</em>
        </div>
      ))}
    </div>
  );
}

function Cols({ w, f, data }: { w: Extract<AuraWidgetData, { type: 'col' | 'col2' }>; f: Fmt; data: AuraData }) {
  const two = w.type === 'col2';
  const vals = two ? [...w.a, ...w.b] : w.data;
  const mx = Math.max(1, ...vals);
  if (!vals.some((v) => v > 0)) return <Empty text={f.t('crm.aura.empty')} />;
  const mi = two ? -1 : w.data.indexOf(Math.max(...w.data));
  const labels = two ? w.labels.map((l) => auBucketLabel(l, 'month', f.lang)) : w.labels.map((h) => String(h));
  return (
    <div className="dsh-cols-wrap">
      {two && (
        <div className="dsh-legend">
          <span>
            <i style={{ background: C[0] }} />
            {f.t('crm.aura.series.income')}
          </span>
          <span>
            <i style={{ background: C[1] }} />
            {f.t('crm.aura.series.adSpend')}
          </span>
        </div>
      )}
      <div className="dsh-cols">
        {labels.map((l, i) => (
          <div key={i} className={'dsh-col' + (i === mi ? ' max' : '')} title={two ? `${fmtVal(f, w.a[i], w.format)} / ${fmtVal(f, w.b[i], w.format)}` : `${l}:00 — ${w.data[i]}`}>
            <div className="dsh-col-bars">
              {two ? (
                <>
                  <span style={{ height: (w.a[i] / mx) * 100 + '%', background: C[0], animationDelay: `${i * 0.03}s` }} />
                  <span style={{ height: (w.b[i] / mx) * 100 + '%', background: C[1], animationDelay: `${i * 0.03 + 0.02}s` }} />
                </>
              ) : (
                <span style={{ height: (w.data[i] / mx) * 100 + '%', background: i === mi ? 'var(--a-c1)' : 'var(--a-c1-soft)', animationDelay: `${i * 0.03}s` }}>
                  {i === mi && <b>{fmtVal(f, w.data[i], 'int', undefined, true)}</b>}
                </span>
              )}
            </div>
            <em>{l}</em>
          </div>
        ))}
      </div>
      {!two && data && <div className="dsh-axis-note">{f.t('crm.aura.hoursNote')}</div>}
    </div>
  );
}

function Heat({ w, f }: { w: Extract<AuraWidgetData, { type: 'heat' }>; f: Fmt }) {
  const mx = Math.max(0, ...w.values.flat());
  if (!mx) return <Empty text={f.t('crm.aura.empty')} />;
  return (
    <div className="dsh-heat" style={{ gridTemplateColumns: `26px repeat(${w.hours.length},1fr)` }}>
      <span />
      {w.hours.map((h) => (
        <em key={h}>{h}</em>
      ))}
      {w.values.map((row, ri) => (
        <React.Fragment key={ri}>
          <em>{f.t(`crm.aura.dow.${ri}`)}</em>
          {row.map((v, ci) => {
            const p = Math.round((v / mx) * 100);
            return (
              <span
                key={ci}
                className="dsh-heat-c"
                style={{ background: `color-mix(in oklch, var(--a-c1) ${p}%, var(--a-heat-base))`, animationDelay: `${(ri + ci) * 0.012}s` }}
                title={`${f.t(`crm.aura.dow.${ri}`)} ${w.hours[ci]}:00 — ${v}`}
              />
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

function Cell({ kind, colKey, val, f }: { kind: string; colKey: string; val: string | number | null; f: Fmt }) {
  if (val == null || val === '') return <span className="dsh-mute">—</span>;
  if (kind === 'person') {
    return (
      <span className="dsh-who">
        <span className="dsh-av">{auInitials(String(val))}</span>
        {String(val)}
      </span>
    );
  }
  if (kind === 'chip') {
    const s = String(val);
    return <span className={'dsh-chip' + (s === 'confirmed' ? ' hot' : '')}>{f.t(`crm.aura.saleStatus.${s}`, { defaultValue: s })}</span>;
  }
  if (kind === 'days') {
    const n = Number(val);
    return <span className={'dsh-chip' + (n <= 5 ? ' hot' : '')}>{f.t('crm.aura.daysLeft', { count: n })}</span>;
  }
  if (kind === 'money') return <>{fmtVal(f, Number(val), 'money')}</>;
  if (kind === 'pct') return <>{fmtVal(f, Number(val), 'pct')}</>;
  if (kind === 'num') return <>{fmtVal(f, Number(val), 'num')}</>;
  if (kind === 'int') return <>{fmtVal(f, Number(val), 'int', colKey === 'qty' ? 'pcs' : undefined)}</>;
  return <>{String(val)}</>;
}

function Table({ w, f }: { w: Extract<AuraWidgetData, { type: 'table' }>; f: Fmt }) {
  if (!w.rows.length) return <Empty text={f.t('crm.aura.empty')} />;
  return (
    <div className="dsh-table-wrap">
      <table className="dsh-table">
        <thead>
          <tr>
            {w.cols.map((c) => (
              <th key={c.key}>{f.t(`crm.aura.col.${c.key}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {w.rows.map((r, i) => (
            <tr key={i} style={{ animationDelay: `${i * 0.04}s` }}>
              {w.cols.map((c) => (
                <td key={c.key}>
                  <Cell kind={c.kind} colKey={c.key} val={r[c.key] ?? null} f={f} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function List({ w, f }: { w: Extract<AuraWidgetData, { type: 'list' }>; f: Fmt }) {
  return (
    <div className="dsh-list">
      {w.items.map((it, i) => (
        <div key={i} style={{ animationDelay: `${i * 0.05}s` }}>
          <span className={'dsh-ldot ' + (it.kind === 'all_good' ? 'dsh-l3' : 'dsh-l' + (i % 3))} />
          <span className="dsh-ltxt">{f.t(`crm.aura.alert.${it.kind}`, { n: it.n ?? 0, count: it.n ?? 0, pct: it.pct ?? 0, name: it.name || '' })}</span>
          <span className="dsh-tag">{f.t(`crm.aura.alertTag.${it.kind}`)}</span>
        </div>
      ))}
    </div>
  );
}

function Goal({ w, f, onSetGoal }: { w: Extract<AuraWidgetData, { type: 'goal' }>; f: Fmt; onSetGoal?: () => void }) {
  const R = 15.9;
  const pct = w.pct ?? 0;
  return (
    <div className="dsh-goal">
      <div className="dsh-goal-ring">
        <svg viewBox="0 0 42 42">
          <circle cx="21" cy="21" r={R} style={{ fill: 'none', stroke: 'var(--a-c1-soft)', strokeWidth: 3.5 }} />
          {w.target != null && (
            <circle className="dsh-arc" cx="21" cy="21" r={R} style={{ fill: 'none', stroke: 'var(--a-c1)', strokeWidth: 3.5, strokeDasharray: `${Math.min(100, pct)} ${100 - Math.min(100, pct)}`, strokeDashoffset: 25, strokeLinecap: 'round' }} />
          )}
        </svg>
        <div className="dsh-donut-c">
          <b>{w.target != null ? pct + '%' : '—'}</b>
          <span>{f.t('crm.aura.goal.ofPlan')}</span>
        </div>
      </div>
      <div className="dsh-goal-m">
        <div>
          <span>{f.t('crm.aura.goal.done')}</span>
          <b>{fmtVal(f, w.done, 'money', undefined, true)}</b>
        </div>
        <div>
          <span>{f.t('crm.aura.goal.target')}</span>
          {w.target != null ? (
            <b>{fmtVal(f, w.target, 'money', undefined, true)}</b>
          ) : onSetGoal ? (
            <button type="button" className="dsh-goal-set" onClick={onSetGoal}>
              {f.t('crm.aura.goal.set')}
            </button>
          ) : (
            <b className="dsh-mute">{f.t('crm.aura.goal.notSet')}</b>
          )}
        </div>
        <div>
          <span>{f.t('crm.aura.goal.left')}</span>
          <b>{f.t('crm.aura.daysLeft', { count: w.daysLeft })}</b>
        </div>
      </div>
    </div>
  );
}

/* ---------- карточка ---------- */

export type AuEditHooks = {
  onMove: (key: string, dir: -1 | 1) => void;
  onRemove: (key: string) => void;
  onSetGoal: () => void;
  /** Новый порядок после перетаскивания. */
  onReorder?: (keys: string[]) => void;
  /** Открыть настройки блока (данные, цвет, ширина, название). */
  onOpen?: (key: string) => void;
  /** Открыть каталог блоков для добавления. */
  onAdd?: () => void;
  /** Блок, который сейчас открыт в настройках. */
  selected?: string | null;
};

function CardMenu({ w, edit, t, first, last }: { w: AuPlaced; edit: AuEditHooks; t: TFunction; first: boolean; last: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="dsh-menu-wrap">
      {edit.onOpen && (
        <>
          <span className="dsh-grip" data-grip title={t('crm.aura.block.drag')} aria-hidden>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
              <circle cx="9" cy="6" r="1.6" />
              <circle cx="15" cy="6" r="1.6" />
              <circle cx="9" cy="12" r="1.6" />
              <circle cx="15" cy="12" r="1.6" />
              <circle cx="9" cy="18" r="1.6" />
              <circle cx="15" cy="18" r="1.6" />
            </svg>
          </span>
          <button type="button" className="dsh-card-gear" title={t('crm.aura.block.settings')} aria-label={t('crm.aura.block.settings')} onClick={() => edit.onOpen!(w.key)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="10" cy="17" r="2" />
            </svg>
          </button>
        </>
      )}
      <button type="button" className="dsh-card-more" aria-label={t('crm.aura.card.menu')} onClick={() => setOpen((o) => !o)}>
        ···
      </button>
      {open && (
        <>
          <span className="dsh-menu-scrim" onClick={() => setOpen(false)} />
          <span className="dsh-menu" role="menu">
            {!first && (
              <button type="button" onClick={() => { setOpen(false); edit.onMove(w.key, -1); }}>
                {t('crm.aura.card.moveUp')}
              </button>
            )}
            {!last && (
              <button type="button" onClick={() => { setOpen(false); edit.onMove(w.key, 1); }}>
                {t('crm.aura.card.moveDown')}
              </button>
            )}
            {edit.onOpen && (
              <button type="button" onClick={() => { setOpen(false); edit.onOpen!(w.key); }}>
                {t('crm.aura.block.settings')}
              </button>
            )}
            {w.key === 'team_goal' && (
              <button type="button" onClick={() => { setOpen(false); edit.onSetGoal(); }}>
                {t('crm.aura.goal.set')}
              </button>
            )}
            <button type="button" className="danger" onClick={() => { setOpen(false); edit.onRemove(w.key); }}>
              {t('crm.aura.card.remove')}
            </button>
          </span>
        </>
      )}
    </span>
  );
}

function sourceTitle(t: TFunction, key: string) {
  return t(`crm.aura.w.${key}`);
}

const EMPTY_DATA: AuraData = { period: { key: '30d', from: '', to: '', granularity: 'day', labels: [] }, currency: 'EUR', generatedAt: '', own: false, widgets: {}, filterOptions: {} };

/** Подпись значения поля своего показателя: статусы, источники, направления звонков — по-человечески. */
const DS_STATUS: Record<string, string> = { leads: 'lead', sales: 'sale', bookings: 'booking', calls: 'call' };
function customValueLabel(f: Fmt, c: AuraCustomWidget, v: string): string {
  if (v === '—' || v === '') return f.t('crm.aura.notSet');
  const g = c.groupBy || '';
  const st = DS_STATUS[c.dataset];
  if (g === 'status' && st) return f.t(`crm.aura.st.${st}.${v}`, { defaultValue: v });
  if ((g === 'source' && c.dataset === 'leads') || g === 'lead_source') return f.t(`crm.aura.leadSource.${v}`, { defaultValue: v });
  if (g === 'direction') return f.t(`crm.aura.stream.dir.${v}`, { defaultValue: v });
  if (g === 'sentiment') return f.t(`crm.aura.cb.sentiment.${v}`, { defaultValue: v });
  if (v === 'true' || v === 'false') return f.t(`crm.aura.cb.bool.${v}`);
  return v;
}

/** Честное «нет данных» — по разделу блока, а не одно общее слово. */
function emptyTextOf(f: Fmt, w: AuPlaced, custom?: AuraCustomWidget): string {
  if (custom) return f.t('crm.aura.emptyFor.custom');
  const src = w.source === 'extra' || w.source === 'deco' ? 'extra' : w.source;
  return f.t(`crm.aura.emptyFor.${src}`, { defaultValue: f.t('crm.aura.empty') });
}

/** Цвет и заливка блока из редактора → CSS-переменные карточки. */
function blockVars(b?: AuraBlockLayout): React.CSSProperties {
  if (!b?.color) return {};
  const c = b.color;
  const v: Record<string, string> = { '--a-c1': c };
  if (b.fill === 'tint') {
    v['--a-surface'] = `color-mix(in oklch, ${c} 16%, var(--a-surface-solid))`;
    v['--a-surface-solid'] = `color-mix(in oklch, ${c} 16%, var(--a-surface-solid))`;
  } else if (b.fill === 'solid') {
    const dark = darkFill(c);
    v['--a-surface'] = c;
    v['--a-surface-solid'] = c;
    v['--a-ink'] = dark ? '#ffffff' : '#111113';
    v['--a-mute'] = dark ? 'rgba(255,255,255,.72)' : 'rgba(17,17,19,.62)';
    v['--a-line'] = dark ? 'rgba(255,255,255,.2)' : 'rgba(17,17,19,.12)';
    v['--a-c1'] = dark ? '#ffffff' : '#111113';
    v['--a-good'] = dark ? '#ffffff' : '#0f6b3d';
    v['--a-bad'] = dark ? '#ffe1dc' : '#a3281b';
  }
  return v as React.CSSProperties;
}

/** Белый текст на заливке, если он контрастнее чёрного (WCAG, с гамма-коррекцией). */
function darkFill(color: string): boolean {
  const m = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})/i);
  if (!m) return true;
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.05;
}

function Card({
  w,
  res,
  f,
  data,
  fresh,
  edit,
  idx,
  count,
  title,
  glass,
  ticks,
  block,
  dragging,
  custom,
}: {
  w: AuPlaced;
  res: AuraWidgetResult | undefined;
  f: Fmt;
  data: AuraData;
  fresh: boolean;
  edit?: AuEditHooks;
  idx: number;
  count: number;
  title: string;
  glass: boolean;
  ticks: boolean;
  block?: AuraBlockLayout;
  dragging?: boolean;
  custom?: AuraCustomWidget;
}) {
  // блок со своим периодом — ось и подписи графиков от его периода
  const bp = data.blockPeriods?.[w.key];
  const cd: AuraData = bp ? { ...data, period: { ...data.period, key: bp.key, granularity: bp.granularity, labels: bp.labels } } : data;
  const bucket = (l: string) => auBucketLabel(l, cd.period.granularity, f.lang);
  // подпись элемента списка: источники лидов, структура доходов, значения полей своих показателей
  const nameOf = (it: { key?: string; name: string }): string => {
    if (it.key?.startsWith('~')) return it.name;
    if (it.key === 'other' || it.name === 'other') return f.t('crm.aura.leadSource.other');
    if (w.key === 'fin_mix') return f.t(`crm.aura.incomeKind.${it.key}`);
    if (w.key === 'leads_src') return f.t(`crm.aura.leadSource.${it.key}`, { defaultValue: it.name });
    if (custom) return customValueLabel(f, custom, it.name);
    return it.name === '—' ? f.t('crm.aura.notSet') : it.name;
  };
  const ef: Fmt = { ...f, emptyText: emptyTextOf(f, w, custom) };
  const view = (() => {
    if (!res || 'error' in res) return null;
    return auView(res, block?.viz, block, {
      label: nameOf,
      bucket,
      cur: f.t('crm.aura.series.current'),
      prev: f.t('crm.aura.series.previous'),
      t: (k, o) => f.t(k, o) as string,
    });
  })();
  const body = (() => {
    if (w.type === 'note') return <Note text={block?.text || ''} f={f} />;
    if (w.type === 'section') return <Section text={block?.text || ''} f={f} />;
    if (!res) return <Empty text="—" />;
    if ('error' in res && res.error === 'locked') {
      const comps = custom
        ? [AU_DATASET_COMPONENT[custom.dataset] || 'custom_objects']
        : w.source !== 'extra' && w.source !== 'custom' && w.source !== 'deco'
          ? [AU_SOURCE_COMPONENT[w.source]]
          : [];
      return (
        <div className="dsh-locked">
          <span>{f.t('crm.aura.unlock.blockOff')}</span>
          <UnlockButton components={comps} compact />
        </div>
      );
    }
    if ('error' in res) {
      const src = w.source === 'extra' || w.source === 'custom' || w.source === 'deco' ? '' : f.t(`crm.aura.src.${w.source}.name`);
      return <Empty text={f.t(`crm.aura.err.${res.error}`, { source: src })} />;
    }
    const v = view as AuViewData;
    if (!hasData(v) && v.type !== 'kpi') return <Empty text={ef.emptyText!} />;
    switch (v.type) {
      case 'kpi':
        return <Kpi w={v} f={ef} ticks={ticks} mode={block?.viz} target={block?.target} />;
      case 'ring':
        return <Ring w={v} f={ef} />;
      case 'columns':
        return <Columns w={v} f={ef} labels={cd.period.labels.map(bucket)} />;
      case 'line':
        return <Line w={v} f={ef} data={cd} smooth={glass} area={block?.viz === 'area'} />;
      case 'donut':
        return <Donut w={v} f={ef} nameOf={nameOf} pie={block?.viz === 'pie'} />;
      case 'bar':
        return <Bars w={custom ? { ...v, items: v.items.map((x) => ({ ...x, name: nameOf({ name: x.name }) })) } : v} f={ef} />;
      case 'funnel':
        return <Funnel w={v} f={ef} />;
      case 'col':
      case 'col2':
        return <Cols w={v} f={ef} data={cd} />;
      case 'heat':
        return <Heat w={v} f={ef} />;
      case 'table':
        return <Table w={custom ? { ...v, rows: v.rows.map((r) => ('group' in r ? { ...r, group: nameOf({ name: String(r.group ?? '—') }) } : r)) } : v} f={ef} />;
      case 'list':
        return <List w={v} f={ef} />;
      case 'goal':
        return <Goal w={v} f={ef} onSetGoal={edit?.onSetGoal} />;
      case 'hero':
        return <Hero w={v} f={ef} />;
      case 'check':
        return <Check w={v} f={ef} />;
      case 'gauge':
        return <Gauge w={v} f={ef} k={w.key} />;
      case 'segbar':
        return <SegBar w={v} f={ef} />;
      case 'forecast':
        return <Forecast w={v} f={ef} />;
      case 'stream':
        return <Stream w={v} f={ef} />;
      case 'status':
        return <Status w={v} f={ef} />;
      case 'multi':
        return <Multi w={v} f={ef} data={cd} smooth={glass} />;
      case 'split':
        return <Split w={v} f={ef} />;
      case 'cal':
        return <Cal w={v} f={ef} />;
    }
    return null;
  })();
  const kpi = view && (view.type === 'kpi' || view.type === 'ring') ? view : null;
  const deco = w.type === 'note' || w.type === 'section';
  return (
    <div
      data-wkey={w.key}
      className={
        'dsh-card dsh-t-' + w.type + (deco ? ' dsh-deco' : '') + (fresh ? ' dsh-fresh' : '') + (block?.fill ? ' dsh-fill-' + block.fill : '') + (edit?.onOpen ? ' dsh-editable' : '') + (edit?.selected === w.key ? ' dsh-selected' : '') + (dragging ? ' dsh-dragging' : '')
      }
      style={{ gridColumn: `span ${w.span}`, ...blockVars(block) }}
      data-span={w.span <= 4 ? 'n' : w.span <= 6 ? 'm' : 'w'}
    >
      <i className="c tl" />
      <i className="c tr" />
      <i className="c bl" />
      <i className="c br" />
      <div className="dsh-card-h">
        <span>
          {w.type === 'stream' && (
            <i className="dsh-card-live" aria-hidden>
              <i />
            </i>
          )}
          {deco ? '' : title}
        </span>
        <span className="dsh-card-hr">
          {bp && <span className="dsh-pchip">{f.t(`crm.aura.period.${bp.key}`)}</span>}
          {kpi && kpi.delta && <span className={'dsh-pill ' + (kpi.good === true ? 'good' : kpi.good === false ? 'bad' : 'neutral')}>{deltaText(f, kpi.delta)}</span>}
          {edit && <CardMenu w={w} edit={edit} t={f.t} first={idx === 0} last={idx === count - 1} />}
        </span>
      </div>
      {body}
    </div>
  );
}

/* ---------- дашборд ---------- */

export type AuDashProps = {
  title: string;
  sources: AuraSourceKey[];
  widgets: string[];
  theme: AuraTheme;
  density: AuraDensity;
  data: AuraData | null;
  error?: string | null;
  period: AuraPeriod;
  onPeriod?: (p: AuraPeriod) => void;
  breakdown?: AuraFilterKey[];
  filters?: AuraFilters;
  onFilter?: (k: AuraFilterKey, v: string) => void;
  /** Сколько виджетов показать (анимация сборки); остальные — скелетоны. */
  reveal?: number;
  freshKey?: string | null;
  still?: boolean;
  edit?: AuEditHooks;
  updatedLabel?: string;
  /** Виджеты, собранные ИИ из данных CRM (ключи c_xxx). */
  custom?: AuraCustomWidget[];
  /** Свои цвета/скругление/шрифт поверх темы. */
  style?: AuraStyle | null;
  /** Ссылки в CRM внутри виджетов (приветствие, чек-лист) — только в приложении внутри CRM. */
  links?: boolean;
  /** Настройки блоков: ширина, цвет, заливка, название. */
  layout?: AuLayout | null;
  /** Порядок блоков задан вручную (без подъёма KPI наверх). */
  freeOrder?: boolean;
};

const FONT_STACK: Record<string, string> = {
  inter: "'Inter',sans-serif",
  geist: "'Geist',sans-serif",
  dm: "'DM Sans',sans-serif",
  bricolage: "'Bricolage Grotesque',sans-serif",
  barlow: "'Barlow',sans-serif",
  mono: "'Geist Mono','JetBrains Mono',monospace",
  serif: "Georgia,'Times New Roman',serif",
};

/** Яркость цвета (0..1) — чтобы заголовок на своём фоне оставался читаемым. */
function luminance(color: string): number | null {
  const m = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function auraStyleVars(st?: AuraStyle | null): React.CSSProperties {
  if (!st) return {};
  const v: Record<string, string> = {};
  if (st.bg) {
    v['--a-bg'] = st.bg;
    const l = luminance(st.bg);
    if (l != null) {
      v['--a-head-ink'] = l < 0.55 ? '#ffffff' : '#111113';
      v['--a-head-mute'] = l < 0.55 ? 'rgba(255,255,255,.72)' : 'rgba(17,17,19,.6)';
    }
  }
  if (st.surface) {
    v['--a-surface'] = st.surface;
    v['--a-surface-solid'] = st.surface;
    const l = luminance(st.surface);
    if (l != null && !st.ink) {
      v['--a-ink'] = l < 0.55 ? '#f4f4f5' : '#111113';
      v['--a-mute'] = l < 0.55 ? 'rgba(244,244,245,.65)' : '#80808a';
      v['--a-line'] = l < 0.55 ? 'rgba(255,255,255,.12)' : 'rgba(17,17,19,.09)';
    }
  }
  if (st.ink) v['--a-ink'] = st.ink;
  if (st.accent) v['--a-c1'] = st.accent;
  if (st.accent2) v['--a-c2'] = st.accent2;
  if (st.radius != null) v['--a-r'] = `${st.radius}px`;
  if (st.font && FONT_STACK[st.font]) {
    v['--a-fh'] = FONT_STACK[st.font];
    v['--a-fb'] = FONT_STACK[st.font];
  }
  return v as React.CSSProperties;
}

/** Крупные числа (KPI, итоги) уменьшают кегль, если не помещаются в карточку, — а не вылезают за неё. */
function useFitText(rootRef: React.RefObject<HTMLDivElement | null>, dep: unknown) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const fit = () =>
      root.querySelectorAll<HTMLElement>('.dsh-fit').forEach((el) => {
        el.style.fontSize = '';
        const sw = el.scrollWidth;
        const cw = el.clientWidth;
        if (cw > 0 && sw > cw + 1) {
          const base = parseFloat(getComputedStyle(el).fontSize) || 40;
          el.style.fontSize = `${Math.max(base * 0.45, (base * cw) / sw - 0.5)}px`;
        }
      });
    fit();
    // только при смене ширины: подгонка меняет высоту, и наблюдатель по высоте зациклился бы
    let lastW = root.clientWidth;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      if (root.clientWidth === lastW) return;
      lastW = root.clientWidth;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
    });
    ro.observe(root);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [rootRef, dep]);
}

/** FLIP: при смене порядка карточки плавно переезжают на новые места (с учётом масштаба превью). */
function useFlip(rootRef: React.RefObject<HTMLDivElement | null>, on: boolean) {
  // offsetLeft/Top — позиция в раскладке без transform (появление, подъём при наведении, масштаб превью не мешают)
  const prev = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!on || !root) return;
    const next = new Map<string, { x: number; y: number }>();
    root.querySelectorAll<HTMLElement>('.dsh-grid > [data-wkey]').forEach((el) => {
      const key = el.dataset.wkey!;
      const cur = { x: el.offsetLeft, y: el.offsetTop };
      next.set(key, cur);
      const was = prev.current.get(key);
      if (!was) return;
      const dx = was.x - cur.x;
      const dy = was.y - cur.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.7,.2,1)' });
    });
    prev.current = next;
  });
}

/** Блик жидкого стекла следует за курсором — координаты в CSS-переменных карточки под ним. */
function spotlight(e: React.PointerEvent<HTMLDivElement>) {
  if (e.pointerType !== 'mouse') return;
  const card = (e.target as HTMLElement).closest?.('.dsh-card') as HTMLElement | null;
  if (!card) return;
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
  card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
}

export function AuraDash(p: AuDashProps) {
  const { t, i18n } = useTranslation();
  const f: Fmt = { cur: p.data?.currency || 'EUR', lang: i18n.language || 'ru', t, links: !!p.links && !p.still };
  const glass = AU_GLASS.has(p.theme);
  const ticks = TICK_THEMES.has(p.theme);
  const layout = p.layout || {};
  // порядок во время перетаскивания живёт локально и уходит наверх только по отпусканию
  const [order, setOrder] = useState<string[] | null>(null);
  const [drag, setDrag] = useState<{ key: string; x: number; y: number; title: string } | null>(null);
  // пустую заметку показываем только в редакторе; блоки модулей, выключенных в pl1, — нигде, кроме редактора
  const isLocked = (k: string) => {
    const r = p.data?.widgets[k];
    return !!r && 'error' in r && r.error === 'locked';
  };
  const base = p.edit ? p.widgets : p.widgets.filter((k) => !(auIsDeco(k) && !layout[k]?.text?.trim()) && !isLocked(k));
  const widgets = order || base;
  // во время перетаскивания порядок — ровно визуальный, поэтому раскладка «свободная»
  const placed = auPack(widgets, p.custom || [], layout, !!p.freeOrder || !!order);
  const customById = new Map((p.custom || []).map((c) => [c.id, c]));
  const customTitle = new Map((p.custom || []).map((c) => [c.id, c.title]));
  const reveal = p.reveal ?? Infinity;
  // Адаптив по ширине самого дашборда (не container queries: их containment в части Chrome
  // обнулял высоту дашборда внутри масштабированного превью).
  const rootRef = useRef<HTMLDivElement>(null);
  const [wCls, setWCls] = useState('');
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const upd = () => {
      const w = el.clientWidth;
      setWCls(!w ? '' : w <= 480 ? ' dsh-w-sm dsh-w-xs' : w <= 760 ? ' dsh-w-sm' : '');
    };
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useFlip(rootRef, !!p.edit);
  useFitText(rootRef, p.data);
  const titleOf = (key: string) => layout[key]?.title || customTitle.get(key) || sourceTitle(t, key);
  const dragRef = useRef<{ key: string; order: string[]; last: string; x0: number; y0: number; on: boolean } | null>(null);
  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!p.edit?.onReorder || e.button !== 0) return;
    const el = e.target as HTMLElement;
    // тянем за ручку или за заголовок карточки, но не за кнопки
    if (!el.closest('[data-grip]') && !(el.closest('.dsh-card-h') && !el.closest('button'))) return;
    const card = el.closest('[data-wkey]') as HTMLElement | null;
    const key = card?.dataset.wkey;
    if (!key) return;
    e.preventDefault();
    const visual = placed.map((x) => x.key);
    dragRef.current = { key, order: visual, last: '', x0: e.clientX, y0: e.clientY, on: false };
    const move = (ev: PointerEvent) => {
      const st = dragRef.current;
      if (!st) return;
      // простой клик по заголовку — не перетаскивание
      if (!st.on) {
        if (Math.hypot(ev.clientX - st.x0, ev.clientY - st.y0) < 4) return;
        st.on = true;
        setOrder([...st.order]);
        setDrag({ key, x: ev.clientX, y: ev.clientY, title: titleOf(key) });
      }
      setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d));
      const over = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest('[data-wkey]') as HTMLElement | null;
      const target = over?.dataset.wkey;
      if (!over || !target || target === st.key) return;
      const r = over.getBoundingClientRect();
      const after = ev.clientX > r.left + r.width / 2;
      const sig = target + (after ? '>' : '<');
      if (sig === st.last) return;
      st.last = sig;
      const next = st.order.filter((k) => k !== st.key);
      next.splice(next.indexOf(target) + (after ? 1 : 0), 0, st.key);
      if (next.join() === st.order.join()) return;
      st.order = next;
      setOrder(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const st = dragRef.current;
      dragRef.current = null;
      if (!st?.on) return;
      setDrag(null);
      setOrder(null);
      if (st.order.join() !== visual.join()) p.edit?.onReorder?.(st.order);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  const updated =
    p.updatedLabel ??
    (p.data ? t('crm.aura.dash.updatedAt', { time: new Date(p.data.generatedAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }) }) : t('crm.aura.dash.loading'));
  return (
    <div
      ref={rootRef}
      className={`dsh dsh-th-${p.theme} dsh-d-${p.density}${wCls}${p.style ? ' dsh-custom' : ''}${glass ? ' dsh-glass' : ''}${p.still ? ' dsh-still' : ''}`}
      style={auraStyleVars(p.style)}
      onPointerMove={glass && !p.still ? spotlight : undefined}
    >
      {glass && (
        <div className="dsh-bgfx" aria-hidden>
          <i className="b1" />
          <i className="b2" />
          <i className="b3" />
        </div>
      )}
      <div className="dsh-head">
        <div className="dsh-head-l">
          <div className="dsh-kick">
            <span className="dsh-live">
              <i />
              Live
            </span>
            {p.sources.map((s) => t(`crm.aura.src.${s}.name`)).join(' · ')}
          </div>
          <h1 className="dsh-title">{p.title}</h1>
        </div>
        <div className="dsh-head-r">
          <div className="dsh-seg">
            {AU_PERIODS.map((k) =>
              p.still || !p.onPeriod ? (
                <span key={k} className={'dsh-seg-o' + (k === p.period ? ' on' : '')}>
                  {t(`crm.aura.period.${k}`)}
                </span>
              ) : (
                <button type="button" key={k} className={k === p.period ? 'on' : ''} onClick={() => p.onPeriod!(k)}>
                  {t(`crm.aura.period.${k}`)}
                </button>
              ),
            )}
          </div>
          {(p.breakdown || []).map((k) => {
            const opts = p.data?.filterOptions?.[k] || [];
            const val = p.filters?.[k] || '';
            return (
              <label key={k} className={'dsh-filter' + (val ? ' on' : '')}>
                <span>
                  {val
                    ? k === 'channel'
                      ? t(`crm.aura.leadSource.${val}`, { defaultValue: opts.find((o) => o.id === val)?.name || val })
                      : opts.find((o) => o.id === val)?.name || t(`crm.aura.filter.${k}`)
                    : t(`crm.aura.filter.${k}`)}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M6 9l6 6 6-6" />
                </svg>
                {!p.still && p.onFilter && (
                  <select value={val} onChange={(e) => p.onFilter!(k, e.target.value)} aria-label={t(`crm.aura.filter.${k}`)}>
                    <option value="">{t('crm.aura.filter.all')}</option>
                    {opts.map((o) => (
                      <option key={o.id} value={o.id}>
                        {k === 'channel' ? t(`crm.aura.leadSource.${o.id}`, { defaultValue: o.name }) : o.name}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            );
          })}
          <span className="dsh-upd">{updated}</span>
        </div>
      </div>
      {p.data?.own && !p.still && <div className="dsh-own">{t('crm.aura.dash.ownScope')}</div>}
      {p.error && !p.data && <div className="dsh-own dsh-err">{p.error}</div>}
      <div className={'dsh-grid' + (drag ? ' dsh-grid-drag' : '')} onPointerDown={p.edit?.onReorder ? startDrag : undefined}>
        {placed.map((w, i) =>
          i < reveal && (p.data || w.source === 'deco') ? (
            <Card
              key={w.key}
              w={w}
              res={p.data?.widgets[w.key]}
              f={f}
              data={p.data || EMPTY_DATA}
              fresh={w.key === p.freshKey}
              edit={p.edit}
              idx={widgets.indexOf(w.key)}
              count={widgets.length}
              title={titleOf(w.key)}
              glass={glass}
              ticks={ticks}
              block={layout[w.key]}
              dragging={drag?.key === w.key}
              custom={customById.get(w.key)}
            />
          ) : (
            <div key={w.key} data-wkey={w.key} className="dsh-card dsh-skel" style={{ gridColumn: `span ${w.span}` }}>
              <span />
              <span />
              <span />
            </div>
          ),
        )}
        {p.edit?.onAdd && p.data && reveal >= placed.length && (
          <button type="button" className="dsh-add-tile" onClick={p.edit.onAdd}>
            <span>+</span>
            {t('crm.aura.block.add')}
          </button>
        )}
      </div>
      {drag &&
        createPortal(
          <div className="dsh-drag-ghost" style={{ left: drag.x, top: drag.y }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden>
              <circle cx="9" cy="6" r="1.6" />
              <circle cx="15" cy="6" r="1.6" />
              <circle cx="9" cy="12" r="1.6" />
              <circle cx="15" cy="12" r="1.6" />
              <circle cx="9" cy="18" r="1.6" />
              <circle cx="15" cy="18" r="1.6" />
            </svg>
            {drag.title}
          </div>,
          document.body,
        )}
    </div>
  );
}

/* ---------- масштабирование превью ---------- */

export function AuScaled({ width = 1280, children, maxH, className = '', fill = false }: { width?: number; children: React.ReactNode; maxH?: number; className?: string; fill?: boolean }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(1);
  const [h, setH] = useState(0);
  // fill: на широком экране дашборд растягивается на всю ширину, а не остаётся 1280px с пустотой справа
  const [w, setW] = useState(width);
  useLayoutEffect(() => {
    let raf = 0;
    const measure = () => {
      if (!outer.current || !inner.current) return;
      // ширина контейнера; 0 бывает на первом кадре (Safari, 3D-карусель) — тогда берём родителя и перемеряем
      const w = outer.current.clientWidth || outer.current.parentElement?.clientWidth || 0;
      if (!w) {
        raf = requestAnimationFrame(measure);
        return;
      }
      const real = fill ? Math.max(width, w) : width;
      const sc = Math.min(1, w / real);
      setW(real);
      setS(sc);
      setH(inner.current.offsetHeight * sc);
    };
    const ro = new ResizeObserver(measure);
    if (outer.current) ro.observe(outer.current);
    if (inner.current) ro.observe(inner.current);
    measure();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [width, fill]);
  return (
    <div ref={outer} className={'au-scaled ' + className} style={{ height: maxH ? Math.min(h, maxH) : h }}>
      <div ref={inner} style={{ width: w, transform: `scale(${s})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  );
}

/** Миниатюра приложения/шаблона на реальных данных. */
export function AuThumb(props: Omit<AuDashProps, 'still' | 'onPeriod' | 'onFilter' | 'edit'>) {
  // рисуем дашборд, только когда миниатюра рядом с экраном: в галерее их десятки
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || on) return;
    if (typeof IntersectionObserver === 'undefined') {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        setOn(true);
        io.disconnect();
      }
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [on]);
  return (
    <div ref={ref} className={'au-thumb dsh-th-' + props.theme} style={auraStyleVars(props.style)}>
      {on && (
        <AuScaled width={1280} maxH={9999}>
          <AuraDash {...props} still />
        </AuScaled>
      )}
    </div>
  );
}
