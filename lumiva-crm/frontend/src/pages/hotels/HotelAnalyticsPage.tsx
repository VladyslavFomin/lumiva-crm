import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { HotelsSubnav } from './HotelsSubnav';
import { Ic, HTL_ICON } from './HotelIcons';
import {
  fetchHotels,
  fetchRoomTypes,
  fetchHotelAnalyticsSummary,
  fetchLifecycleReport,
  type HotelLifecycleBucket,
  type HotelLifecycleReport,
  fetchHotelAnalyticsArrivals,
  updatePacingTargets,
  fetchDemoReservationsCount,
  generateDemoReservations,
  clearDemoReservations,
  HOTEL_PARTNER_TYPES,
  type Hotel,
  type HotelRoomType,
  type HotelAnalyticsSummary,
  type ArrivalDayRow,
  type PacingBucket,
} from '../../api/hotels';
import { CountrySelect, CountryTag } from './CountrySelect';
import { CountryTable } from './partners/CountryTable';
import { money } from './partners/partnerUtils';
import { DateRangePicker, toIsoDate, type DateRangePreset } from '../../components/ui/DateRangePicker';
import './hotels-design.css';

const startOfYear = (y: number) => new Date(y, 0, 1);
const periodPresets = (t: (k: string) => string): DateRangePreset[] => {
  const now = new Date();
  const y = now.getFullYear();
  const d = (n: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);
  return [
    { id: 'last30', label: t('crm.hotels.analytics.periods.last30'), range: { from: d(-30), to: now } },
    { id: 'next90', label: t('crm.hotels.analytics.periods.next90'), range: { from: now, to: d(90) } },
    { id: 'season', label: t('crm.hotels.analytics.periods.season'), range: { from: new Date(y, 3, 1), to: new Date(y, 9, 31) } },
    { id: 'year', label: t('crm.hotels.analytics.periods.year'), range: { from: startOfYear(y), to: new Date(y, 11, 31) } },
    { id: 'lastYear', label: t('crm.hotels.analytics.periods.lastYear'), range: { from: startOfYear(y - 1), to: new Date(y - 1, 11, 31) } },
  ];
};

const cx = (...a: Array<string | false | undefined>) => a.filter(Boolean).join(' ');

function fmtMoney(v: number, currency: string) {
  const sign = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency + ' ';
  return `${sign}${Math.round(v / 1000)}k`;
}

