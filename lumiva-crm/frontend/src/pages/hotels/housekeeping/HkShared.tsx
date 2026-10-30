import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { API_BASE } from '../../../api/client';
import { Ic, HTL_ICON } from '../HotelIcons';
import { hotelErrorText } from '../ReservationLifecycle';
import { todayIso } from '../partners/partnerUtils';
import {
  createIssue,
  createLostItem,
  createOutage,
  fetchHkUnits,
  updateOutage,
  uploadHkPhoto,
  HOTEL_ISSUE_CATEGORIES,
  HOTEL_ISSUE_PRIORITIES,
  HOTEL_LOST_CATEGORIES,
  HOTEL_OUTAGE_REASONS,
  type Hotel,
  type HotelOutageConflict,
  type HotelRoomOutage,
  type HotelStaffMember,
  type HotelUnitFull,
} from '../../../api/hotels';
import { DateInput } from '../../../components/ui/DateInput';

export const useHk = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  return { t, lang, k: (key: string, o?: Record<string, unknown>) => t(`crm.hotels.hk.${key}`, o) };
};

/** /v1/uploads/... → полный адрес, если API на другом домене */
export const photoSrc = (url: string) => (url.startsWith('/v1/') && API_BASE !== '/v1' ? `${API_BASE.replace(/\/v1\/?$/, '')}${url}` : url);

export const unitName = (u: Pick<HotelUnitFull, 'label' | 'floor'> | null | undefined, k: (key: string, o?: Record<string, unknown>) => string) =>
  u ? (u.floor ? `${u.label} · ${k('floorShort', { floor: u.floor })}` : u.label) : '—';

/** Фото с камеры телефона или из галереи; загружается сразу, хранится как список URL */
export const PhotoInput: React.FC<{ value: string[]; onChange: (v: string[]) => void; max?: number }> = ({ value, onChange, max = 6 }) => {
  const { k, t } = useHk();
  const { showAlert } = useAlertModal();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, max - value.length);
    setBusy((n) => n + list.length);
    const urls: string[] = [];
    for (const f of list) {
      try {
        urls.push((await uploadHkPhoto(f)).url);
      } catch (e) {
        showAlert(hotelErrorText(t, e, k('photoError')), { variant: 'error' });
      } finally {
        setBusy((n) => n - 1);
      }
    }
    onChange([...value, ...urls]);
    if (ref.current) ref.current.value = '';
  };
  return (
    <div className="hk-photos">
      {value.map((u) => (
        <span key={u} className="ph">
          <img src={photoSrc(u)} alt="" />
          <button type="button" onClick={() => onChange(value.filter((x) => x !== u))} aria-label={k('removePhoto')}><Ic d={HTL_ICON.x} size={10} /></button>
        </span>
      ))}
      {value.length < max && (
        <button type="button" className="add" onClick={() => ref.current?.click()} disabled={busy > 0}>
          <Ic d={HTL_ICON.plus} size={14} />{busy > 0 ? k('uploading') : k('addPhoto')}
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => void pick(e.target.files)} />
    </div>
  );
};

export const PhotoStrip: React.FC<{ urls: string[] }> = ({ urls }) =>
  urls.length ? (
    <div className="hk-photos small">
      {urls.map((u) => <a key={u} className="ph" href={photoSrc(u)} target="_blank" rel="noreferrer"><img src={photoSrc(u)} alt="" /></a>)}
    </div>
  ) : null;

const Sheet: React.FC<{ title: string; onClose: () => void; foot: React.ReactNode; children: React.ReactNode }> = ({ title, onClose, foot, children }) => {
  const { t } = useTranslation();
  return (
    <div className="px-scope">
      <div className="lv-backdrop htl-sheet-back" onClick={onClose} />
      <div className="lv-sheet-right htl-sheet" role="dialog" aria-modal="true">
        <div className="htl-sheet-head">
          <h3>{title}</h3>
          <button onClick={onClose} aria-label={t('crm.hotels.common.cancel')}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="htl-sheet-body">{children}</div>
        <div className="htl-sheet-foot">{foot}</div>
      </div>
    </div>
  );
};

const useUnits = (hotelId: string) => {
  const [units, setUnits] = useState<HotelUnitFull[]>([]);
  useEffect(() => {
    if (!hotelId) return;
    fetchHkUnits(hotelId).then((r) => setUnits(r.units.filter((u) => u.active))).catch(() => setUnits([]));
  }, [hotelId]);
  return units;
};

export const conflictText = (conflicts: HotelOutageConflict[], k: (key: string, o?: Record<string, unknown>) => string) =>
  conflicts.length ? k('conflicts', { list: conflicts.map((c) => `${c.guestName} (${c.checkIn} – ${c.checkOut})`).join(', ') }) : '';

