import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
import { DateInput } from '../../../components/ui/DateInput';
import { CountryTag } from '../CountrySelect';
import { fmtDate, money, todayIso } from '../partners/partnerUtils';
import { hotelErrorText } from '../ReservationLifecycle';
import { useLoc } from '../guests/GuestShared';
import {
  addHotelGroupRooms,
  applyHotelGroupRooming,
  assignHotelGroupRooms,
  cancelHotelGroupRooms,
  changeHotelGroupDates,
  fetchHotelGroup,
  hotelGroupStay,
  payHotelGroup,
  previewHotelGroupRooming,
  updateHotelGroup,
  updateReservation,
  HOTEL_CANCEL_REASONS,
  type HotelGroupFull,
  type HotelGroupRoomLine,
  type HotelRoomingPreview,
} from '../../../api/hotels';
import '../hotels-design.css';
import '../pricing/season-price.css';

type Dialog = null | 'rooming' | 'pay' | 'rooms' | 'dates' | 'cancel';

/** Карточка группы: номера и гости, rooming list, раздача комнат, заселение, общий платёж, даты, отмена номеров */
export const HotelGroupPage: React.FC = () => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.groups.${key}`, o);
  const loc = useLoc();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlertModal();
  const [g, setG] = useState<HotelGroupFull | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const load = () => fetchHotelGroup(id).then((x) => { setG(x); setNames({}); }).catch((e) => showAlert(hotelErrorText(t, e, k('loadError')), { variant: 'error' }));
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const err = (e: unknown) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' });
  const act = async <T extends { group: HotelGroupFull }>(fn: () => Promise<T>, ok: (r: T) => string, failedOf?: (r: T) => Array<{ error?: string; name?: string }>) => {
    setBusy(true);
    try {
      const r = await fn();
      setG(r.group);
      setSel(new Set());
      const failed = failedOf ? failedOf(r) : [];
      showAlert(ok(r) + (failed.length ? ` · ${k('failedN', { count: failed.length })}: ${failed.slice(0, 3).map((f) => `${f.name ? `${f.name} — ` : ''}${t(`crm.hotels.lifecycle.errors.${f.error}`, { defaultValue: f.error || '' })}`).join('; ')}` : ''), { variant: failed.length ? 'error' : 'success' });
    } catch (e) {
      err(e);
    } finally {
      setBusy(false);
    }
  };
  if (!g) return <MainLayout><div className="px-scope"><HotelsSubnav active="groups" /></div></MainLayout>;

  const s = g.summary;
  const today = todayIso();
  const pct = s.rooms ? Math.round((s.named / s.rooms) * 100) : 0;
  const active = g.reservations.filter((r) => ['confirmed', 'pending', 'checked_in'].includes(r.status));
  const arrivalsToday = active.filter((r) => r.checkIn === today && r.status !== 'checked_in').length;
  const departuresToday = active.filter((r) => r.status === 'checked_in' && r.checkOut <= today).length;
  const cancelled = g.status === 'cancelled';
  const saveName = (rid: string) => {
    const v = (names[rid] ?? '').trim();
    const r = g.reservations.find((x) => x.id === rid);
    if (!r || !v || v === r.guestName) return;
    updateReservation(rid, { guestName: v }).then(() => load()).catch(err);
  };

  return (
    <MainLayout>
      <PageHelpButton topic="hotels" />
      <div className="px-scope">
        <HotelsSubnav active="groups" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" /><button type="button" className="lnk" onClick={() => navigate('/hotels/groups')}>{k('title')}</button> · <span className="mono">{g.code}</span></div>
            <h1 className="gp-h1">{g.name} <span className={`grp-status s-${g.status}`}>{k(`status.${g.status}`)}</span></h1>
            <p className="sub">
              {g.hotelName} · {fmtDate(g.checkIn, loc)} – {fmtDate(g.checkOut, loc)}{g.partnerName ? ` · ${g.partnerName}` : ''}
              {g.status === 'tentative' && g.optionUntil ? ` · ${k('optionTill', { date: new Date(g.optionUntil).toLocaleString(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}` : ''}
            </p>
          </div>
          {!cancelled && (
            <div className="htl-hero-r grp-actions">
              {g.status === 'tentative' && (
                <button className="btn btn-primary" disabled={busy} onClick={async () => {
                  if (!(await showConfirm(k('confirmBody', { count: s.rooms }), { title: k('confirmGroup'), confirmLabel: k('confirmGroup') }))) return;
                  setBusy(true);
                  updateHotelGroup(g.id, { status: 'definite' }).then((x) => { setG(x); showAlert(k('confirmed'), { variant: 'success' }); }).catch(err).finally(() => setBusy(false));
                }}><Ic d={HTL_ICON.check} size={14} />{k('confirmGroup')}</button>
              )}
              <button className="btn" disabled={busy} onClick={() => setDialog('rooming')}><Ic d={HTL_ICON.download} size={13} />{k('rooming')}</button>
              <button className="btn" disabled={busy || s.withUnit >= s.rooms} onClick={() => act(() => assignHotelGroupRooms(g.id), (r) => k('assigned', { count: r.assigned }) + (r.missing ? ` · ${k('noFreeUnits', { count: r.missing })}` : ''))}>{k('assignRooms')}</button>
              {arrivalsToday > 0 && <button className="btn" disabled={busy} onClick={() => act(() => hotelGroupStay(g.id, 'check_in'), (r) => k('checkedIn', { count: r.done }), (r) => r.failed)}>{k('checkInToday', { count: arrivalsToday })}</button>}
              {departuresToday > 0 && <button className="btn" disabled={busy} onClick={() => act(() => hotelGroupStay(g.id, 'check_out'), (r) => k('checkedOut', { count: r.done }), (r) => r.failed)}>{k('checkOutToday', { count: departuresToday })}</button>}
              <button className="btn" disabled={busy || s.balance <= 0.009} onClick={() => setDialog('pay')}>{k('pay')}</button>
            </div>
          )}
        </div>

        <div className="htl-kpis" style={{ gridTemplateColumns: 'repeat(6,1fr)' }}>
          <div className="htl-kpi"><div className="l">{k('kpi.rooms')}</div><div className="v">{s.rooms}</div><div className="d">{s.byType.map((b) => `${g.roomTypes.find((x) => x.id === b.roomTypeId)?.name || '—'} ×${b.count}`).join(' · ')}</div></div>
          <div className="htl-kpi"><div className="l">{k('kpi.pax')}</div><div className="v">{s.pax}</div></div>
          <div className="htl-kpi"><div className="l">{k('kpi.rooming')}</div><div className="v">{pct}%</div><div className={`d${g.roomingDue && g.roomingDue < today && pct < 100 ? ' down' : ''}`}>{k('namedOf', { named: s.named, rooms: s.rooms })}{g.roomingDue ? ` · ${k('due', { date: fmtDate(g.roomingDue, loc) })}` : ''}</div></div>
          <div className="htl-kpi"><div className="l">{k('kpi.total')}</div><div className="v">{money(s.total, s.currency, loc)}</div></div>
          <div className="htl-kpi"><div className="l">{k('kpi.paid')}</div><div className="v">{money(s.paid, s.currency, loc)}</div></div>
          <div className="htl-kpi"><div className="l">{k('kpi.balance')}</div><div className="v">{money(s.balance, s.currency, loc)}</div>{s.balance > 0.009 && <div className="d down">{k('debt')}</div>}</div>
        </div>

        <div className="htl-toolbar">
          {sel.size > 0 ? (
            <>
              <span className="htl-sub">{k('selected', { count: sel.size })}</span>
              <button className="btn btn-sm" disabled={busy} onClick={() => setDialog('dates')}>{k('changeDates')}</button>
              <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => setDialog('cancel')}>{k('cancelRooms')}</button>
              <button className="btn btn-sm" onClick={() => setSel(new Set())}>{k('clearSel')}</button>
            </>
          ) : !cancelled && (
            <>
              <button className="btn btn-sm" disabled={busy} onClick={() => setDialog('rooms')}><Ic d={HTL_ICON.plus} size={12} />{k('addRooms')}</button>
              <button className="btn btn-sm" disabled={busy} onClick={() => setDialog('dates')}>{k('changeDatesAll')}</button>
              <button className="btn btn-sm" disabled={busy} onClick={() => setDialog('cancel')}>{k('cancelAll')}</button>
            </>
          )}
        </div>

        <div className="bk-table-wrap">
          <table className="bk-table grp-rooms">
            <thead>
              <tr>
                <th style={{ width: 30 }}><input type="checkbox" aria-label={k('selectAll')} checked={sel.size > 0 && sel.size === active.filter((r) => r.status !== 'checked_in').length} onChange={(e) => setSel(e.target.checked ? new Set(active.filter((r) => r.status !== 'checked_in').map((r) => r.id)) : new Set())} /></th>
                <th>{k('col.guest')}</th><th>{k('col.roomType')}</th><th>{k('col.room')}</th><th>{k('col.dates')}</th><th>{k('col.status')}</th><th className="num">{k('col.pax')}</th><th className="num">{k('col.total')}</th><th className="num">{k('col.paidCol')}</th><th />
              </tr>
            </thead>
            <tbody>
              {g.reservations.map((r) => {
                const closed = !['confirmed', 'pending'].includes(r.status);
                return (
                  <tr key={r.id} className={r.status === 'cancelled' || r.status === 'no_show' ? 'grp-off' : ''}>
                    <td>{!closed && <input type="checkbox" checked={sel.has(r.id)} onChange={() => setSel((x) => { const n = new Set(x); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} />}</td>
                    <td>
                      {r.status === 'cancelled' ? r.guestName : (
                        <input className={`grp-name${r.roomingPending ? ' pending' : ''}`} value={names[r.id] ?? (r.roomingPending ? '' : r.guestName)} placeholder={r.roomingPending ? k('noGuestYet') : ''}
                          onChange={(e) => setNames({ ...names, [r.id]: e.target.value })} onBlur={() => saveName(r.id)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
                      )}
                      {r.guests.length > 1 && <div className="htl-sub">{r.guests.slice(1).map((x) => x.fullName).join(', ')}</div>}
                      {r.guests[0]?.nationalityCode && <div className="htl-sub"><CountryTag code={r.guests[0].nationalityCode} /></div>}
                    </td>
                    <td>{r.roomTypeName}</td>
                    <td className="mono">{r.roomLabel || <span className="htl-sub">—</span>}</td>
                    <td className="mono">{fmtDate(r.checkIn, loc)} – {fmtDate(r.checkOut, loc)}</td>
                    <td><span className={`gp-status s-${r.status}`}>{t(`crm.hotels.reservations.status.${r.status}`)}</span></td>
                    <td className="num mono">{r.pax}{r.children ? <span className="htl-sub"> ({k('kids', { count: r.children })})</span> : null}</td>
                    <td className="num mono">{money(Number(r.total) + Number(r.extrasTotal || 0), s.currency, loc)}</td>
                    <td className="num mono">{money(r.paid, s.currency, loc)}</td>
                    <td><button type="button" className="btn btn-sm" onClick={() => navigate(`/hotels/reservations?reservation=${r.id}`)}>{k('open')}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="htl-cols">
          <div className="htl-col-main">
            <GroupDetails g={g} onSaved={setG} />
          </div>
        </div>
      </div>

      {dialog === 'rooming' && <RoomingDialog groupId={g.id} onClose={() => setDialog(null)} onDone={(x) => { setG(x); setDialog(null); }} />}
      {dialog === 'pay' && (
        <SimpleDialog title={k('payTitle')} onClose={() => setDialog(null)} busy={busy} fields={['amount', 'method', 'date', 'note']} initial={{ amount: String(s.balance), method: 'bank_transfer', date: today, note: '' }}
          hint={k('payHint')} onSubmit={(v) => act(() => payHotelGroup(g.id, { amount: v.amount, method: v.method, date: v.date, note: v.note }), (r) => k('paid', { count: r.distributed.length })).then(() => setDialog(null))} />
      )}
      {dialog === 'dates' && (
        <SimpleDialog title={sel.size ? k('datesSelTitle', { count: sel.size }) : k('datesAllTitle')} onClose={() => setDialog(null)} busy={busy} fields={['checkIn', 'checkOut']} initial={{ checkIn: g.checkIn, checkOut: g.checkOut }}
          hint={k('datesHint')} onSubmit={(v) => act(() => changeHotelGroupDates(g.id, { checkIn: v.checkIn, checkOut: v.checkOut, reservationIds: sel.size ? [...sel] : undefined }), (r) => k('datesDone', { count: r.updated }), (r) => r.failed.map((f) => ({ error: f.error }))).then(() => setDialog(null))} />
      )}
      {dialog === 'cancel' && (
        <SimpleDialog danger title={sel.size ? k('cancelSelTitle', { count: sel.size }) : k('cancelAllTitle')} onClose={() => setDialog(null)} busy={busy} fields={['reason', 'fee', 'note']} initial={{ reason: '', fee: 'policy', note: '' }}
          hint={k('cancelHint')} onSubmit={(v) => act(() => cancelHotelGroupRooms(g.id, { reservationIds: sel.size ? [...sel] : undefined, reason: v.reason, fee: v.fee as 'policy' | 'none', note: v.note }), (r) => k('cancelledN', { count: r.cancelled }), (r) => r.failed.map((f) => ({ error: f.error }))).then(() => setDialog(null))} />
      )}
      {dialog === 'rooms' && <AddRoomsDialog types={g.roomTypes} busy={busy} onClose={() => setDialog(null)} onSubmit={(lines) => { setBusy(true); addHotelGroupRooms(g.id, lines).then((x) => { setG(x); setDialog(null); showAlert(k('roomsAdded'), { variant: 'success' }); }).catch(err).finally(() => setBusy(false)); }} />}
    </MainLayout>
  );
};

/** Данные группы: контакт, срок rooming list, опцион, заметки */
const GroupDetails: React.FC<{ g: HotelGroupFull; onSaved: (g: HotelGroupFull) => void }> = ({ g, onSaved }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.groups.${key}`, o);
  const { showAlert } = useAlertModal();
  const init = { name: g.name, contactName: g.contactName || '', contactEmail: g.contactEmail || '', contactPhone: g.contactPhone || '', roomingDue: g.roomingDue || '', notes: g.notes || '' };
  const [d, setD] = useState(init);
  useEffect(() => setD(init), [g.id, g.name, g.contactName, g.contactEmail, g.contactPhone, g.roomingDue, g.notes]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(d) !== JSON.stringify(init);
  return (
    <div className="htl-panel">
      <h3 className="htl-h3">{k('secDetails')}</h3>
      <div className="htl-form" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
        <div className="htl-f"><label>{k('f.name')}</label><input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></div>
        <div className="htl-f"><label>{k('f.contactName')}</label><input value={d.contactName} onChange={(e) => setD({ ...d, contactName: e.target.value })} /></div>
        <div className="htl-f"><label>Email</label><input value={d.contactEmail} onChange={(e) => setD({ ...d, contactEmail: e.target.value })} /></div>
        <div className="htl-f"><label>{k('f.contactPhone')}</label><input value={d.contactPhone} onChange={(e) => setD({ ...d, contactPhone: e.target.value })} /></div>
        <div className="htl-f"><label>{k('f.roomingDue')}</label><DateInput value={d.roomingDue} onChange={(v) => setD({ ...d, roomingDue: v })} /></div>
        <div className="htl-f" />
        <div className="htl-f" style={{ gridColumn: 'span 3' }}><label>{k('f.notes')}</label><textarea rows={2} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} /></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <button className="btn btn-primary btn-sm" disabled={!dirty} onClick={() => updateHotelGroup(g.id, { ...d, roomingDue: d.roomingDue || null, contactEmail: d.contactEmail || null }).then((x) => { onSaved(x); showAlert(k('saved'), { variant: 'success' }); }).catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }))}>{k('save')}</button>
      </div>
    </div>
  );
};

