import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { HotelsSubnav } from './HotelsSubnav';
import { Ic, HTL_ICON } from './HotelIcons';
import {
  fetchHotels,
  fetchRoomTypes,
  fetchHotelAnalyticsSummary,
  fetchHotelAnalyticsArrivals,
  updatePacingTargets,
  type Hotel,
  type HotelRoomType,
  type HotelAnalyticsSummary,
  type ArrivalDayRow,
  type PacingBucket,
} from '../../api/hotels';
import './hotels-design.css';

const cx = (...a: Array<string | false | undefined>) => a.filter(Boolean).join(' ');

function fmtMoney(v: number, currency: string) {
  const sign = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency + ' ';
  return `${sign}${Math.round(v / 1000)}k`;
}

const PacingLineChart: React.FC<{ buckets: PacingBucket[] }> = ({ buckets }) => {
  const width = 640;
  const height = 200;
  if (!buckets.length) return null;
  const points = buckets.map((b, i) => ({
    x: (i / (buckets.length - 1)) * width,
    yTarget: height - (b.targetPct / 100) * height,
    yActual: height - (b.actualPct / 100) * height,
  }));
  const pathFor = (key: 'yTarget' | 'yActual') =>
    points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p[key].toFixed(1)).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height + 30}`} style={{ width: '100%', height: 'auto' }}>
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={0} x2={width} y1={height - (g / 100) * height} y2={height - (g / 100) * height} stroke="#f0f0f0" strokeWidth="1" />
          <text x={0} y={height - (g / 100) * height - 4} fontSize="9" fill="#b5b5b5">{g}%</text>
        </g>
      ))}
      <path d={pathFor('yTarget')} fill="none" stroke="#b5b5b5" strokeWidth="2" strokeDasharray="5 4" />
      <path d={pathFor('yActual')} fill="none" stroke="#222" strokeWidth="2.5" />
      {points.map((p, i) => <circle key={i} cx={p.x} cy={p.yActual} r="3.5" fill="#222" />)}
      {buckets.map((b, i) => (
        <text key={i} x={points[i].x} y={height + 18} fontSize="10" fill="#888" textAnchor={i === 0 ? 'start' : i === buckets.length - 1 ? 'end' : 'middle'}>
          {b.daysBeforeArrival > 0 ? `${b.daysBeforeArrival} дн.` : 'заезд'}
        </text>
      ))}
    </svg>
  );
};

const PacingTable: React.FC<{
  buckets: PacingBucket[];
  editable: boolean;
  onEditTarget: (daysBeforeArrival: number, value: string) => void;
}> = ({ buckets, editable, onEditTarget }) => {
  const [editing, setEditing] = useState<number | null>(null);
  const risk = (actual: number, target: number) => {
    const gap = target - actual;
    if (gap >= 15) return 'bad';
    if (gap >= 6) return 'warn';
    return 'ok';
  };
  return (
    <div className="pace-table-wrap">
      <table className="pace-table">
        <thead>
          <tr><th>До заезда</th><th>Цель, %</th><th>Факт, %</th><th>Отставание</th><th>Нужно продавать / день</th></tr>
        </thead>
        <tbody>
          {buckets.map((b) => {
            const r = risk(b.actualPct, b.targetPct);
            const needClass = r === 'bad' ? 'high' : r === 'warn' ? 'mid' : 'low';
            return (
              <tr key={b.daysBeforeArrival}>
                <td>{b.daysBeforeArrival > 0 ? `${b.daysBeforeArrival} дней` : '0 дней'}</td>
                <td
                  className={editable ? 'target-cell' : undefined}
                  onClick={() => editable && setEditing(b.daysBeforeArrival)}
                  title={editable ? 'Изменить целевой %' : undefined}
                >
                  {editing === b.daysBeforeArrival ? (
                    <input
                      autoFocus
                      defaultValue={b.targetPct}
                      onBlur={(e) => { onEditTarget(b.daysBeforeArrival, e.target.value); setEditing(null); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setEditing(null);
                      }}
                    />
                  ) : `${b.targetPct}%`}
                </td>
                <td>{b.actualPct}%</td>
                <td><span className={cx('ha-risk-pill', r)}>{b.gapPct > 0 ? `−${b.gapPct}%` : 'в норме'}</span></td>
                <td className={cx('need', needClass)}>{b.roomsNeededPerDay != null ? `${b.roomsNeededPerDay} ном./день` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const ArrivalHeatmap: React.FC<{ rows: ArrivalDayRow[] }> = ({ rows }) => {
  if (!rows.length) return <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5 }}>Нет данных за период</div>;
  const firstDow = (new Date(rows[0].date).getDay() + 6) % 7; // Mon=0
  const cells = [...Array(firstDow).fill(null), ...rows];
  const bg: Record<string, string> = { ok: '#eaf6ec', warn: '#fdf3d7', bad: '#fdecea' };
  const dot: Record<string, string> = { ok: '#1f8a5e', warn: '#a06b1a', bad: '#c0392b' };
  return (
    <>
      <div className="heat-grid">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => <div key={d} className="heat-dow">{d}</div>)}
        {cells.map((c, i) => c ? (
          <div key={i} className="heat-cell" style={{ background: bg[c.riskLevel] }} title={`${c.date} — загрузка ${c.occupancyPct}%`}>
            <span className="risk-dot" style={{ background: dot[c.riskLevel] }} />
            <div className="d">{new Date(c.date).getDate()}</div>
            <div className="p">{c.occupancyPct}%</div>
          </div>
        ) : <div key={i} className="heat-cell empty" />)}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        <span className="heat-legend"><i style={{ background: '#eaf6ec' }} />Хорошая загрузка (≥65%)</span>
        <span className="heat-legend"><i style={{ background: '#fdf3d7' }} />Требует внимания (45–64%)</span>
        <span className="heat-legend"><i style={{ background: '#fdecea' }} />Риск недозаезда (&lt;45%)</span>
      </div>
    </>
  );
};

export const HotelAnalyticsPage: React.FC = () => {
  const { showAlert } = useAlertModal();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [roomTypesByHotel, setRoomTypesByHotel] = useState<Record<string, HotelRoomType[]>>({});
  const [selectedHotelIds, setSelectedHotelIds] = useState<string[]>([]);
  const [roomTypeId, setRoomTypeId] = useState('all');
  const [summary, setSummary] = useState<HotelAnalyticsSummary | null>(null);
  const [arrivals, setArrivals] = useState<ArrivalDayRow[]>([]);

  useEffect(() => {
    fetchHotels()
      .then((list) => {
        setHotels(list);
        if (list.length) setSelectedHotelIds([list[0].id]);
        Promise.all(list.map((h) => fetchRoomTypes(h.id).then((rts) => [h.id, rts] as const)))
          .then((pairs) => setRoomTypesByHotel(Object.fromEntries(pairs)))
          .catch(() => {});
      })
      .catch((e) => showAlert(e.message || 'Не удалось загрузить отели', { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roomTypeOptions = useMemo(() => {
    const scope = selectedHotelIds.length ? selectedHotelIds : hotels.map((h) => h.id);
    const rows: HotelRoomType[] = [];
    for (const hid of scope) rows.push(...(roomTypesByHotel[hid] || []));
    return rows;
  }, [selectedHotelIds, hotels, roomTypesByHotel]);

  const filters = useMemo(() => ({
    hotelIds: selectedHotelIds.length === hotels.length ? undefined : selectedHotelIds.join(','),
    roomTypeId: roomTypeId === 'all' ? undefined : roomTypeId,
  }), [selectedHotelIds, hotels.length, roomTypeId]);

  useEffect(() => {
    if (!hotels.length) return;
    Promise.all([fetchHotelAnalyticsSummary(filters), fetchHotelAnalyticsArrivals(filters)])
      .then(([s, a]) => { setSummary(s); setArrivals(a); })
      .catch((e) => showAlert(e.message || 'Не удалось загрузить аналитику', { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotels.length, filters.hotelIds, filters.roomTypeId]);

  const toggleHotel = (id: string) => {
    setSelectedHotelIds((prev) => (prev.includes(id) ? (prev.length > 1 ? prev.filter((x) => x !== id) : prev) : [...prev, id]));
  };
  const toggleAll = () => setSelectedHotelIds(selectedHotelIds.length === hotels.length ? [hotels[0]?.id].filter(Boolean) as string[] : hotels.map((h) => h.id));

  const editTarget = (daysBeforeArrival: number, value: string) => {
    const pct = Number(value);
    if (!Number.isFinite(pct) || selectedHotelIds.length !== 1) return;
    updatePacingTargets(selectedHotelIds[0], [{ daysBeforeArrival, targetPct: pct }])
      .then(() => fetchHotelAnalyticsSummary(filters).then(setSummary))
      .catch((e) => showAlert(e.message || 'Не удалось сохранить цель', { variant: 'error' }));
  };

  const currency = summary?.kpis.currency || 'USD';

  return (
    <MainLayout>
      <div className="px-scope">
        <HotelsSubnav active="analytics" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />АНАЛИТИКА</div>
            <h1>Аналитика загрузки и выручки</h1>
            <p className="sub">
              Темп продаж (pacing) относительно цели, риски по датам заезда и сколько номеров нужно
              продавать в день с учётом переноса недопродаж.
            </p>
          </div>
          <div className="htl-hero-r">
            <div className="hotel-select-tabs">
              <div className={cx('hotel-select-tab', selectedHotelIds.length === hotels.length && 'active')} onClick={toggleAll}>Все отели</div>
              {hotels.map((h) => (
                <div key={h.id} className={cx('hotel-select-tab', selectedHotelIds.includes(h.id) && 'active')} onClick={() => toggleHotel(h.id)}>{h.name}</div>
              ))}
            </div>
            <select value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--line-2)', borderRadius: 9, fontSize: 12.5 }}>
              <option value="all">Все типы номеров</option>
              {roomTypeOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>

        {summary && (
          <>
            <div className="ha-kpis">
              <div className="ha-kpi">
                <div className="l">Загрузка сейчас</div>
                <div className="v">{summary.kpis.occupancyNowPct}<small>%</small></div>
              </div>
              <div className="ha-kpi">
                <div className="l">Свободно номеров</div>
                <div className="v">{summary.kpis.roomsAvailable}<small>/ {summary.kpis.roomsTotal}</small></div>
              </div>
              <div className="ha-kpi">
                <div className="l">Выручка (продано)</div>
                <div className="v">{fmtMoney(summary.kpis.revenueSold, currency)}</div>
              </div>
              <div className="ha-kpi">
                <div className="l">Нужно продавать / день</div>
                <div className="v">{summary.kpis.roomsNeededPerDay}<small>ном.</small></div>
                <div className="d down">с учётом переноса недопродаж</div>
              </div>
            </div>

            <div className="ha-section">
              <div className="ha-section-head">
                <div>
                  <h3><Ic d={HTL_ICON.calendar} size={15} />Темп продаж (Pacing) vs цель</h3>
                  <div className="sub">Сплошная линия — фактические продажи, пунктир — целевая кривая.</div>
                </div>
              </div>
              <div className="pace-chart-wrap">
                <PacingLineChart buckets={summary.pacing.buckets} />
                <div className="pace-legend">
                  <span><i style={{ background: '#222' }} />Факт</span>
                  <span><i style={{ background: '#b5b5b5', borderTop: '2px dashed #b5b5b5', height: 0 }} />Цель</span>
                </div>
              </div>
            </div>

            <div className="ha-section">
              <div className="ha-section-head">
                <div>
                  <h3><Ic d={HTL_ICON.check} size={15} />Сколько продавать по срокам до заезда</h3>
                  <div className="sub">
                    Если план не выполнен на каком-то этапе — недостающие номера прибавляются к следующим
                    дням.{selectedHotelIds.length === 1 && ' Кликните по целевому % чтобы изменить.'}
                  </div>
                </div>
              </div>
              <PacingTable buckets={summary.pacing.buckets} editable={selectedHotelIds.length === 1} onEditTarget={editTarget} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
              <div className="ha-section" style={{ marginBottom: 0 }}>
                <div className="ha-section-head">
                  <div>
                    <h3><Ic d={HTL_ICON.calendar} size={15} />Загрузка по датам заезда</h3>
                    <div className="sub">Даты с низкой загрузкой требуют промо-тарифов или доп. каналов продаж.</div>
                  </div>
                </div>
                <ArrivalHeatmap rows={arrivals} />
              </div>
              <div className="ha-section" style={{ marginBottom: 0 }}>
                <div className="ha-section-head">
                  <div>
                    <h3><Ic d={HTL_ICON.chart} size={15} />Выручка сезона</h3>
                    <div className="sub">План / факт / в брони / остаток</div>
                  </div>
                </div>
                {[
                  { label: 'План на сезон', val: summary.funnel.planRevenue, max: Math.max(1, summary.funnel.planRevenue, summary.funnel.maxPossibleRevenue), color: '#d9d9d9' },
                  { label: 'Факт (продано)', val: summary.funnel.actualRevenue, max: Math.max(1, summary.funnel.planRevenue, summary.funnel.maxPossibleRevenue), color: '#222' },
                  { label: 'В брони (не оплачено)', val: summary.funnel.pendingRevenue, max: Math.max(1, summary.funnel.planRevenue, summary.funnel.maxPossibleRevenue), color: '#a06b1a' },
                  { label: 'Осталось продать', val: summary.funnel.remainingRevenue, max: Math.max(1, summary.funnel.planRevenue, summary.funnel.maxPossibleRevenue), color: '#c0c8d6' },
                ].map((r) => (
                  <div key={r.label} className="rev-bar-row">
                    <span style={{ color: 'var(--fg-3)' }}>{r.label}</span>
                    <span className="rev-bar-track"><span className="rev-bar-fill" style={{ width: `${Math.min(100, (r.val / r.max) * 100)}%`, background: r.color }} /></span>
                    <span className="rev-bar-val">{fmtMoney(r.val, currency)}</span>
                  </div>
                ))}
                <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg-muted)', borderRadius: 10, fontSize: 11.5, color: 'var(--fg-3)', lineHeight: 1.5 }}>
                  Максимум сезона при 100% загрузке и текущих ценах: <b style={{ color: 'var(--ink)' }}>{fmtMoney(summary.funnel.maxPossibleRevenue, currency)}</b>.
                </div>
              </div>
            </div>

            <div className="ha-section">
              <div className="ha-section-head">
                <div>
                  <h3><Ic d={HTL_ICON.calendar} size={15} />Разбивка по типам номеров</h3>
                  <div className="sub">Загрузка, средний тариф и выручка по каждой категории номеров.</div>
                </div>
              </div>
              <div className="pace-table-wrap">
                <table className="pace-table">
                  <thead>
                    <tr><th>Тип номера</th><th>Всего</th><th>Продано</th><th>Загрузка</th><th>ADR</th><th>Ср. гостей</th><th>Выручка</th></tr>
                  </thead>
                  <tbody>
                    {summary.roomTypes.map((r) => (
                      <tr key={r.roomTypeId}>
                        <td>{r.name}</td>
                        <td>{r.qtyTotal}</td>
                        <td>{r.qtySold}</td>
                        <td><span className={cx('ha-risk-pill', r.occupancyPct >= 80 ? 'ok' : r.occupancyPct >= 60 ? 'warn' : 'bad')}>{r.occupancyPct}%</span></td>
                        <td>{fmtMoney(r.adr, currency)}</td>
                        <td>{r.avgGuestsPerBooking}</td>
                        <td className="need low">{fmtMoney(r.revenue, currency)}</td>
                      </tr>
                    ))}
                    {summary.roomTypes.length === 0 && (
                      <tr><td colSpan={7} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>Нет данных за период</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="ha-section" style={{ marginBottom: 0 }}>
                <div className="ha-section-head">
                  <div>
                    <h3><Ic d={HTL_ICON.chart} size={15} />Выручка по рынкам продаж</h3>
                    <div className="sub">Факт по каждому рынку за период.</div>
                  </div>
                </div>
                {summary.markets.map((m) => {
                  const max = Math.max(1, ...summary.markets.map((x) => x.revenueActual));
                  return (
                    <div key={m.market} className="rev-bar-row" style={{ gridTemplateColumns: '160px 1fr 150px' }}>
                      <span style={{ color: 'var(--fg-2)' }}>{m.market}</span>
                      <span className="rev-bar-track"><span className="rev-bar-fill" style={{ width: `${(m.revenueActual / max) * 100}%`, background: '#222' }} /></span>
                      <span className="rev-bar-val">{fmtMoney(m.revenueActual, currency)} <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>· {m.roomsSold} ном.</span></span>
                    </div>
                  );
                })}
                {summary.markets.length === 0 && <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5 }}>Нет данных за период</div>}
              </div>
              <div className="ha-section" style={{ marginBottom: 0 }}>
                <div className="ha-section-head">
                  <div>
                    <h3><Ic d={HTL_ICON.check} size={15} />Демография гостей</h3>
                    <div className="sub">Взрослые, дети и младенцы по бронированиям.</div>
                  </div>
                </div>
                {summary.guests.dataAvailable ? (
                  <div>
                    <div className="htl-info-item"><div className="l">Всего гостей</div><div className="v">{summary.guests.adultsCount + summary.guests.childrenCount + summary.guests.infantsCount}</div></div>
                  </div>
                ) : (
                  <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5, marginBottom: 12 }}>
                    Данные о возрасте гостей недоступны — учитывается только общее число гостей на бронь.
                  </div>
                )}
                <div className="htl-info-item"><div className="l">Ср. гостей / бронь</div><div className="v">{summary.guests.avgGuestsPerBooking}</div></div>
              </div>
            </div>

            <div className="ha-section">
              <div className="ha-section-head">
                <div>
                  <h3><Ic d={HTL_ICON.check} size={15} />Продажи по агентствам и каналам</h3>
                  <div className="sub">Кто приносит бронирования: туроператоры, OTA и прямые продажи.</div>
                </div>
              </div>
              <div className="pace-table-wrap">
                <table className="pace-table">
                  <thead>
                    <tr><th>Агентство / канал</th><th>Броней</th><th>Выручка</th><th>Средний тариф</th><th>Доля</th></tr>
                  </thead>
                  <tbody>
                    {summary.agencies.map((a) => (
                      <tr key={a.agencyId || 'direct'}>
                        <td>{a.name}</td>
                        <td>{a.bookingsCount}</td>
                        <td className="need low">{fmtMoney(a.revenue, currency)}</td>
                        <td>{fmtMoney(a.avgRate, currency)}</td>
                        <td><span className="ha-risk-pill ok">{a.sharePct}%</span></td>
                      </tr>
                    ))}
                    {summary.agencies.length === 0 && (
                      <tr><td colSpan={5} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>Нет данных за период</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
};