const PacingLineChart: React.FC<{ buckets: PacingBucket[] }> = ({ buckets }) => {
  const { t } = useTranslation();
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
          {b.daysBeforeArrival > 0 ? t('crm.hotels.analytics.pacing.daysBeforeArrival', { count: b.daysBeforeArrival }) : t('crm.hotels.analytics.pacing.arrival')}
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
  const { t } = useTranslation();
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
          <tr>
            <th>{t('crm.hotels.analytics.sellTable.colDays')}</th>
            <th>{t('crm.hotels.analytics.sellTable.colTarget')}</th>
            <th>{t('crm.hotels.analytics.sellTable.colActual')}</th>
            <th>{t('crm.hotels.analytics.sellTable.colGap')}</th>
            <th>{t('crm.hotels.analytics.sellTable.colNeeded')}</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => {
            const r = risk(b.actualPct, b.targetPct);
            const needClass = r === 'bad' ? 'high' : r === 'warn' ? 'mid' : 'low';
            return (
              <tr key={b.daysBeforeArrival}>
                <td>{b.daysBeforeArrival > 0 ? t('crm.hotels.analytics.sellTable.daysValue', { count: b.daysBeforeArrival }) : t('crm.hotels.analytics.sellTable.zeroDays')}</td>
                <td
                  className={editable ? 'target-cell' : undefined}
                  onClick={() => editable && setEditing(b.daysBeforeArrival)}
                  title={editable ? t('crm.hotels.analytics.sellTable.editTargetTitle') : undefined}
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
                <td><span className={cx('ha-risk-pill', r)}>{b.gapPct > 0 ? `−${b.gapPct}%` : t('crm.hotels.analytics.sellTable.onTrack')}</span></td>
                <td className={cx('need', needClass)}>{b.roomsNeededPerDay != null ? t('crm.hotels.analytics.sellTable.roomsPerDay', { count: b.roomsNeededPerDay }) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const ArrivalHeatmap: React.FC<{ rows: ArrivalDayRow[] }> = ({ rows }) => {
  const { t, i18n } = useTranslation();
  const dow = t('crm.hotels.calendarCommon.dow', { returnObjects: true }) as string[];
  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  if (!rows.length) return <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5 }}>{t('crm.hotels.analytics.heatmap.empty')}</div>;
  const firstDow = (new Date(rows[0].date).getDay() + 6) % 7; // Mon=0
  const cells = [...Array(firstDow).fill(null), ...rows];
  const bg: Record<string, string> = { ok: '#eaf6ec', warn: '#fdf3d7', bad: '#fdecea' };
  const dot: Record<string, string> = { ok: '#1f8a5e', warn: '#a06b1a', bad: '#c0392b' };
  return (
    <>
      <div className="heat-grid">
        {dow.map((d) => <div key={d} className="heat-dow">{d}</div>)}
        {cells.map((c, i) => c ? (
          <div key={i} className="heat-cell" style={{ background: bg[c.riskLevel] }} title={t('crm.hotels.analytics.heatmap.cellTitle', { date: new Date(c.date).toLocaleDateString(dateLocale), pct: c.occupancyPct })}>
            <span className="risk-dot" style={{ background: dot[c.riskLevel] }} />
            <div className="d">{new Date(c.date).getDate()}</div>
            <div className="p">{c.occupancyPct}%</div>
          </div>
        ) : <div key={i} className="heat-cell empty" />)}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        <span className="heat-legend"><i style={{ background: '#eaf6ec' }} />{t('crm.hotels.analytics.heatmap.legendGood')}</span>
        <span className="heat-legend"><i style={{ background: '#fdf3d7' }} />{t('crm.hotels.analytics.heatmap.legendWarn')}</span>
        <span className="heat-legend"><i style={{ background: '#fdecea' }} />{t('crm.hotels.analytics.heatmap.legendBad')}</span>
      </div>
    </>
  );
};

export const HotelAnalyticsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const presets = useMemo(() => periodPresets(t), [t]);
  const [period, setPeriod] = useState<{ from: Date; to: Date; presetId: string | null }>(() => ({ ...(presets.find((p) => p.id === 'season')!.range as { from: Date; to: Date }), presetId: 'season' }));
  const [guestCountry, setGuestCountry] = useState<string | null>(null);
  const [saleCountry, setSaleCountry] = useState<string | null>(null);
  const [partnerCountry, setPartnerCountry] = useState<string | null>(null);
  const [partnerType, setPartnerType] = useState('');
  const [countryTab, setCountryTab] = useState<'guest' | 'sale' | 'partner'>('guest');
  const [demoCount, setDemoCount] = useState(0);
  const [demoBusy, setDemoBusy] = useState(false);
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
      .catch((e) => showAlert(e.message || t('crm.hotels.analytics.error'), { variant: 'error' }));
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
    dateFrom: toIsoDate(period.from),
    dateTo: toIsoDate(period.to),
    guestCountry: guestCountry || undefined,
    saleCountry: saleCountry || undefined,
    partnerCountry: partnerCountry || undefined,
    partnerType: partnerType || undefined,
  }), [selectedHotelIds, hotels.length, roomTypeId, period, guestCountry, saleCountry, partnerCountry, partnerType]);

  const reload = () => {
    if (!hotels.length) return;
    Promise.all([fetchHotelAnalyticsSummary(filters), fetchHotelAnalyticsArrivals(filters)])
      .then(([s, a]) => { setSummary(s); setArrivals(a); })
      .catch((e) => showAlert(e.message || t('crm.hotels.analytics.summaryError'), { variant: 'error' }));
    fetchDemoReservationsCount().then((x) => setDemoCount(x.count)).catch(() => undefined);
  };
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotels.length, filters]);

  const genDemo = async () => {
    setDemoBusy(true);
    try {
      const r = await generateDemoReservations({ hotelIds: selectedHotelIds, count: 150 });
      showAlert(t('crm.hotels.demo.created', { n: r.created }), { variant: 'success' });
      reload();
    } catch (e) {
      showAlert((e as Error).message, { variant: 'error' });
    } finally {
      setDemoBusy(false);
    }
  };
  const clearDemo = async () => {
    if (!window.confirm(t('crm.hotels.demo.clearConfirm', { n: demoCount }))) return;
    setDemoBusy(true);
    try {
      const r = await clearDemoReservations();
      showAlert(t('crm.hotels.demo.deleted', { n: r.deleted }), { variant: 'success' });
      reload();
    } catch (e) {
      showAlert((e as Error).message, { variant: 'error' });
    } finally {
      setDemoBusy(false);
    }
  };

  const toggleHotel = (id: string) => {
    setSelectedHotelIds((prev) => (prev.includes(id) ? (prev.length > 1 ? prev.filter((x) => x !== id) : prev) : [...prev, id]));
  };
  const toggleAll = () => setSelectedHotelIds(selectedHotelIds.length === hotels.length ? [hotels[0]?.id].filter(Boolean) as string[] : hotels.map((h) => h.id));

  const editTarget = (daysBeforeArrival: number, value: string) => {
    const pct = Number(value);
    if (!Number.isFinite(pct) || selectedHotelIds.length !== 1) return;
    updatePacingTargets(selectedHotelIds[0], [{ daysBeforeArrival, targetPct: pct }])
      .then(() => fetchHotelAnalyticsSummary(filters).then(setSummary))
      .catch((e) => showAlert(e.message || t('crm.hotels.analytics.saveTargetError'), { variant: 'error' }));
  };

  const currency = summary?.kpis.currency || 'USD';

  return (
    <MainLayout>
      <PageHelpButton topic="hotelAnalytics" />
      <div className="px-scope">
        <HotelsSubnav active="analytics" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.hotels.analytics.kicker')}</div>
            <h1>{t('crm.hotels.analytics.title')}</h1>
            <p className="sub">
              {t('crm.hotels.analytics.subtitle')}
            </p>
          </div>
          <div className="htl-hero-r">
            <div data-tour="han-hotels" className="hotel-select-tabs">
              <div className={cx('hotel-select-tab', selectedHotelIds.length === hotels.length && 'active')} onClick={toggleAll}>{t('crm.hotels.analytics.allHotels')}</div>
              {hotels.map((h) => (
                <div key={h.id} className={cx('hotel-select-tab', selectedHotelIds.includes(h.id) && 'active')} onClick={() => toggleHotel(h.id)}>{h.name}</div>
              ))}
            </div>
            <select value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--line-2)', borderRadius: 9, fontSize: 12.5 }}>
              <option value="all">{t('crm.hotels.analytics.allRoomTypes')}</option>
              {roomTypeOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>

        <div className="htl-toolbar">
          <DateRangePicker
            value={{ from: period.from, to: period.to }}
            presetId={period.presetId}
            presets={presets}
            maxDate={null}
            onChange={(v) => v.from && v.to && setPeriod({ from: v.from, to: v.to, presetId: v.presetId })}
          />
          <span className="htl-sub">{t('crm.hotels.analytics.byArrival')}</span>
          <div style={{ width: 190 }}><CountrySelect value={guestCountry} onChange={setGuestCountry} placeholder={t('crm.hotels.analytics.f.guestCountry')} /></div>
          <div style={{ width: 190 }}><CountrySelect value={saleCountry} onChange={setSaleCountry} placeholder={t('crm.hotels.analytics.f.saleCountry')} /></div>
          <div style={{ width: 190 }}><CountrySelect value={partnerCountry} onChange={setPartnerCountry} placeholder={t('crm.hotels.analytics.f.partnerCountry')} /></div>
          <select className="htl-select" value={partnerType} onChange={(e) => setPartnerType(e.target.value)}>
            <option value="">{t('crm.hotels.analytics.f.allPartnerTypes')}</option>
            {HOTEL_PARTNER_TYPES.map((x) => <option key={x} value={x}>{t(`crm.hotels.partners.types.${x}`)}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {demoCount > 0 && <button className="btn btn-sm" disabled={demoBusy} onClick={clearDemo}>{t('crm.hotels.demo.clear', { n: demoCount })}</button>}
            <button className="btn btn-sm" disabled={demoBusy || !hotels.length} onClick={genDemo} title={t('crm.hotels.demo.hint')}>{t('crm.hotels.demo.generate')}</button>
          </div>
        </div>

        {summary && (
          <>
            <div data-tour="han-kpis" className="ha-kpis">
              <div className="ha-kpi">
                <div className="l">{t('crm.hotels.analytics.kpis.occupancyNow')}</div>
                <div className="v">{summary.kpis.occupancyNowPct}<small>%</small></div>
              </div>
              <div className="ha-kpi">
                <div className="l">{t('crm.hotels.analytics.kpis.roomsAvailable')}</div>
                <div className="v">{summary.kpis.roomsAvailable}<small>{t('crm.hotels.analytics.kpis.roomsAvailableOf', { total: summary.kpis.roomsTotal })}</small></div>
              </div>
              <div className="ha-kpi">
                <div className="l">{t('crm.hotels.analytics.kpis.revenueSold')}</div>
                <div className="v">{fmtMoney(summary.kpis.revenueSold, currency)}</div>
              </div>
              <div className="ha-kpi">
                <div className="l">{t('crm.hotels.analytics.kpis.roomsNeeded')}</div>
                <div className="v">{summary.kpis.roomsNeededPerDay}<small>{t('crm.hotels.analytics.kpis.roomsNeededUnit')}</small></div>
                <div className="d down">{t('crm.hotels.analytics.kpis.roomsNeededHint')}</div>
              </div>
            </div>

            <div className="htl-kpis" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginTop: 0 }}>
              <div className="htl-kpi"><div className="l">{t('crm.hotels.analytics.sales.bookings')}</div><div className="v">{summary.totals.bookings}</div><div className="d">{t('crm.hotels.analytics.sales.cancelled', { n: summary.totals.cancelled })}</div></div>
              <div className="htl-kpi"><div className="l">{t('crm.hotels.analytics.sales.roomNights')}</div><div className="v">{summary.totals.roomNights.toLocaleString(lang)}</div></div>
              <div className="htl-kpi"><div className="l">{t('crm.hotels.analytics.sales.gross')}</div><div className="v">{money(summary.totals.gross, currency, lang)}</div></div>
              <div className="htl-kpi"><div className="l">{t('crm.hotels.analytics.sales.commission')}</div><div className="v">{money(summary.totals.commission, currency, lang)}</div><div className="d">{summary.totals.gross ? `${Math.round((summary.totals.commission / summary.totals.gross) * 1000) / 10}%` : ''}</div></div>
              <div className="htl-kpi"><div className="l">{t('crm.hotels.analytics.sales.net')}</div><div className="v">{money(summary.totals.net, currency, lang)}</div></div>
            </div>

            <div className="ha-section">
              <div className="ha-section-head">
                <div>
                  <h3><Ic d={HTL_ICON.chart} size={15} />{t('crm.hotels.analytics.countries.title')}</h3>
                  <div className="sub">{t('crm.hotels.analytics.countries.subtitle')}</div>
                </div>
                <div className="htl-seg">
                  {(['guest', 'sale', 'partner'] as const).map((k) => (
                    <button key={k} type="button" className={countryTab === k ? 'on' : ''} onClick={() => setCountryTab(k)}>{t(`crm.hotels.analytics.countries.${k}`)}</button>
                  ))}
                </div>
              </div>
              <CountryTable
                rows={summary.countries[countryTab]}
                currency={currency}
                onPick={(code) => (countryTab === 'guest' ? setGuestCountry : countryTab === 'sale' ? setSaleCountry : setPartnerCountry)(code)}
              />
            </div>

            <div data-tour="han-pacing" className="ha-section">
              <div className="ha-section-head">
                <div>
                  <h3><Ic d={HTL_ICON.calendar} size={15} />{t('crm.hotels.analytics.pacing.title')}</h3>
                  <div className="sub">{t('crm.hotels.analytics.pacing.subtitle')}</div>
                </div>
              </div>
              <div className="pace-chart-wrap">
                <PacingLineChart buckets={summary.pacing.buckets} />
                <div className="pace-legend">
                  <span><i style={{ background: '#222' }} />{t('crm.hotels.analytics.pacing.legendActual')}</span>
                  <span><i style={{ background: '#b5b5b5', borderTop: '2px dashed #b5b5b5', height: 0 }} />{t('crm.hotels.analytics.pacing.legendTarget')}</span>
                </div>
              </div>
            </div>

            <div data-tour="han-sell" className="ha-section">
              <div className="ha-section-head">
                <div>
                  <h3><Ic d={HTL_ICON.check} size={15} />{t('crm.hotels.analytics.sellTable.title')}</h3>
                  <div className="sub">
                    {t('crm.hotels.analytics.sellTable.subtitle')}{selectedHotelIds.length === 1 && t('crm.hotels.analytics.sellTable.editHint')}
                  </div>
                </div>
              </div>
              <PacingTable buckets={summary.pacing.buckets} editable={selectedHotelIds.length === 1} onEditTarget={editTarget} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
              <div data-tour="han-heatmap" className="ha-section" style={{ marginBottom: 0 }}>
                <div className="ha-section-head">
                  <div>
                    <h3><Ic d={HTL_ICON.calendar} size={15} />{t('crm.hotels.analytics.heatmap.title')}</h3>
                    <div className="sub">{t('crm.hotels.analytics.heatmap.subtitle')}</div>
                  </div>
                </div>
                <ArrivalHeatmap rows={arrivals} />
              </div>
              <div data-tour="han-funnel" className="ha-section" style={{ marginBottom: 0 }}>
                <div className="ha-section-head">
                  <div>
                    <h3><Ic d={HTL_ICON.chart} size={15} />{t('crm.hotels.analytics.funnel.title')}</h3>
                    <div className="sub">{t('crm.hotels.analytics.funnel.subtitle')}</div>
                  </div>
                </div>
                {[
                  { label: t('crm.hotels.analytics.funnel.plan'), val: summary.funnel.planRevenue, max: Math.max(1, summary.funnel.planRevenue, summary.funnel.maxPossibleRevenue), color: '#d9d9d9' },
                  { label: t('crm.hotels.analytics.funnel.actual'), val: summary.funnel.actualRevenue, max: Math.max(1, summary.funnel.planRevenue, summary.funnel.maxPossibleRevenue), color: '#222' },
                  { label: t('crm.hotels.analytics.funnel.pending'), val: summary.funnel.pendingRevenue, max: Math.max(1, summary.funnel.planRevenue, summary.funnel.maxPossibleRevenue), color: '#a06b1a' },
                  { label: t('crm.hotels.analytics.funnel.remaining'), val: summary.funnel.remainingRevenue, max: Math.max(1, summary.funnel.planRevenue, summary.funnel.maxPossibleRevenue), color: '#c0c8d6' },
                ].map((r) => (
                  <div key={r.label} className="rev-bar-row">
                    <span style={{ color: 'var(--fg-3)' }}>{r.label}</span>
                    <span className="rev-bar-track"><span className="rev-bar-fill" style={{ width: `${Math.min(100, (r.val / r.max) * 100)}%`, background: r.color }} /></span>
                    <span className="rev-bar-val">{fmtMoney(r.val, currency)}</span>
                  </div>
                ))}
                <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg-muted)', borderRadius: 10, fontSize: 11.5, color: 'var(--fg-3)', lineHeight: 1.5 }}>
                  {t('crm.hotels.analytics.funnel.maxHint', { max: fmtMoney(summary.funnel.maxPossibleRevenue, currency) })}
                </div>
              </div>
            </div>

            <div className="ha-section">
              <div className="ha-section-head">
                <div>
                  <h3><Ic d={HTL_ICON.calendar} size={15} />{t('crm.hotels.analytics.roomTypesTable.title')}</h3>
                  <div className="sub">{t('crm.hotels.analytics.roomTypesTable.subtitle')}</div>
                </div>
              </div>
              <div className="pace-table-wrap">
                <table className="pace-table">
                  <thead>
                    <tr>
                      <th>{t('crm.hotels.analytics.roomTypesTable.colType')}</th>
                      <th>{t('crm.hotels.analytics.roomTypesTable.colTotal')}</th>
                      <th>{t('crm.hotels.analytics.roomTypesTable.colSold')}</th>
                      <th>{t('crm.hotels.analytics.roomTypesTable.colOccupancy')}</th>
                      <th>{t('crm.hotels.analytics.roomTypesTable.colAdr')}</th>
                      <th>{t('crm.hotels.analytics.roomTypesTable.colAvgGuests')}</th>
                      <th>{t('crm.hotels.analytics.roomTypesTable.colRevenue')}</th>
                    </tr>
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
                      <tr><td colSpan={7} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>{t('crm.hotels.analytics.roomTypesTable.empty')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="ha-section" style={{ marginBottom: 0 }}>
                <div className="ha-section-head">
                  <div>
                    <h3><Ic d={HTL_ICON.chart} size={15} />{t('crm.hotels.analytics.markets.title')}</h3>
                    <div className="sub">{t('crm.hotels.analytics.markets.subtitle')}</div>
                  </div>
                </div>
                {summary.markets.map((m) => {
                  const max = Math.max(1, ...summary.markets.map((x) => x.revenueActual));
                  return (
                    <div key={m.market} className="rev-bar-row" style={{ gridTemplateColumns: '160px 1fr 150px' }}>
                      <span style={{ color: 'var(--fg-2)' }}>{m.market}</span>
                      <span className="rev-bar-track"><span className="rev-bar-fill" style={{ width: `${(m.revenueActual / max) * 100}%`, background: '#222' }} /></span>
                      <span className="rev-bar-val">{fmtMoney(m.revenueActual, currency)} <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>· {m.roomsSold} {t('crm.hotels.analytics.markets.roomsUnit')}</span></span>
                    </div>
                  );
                })}
                {summary.markets.length === 0 && <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5 }}>{t('crm.hotels.analytics.markets.empty')}</div>}
              </div>
              <div className="ha-section" style={{ marginBottom: 0 }}>
                <div className="ha-section-head">
                  <div>
                    <h3><Ic d={HTL_ICON.check} size={15} />{t('crm.hotels.analytics.guests.title')}</h3>
                    <div className="sub">{t('crm.hotels.analytics.guests.subtitle')}</div>
                  </div>
                </div>
                {summary.guests.dataAvailable ? (
                  <div>
                    <div className="htl-info-item"><div className="l">{t('crm.hotels.analytics.guests.total')}</div><div className="v">{summary.guests.adultsCount + summary.guests.childrenCount + summary.guests.infantsCount}</div></div>
                  </div>
                ) : (
                  <div style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 12.5, marginBottom: 12 }}>
                    {t('crm.hotels.analytics.guests.noData')}
                  </div>
                )}
                <div className="htl-info-item"><div className="l">{t('crm.hotels.analytics.guests.avgPerBooking')}</div><div className="v">{summary.guests.avgGuestsPerBooking}</div></div>
              </div>
            </div>

            <div className="ha-section">
              <div className="ha-section-head">
                <div>
                  <h3><Ic d={HTL_ICON.check} size={15} />{t('crm.hotels.analytics.agencies.title')}</h3>
                  <div className="sub">{t('crm.hotels.analytics.agencies.subtitle')}</div>
                </div>
              </div>
              <div className="pace-table-wrap">
                <table className="pace-table">
                  <thead>
                    <tr>
                      <th>{t('crm.hotels.analytics.agencies.colAgency')}</th>
                      <th>{t('crm.hotels.analytics.agencies.colType')}</th>
                      <th>{t('crm.hotels.analytics.agencies.colCountry')}</th>
                      <th>{t('crm.hotels.analytics.agencies.colBookings')}</th>
                      <th>{t('crm.hotels.analytics.agencies.colRoomNights')}</th>
                      <th>{t('crm.hotels.analytics.agencies.colRevenue')}</th>
                      <th>{t('crm.hotels.analytics.agencies.colCommission')}</th>
                      <th>{t('crm.hotels.analytics.agencies.colNet')}</th>
                      <th>{t('crm.hotels.analytics.agencies.colAdr')}</th>
                      <th>{t('crm.hotels.analytics.agencies.colCancel')}</th>
                      <th>{t('crm.hotels.analytics.agencies.colShare')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.agencies.map((a) => (
                      <tr key={a.agencyId || 'direct'}>
                        <td>{a.agencyId ? <a href={`/hotels/partners/${a.agencyId}`} style={{ color: 'var(--ink)' }}>{a.name}</a> : a.name}</td>
                        <td style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>{a.type ? t(`crm.hotels.partners.types.${a.type}`) : '—'}</td>
                        <td style={{ fontSize: 12 }}><CountryTag code={a.country} /></td>
                        <td>{a.bookingsCount}</td>
                        <td>{a.roomNights}</td>
                        <td className="need low">{money(a.revenue, currency, lang)}</td>
                        <td>{a.commission ? money(a.commission, currency, lang) : '—'}</td>
                        <td>{money(a.net, currency, lang)}</td>
                        <td>{money(a.adr, currency, lang)}</td>
                        <td>{a.cancelPct ? `${a.cancelPct}%` : '—'}</td>
                        <td><span className="ha-risk-pill ok">{a.sharePct}%</span></td>
                      </tr>
                    ))}
                    {summary.agencies.length === 0 && (
                      <tr><td colSpan={11} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>{t('crm.hotels.analytics.agencies.empty')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <LifecycleSection hotelIds={filters.hotelIds} dateFrom={filters.dateFrom} dateTo={filters.dateTo} lang={lang} />
          </>
        )}
      </div>
    </MainLayout>
  );
};