/** Небольшая форма в модалке: оплата / даты / отмена */
const SimpleDialog: React.FC<{
  title: string; hint?: string; danger?: boolean; busy: boolean; fields: string[]; initial: Record<string, string>;
  onClose: () => void; onSubmit: (v: Record<string, string>) => void;
}> = ({ title, hint, danger, busy, fields, initial, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.groups.${key}`, o);
  const [v, setV] = useState(initial);
  const ok = fields.every((f) => (['note', 'date'].includes(f) ? true : !!String(v[f] || '').trim())) && (!fields.includes('checkOut') || v.checkOut > v.checkIn);
  return createPortal(
    <div className="px-scope">
      <div className="lv-backdrop bk-modal-back" onClick={onClose} />
      <div className="bk-modal narrow lv-dialog" role="dialog" aria-modal="true">
        <div className="bk-modal-head"><h3>{title}</h3><button type="button" onClick={onClose} aria-label={k('cancel')}><Ic d={HTL_ICON.x} size={16} /></button></div>
        <div className="bk-modal-body">
          {fields.map((f) => (
            <div key={f} className="htl-f" style={{ marginBottom: 10 }}>
              <label>{k(`f.${f}`)}</label>
              {f === 'checkIn' || f === 'checkOut' || f === 'date' ? <DateInput value={v[f]} clearable={false} onChange={(x) => setV({ ...v, [f]: x })} />
                : f === 'method' ? (
                  <select value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })}>
                    {['bank_transfer', 'card', 'cash', 'other'].map((m) => <option key={m} value={m}>{t(`crm.hotels.reservations.paymentMethods.${m}`)}</option>)}
                  </select>
                ) : f === 'reason' ? (
                  <select value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })}>
                    <option value="">{t('crm.hotels.lifecycle.pickReason')}</option>
                    {HOTEL_CANCEL_REASONS.map((r) => <option key={r} value={r}>{t(`crm.hotels.lifecycle.cancelReasons.${r}`)}</option>)}
                  </select>
                ) : f === 'fee' ? (
                  <div className="htl-seg">
                    {(['policy', 'none'] as const).map((x) => <button key={x} type="button" className={v.fee === x ? 'on' : ''} onClick={() => setV({ ...v, fee: x })}>{k(`fee.${x}`)}</button>)}
                  </div>
                ) : <input value={v[f] || ''} inputMode={f === 'amount' ? 'decimal' : undefined} onChange={(e) => setV({ ...v, [f]: e.target.value })} />}
            </div>
          ))}
          {hint && <div className="htl-hint">{hint}</div>}
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>{k('cancel')}</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy || !ok} onClick={() => onSubmit(v)}><Ic d={HTL_ICON.check} size={14} />{k('apply')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const AddRoomsDialog: React.FC<{ types: Array<{ id: string; name: string }>; busy: boolean; onClose: () => void; onSubmit: (l: HotelGroupRoomLine[]) => void }> = ({ types, busy, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.groups.${key}`, o);
  const [lines, setLines] = useState<HotelGroupRoomLine[]>(types[0] ? [{ roomTypeId: types[0].id, count: 1, adults: 2 }] : []);
  return createPortal(
    <div className="px-scope">
      <div className="lv-backdrop bk-modal-back" onClick={onClose} />
      <div className="bk-modal narrow lv-dialog" role="dialog" aria-modal="true">
        <div className="bk-modal-head"><h3>{k('addRooms')}</h3><button type="button" onClick={onClose} aria-label={k('cancel')}><Ic d={HTL_ICON.x} size={16} /></button></div>
        <div className="bk-modal-body">
          {lines.map((l, i) => (
            <div key={i} className="grp-line">
              <select value={l.roomTypeId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, roomTypeId: e.target.value } : x)))}>{types.map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}</select>
              <label>{k('f.count')}<input type="number" min={1} max={300} value={l.count} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, count: Number(e.target.value) } : x)))} /></label>
              <label>{k('f.adults')}<input type="number" min={1} max={10} value={l.adults ?? 2} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, adults: Number(e.target.value) } : x)))} /></label>
              <button type="button" className="btn-icon" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label={k('removeLine')}><Ic d={HTL_ICON.x} size={13} /></button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => setLines([...lines, { roomTypeId: types[0]?.id, count: 1, adults: 2 }])}><Ic d={HTL_ICON.plus} size={12} />{k('addLine')}</button>
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>{k('cancel')}</button>
          <button className="btn btn-primary" disabled={busy || !lines.some((l) => l.count > 0)} onClick={() => onSubmit(lines)}><Ic d={HTL_ICON.check} size={14} />{k('apply')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/** Rooming list: файл → что куда ляжет → применить (недостающие номера — по галочке) */
const RoomingDialog: React.FC<{ groupId: string; onClose: () => void; onDone: (g: HotelGroupFull) => void }> = ({ groupId, onClose, onDone }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.groups.${key}`, o);
  const loc = useLoc();
  const { showAlert } = useAlertModal();
  const [file, setFile] = useState<File | null>(null);
  const [pv, setPv] = useState<HotelRoomingPreview | null>(null);
  const [addMissing, setAddMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const pick = (f: File) => {
    setFile(f);
    setPv(null);
    setBusy(true);
    previewHotelGroupRooming(groupId, f).then(setPv).catch((e) => showAlert(hotelErrorText(t, e, k('readError')), { variant: 'error' })).finally(() => setBusy(false));
  };
  const apply = () => {
    if (!file) return;
    setBusy(true);
    applyHotelGroupRooming(groupId, file, addMissing)
      .then((r) => {
        showAlert(k('roomingDone', { applied: r.applied + r.updated, added: r.added }) + (r.failed.length ? ` · ${k('failedN', { count: r.failed.length })}: ${r.failed.slice(0, 3).map((f) => f.name).join(', ')}` : ''), { variant: r.failed.length ? 'error' : 'success' });
        onDone(r.group);
      })
      .catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }))
      .finally(() => setBusy(false));
  };
  const problems = pv?.rooms.filter((r) => r.problem).length || 0;
  return createPortal(
    <div className="px-scope">
      <div className="lv-backdrop bk-modal-back" onClick={onClose} />
      <div className="bk-modal sp-import lv-dialog" role="dialog" aria-modal="true">
        <div className="bk-modal-head"><h3>{k('roomingTitle')}</h3><button type="button" onClick={onClose} aria-label={k('cancel')}><Ic d={HTL_ICON.x} size={16} /></button></div>
        <div className="bk-modal-body">
          <div className="sp-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) pick(f); }}>
            <div>{k('roomingDrop')}</div>
            <div className="sp-muted">{k('roomingFormat')}</div>
            <div className="sp-file">
              <label className="btn btn-sm">{k('chooseFile')}<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} /></label>
              <span>{file ? file.name : ''}</span>
            </div>
          </div>
          {busy && !pv && <div className="sp-muted" style={{ marginTop: 10 }}>{k('reading')}</div>}
          {pv && (
            <>
              <div className="sp-kpis" style={{ marginTop: 12 }}>
                <div><span>{k('pvRooms')}</span><b>{pv.rooms.length}</b></div>
                <div><span>{k('pvGuests')}</span><b>{pv.rooms.reduce((a, r) => a + r.guests.length, 0)}</b></div>
                <div><span>{k('pvProblems')}</span><b>{problems}</b></div>
              </div>
              <div className="sp-scroll">
                <table className="sp-table sp-eb">
                  <thead><tr><th className="sp-c0">{k('pvRow')}</th><th>{k('col.roomType')}</th><th>{k('col.guest')}</th><th>{k('col.dates')}</th><th>{k('pvTarget')}</th></tr></thead>
                  <tbody>
                    {pv.rooms.map((r) => (
                      <tr key={r.row}>
                        <td className="sp-c0">{r.row}{r.key ? ` · ${r.key}` : ''}</td>
                        <td>{r.roomType || '—'}</td>
                        <td>{r.guests.map((x) => `${x.fullName}${x.childHint || (x.age !== null && x.age < 12) ? ` (${k('child')})` : ''}${x.nationality ? ` · ${x.nationality}` : ''}`).join(', ')}</td>
                        <td>{r.checkIn ? `${fmtDate(r.checkIn, loc)} – ${r.checkOut ? fmtDate(r.checkOut, loc) : ''}` : '—'}</td>
                        <td>{r.problem ? <span className="sp-tag">{k(`problem.${r.problem}`)}</span> : <span className={`sp-tag${r.existing ? '' : ' new'}`}>{r.existing ? k('pvUpdate') : r.reservationName}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {problems > 0 && <label className="sp-eb-opt"><input type="checkbox" checked={addMissing} onChange={(e) => setAddMissing(e.target.checked)} />{k('addMissing')}</label>}
            </>
          )}
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>{k('cancel')}</button>
          <button className="btn btn-primary" disabled={!pv || busy} onClick={apply}><Ic d={HTL_ICON.check} size={14} />{k('apply')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
