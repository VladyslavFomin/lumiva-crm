import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
import { hotelErrorText } from '../ReservationLifecycle';
import { addDaysIso, money, todayIso } from '../partners/partnerUtils';
import {
  downloadAuthed,
  fetchForecast,
  fetchHotels,
  fetchPerformance,
  fetchPickup,
  fetchRoomTypes,
  type Hotel,
  type HotelForecastReport,
  type HotelPerformanceReport,
  type HotelPickupReport,
  type HotelRoomType,
} from '../../../api/hotels';
import '../hotels-design.css';
import { DateInput } from '../../../components/ui/DateInput';

type Tab = 'performance' | 'forecast' | 'pickup';
const TABS: Tab[] = ['performance', 'forecast', 'pickup'];

const useRk = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('tr') ? 'tr' : i18n.language?.startsWith('en') ? 'en' : 'ru';
  const loc = lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-US' : 'ru-RU';
  return { t, lang, loc, k: (key: string, o?: Record<string, unknown>) => t(`crm.hotels.reports.${key}`, o) };
};

const periodLabel = (p: string, loc: string) =>
  p.length === 7
    ? new Date(`${p}-01T00:00:00`).toLocaleDateString(loc, { month: 'short', year: 'numeric' })
    : new Date(`${p}T00:00:00`).toLocaleDateString(loc, { day: 'numeric', month: 'short' });

/** Столбцы одной серии (%), с подсказкой на каждом столбце; таблица под графиком — табличный вид тех же данных */
const BarChart: React.FC<{ rows: Array<{ period: string; value: number; hint: string }>; loc: string; label: string }> = ({ rows, loc, label }) => {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(100, ...rows.map((r) => r.value));
  const H = 160;
  const step = rows.length > 40 ? Math.ceil(rows.length / 12) : rows.length > 16 ? 2 : 1;
  return (
    <div className="rp-chart" role="img" aria-label={label}>
      <div className="rp-grid">{[100, 50, 0].map((g) => <span key={g} style={{ bottom: `${(g / max) * 100}%` }}><i>{g}%</i></span>)}</div>
      <div className="rp-bars" style={{ height: H }}>
        {rows.map((r, i) => (
          <div key={r.period} className="rp-col" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div className={`rp-bar${hover === i ? ' on' : ''}`} style={{ height: `${Math.max(1, (r.value / max) * 100)}%` }} />
            {hover === i && <div className="rp-tip"><b>{periodLabel(r.period, loc)}</b><span>{r.hint}</span></div>}
            <em>{i % step === 0 ? periodLabel(r.period, loc) : ''}</em>
          </div>
        ))}
      </div>
    </div>
  );
};