/** Новая неисправность (PMS-103): номер, категория, срочность, фото; можно сразу снять номер с продажи */
export const IssueSheet: React.FC<{ hotels: Hotel[]; hotelId: string; roomUnitId?: string | null; staff?: HotelStaffMember[]; onClose: () => void; onDone: () => void }> = ({
  hotels, hotelId: initialHotel, roomUnitId, staff, onClose, onDone,
}) => {
  const { k, t } = useHk();
  const { showAlert } = useAlertModal();
  const [hotelId, setHotelId] = useState(initialHotel);
  const units = useUnits(hotelId);
  const [unitId, setUnitId] = useState(roomUnitId || '');
  const [category, setCategory] = useState<string>('other');
  const [priority, setPriority] = useState<string>('normal');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [makeOoo, setMakeOoo] = useState(false);
  const [assignee, setAssignee] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = () => {
    if (!description.trim()) { showAlert(k('errors.HOTEL_ISSUE_DESCRIPTION_REQUIRED'), { variant: 'error' }); return; }
    setBusy(true);
    createIssue({ hotelId, roomUnitId: unitId || null, category, priority, description: description.trim(), photoUrls: photos, makeOoo, assigneeUserId: assignee || null })
      .then((r) => {
        const warn = conflictText(r.conflicts, k);
        showAlert(warn ? `${k('issueCreated')}. ${warn}` : k('issueCreated'), { variant: warn ? 'error' : 'success' });
        onDone();
      })
      .catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }))
      .finally(() => setBusy(false));
  };
  return (
    <Sheet
      title={k('issueNew')}
      onClose={onClose}
      foot={<><button className="btn" onClick={onClose}>{t('crm.hotels.common.cancel')}</button><button className="btn btn-primary" disabled={busy} onClick={submit}><Ic d={HTL_ICON.check} size={14} />{k('issueSubmit')}</button></>}
    >
      <div className="htl-form" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
        {hotels.length > 1 && (
          <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('hotel')}</label>
            <select value={hotelId} onChange={(e) => { setHotelId(e.target.value); setUnitId(''); }}>{hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
          </div>
        )}
        <div className="htl-f"><label>{k('room')}</label>
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            <option value="">{k('noRoomPublic')}</option>
            {units.map((u) => <option key={u.id} value={u.id}>{unitName(u, k)}</option>)}
          </select>
        </div>
        <div className="htl-f"><label>{k('category')}</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>{HOTEL_ISSUE_CATEGORIES.map((c) => <option key={c} value={c}>{k(`issueCategories.${c}`)}</option>)}</select>
        </div>
        <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('priority')}</label>
          <div className="htl-seg">{HOTEL_ISSUE_PRIORITIES.map((p) => <button key={p} type="button" className={priority === p ? 'on' : ''} onClick={() => setPriority(p)}>{k(`priorities.${p}`)}</button>)}</div>
        </div>
        <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('description')} *</label><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={k('issuePh')} /></div>
        <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('photos')}</label><PhotoInput value={photos} onChange={setPhotos} /></div>
        {staff && staff.length > 0 && (
          <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('assignee')}</label>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </div>
        )}
        <label className="hk-check" style={{ gridColumn: 'span 2' }}>
          <input type="checkbox" checked={makeOoo} disabled={!unitId} onChange={(e) => setMakeOoo(e.target.checked)} />
          <span><b>{k('makeOoo')}</b><em>{k('makeOooHint')}</em></span>
        </label>
      </div>
    </Sheet>
  );
};

/** Новая находка (PMS-105): владелец подбирается по брони, жившей в номере */
export const LostSheet: React.FC<{ hotels: Hotel[]; hotelId: string; roomUnitId?: string | null; onClose: () => void; onDone: () => void }> = ({
  hotels, hotelId: initialHotel, roomUnitId, onClose, onDone,
}) => {
  const { k, t } = useHk();
  const { showAlert } = useAlertModal();
  const [hotelId, setHotelId] = useState(initialHotel);
  const units = useUnits(hotelId);
  const [unitId, setUnitId] = useState(roomUnitId || '');
  const [category, setCategory] = useState<string>('other');
  const [description, setDescription] = useState('');
  const [foundPlace, setFoundPlace] = useState('');
  const [storage, setStorage] = useState('');
  const [guestName, setGuestName] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const submit = () => {
    if (!description.trim()) { showAlert(k('errors.HOTEL_LOST_DESCRIPTION_REQUIRED'), { variant: 'error' }); return; }
    setBusy(true);
    createLostItem({ hotelId, roomUnitId: unitId || null, category, description: description.trim(), foundPlace, storageLocation: storage, guestName: guestName || null, photoUrls: photos })
      .then((r) => { showAlert(r.guestName ? k('lostCreatedGuest', { name: r.guestName }) : k('lostCreated'), { variant: 'success' }); onDone(); })
      .catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }))
      .finally(() => setBusy(false));
  };
  return (
    <Sheet
      title={k('lostNew')}
      onClose={onClose}
      foot={<><button className="btn" onClick={onClose}>{t('crm.hotels.common.cancel')}</button><button className="btn btn-primary" disabled={busy} onClick={submit}><Ic d={HTL_ICON.check} size={14} />{k('lostSubmit')}</button></>}
    >
      <div className="htl-form" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
        {hotels.length > 1 && (
          <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('hotel')}</label>
            <select value={hotelId} onChange={(e) => { setHotelId(e.target.value); setUnitId(''); }}>{hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
          </div>
        )}
        <div className="htl-f"><label>{k('room')}</label>
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            <option value="">{k('noRoomPublic')}</option>
            {units.map((u) => <option key={u.id} value={u.id}>{unitName(u, k)}</option>)}
          </select>
          <div className="htl-hint">{k('lostGuestHint')}</div>
        </div>
        <div className="htl-f"><label>{k('category')}</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>{HOTEL_LOST_CATEGORIES.map((c) => <option key={c} value={c}>{k(`lostCategories.${c}`)}</option>)}</select>
        </div>
        <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('lostWhat')} *</label><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={k('lostPh')} /></div>
        <div className="htl-f"><label>{k('foundPlace')}</label><input value={foundPlace} onChange={(e) => setFoundPlace(e.target.value)} placeholder={k('foundPlacePh')} /></div>
        <div className="htl-f"><label>{k('storage')}</label><input value={storage} onChange={(e) => setStorage(e.target.value)} placeholder={k('storagePh')} /></div>
        <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('guestOptional')}</label><input value={guestName} onChange={(e) => setGuestName(e.target.value)} /></div>
        <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('photos')}</label><PhotoInput value={photos} onChange={setPhotos} /></div>
      </div>
    </Sheet>
  );
};

