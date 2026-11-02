import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { Ic, BK_ICON } from './BookingIcons';
import { fetchBookingResources, fetchReservation, type BookingResourceItem, type Reservation } from '../../api/bookings';
import { fetchRentalDesk, fetchVerticalSettings, type RentalDesk, type RentalDeskRow } from '../../api/bookingVerticals';
import { RentalPanel, ReservationOrdersPanel } from './verticalPanels';
import { RentalNewModal } from './RentalNewModal';
import { BkDrawer, MiniKpi, errMsg, fmtDate, fmtMoney, fmtTime, useDateLocale, ymdLocal, addDays } from './verticalUi';
import './bookings-design.css';
import './bookings-verticals.css';

export const RentalDeskPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const locale = useDateLocale();
  const [date, setDate] = useState(ymdLocal(new Date()));
  const [desk, setDesk] = useState<RentalDesk | null>(null);
  const [resources, setResources] = useState<BookingResourceItem[]>([]);
  const [rentalUnit, setRentalUnit] = useState<'hour' | 'day'>('hour');
  const [newOpen, setNewOpen] = useState(false);
  const [open, setOpen] = useState<Reservation | null>(null);

  const load = () =>
    fetchRentalDesk(date)
      .then(setDesk)
      .catch((e) => showAlert(errMsg(e, t('crm.bookings.v.common.loadError')), { variant: 'error' }));

  useEffect(() => {
    load();
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchBookingResources().then((r) => setResources(r.filter((x) => x.type !== 'table' && x.active))).catch(() => undefined);
    fetchVerticalSettings().then((s) => setRentalUnit(s.rentalUnit)).catch(() => undefined);
  }, []);

  const openRow = (id: string) => fetchReservation(id).then(setOpen).catch(() => undefined);
  const resName = (id: string | null) => desk?.resources.find((r) => r.id === id)?.name || resources.find((r) => r.id === id)?.name || '—';
  const cur = desk?.currency || 'RUB';

  const row = (r: RentalDeskRow, kind: 'pickup' | 'return' | 'overdue') => (
    <div key={r.id} className="dk-row" style={{ cursor: 'pointer' }} onClick={() => openRow(r.id)}>
      <div style={{ minWidth: 0 }}>
        <div className="n">{resName(r.resourceId)}{(r.units || 1) > 1 ? ` ×${r.units}` : ''}</div>
        <div className="s">{r.customerName || r.customerPhone || '—'} · {kind === 'pickup' ? fmtTime(r.startAt, locale) : `${fmtDate(r.endAt, locale)} ${fmtTime(r.endAt, locale)}`}</div>
        {kind !== 'pickup' && r.lateEstimate && r.lateEstimate.fee > 0 && <div className="s late">{t('crm.bookings.v.rental.lateEst', { label: r.lateEstimate.label, fee: fmtMoney(r.lateEstimate.fee, cur, locale) })}</div>}
      </div>
      <span className="bk-hint">{kind === 'pickup' ? t('crm.bookings.v.rental.toIssue') : t('crm.bookings.v.rental.toAccept')} →</span>
    </div>
  );

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="desk" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.bookings.v.rental.deskKicker')}</div>
            <h1>{t('crm.bookings.v.rental.deskTitle')}</h1>
            <p className="sub">{t('crm.bookings.v.rental.deskSubtitle')}</p>
          </div>
          <div className="bk-hero-r">
            <button className="btn btn-sm" onClick={() => navigate('/bookings/inventory')}>{t('crm.bookings.v.rental.toInventory')}</button>
            <button className="btn btn-primary btn-sm" disabled={!resources.length} onClick={() => setNewOpen(true)}><Ic d={BK_ICON.plus} size={13} /> {t('crm.bookings.v.rental.newTitle')}</button>
          </div>
        </div>

        <div className="fl-toolbar">
          <div className="bk-seg">
            <button onClick={() => setDate(ymdLocal(addDays(new Date(`${date}T12:00:00`), -1)))}>←</button>
            <button onClick={() => setDate(ymdLocal(new Date()))}>{t('crm.bookings.v.common.today')}</button>
            <button onClick={() => setDate(ymdLocal(addDays(new Date(`${date}T12:00:00`), 1)))}>→</button>
          </div>
          <input className="bk-select" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {desk && (
          <>
            <div className="bk-mini-kpis">
              <MiniKpi label={t('crm.bookings.v.rental.kpiPickups')} value={desk.pickups.length} />
              <MiniKpi label={t('crm.bookings.v.rental.kpiReturns')} value={desk.returns.length} />
              <MiniKpi label={t('crm.bookings.v.rental.kpiOverdue')} value={desk.overdue.length} tone={desk.overdue.length ? 'bad' : undefined} />
              <MiniKpi label={t('crm.bookings.v.rental.kpiOut')} value={t('crm.bookings.v.rental.kpiOutValue', { rentals: desk.outNow, units: desk.unitsOut })} />
              <MiniKpi label={t('crm.bookings.v.rental.kpiDeposits')} value={fmtMoney(desk.depositsHeld, cur, locale)} />
            </div>
            <div className="dk-cols">
              <div className="bk-panel">
                <div className="bk-panel-head"><div className="t">{t('crm.bookings.v.rental.pickups')}</div><span className="bk-hint">{desk.pickups.length}</span></div>
                <div className="bk-panel-body">{desk.pickups.length ? desk.pickups.map((r) => row(r, 'pickup')) : <div className="bk-hint" style={{ padding: '10px 16px' }}>{t('crm.bookings.v.rental.nothing')}</div>}</div>
              </div>
              <div className="bk-panel">
                <div className="bk-panel-head"><div className="t">{t('crm.bookings.v.rental.returns')}</div><span className="bk-hint">{desk.returns.length}</span></div>
                <div className="bk-panel-body">{desk.returns.length ? desk.returns.map((r) => row(r, 'return')) : <div className="bk-hint" style={{ padding: '10px 16px' }}>{t('crm.bookings.v.rental.nothing')}</div>}</div>
              </div>
              <div className="bk-panel" style={desk.overdue.length ? { borderColor: '#f0c8cf' } : undefined}>
                <div className="bk-panel-head"><div className="t" style={desk.overdue.length ? { color: '#9a1f31' } : undefined}>{t('crm.bookings.v.rental.overdue')}</div><span className="bk-hint">{desk.overdue.length}</span></div>
                <div className="bk-panel-body">{desk.overdue.length ? desk.overdue.map((r) => row(r, 'overdue')) : <div className="bk-hint" style={{ padding: '10px 16px' }}>{t('crm.bookings.v.rental.noOverdue')}</div>}</div>
              </div>
            </div>
          </>
        )}
      </div>

      <BkDrawer open={!!open} width={480} kicker={open ? resName(open.resourceId) : ''} title={open?.customerName || open?.customerPhone || '—'} onClose={() => setOpen(null)}
        footer={open && <button className="btn btn-sm" onClick={() => navigate(`/bookings/reservations/${open.id}`)}>{t('crm.bookings.v.consult.openCard')}</button>}>
        {open && (
          <>
            {open.customerPhone && <div className="bk-info-row"><span className="l">{t('crm.bookings.v.common.phone')}</span><span className="v">{open.customerPhone}</span></div>}
            <div style={{ marginTop: 10 }}><RentalPanel reservation={open} currency={cur} onChanged={() => { openRow(open.id); load(); }} /></div>
            <div style={{ marginTop: 12 }}><ReservationOrdersPanel key={`${open.id}-${open.updatedAt}`} reservation={open} /></div>
          </>
        )}
      </BkDrawer>

      <RentalNewModal open={newOpen} resources={resources} rentalUnit={rentalUnit} defaultStart={date !== ymdLocal(new Date()) ? new Date(`${date}T10:00:00`) : undefined} onClose={() => setNewOpen(false)} onCreated={(id) => { load(); openRow(id); }} />
    </MainLayout>
  );
};
