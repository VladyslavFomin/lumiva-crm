/**
 * ROI по клиентам — редизайн по макету Claude Design (roi-clients.html), на реальных данных:
 * расход привязанных рекламных кабинетов против выручки клиента из выбранных источников
 * (ввод/импорт, ценность конверсий площадок, GA4, продажи CRM), сравнение с прошлым периодом,
 * динамика, окупаемость по клиентам и раскрытие клиента с помесячным вводом выручки.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { getLocale } from '../../i18n/utils';
import { createCompany } from '../../api/companies';
import {
  createRoiWorkspaceTable,
  fetchRoiAccounts,
  fetchRoiReport,
  importRoiRevenue,
  setRoiAccountClient,
  setRoiMetaActions,
  upsertRoiRevenue,
  type RoiAccount,
  type RoiClientRow,
  type RoiReport,
} from '../../api/marketing';
import {
  buildMonths,
  ImportDialog,
  Ico,
  makeFormat,
  metrics,
  monthNames,
  PeriodPicker,
  px,
  Spark,
  TrendChart,
  useWidth,
  type ChartMode,
  type Fmt,
  type Metrics,
  type SeriesPoint,
} from './roi/RoiParts';
import { RoiAccountsDialog } from './roi/RoiAccountsDialog';
import './roi/roiDesign.css';

const CURRENCIES = ['TRY', 'EUR', 'USD'] as const;
const SOURCE_KEYS = ['manual', 'ads', 'ga4', 'crm'] as const;
type SourceKey = (typeof SOURCE_KEYS)[number];
type SrcState = Record<SourceKey, boolean>;
const LS_CUR = 'lumiva_roi_currency_v1';
const LS_SRC = 'lumiva_roi_sources_v2';

const AI = {
  chev: <path d="M9 6l6 6-6 6" />,
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  ws: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 10h18M9 10v10" />
    </>
  ),
  imp: (
    <>
      <path d="M12 4v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  warn: (
    <>
      <path d="M12 3l9.5 17h-19z" />
      <path d="M12 10v4M12 17v.01" />
    </>
  ),
  x: <path d="M6 6l12 12M6 18L18 6" />,
  srch: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.5-4.5" />
    </>
  ),
};

/** Платформа кабинета для значка: G — Google Ads, M — Meta, GA — GA4, Я — Яндекс, VK. */
const platformOf = (provider: string) =>
  provider === 'google_ads'
    ? 'google'
    : provider === 'meta_ads'
      ? 'meta'
      : provider === 'ga4'
        ? 'ga4'
        : provider.startsWith('yandex')
          ? 'yandex'
          : provider === 'vk_ads'
            ? 'vk'
            : 'other';
const PLAT_GLYPH: Record<string, string> = {
  google: 'G',
  meta: 'M',
  ga4: 'GA',
  yandex: 'Я',
  vk: 'VK',
  other: '·',
};
const PLAT_LABEL: Record<string, string> = {
  google: 'Google Ads',
  meta: 'Meta Ads',
  ga4: 'Google Analytics 4',
  yandex: 'Яндекс',
  vk: 'VK Реклама',
  other: '',
};
const Plat: React.FC<{ provider: string }> = ({ provider }) => {
  const p = platformOf(provider);
  return (
    <i className={`roi-plat ${p}`} title={PLAT_LABEL[p]}>
      {PLAT_GLYPH[p]}
    </i>
  );
};

/** Месяц 'YYYY-MM' со сдвигом. */
const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
};

const EMPTY: Metrics = metrics({ s: 0, r: 0, cl: 0, cv: 0 });
const aggOf = (m?: { spend: number; revenue: number; clicks: number; conversions: number }) =>
  m ? metrics({ s: m.spend, r: m.revenue, cl: m.clicks, cv: m.conversions }) : EMPTY;

function seriesOf(clients: RoiClientRow[], months: string[]): SeriesPoint[] {
  return months.map((key) => {
    let s = 0;
    let r = 0;
    let cl = 0;
    let cv = 0;
    for (const c of clients) {
      const mo = c.months[key];
      if (!mo) continue;
      s += mo.spend;
      r += mo.revenue;
      cl += mo.clicks;
      cv += mo.conversions;
    }
    const [y, m] = key.split('-').map(Number);
    return { ...metrics({ s, r, cl, cv }), key, y, m: m - 1 };
  });
}

const RoiPill: React.FC<{ v: number | null; F: Fmt }> = ({ v, F }) => (
  <span className={px('roi-pill', v != null && v > 0 && 'pos', v != null && v < 0 && 'neg')}>{F.roi(v)}</span>
);

/** Ввод выручки месяца (в валюте отчёта). Пустое значение удаляет введённую сумму. */
/** Телефонная раскладка: карточки вместо широких таблиц. */
function useIsMobile(q = '(max-width: 767px)') {
  const [v, setV] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setV(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return v;
}

const RevInput: React.FC<{
  value: number;
  disabled?: boolean;
  autoFocus?: boolean;
  F: Fmt;
  onCommit: (raw: string) => void;
  onDone?: () => void;
}> = ({ value, disabled, autoFocus, F, onCommit, onDone }) => {
  const [txt, setTxt] = useState<string | null>(null);
  const shown = txt != null ? txt : value ? F.n0(value) : '';
  return (
    <input
      className="roi-in"
      inputMode="decimal"
      placeholder="—"
      disabled={disabled}
      autoFocus={autoFocus}
      value={shown}
      onClick={(e) => e.stopPropagation()}
      onFocus={() => setTxt(value ? String(Math.round(value)) : '')}
      onChange={(e) => setTxt(e.target.value.replace(/[^\d.,]/g, ''))}
      onBlur={() => {
        const next = (txt ?? '').trim();
        const prev = value ? String(Math.round(value)) : '';
        setTxt(null);
        if (next !== prev) onCommit(next);
        onDone?.();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setTxt(value ? String(Math.round(value)) : '');
          onDone?.();
        }
      }}
    />
  );
};