export const HotelReportsPage: React.FC = () => {
  const { k } = useRk();
  const [sp, setSp] = useSearchParams();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const tab = (TABS.includes(sp.get('tab') as Tab) ? sp.get('tab') : 'performance') as Tab;
  const hotelId = sp.get('hotelId') || hotels[0]?.id || '';
  const setParam = (patch: Record<string, string>) => setSp({ ...Object.fromEntries(sp.entries()), ...patch });
  useEffect(() => { fetchHotels().then(setHotels).catch(() => setHotels([])); }, []);
  return (
    <MainLayout>
      <PageHelpButton topic="hotelReports" />
      <div className="px-scope">
        <HotelsSubnav active="reports" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{k('kicker')}</div>
            <h1>{k('title')}</h1>
            <p className="sub">{k('subtitle')}</p>
          </div>
        </div>
        <div className="htl-toolbar">
          <select className="htl-select" value={hotelId} onChange={(e) => setParam({ hotelId: e.target.value })}>
            {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <div className="bk-savedviews" style={{ flex: 'none' }}>
            {TABS.map((x) => <div key={x} className={`bk-sv-tab${tab === x ? ' active' : ''}`} onClick={() => setParam({ tab: x })}>{k(`tabs.${x}`)}</div>)}
          </div>
        </div>
        {!hotelId ? null : tab === 'performance' ? <PerformanceTab hotelId={hotelId} /> : tab === 'forecast' ? <ForecastTab hotelId={hotelId} /> : <PickupTab hotelId={hotelId} />}
      </div>
    </MainLayout>
  );
};

const PerformanceTab: React.FC<{ hotelId: string }> = ({ hotelId }) => {
  const { k, t, lang, loc } = useRk();
  const { showAlert } = useAlertModal();
  const today = todayIso();
  const [from, setFrom] = useState(addDaysIso(today, -29));
  const [to, setTo] = useState(today);
  const [groupBy, setGroupBy] = useState<'day' | 'month'>('day');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [types, setTypes] = useState<HotelRoomType[]>([]);
  const [data, setData] = useState<HotelPerformanceReport | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => { fetchRoomTypes(hotelId).then(setTypes).catch(() => setTypes([])); setRoomTypeId(''); }, [hotelId]);
  useEffect(() => {
    setData(null);
    fetchPerformance({ hotelId, from, to, groupBy, roomTypeId: roomTypeId || undefined }).then((d) => { setData(d); setFailed(null); }).catch((e) => setFailed(hotelErrorText(t, e, k('loadError'))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId, from, to, groupBy, roomTypeId]);
  const preset = (p: string) => {
    if (p === 'last30') { setFrom(addDaysIso(today, -29)); setTo(today); setGroupBy('day'); }
    if (p === 'next30') { setFrom(today); setTo(addDaysIso(today, 29)); setGroupBy('day'); }
    if (p === 'month') { setFrom(`${today.slice(0, 7)}-01`); setTo(addDaysIso(`${addDaysIso(`${today.slice(0, 7)}-28`, 4).slice(0, 7)}-01`, -1)); setGroupBy('day'); }
    if (p === 'year') { setFrom(`${today.slice(0, 4)}-01-01`); setTo(`${today.slice(0, 4)}-12-31`); setGroupBy('month'); }
  };
  const cur = data?.hotel.currency;
  const xlsx = () => downloadAuthed(`/hotels/reports/performance.xlsx?${new URLSearchParams({ hotelId, from, to, groupBy, lang, ...(roomTypeId ? { roomTypeId } : {}) })}`, `hotel-performance-${from}-${to}.xlsx`).catch(() => showAlert(k('loadError'), { variant: 'error' }));
  return (
    <>
      <div className="htl-toolbar" style={{ marginTop: 0 }}>
        <DateInput className="htl-date" value={from} onChange={(v) => v && setFrom(v)}  inline clearable={false} />
        <span className="htl-sub">—</span>
        <DateInput className="htl-date" value={to} onChange={(v) => v && setTo(v)}  inline clearable={false} />
        <div className="bk-savedviews" style={{ flex: 'none' }}>
          {['last30', 'month', 'next30', 'year'].map((p) => <div key={p} className="bk-sv-tab" onClick={() => preset(p)}>{k(`presets.${p}`)}</div>)}
        </div>
        <div className="htl-seg">
          <button type="button" className={groupBy === 'day' ? 'on' : ''} onClick={() => setGroupBy('day')}>{k('byDay')}</button>
          <button type="button" className={groupBy === 'month' ? 'on' : ''} onClick={() => setGroupBy('month')}>{k('byMonth')}</button>
        </div>
        <select className="htl-select" value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)}>
          <option value="">{k('allTypes')}</option>
          {types.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <button className="btn" style={{ marginLeft: 'auto' }} disabled={!data} onClick={() => void xlsx()}><Ic d={HTL_ICON.download} size={14} />Excel</button>
      </div>
      {failed ? <div className="htl-empty"><h4>{failed}</h4></div> : !data ? <div className="htl-rack-skel">{[0, 1, 2].map((i) => <div key={i} />)}</div> : (
        <>
          <div className="htl-rack-kpis">
            <div><span>{k('occ')}</span><b>{data.total.occupancyPct}%</b></div>
            <div><span>ADR</span><b>{money(data.total.adr, cur, loc)}</b></div>
            <div><span>RevPAR</span><b>{money(data.total.revpar, cur, loc)}</b></div>
            <div><span>{k('revenue')}</span><b>{money(data.total.revenue, cur, loc)}</b></div>
            <div><span>{k('roomNights')}</span><b>{data.total.sold}<small style={{ fontSize: 13, color: 'var(--fg-3)' }}> / {data.total.available}</small></b></div>
          </div>
          <div className="htl-panel" style={{ marginTop: 14 }}>
            <div className="htl-folio-sec" style={{ marginTop: 0 }}>{k('occChart')}</div>
            <BarChart loc={loc} label={k('occChart')} rows={data.rows.map((r) => ({ period: r.period, value: r.occupancyPct, hint: k('barHint', { occ: r.occupancyPct, sold: r.sold, available: r.available, adr: money(r.adr, cur, loc) }) }))} />
          </div>
          <div className="bk-table-wrap" style={{ marginTop: 14 }}>
            <table className="bk-table rp-table">
              <thead><tr><th>{k('period')}</th><th>{k('available')}</th><th>{k('sold')}</th><th>{k('comp')}</th><th>{k('occ')}</th><th>{k('revenue')}</th><th>ADR</th><th>RevPAR</th></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.period}><td>{periodLabel(r.period, loc)}</td><td>{r.available}</td><td>{r.sold}</td><td>{r.comp || '—'}</td><td>{r.occupancyPct}%</td><td>{money(r.revenue, cur, loc)}</td><td>{money(r.adr, cur, loc)}</td><td>{money(r.revpar, cur, loc)}</td></tr>
                ))}
                <tr className="tot"><td>{k('total')}</td><td>{data.total.available}</td><td>{data.total.sold}</td><td>{data.total.comp || '—'}</td><td>{data.total.occupancyPct}%</td><td>{money(data.total.revenue, cur, loc)}</td><td>{money(data.total.adr, cur, loc)}</td><td>{money(data.total.revpar, cur, loc)}</td></tr>
              </tbody>
            </table>
          </div>
          {!roomTypeId && data.byRoomType.length > 1 && (
            <div className="bk-table-wrap" style={{ marginTop: 14 }}>
              <table className="bk-table rp-table">
                <thead><tr><th>{k('roomType')}</th><th>{k('available')}</th><th>{k('sold')}</th><th>{k('occ')}</th><th>{k('revenue')}</th><th>ADR</th><th>RevPAR</th></tr></thead>
                <tbody>{data.byRoomType.map((r) => <tr key={r.roomTypeId}><td>{r.name}</td><td>{r.available}</td><td>{r.sold}</td><td>{r.occupancyPct}%</td><td>{money(r.revenue, cur, loc)}</td><td>{money(r.adr, cur, loc)}</td><td>{money(r.revpar, cur, loc)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <p className="htl-fd-note" style={{ marginTop: 10 }}>{k('perfHint')}</p>
        </>
      )}
    </>
  );
};

const delta = (a: number, b: number) => {
  const d = Math.round((a - b) * 100) / 100;
  return <span className={d > 0 ? 'rp-up' : d < 0 ? 'rp-down' : 'rp-flat'}>{d > 0 ? '+' : ''}{d}</span>;
};

const ForecastTab: React.FC<{ hotelId: string }> = ({ hotelId }) => {
  const { k, t, loc } = useRk();
  const [horizon, setHorizon] = useState(90);
  const [data, setData] = useState<HotelForecastReport | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => { setData(null); fetchForecast(hotelId, horizon).then((d) => { setData(d); setFailed(null); }).catch((e) => setFailed(hotelErrorText(t, e, k('loadError')))); }, [hotelId, horizon]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = data?.hotel.currency;
  return (
    <>
      <div className="htl-toolbar" style={{ marginTop: 0 }}>
        <div className="htl-seg">{[30, 90, 365].map((h) => <button key={h} type="button" className={horizon === h ? 'on' : ''} onClick={() => setHorizon(h)}>{k('days', { n: h })}</button>)}</div>
        <span className="htl-sub">{k('forecastHint')}</span>
      </div>
      {failed ? <div className="htl-empty"><h4>{failed}</h4></div> : !data ? <div className="htl-rack-skel">{[0, 1, 2].map((i) => <div key={i} />)}</div> : (
        <>
          <div className="htl-rack-kpis">
            <div><span>{k('otbRooms')}</span><b>{data.total.otbRooms}</b></div>
            <div><span>{k('stlyRooms')}</span><b>{data.total.stlyRooms}</b></div>
            <div><span>{k('otbRevenue')}</span><b>{money(data.total.otbRevenue, cur, loc)}</b></div>
            <div><span>{k('stlyRevenue')}</span><b>{money(data.total.stlyRevenue, cur, loc)}</b></div>
            <div><span>{k('otbOcc')}</span><b>{data.total.available ? Math.round((data.total.otbRooms / data.total.available) * 1000) / 10 : 0}%</b></div>
          </div>
          <div className="htl-panel" style={{ marginTop: 14 }}>
            <div className="htl-folio-sec" style={{ marginTop: 0 }}>{k('otbChart')}</div>
            <BarChart loc={loc} label={k('otbChart')} rows={data.rows.map((r) => ({ period: r.period, value: r.otbOccPct, hint: k('otbHint', { occ: r.otbOccPct, stly: r.stlyOccPct, rooms: r.otbRooms }) }))} />
          </div>
          <div className="bk-table-wrap" style={{ marginTop: 14 }}>
            <table className="bk-table rp-table">
              <thead><tr><th>{k('period')}</th><th>{k('available')}</th><th>{k('otbRooms')}</th><th>{k('otbOcc')}</th><th>{k('stlyRooms')}</th><th>Δ</th><th>{k('lyActual')}</th><th>{k('otbRevenue')}</th><th>{k('stlyRevenue')}</th></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.period}><td>{periodLabel(r.period, loc)}</td><td>{r.available}</td><td>{r.otbRooms}</td><td>{r.otbOccPct}%</td><td>{r.stlyRooms}</td><td>{delta(r.otbRooms, r.stlyRooms)}</td><td>{r.lyRooms}</td><td>{money(r.otbRevenue, cur, loc)}</td><td>{money(r.stlyRevenue, cur, loc)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
};

const PickupTab: React.FC<{ hotelId: string }> = ({ hotelId }) => {
  const { k, t, loc } = useRk();
  const [horizon, setHorizon] = useState(90);
  const [data, setData] = useState<HotelPickupReport | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => { setData(null); fetchPickup(hotelId, horizon).then((d) => { setData(d); setFailed(null); }).catch((e) => setFailed(hotelErrorText(t, e, k('loadError')))); }, [hotelId, horizon]); // eslint-disable-line react-hooks/exhaustive-deps
  const totals = useMemo(() => data?.total, [data]);
  return (
    <>
      <div className="htl-toolbar" style={{ marginTop: 0 }}>
        <div className="htl-seg">{[30, 90, 180].map((h) => <button key={h} type="button" className={horizon === h ? 'on' : ''} onClick={() => setHorizon(h)}>{k('days', { n: h })}</button>)}</div>
        <span className="htl-sub">{k('pickupHint')}</span>
      </div>
      {failed ? <div className="htl-empty"><h4>{failed}</h4></div> : !data || !totals ? <div className="htl-rack-skel">{[0, 1, 2].map((i) => <div key={i} />)}</div> : (
        <>
          <div className="htl-rack-kpis">
            <div><span>{k('otbRooms')}</span><b>{totals.otb}</b></div>
            <div><span>{k('pickup1')}</span><b>{totals.pickup1 > 0 ? '+' : ''}{totals.pickup1}</b></div>
            <div><span>{k('pickup7')}</span><b>{totals.pickup7 > 0 ? '+' : ''}{totals.pickup7}</b></div>
            <div><span>{k('pickup30')}</span><b>{totals.pickup30 > 0 ? '+' : ''}{totals.pickup30}</b></div>
            <div><span>{k('cancelled30')}</span><b>{totals.cancelled30}</b></div>
          </div>
          <div className="bk-table-wrap" style={{ marginTop: 14 }}>
            <table className="bk-table rp-table">
              <thead><tr><th>{k('stayPeriod')}</th><th>{k('otbRooms')}</th><th>{k('pickup1')}</th><th>{k('pickup7')}</th><th>{k('pickup30')}</th><th>{k('new30')}</th><th>{k('cancelled30')}</th></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.period}><td>{periodLabel(r.period, loc)}</td><td>{r.otb}</td><td>{delta(r.pickup1, 0)}</td><td>{delta(r.pickup7, 0)}</td><td>{delta(r.pickup30, 0)}</td><td>{r.new30}</td><td>{r.cancelled30 || '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
};