/** Бесплатные проживания (PMS-126), отмены по причинам и no-show со штрафами за период заезда */
const LifecycleSection: React.FC<{ hotelIds?: string; dateFrom?: string; dateTo?: string; lang: string }> = ({ hotelIds, dateFrom, dateTo, lang }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.lifecycle.report.${key}`, o);
  const [data, setData] = useState<HotelLifecycleReport | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setData(null);
    setFailed(false);
    fetchLifecycleReport({ hotelIds, dateFrom, dateTo }).then(setData).catch(() => setFailed(true));
  }, [hotelIds, dateFrom, dateTo]);
  const amount = (m: Record<string, number>) => {
    const parts = Object.entries(m).filter(([, v]) => v);
    return parts.length ? parts.map(([c, v]) => money(v, c, lang)).join(' · ') : '—';
  };
  const bucketRows = (list: HotelLifecycleBucket[], label: (r: string) => string) => list.map((b) => (
    <tr key={b.reason}><td>{label(b.reason)}</td><td>{b.count}</td><td>{b.nights}</td><td>{amount(b.amount)}</td></tr>
  ));
  return (
    <div className="ha-section">
      <div className="ha-section-head">
        <div>
          <h3><Ic d={HTL_ICON.ban} size={15} />{k('title')}</h3>
          <div className="sub">{k('subtitle')}</div>
        </div>
      </div>
      {failed ? <div className="htl-hint">{k('error')}</div> : !data ? <div className="htl-hint">{t('crm.hotels.common.loading')}</div> : (
        <div className="htl-life-report">
          <div className="pace-table-wrap">
            <table className="pace-table">
              <thead><tr><th>{k('compTitle')}</th><th>{k('colCount')}</th><th>{k('colNights')}</th><th>{k('colValue')}</th></tr></thead>
              <tbody>
                {bucketRows(data.complimentary.byReason, (r) => t(`crm.hotels.lifecycle.compReasons.${r}`, { defaultValue: r }))}
                {!data.complimentary.byReason.length && <tr><td colSpan={4} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>{k('compEmpty')}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="pace-table-wrap">
            <table className="pace-table">
              <thead><tr><th>{k('cancelTitle')}</th><th>{k('colCount')}</th><th>{k('colNights')}</th><th>{k('colFees')}</th></tr></thead>
              <tbody>
                {bucketRows(data.cancellations, (r) => t(`crm.hotels.lifecycle.cancelReasons.${r}`, { defaultValue: r }))}
                {data.noShow.count > 0 && bucketRows([data.noShow], () => k('noShowRow'))}
                {!data.cancellations.length && !data.noShow.count && <tr><td colSpan={4} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>{k('cancelEmpty')}</td></tr>}
              </tbody>
            </table>
          </div>
          {data.complimentary.rows.length > 0 && (
            <div className="pace-table-wrap" style={{ gridColumn: '1 / -1' }}>
              <table className="pace-table">
                <thead><tr><th>{k('colGuest')}</th><th>{k('colDates')}</th><th>{k('colReason')}</th><th>{k('colNote')}</th><th>{k('colValue')}</th></tr></thead>
                <tbody>
                  {data.complimentary.rows.map((r) => (
                    <tr key={r.id}>
                      <td><a href={`/hotels/reservations?reservation=${r.id}`} style={{ color: 'var(--ink)' }}>{r.guestName}</a></td>
                      <td>{r.checkIn} – {r.checkOut} · {r.nights}</td>
                      <td>{r.reason ? t(`crm.hotels.lifecycle.compReasons.${r.reason}`) : '—'}</td>
                      <td style={{ color: 'var(--fg-2)' }}>{r.note || '—'}</td>
                      <td>{money(r.value, r.currency, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
