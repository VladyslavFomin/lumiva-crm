import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { Ic, BK_ICON } from './BookingIcons';
import {
  fetchBookingProject,
  fetchBookingResources,
  fetchBookingServices,
  fetchBookingStaff,
  type BookingProject,
  type BookingResourceItem,
  type BookingServiceItem,
  type BookingStaffProfile,
} from '../../api/bookings';
import {
  fetchOrder,
  fetchMenu,
  updateOrder,
  addOrderItem,
  updateOrderItem,
  removeOrderItem,
  billOrder,
  reopenOrder,
  payOrder,
  createOrderPaymentLink,
  cancelOrder,
  type BookingOrder,
  type BookingOrderItem,
  type BookingPaymentMethod,
  type MenuCategory,
  type MenuItem,
} from '../../api/bookingVerticals';
import { useBookingVertical } from './useBookingVertical';
import { BkModal, errMsg, fmtMoney, fmtTime, fmtDate, useDateLocale } from './verticalUi';
import './bookings-design.css';
import './bookings-verticals.css';

const NEXT_ITEM_STATUS: Record<string, BookingOrderItem['status']> = { new: 'cooking', cooking: 'served', served: 'new' };
const METHODS: BookingPaymentMethod[] = ['cash', 'card', 'transfer', 'online'];

