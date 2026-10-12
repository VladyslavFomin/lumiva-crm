import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { AuraCustomWidget, AuraStyle, AuraData, AuraDensity, AuraFilterKey, AuraFilters, AuraPeriod, AuraSourceKey, AuraTheme, AuraWidgetData, AuraWidgetResult } from '../../api/aura';
import { AU_PERIODS, auBucketLabel, auFmt, auInitials, auPack, type AuPlaced } from './auraModel';

const C = ['var(--a-c1)', 'var(--a-c2)', 'var(--a-c3)', 'var(--a-c4)', 'var(--a-c5)'];

type Fmt = { cur: string; lang: string; t: TFunction };
const fmtVal = (f: Fmt, n: number | null | undefined, format: 'int' | 'money' | 'pct' | 'num', unit?: 'pcs', compact = false) =>
  auFmt(n, format, f.cur, f.lang, { unit, t: f.t, compact });

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

function Empty({ text }: { text: string }) {
  return <div className="dsh-empty">{text}</div>;
}

function deltaText(f: Fmt, d: { kind: 'pct' | 'pp'; value: number }) {
  const sign = d.value > 0 ? '+' : d.value < 0 ? '−' : '';
  const v = Math.abs(d.value).toLocaleString(f.lang.startsWith('en') ? 'en-US' : f.lang.startsWith('tr') ? 'tr-TR' : 'ru-RU', { maximumFractionDigits: 1 });
  return d.kind === 'pp' ? `${sign}${v} ${f.t('crm.aura.unit.pp')}` : `${sign}${v}%`;
}

/* ---------- тела виджетов ---------- */

function Kpi({ w, f }: { w: Extract<AuraWidgetData, { type: 'kpi' }>; f: Fmt }) {
  return (
    <div className="dsh-kpi">
      <div className="dsh-kpi-v">{fmtVal(f, w.value, w.format, w.unit)}</div>
      {w.spark ? <Spark data={w.spark} /> : <div className="dsh-spark dsh-spark-empty" />}
    </div>
  );
}

