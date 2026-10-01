/**
 * ROI по клиентам — части макета Claude Design (components/roi-parts.jsx): форматирование,
 * выбор периода по месяцам, график динамики, спарклайны, диалог импорта выручки.
 * Суммы приходят с сервера уже в валюте отчёта (курс ECB), поэтому пересчёта курсом здесь нет.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';

export const px = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

/** Формат чисел по языку интерфейса. */
export function makeFormat(locale: string) {
  const nf0 = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  return {
    n0: (v: number) => nf0.format(v),
    n1: (v: number) => nf1.format(v),
    n2: (v: number) => nf2.format(v),
    compact: (v: number, mln: string, k: string) => {
      const a = Math.abs(v);
      return a >= 1e6 ? `${nf1.format(v / 1e6)} ${mln}` : a >= 1e3 ? `${nf0.format(v / 1e3)} ${k}` : nf2.format(v);
    },
    /** ROI — доля (0.25 = +25%). */
    roi: (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : ''}${nf1.format(v * 100)}%`),
    roas: (v: number | null | undefined) => (v == null ? '—' : `${nf2.format(v)}×`),
  };
}
export type Fmt = ReturnType<typeof makeFormat>;

export type Agg = { s: number; r: number; cl: number; cv: number };
export type Metrics = Agg & { roi: number | null; roas: number | null; cpc: number | null; cpa: number | null };
export const metrics = (a: Agg): Metrics => ({
  ...a,
  roi: a.s ? (a.r - a.s) / a.s : null,
  roas: a.s ? a.r / a.s : null,
  cpc: a.cl ? a.s / a.cl : null,
  cpa: a.cv ? a.s / a.cv : null,
});

export type SeriesPoint = Metrics & { key: string; y: number; m: number };

export const Ico: React.FC<{ d: React.ReactNode; s?: number }> = ({ d, s = 14 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

export const PI = {
  cal: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  l: <path d="M15 6l-6 6 6 6" />,
  r: <path d="M9 6l6 6-6 6" />,
  chk: <path d="M5 12l4 4 10-10" />,
  x: <path d="M6 6l12 12M6 18L18 6" />,
  up: (
    <>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 20h16" />
    </>
  ),
};

export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = () => setW(el.getBoundingClientRect().width);
    m();
    const ro = new ResizeObserver(m);
    ro.observe(el);
    window.addEventListener('resize', m);
    const t = window.setTimeout(m, 60);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', m);
      window.clearTimeout(t);
    };
  }, []);
  return [ref, w];
}

const niceStep = (v: number) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};

/** Месяцы, доступные в выборе периода: последние N месяцев до текущего включительно. */
export type MonthInfo = { key: string; y: number; m: number };
export function buildMonths(count = 36): MonthInfo[] {
  const now = new Date();
  const out: MonthInfo[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({ key: d.toISOString().slice(0, 7), y: d.getUTCFullYear(), m: d.getUTCMonth() });
  }
  return out;
}
export function monthNames(locale: string) {
  const short = Array.from({ length: 12 }, (_, m) =>
    new Date(Date.UTC(2024, m, 1)).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }).replace('.', ''),
  );
  const long = Array.from({ length: 12 }, (_, m) =>
    new Date(Date.UTC(2024, m, 1)).toLocaleDateString(locale, { month: 'long', timeZone: 'UTC' }),
  );
  return { short, long };
}

/* ---------- Выбор периода ---------- */
export const PeriodPicker: React.FC<{
  months: MonthInfo[];
  value: { from: number; to: number };
  onChange: (v: { from: number; to: number }) => void;
  locale: string;
  t: TFunction;
}> = ({ months: M, value, onChange, locale, t }) => {
  const last = M.length - 1;
  const MS = useMemo(() => monthNames(locale).short, [locale]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const minYear = M[0].y;
  const maxYear = M[last].y;
  const [y0, setY0] = useState(Math.max(minYear, maxYear - 1));
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const idx = (y: number, m: number) => M.findIndex((x) => x.y === y && x.m === m);
  const lo = anchor != null ? Math.min(anchor, hover ?? anchor) : draft.from;
  const hi = anchor != null ? Math.max(anchor, hover ?? anchor) : draft.to;
  const pick = (i: number) => {
    if (anchor == null) {
      setAnchor(i);
      setDraft({ from: i, to: i });
    } else {
      setDraft({ from: Math.min(anchor, i), to: Math.max(anchor, i) });
      setAnchor(null);
    }
  };
  const yearStart = idx(maxYear, 0);
  const prevYearStart = idx(maxYear - 1, 0);
  const prevYearEnd = idx(maxYear - 1, 11);
  const presets = [
    { l: t('crm.marketingRoi.pp.last3', { defaultValue: 'Последние 3 месяца' }), f: last - 2, t: last },
    { l: t('crm.marketingRoi.pp.last6', { defaultValue: 'Последние 6 месяцев' }), f: last - 5, t: last },
    { l: t('crm.marketingRoi.pp.last12', { defaultValue: 'Последние 12 месяцев' }), f: last - 11, t: last },
    ...(yearStart >= 0 ? [{ l: t('crm.marketingRoi.pp.ytd', { defaultValue: 'С начала {{y}} года', y: maxYear }), f: yearStart, t: last }] : []),
    ...(prevYearStart >= 0 && prevYearEnd >= 0
      ? [{ l: t('crm.marketingRoi.pp.year', { defaultValue: '{{y}} год', y: maxYear - 1 }), f: prevYearStart, t: prevYearEnd }]
      : []),
    { l: t('crm.marketingRoi.pp.all', { defaultValue: 'Всё время' }), f: 0, t: last },
  ].filter((p) => p.f >= 0);
  const lbl = (i: number) => `${MS[M[i].m]} ${M[i].y}`;
  const n = value.to - value.from + 1;
  const monthsLbl = t('crm.marketingRoi.pp.monthsShort', { defaultValue: 'мес' });
  const toggle = () => {
    setDraft(value);
    setAnchor(null);
    setOpen(!open);
  };
  return (
    <div className="roi-pp" ref={ref}>
      <button type="button" className={px('roi-pp-t', open && 'on')} onClick={toggle} aria-expanded={open}>
        <Ico d={PI.cal} />
        <span>
          {lbl(value.from)} — {lbl(value.to)}
        </span>
        <em>
          {n} {monthsLbl}
        </em>
      </button>
      {open && (
        <div className="roi-pp-pop">
          <div className="roi-pp-pre">
            <div className="kick">{t('crm.marketingRoi.pp.title', { defaultValue: 'Период' })}</div>
            {presets.map((p) => (
              <button
                type="button"
                key={p.l}
                className={px(draft.from === p.f && draft.to === p.t && 'on')}
                onClick={() => {
                  setDraft({ from: p.f, to: p.t });
                  setAnchor(null);
                }}
              >
                {p.l}
              </button>
            ))}
          </div>
          <div className="roi-pp-cal">
            <div className="roi-pp-nav">
              <button type="button" className="roi-ib" disabled={y0 <= minYear} onClick={() => setY0(y0 - 1)} aria-label="‹">
                <Ico d={PI.l} />
              </button>
              <span>
                {anchor != null
                  ? t('crm.marketingRoi.pp.pickLast', { defaultValue: 'Выберите последний месяц' })
                  : t('crm.marketingRoi.pp.pickFirst', { defaultValue: 'Выберите первый месяц' })}
              </span>
              <button type="button" className="roi-ib" disabled={y0 + 1 >= maxYear} onClick={() => setY0(y0 + 1)} aria-label="›">
                <Ico d={PI.r} />
              </button>
            </div>
            <div className="roi-pp-years">
              {[y0, y0 + 1].map((y) => (
                <div key={y} className="roi-pp-year">
                  <div className="yh">{y}</div>
                  <div className="grid" onMouseLeave={() => setHover(null)}>
                    {MS.map((s, m) => {
                      const i = idx(y, m);
                      const dis = i < 0;
                      const inR = !dis && i >= lo && i <= hi;
                      return (
                        <button
                          type="button"
                          key={m}
                          disabled={dis}
                          onMouseEnter={() => !dis && setHover(i)}
                          onClick={() => pick(i)}
                          className={px(inR && 'in', i === lo && 'st', i === hi && 'en')}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="roi-pp-foot">
              <span className="mono">
                {lbl(draft.from)} — {lbl(draft.to)} · {draft.to - draft.from + 1} {monthsLbl}
              </span>
              <div style={{ flex: 1 }} />
              <button type="button" className="roi-btn" onClick={() => setOpen(false)}>
                {t('crm.marketingRoi.cancel', { defaultValue: 'Отмена' })}
              </button>
              <button
                type="button"
                className="roi-btn pri"
                disabled={anchor != null}
                onClick={() => {
                  onChange(draft);
                  setOpen(false);
                }}
              >
                {t('crm.marketingRoi.apply', { defaultValue: 'Применить' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------- График динамики ---------- */
export type ChartMode = 'sr' | 'roas' | 'cpc';
export const TrendChart: React.FC<{
  data: SeriesPoint[];
  mode: ChartMode;
  cur: string;
  h?: number;
  F: Fmt;
  locale: string;
  t: TFunction;
  /** Подпись метрики «расход / клики» — на ROI по менеджерам это CPL (расход / лид). */
  cpcLabel?: string;
}> = ({ data, mode, cur, h = 240, F, locale, t, cpcLabel = 'CPC' }) => {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const { short: MS, long: MN } = useMemo(() => monthNames(locale), [locale]);
  const mln = t('crm.marketingRoi.mln', { defaultValue: 'млн' });
  const k = t('crm.marketingRoi.thousand', { defaultValue: 'тыс' });
  const P = { l: 58, r: 12, t: 14, b: 26 };
  const iw = Math.max(0, w - P.l - P.r);
  const ih = h - P.t - P.b;
  const n = data.length;
  const col = n ? iw / n : 0;
  const val = (d: SeriesPoint) => (mode === 'roas' ? d.roas : mode === 'cpc' ? d.cpc : null);
  let max =
    mode === 'sr'
      ? Math.max(1, ...data.map((d) => Math.max(d.s, d.r)))
      : Math.max(mode === 'roas' ? 1.2 : 0.01, ...data.map((d) => val(d) || 0));
  const step = niceStep(max / 4);
  max = Math.ceil(max / step) * step;
  const y = (v: number) => P.t + ih - (v / max) * ih;
  const ticks: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(v);
  const bw = Math.min(18, col * 0.3);
  const pts = mode === 'roas' ? data.map((d, i) => (d.roas == null ? null : ([P.l + col * i + col / 2, y(d.roas)] as [number, number]))) : [];
  const path = pts.reduce((a, p, i) => (p ? a + (a && pts[i - 1] ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1) : a), '');
  const d = hi != null ? data[hi] : null;
  const tipX = hi != null ? P.l + col * hi + col / 2 : 0;
  // Сколько подписей месяцев влезает по оси X (≈34px на подпись), и узкий режим подсказки для телефона.
  const maxL = Math.max(4, Math.min(18, Math.floor((w - P.l - P.r) / 34)));
  const narrow = w > 0 && w < 520;
  const lStep = Math.ceil(data.length / maxL);
  return (
    <div className="roi-ch" ref={ref} style={{ height: h }}>
      {w > 0 && (
        <svg width={w} height={h}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={P.l} x2={w - P.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'ax' : 'gl'} />
              <text x={P.l - 8} y={y(v) + 3.5} className="yl" textAnchor="end">
                {mode === 'roas' ? `${F.n1(v)}×` : F.compact(v, mln, k)}
              </text>
            </g>
          ))}
          {mode === 'roas' && (
            <g>
              <line x1={P.l} x2={w - P.r} y1={y(1)} y2={y(1)} className="be" />
              <text x={w - P.r} y={y(1) - 5} className="bel" textAnchor="end">
                {t('crm.marketingRoi.breakEven', { defaultValue: 'окупаемость 1×' })}
              </text>
            </g>
          )}
          {data.map((dd, i) => {
            const cx = P.l + col * i + col / 2;
            return (
              <g key={dd.key} className={px('col', hi === i && 'hi')}>
                {hi === i && <rect x={P.l + col * i + 1} y={P.t} width={Math.max(0, col - 2)} height={ih} className="band" />}
                {mode === 'sr' && (
                  <>
                    <rect x={cx - bw - 1} y={y(dd.s)} width={bw} height={Math.max(0, ih + P.t - y(dd.s))} className="b-s" />
                    <rect x={cx + 1} y={y(dd.r)} width={bw} height={Math.max(0, ih + P.t - y(dd.r))} className="b-r" />
                  </>
                )}
                {mode === 'cpc' && dd.cpc != null && (
                  <rect x={cx - bw / 2} y={y(dd.cpc)} width={bw} height={Math.max(0, ih + P.t - y(dd.cpc))} className="b-r" />
                )}
                {(dd.m === 0 || n <= maxL || (i % lStep === 0 && !data.slice(Math.max(0, i - lStep + 1), i + lStep).some((x) => x.m === 0))) && (
                  <text x={cx} y={h - 8} textAnchor="middle" className={px('xl', dd.m === 0 && 'yr')}>
                    {dd.m === 0 ? dd.y : MS[dd.m]}
                  </text>
                )}
              </g>
            );
          })}
          {mode === 'roas' && (
            <>
              <path d={path} className="ln" />
              {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={hi === i ? 4.5 : 3} className={px('dt', (data[i].roas ?? 0) < 1 && 'neg')} />)}
            </>
          )}
          {data.map((dd, i) => (
            <rect key={`h${dd.key}`} x={P.l + col * i} y={0} width={col} height={h} fill="transparent" onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} />
          ))}
        </svg>
      )}
      {d && (
        <div
          className={px('roi-tip', narrow ? 'mid' : tipX > w * 0.66 && 'lft')}
          style={{ left: narrow ? Math.min(Math.max(tipX, 105), w - 105) : tipX }}
        >
          <div className="th">
            {MN[d.m]} {d.y}
          </div>
          <div className="tr">
            <i className="s" />
            {t('crm.marketingRoi.kpiSpend', { defaultValue: 'Расход' })}
            <b>
              {F.n0(d.s)} {cur}
            </b>
          </div>
          <div className="tr">
            <i className="r" />
            {t('crm.marketingRoi.kpiRevenue', { defaultValue: 'Выручка' })}
            <b>
              {F.n0(d.r)} {cur}
            </b>
          </div>
          <div className="tr">
            ROI<b className={d.roi != null ? (d.roi > 0 ? 'pos' : d.roi < 0 ? 'neg' : '') : ''}>{F.roi(d.roi)}</b>
          </div>
          <div className="tr">
            ROAS<b>{F.roas(d.roas)}</b>
          </div>
          <div className="tr">
            {cpcLabel}<b>{d.cpc == null ? '—' : `${F.n2(d.cpc)} ${cur}`}</b>
          </div>
        </div>
      )}
    </div>
  );
};

export const Spark: React.FC<{ vals: Array<number | null>; neg?: boolean[] }> = ({ vals, neg }) => {
  const mx = Math.max(1e-9, ...vals.map((v) => Math.abs(v || 0)));
  return (
    <svg className="roi-spark" viewBox={`0 0 ${Math.max(1, vals.length) * 6} 26`} preserveAspectRatio="none" aria-hidden="true">
      {vals.map((v, i) => {
        const hh = Math.max(1, (Math.abs(v || 0) / mx) * 24);
        return <rect key={i} x={i * 6 + 1} y={26 - hh} width="4" height={hh} className={px(i === vals.length - 1 && 'last', neg && neg[i] && 'neg')} />;
      })}
    </svg>
  );
};

/** Разбор таблицы выручки: Excel/Google Sheets копируют через Tab; CSV — ; или ,. */
export function parseRevenueTable(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const cells = lines.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, '')));
  const looksLikeHeader =
    !/\d/.test(cells[0][2] || '') || /компан|client|company|şirket|месяц|month|\bay\b|revenue|выручк/i.test(cells[0].join(' '));
  return (looksLikeHeader ? cells.slice(1) : cells).map(([company, month, amount, currency]) => ({
    company,
    month,
    amount: (amount || '').replace(/\s/g, ''),
    currency: currency || undefined,
  }));
}

/* ---------- Импорт выручки ---------- */
export const ImportDialog: React.FC<{
  onClose: () => void;
  onImport: (rows: ReturnType<typeof parseRevenueTable>) => Promise<{ imported: number; skipped: Array<{ row: number; reason: string }> }>;
  t: TFunction;
}> = ({ onClose, onImport, t }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | { imported: number; skipped: Array<{ row: number; reason: string }> }>(null);
  const [err, setErr] = useState<string | null>(null);
  const rows = useMemo(() => parseRevenueTable(text), [text]);
  const downloadTemplate = () => {
    const csv = 'client;month;revenue;currency\nThe Norm Hotels;2026-08;8450000;TRY\nSelectum Hotels;2026-08;2310000;TRY\n';
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roi-revenue-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="roi-dlg-bd" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="roi-dlg" role="dialog" aria-label={t('crm.marketingRoi.importTitle', { defaultValue: 'Импорт выручки' })}>
        <header>
          <h3>{t('crm.marketingRoi.importButton', { defaultValue: 'Импорт выручки' })}</h3>
          <button type="button" className="roi-ib" onClick={onClose} aria-label="×">
            <Ico d={PI.x} />
          </button>
        </header>
        <p>
          {t('crm.marketingRoi.importIntro', {
            defaultValue:
              'Загрузите CSV (Excel → «Сохранить как CSV») или вставьте таблицу: по строке на клиента и месяц. Совпадающие месяцы перезапишут введённые вручную суммы. Клиент ищется по названию компании в CRM.',
          })}
        </p>
        <label className={px('roi-drop', fileName && 'has')}>
          <input
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 5 * 1024 * 1024) {
                setErr(t('crm.marketingRoi.fileTooBig', { defaultValue: 'Файл больше 5 МБ' }));
                return;
              }
              setErr(null);
              setFileName(f.name);
              setText(await f.text());
              setResult(null);
            }}
          />
          <Ico d={PI.up} s={20} />
          <span>{fileName ?? t('crm.marketingRoi.dropHint', { defaultValue: 'Выберите файл на компьютере' })}</span>
          <em>CSV · TSV · {t('crm.marketingRoi.upTo5mb', { defaultValue: 'до 5 МБ' })}</em>
        </label>
        <textarea
          className="roi-ta"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          placeholder={t('crm.marketingRoi.pastePlaceholder', { defaultValue: '…или вставьте строки из таблицы сюда' })}
        />
        <table className="roi-fmt">
          <thead>
            <tr>
              <th>client</th>
              <th>month</th>
              <th>revenue</th>
              <th>currency</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>The Norm Hotels</td>
              <td>2026-08</td>
              <td>8450000</td>
              <td>TRY</td>
            </tr>
            <tr>
              <td>Selectum Hotels</td>
              <td>2026-08</td>
              <td>2310000</td>
              <td>TRY</td>
            </tr>
          </tbody>
        </table>
        {err && <div className="roi-res"><span className="bad">{err}</span></div>}
        {result && (
          <div className="roi-res">
            <span className="ok">{t('crm.marketingRoi.imported', { defaultValue: 'Импортировано: {{n}}', n: result.imported })}</span>
            {result.skipped.slice(0, 12).map((s) => (
              <span key={s.row} className="bad">
                {t('crm.marketingRoi.skippedRow', { defaultValue: 'Строка {{row}}: {{reason}}', row: s.row, reason: s.reason })}
              </span>
            ))}
          </div>
        )}
        <footer>
          <button type="button" className="roi-lk" onClick={downloadTemplate}>
            {t('crm.marketingRoi.downloadTemplate', { defaultValue: 'Скачать шаблон' })}
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="roi-btn" onClick={onClose}>
            {result ? t('crm.marketingRoi.close', { defaultValue: 'Закрыть' }) : t('crm.marketingRoi.cancel', { defaultValue: 'Отмена' })}
          </button>
          <button
            type="button"
            className="roi-btn pri"
            disabled={!rows.length || busy}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                setResult(await onImport(rows));
              } catch (e: unknown) {
                setErr(e instanceof Error ? e.message : 'Error');
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('crm.marketingRoi.importRun', { defaultValue: 'Импортировать ({{n}} строк)', n: rows.length })}
          </button>
        </footer>
      </div>
    </div>
  );
};
