/**
 * ROI по лидам (/leads/roi) — в стиле «ROI по клиентам» (roiDesign.css, RoiParts), но про лиды:
 * сколько лидов каждый менеджер выиграл и проиграл, сколько выручки они принесли и кто купил повторно.
 * Без рекламного расхода: у лида нет своего бюджета — окупаемость рекламы смотрим в ROI по клиентам.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { getLocale } from '../../i18n/utils';
import { fetchManagerRoi, type LeadRoiMode, type ManagerRoiCell, type ManagerRoiReport, type ManagerRoiRow } from '../../api/leads';
import { buildMonths, Ico, makeFormat, monthNames, PeriodPicker, px, Spark, useWidth } from '../marketing/roi/RoiParts';
import '../marketing/roi/roiDesign.css';
import './leadsRoi.css';

const CURRENCIES = ['TRY', 'EUR', 'USD'] as const;
const MODES: LeadRoiMode[] = ['sales', 'projects'];
const LS_CUR = 'lumiva_roi_currency_v1';
const LS_MODE = 'lumiva_leads_roi_mode_v1';

const AI = {
  chev: <path d="M9 6l6 6-6 6" />,
  warn: (
    <>
      <path d="M12 3l9.5 17h-19z" />
      <path d="M12 10v4M12 17v.01" />
    </>
  ),
  srch: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.5-4.5" />
    </>
  ),
};

/** Месяц 'YYYY-MM' со сдвигом. */
const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
};

const EMPTY: ManagerRoiCell = { leads: 0, won: 0, lost: 0, revenue: 0, deals: 0, repeatRevenue: 0, repeatDeals: 0 };

/** open — лиды ещё в работе; conv — выиграно / все новые лиды. */
type LM = ManagerRoiCell & { open: number; conv: number | null; lossRate: number | null };
const lmOf = (c?: ManagerRoiCell): LM => {
  const x = c ?? EMPTY;
  return {
    ...x,
    open: Math.max(0, x.leads - x.won - x.lost),
    conv: x.leads ? x.won / x.leads : null,
    lossRate: x.leads ? x.lost / x.leads : null,
  };
};

function seriesOf(rows: ManagerRoiRow[], months: string[]): Array<LM & { key: string }> {
  return months.map((key) => {
    const sum = { ...EMPTY };
    for (const r of rows) {
      const c = r.months[key];
      if (!c) continue;
      (Object.keys(sum) as Array<keyof ManagerRoiCell>).forEach((k) => (sum[k] += c[k]));
    }
    return { ...lmOf(sum), key };
  });
}

