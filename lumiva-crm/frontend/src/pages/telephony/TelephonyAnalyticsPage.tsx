// src/pages/telephony/TelephonyAnalyticsPage.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { TelephonySubnav } from './TelephonySubnav';
import { fetchTelephonyAnalytics, type TelephonyAnalytics } from '../../api/telephony';
import { TOPIC_LABEL } from './telephonyLabels';
import { useAlertModal } from '../../contexts/AlertModalContext';
import './telephony-design.css';

const formatDuration = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const LineChart: React.FC<{ series: Array<{ data: number[]; color: string }>; labels: string[]; width?: number; height?: number }> = ({ series, labels, width = 640, height = 120 }) => {
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
      {labels.map((l, i) => (i % 3 === 0) && (
        <text key={i} x={xAt(i)} y={height - 2} fontSize="8.5" fill="var(--fg-3)" textAnchor="middle" fontFamily="var(--ff-mono)">{l}</text>
      ))}
    </svg>
  );
};

const BarRow: React.FC<{ label: string; val: number; max: number; color?: string }> = ({ label, val, max, color = '#222' }) => (
  <div className="rev-bar-row">
    <span style={{ color: 'var(--fg-3)' }}>{label}</span>
    <span className="rev-bar-track"><span className="rev-bar-fill" style={{ width: max ? (val / max * 100) + '%' : '0%', background: color }} /></span>
    <span className="rev-bar-val">{val}</span>
  </div>
);

export const TelephonyAnalyticsPage: React.FC = () => {
  const { showAlert } = useAlertModal();
  const [data, setData] = useState<TelephonyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTelephonyAnalytics(30)
      .then(setData)
      .catch((e) => showAlert(e?.message || 'Не удалось загрузить аналитику', { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !data) {
    return (
      <MainLayout>
        <div className="px-scope">
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>Загрузка…</div>
        </div>
      </MainLayout>
    );
  }

  const dayLabels = data.dailySeries.map((d) => new Date(d.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }));
  const callSeries = data.dailySeries.map((d) => d.calls);
  const smsSeries = data.dailySeries.map((d) => d.sms);
  const maxManagerTotal = Math.max(1, ...data.byManager.map((m) => m.calls + m.sms));
  const maxHourly = Math.max(1, ...data.hourlyLoad.map((h) => h.count));

  return (
    <MainLayout>
      <div className="px-scope">
        <div className="tel-hero">
          <div>
            <div className="kicker"><span className="dot" />ЗА ПОСЛЕДНИЕ 30 ДНЕЙ</div>
            <h1>Аналитика звонков и SMS</h1>
            <p className="sub">Динамика объёмов, нагрузка по часам и эффективность по менеджерам.</p>
          </div>
        </div>

        <TelephonySubnav active="analytics" />

        {!data.telephonyEnabled && (
          <div className="ha-section" style={{ background: '#fffbea' }}>
            <p style={{ fontSize: 12.5, margin: 0 }}>
              Метрики звонков недоступны — телефония не подключена. SMS-метрики ниже доступны без неё.{' '}
              <Link to="/telephony/settings" style={{ fontWeight: 600 }}>Подключить телефонию</Link>
            </p>
          </div>
        )}

        <div className="tel-kpis">
          <div className="tel-kpi"><div className="l">Звонков всего</div><div className="v">{data.kpis.totalCalls}</div></div>
          <div className="tel-kpi"><div className="l">SMS всего</div><div className="v">{data.kpis.totalSms}</div></div>
          <div className="tel-kpi"><div className="l">Дозвон</div><div className="v">{data.kpis.pickupRate}%</div></div>
          <div className="tel-kpi"><div className="l">Доставка SMS</div><div className="v">{data.kpis.smsDeliveryRate}%</div></div>
          <div className="tel-kpi"><div className="l">Средняя длительность</div><div className="v">{formatDuration(data.kpis.avgCallDurationSeconds)}</div></div>
        </div>

        <div className="ha-section">
          <div className="ha-section-head">
            <div>
              <h3>Динамика звонков и SMS</h3>
              <div className="sub">Количество в день, {data.dailySeries.length} дней</div>
            </div>
          </div>
          <LineChart series={[{ data: callSeries, color: '#222' }, { data: smsSeries, color: '#3b6cb6' }]} labels={dayLabels} />
          <div className="pace-legend">
            <span><i style={{ background: '#222' }} />Звонки — {callSeries.reduce((a, b) => a + b, 0)} за период</span>
            <span><i style={{ background: '#3b6cb6' }} />SMS — {smsSeries.reduce((a, b) => a + b, 0)} за период</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: data.telephonyEnabled ? '1fr 1fr' : '1fr', gap: 16 }}>
          <div className="ha-section" style={{ marginBottom: 0 }}>
            <div className="ha-section-head">
              <div>
                <h3>По менеджерам</h3>
                <div className="sub">Звонков и SMS обработано за период</div>
              </div>
            </div>
            {data.byManager.length === 0 ? (
              <p style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>Нет данных за период</p>
            ) : (
              data.byManager.slice(0, 8).map((m) => (
                <BarRow key={m.staffUserId || 'unassigned'} label={m.name} val={m.calls + m.sms} max={maxManagerTotal} />
              ))
            )}
          </div>

          {data.telephonyEnabled && (
            <div className="ha-section" style={{ marginBottom: 0 }}>
              <div className="ha-section-head">
                <div>
                  <h3>Тональность разговоров</h3>
                  <div className="sub">Автоматический анализ по записям (ИИ)</div>
                </div>
              </div>
              {data.sentiment.analyzed === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>
                  Пока нет проанализированных звонков — анализ запускается автоматически после того, как готова расшифровка записи.
                </p>
              ) : (
                <>
                  <BarRow label="Позитивный" val={data.sentiment.positive} max={data.sentiment.analyzed} color="#1f8a5e" />
                  <BarRow label="Нейтральный" val={data.sentiment.neutral} max={data.sentiment.analyzed} color="#a06b1a" />
                  <BarRow label="Негативный" val={data.sentiment.negative} max={data.sentiment.analyzed} color="#cc2f47" />
                  {data.sentiment.topNegativeTopics.length > 0 && (
                    <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg-muted)', borderRadius: 10, fontSize: 11.5, color: 'var(--fg-3)', lineHeight: 1.5 }}>
                      Топ негативных тем:{' '}
                      {data.sentiment.topNegativeTopics.map((t, i) => (
                        <React.Fragment key={t.topic}>
                          {i > 0 && ', '}
                          <b style={{ color: 'var(--ink)' }}>{TOPIC_LABEL[t.topic]}</b> ({t.count})
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {data.telephonyEnabled && (
          <div className="ha-section">
            <div className="ha-section-head">
              <div>
                <h3>Загрузка по часам дня</h3>
                <div className="sub">Когда клиенты чаще всего звонят</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 56, marginTop: 8 }}>
              {data.hourlyLoad.map((h) => (
                <div key={h.hour} style={{ flex: 1, height: (h.count / maxHourly * 56) + 'px', background: '#222', opacity: 0.18 + (h.count / maxHourly) * 0.6, borderRadius: 2 }} title={`${h.hour}:00 — ${h.count} звонков`} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {data.hourlyLoad.map((h) => (
                <span key={h.hour} style={{ flex: 1, textAlign: 'center', fontSize: 8.5, color: 'var(--fg-3)', fontFamily: 'var(--ff-mono)' }}>{h.hour % 3 === 0 ? String(h.hour).padStart(2, '0') : ''}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