/** Снять номер с продажи / в обслуживание на период (PMS-005) */
export const OutageSheet: React.FC<{ hotelId: string; initial?: HotelRoomOutage | null; roomUnitId?: string | null; onClose: () => void; onDone: () => void }> = ({
  hotelId, initial, roomUnitId, onClose, onDone,
}) => {
  const { k, t } = useHk();
  const { showAlert } = useAlertModal();
  const units = useUnits(hotelId);
  const [unitId, setUnitId] = useState(initial?.roomUnitId || roomUnitId || '');
  const [kind, setKind] = useState<'ooo' | 'oos'>(initial?.kind || 'ooo');
  const [dateFrom, setDateFrom] = useState(initial?.dateFrom || todayIso());
  const [dateTo, setDateTo] = useState(initial?.dateTo || '');
  const [reason, setReason] = useState<string>(initial?.reason || 'repair');
  const [note, setNote] = useState(initial?.note || '');
  const [busy, setBusy] = useState(false);
  const submit = () => {
    if (!unitId) { showAlert(k('pickRoom'), { variant: 'error' }); return; }
    setBusy(true);
    const dto = { roomUnitId: unitId, kind, dateFrom, dateTo: dateTo || null, reason, note };
    (initial ? updateOutage(initial.id, dto) : createOutage(dto))
      .then((r) => {
        const warn = conflictText(r.conflicts, k);
        showAlert(warn ? `${k('outageSaved')}. ${warn}` : k('outageSaved'), { variant: warn ? 'error' : 'success' });
        onDone();
      })
      .catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }))
      .finally(() => setBusy(false));
  };
  return (
    <Sheet
      title={initial ? k('outageEdit') : k('outageNew')}
      onClose={onClose}
      foot={<><button className="btn" onClick={onClose}>{t('crm.hotels.common.cancel')}</button><button className="btn btn-primary" disabled={busy} onClick={submit}><Ic d={HTL_ICON.check} size={14} />{t('crm.hotels.common.save')}</button></>}
    >
      <div className="htl-form" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
        <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('room')} *</label>
          <select value={unitId} disabled={!!initial} onChange={(e) => setUnitId(e.target.value)}>
            <option value="">—</option>
            {units.map((u) => <option key={u.id} value={u.id}>{unitName(u, k)}</option>)}
          </select>
        </div>
        <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('outageKind')}</label>
          <div className="htl-seg">
            <button type="button" className={kind === 'ooo' ? 'on' : ''} onClick={() => setKind('ooo')}>{k('kinds.ooo')}</button>
            <button type="button" className={kind === 'oos' ? 'on' : ''} onClick={() => setKind('oos')}>{k('kinds.oos')}</button>
          </div>
          <div className="htl-hint">{k(`kindHints.${kind}`)}</div>
        </div>
        <div className="htl-f"><label>{k('from')}</label><DateInput value={dateFrom} onChange={(v) => setDateFrom(v)} /></div>
        <div className="htl-f"><label>{k('to')}</label><DateInput value={dateTo} min={dateFrom} onChange={(v) => setDateTo(v)} /><div className="htl-hint">{k('toHint')}</div></div>
        <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('reason')}</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)}>{HOTEL_OUTAGE_REASONS.map((r) => <option key={r} value={r}>{k(`outageReasons.${r}`)}</option>)}</select>
        </div>
        <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('note')}</label><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
    </Sheet>
  );
};