const initials = (name: string | null) =>
  (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '—';

const Avatar: React.FC<{ r: ManagerRoiRow }> = ({ r }) => (
  <span className={px('roi-av', !r.name && 'none')} aria-hidden>
    {r.avatarUrl ? <img src={r.avatarUrl} alt="" /> : initials(r.name)}
  </span>
);

/** Полоска исхода лидов: выиграно / проиграно / в работе. */
const OutcomeBar: React.FC<{ a: LM }> = ({ a }) =>
  a.leads ? (
    <div className="lr-ob" aria-hidden>
      <i className="w" style={{ width: `${(a.won / a.leads) * 100}%` }} />
      <i className="l" style={{ width: `${(a.lost / a.leads) * 100}%` }} />
    </div>
  ) : null;

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

export const LeadsRoiPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = getLocale(i18n.language);
  const F = useMemo(() => makeFormat(locale), [locale]);
  const MN = useMemo(() => monthNames(locale), [locale]);
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
  const [source, setSource] = useState<LeadRoiMode>(() => {
    try {
      return localStorage.getItem(LS_MODE) === 'projects' ? 'projects' : 'sales';
    } catch {
      return 'sales';
    }
  });
  const [report, setReport] = useState<ManagerRoiReport | null>(null);
  const [prevReport, setPrevReport] = useState<ManagerRoiReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<{ k: string; d: number }>({ k: 'won', d: -1 });
  const [focus, setFocus] = useState('all');
  const [q, setQ] = useState('');
  const [twRef, tw] = useWidth<HTMLDivElement>();
  const isMobile = useIsMobile();

  const fromKey = MONTHS[period.from].key;
  const toKey = MONTHS[period.to].key;
  const len = period.to - period.from + 1;

  useEffect(() => {
    try {
      localStorage.setItem(LS_CUR, cur);
      localStorage.setItem(LS_MODE, source);
    } catch {
      /* ignore */
    }
  }, [cur, source]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [now, prev] = await Promise.all([
        fetchManagerRoi({ from: fromKey, to: toKey, source, currency: cur }),
        // Прошлый период той же длины — для дельт в KPI.
        fetchManagerRoi({ from: shiftMonth(fromKey, -len), to: shiftMonth(fromKey, -1), source, currency: cur }).catch(() => null),
      ]);
      setReport(now);
      setPrevReport(prev);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('crm.leads.roi.errors.loadFailed', { defaultValue: 'Не удалось загрузить ROI' }));
    } finally {
      setLoading(false);
    }
  }, [fromKey, toKey, source, cur, len, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const managers = report?.managers ?? [];
  const months = report?.months ?? [];
  const m = (v: number) => `${F.n0(v)} ${cur}`;
  const pct = (v: number | null) => (v == null ? '—' : `${F.n1(v * 100)}%`);
  const tot = lmOf(report?.total);
  const prev = prevReport ? lmOf(prevReport.total) : null;
  const allSeries = useMemo(() => seriesOf(managers, months), [managers, months]);
  const focusRows = focus === 'all' ? managers : managers.filter((r) => r.key === focus);
  const chartData = focus === 'all' ? allSeries : seriesOf(focusRows, months);

  const noManager = t('crm.leads.roiManagers.noManager', { defaultValue: 'Без ответственного' });
  const nameOf = (r: ManagerRoiRow) => r.name || noManager;

  const L = {
    leads: t('crm.leads.roiManagers.leads', { defaultValue: 'Лиды' }),
    won: t('crm.leads.roiManagers.won', { defaultValue: 'Выиграно' }),
    lost: t('crm.leads.roiManagers.lost', { defaultValue: 'Проиграно' }),
    open: t('crm.leads.roiManagers.inWork', { defaultValue: 'В работе' }),
    conv: t('crm.leads.roiManagers.conv', { defaultValue: 'Конверсия' }),
    revenue: t('crm.marketingRoi.kpiRevenue', { defaultValue: 'Выручка' }),
    repeat: t('crm.leads.roiManagers.repeat', { defaultValue: 'Повторно' }),
    repeatRevenue: t('crm.leads.roiManagers.repeatRevenue', { defaultValue: 'Повторная выручка' }),
    manager: t('crm.leads.roiManagers.colManager', { defaultValue: 'Менеджер' }),
  };

  const rows = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase(locale);
    return managers
      .filter((r) => !needle || `${r.name ?? ''} ${r.department ?? ''}`.toLocaleLowerCase(locale).includes(needle))
      .map((r) => ({ r, a: { ...lmOf(r.total), repeatLeads: r.repeatLeads } }))
      .sort((x, y) => {
        if (sort.k === 'name') return sort.d * (x.r.name ?? '￿').localeCompare(y.r.name ?? '￿');
        const key = sort.k as keyof typeof x.a;
        return sort.d * (((x.a[key] as number | null) ?? -1) - ((y.a[key] as number | null) ?? -1));
      });
  }, [managers, q, sort, locale]);

  const Delta: React.FC<{ now: number | null; prev: number | null | undefined; kind: 'pct' | 'pp'; invert?: boolean }> = ({ now, prev: p, kind, invert }) => {
    if (p == null || now == null)
      return <span className="roi-dl mut">{t('crm.marketingRoi.noPrev', { defaultValue: 'нет данных за прошлый период' })}</span>;
    let v: number;
    let txt: string;
    if (kind === 'pct') {
      if (!p) return <span className="roi-dl mut">—</span>;
      v = Math.round(((now - p) / Math.abs(p)) * 1000) / 1000 || 0;
      txt = `${v > 0 ? '+' : ''}${F.n1(v * 100)}%`;
    } else {
      v = Math.round((now - p) * 1000) / 1000 || 0;
      txt = `${v > 0 ? '+' : ''}${F.n1(v * 100)} ${t('crm.marketingRoi.pp_points', { defaultValue: 'п.п.' })}`;
    }
    // Для проигранных рост — плохо.
    const good = invert ? v < 0 : v > 0;
    const bad = invert ? v > 0 : v < 0;
    return (
      <span className={px('roi-dl', good ? 'pos' : bad ? 'neg' : '')}>
        {v > 0 ? '▲' : v < 0 ? '▼' : '·'} {txt} <em>{t('crm.marketingRoi.vsPrev', { defaultValue: 'к пред. периоду' })}</em>
      </span>
    );
  };

  const repeatLeads = report?.repeatLeads ?? 0;
  const kpis = [
    {
      k: t('crm.leads.roiManagers.kpiNew', { defaultValue: 'Новые лиды' }),
      v: F.n0(tot.leads),
      d: <Delta now={tot.leads} prev={prev?.leads} kind="pct" />,
      sp: allSeries.map((x) => x.leads),
      f: t('crm.leads.roiManagers.newHint', { defaultValue: 'в работе: {{n}}', n: F.n0(tot.open) }),
    },
    {
      k: L.won,
      v: F.n0(tot.won),
      cls: tot.won ? 'pos' : '',
      d: <Delta now={tot.conv} prev={prev?.conv} kind="pp" />,
      sp: allSeries.map((x) => x.won),
      f: t('crm.leads.roiManagers.wonHint', { defaultValue: 'конверсия {{v}}', v: pct(tot.conv) }),
    },
    {
      k: L.lost,
      v: F.n0(tot.lost),
      cls: tot.lost ? 'neg' : '',
      d: <Delta now={tot.lossRate} prev={prev?.lossRate} kind="pp" invert />,
      sp: allSeries.map((x) => x.lost),
      neg: allSeries.map(() => true),
      f: t('crm.leads.roiManagers.lostHint', { defaultValue: '{{v}} новых лидов', v: pct(tot.lossRate) }),
    },
    {
      k: L.repeatRevenue,
      v: m(tot.repeatRevenue),
      d: <Delta now={tot.repeatRevenue} prev={prev?.repeatRevenue} kind="pct" />,
      sp: allSeries.map((x) => x.repeatRevenue),
      f: t('crm.leads.roiManagers.repeatHint', {
        defaultValue: '{{n}} лидов купили повторно · {{share}} из {{total}}',
        n: F.n0(repeatLeads),
        share: pct(tot.revenue ? tot.repeatRevenue / tot.revenue : null),
        total: m(tot.revenue),
      }),
    },
  ];

  const COLS: Array<[string, string]> = [
    ['leads', L.leads],
    ['won', L.won],
    ['lost', L.lost],
    ['conv', L.conv],
    ['revenue', L.revenue],
    ['repeatLeads', L.repeat],
    ['repeatRevenue', L.repeatRevenue],
  ];
  const th = (k: string, l: string) => (
    <th key={k} className={px(k !== 'name' && 'n', sort.k === k && 'on')}>
      <button type="button" onClick={() => setSort((s) => ({ k, d: s.k === k ? -s.d : k === 'name' ? 1 : -1 }))}>
        {l}
        <span className="ar">{sort.k === k ? (sort.d > 0 ? '↑' : '↓') : ''}</span>
      </button>
    </th>
  );

  const Legend = () => (
    <div className="lr-leg">
      <span>
        <i className="w" />
        {L.won}
      </span>
      <span>
        <i className="l" />
        {L.lost}
      </span>
      <span>
        <i className="o" />
        {L.open}
      </span>
    </div>
  );

  /** Столбики по месяцам: новые лиды, разложенные на выиграно / проиграно / в работе. */
  const OutcomeChart: React.FC<{ data: Array<LM & { key: string }>; h: number }> = ({ data, h }) => {
    const mx = Math.max(1, ...data.map((x) => x.leads));
    return (
      <div className="lr-chart" style={{ height: h }}>
        {data.map((x) => {
          const [yy, mm] = x.key.split('-').map(Number);
          const tip = `${MN.long[mm - 1]} ${yy}: ${L.leads} ${x.leads} · ${L.won} ${x.won} · ${L.lost} ${x.lost} · ${L.open} ${x.open}`;
          return (
            <div className="col" key={x.key} title={tip}>
              <div className="stk" style={{ height: `${(x.leads / mx) * 100}%` }}>
                {x.open > 0 && <i className="o" style={{ flexGrow: x.open }} />}
                {x.lost > 0 && <i className="l" style={{ flexGrow: x.lost }} />}
                {x.won > 0 && <i className="w" style={{ flexGrow: x.won }} />}
              </div>
              <span className="mo">{MN.short[mm - 1]}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDetail = (r: ManagerRoiRow) => {
    const monthRows = months
      .slice()
      .reverse()
      .map((key) => {
        const mt = lmOf(r.months[key]);
        const [yy, mm] = key.split('-').map(Number);
        const empty = !mt.leads && !mt.deals;
        const dash = (v: number, f: (n: number) => string = F.n0) => (v ? f(v) : <span className="mut">—</span>);
        return (
          <tr key={key} className={px(empty && 'empty')}>
            <td className="mo">
              <b>{MN.long[mm - 1]}</b> <span>{yy}</span>
            </td>
            <td className="n">{dash(mt.leads)}</td>
            <td className="n lr-w">{dash(mt.won)}</td>
            <td className="n lr-l">{dash(mt.lost)}</td>
            <td className="n b">{dash(mt.revenue, m)}</td>
            <td className="n">{dash(mt.repeatRevenue, m)}</td>
          </tr>
        );
      });
    return (
      <div className="roi-det">
        <div className="roi-det-top">
          <div className="roi-mt-wrap">
            <table className="roi-mt lr-mt">
              <thead>
                <tr>
                  <th>{t('crm.marketingRoi.month', { defaultValue: 'Месяц' })}</th>
                  <th className="n">{L.leads}</th>
                  <th className="n">{L.won}</th>
                  <th className="n">{L.lost}</th>
                  <th className="n">{L.revenue}</th>
                  <th className="n">{L.repeat}</th>
                </tr>
              </thead>
              <tbody>{monthRows}</tbody>
            </table>
          </div>
          <section className="roi-card">
            <header>
              <div>
                <div className="kick">
                  {nameOf(r)} · {r.leadsWithRevenue}
                </div>
                <h3>{t('crm.leads.roiManagers.topLeads', { defaultValue: 'Лиды с выручкой' })}</h3>
              </div>
            </header>
            {r.topLeads.length ? (
              <div className="roi-lds">
                {r.topLeads.map((l) => (
                  <button type="button" key={l.leadId} onClick={() => navigate(`/leads/${l.leadId}`)}>
                    <b>{l.name || t('crm.leads.roi.table.unnamed', { defaultValue: 'Без названия' })}</b>
                    {l.repeatDeals > 0 && (
                      <em className="lr-rep">
                        {t('crm.leads.roiManagers.repeatBadge', { defaultValue: 'повторно ×{{n}}', n: l.repeatDeals })}
                      </em>
                    )}
                    <span>×{l.deals}</span>
                    <strong>{m(l.revenue)}</strong>
                  </button>
                ))}
              </div>
            ) : (
              <p className="lr-none">{t('crm.leads.roiManagers.noRevenue', { defaultValue: 'За период лиды менеджера не принесли выручки.' })}</p>
            )}
          </section>
        </div>
      </div>
    );
  };

  const emptyText = loading
    ? t('crm.common.loading', { defaultValue: 'Загрузка…' })
    : managers.length
      ? t('crm.marketingRoi.noMatch', { defaultValue: 'Ничего не найдено.' })
      : t('crm.leads.roiManagers.empty', { defaultValue: 'За период нет новых лидов и выручки по лидам.' });

  const toggle = (key: string) => setOpen((p) => ({ ...p, [key]: !p[key] }));

  return (
    <MainLayout>
      <PageHelpButton topic="leadsRoi" />
      <div className="roi">
        <div className="roi-head">
          <div className="kick">{t('crm.leads.roiManagers.kicker', { defaultValue: 'Лиды' })}</div>
          <h1>{t('crm.leads.roiManagers.title', { defaultValue: 'ROI по лидам' })}</h1>
          <p>
            {t('crm.leads.roiManagers.lead', {
              defaultValue: 'Сколько лидов каждый менеджер выиграл и проиграл, сколько выручки они принесли и кто из клиентов купил повторно.',
            })}
          </p>
        </div>

        <div className="roi-bar">
          <PeriodPicker months={MONTHS} value={period} onChange={setPeriod} locale={locale} t={t} />
          <div className="roi-seg" role="group" aria-label={t('crm.marketingRoi.currency', { defaultValue: 'Валюта' })}>
            {CURRENCIES.map((k) => (
              <button type="button" key={k} className={px(cur === k && 'on')} onClick={() => setCur(k)}>
                {k}
              </button>
            ))}
          </div>
          <span className="roi-vsep" />
          <div className="roi-src">
            <span className="kick">{t('crm.marketingRoi.revenueFrom', { defaultValue: 'Выручка из' })}</span>
            <div className="roi-seg" role="group">
              {MODES.map((k) => (
                <button type="button" key={k} className={px(source === k && 'on')} onClick={() => setSource(k)}>
                  {k === 'sales'
                    ? t('crm.leads.roiManagers.srcSales', { defaultValue: 'Продажи' })
                    : t('crm.leads.roiManagers.srcProjects', { defaultValue: 'Проекты' })}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <div className="roi-err">{error}</div>}

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
                {t('crm.leads.roiManagers.outcomes', { defaultValue: 'Исход новых лидов' })} · {len} {t('crm.marketingRoi.pp.monthsShort', { defaultValue: 'мес' })}
              </div>
              <h3>{focus === 'all' ? t('crm.leads.roiManagers.allManagers', { defaultValue: 'Все менеджеры' }) : focusRows[0] ? nameOf(focusRows[0]) : ''}</h3>
            </div>
            <div className="roi-ch-ctl">
              <select className="roi-sel" value={focus} onChange={(e) => setFocus(e.target.value)}>
                <option value="all">{t('crm.leads.roiManagers.allManagers', { defaultValue: 'Все менеджеры' })}</option>
                {managers.map((r) => (
                  <option key={r.key} value={r.key}>
                    {nameOf(r)}
                  </option>
                ))}
              </select>
            </div>
          </header>
          {chartData.some((x) => x.leads) ? (
            <>
              <OutcomeChart data={chartData} h={isMobile ? 170 : 220} />
              <Legend />
            </>
          ) : (
            <div className="roi-ch-empty" style={{ height: 180 }}>
              {emptyText}
            </div>
          )}
        </section>

        <section className="roi-card flush">
          <header className="pad">
            <div>
              <div className="kick">
                {t('crm.leads.roiManagers.managers', { defaultValue: 'Менеджеры' })} · {rows.length}
              </div>
              <h3>{t('crm.leads.roiManagers.paybackTitle', { defaultValue: 'Результат по менеджерам' })}</h3>
            </div>
            <label className="roi-search">
              <Ico d={AI.srch} />
              <input
                placeholder={t('crm.leads.roiManagers.searchPh', { defaultValue: 'Менеджер или отдел' })}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
          </header>
          {isMobile ? (
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
                    {[['name', L.manager] as [string, string], ...COLS].flatMap(([k, l]) =>
                      (k === 'name' ? [1] : [-1, 1]).map((d) => (
                        <option key={`${k}|${d}`} value={`${k}|${d}`}>
                          {t('crm.marketingRoi.sortBy', { defaultValue: 'Сортировка' })}: {l} {d > 0 ? '↑' : '↓'}
                        </option>
                      )),
                    )}
                  </select>
                </div>
              )}
              {rows.map(({ r, a }) => {
                const o = !!open[r.key];
                return (
                  <div key={r.key} className={px('roi-mc', o && 'open')}>
                    <div className="hd" role="button" tabIndex={0} aria-expanded={o} onClick={() => toggle(r.key)}>
                      <span className="roi-exp" aria-hidden>
                        <Ico d={AI.chev} s={13} />
                      </span>
                      <div className="t">
                        <b>{nameOf(r)}</b>
                        <div className="sub">
                          {r.department && <span>{r.department}</span>}
                          <span>
                            {L.leads} {a.leads} · {L.conv.toLocaleLowerCase(locale)} {pct(a.conv)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <OutcomeBar a={a} />
                    <div className="grid lr-mc-grid">
                      <div>
                        <div className="k">{L.won}</div>
                        <div className="v lr-w">{F.n0(a.won)}</div>
                      </div>
                      <div>
                        <div className="k">{L.lost}</div>
                        <div className="v lr-l">{F.n0(a.lost)}</div>
                      </div>
                      <div>
                        <div className="k">{L.revenue}</div>
                        <div className="v">{a.revenue ? m(a.revenue) : '—'}</div>
                      </div>
                      <div>
                        <div className="k">{L.repeat}</div>
                        <div className="v">
                          {a.repeatRevenue ? m(a.repeatRevenue) : '—'}
                          {a.repeatLeads > 0 && <span className="lr-sub"> · {a.repeatLeads}</span>}
                        </div>
                      </div>
                    </div>
                    {o && renderDetail(r)}
                  </div>
                );
              })}
              {!rows.length && <div className="roi-mc-empty">{emptyText}</div>}
            </div>
          ) : (
            <div className="roi-t-wrap" ref={twRef} style={{ ['--tw' as string]: tw ? `${tw}px` : '100%' } as React.CSSProperties}>
              <table className="roi-t lr-t">
                <thead>
                  <tr>
                    {th('name', L.manager)}
                    {COLS.map(([k, l]) => th(k, l))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ r, a }) => {
                    const o = !!open[r.key];
                    return (
                      <React.Fragment key={r.key}>
                        <tr className={px('cl', o && 'open')} onClick={() => toggle(r.key)}>
                          <td className="nm">
                            <div className="nm-in">
                              <button
                                type="button"
                                className="roi-exp"
                                aria-expanded={o}
                                aria-label={o ? t('crm.marketingRoi.collapse', { defaultValue: 'Свернуть' }) : t('crm.marketingRoi.expand', { defaultValue: 'Раскрыть' })}
                              >
                                <Ico d={AI.chev} s={13} />
                              </button>
                              <Avatar r={r} />
                              <div>
                                <div className="t">
                                  <b>{nameOf(r)}</b>
                                  {r.department && <span>{r.department}</span>}
                                  {r.inactive && (
                                    <span className="roi-badge mutd">{t('crm.leads.roiManagers.inactive', { defaultValue: 'не работает' })}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="n">
                            <div className="sp">
                              {F.n0(a.leads)}
                              <OutcomeBar a={a} />
                            </div>
                          </td>
                          <td className="n b lr-w">{a.won ? F.n0(a.won) : <span className="mut">—</span>}</td>
                          <td className="n lr-l">{a.lost ? F.n0(a.lost) : <span className="mut">—</span>}</td>
                          <td className="n">{pct(a.conv)}</td>
                          <td className="n">{a.revenue ? m(a.revenue) : <span className="mut">—</span>}</td>
                          <td className="n">{a.repeatLeads ? F.n0(a.repeatLeads) : <span className="mut">—</span>}</td>
                          <td className="n b">{a.repeatRevenue ? m(a.repeatRevenue) : <span className="mut">—</span>}</td>
                        </tr>
                        {o && (
                          <tr className="det">
                            <td colSpan={COLS.length + 1}>{renderDetail(r)}</td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {!rows.length && (
                    <tr>
                      <td colSpan={COLS.length + 1} className="roi-t-empty">
                        {emptyText}
                      </td>
                    </tr>
                  )}
                </tbody>
                {rows.length > 0 && (
                  <tfoot>
                    <tr>
                      <td>
                        {t('crm.marketingRoi.totalRow', { defaultValue: 'Итого' })} · {rows.length}
                      </td>
                      <td className="n">{F.n0(tot.leads)}</td>
                      <td className="n">{F.n0(tot.won)}</td>
                      <td className="n">{F.n0(tot.lost)}</td>
                      <td className="n">{pct(tot.conv)}</td>
                      <td className="n">{m(tot.revenue)}</td>
                      <td className="n">{F.n0(repeatLeads)}</td>
                      <td className="n">{m(tot.repeatRevenue)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </section>

        <p className="roi-note">
          {t('crm.leads.roiManagers.footnote', {
            defaultValue:
              'Лиды, выиграно и проиграно — лиды, созданные за период, по их текущему статусу и ответственному. Выручка — {{src}} лидов за период (отменённые и возвраты не учитываются); повторная — вторая и следующие покупки того же лида. Суммы в {{cur}} по курсу ECB{{asOf}}.',
            src:
              source === 'sales'
                ? t('crm.leads.roiManagers.srcSalesGen', { defaultValue: 'продажи' })
                : t('crm.leads.roiManagers.srcProjectsGen', { defaultValue: 'проекты' }),
            cur,
            asOf: report?.fxAsOf ? ` (${report.fxAsOf})` : '',
          })}
        </p>
      </div>
    </MainLayout>
  );
};
