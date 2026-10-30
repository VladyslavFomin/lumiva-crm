import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { HotelsSubnav } from './HotelsSubnav';
import { Ic, HTL_ICON } from './HotelIcons';
import { hotelErrorText } from './ReservationLifecycle';
import { useHotelLive } from './useHotelLive';
import {
  createGuestRequest,
  fetchGuestQrLinks,
  fetchGuestRequests,
  fetchHotels,
  fetchRoomUnits,
  rotateGuestQr,
  updateGuestRequest,
  updateHotel,
  type Hotel,
  type HotelGuestRequest,
  type HotelGuestRequestCategory,
  type HotelRoomUnit,
} from '../../api/hotels';
import './hotels-design.css';

const CATS: HotelGuestRequestCategory[] = ['towels', 'cleaning', 'amenities', 'minibar', 'maintenance', 'noise', 'other'];

/** Минуты с момента заявки: «5 мин», «2 ч 10 мин» */
function ago(iso: string, t: (k: string, o?: Record<string, unknown>) => string) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  return m < 60 ? t('crm.hotels.guestCare.minAgo', { m }) : t('crm.hotels.guestCare.hAgo', { h: Math.floor(m / 60), m: m % 60 });
}

/** Guest Care для персонала: заявки гостей (QR, WhatsApp, со слов гостя), QR-коды номеров, настройка WhatsApp */
export const HotelGuestCarePage: React.FC = () => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.guestCare.${key}`, o);
  const { showAlert, showConfirm } = useAlertModal();
  const [sp, setSp] = useSearchParams();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const hotelId = sp.get('hotelId') || hotels[0]?.id || '';
  const tab = sp.get('tab') === 'qr' ? 'qr' : 'requests';
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open');
  const [data, setData] = useState<{ requests: HotelGuestRequest[]; staff: Array<{ id: string; name: string }> } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const hotel = hotels.find((h) => h.id === hotelId);

  useEffect(() => { fetchHotels().then(setHotels).catch(() => setHotels([])); }, []);
  const load = useCallback(() => {
    if (!hotelId) return Promise.resolve();
    return fetchGuestRequests({ hotelId, status: filter === 'all' ? undefined : filter === 'open' ? 'open' : 'done', days: filter === 'open' ? 30 : 7 })
      .then((d) => { setData(d); setFailed(null); })
      .catch((e) => setFailed(e.message));
  }, [hotelId, filter]);
  useEffect(() => { setData(null); void load(); }, [load]);
  // новые заявки гостей появляются сразу у всех
  useHotelLive(['request'], () => void load(), 300);
  // «сколько ждёт» обновляем раз в минуту
  const [, tick] = useState(0);
  useEffect(() => { const id = window.setInterval(() => tick((x) => x + 1), 60_000); return () => window.clearInterval(id); }, []);

  const act = (r: HotelGuestRequest, dto: Parameters<typeof updateGuestRequest>[1]) =>
    updateGuestRequest(r.id, dto).then(() => load()).catch((e) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' }));
  const staffName = (id: string | null) => (id ? data?.staff.find((s) => s.id === id)?.name || '—' : '');
  const counts = useMemo(() => {
    const list = data?.requests || [];
    return { new: list.filter((r) => r.status === 'new').length, work: list.filter((r) => r.status === 'in_progress').length };
  }, [data]);

  return (
    <MainLayout>
      <PageHelpButton topic="hotelGuestCare" />
      <div className="px-scope">
        <HotelsSubnav active="guestCare" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{k('kicker', { n: counts.new, w: counts.work })}</div>
            <h1>{k('title')}</h1>
            <p className="sub">{k('subtitle')}</p>
          </div>
          <div className="htl-hero-r">
            <button type="button" className="btn btn-primary" disabled={!hotelId} onClick={() => setAdding(true)}><Ic d={HTL_ICON.plus} size={13} />{k('add')}</button>
          </div>
        </div>
        <div className="htl-toolbar">
          <select className="htl-select" value={hotelId} onChange={(e) => setSp({ hotelId: e.target.value, tab })}>
            {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <div className="bk-savedviews" style={{ flex: 'none' }}>
            <div className={`bk-sv-tab${tab === 'requests' ? ' active' : ''}`} onClick={() => setSp({ hotelId, tab: 'requests' })}>{k('tabRequests')}</div>
            <div className={`bk-sv-tab${tab === 'qr' ? ' active' : ''}`} onClick={() => setSp({ hotelId, tab: 'qr' })}>{k('tabQr')}</div>
          </div>
          {tab === 'requests' && (
            <div className="htl-seg">
              {(['open', 'done', 'all'] as const).map((f) => <button key={f} type="button" className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{k(`filter.${f}`)}</button>)}
            </div>
          )}
        </div>

        {tab === 'qr' ? (
          hotel && <QrTab hotel={hotel} onHotel={(h) => setHotels((list) => list.map((x) => (x.id === h.id ? { ...x, ...h } : x)))} />
        ) : failed ? (
          <div className="htl-empty"><h4>{k('loadError')}</h4><p>{failed}</p></div>
        ) : !data ? (
          <div className="htl-rack-skel">{[0, 1, 2].map((i) => <div key={i} />)}</div>
        ) : !data.requests.length ? (
          <div className="htl-empty"><h4>{k(filter === 'open' ? 'emptyOpen' : 'empty')}</h4><p>{k('emptyHint')}</p></div>
        ) : (
          <div className="gc-list">
            {data.requests.map((r) => (
              <div key={r.id} className={`gc-card st-${r.status}`}>
                <div className="gc-top">
                  <span className="gc-no">№{r.number}</span>
                  <b className="gc-room">{r.room ? k('room', { room: r.room }) : k('noRoom')}</b>
                  <span className={`gc-cat c-${r.category}`}>{k(`cat.${r.category}`)}{r.subcategory ? ` · ${t(`crm.hotels.hk.issueCategories.${r.subcategory}`, { defaultValue: r.subcategory })}` : ''}</span>
                  <span className={`gc-src s-${r.source}`}>{k(`src.${r.source}`)}</span>
                  <span className="gc-time" title={new Date(r.createdAt).toLocaleString()}>{r.status === 'done' && r.doneAt ? k('doneIn', { t: ago(r.createdAt, t) }) : ago(r.createdAt, t)}</span>
                </div>
                {r.text && <div className="gc-text">{r.text}</div>}
                <div className="gc-meta">
                  {r.guestName && <span>{r.guestName}</span>}
                  {r.lang && <span>{r.lang.toUpperCase()}</span>}
                  {r.maintenanceIssueId && <span>{k('issueLinked')}</span>}
                </div>
                <div className="gc-actions">
                  <select value={r.assigneeUserId || ''} onChange={(e) => act(r, { assigneeUserId: e.target.value || null })} disabled={r.status === 'done' || r.status === 'cancelled'}>
                    <option value="">{k('unassigned')}</option>
                    {data.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {r.status === 'new' && <button type="button" className="btn btn-sm" onClick={() => act(r, { status: 'in_progress' })}>{k('start')}</button>}
                  {(r.status === 'new' || r.status === 'in_progress') && <button type="button" className="btn btn-sm btn-primary" onClick={() => act(r, { status: 'done' })}>{k('done')}</button>}
                  {(r.status === 'new' || r.status === 'in_progress') && (
                    <button type="button" className="btn btn-sm" onClick={async () => { if (await showConfirm(k('cancelBody'), { title: k('cancel'), confirmLabel: k('cancel') })) void act(r, { status: 'cancelled' }); }}>{k('cancel')}</button>
                  )}
                  {(r.status === 'done' || r.status === 'cancelled') && <button type="button" className="btn btn-sm" onClick={() => act(r, { status: 'new' })}>{k('reopen')}</button>}
                  {r.assigneeUserId && r.status === 'in_progress' && <span className="htl-sub">{k('inWork', { name: staffName(r.assigneeUserId) })}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {adding && hotel && <AddRequestDialog hotel={hotel} onClose={() => setAdding(false)} onDone={() => { setAdding(false); void load(); }} />}
    </MainLayout>
  );
};

const AddRequestDialog: React.FC<{ hotel: Hotel; onClose: () => void; onDone: () => void }> = ({ hotel, onClose, onDone }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.guestCare.${key}`, o);
  const { showAlert } = useAlertModal();
  const [units, setUnits] = useState<HotelRoomUnit[]>([]);
  const [unitId, setUnitId] = useState('');
  const [category, setCategory] = useState<HotelGuestRequestCategory>('towels');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetchRoomUnits({ hotelId: hotel.id }).then((u) => setUnits(u.filter((x) => x.active))).catch(() => setUnits([])); }, [hotel.id]);
  const save = () => {
    setBusy(true);
    createGuestRequest({ hotelId: hotel.id, roomUnitId: unitId || null, category, text })
      .then(onDone)
      .catch((e) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' }))
      .finally(() => setBusy(false));
  };
  return createPortal(
    <div className="px-scope">
      <div className="lv-backdrop bk-modal-back" onClick={onClose} />
      <div className="bk-modal narrow" role="dialog" aria-modal="true">
        <div className="bk-modal-head">
          <h3>{k('addTitle')}</h3>
          <button type="button" onClick={onClose} aria-label={k('close')}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="bk-modal-body">
          <label>{k('roomLabel')}</label>
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            <option value="">{k('noRoom')}</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
          <label>{k('catLabel')}</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as HotelGuestRequestCategory)}>
            {CATS.map((c) => <option key={c} value={c}>{k(`cat.${c}`)}</option>)}
          </select>
          <label>{k('textLabel')}</label>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={k('textPh')} />
          {category === 'maintenance' && <div className="htl-hint">{k('maintHint')}</div>}
        </div>
        <div className="bk-modal-foot">
          <button type="button" className="btn" onClick={onClose}>{k('close')}</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{k('addSave')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/** QR-коды номеров: печать наклеек, замена ссылки; настройка «WhatsApp → заявки» */
const QrTab: React.FC<{ hotel: Hotel; onHotel: (h: Partial<Hotel> & { id: string }) => void }> = ({ hotel, onHotel }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.guestCare.${key}`, o);
  const { showAlert, showConfirm } = useAlertModal();
  const [links, setLinks] = useState<Array<{ roomUnitId: string; label: string; floor: string | null; token: string; img?: string }>>([]);
  const origin = window.location.origin;
  const load = useCallback(async () => {
    const list = await fetchGuestQrLinks(hotel.id);
    const withImg = await Promise.all(list.map(async (l) => ({ ...l, img: await QRCode.toDataURL(`${origin}/g/${l.token}`, { margin: 1, width: 220 }) })));
    setLinks(withImg);
  }, [hotel.id, origin]);
  useEffect(() => { load().catch((e) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' })); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleWa = (v: boolean) =>
    updateHotel(hotel.id, { guestCareWhatsapp: v } as Partial<Hotel>)
      .then(() => { onHotel({ id: hotel.id, guestCareWhatsapp: v } as Partial<Hotel> & { id: string }); showAlert(k('saved'), { variant: 'success' }); })
      .catch((e) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' }));
  return (
    <>
      <div className="htl-panel gc-noprint">
        <label className="gc-wa">
          <input type="checkbox" checked={!!hotel.guestCareWhatsapp} onChange={(e) => toggleWa(e.target.checked)} />
          <span><b>{k('waTitle')}</b><br /><span className="htl-sub">{k('waHint')}</span></span>
        </label>
      </div>
      <div className="htl-panel">
        <div className="gc-qr-head gc-noprint">
          <div>
            <h3 className="htl-h3">{k('qrTitle')}</h3>
            <p className="htl-sub">{k('qrHint')}</p>
          </div>
          <button type="button" className="btn" onClick={() => window.print()}>{k('print')}</button>
        </div>
        <div className="gc-qr-grid">
          {links.map((l) => (
            <div key={l.roomUnitId} className="gc-qr">
              <div className="gc-qr-hotel">{hotel.name}</div>
              {l.img && <img src={l.img} alt={l.label} />}
              <div className="gc-qr-room">{k('room', { room: l.label })}</div>
              <div className="gc-qr-cta">{k('qrCta')}</div>
              <div className="gc-qr-tools gc-noprint">
                <a href={`${origin}/g/${l.token}`} target="_blank" rel="noreferrer">{k('open')}</a>
                <button
                  type="button"
                  onClick={async () => {
                    if (!(await showConfirm(k('rotateBody', { room: l.label }), { title: k('rotate'), confirmLabel: k('rotate') }))) return;
                    rotateGuestQr(l.roomUnitId).then(() => load()).catch((e) => showAlert(hotelErrorText(t, e, k('error')), { variant: 'error' }));
                  }}
                >
                  {k('rotate')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default HotelGuestCarePage;