function Line({ w, f, data }: { w: Extract<AuraWidgetData, { type: 'line' }>; f: Fmt; data: AuraData }) {
  const id = useId().replace(/:/g, '');
  const [hv, setHv] = useState<number | null>(null);
  const series = [
    { name: f.t('crm.aura.series.current'), data: w.current, dash: false },
    { name: f.t('crm.aura.series.previous'), data: w.previous, dash: true },
  ];
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
          <span className="dsh-big">{fmtVal(f, w.total, w.format, undefined, true)}</span>
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
                <stop offset="0" style={{ stopColor: 'var(--a-c1)', stopOpacity: 0.2 }} />
                <stop offset="1" style={{ stopColor: 'var(--a-c1)', stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            {series.map((s, k) => {
              const d = s.data.map((v, j) => (j ? 'L' : 'M') + x(j).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
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

function Donut({ w, f, nameOf }: { w: Extract<AuraWidgetData, { type: 'donut' }>; f: Fmt; nameOf: (it: { key?: string; name: string }) => string }) {
  const tot = w.items.reduce((a, b) => a + b.value, 0);
  if (!tot) return <Empty text={f.t('crm.aura.empty')} />;
  const R = 15.9;
  const gap = w.items.length > 1 ? 1.4 : 0;
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
                style={{ fill: 'none', stroke: C[i % 5], strokeWidth: 4.5, strokeDasharray: `${Math.max(0, p - gap)} ${100 - p + gap}`, strokeDashoffset: 25 - acc, animationDelay: `${i * 0.06}s` }}
              />
            );
            acc += p;
            return el;
          })}
        </svg>
        <div className="dsh-donut-c">
          <b>{fmtVal(f, tot, w.format, undefined, true)}</b>
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
          <b className="dsh-fun-v">{fmtVal(f, s.value, 'int')}</b>
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
                  {i === mi && <b>{w.data[i]}</b>}
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
};

function CardMenu({ w, edit, t, first, last }: { w: AuPlaced; edit: AuEditHooks; t: TFunction; first: boolean; last: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="dsh-menu-wrap">
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

function Card({ w, res, f, data, fresh, edit, idx, count, title }: { w: AuPlaced; res: AuraWidgetResult | undefined; f: Fmt; data: AuraData; fresh: boolean; edit?: AuEditHooks; idx: number; count: number; title: string }) {
  const body = (() => {
    if (!res) return <Empty text="—" />;
    if ('error' in res) {
      const src = w.source === 'extra' || w.source === 'custom' ? '' : f.t(`crm.aura.src.${w.source}.name`);
      return <Empty text={f.t(`crm.aura.err.${res.error}`, { source: src })} />;
    }
    switch (res.type) {
      case 'kpi':
        return <Kpi w={res} f={f} />;
      case 'line':
        return <Line w={res} f={f} data={data} />;
      case 'donut':
        return (
          <Donut
            w={res}
            f={f}
            nameOf={(it) =>
              w.key === 'fin_mix' ? f.t(`crm.aura.incomeKind.${it.key}`) : w.key === 'leads_src' ? f.t(`crm.aura.leadSource.${it.key}`, { defaultValue: it.name }) : it.key === 'other' ? f.t('crm.aura.leadSource.other') : it.name
            }
          />
        );
      case 'bar':
        return <Bars w={res} f={f} />;
      case 'funnel':
        return <Funnel w={res} f={f} />;
      case 'col':
      case 'col2':
        return <Cols w={res} f={f} data={data} />;
      case 'heat':
        return <Heat w={res} f={f} />;
      case 'table':
        return <Table w={res} f={f} />;
      case 'list':
        return <List w={res} f={f} />;
      case 'goal':
        return <Goal w={res} f={f} onSetGoal={edit?.onSetGoal} />;
    }
    return null;
  })();
  const kpi = res && !('error' in res) && res.type === 'kpi' ? res : null;
  return (
    <div className={'dsh-card dsh-t-' + w.type + (fresh ? ' dsh-fresh' : '')} style={{ gridColumn: `span ${w.span}` }}>
      <i className="c tl" />
      <i className="c tr" />
      <i className="c bl" />
      <i className="c br" />
      <div className="dsh-card-h">
        <span>{title}</span>
        <span className="dsh-card-hr">
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

export function AuraDash(p: AuDashProps) {
  const { t, i18n } = useTranslation();
  const f: Fmt = { cur: p.data?.currency || 'EUR', lang: i18n.language || 'ru', t };
  const placed = auPack(p.widgets, p.custom || []);
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
  const updated =
    p.updatedLabel ??
    (p.data ? t('crm.aura.dash.updatedAt', { time: new Date(p.data.generatedAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }) }) : t('crm.aura.dash.loading'));
  return (
    <div ref={rootRef} className={`dsh dsh-th-${p.theme} dsh-d-${p.density}${wCls}${p.style ? ' dsh-custom' : ''}`} style={auraStyleVars(p.style)}>
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
      <div className="dsh-grid">
        {placed.map((w, i) =>
          i < reveal && p.data ? (
            <Card key={w.key} w={w} res={p.data.widgets[w.key]} f={f} data={p.data} fresh={w.key === p.freshKey} edit={p.edit} idx={p.widgets.indexOf(w.key)} count={p.widgets.length} title={customTitle.get(w.key) || sourceTitle(t, w.key)} />
          ) : (
            <div key={w.key} className="dsh-card dsh-skel" style={{ gridColumn: `span ${w.span}` }}>
              <span />
              <span />
              <span />
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/* ---------- масштабирование превью ---------- */

export function AuScaled({ width = 1280, children, maxH, className = '' }: { width?: number; children: React.ReactNode; maxH?: number; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(1);
  const [h, setH] = useState(0);
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
      const sc = Math.min(1, w / width);
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
  }, [width]);
  return (
    <div ref={outer} className={'au-scaled ' + className} style={{ height: maxH ? Math.min(h, maxH) : h }}>
      <div ref={inner} style={{ width, transform: `scale(${s})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  );
}

/** Миниатюра приложения/шаблона на реальных данных. */
export function AuThumb(props: Omit<AuDashProps, 'still' | 'onPeriod' | 'onFilter' | 'edit'>) {
  return (
    <div className={'au-thumb dsh-th-' + props.theme} style={auraStyleVars(props.style)}>
      <AuScaled width={1280} maxH={9999}>
        <AuraDash {...props} still />
      </AuScaled>
    </div>
  );
}
