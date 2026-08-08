// src/pages/analytics/BiDashboardPage.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { fetchBiDashboardSummary, type BiDashboardSummary, type BiTrend, type CurrencyAmount } from '../../api/biDashboard';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { Ic, BI_ICON } from './BiDashboardIcons';
import '../telephony/telephony-design.css';
import './bi-dashboard-design.css';

const cx = (...a: Array<string | false | undefined>) => a.filter(Boolean).join(' ');

const formatAmounts = (amounts: CurrencyAmount[]): string => {
  if (amounts.length === 0) return '—';
  return amounts
    .map((a) => `${a.amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ${a.currency}`)
    .join(' + ');
};

const trendArrow = (t: BiTrend) => (t.direction === 'up' ? '▲' : t.direction === 'down' ? '▼' : '–');
const trendClass = (t: BiTrend) => (t.direction === 'up' ? 'up' : t.direction === 'down' ? 'down' : undefined);

const Spark: React.FC<{ data: number[]; color?: string; height?: number }> = ({ data, color = '#222', height = 32 }) => {
  if (!data.length) return null;
  const w = 160;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * w},${height - ((v - min) / span) * (height - 4) - 2}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polygon points={`0,${height} ${pts} ${w},${height}`} fill={color} opacity="0.08" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const LineChart: React.FC<{ series: Array<{ data: number[]; color: string; label: string }>; labels: string[]; width?: number; height?: number }> = ({ series, labels, width = 900, height = 140 }) => {
  const allVals = series.flatMap((s) => s.data);
  const max = Math.max(1, ...allVals);
  const niceMax = Math.ceil(max / 5) * 5 || 1;
  const padL = 26, padB = 18, padT = 8;
  const innerW = width - padL, innerH = height - padB - padT;
  const n = series[0]?.data.length || 1;
  const xAt = (i: number) => padL + (n > 1 ? (i / (n - 1)) * innerW : 0);
  const yAt = (v: number) => padT + innerH - (v / niceMax) * innerH;
  const gridVals = [0, niceMax / 2, niceMax];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {gridVals.map((g, i) => (
        <g key={i}>
          <line x1={padL} x2={width} y1={yAt(g)} y2={yAt(g)} stroke="var(--line-3)" strokeWidth="1" />
          <text x={0} y={yAt(g) + 3} fontSize="8.5" fill="var(--fg-3)" fontFamily="var(--ff-mono)">{Math.round(g)}</text>
        </g>
      ))}
      {series.map((s, si) => {
        const path = s.data.map((v, i) => (i === 0 ? 'M' : 'L') + xAt(i).toFixed(1) + ',' + yAt(v).toFixed(1)).join(' ');
        return (
          <g key={si}>
            <path d={path} fill="none" stroke={s.color} strokeWidth="1.5" />
            {s.data.length > 0 && <circle cx={xAt(n - 1)} cy={yAt(s.data[n - 1])} r="2.5" fill={s.color} />}
          </g>
        );
      })}
      {labels.map((l, i) => (i % 5 === 0) && (
        <text key={i} x={xAt(i)} y={height - 2} fontSize="8.5" fill="var(--fg-3)" textAnchor="middle" fontFamily="var(--ff-mono)">{l}</text>
      ))}
    </svg>
  );
};

const MODULE_COLORS: Record<string, string> = {
  leads: '#3b6cb6',
  sales: '#1f8a5e',
  products: '#5a45a8',
  bookings: '#a06b1a',
  hotels: '#7a4fc9',
  telephony: '#cc2f47',
};