export const BookingOrderPage: React.FC = () => {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlertModal();
  const locale = useDateLocale();
  const { type, terms } = useBookingVertical();
  const [order, setOrder] = useState<BookingOrder | null>(null);
  const [project, setProject] = useState<BookingProject | null>(null);
  const [menu, setMenu] = useState<{ categories: MenuCategory[]; items: MenuItem[] }>({ categories: [], items: [] });
  const [services, setServices] = useState<BookingServiceItem[]>([]);
  const [resources, setResources] = useState<BookingResourceItem[]>([]);
  const [staff, setStaff] = useState<BookingStaffProfile[]>([]);
  const [pickTab, setPickTab] = useState<string>('menu');
  const [menuCat, setMenuCat] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [course, setCourse] = useState<number | null>(null);
  const [custom, setCustom] = useState({ name: '', price: '', qty: '1' });
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<BookingPaymentMethod>('cash');
  const [received, setReceived] = useState('');
  const [tip, setTip] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState({ buyerName: '', buyerEmail: '', buyerPhone: '', city: '', address: '' });
  const [noteFor, setNoteFor] = useState<BookingOrderItem | null>(null);
  const [noteText, setNoteText] = useState('');

  const load = () =>
    fetchOrder(id)
      .then(setOrder)
      .catch((e) => showAlert(errMsg(e, t('crm.bookings.v.common.loadError')), { variant: 'error' }));

  useEffect(() => {
    load();
    fetchBookingProject().then(setProject).catch(() => undefined);
    fetchMenu().then(setMenu).catch(() => undefined);
    fetchBookingServices().then(setServices).catch(() => undefined);
    fetchBookingResources().then(setResources).catch(() => undefined);
    fetchBookingStaff().then(setStaff).catch(() => undefined);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPickTab(type === 'restaurant' ? 'menu' : 'services');
  }, [type]);

  const editable = order?.status === 'open' || order?.status === 'billed';
  const items = order?.items || [];
  const cur = order?.currency || project?.currency || 'RUB';

  const act = async (fn: () => Promise<BookingOrder>, ok?: string) => {
    setBusy(true);
    try {
      setOrder(await fn());
      if (ok) showAlert(ok, { variant: 'success' });
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const menuVisible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menu.items.filter((m) => m.active && (menuCat === 'all' || m.categoryId === menuCat) && (!q || m.name.toLowerCase().includes(q)));
  }, [menu, menuCat, search]);
  const servicesVisible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => s.active && (!q || s.name.toLowerCase().includes(q)));
  }, [services, search]);

  const addCustom = () => {
    if (!custom.name.trim() || custom.price === '') return;
    act(() => addOrderItem(id, { kind: 'custom', name: custom.name.trim(), unitPrice: custom.price, qty: Number(custom.qty) || 1 })).then(() => setCustom({ name: '', price: '', qty: '1' }));
  };

  const doPay = async () => {
    if (!order) return;
    if (payMethod === 'online') {
      setPayOpen(false);
      setLink({ buyerName: order.customerName || '', buyerEmail: order.customerEmail || '', buyerPhone: order.customerPhone || '', city: '', address: '' });
      setLinkOpen(true);
      return;
    }
    await act(() => payOrder(id, { method: payMethod, tipAmount: tip === '' ? undefined : tip, amount: received === '' ? undefined : received }), t('crm.bookings.v.order.paidToast'));
    setPayOpen(false);
  };

  const doLink = async () => {
    await act(() => createOrderPaymentLink(id, link), t('crm.bookings.v.order.linkCreated'));
    setLinkOpen(false);
  };

  const print = () => window.print();

  if (!order) {
    return (
      <MainLayout>
        <div className="px-scope"><BookingsSubnav active="orders" /><div className="bk-hint">{t('crm.bookings.v.common.loading')}</div></div>
      </MainLayout>
    );
  }

  const table = order.resourceId ? resources.find((r) => r.id === order.resourceId) : null;
  const staffName = (sid: string | null) => staff.find((s) => s.staffUserId === sid)?.staffUser?.fullName || '';
  const totalNum = Number(order.total) + (tip !== '' && Number(tip) !== Number(order.tipAmount) ? Number(tip) - Number(order.tipAmount) : 0);
  const change = received !== '' ? Number(received) - totalNum : 0;
  const courses = Array.from(new Set(items.map((i) => i.course).filter((c): c is number => c != null))).sort();

  const lineRow = (i: BookingOrderItem) => {
    const sum = Number(i.unitPrice) * Number(i.qty);
    return (
      <div key={i.id} className={`or-line${i.status === 'void' ? ' void' : ''}`}>
        <div style={{ minWidth: 0 }}>
          <div className="nm">{i.name}</div>
          <div className="sub">
            <span className="bk-money">{fmtMoney(i.unitPrice, cur, locale)}</span>
            {i.kind === 'menu' && i.status !== 'void' && (
              <span className={`or-st ${i.status}`} onClick={() => editable && act(() => updateOrderItem(id, i.id, { status: NEXT_ITEM_STATUS[i.status] }))}>{t(`crm.bookings.v.order.itemStatus.${i.status}`)}</span>
            )}
            {i.status === 'void' && <span className="or-st">{t('crm.bookings.v.order.itemStatus.void')}</span>}
            {i.course != null && <span className="or-st">{t('crm.bookings.v.order.courseN', { n: i.course })}</span>}
            {i.note && <span style={{ fontStyle: 'italic' }}>«{i.note}»</span>}
            {editable && i.status !== 'void' && <a style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { setNoteFor(i); setNoteText(i.note || ''); }}>{t('crm.bookings.v.order.note')}</a>}
          </div>
        </div>
        {editable && i.status !== 'void' ? (
          <div className="or-qty">
            <button onClick={() => (Number(i.qty) <= 1 ? act(() => removeOrderItem(id, i.id)) : act(() => updateOrderItem(id, i.id, { qty: Number(i.qty) - 1 })))}>−</button>
            <span>{Number(i.qty)}</span>
            <button onClick={() => act(() => updateOrderItem(id, i.id, { qty: Number(i.qty) + 1 }))}>+</button>
          </div>
        ) : (
          <span className="bk-hint">×{Number(i.qty)}</span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="bk-money" style={{ minWidth: 70, textAlign: 'right' }}>{fmtMoney(sum, cur, locale)}</span>
          {editable && i.status !== 'void' && <button className="bk-x" onClick={() => act(() => removeOrderItem(id, i.id))}><Ic d={BK_ICON.x} size={12} /></button>}
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="orders" />
        <div className="bk-det-head">
          <div>
            <div className="idline">
              <a style={{ cursor: 'pointer' }} onClick={() => navigate('/bookings/orders')}>← {t('crm.bookings.v.order.back')}</a>
              <span>·</span>
              <span>{t(`crm.bookings.v.orders.kind.${order.kind}`)}</span>
              <span className={`bk-badge ord-${order.status}`}>{t(`crm.bookings.v.orders.status.${order.status}`)}</span>
            </div>
            <h1>{t('crm.bookings.v.order.title', { number: order.number })}{table ? ` · ${terms.resource} ${table.name}` : ''}</h1>
            <div className="sub">
              {order.customerName || t('crm.bookings.v.order.guest')}
              {order.customerPhone ? ` · ${order.customerPhone}` : ''}
              {` · ${fmtDate(order.createdAt, locale)} ${fmtTime(order.createdAt, locale)}`}
              {order.reservationId && <> · <a style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/bookings/reservations/${order.reservationId}`)}>{t('crm.bookings.v.order.toReservation')}</a></>}
            </div>
          </div>
          <div className="bk-det-actions">
            <button className="btn btn-sm" onClick={print}>{t('crm.bookings.v.order.print')}</button>
            {order.status === 'open' && <button className="btn btn-sm" disabled={busy || !items.length} onClick={() => act(() => billOrder(id), t('crm.bookings.v.order.billedToast'))}>{t('crm.bookings.v.order.bill')}</button>}
            {order.status === 'billed' && <button className="btn btn-sm" disabled={busy} onClick={() => act(() => reopenOrder(id))}>{t('crm.bookings.v.order.reopen')}</button>}
            {editable && <button className="btn btn-primary btn-sm" disabled={busy || !items.some((i) => i.status !== 'void')} onClick={() => { setTip(String(Number(order.tipAmount) || '')); setReceived(''); setPayMethod('cash'); setPayOpen(true); }}><Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.v.order.pay')}</button>}
            {editable && <button className="btn btn-sm btn-danger" disabled={busy} onClick={async () => { if (await showConfirm(t('crm.bookings.v.order.cancelConfirm'), { danger: true })) act(() => cancelOrder(id)); }}>{t('crm.bookings.v.order.cancel')}</button>}
          </div>
        </div>

        <div className="or-layout">
          <div>
            {editable ? (
              <div className="bk-panel">
                <div className="bk-panel-head" style={{ gap: 10, flexWrap: 'wrap' }}>
                  <div className="bk-seg">
                    {(menu.items.length > 0 || type === 'restaurant') && <button className={pickTab === 'menu' ? 'on' : ''} onClick={() => setPickTab('menu')}>{t('crm.bookings.v.order.tabMenu')}</button>}
                    {services.length > 0 && <button className={pickTab === 'services' ? 'on' : ''} onClick={() => setPickTab('services')}>{terms.servicePlural}</button>}
                    <button className={pickTab === 'custom' ? 'on' : ''} onClick={() => setPickTab('custom')}>{t('crm.bookings.v.order.tabCustom')}</button>
                  </div>
                  {pickTab !== 'custom' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line-2)', borderRadius: 8, padding: '6px 10px', width: 200 }}>
                      <Ic d={BK_ICON.search} size={12} />
                      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('crm.bookings.v.order.searchPick')} style={{ border: 0, outline: 'none', fontSize: 12, width: '100%' }} />
                    </div>
                  )}
                </div>
                {pickTab === 'menu' && (
                  <>
                    <div className="bk-savedviews" style={{ padding: '10px 12px 0', margin: 0 }}>
                      <div className={`bk-sv-tab${menuCat === 'all' ? ' active' : ''}`} onClick={() => setMenuCat('all')}>{t('crm.bookings.v.menu.allItems')}</div>
                      {menu.categories.filter((c) => c.active).map((c) => <div key={c.id} className={`bk-sv-tab${menuCat === c.id ? ' active' : ''}`} onClick={() => setMenuCat(c.id)}>{c.name}</div>)}
                    </div>
                    {type === 'restaurant' && (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '10px 12px 0' }}>
                        <span className="bk-hint">{t('crm.bookings.v.order.course')}:</span>
                        {[null, 1, 2, 3].map((c) => <span key={String(c)} className={`bk-chip${course === c ? ' on' : ''}`} onClick={() => setCourse(c)}>{c == null ? t('crm.bookings.v.order.courseAny') : c}</span>)}
                      </div>
                    )}
                    {menu.items.length === 0 ? (
                      <div className="bk-empty"><div className="t">{t('crm.bookings.v.order.noMenu')}</div><button className="btn btn-sm" onClick={() => navigate('/bookings/menu')}>{t('crm.bookings.v.order.toMenu')}</button></div>
                    ) : (
                      <div className="or-pick-grid">
                        {menuVisible.map((m) => (
                          <button key={m.id} className="or-pick" disabled={busy || !m.available} title={!m.available ? t('crm.bookings.v.menu.stop') : undefined} onClick={() => act(() => addOrderItem(id, { kind: 'menu', refId: m.id, qty: 1, course }))}>
                            <span className="n">{m.name}</span>
                            <span className="p">{fmtMoney(m.price, m.currency, locale)}{m.portion ? ` · ${m.portion}` : ''}{!m.available ? ` · ${t('crm.bookings.v.menu.stop')}` : ''}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {pickTab === 'services' && (
                  <div className="or-pick-grid">
                    {servicesVisible.map((s) => (
                      <button key={s.id} className="or-pick" disabled={busy} onClick={() => act(() => addOrderItem(id, { kind: 'service', refId: s.id, qty: 1 }))}>
                        <span className="n">{s.name}</span>
                        <span className="p">{fmtMoney(s.price, s.currency, locale)} · {t('crm.bookings.v.common.minutesShort', { count: s.durationMinutes })}</span>
                      </button>
                    ))}
                  </div>
                )}
                {pickTab === 'custom' && (
                  <div style={{ padding: 14 }}>
                    <div className="bk-row3">
                      <div className="bk-field" style={{ gridColumn: 'span 1' }}><label>{t('crm.bookings.v.order.customName')}</label><input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} /></div>
                      <div className="bk-field"><label>{t('crm.bookings.v.order.customPrice')}</label><input type="number" step="0.01" value={custom.price} onChange={(e) => setCustom({ ...custom, price: e.target.value })} /></div>
                      <div className="bk-field"><label>{t('crm.bookings.v.order.qty')}</label><input type="number" min={1} value={custom.qty} onChange={(e) => setCustom({ ...custom, qty: e.target.value })} /></div>
                    </div>
                    <button className="btn btn-sm" disabled={busy || !custom.name.trim() || custom.price === ''} onClick={addCustom}><Ic d={BK_ICON.plus} size={12} /> {t('crm.bookings.v.order.addLine')}</button>
                    <div className="bk-hint" style={{ marginTop: 8 }}>{t('crm.bookings.v.order.customHint')}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bk-panel">
                <div className="bk-panel-body" style={{ padding: '14px 18px' }}>
                  {order.status === 'paid' && (
                    <>
                      <div className="bk-info-row"><span className="l">{t('crm.bookings.v.order.paidAt')}</span><span className="v">{order.paidAt ? `${fmtDate(order.paidAt, locale)} ${fmtTime(order.paidAt, locale)}` : '—'}</span></div>
                      <div className="bk-info-row"><span className="l">{t('crm.bookings.v.order.method')}</span><span className="v">{order.paymentMethod ? t(`crm.bookings.v.orders.method.${order.paymentMethod}`) : '—'}</span></div>
                      <div className="bk-info-row"><span className="l">{t('crm.bookings.v.order.paidAmount')}</span><span className="v bk-money">{fmtMoney(order.paidAmount, cur, locale)}</span></div>
                    </>
                  )}
                  {order.status === 'cancelled' && <div className="bk-hint">{t('crm.bookings.v.order.cancelledHint')}</div>}
                  {order.saleId && <div className="bk-hint" style={{ marginTop: 10 }}>{t('crm.bookings.v.order.inSales')} <a style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/sales/${order.saleId}`)}>{t('crm.bookings.v.order.openSale')}</a></div>}
                </div>
              </div>
            )}

            <div className="bk-panel" style={{ marginTop: 14 }}>
              <div className="bk-panel-head"><div className="t">{t('crm.bookings.v.order.details')}</div></div>
              <div className="bk-panel-body" style={{ padding: '12px 18px' }}>
                <div className="bk-row3">
                  <div className="bk-field"><label>{t('crm.bookings.v.common.clientName')}</label><input disabled={!editable} defaultValue={order.customerName || ''} onBlur={(e) => e.target.value !== (order.customerName || '') && act(() => updateOrder(id, { customerName: e.target.value || null }))} /></div>
                  <div className="bk-field"><label>{t('crm.bookings.v.common.phone')}</label><input disabled={!editable} defaultValue={order.customerPhone || ''} onBlur={(e) => e.target.value !== (order.customerPhone || '') && act(() => updateOrder(id, { customerPhone: e.target.value || null }))} /></div>
                  <div className="bk-field"><label>{t('crm.bookings.v.common.email')}</label><input disabled={!editable} defaultValue={order.customerEmail || ''} onBlur={(e) => e.target.value !== (order.customerEmail || '') && act(() => updateOrder(id, { customerEmail: e.target.value || null }))} /></div>
                </div>
                <div className="bk-row3">
                  {type === 'restaurant' && (
                    <div className="bk-field"><label>{t('crm.bookings.v.rbook.guests')}</label><input type="number" min={1} disabled={!editable} defaultValue={order.guests} onBlur={(e) => Number(e.target.value) !== order.guests && act(() => updateOrder(id, { guests: Math.max(1, Number(e.target.value) || 1) }))} /></div>
                  )}
                  <div className="bk-field"><label>{type === 'restaurant' ? t('crm.bookings.v.order.waiter') : t('crm.bookings.v.order.responsible')}</label>
                    <select disabled={!editable} value={order.staffUserId || ''} onChange={(e) => act(() => updateOrder(id, { staffUserId: e.target.value || null }))}>
                      <option value="">—</option>
                      {staff.map((s) => <option key={s.staffUserId} value={s.staffUserId}>{s.staffUser?.fullName || s.staffUserId}</option>)}
                    </select>
                  </div>
                </div>
                <div className="bk-field"><label>{t('crm.bookings.v.order.notes')}</label><textarea rows={2} disabled={!editable} defaultValue={order.notes || ''} onBlur={(e) => e.target.value !== (order.notes || '') && act(() => updateOrder(id, { notes: e.target.value || null }))} /></div>
              </div>
            </div>
          </div>

          <div className="bk-panel">
            <div className="bk-panel-head"><div className="t">{t('crm.bookings.v.order.lines')}</div><span className="bk-hint">{items.filter((i) => i.status !== 'void').length}</span></div>
            {items.length === 0 && <div className="bk-empty">{t('crm.bookings.v.order.noLines')}</div>}
            {courses.length > 0
              ? [...courses, null].map((c) => {
                  const rows = items.filter((i) => (i.course ?? null) === c);
                  if (!rows.length) return null;
                  return (
                    <div key={String(c)}>
                      <div className="bk-hint" style={{ padding: '8px 16px 0', fontFamily: 'var(--ff-mono)', textTransform: 'uppercase', fontSize: 9.5 }}>{c == null ? t('crm.bookings.v.order.courseAny') : t('crm.bookings.v.order.courseN', { n: c })}</div>
                      {rows.map(lineRow)}
                    </div>
                  );
                })
              : items.map(lineRow)}
            <div className="or-tot">
              <div className="r"><span>{t('crm.bookings.v.order.subtotal')}</span><span className="bk-money">{fmtMoney(order.subtotal, cur, locale)}</span></div>
              <div className="r">
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{t('crm.bookings.v.order.discount')}
                  <input type="number" min={0} max={100} disabled={!editable} defaultValue={Number(order.discountPercent)} key={`d-${order.discountPercent}`} onBlur={(e) => Number(e.target.value) !== Number(order.discountPercent) && act(() => updateOrder(id, { discountPercent: e.target.value || '0' }))} style={{ width: 52, padding: '3px 6px', border: '1px solid var(--line-2)', borderRadius: 6, fontSize: 11.5 }} />%
                </span>
                <span className="bk-money">−{fmtMoney(order.discountAmount, cur, locale)}</span>
              </div>
              <div className="r">
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{t('crm.bookings.v.order.serviceCharge')}
                  <input type="number" min={0} max={100} disabled={!editable} defaultValue={Number(order.serviceChargePercent)} key={`s-${order.serviceChargePercent}`} onBlur={(e) => Number(e.target.value) !== Number(order.serviceChargePercent) && act(() => updateOrder(id, { serviceChargePercent: e.target.value || '0' }))} style={{ width: 52, padding: '3px 6px', border: '1px solid var(--line-2)', borderRadius: 6, fontSize: 11.5 }} />%
                </span>
                <span className="bk-money">{fmtMoney(order.serviceChargeAmount, cur, locale)}</span>
              </div>
              {Number(order.tipAmount) > 0 && <div className="r"><span>{t('crm.bookings.v.order.tip')}</span><span className="bk-money">{fmtMoney(order.tipAmount, cur, locale)}</span></div>}
              <div className="r big"><span>{t('crm.bookings.v.order.total')}</span><span className="bk-money">{fmtMoney(order.total, cur, locale)}</span></div>
              {type === 'restaurant' && order.guests > 1 && Number(order.total) > 0 && (
                <div className="r"><span>{t('crm.bookings.v.order.perGuest', { count: order.guests })}</span><span className="bk-money">{fmtMoney(Number(order.total) / order.guests, cur, locale)}</span></div>
              )}
            </div>
            {order.paymentUrl && order.status === 'billed' && (
              <div style={{ padding: '0 16px 14px' }}>
                <div className="bk-hint">{t('crm.bookings.v.order.payLink')}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input readOnly value={order.paymentUrl} style={{ flex: 1, fontSize: 11, padding: '6px 8px', border: '1px solid var(--line-2)', borderRadius: 6 }} />
                  <button className="btn btn-sm" onClick={() => { navigator.clipboard?.writeText(order.paymentUrl!); showAlert(t('crm.bookings.v.common.copied'), { variant: 'success' }); }}>{t('crm.bookings.v.common.copy')}</button>
                </div>
                <div className="bk-hint" style={{ marginTop: 6 }}>{t('crm.bookings.v.order.payLinkHint')}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* печатная форма */}
      <div className="bk-print-area" style={{ position: 'fixed', left: -10000, top: 0 }} aria-hidden>
        <div className="bk-receipt">
          <h2>{project?.name || ''}</h2>
          <div className="c">{order.status === 'paid' ? t('crm.bookings.v.order.receipt') : t('crm.bookings.v.order.precheck')} #{order.number}</div>
          <div className="c">{fmtDate(order.createdAt, locale, { day: '2-digit', month: '2-digit', year: 'numeric' })} {fmtTime(order.createdAt, locale)}</div>
          {table && <div className="c">{terms.resource} {table.name} · {t('crm.bookings.v.common.guests', { count: order.guests })}</div>}
          {order.staffUserId && <div className="c">{staffName(order.staffUserId)}</div>}
          <div className="hr" />
          {items.filter((i) => i.status !== 'void').map((i) => (
            <div key={i.id}>
              <div>{i.name}</div>
              <div className="ln"><span>{Number(i.qty)} × {fmtMoney(i.unitPrice, cur, locale)}</span><span>{fmtMoney(Number(i.unitPrice) * Number(i.qty), cur, locale)}</span></div>
            </div>
          ))}
          <div className="hr" />
          <div className="ln"><span>{t('crm.bookings.v.order.subtotal')}</span><span>{fmtMoney(order.subtotal, cur, locale)}</span></div>
          {Number(order.discountAmount) > 0 && <div className="ln"><span>{t('crm.bookings.v.order.discount')} {Number(order.discountPercent)}%</span><span>−{fmtMoney(order.discountAmount, cur, locale)}</span></div>}
          {Number(order.serviceChargeAmount) > 0 && <div className="ln"><span>{t('crm.bookings.v.order.serviceCharge')} {Number(order.serviceChargePercent)}%</span><span>{fmtMoney(order.serviceChargeAmount, cur, locale)}</span></div>}
          {Number(order.tipAmount) > 0 && <div className="ln"><span>{t('crm.bookings.v.order.tip')}</span><span>{fmtMoney(order.tipAmount, cur, locale)}</span></div>}
          <div className="ln tot"><span>{t('crm.bookings.v.order.total')}</span><span>{fmtMoney(order.total, cur, locale)}</span></div>
          {order.status === 'paid' && order.paymentMethod && <div className="ln"><span>{t(`crm.bookings.v.orders.method.${order.paymentMethod}`)}</span><span>{fmtMoney(order.paidAmount, cur, locale)}</span></div>}
          <div className="hr" />
          <div className="c">{t('crm.bookings.v.order.thanks')}</div>
        </div>
      </div>

      <BkModal
        open={payOpen}
        title={t('crm.bookings.v.order.payTitle', { number: order.number })}
        onClose={() => setPayOpen(false)}
        footer={<><button className="btn btn-sm" onClick={() => setPayOpen(false)}>{t('crm.bookings.v.common.cancel')}</button><button className="btn btn-primary btn-sm" disabled={busy || (received !== '' && change < -0.001)} onClick={doPay}><Ic d={BK_ICON.check} size={13} /> {payMethod === 'online' ? t('crm.bookings.v.order.makeLink') : t('crm.bookings.v.order.confirmPay')}</button></>}
      >
        <div className="bk-field"><label>{t('crm.bookings.v.order.method')}</label>
          <div className="bk-seg">
            {METHODS.map((m) => <button key={m} className={payMethod === m ? 'on' : ''} onClick={() => setPayMethod(m)}>{t(`crm.bookings.v.orders.method.${m}`)}</button>)}
          </div>
        </div>
        {payMethod !== 'online' && (
          <div className="bk-row2">
            <div className="bk-field"><label>{t('crm.bookings.v.order.tip')}</label><input type="number" min={0} step="0.01" value={tip} onChange={(e) => setTip(e.target.value)} /></div>
            {payMethod === 'cash' && <div className="bk-field"><label>{t('crm.bookings.v.order.received')}</label><input type="number" min={0} step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} placeholder={String(totalNum)} /></div>}
          </div>
        )}
        <div className="or-tot" style={{ padding: 0 }}>
          <div className="r big"><span>{t('crm.bookings.v.order.toPay')}</span><span className="bk-money">{fmtMoney(totalNum, cur, locale)}</span></div>
          {payMethod === 'cash' && received !== '' && (
            <div className="r"><span>{change >= 0 ? t('crm.bookings.v.order.change') : t('crm.bookings.v.order.notEnough')}</span><span className="bk-money" style={{ color: change < 0 ? '#cc2f47' : undefined }}>{fmtMoney(Math.abs(change), cur, locale)}</span></div>
          )}
        </div>
        {payMethod === 'online' && <div className="bk-hint" style={{ marginTop: 8 }}>{t('crm.bookings.v.order.onlineHint')}</div>}
      </BkModal>

      <BkModal
        open={linkOpen}
        title={t('crm.bookings.v.order.linkTitle')}
        onClose={() => setLinkOpen(false)}
        footer={<><button className="btn btn-sm" onClick={() => setLinkOpen(false)}>{t('crm.bookings.v.common.cancel')}</button><button className="btn btn-primary btn-sm" disabled={busy || !link.buyerEmail.trim()} onClick={doLink}>{t('crm.bookings.v.order.makeLink')}</button></>}
      >
        <div className="bk-row2">
          <div className="bk-field"><label>{t('crm.bookings.v.order.buyerName')}</label><input value={link.buyerName} onChange={(e) => setLink({ ...link, buyerName: e.target.value })} /></div>
          <div className="bk-field"><label>{t('crm.bookings.v.common.email')}*</label><input value={link.buyerEmail} onChange={(e) => setLink({ ...link, buyerEmail: e.target.value })} /></div>
        </div>
        <div className="bk-row3">
          <div className="bk-field"><label>{t('crm.bookings.v.common.phone')}</label><input value={link.buyerPhone} onChange={(e) => setLink({ ...link, buyerPhone: e.target.value })} /></div>
          <div className="bk-field"><label>{t('crm.bookings.v.order.city')}</label><input value={link.city} onChange={(e) => setLink({ ...link, city: e.target.value })} /></div>
          <div className="bk-field"><label>{t('crm.bookings.v.order.address')}</label><input value={link.address} onChange={(e) => setLink({ ...link, address: e.target.value })} /></div>
        </div>
        <div className="bk-hint">{t('crm.bookings.v.order.linkHint')}</div>
      </BkModal>

      <BkModal
        open={!!noteFor}
        title={t('crm.bookings.v.order.noteTitle', { name: noteFor?.name || '' })}
        onClose={() => setNoteFor(null)}
        footer={<><button className="btn btn-sm" onClick={() => setNoteFor(null)}>{t('crm.bookings.v.common.cancel')}</button><button className="btn btn-primary btn-sm" onClick={() => { const it = noteFor!; setNoteFor(null); act(() => updateOrderItem(id, it.id, { note: noteText.trim() || null })); }}>{t('crm.bookings.v.common.save')}</button></>}
      >
        <div className="bk-field"><textarea autoFocus rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder={t('crm.bookings.v.order.notePh')} /></div>
      </BkModal>
    </MainLayout>
  );
};
