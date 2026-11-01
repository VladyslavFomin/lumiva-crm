import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
import { DateInput } from '../../../components/ui/DateInput';
import { fmtDate, money, todayIso, addDaysIso } from '../partners/partnerUtils';
import { hotelErrorText } from '../ReservationLifecycle';
import { useLoc } from '../guests/GuestShared';
import {
  createHotelGroup,
  fetchHotelGroups,
  fetchHotels,
  fetchPartners,
  fetchRoomTypes,
  type Hotel,
  type HotelAgency,
  type HotelGroup,
  type HotelGroupRoomLine,
  type HotelRoomType,
} from '../../../api/hotels';
import '../hotels-design.css';

type Period = 'upcoming' | 'past' | 'all';

/** Групповые брони: список с заполненностью rooming list и деньгами, создание группы номерами */
export const HotelGroupsPage: React.FC = () => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.groups.${key}`, o);
  const loc = useLoc();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelId, setHotelId] = useState('');
  const [period, setPeriod] = useState<Period>('upcoming');
  const [status, setStatus] = useState('');
  const [list, setList] = useState<HotelGroup[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchHotels().then((h) => { setHotels(h); if (h[0]) setHotelId(h[0].id); }).catch((e) => showAlert(e.message, { variant: 'error' })); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const load = () => {
    if (!hotelId) return;
    fetchHotelGroups({ hotelId, period, status: status || undefined }).then(setList).catch((e) => showAlert(hotelErrorText(t, e, k('loadError')), { variant: 'error' }));
  };
  useEffect(load, [hotelId, period, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = (list || []).filter((g) => g.status !== 'cancelled').reduce((a, g) => ({ groups: a.groups + 1, rooms: a.rooms + g.summary.rooms, named: a.named + g.summary.named, pax: a.pax + g.summary.pax }), { groups: 0, rooms: 0, named: 0, pax: 0 });

  return (
    <MainLayout>
      <PageHelpButton topic="hotels" />
      <div className="px-scope">
        <HotelsSubnav active="groups" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{k('kicker')}</div>
            <h1>{k('title')}</h1>
            <p className="sub">{k('subtitle')}</p>
          </div>
          <div className="htl-hero-r">
            <button className="btn btn-primary" disabled={!hotelId} onClick={() => setCreating(true)}><Ic d={HTL_ICON.plus} size={13} />{k('add')}</button>
          </div>
        </div>

        <div className="htl-kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <div className="htl-kpi"><div className="l">{k('kpi.groups')}</div><div className="v">{totals.groups}</div></div>
          <div className="htl-kpi"><div className="l">{k('kpi.rooms')}</div><div className="v">{totals.rooms}</div></div>
          <div className="htl-kpi"><div className="l">{k('kpi.pax')}</div><div className="v">{totals.pax}</div></div>
          <div className="htl-kpi"><div className="l">{k('kpi.rooming')}</div><div className="v">{totals.rooms ? `${Math.round((totals.named / totals.rooms) * 100)}%` : '—'}</div><div className="d">{k('kpi.roomingHint', { named: totals.named, rooms: totals.rooms })}</div></div>
        </div>

        <div className="htl-toolbar">
          <select className="htl-select" value={hotelId} onChange={(e) => setHotelId(e.target.value)}>
            {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <div className="bk-savedviews" style={{ flex: 'none' }}>
            {(['upcoming', 'past', 'all'] as const).map((p) => <div key={p} className={`bk-sv-tab${period === p ? ' active' : ''}`} onClick={() => setPeriod(p)}>{k(`period.${p}`)}</div>)}
          </div>
          <select className="htl-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{k('anyStatus')}</option>
            {(['tentative', 'definite', 'cancelled'] as const).map((s) => <option key={s} value={s}>{k(`status.${s}`)}</option>)}
          </select>
        </div>

        {list && !list.length ? (
          <div className="htl-empty"><h4>{k('emptyTitle')}</h4><p>{k('emptyText')}</p></div>
        ) : (
          <div className="bk-table-wrap">
            <table className="bk-table">
              <thead>
                <tr><th>{k('col.group')}</th><th>{k('col.dates')}</th><th>{k('col.status')}</th><th className="num">{k('col.rooms')}</th><th>{k('col.rooming')}</th><th className="num">{k('col.total')}</th><th className="num">{k('col.balance')}</th></tr>
              </thead>
              <tbody>
                {(list || []).map((g) => {
                  const pct = g.summary.rooms ? Math.round((g.summary.named / g.summary.rooms) * 100) : 0;
                  const late = g.roomingDue && g.roomingDue < todayIso() && pct < 100;
                  return (
                    <tr key={g.id} className="clickable" onClick={() => navigate(`/hotels/groups/${g.id}`)}>
                      <td><b>{g.name}</b><div className="htl-sub mono">{g.code}{g.partnerName ? ` · ${g.partnerName}` : ''}</div></td>
                      <td className="mono">{fmtDate(g.checkIn, loc)} – {fmtDate(g.checkOut, loc)}</td>
                      <td>
                        <span className={`grp-status s-${g.status}`}>{k(`status.${g.status}`)}</span>
                        {g.status === 'tentative' && g.optionUntil && <div className="htl-sub">{k('optionTill', { date: new Date(g.optionUntil).toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</div>}
                      </td>
                      <td className="num mono">{g.summary.rooms}<div className="htl-sub">{k('paxShort', { count: g.summary.pax })}</div></td>
                      <td>
                        <div className="grp-bar"><span style={{ width: `${pct}%` }} /></div>
                        <div className={`htl-sub${late ? ' grp-late' : ''}`}>{k('namedOf', { named: g.summary.named, rooms: g.summary.rooms })}{g.roomingDue ? ` · ${k('due', { date: fmtDate(g.roomingDue, loc) })}` : ''}</div>
                      </td>
                      <td className="num mono">{money(g.summary.total, g.summary.currency, loc)}</td>
                      <td className={`num mono${g.summary.balance > 0.009 ? ' grp-debt' : ''}`}>{money(g.summary.balance, g.summary.currency, loc)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {creating && hotelId && <NewGroupDialog hotelId={hotelId} onClose={() => setCreating(false)} onCreated={(id) => navigate(`/hotels/groups/${id}`)} />}
    </MainLayout>
  );
};

/** Новая группа: даты, партнёр, статус (опцион / подтверждена), номера по типам с составом */
const NewGroupDialog: React.FC<{ hotelId: string; onClose: () => void; onCreated: (id: string) => void }> = ({ hotelId, onClose, onCreated }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.groups.${key}`, o);
  const { showAlert } = useAlertModal();
  const [types, setTypes] = useState<HotelRoomType[]>([]);
  const [partners, setPartners] = useState<HotelAgency[]>([]);
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState({ name: '', agencyId: '', contactName: '', contactEmail: '', contactPhone: '', checkIn: addDaysIso(todayIso(), 30), checkOut: addDaysIso(todayIso(), 37), status: 'definite' as 'definite' | 'tentative', optionDays: '7', roomingDue: '', notes: '' });
  const [lines, setLines] = useState<HotelGroupRoomLine[]>([]);
  useEffect(() => {
    fetchRoomTypes(hotelId).then((x) => { setTypes(x); if (x[0]) setLines([{ roomTypeId: x[0].id, count: 5, adults: 2 }]); }).catch(() => setTypes([]));
    fetchPartners().then((x) => setPartners(x)).catch(() => setPartners([]));
  }, [hotelId]);
  const set = (p: Partial<typeof d>) => setD({ ...d, ...p });
  const total = lines.reduce((s, l) => s + (Number(l.count) || 0), 0);
  const errors = [
    !d.name.trim() && k('err.name'),
    !(d.checkIn && d.checkOut && d.checkOut > d.checkIn) && k('err.dates'),
    !total && k('err.rooms'),
    d.status === 'tentative' && !(Number(d.optionDays) > 0) && k('err.option'),
  ].filter(Boolean) as string[];
  const save = () => {
    setBusy(true);
    createHotelGroup({
      hotelId, name: d.name.trim(), agencyId: d.agencyId || null, contactName: d.contactName || null, contactEmail: d.contactEmail || null, contactPhone: d.contactPhone || null,
      checkIn: d.checkIn, checkOut: d.checkOut, status: d.status, roomingDue: d.roomingDue || null, notes: d.notes || null,
      optionUntil: d.status === 'tentative' ? new Date(Date.now() + Number(d.optionDays) * 86400000).toISOString() : null,
      rooms: lines.filter((l) => Number(l.count) > 0),
    })
      .then((g) => onCreated(g.id))
      .catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }))
      .finally(() => setBusy(false));
  };
  return createPortal(
    <div className="px-scope">
      <div className="lv-backdrop htl-sheet-back" onClick={onClose} />
      <div className="lv-sheet-right htl-sheet" role="dialog" aria-modal="true">
        <div className="htl-sheet-head"><div><h3>{k('newTitle')}</h3><div className="htl-sub" style={{ marginTop: 4 }}>{k('newHint')}</div></div><button onClick={onClose} aria-label={k('cancel')}><Ic d={HTL_ICON.x} size={16} /></button></div>
        <div className="htl-sheet-body">
          <div className="htl-form" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
            <div className="htl-form-sec" style={{ gridColumn: 'span 2' }}>{k('secMain')}</div>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('f.name')} *</label><input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder={k('f.namePh')} /></div>
            <div className="htl-f"><label>{k('f.checkIn')}</label><DateInput value={d.checkIn} clearable={false} onChange={(v) => set({ checkIn: v, checkOut: d.checkOut <= v ? addDaysIso(v, 1) : d.checkOut })} /></div>
            <div className="htl-f"><label>{k('f.checkOut')}</label><DateInput value={d.checkOut} clearable={false} min={addDaysIso(d.checkIn, 1)} onChange={(v) => set({ checkOut: v })} /></div>
            <div className="htl-f"><label>{k('f.partner')}</label>
              <select value={d.agencyId} onChange={(e) => set({ agencyId: e.target.value })}>
                <option value="">{k('f.noPartner')}</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="htl-f"><label>{k('f.roomingDue')}</label><DateInput value={d.roomingDue} onChange={(v) => set({ roomingDue: v })} /></div>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}>
              <label>{k('f.status')}</label>
              <div className="htl-seg">
                {(['definite', 'tentative'] as const).map((s) => <button key={s} type="button" className={d.status === s ? 'on' : ''} onClick={() => set({ status: s })}>{k(`status.${s}`)}</button>)}
              </div>
            </div>
            {d.status === 'tentative' && <div className="htl-f"><label>{k('f.optionDays')}</label><input type="number" min={1} max={60} value={d.optionDays} onChange={(e) => set({ optionDays: e.target.value })} /></div>}
            {d.status === 'tentative' && <div className="htl-hint" style={{ alignSelf: 'end' }}>{k('optionHint')}</div>}

            <div className="htl-form-sec" style={{ gridColumn: 'span 2' }}>{k('secRooms', { count: total })}</div>
            <div style={{ gridColumn: 'span 2' }}>
              {lines.map((l, i) => (
                <div key={i} className="grp-line">
                  <select value={l.roomTypeId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, roomTypeId: e.target.value } : x)))}>
                    {types.map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
                  </select>
                  <label>{k('f.count')}<input type="number" min={1} max={300} value={l.count} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, count: Number(e.target.value) } : x)))} /></label>
                  <label>{k('f.adults')}<input type="number" min={1} max={10} value={l.adults ?? 2} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, adults: Number(e.target.value) } : x)))} /></label>
                  <button type="button" className="btn-icon" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label={k('removeLine')}><Ic d={HTL_ICON.x} size={13} /></button>
                </div>
              ))}
              <button type="button" className="btn btn-sm" disabled={!types.length} onClick={() => setLines([...lines, { roomTypeId: types[0]?.id, count: 1, adults: 2 }])}><Ic d={HTL_ICON.plus} size={12} />{k('addLine')}</button>
              <div className="htl-hint" style={{ marginTop: 8 }}>{k('roomsHint')}</div>
            </div>

            <div className="htl-form-sec" style={{ gridColumn: 'span 2' }}>{k('secContact')}</div>
            <div className="htl-f"><label>{k('f.contactName')}</label><input value={d.contactName} onChange={(e) => set({ contactName: e.target.value })} /></div>
            <div className="htl-f"><label>Email</label><input value={d.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} /></div>
            <div className="htl-f"><label>{k('f.contactPhone')}</label><input value={d.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} /></div>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('f.notes')}</label><textarea rows={2} value={d.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
          </div>
          {errors.length > 0 && <div className="pe-box warn" style={{ marginTop: 12 }}>{errors.map((x) => <div key={x}>{x}</div>)}</div>}
        </div>
        <div className="htl-sheet-foot">
          <button type="button" className="btn" onClick={onClose}>{k('cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={busy || errors.length > 0} onClick={save}><Ic d={HTL_ICON.check} size={14} />{busy ? k('creating') : k('create', { count: total })}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
