import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { Ic, BK_ICON } from './BookingIcons';
import {
  fetchBookingLocations,
  fetchBookingResources,
  createBookingResource,
  updateBookingResource,
  deleteBookingResource,
  fetchBookingProject,
  type BookingLocation,
  type BookingResourceItem,
} from '../../api/bookings';
import { fetchRentalTimeline, fetchVerticalSettings, type RentalTimeline } from '../../api/bookingVerticals';
import { RentalNewModal } from './RentalNewModal';
import { BkModal, EmptyState, errMsg, fmtMoney, fmtTime, useDateLocale, ymdLocal, addDays } from './verticalUi';
import './bookings-design.css';
import './bookings-verticals.css';

const TYPES = ['equipment', 'vehicle', 'hall', 'room', 'parking', 'other'];
type Edit = { id?: string; name: string; type: string; locationId: string; quantity: string; pricePerHour: string; pricePerDay: string; depositAmount: string; sku: string; description: string; active: boolean };
const numOrNull = (v: string) => (v.trim() === '' ? null : String(Math.max(0, Number(v) || 0)));

export const RentalInventoryPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();
  const locale = useDateLocale();
  const [tab, setTab] = useState<'timeline' | 'items'>('timeline');
  const [resources, setResources] = useState<BookingResourceItem[]>([]);
  const [locations, setLocations] = useState<BookingLocation[]>([]);
  const [currency, setCurrency] = useState('RUB');
  const [rentalUnit, setRentalUnit] = useState<'hour' | 'day'>('hour');
  const [from, setFrom] = useState(ymdLocal(new Date()));
  const [days, setDays] = useState(14);
  const [tl, setTl] = useState<RentalTimeline | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [newRental, setNewRental] = useState<{ resourceId: string; start?: Date } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadResources = () => fetchBookingResources().then((r) => setResources(r.filter((x) => x.type !== 'table'))).catch(() => undefined);
  const loadTimeline = () => fetchRentalTimeline({ from, days }).then(setTl).catch((e) => showAlert(errMsg(e, t('crm.bookings.v.common.loadError')), { variant: 'error' }));

  useEffect(() => {
    loadResources();
    fetchBookingLocations().then(setLocations).catch(() => undefined);
    fetchBookingProject().then((p) => setCurrency(p.currency)).catch(() => undefined);
    fetchVerticalSettings().then((s) => setRentalUnit(s.rentalUnit)).catch(() => undefined);
  }, []);
  useEffect(() => {
    loadTimeline();
  }, [from, days]); // eslint-disable-line react-hooks/exhaustive-deps

  const openEdit = (r?: BookingResourceItem) =>
    setEdit({
      id: r?.id,
      name: r?.name || '',
      type: r?.type || 'equipment',
      locationId: r?.locationId || locations[0]?.id || '',
      quantity: String(r?.quantity ?? 1),
      pricePerHour: r?.pricePerHour ?? '',
      pricePerDay: r?.pricePerDay ?? '',
      depositAmount: r?.depositAmount ?? '',
      sku: r?.sku || '',
      description: r?.description || '',
      active: r?.active ?? true,
    });

  const save = async () => {
    if (!edit?.name.trim() || !edit.locationId) return;
    setBusy(true);
    const dto: Partial<BookingResourceItem> = {
      name: edit.name.trim(),
      type: edit.type,
      locationId: edit.locationId,
      quantity: Math.max(1, Number(edit.quantity) || 1),
      pricePerHour: numOrNull(edit.pricePerHour),
      pricePerDay: numOrNull(edit.pricePerDay),
      depositAmount: numOrNull(edit.depositAmount),
      sku: edit.sku.trim() || null,
      description: edit.description.trim() || null,
      active: edit.active,
    };
    try {
      if (edit.id) await updateBookingResource(edit.id, dto);
      else await createBookingResource(dto);
      setEdit(null);
      loadResources();
      loadTimeline();
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: BookingResourceItem) => {
    if (!(await showConfirm(t('crm.bookings.v.inventory.deleteConfirm', { name: r.name }), { danger: true }))) return;
    try {
      await deleteBookingResource(r.id);
      loadResources();
      loadTimeline();
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    }
  };

  const level = (used: number, q: number) => (used <= 0 ? 'l0' : used >= q ? 'l3' : used / q >= 0.6 ? 'l2' : 'l1');
  const today = ymdLocal(new Date());

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="inventory" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.bookings.v.inventory.kicker')}</div>
            <h1>{t('crm.bookings.v.inventory.title')}</h1>
            <p className="sub">{t('crm.bookings.v.inventory.subtitle')}</p>
          </div>
          <div className="bk-hero-r">
            <button className="btn btn-primary btn-sm" disabled={!locations.length} onClick={() => openEdit()}><Ic d={BK_ICON.plus} size={13} /> {t('crm.bookings.v.inventory.add')}</button>
          </div>
        </div>

        <div className="bk-tabs" style={{ marginTop: 14 }}>
          <div className={`bk-tab${tab === 'timeline' ? ' active' : ''}`} onClick={() => setTab('timeline')}>{t('crm.bookings.v.inventory.tabTimeline')}</div>
          <div className={`bk-tab${tab === 'items' ? ' active' : ''}`} onClick={() => setTab('items')}>{t('crm.bookings.v.inventory.tabItems')} · {resources.length}</div>
        </div>

        {tab === 'timeline' && (
          <>
            <div className="fl-toolbar" style={{ marginTop: 0 }}>
              <div className="bk-seg">
                <button onClick={() => setFrom(ymdLocal(addDays(new Date(`${from}T12:00:00`), -days)))}>←</button>
                <button onClick={() => setFrom(ymdLocal(new Date()))}>{t('crm.bookings.v.common.today')}</button>
                <button onClick={() => setFrom(ymdLocal(addDays(new Date(`${from}T12:00:00`), days)))}>→</button>
              </div>
              <div className="bk-seg">
                {[7, 14, 30].map((d) => <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{t('crm.bookings.v.inventory.daysN', { count: d })}</button>)}
              </div>
              <div style={{ flex: 1 }} />
              <div className="fl-legend">
                <span><i style={{ borderColor: '#c5e3d2', background: '#eaf4ee' }} />{t('crm.bookings.v.inventory.lvlPart')}</span>
                <span><i style={{ borderColor: '#f0d9a8', background: '#fbf2dc' }} />{t('crm.bookings.v.inventory.lvlHigh')}</span>
                <span><i style={{ borderColor: '#f0c8cf', background: '#fbecef' }} />{t('crm.bookings.v.inventory.lvlFull')}</span>
              </div>
            </div>
            {!tl || tl.resources.length === 0 ? (
              <div className="bk-panel"><EmptyState title={t('crm.bookings.v.inventory.empty')} text={t('crm.bookings.v.inventory.emptyText')} action={<button className="btn btn-primary btn-sm" disabled={!locations.length} onClick={() => openEdit()}>{t('crm.bookings.v.inventory.add')}</button>} /></div>
            ) : (
              <div className="rt-wrap">
                <table className="rt-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', paddingLeft: 12, position: 'sticky', left: 0, zIndex: 2 }}>{t('crm.bookings.v.rental.item')}</th>
                      {tl.days.map((d) => <th key={d} className={d === today ? 'today' : ''}>{new Date(`${d}T12:00:00`).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })}<br />{new Date(`${d}T12:00:00`).toLocaleDateString(locale, { weekday: 'short' })}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {tl.resources.map((r) => (
                      <tr key={r.id}>
                        <td className="nm">
                          <div style={{ fontWeight: 500 }}>{r.name}</div>
                          <div className="s">{r.quantity} {t('crm.bookings.v.rental.pcs')}{r.pricePerHour ? ` · ${fmtMoney(r.pricePerHour, currency, locale)}/${t('crm.bookings.v.inventory.hourShort')}` : ''}{r.pricePerDay ? ` · ${fmtMoney(r.pricePerDay, currency, locale)}/${t('crm.bookings.v.inventory.dayShort')}` : ''}</div>
                        </td>
                        {r.cells.map((c) => (
                          <td key={c.date}>
                            <div
                              className={`rt-cell ${level(c.used, r.quantity)}`}
                              title={c.reservations.length ? c.reservations.map((x) => `${x.customerName || '—'} ×${x.units} (${fmtTime(x.startAt, locale)}–${fmtTime(x.endAt, locale)})`).join('\n') : t('crm.bookings.v.inventory.cellFree')}
                              onClick={() => setNewRental({ resourceId: r.id, start: new Date(`${c.date}T10:00:00`) })}
                            >
                              {c.used > 0 ? `${c.used}/${r.quantity}` : ''}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="bk-hint" style={{ marginTop: 8 }}>{t('crm.bookings.v.inventory.timelineHint')}</div>
          </>
        )}

        {tab === 'items' && (
          <div className="bk-table-wrap">
            <table className="bk-table">
              <thead>
                <tr>
                  <th>{t('crm.bookings.v.inventory.colName')}</th>
                  <th>{t('crm.bookings.v.inventory.colType')}</th>
                  <th>{t('crm.bookings.v.inventory.colQty')}</th>
                  <th>{t('crm.bookings.v.inventory.colHour')}</th>
                  <th>{t('crm.bookings.v.inventory.colDay')}</th>
                  <th>{t('crm.bookings.v.inventory.colDeposit')}</th>
                  <th>{t('crm.bookings.v.inventory.colLocation')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {resources.length === 0 && <tr><td colSpan={8} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>{t('crm.bookings.v.inventory.empty')}</td></tr>}
                {resources.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => openEdit(r)} style={{ opacity: r.active ? 1 : 0.5 }}>
                    <td className="cust-cell"><span className="n">{r.name}</span><span className="s">{r.sku || r.description || ''}</span></td>
                    <td>{t(`crm.bookings.v.inventory.type.${r.type}`, { defaultValue: r.type })}</td>
                    <td>{r.quantity}</td>
                    <td className="bk-money">{r.pricePerHour ? fmtMoney(r.pricePerHour, currency, locale) : '—'}</td>
                    <td className="bk-money">{r.pricePerDay ? fmtMoney(r.pricePerDay, currency, locale) : '—'}</td>
                    <td className="bk-money">{r.depositAmount ? fmtMoney(r.depositAmount, currency, locale) : '—'}</td>
                    <td>{locations.find((l) => l.id === r.locationId)?.name || '—'}</td>
                    <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-sm" onClick={() => setNewRental({ resourceId: r.id })}>{t('crm.bookings.v.inventory.rent')}</button>{' '}
                      <button className="bk-x" onClick={() => remove(r)}><Ic d={BK_ICON.trash} size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BkModal open={!!edit} title={edit?.id ? t('crm.bookings.v.inventory.edit') : t('crm.bookings.v.inventory.add')} onClose={() => setEdit(null)}
        footer={<><button className="btn btn-sm" onClick={() => setEdit(null)}>{t('crm.bookings.v.common.cancel')}</button><button className="btn btn-primary btn-sm" disabled={busy || !edit?.name.trim()} onClick={save}>{t('crm.bookings.v.common.save')}</button></>}>
        {edit && (
          <>
            <div className="bk-row2">
              <div className="bk-field"><label>{t('crm.bookings.v.inventory.colName')}</label><input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder={t('crm.bookings.v.inventory.namePh')} /></div>
              <div className="bk-field"><label>{t('crm.bookings.v.inventory.colType')}</label>
                <select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })}>{TYPES.map((x) => <option key={x} value={x}>{t(`crm.bookings.v.inventory.type.${x}`)}</option>)}</select>
              </div>
            </div>
            <div className="bk-row3">
              <div className="bk-field"><label>{t('crm.bookings.v.inventory.colQty')}</label><input type="number" min={1} value={edit.quantity} onChange={(e) => setEdit({ ...edit, quantity: e.target.value })} /></div>
              <div className="bk-field"><label>{t('crm.bookings.v.inventory.sku')}</label><input value={edit.sku} onChange={(e) => setEdit({ ...edit, sku: e.target.value })} /></div>
              <div className="bk-field"><label>{t('crm.bookings.v.inventory.colLocation')}</label>
                <select value={edit.locationId} onChange={(e) => setEdit({ ...edit, locationId: e.target.value })}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
              </div>
            </div>
            <div className="bk-row3">
              <div className="bk-field"><label>{t('crm.bookings.v.inventory.colHour')}, {currency}</label><input type="number" min={0} step="0.01" value={edit.pricePerHour} onChange={(e) => setEdit({ ...edit, pricePerHour: e.target.value })} /></div>
              <div className="bk-field"><label>{t('crm.bookings.v.inventory.colDay')}, {currency}</label><input type="number" min={0} step="0.01" value={edit.pricePerDay} onChange={(e) => setEdit({ ...edit, pricePerDay: e.target.value })} /></div>
              <div className="bk-field"><label>{t('crm.bookings.v.inventory.colDeposit')}, {currency}</label><input type="number" min={0} step="0.01" value={edit.depositAmount} onChange={(e) => setEdit({ ...edit, depositAmount: e.target.value })} /></div>
            </div>
            <div className="bk-field"><label>{t('crm.bookings.v.inventory.description')}</label><textarea rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
            <label className="bk-check"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> {t('crm.bookings.v.inventory.activeItem')}</label>
            <div className="bk-hint">{t('crm.bookings.v.inventory.priceHint')}</div>
          </>
        )}
      </BkModal>

      <RentalNewModal open={!!newRental} resources={resources.filter((r) => r.active)} defaultResourceId={newRental?.resourceId} defaultStart={newRental?.start} rentalUnit={rentalUnit} onClose={() => setNewRental(null)} onCreated={() => loadTimeline()} />
    </MainLayout>
  );
};
