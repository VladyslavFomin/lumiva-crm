import React, { useCallback, useEffect, useState } from 'react';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { Ic, HTL_ICON } from '../HotelIcons';
import { hotelErrorText } from '../ReservationLifecycle';
import { fmtDate, todayIso } from '../partners/partnerUtils';
import { IssueSheet, LostSheet, useHk } from './HkShared';
import { fetchHotels, fetchMyHkTasks, hkTaskAction, type Hotel, type HotelHkTask } from '../../../api/hotels';
import '../hotels-design.css';
import { useHotelLive } from '../useHotelLive';
import { fetchMyGuestRequests, updateGuestRequest, type HotelGuestRequest } from '../../../api/hotels';

/** Экран горничной (PMS-102): мои номера на сегодня, смена статуса одним касанием, поломка и находка с фото */
export const HotelMyHousekeepingPage: React.FC = () => {
  const { k, t, lang } = useHk();
  const { showAlert, showPrompt } = useAlertModal();
  const [tasks, setTasks] = useState<HotelHkTask[] | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ kind: 'issue' | 'lost'; unitId: string | null; hotelId: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const today = todayIso();

  const load = useCallback(() => fetchMyHkTasks(today).then((r) => { setTasks(r.tasks); setFailed(null); }).catch((e) => setFailed(e.message)), [today]);
  useEffect(() => { void load(); fetchHotels().then(setHotels).catch(() => setHotels([])); }, [load]);
  // заявки гостей (полотенца, уборка…) — свои и никому не назначенные
  const [requests, setRequests] = useState<HotelGuestRequest[]>([]);
  const loadRequests = useCallback(() => fetchMyGuestRequests().then(setRequests).catch(() => setRequests([])), []);
  useEffect(() => { void loadRequests(); }, [loadRequests]);
  useHotelLive(['request'], () => void loadRequests(), 300);
  const actRequest = (r: HotelGuestRequest, status: 'in_progress' | 'done') =>
    updateGuestRequest(r.id, { status }).then(() => loadRequests()).catch((e) => showAlert(e.message, { variant: 'error' }));
  // новые задачи горничной приходят сразу (план перестроился, заезд, «срочно»)
  const live = useHotelLive(['housekeeping'], () => void load());
  useEffect(() => {
    const id = window.setInterval(() => { if (!document.hidden) void load(); }, live.connected ? 180_000 : 60_000);
    return () => window.clearInterval(id);
  }, [load, live.connected]);

  const act = async (x: HotelHkTask, action: 'start' | 'done' | 'skip' | 'reopen') => {
    let note: string | undefined;
    if (action === 'skip') {
      const v = await showPrompt({ title: k('skipTitle', { room: x.unit?.label }), label: k('skipLabel'), placeholder: k('skipPh'), confirmLabel: k('actions.skip'), cancelLabel: t('crm.hotels.common.cancel') });
      if (v === null) return;
      note = v.trim();
      if (!note) { showAlert(k('errors.HOTEL_HK_SKIP_REASON'), { variant: 'error' }); return; }
    }
    setBusy(x.id);
    hkTaskAction(x.id, action, note)
      .then(() => { if (action === 'done') showAlert(k('roomReady', { room: x.unit?.label }), { variant: 'success' }); return load(); })
      .catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }))
      .finally(() => setBusy(null));
  };

  const open = (tasks || []).filter((x) => x.status === 'pending' || x.status === 'in_progress');
  const closed = (tasks || []).filter((x) => !(x.status === 'pending' || x.status === 'in_progress'));
  const defaultHotel = tasks?.[0]?.hotelId || hotels[0]?.id || '';

  const card = (x: HotelHkTask) => (
    <div key={x.id} className={`hk-card s-${x.status}${x.priority >= 90 ? ' urgent' : ''}`}>
      <div className="top">
        <div className="room">{x.unit?.label}</div>
        <div className="meta">
          <b>{k(`kinds2.${x.kind}`)}</b>
          <span>{[x.unit?.floor ? k('floorShort', { floor: x.unit.floor }) : '', x.unit?.roomTypeName, hotels.length > 1 ? x.hotelName : ''].filter(Boolean).join(' · ')}</span>
        </div>
        <span className={`hk-task s-${x.status}`}>{k(`taskStatus.${x.status}`)}</span>
      </div>
      {(x.earlyCheckIn || x.lateCheckOut || (x.kind === 'departure' && x.departed === false) || x.note) && (
        <div className="tags">
          {x.earlyCheckIn && <span className="warn">{k('earlyArrival')}</span>}
          {x.lateCheckOut && <span>{k('lateDeparture')}</span>}
          {x.kind === 'departure' && x.departed === false && <span className="warn">{k('notYetLeft')}</span>}
          {x.note && <span>{x.note}</span>}
        </div>
      )}
      <div className="acts">
        {x.status === 'pending' && <button className="btn" disabled={busy === x.id} onClick={() => void act(x, 'start')}>{k('actions.start')}</button>}
        {(x.status === 'pending' || x.status === 'in_progress') && <button className="btn btn-primary" disabled={busy === x.id} onClick={() => void act(x, 'done')}><Ic d={HTL_ICON.check} size={16} />{k('actions.done')}</button>}
        {(x.status === 'pending' || x.status === 'in_progress') && <button className="btn" disabled={busy === x.id} onClick={() => void act(x, 'skip')}>{k('actions.skipShort')}</button>}
        {x.status === 'done' && <button className="btn" disabled={busy === x.id} onClick={() => void act(x, 'reopen')}>{k('actions.reopen')}</button>}
        <button className="btn" onClick={() => setSheet({ kind: 'issue', unitId: x.roomUnitId, hotelId: x.hotelId })}>{k('issueShort')}</button>
        <button className="btn" onClick={() => setSheet({ kind: 'lost', unitId: x.roomUnitId, hotelId: x.hotelId })}>{k('lostShort')}</button>
      </div>
    </div>
  );

  return (
    <MainLayout>
      <PageHelpButton topic="hotelMyHousekeeping" />
      <div className="px-scope hk-my">
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{fmtDate(today, lang)}</div>
            <h1>{k('myTitle')}</h1>
            <p className="sub">{tasks ? k('mySubtitle', { open: open.length, done: closed.length }) : ''}</p>
          </div>
        </div>
        <div className="hk-my-actions">
          <button className="btn" disabled={!defaultHotel} onClick={() => setSheet({ kind: 'issue', unitId: null, hotelId: defaultHotel })}>{k('reportIssue')}</button>
          <button className="btn" disabled={!defaultHotel} onClick={() => setSheet({ kind: 'lost', unitId: null, hotelId: defaultHotel })}>{k('lostNew')}</button>
        </div>
        {requests.length > 0 && (
          <div className="hk-my-req">
            <div className="hk-my-sep">{t('crm.hotels.guestCare.myTitle', { count: requests.length })}</div>
            {requests.map((r) => (
              <div key={r.id} className={`gc-card st-${r.status}`}>
                <div className="gc-top">
                  <b className="gc-room">{r.room ? t('crm.hotels.guestCare.room', { room: r.room }) : t('crm.hotels.guestCare.noRoom')}</b>
                  <span className={`gc-cat c-${r.category}`}>{t(`crm.hotels.guestCare.cat.${r.category}`)}</span>
                </div>
                {r.text && <div className="gc-text">{r.text}</div>}
                <div className="gc-actions">
                  {r.status === 'new' && <button type="button" className="btn btn-sm" onClick={() => actRequest(r, 'in_progress')}>{t('crm.hotels.guestCare.start')}</button>}
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => actRequest(r, 'done')}>{t('crm.hotels.guestCare.done')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {failed ? (
          <div className="htl-empty"><h4>{k('loadError')}</h4><p>{failed}</p><button className="btn" onClick={() => void load()}>{t('crm.hotels.rack.retry')}</button></div>
        ) : !tasks ? (
          <div className="htl-rack-skel small">{Array.from({ length: 4 }, (_, i) => <div key={i} />)}</div>
        ) : !tasks.length ? (
          <div className="htl-empty"><h4>{k('myEmpty')}</h4><p>{k('myEmptyHint')}</p></div>
        ) : (
          <>
            <div className="hk-cards">{open.map(card)}</div>
            {closed.length > 0 && (
              <>
                <div className="hk-my-sep">{k('myDone', { count: closed.length })}</div>
                <div className="hk-cards">{closed.map(card)}</div>
              </>
            )}
          </>
        )}
        {sheet?.kind === 'issue' && <IssueSheet hotels={hotels} hotelId={sheet.hotelId} roomUnitId={sheet.unitId} onClose={() => setSheet(null)} onDone={() => setSheet(null)} />}
        {sheet?.kind === 'lost' && <LostSheet hotels={hotels} hotelId={sheet.hotelId} roomUnitId={sheet.unitId} onClose={() => setSheet(null)} onDone={() => setSheet(null)} />}
      </div>
    </MainLayout>
  );
};