function downloadCsv(data: BiDashboardSummary) {
  const rows = [
    ['Модуль', 'Значение', 'Комментарий'],
    ['Лиды', String(data.leads.total), `Конверсия ${data.leads.conversionRate}%`],
    ['Продажи', formatAmounts(data.sales.revenue), `${data.sales.confirmed} подтверждённых`],
    ['Товары', formatAmounts(data.products.inventoryValue), `${data.products.lowStockCount} с низким остатком`],
    ['Бронирования', formatAmounts(data.bookings.revenue), `${data.bookings.completed} завершено`],
    ['Отели', formatAmounts(data.hotels.revenue), `${data.hotels.total} броней`],
    ['Звонки и SMS', String(data.telephony.calls), `SMS ${data.telephony.sms}`],
  ];
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bi-dashboard-${data.period.days}d.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const BiDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [data, setData] = useState<BiDashboardSummary | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchBiDashboardSummary(days)
      .then(setData)
      .catch((e) => showAlert(e?.message || 'Не удалось загрузить BI-дашборд', { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  if (loading || !data) {
    return (
      <MainLayout>
        <div className="px-scope">
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>Загрузка…</div>
        </div>
      </MainLayout>
    );
  }

  const dayLabels = data.dailyTrend.map((d) => new Date(d.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }));
  const series = [
    { key: 'leads', label: 'Лиды', color: MODULE_COLORS.leads, data: data.dailyTrend.map((d) => d.leads) },
    { key: 'sales', label: 'Продажи', color: MODULE_COLORS.sales, data: data.dailyTrend.map((d) => d.sales) },
    { key: 'bookings', label: 'Бронирования', color: MODULE_COLORS.bookings, data: data.dailyTrend.map((d) => d.bookings) },
    { key: 'hotels', label: 'Отели', color: MODULE_COLORS.hotels, data: data.dailyTrend.map((d) => d.hotels) },
    { key: 'calls', label: 'Звонки', color: MODULE_COLORS.telephony, data: data.dailyTrend.map((d) => d.calls) },
  ];

  const modules = [
    {
      key: 'leads',
      name: 'Лиды',
      icon: BI_ICON.leads,
      link: '/app/leads/analytics',
      color: MODULE_COLORS.leads,
      spark: series[0].data,
      kpis: [
        { l: `Лиды, ${days}д`, v: `${data.leads.total}` },
        { l: 'Конверсия', v: `${data.leads.conversionRate}`, u: '%' },
        { l: 'В работе', v: `${data.leads.openPipeline}` },
      ],
      foot: `${trendArrow(data.leads.trend)} ${data.leads.trend.pct}% лидов vs пред. период`,
      footClass: trendClass(data.leads.trend),
    },
    {
      key: 'sales',
      name: 'Продажи',
      icon: BI_ICON.sales,
      link: '/app/sales/analytics',
      color: MODULE_COLORS.sales,
      spark: series[1].data,
      kpis: [
        { l: 'Продажи', v: `${data.sales.confirmed}` },
        { l: 'Выручка', v: formatAmounts(data.sales.revenue) },
        { l: 'Ср. чек', v: formatAmounts(data.sales.avgDeal) },
      ],
      foot: `${trendArrow(data.sales.trend)} ${data.sales.trend.pct}% продаж vs пред. период`,
      footClass: trendClass(data.sales.trend),
    },
    {
      key: 'products',
      name: 'Товары',
      icon: BI_ICON.products,
      link: '/app/products/analytics',
      color: MODULE_COLORS.products,
      spark: [] as number[],
      kpis: [
        { l: 'Активных', v: `${data.products.activeCount}` },
        { l: 'Остаток', v: formatAmounts(data.products.inventoryValue) },
        { l: 'Низкий остаток', v: `${data.products.lowStockCount}` },
      ],
      foot: data.products.lowStockCount > 0 ? `⚠ ${data.products.lowStockCount} товар(ов) требуют пополнения` : 'Остатки в норме',
      footClass: data.products.lowStockCount > 0 ? 'warn' : undefined,
    },
    {
      key: 'bookings',
      name: 'Бронирования',
      icon: BI_ICON.bookings,
      link: '/bookings/analytics',
      color: MODULE_COLORS.bookings,
      spark: series[2].data,
      kpis: [
        { l: 'Броней', v: `${data.bookings.total}` },
        { l: 'Выполнено', v: `${data.bookings.completed}` },
        { l: 'Выручка', v: formatAmounts(data.bookings.revenue) },
      ],
      foot: `${trendArrow(data.bookings.trend)} ${data.bookings.trend.pct}% броней vs пред. период`,
      footClass: trendClass(data.bookings.trend),
    },
    {
      key: 'hotels',
      name: 'Отели',
      icon: BI_ICON.hotels,
      link: '/hotels/analytics',
      color: MODULE_COLORS.hotels,
      spark: series[3].data,
      kpis: [
        { l: 'Броней', v: `${data.hotels.total}` },
        { l: 'Отменено', v: `${data.hotels.cancelled}` },
        { l: 'Выручка', v: formatAmounts(data.hotels.revenue) },
      ],
      foot: `${trendArrow(data.hotels.trend)} ${data.hotels.trend.pct}% броней отелей vs пред. период`,
      footClass: trendClass(data.hotels.trend),
    },
    {
      key: 'telephony',
      name: 'Звонки и SMS',
      icon: BI_ICON.telephony,
      link: '/app/telephony/analytics',
      color: MODULE_COLORS.telephony,
      spark: series[4].data,
      kpis: data.telephony.enabled
        ? [
            { l: 'Звонков', v: `${data.telephony.calls}` },
            { l: 'Дозвон', v: `${data.telephony.pickupRate}`, u: '%' },
            { l: 'SMS', v: `${data.telephony.sms}` },
          ]
        : [{ l: 'SMS', v: `${data.telephony.sms}` }],
      foot: data.telephony.enabled
        ? `${trendArrow(data.telephony.trend)} ${data.telephony.trend.pct}% звонков vs пред. период`
        : 'Телефония не подключена',
      footClass: data.telephony.enabled ? trendClass(data.telephony.trend) : undefined,
    },
  ];

  const maxChannel = Math.max(1, ...data.channels.map((c) => c.count));
  const maxFunnel = Math.max(1, data.funnel[0]?.value || 1);

  return (
    <MainLayout>
      <div className="px-scope">
        <div className="tel-hero">
          <div>
            <div className="kicker"><span className="dot" />ВСЕ МОДУЛИ · ЗА ПОСЛЕДНИЕ {days} ДНЕЙ</div>
            <h1>{t('crm.nav.biDashboard', 'BI-дашборд')}</h1>
            <p className="sub">Сводная картина по лидам, продажам, товарам, бронированиям, отелям и телефонии в одном месте — что происходит и что требует внимания прямо сейчас.</p>
          </div>
          <div className="tel-hero-r">
            <button className="btn btn-sm" onClick={() => downloadCsv(data)}><Ic d={BI_ICON.download} size={13} />Экспорт</button>
            {[30, 90].map((d) => (
              <button key={d} className={'btn btn-sm' + (days === d ? ' btn-primary' : '')} onClick={() => setDays(d)}>
                {d} дней
              </button>
            ))}
          </div>
        </div>

        <div className="ha-kpis">
          <div className="ha-kpi">
            <div className="l">Обращений за период</div>
            <div className="v">{data.totals.touches.toLocaleString('ru-RU')}</div>
            <div className={cx('d', trendClass(data.totals.touchesTrend))}>{trendArrow(data.totals.touchesTrend)} {data.totals.touchesTrend.pct}% · лиды + брони + звонки + SMS</div>
          </div>
          <div className="ha-kpi">
            <div className="l">Активные клиенты</div>
            <div className="v">{data.totals.activeClients.toLocaleString('ru-RU')}</div>
            <div className="d">по базе контактов</div>
          </div>
          <div className="ha-kpi">
            <div className="l">Требуют внимания</div>
            <div className="v">{data.totals.attentionCount}</div>
            <div className={cx('d', data.totals.attentionCount > 0 && 'warn')}>{data.totals.attentionCount > 0 ? 'риски по модулям — см. ниже' : 'критичных отклонений нет'}</div>
          </div>
          <div className="ha-kpi">
            <div className="l">Ср. тональность звонков</div>
            <div className="v">{data.totals.avgSentiment === null ? '—' : (data.totals.avgSentiment > 0 ? '+' : '') + data.totals.avgSentiment}</div>
            <div className="d">от −1 до +1</div>
          </div>
        </div>

        <div className="ha-section">
          <div className="ha-section-head">
            <div>
              <h3><Ic d={BI_ICON.analytics} size={15} />Модули</h3>
              <div className="sub">Ключевые метрики каждого модуля — откройте карточку для полной аналитики.</div>
            </div>
          </div>
          <div className="bi-modules">
            {modules.map((m) => (
              <Link to={m.link} key={m.key} className="bi-mod">
                <div className="bi-mod-head">
                  <div className="bi-mod-name"><span className="ic"><Ic d={m.icon} size={14} /></span>{m.name}</div>
                  <span className="bi-mod-link"><Ic d={BI_ICON.chevR} size={14} /></span>
                </div>
                <div className="bi-mod-sub">Открыть полную аналитику →</div>
                <div className="bi-mod-kpis">
                  {m.kpis.map((k) => (
                    <div key={k.l} className="bi-mod-kpi">
                      <div className="l">{k.l}</div>
                      <div className="v">{k.v}{'u' in k && k.u && <small>{k.u}</small>}</div>
                    </div>
                  ))}
                </div>
                {m.spark.length > 0 && <div className="bi-mod-spark"><Spark data={m.spark} color={m.color} /></div>}
                <div className="bi-mod-foot"><span className={m.footClass}>{m.foot}</span></div>
              </Link>
            ))}
          </div>
        </div>

        <div className="ha-section">
          <div className="ha-section-head">
            <div>
              <h3>Активность по модулям</h3>
              <div className="sub">Количество новых записей в день за период</div>
            </div>
          </div>
          <LineChart series={series} labels={dayLabels} />
          <div className="bi-combined-legend">
            {series.map((s) => (
              <span key={s.key}><i style={{ background: s.color }} />{s.label} — {s.data.reduce((a, b) => a + b, 0)} за период</span>
            ))}
          </div>
        </div>

        <div className="ha-section">
          <div className="ha-section-head">
            <div>
              <h3><Ic d={BI_ICON.chat} size={15} />Каналы обращений</h3>
              <div className="sub">Источники лидов, звонки и SMS за период.</div>
            </div>
          </div>
          {data.channels.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>Нет данных за выбранный период</div>}
          {data.channels.map((c) => (
            <div key={c.key} className="rev-bar-row">
              <span style={{ color: 'var(--fg-3)' }}>{c.label}</span>
              <span className="rev-bar-track"><span className="rev-bar-fill" style={{ width: (c.count / maxChannel * 100) + '%', background: 'var(--ink)' }} /></span>
              <span className="rev-bar-val">{c.count}</span>
            </div>
          ))}
        </div>

        <div className="bi-two-col">
          <div className="ha-section" style={{ marginBottom: 0, minWidth: 0 }}>
            <div className="ha-section-head">
              <div>
                <h3><Ic d={BI_ICON.funnel} size={15} />Лиды — воронка</h3>
                <div className="sub">Статусы лидов за период</div>
              </div>
            </div>
            {data.funnel.map((s) => (
              <div key={s.key} className="rev-bar-row">
                <span style={{ color: 'var(--fg-3)' }}>{s.label}</span>
                <span className="rev-bar-track"><span className="rev-bar-fill" style={{ width: (s.value / maxFunnel * 100) + '%', background: MODULE_COLORS.leads }} /></span>
                <span className="rev-bar-val">{s.value}</span>
              </div>
            ))}
          </div>
          <div className="ha-section" style={{ marginBottom: 0, minWidth: 0 }}>
            <div className="ha-section-head">
              <div>
                <h3><Ic d={BI_ICON.companies} size={15} />Топ компаний</h3>
                <div className="sub">По выручке (проекты), за всё время</div>
              </div>
            </div>
            {data.topCompanies.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>Нет данных по компаниям</div>
            ) : (
              <div className="pace-table-wrap bi-co-table-wrap">
                <table className="pace-table bi-co-table">
                  <thead><tr><th>Компания</th><th>Лиды</th><th>Проекты</th><th>Выручка</th></tr></thead>
                  <tbody>
                    {data.topCompanies.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td style={{ color: 'var(--fg-3)' }}>{c.leads}</td>
                        <td>{c.projects}</td>
                        <td className="need low">{c.revenue.toLocaleString('ru-RU')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="bi-two-col-wide">
          <div className="ha-section" style={{ marginBottom: 0 }}>
            <div className="ha-section-head">
              <div>
                <h3><Ic d={BI_ICON.flag} size={15} />Требует внимания</h3>
                <div className="sub">Риски и отклонения из всех модулей, отсортированы по важности.</div>
              </div>
            </div>
            <div className="bi-alerts">
              {data.alerts.map((a, i) => (
                <Link key={i} className="bi-alert" to={a.link}>
                  <span className={cx('ha-risk-pill', a.risk)}>{a.risk === 'bad' ? 'риск' : a.risk === 'warn' ? 'внимание' : 'ок'}</span>
                  <span className="bi-alert-mod">{a.module}</span>
                  <span className="bi-alert-txt">{a.text}</span>
                  <span className="bi-alert-link">Открыть →</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="ha-section" style={{ marginBottom: 0 }}>
            <div className="ha-section-head">
              <div>
                <h3><Ic d={BI_ICON.staff} size={15} />Команда</h3>
                <div className="sub">Лиды, звонки и брони по сотрудникам за период.</div>
              </div>
            </div>
            {data.team.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>Нет назначенных сотрудников за период</div>
            ) : (
              <div className="bi-team">
                {data.team.map((tm, i) => (
                  <div key={tm.id} className="bi-team-row">
                    <span className="bi-team-rank">#{i + 1}</span>
                    <span className="bi-team-name">
                      <span className="ava">{tm.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}</span>
                      <span>
                        <span className="nm">{tm.name}</span>
                        <div className="bi-team-chips">
                          {tm.leads > 0 && <span className="bi-team-chip">Лиды · {tm.leads}</span>}
                          {tm.calls > 0 && <span className="bi-team-chip">Звонки · {tm.calls}</span>}
                          {tm.bookings > 0 && <span className="bi-team-chip">Брони · {tm.bookings}</span>}
                        </div>
                      </span>
                    </span>
                    <span className="bi-team-delta">{tm.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