export const RoiPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = getLocale(i18n.language);
  const F = useMemo(() => makeFormat(locale), [locale]);
  const MN = useMemo(() => monthNames(locale).long, [locale]);
  const MONTHS = useMemo(() => buildMonths(36), []);
  const last = MONTHS.length - 1;

  const [period, setPeriod] = useState({ from: last - 11, to: last });
  const [cur, setCur] = useState<string>(() => {
    try {
      const v = localStorage.getItem(LS_CUR) || 'TRY';
      return (CURRENCIES as readonly string[]).includes(v) ? v : 'TRY';
    } catch {
      return 'TRY';
    }
  });
  const [src, setSrc] = useState<SrcState>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(LS_SRC) || 'null') as SrcState | null;
      if (v && SOURCE_KEYS.some((k) => v[k])) return { manual: !!v.manual, ads: !!v.ads, ga4: !!v.ga4, crm: !!v.crm };
    } catch {
      /* ignore */
    }
    return { manual: true, ads: true, ga4: true, crm: true };
  });
  const [report, setReport] = useState<RoiReport | null>(null);
  const [prevReport, setPrevReport] = useState<RoiReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<{ k: string; d: number }>({ k: 's', d: -1 });
  const [mode, setMode] = useState<ChartMode>('sr');
  /** Ячейка выручки «компания|месяц», где открыт ручной ввод. */
  const [editingRev, setEditingRev] = useState<string | null>(null);
  /** Режим графика в раскрытии клиента — по клиенту. */
  const [detailMode, setDetailMode] = useState<Record<string, ChartMode>>({});
  const [focus, setFocus] = useState('all');
  const [q, setQ] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [crmBanner, setCrmBanner] = useState(true);
  const [accounts, setAccounts] = useState<RoiAccount[]>([]);
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [twRef, tw] = useWidth<HTMLDivElement>();
  const isMobile = useIsMobile();

  const fromKey = MONTHS[period.from].key;
  const toKey = MONTHS[period.to].key;
  const len = period.to - period.from + 1;
  const sources = SOURCE_KEYS.filter((k) => src[k]);
  const sourcesKey = sources.join(',');

  useEffect(() => {
    try {
      localStorage.setItem(LS_CUR, cur);
      localStorage.setItem(LS_SRC, JSON.stringify(src));
    } catch {
      /* ignore */
    }
  }, [cur, src]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const list = sourcesKey ? sourcesKey.split(',') : [];
    try {
      const [now, prev] = await Promise.all([
        fetchRoiReport({
          from: fromKey,
          to: toKey,
          currency: cur,
          sources: list,
        }),
        // Прошлый период той же длины — для дельт в KPI.
        fetchRoiReport({
          from: shiftMonth(fromKey, -len),
          to: shiftMonth(fromKey, -1),
          currency: cur,
          sources: list,
        }).catch(() => null),
      ]);
      setReport(now);
      setPrevReport(prev);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [fromKey, toKey, cur, sourcesKey, len]);

  const loadAccounts = useCallback(async () => {
    const res = await fetchRoiAccounts();
    setAccounts(res.accounts);
    setCompanies(res.companies);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void loadAccounts().catch(() => {});
  }, [loadAccounts]);

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const clients = report?.clients ?? [];
  const months = report?.months ?? [];
  const m = (v: number) => `${F.n0(v)} ${cur}`;
  const tot = aggOf(report?.total);
  const prev = prevReport ? aggOf(prevReport.total) : null;
  const allSeries = useMemo(() => seriesOf(clients, months), [clients, months]);
  const focusClients = focus === 'all' ? clients : clients.filter((c) => c.companyId === focus);
  const chartData = focus === 'all' ? allSeries : seriesOf(focusClients, months);

  const rows = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase(locale);
    return clients
      .filter((c) => !needle || `${c.name ?? ''} ${c.accounts.map((a) => a.label).join(' ')}`.toLocaleLowerCase(locale).includes(needle))
      .map((c) => ({ c, a: aggOf(c.total) }))
      .sort((x, y) => {
        if (sort.k === 'name') return sort.d * (x.c.name ?? '').localeCompare(y.c.name ?? '');
        const key = sort.k as keyof Metrics;
        return sort.d * (((x.a[key] as number | null) ?? -1e12) - ((y.a[key] as number | null) ?? -1e12));
      });
  }, [clients, q, sort, locale]);

  const nSrc = sources.length;
  const Delta: React.FC<{
    now: number | null;
    prev: number | null | undefined;
    kind: 'pct' | 'pp' | 'x';
  }> = ({ now, prev: p, kind }) => {
    if (p == null || now == null)
      return (
        <span className="roi-dl mut">
          {t('crm.marketingRoi.noPrev', {
            defaultValue: 'нет данных за прошлый период',
          })}
        </span>
      );
    let v: number;
    let txt: string;
    // Изменение меньше отображаемой точности — нейтральное «·», а не «−0 п.п.» (`|| 0` снимает знак с −0).
    if (kind === 'pct') {
      if (!p) return <span className="roi-dl mut">—</span>;
      v = Math.round(((now - p) / Math.abs(p)) * 1000) / 1000 || 0;
      txt = `${v > 0 ? '+' : ''}${F.n1(v * 100)}%`;
    } else if (kind === 'pp') {
      v = Math.round((now - p) * 1000) / 1000 || 0;
      txt = `${v > 0 ? '+' : ''}${F.n1(v * 100)} ${t('crm.marketingRoi.pp_points', { defaultValue: 'п.п.' })}`;
    } else {
      v = Math.round((now - p) * 100) / 100 || 0;
      txt = `${v > 0 ? '+' : ''}${F.n2(v)}×`;
    }
    return (
      <span className={px('roi-dl', v > 0 ? 'pos' : v < 0 ? 'neg' : '')}>
        {v > 0 ? '▲' : v < 0 ? '▼' : '·'} {txt} <em>{t('crm.marketingRoi.vsPrev', { defaultValue: 'к пред. периоду' })}</em>
      </span>
    );
  };

  const kpis = [
    {
      k: t('crm.marketingRoi.kpiSpend', { defaultValue: 'Расход' }),
      v: m(tot.s),
      d: <Delta now={tot.s} prev={prev?.s} kind="pct" />,
      sp: allSeries.map((x) => x.s),
    },
    {
      k: t('crm.marketingRoi.kpiRevenue', { defaultValue: 'Выручка' }),
      v: m(tot.r),
      d: <Delta now={tot.r} prev={prev?.r} kind="pct" />,
      sp: allSeries.map((x) => x.r),
      f: t('crm.marketingRoi.srcOf', {
        defaultValue: '{{n}} из 4 источников',
        n: nSrc,
      }),
    },
    {
      k: 'ROI',
      v: F.roi(tot.roi),
      cls: tot.roi != null && tot.roi > 0 ? 'pos' : tot.roi != null && tot.roi < 0 ? 'neg' : '',
      d: <Delta now={tot.roi} prev={prev?.roi} kind="pp" />,
      sp: allSeries.map((x) => x.roi),
      neg: allSeries.map((x) => (x.roi ?? 0) < 0),
      f: t('crm.marketingRoi.roiHint', {
        defaultValue: '(выручка − расход) / расход',
      }),
    },
    {
      k: 'ROAS',
      v: F.roas(tot.roas),
      d: <Delta now={tot.roas} prev={prev?.roas} kind="x" />,
      sp: allSeries.map((x) => x.roas),
      f: t('crm.marketingRoi.roasHint', { defaultValue: 'выручка / расход' }),
    },
  ];

  const COLS: Array<[string, string]> = [
    ['s', t('crm.marketingRoi.kpiSpend', { defaultValue: 'Расход' })],
    ['r', t('crm.marketingRoi.kpiRevenue', { defaultValue: 'Выручка' })],
    ['roi', 'ROI'],
    ['roas', 'ROAS'],
    ['cpc', 'CPC'],
    ['cv', t('crm.marketingRoi.colConversions', { defaultValue: 'Конверсии' })],
    ['cpa', 'CPA'],
  ];
  const th = (k: string, l: string) => (
    <th key={k} className={px(k !== 'name' && 'n', sort.k === k && 'on')}>
      <button type="button" onClick={() => setSort((s) => ({ k, d: s.k === k ? -s.d : k === 'name' ? 1 : -1 }))}>
        {l}
        <span className="ar">{sort.k === k ? (sort.d > 0 ? '↑' : '↓') : ''}</span>
      </button>
    </th>
  );
  const SOURCE_LABEL: Record<SourceKey, string> = {
    manual: t('crm.marketingRoi.srcManual', { defaultValue: 'Ввод/импорт' }),
    ads: t('crm.marketingRoi.srcAds', {
      defaultValue: 'Ценность конверсий площадок',
    }),
    ga4: t('crm.marketingRoi.srcGa4', { defaultValue: 'Выручка сайта (GA4)' }),
    crm: t('crm.marketingRoi.srcCrm', { defaultValue: 'Продажи CRM' }),
  };
  const AUTO_SHORT: Record<string, string> = {
    manual: t('crm.marketingRoi.manualShort', { defaultValue: 'Ввод' }),
    ads: t('crm.marketingRoi.autoAds', { defaultValue: 'Площадки' }),
    ga4: 'GA4',
    crm: 'CRM',
  };

  const saveRevenue = (companyId: string, month: string, raw: string) =>
    withBusy(async () => {
      await upsertRoiRevenue({
        companyId,
        month,
        amount: raw === '' ? null : raw.replace(',', '.'),
        currency: cur,
      });
      await load();
    });

  const toWorkspace = () =>
    withBusy(async () => {
      setNotice(null);
      try {
        const res = await createRoiWorkspaceTable({
          tableName: t('crm.marketingRoi.title', {
            defaultValue: 'ROI по клиентам',
          }),
          displayCurrency: cur,
          sources,
        });
        if (res.ok && res.objectId) navigate(`/workspace/${res.objectId}/analytics`);
        else setNotice(res.hint || res.error || 'Error');
      } catch (e: unknown) {
        setNotice(e instanceof Error ? e.message : 'Error');
      }
    });

  const badgesOf = (c: RoiClientRow) => (
    <>
      {c.placeholderValueAccounts?.length && src.ads ? (
        <span
          className="roi-badge mutd"
          title={t('crm.marketingRoi.placeholderHint', {
            defaultValue:
              'В кабинетах {{list}} конверсиям присвоена условная ценность (≈1 за конверсию — звонки, клики, формы), а не сумма бронирования. Она не считается выручкой. Чтобы ROI был реальным, введите выручку из отчёта отеля или передавайте в Google Ads стоимость бронирований.',
            list: c.placeholderValueAccounts.join(', '),
          })}
        >
          {t('crm.marketingRoi.placeholderBadge', {
            defaultValue: 'ценность конверсий условная',
          })}
        </span>
      ) : null}
      {c.overlapMonths?.length ? (
        <span
          className="roi-badge"
          title={t('crm.marketingRoi.overlapHint', {
            defaultValue:
              'В {{n}} мес. выручка есть и в ценности конверсий площадок, и в GA4. Если Google Ads/Meta получают покупки из GA4, это одни и те же бронирования — отключите один из этих источников.',
            n: c.overlapMonths.length,
          })}
        >
          {t('crm.marketingRoi.overlapBadge', {
            defaultValue: 'возможен двойной учёт',
          })}
        </span>
      ) : null}
    </>
  );

  const renderClientDetail = (c: RoiClientRow) => {
    const detKey = c.companyId ?? '_';
    const dmode: ChartMode = detailMode[detKey] ?? 'sr';
    const setDmode = (v: ChartMode) => setDetailMode((p) => ({ ...p, [detKey]: v }));
    const data = seriesOf([c], months);
    const total = aggOf(c.total);
    const ads = c.accounts.filter((a) => a.provider !== 'ga4' && a.provider !== 'yandex_metrika');
    const sites = c.accounts.filter((a) => a.provider === 'ga4' || a.provider === 'yandex_metrika');
    const monthRows = months
      .slice()
      .reverse()
      .map((key) => {
        const mo = c.months[key];
        const mt = aggOf(mo);
        const by = mo?.revenueBySource ?? {};
        const parts = (['manual', 'ads', 'ga4', 'crm'] as const).filter((k) => src[k] && by[k]);
        const [yy, mm] = key.split('-').map(Number);
        const editKey = `${c.companyId}|${key}`;
        const editing = editingRev === editKey;
        const revTitle =
          [
            ...parts.map((k) => `${SOURCE_LABEL[k]}: ${m(by[k] || 0)}`),
            ...(src.ads && by.adsPlaceholder
              ? [
                  t('crm.marketingRoi.placeholderLine', {
                    defaultValue: 'Условная ценность конверсий {{v}} — не выручка, не учитывается',
                    v: m(by.adsPlaceholder),
                  }),
                ]
              : []),
          ].join('\n') || undefined;
        const revCell = (
          <>
            {' '}
            {editing && c.companyId ? (
              <RevInput
                autoFocus
                value={by.manual || 0}
                disabled={busy}
                F={F}
                onCommit={(raw) => void saveRevenue(c.companyId as string, key, raw)}
                onDone={() => setEditingRev(null)}
              />
            ) : (
              <div className="rev-in">
                <div>
                  {mt.r ? m(mt.r) : <span className="mut">—</span>}
                  {parts.length > 0 && (
                    <span className="srcs">
                      {parts.map((k) => (
                        <em key={k}>{AUTO_SHORT[k]}</em>
                      ))}
                    </span>
                  )}
                </div>
                {c.companyId && src.manual && (
                  <button
                    type="button"
                    className="roi-ed"
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingRev(editKey);
                    }}
                    title={
                      by.manual
                        ? t('crm.marketingRoi.editManual', {
                            defaultValue: 'Изменить введённую выручку',
                          })
                        : t('crm.marketingRoi.addManual', {
                            defaultValue: 'Ввести выручку за месяц вручную (из отчёта клиента)',
                          })
                    }
                    aria-label={t('crm.marketingRoi.addManual', {
                      defaultValue: 'Ввести выручку за месяц вручную (из отчёта клиента)',
                    })}
                  >
                    ✎
                  </button>
                )}
              </div>
            )}
          </>
        );
        if (isMobile)
          return (
            <div key={key} className={px('roi-mm', !mt.s && 'empty')}>
              <div className="r1">
                <span className="mo">
                  <b>{MN[mm - 1]}</b> <span>{yy}</span>
                </span>
                {mt.s ? <RoiPill v={mt.roi} F={F} /> : <span className="mut">—</span>}
              </div>
              <div className="r2">
                <div>
                  <div className="k">{t('crm.marketingRoi.kpiSpend', { defaultValue: 'Расход' })}</div>
                  <div className="v">
                    {mt.s ? (
                      m(mt.s)
                    ) : (
                      <span className="mut">
                        {t('crm.marketingRoi.noSpend', {
                          defaultValue: 'нет расхода',
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <div title={revTitle}>
                  <div className="k">
                    {t('crm.marketingRoi.kpiRevenue', {
                      defaultValue: 'Выручка',
                    })}
                  </div>
                  <div className="v">{revCell}</div>
                </div>
              </div>
              {mt.s ? (
                <div className="r3">
                  <span>ROAS {F.roas(mt.roas)}</span>
                  <span>CPC {mt.cpc == null ? '—' : F.n2(mt.cpc)}</span>
                  <span>
                    {t('crm.marketingRoi.convShort', { defaultValue: 'конв.' })} {mt.cv ? F.n1(mt.cv) : '—'}
                  </span>
                  <span>CPA {mt.cpa == null ? '—' : F.n2(mt.cpa)}</span>
                </div>
              ) : null}
            </div>
          );
        return (
          <tr key={key} className={px(!mt.s && 'empty')}>
            <td className="mo">
              <b>{MN[mm - 1]}</b> <span>{yy}</span>
            </td>
            <td className="n">
              {mt.s ? (
                m(mt.s)
              ) : (
                <span className="mut">
                  {t('crm.marketingRoi.noSpend', {
                    defaultValue: 'нет расхода',
                  })}
                </span>
              )}
            </td>
            <td className="n b rev" title={revTitle}>
              {revCell}
            </td>
            <td className="n">{mt.s ? <RoiPill v={mt.roi} F={F} /> : <span className="mut">—</span>}</td>
            <td className="n">{F.roas(mt.roas)}</td>
            <td className="n">{mt.cpc == null ? '—' : F.n2(mt.cpc)}</td>
            <td className="n">{mt.cv ? F.n1(mt.cv) : '—'}</td>
            <td className="n">{mt.cpa == null ? '—' : F.n2(mt.cpa)}</td>
          </tr>
        );
      });
    return (
      <div className="roi-det">
        <div className="roi-det-top">
          <section className="roi-card">
            <header>
              <div>
                <div className="kick">
                  {t('crm.marketingRoi.dynamics', { defaultValue: 'Динамика' })} · {c.name}
                </div>
                <h3>
                  {t('crm.marketingRoi.byMonth', {
                    defaultValue: 'По месяцам',
                  })}
                </h3>
              </div>
              <div className="roi-seg sm">
                {(
                  [
                    [
                      'sr',
                      t('crm.marketingRoi.modeSr', {
                        defaultValue: 'Расход / выручка',
                      }),
                    ],
                    ['roas', 'ROAS'],
                    ['cpc', 'CPC'],
                  ] as Array<[ChartMode, string]>
                ).map(([k, l]) => (
                  <button type="button" key={k} className={px(dmode === k && 'on')} onClick={() => setDmode(k)}>
                    {l}
                  </button>
                ))}
              </div>
            </header>
            <TrendChart data={data} mode={dmode} cur={cur} h={200} F={F} locale={locale} t={t} />
            {dmode === 'sr' && (
              <div className="roi-leg">
                <span>
                  <i className="s" />
                  {t('crm.marketingRoi.kpiSpend', { defaultValue: 'Расход' })}
                </span>
                <span>
                  <i className="r" />
                  {t('crm.marketingRoi.kpiRevenue', {
                    defaultValue: 'Выручка',
                  })}
                </span>
              </div>
            )}
          </section>
          <section className="roi-card">
            <header>
              <div>
                <div className="kick">
                  {t('crm.marketingRoi.cabinets', { defaultValue: 'Кабинеты' })} · {c.accounts.length}
                </div>
                <h3>
                  {t('crm.marketingRoi.spendFrom', {
                    defaultValue: 'Откуда расход',
                  })}
                </h3>
              </div>
            </header>
            <div className="roi-cabs">
              {ads.map((a) => {
                const sh = total.s ? a.spend / total.s : 0;
                return (
                  <div className="roi-cab" key={a.key}>
                    <div className="nm">
                      <Plat provider={a.provider} />
                      <div>
                        <b>{a.label}</b>
                        <span>{PLAT_LABEL[platformOf(a.provider)]}</span>
                      </div>
                      <strong>{m(a.spend)}</strong>
                    </div>
                    <div className="bar">
                      <i style={{ width: `${sh * 100}%` }} />
                    </div>
                    <div className="st">
                      <span>
                        {F.n0(sh * 100)}%{' '}
                        {t('crm.marketingRoi.ofSpend', {
                          defaultValue: 'расхода',
                        })}
                      </span>
                      <span>CPC {a.clicks ? F.n2(a.spend / a.clicks) : '—'}</span>
                      <span>
                        {F.n1(a.conversions ?? 0)}{' '}
                        {t('crm.marketingRoi.convShort', {
                          defaultValue: 'конв.',
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
              {sites.map((a) => (
                <div className="roi-cab an" key={a.key}>
                  <div className="nm">
                    <Plat provider={a.provider} />
                    <div>
                      <b>{a.label}</b>
                      <span>
                        {t('crm.marketingRoi.siteSource', {
                          defaultValue: 'Источник выручки сайта · без расхода',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
        {isMobile ? (
          <div className="roi-mm-list">{monthRows}</div>
        ) : (
          <div className="roi-mt-wrap">
            <table className="roi-mt">
              <thead>
                <tr>
                  <th>{t('crm.marketingRoi.month', { defaultValue: 'Месяц' })}</th>
                  <th className="n">{t('crm.marketingRoi.kpiSpend', { defaultValue: 'Расход' })}</th>
                  <th className="n">
                    {t('crm.marketingRoi.kpiRevenue', {
                      defaultValue: 'Выручка',
                    })}
                  </th>
                  <th className="n">ROI</th>
                  <th className="n">ROAS</th>
                  <th className="n">CPC</th>
                  <th className="n">
                    {t('crm.marketingRoi.colConversions', {
                      defaultValue: 'Конверсии',
                    })}
                  </th>
                  <th className="n">CPA</th>
                </tr>
              </thead>
              <tbody>{monthRows}</tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const unassignedSpend = report?.unassigned?.total.spend ?? 0;
  const crmUn = report?.crmUnattributed;

  return (
    <MainLayout>
      <div className="roi">
        <div className="roi-head">
          <div className="kick">{t('crm.marketingRoi.kicker', { defaultValue: 'Маркетинг' })}</div>
          <h1>{t('crm.marketingRoi.title', { defaultValue: 'ROI по клиентам' })}</h1>
          <p>
            {t('crm.marketingRoi.lead', {
              defaultValue:
                'Расход рекламных кабинетов клиента против его выручки: ROI, ROAS и стоимость клика по месяцам. Кабинеты привязываются к компаниям CRM.',
            })}
          </p>
        </div>

        <div className="roi-bar">
          <PeriodPicker months={MONTHS} value={period} onChange={setPeriod} locale={locale} t={t} />
          <div
            className="roi-seg"
            role="group"
            aria-label={t('crm.marketingRoi.currency', {
              defaultValue: 'Валюта',
            })}
          >
            {CURRENCIES.map((k) => (
              <button type="button" key={k} className={px(cur === k && 'on')} onClick={() => setCur(k)}>
                {k}
              </button>
            ))}
          </div>
          <span className="roi-vsep" />
          <div className="roi-src">
            <span className="kick">
              {t('crm.marketingRoi.revenueFrom', {
                defaultValue: 'Выручка из',
              })}
            </span>
            {SOURCE_KEYS.map((k) => (
              <button
                type="button"
                key={k}
                className={px('roi-chip', src[k] && 'on')}
                aria-pressed={src[k]}
                onClick={() => setSrc((p) => (p[k] && SOURCE_KEYS.filter((x) => p[x]).length === 1 ? p : { ...p, [k]: !p[k] }))}
              >
                <span className="bx">{src[k] && <Ico d={<path d="M5 12l4 4 10-10" />} s={10} />}</span>
                {SOURCE_LABEL[k]}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div className="roi-acts">
            <button type="button" className="roi-btn" onClick={() => setAccountsOpen(true)}>
              <Ico d={AI.link} />
              <span className="lbl-full">{t('crm.marketingRoi.accountsButton', { defaultValue: 'Кабинеты и клиенты' })}</span>
              <span className="lbl-short">{t('crm.marketingRoi.accountsButtonShort', { defaultValue: 'Кабинеты' })}</span>
            </button>
            <button type="button" className="roi-btn" disabled={busy} onClick={() => void toWorkspace()}>
              <Ico d={AI.ws} />
              <span className="lbl-full">{t('crm.marketingRoi.toWorkspace', { defaultValue: 'В рабочую область' })}</span>
              <span className="lbl-short">{t('crm.marketingRoi.toWorkspaceShort', { defaultValue: 'В обл.' })}</span>
            </button>
            <button type="button" className="roi-btn pri" onClick={() => setImportOpen(true)}>
              <Ico d={AI.imp} />
              <span className="lbl-full">{t('crm.marketingRoi.importButton', { defaultValue: 'Импорт выручки' })}</span>
              <span className="lbl-short">{t('crm.marketingRoi.importButtonShort', { defaultValue: 'Импорт' })}</span>
            </button>
          </div>
        </div>

        {error && <div className="roi-err">{error}</div>}
        {notice && <div className="roi-err">{notice}</div>}

        <div className="roi-kpis" aria-busy={loading}>
          {kpis.map((x) => (
            <div className="roi-kpi" key={x.k}>
              <div className="kick">{x.k}</div>
              <div className={px('v', x.cls)}>{report ? x.v : '—'}</div>
              {x.d}
              <Spark vals={x.sp} neg={x.neg} />
              {x.f && <div className="f">{x.f}</div>}
            </div>
          ))}
        </div>

        {unassignedSpend > 0 && (
          <div className="roi-warn" role="status">
            <Ico d={AI.warn} s={16} />
            <p>
              {t('crm.marketingRoi.unassignedBanner', {
                defaultValue: 'Расход {{sum}} в {{n}} кабинетах не привязан к клиентам и не входит в ROI.',
                sum: m(unassignedSpend),
                n: report?.unassigned?.accounts.length ?? 0,
              })}
            </p>
            <button type="button" className="roi-btn sm" onClick={() => setAccountsOpen(true)}>
              {t('crm.marketingRoi.assignNow', { defaultValue: 'Привязать' })}
            </button>
          </div>
        )}

        {crmBanner && src.crm && crmUn && crmUn.count > 0 && (
          <div className="roi-warn" role="status">
            <Ico d={AI.warn} s={16} />
            <p>
              {t('crm.marketingRoi.crmUnattributed', {
                defaultValue:
                  'Продажи CRM на {{sum}} ({{n}} шт.) не отнесены к клиентам: у лида нет UTM-кампании из привязанного кабинета, а поле «Отель» не совпадает с компанией.',
                sum: m(crmUn.amount),
                n: crmUn.count,
              })}
            </p>
            <button type="button" className="roi-btn sm" onClick={() => navigate('/sales')}>
              {t('crm.marketingRoi.reviewSale', {
                defaultValue: 'Разобрать продажу',
              })}
            </button>
            <button type="button" className="roi-ib" onClick={() => setCrmBanner(false)} aria-label="×">
              <Ico d={AI.x} />
            </button>
          </div>
        )}

        {report?.missingRates.length ? (
          <div className="roi-warn" role="status">
            <Ico d={AI.warn} s={16} />
            <p>
              {t('crm.marketingRoi.missingRates', {
                defaultValue: 'Нет курса для: {{list}} — эти суммы не пересчитаны.',
                list: report.missingRates.join(', '),
              })}
            </p>
          </div>
        ) : null}

        <section className="roi-card">
          <header>
            <div>
              <div className="kick">
                {t('crm.marketingRoi.dynamics', { defaultValue: 'Динамика' })} · {len} {t('crm.marketingRoi.pp.monthsShort', { defaultValue: 'мес' })}
              </div>
              <h3>
                {focus === 'all'
                  ? t('crm.marketingRoi.allClients', {
                      defaultValue: 'Все клиенты',
                    })
                  : focusClients[0]?.name}
              </h3>
            </div>
            <div className="roi-ch-ctl">
              <select className="roi-sel" value={focus} onChange={(e) => setFocus(e.target.value)}>
                <option value="all">
                  {t('crm.marketingRoi.allClients', {
                    defaultValue: 'Все клиенты',
                  })}
                </option>
                {clients.map((c) => (
                  <option key={c.companyId ?? '_'} value={c.companyId ?? ''}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="roi-seg sm">
                {(
                  [
                    [
                      'sr',
                      t('crm.marketingRoi.modeSr', {
                        defaultValue: 'Расход / выручка',
                      }),
                    ],
                    ['roas', 'ROAS'],
                    ['cpc', 'CPC'],
                  ] as Array<[ChartMode, string]>
                ).map(([k, l]) => (
                  <button type="button" key={k} className={px(mode === k && 'on')} onClick={() => setMode(k)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </header>
          {chartData.length ? (
            <TrendChart data={chartData} mode={mode} cur={cur} h={260} F={F} locale={locale} t={t} />
          ) : (
            <div className="roi-ch-empty" style={{ height: 260 }}>
              {loading
                ? t('crm.common.loading', { defaultValue: 'Загрузка…' })
                : t('crm.marketingRoi.empty', {
                    defaultValue: 'Нет расходов за период.',
                  })}
            </div>
          )}
          {mode === 'sr' && chartData.length > 0 && (
            <div className="roi-leg">
              <span>
                <i className="s" />
                {t('crm.marketingRoi.kpiSpend', { defaultValue: 'Расход' })}
              </span>
              <span>
                <i className="r" />
                {t('crm.marketingRoi.kpiRevenue', { defaultValue: 'Выручка' })}
              </span>
            </div>
          )}
        </section>

        <section className="roi-card flush">
          <header className="pad">
            <div>
              <div className="kick">
                {t('crm.marketingRoi.clientsTitle', {
                  defaultValue: 'Клиенты',
                })}{' '}
                · {rows.length}
              </div>
              <h3>
                {t('crm.marketingRoi.paybackTitle', {
                  defaultValue: 'Окупаемость по клиентам',
                })}
              </h3>
            </div>
            <label className="roi-search">
              <Ico d={AI.srch} />
              <input
                placeholder={t('crm.marketingRoi.searchPh', {
                  defaultValue: 'Клиент или кабинет',
                })}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
          </header>
          {isMobile && (
            <div className="roi-mc-list">
              {rows.length > 1 && (
                <div className="roi-mc-sort">
                  <select
                    className="roi-sel"
                    value={`${sort.k}|${sort.d}`}
                    onChange={(e) => {
                      const [k, d] = e.target.value.split('|');
                      setSort({ k, d: Number(d) });
                    }}
                  >
                    {[['name', t('crm.marketingRoi.colClient', { defaultValue: 'Клиент' })] as [string, string], ...COLS].flatMap(([k, l]) =>
                      (k === 'name' ? [1] : [-1, 1]).map((d) => (
                        <option key={`${k}|${d}`} value={`${k}|${d}`}>
                          {t('crm.marketingRoi.sortBy', { defaultValue: 'Сортировка' })}: {l} {d > 0 ? '↑' : '↓'}
                        </option>
                      )),
                    )}
                  </select>
                </div>
              )}
              {rows.map(({ c, a }) => {
                const id = c.companyId ?? '_';
                const o = !!open[id];
                const sh = tot.s ? a.s / tot.s : 0;
                return (
                  <div key={id} className={px('roi-mc', o && 'open')}>
                    <div className="hd" role="button" tabIndex={0} aria-expanded={o} onClick={() => setOpen((p) => ({ ...p, [id]: !p[id] }))}>
                      <span className="roi-exp" aria-hidden>
                        <Ico d={AI.chev} s={13} />
                      </span>
                      <div className="t">
                        <b>{c.name}</b>
                        <div className="sub">
                          {c.city && <span>{c.city}</span>}
                          <span className="plats">
                            {c.accounts.map((x) => (
                              <Plat key={x.key} provider={x.provider} />
                            ))}
                          </span>
                          <span>
                            {c.accounts.length} {t('crm.marketingRoi.cabinetsShort', { defaultValue: 'каб.' })}
                          </span>
                          {badgesOf(c)}
                        </div>
                      </div>
                      <RoiPill v={a.roi} F={F} />
                    </div>
                    <div className="grid">
                      <div className="wide">
                        <div>
                          <div className="k">{t('crm.marketingRoi.kpiSpend', { defaultValue: 'Расход' })}</div>
                          <div className="v">{m(a.s)}</div>
                          <div className="sbar">
                            <i style={{ width: `${sh * 100}%` }} />
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="k">{t('crm.marketingRoi.kpiRevenue', { defaultValue: 'Выручка' })}</div>
                          <div className="v">{m(a.r)}</div>
                        </div>
                      </div>
                      <div>
                        <div className="k">ROAS</div>
                        <div className="v">{F.roas(a.roas)}</div>
                      </div>
                      <div>
                        <div className="k">CPC</div>
                        <div className="v">{a.cpc == null ? '—' : F.n2(a.cpc)}</div>
                      </div>
                      <div>
                        <div className="k">{t('crm.marketingRoi.convShort', { defaultValue: 'конв.' })}</div>
                        <div className="v">{F.n1(a.cv)}</div>
                      </div>
                    </div>
                    {o && renderClientDetail(c)}
                  </div>
                );
              })}
              {!rows.length && (
                <div className="roi-mc-empty">
                  {loading
                    ? t('crm.common.loading', { defaultValue: 'Загрузка…' })
                    : clients.length
                      ? t('crm.marketingRoi.noMatch', { defaultValue: 'Ничего не найдено.' })
                      : t('crm.marketingRoi.noClients', { defaultValue: 'Нет клиентов с привязанными кабинетами за период.' })}
                </div>
              )}
              {rows.length > 0 && (
                <div className="roi-mc-total">
                  <span className="k">
                    {t('crm.marketingRoi.totalRow', { defaultValue: 'Итого' })} · {rows.length}
                  </span>
                  <span>
                    {m(tot.s)} → {m(tot.r)}
                  </span>
                  <RoiPill v={tot.roi} F={F} />
                </div>
              )}
            </div>
          )}
          {!isMobile && (
            <div
              className="roi-t-wrap"
              ref={twRef}
              style={
                {
                  ['--tw' as string]: tw ? `${tw}px` : '100%',
                } as React.CSSProperties
              }
            >
              <table className="roi-t">
                <thead>
                  <tr>
                    {th('name', t('crm.marketingRoi.colClient', { defaultValue: 'Клиент' }))}
                    {COLS.map(([k, l]) => th(k, l))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ c, a }) => {
                    const id = c.companyId ?? '_';
                    const o = !!open[id];
                    const sh = tot.s ? a.s / tot.s : 0;
                    return (
                      <React.Fragment key={id}>
                        <tr className={px('cl', o && 'open')} onClick={() => setOpen((p) => ({ ...p, [id]: !p[id] }))}>
                          <td className="nm">
                            <div className="nm-in">
                              <button
                                type="button"
                                className="roi-exp"
                                aria-expanded={o}
                                aria-label={
                                  o
                                    ? t('crm.marketingRoi.collapse', {
                                        defaultValue: 'Свернуть',
                                      })
                                    : t('crm.marketingRoi.expand', {
                                        defaultValue: 'Раскрыть',
                                      })
                                }
                              >
                                <Ico d={AI.chev} s={13} />
                              </button>
                              <div>
                                <div className="t">
                                  <b>{c.name}</b>
                                  {c.city && <span>{c.city}</span>}
                                  {badgesOf(c)}
                                </div>
                                <div className="cabs">
                                  {c.accounts.map((x) => (
                                    <span className="roi-tag" key={x.key} title={x.key}>
                                      <Plat provider={x.provider} />
                                      {x.label}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="n">
                            <div className="sp">
                              {m(a.s)}
                              <div className="bar">
                                <i style={{ width: `${sh * 100}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="n b">{m(a.r)}</td>
                          <td className="n">
                            <RoiPill v={a.roi} F={F} />
                          </td>
                          <td className="n">{F.roas(a.roas)}</td>
                          <td className="n">{a.cpc == null ? '—' : `${F.n2(a.cpc)} ${cur}`}</td>
                          <td className="n">{F.n1(a.cv)}</td>
                          <td className="n">{a.cpa == null ? '—' : `${F.n2(a.cpa)} ${cur}`}</td>
                        </tr>
                        {o && (
                          <tr className="det">
                            <td colSpan={8}>{renderClientDetail(c)}</td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {!rows.length && (
                    <tr>
                      <td colSpan={8} className="roi-t-empty">
                        {loading ? (
                          t('crm.common.loading', { defaultValue: 'Загрузка…' })
                        ) : clients.length ? (
                          t('crm.marketingRoi.noMatch', {
                            defaultValue: 'Ничего не найдено.',
                          })
                        ) : (
                          <>
                            {t('crm.marketingRoi.noClients', {
                              defaultValue: 'Нет клиентов с привязанными кабинетами за период.',
                            })}{' '}
                            <button type="button" className="roi-lk" onClick={() => setAccountsOpen(true)}>
                              {t('crm.marketingRoi.accountsButton', {
                                defaultValue: 'Кабинеты и клиенты',
                              })}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
                {rows.length > 0 && (
                  <tfoot>
                    <tr>
                      <td>
                        {t('crm.marketingRoi.totalRow', {
                          defaultValue: 'Итого',
                        })}{' '}
                        · {rows.length}
                      </td>
                      <td className="n">{m(tot.s)}</td>
                      <td className="n">{m(tot.r)}</td>
                      <td className="n">
                        <RoiPill v={tot.roi} F={F} />
                      </td>
                      <td className="n">{F.roas(tot.roas)}</td>
                      <td className="n">{tot.cpc == null ? '—' : `${F.n2(tot.cpc)} ${cur}`}</td>
                      <td className="n">{F.n1(tot.cv)}</td>
                      <td className="n">{tot.cpa == null ? '—' : `${F.n2(tot.cpa)} ${cur}`}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </section>

        <p className="roi-note">
          {t('crm.marketingRoi.footnote', {
            defaultValue:
              'Выручку из отчёта клиента можно ввести кнопкой ✎ в строке месяца (раскройте клиента) или импортировать таблицей. Суммы в {{cur}} по курсу ECB{{asOf}}.',
            cur,
            asOf: report?.fxAsOf ? ` (${report.fxAsOf})` : '',
          })}
        </p>
      </div>

      {importOpen && (
        <ImportDialog
          t={t}
          onClose={() => setImportOpen(false)}
          onImport={async (rows) => {
            const res = await importRoiRevenue(rows);
            await load();
            return res;
          }}
        />
      )}
      {accountsOpen && (
        <RoiAccountsDialog
          accounts={accounts}
          companies={companies}
          busy={busy}
          savedKey={savedKey}
          locale={locale}
          t={t}
          onClose={() => setAccountsOpen(false)}
          onAssign={(key, companyId) =>
            withBusy(async () => {
              await setRoiAccountClient(key, companyId);
              await Promise.all([loadAccounts(), load()]);
            })
          }
          onCreateCompany={(key, name) =>
            withBusy(async () => {
              const created = await createCompany({ name } as Parameters<typeof createCompany>[0]);
              await setRoiAccountClient(key, created.id);
              await Promise.all([loadAccounts(), load()]);
            })
          }
          onAcceptSuggestions={(list) =>
            withBusy(async () => {
              for (const a of list) await setRoiAccountClient(a.key, a.suggestedCompanyId);
              await Promise.all([loadAccounts(), load()]);
            })
          }
          onSaveMetaActions={(key, conv, value) =>
            withBusy(async () => {
              await setRoiMetaActions(key, conv, value);
              setSavedKey(key);
              await loadAccounts();
            })
          }
        />
      )}
    </MainLayout>
  );
};
