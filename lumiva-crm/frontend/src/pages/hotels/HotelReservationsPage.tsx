import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { HotelsSubnav } from './HotelsSubnav';
import { Ic, HTL_ICON } from './HotelIcons';
import { CountrySelect, CountryTag } from './CountrySelect';
import { money } from './partners/partnerUtils';
import { HousekeepingBadge } from './HotelDetailPage';
import {
  fetchReservations,
  createReservation,
  updateReservation,
  fetchReservation,
  checkInReservation,
  checkOutReservation,
  addReservationPayment,
  removeReservationPayment,
  downloadReservationFolio,
  sendFolioEmail,
  fetchQuote,
  fetchRatePlans,
  type HotelRatePlan,
  fetchMarketGroups,
  type HotelQuote,
  fetchHotels,
  fetchRoomTypes,
  fetchAgencies,
  fetchRoomUnits,
  fetchOccupancyTypes,
  fetchMarkets,
  fetchMarketPrices,
  previewReservationsImport,
  applyReservationsImport,
  scanGuestDocument,
  fetchContracts,
  fetchRoomBlocks,
  HOTEL_BOARD_TYPES,
  HOTEL_COMP_REASONS,
  contractPromotionDiscount,
  hotelTaxes,
  isRussiaCountry,
  type HotelContract,
  type HotelRoomBlock,
  type GuestDocumentScan,
  type HotelReservation,
  type HotelReservationStatus,
  type HotelReservationPaidStatus,
  type Hotel,
  type HotelRoomType,
  type HotelAgency,
  type HotelRoomUnit,
  type HotelRoomOccupancyType,
  type HotelMarket,
  type HotelRoomMarketPrice,
  type HotelReservationGuest,
  type HotelReservationImportPreview,
} from '../../api/hotels';
import { ReservationHistoryPanel } from './ReservationHistory';
import { todayIso } from './partners/partnerUtils';
import { FolioPanel } from './folio/FolioPanel';
import { NightlyRatesSummary, QuoteBreakdown } from './pricing/QuoteBreakdown';
import { GuestsPicker, isInfant, matchOccupancyByAges, splitGuests } from './pricing/GuestsPicker';
import { CancelReservationDialog, NoShowDialog, ReservationClosedNote, hotelErrorText } from './ReservationLifecycle';
import './hotels-design.css';
import { DateInput } from '../../components/ui/DateInput';
import { useHotelLive } from './useHotelLive';
import { acquireReservationLock, releaseReservationLock } from '../../api/hotels';

function nights(checkIn: string, checkOut: string) {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

const STATUS_FILTER_KEYS = ['all', 'confirmed', 'pending', 'checked_in', 'checked_out', 'cancelled', 'no_show'] as const;
/** Ручная смена статуса; отмена и no-show — только через свои диалоги (причина, штраф) */
const STATUS_KEYS: HotelReservationStatus[] = ['confirmed', 'pending', 'checked_in', 'checked_out'];
const PAID_STATUS_KEYS: HotelReservationPaidStatus[] = ['full', 'partial', 'none', 'refunded'];
const PAYMENT_METHOD_KEYS = ['card', 'cash', 'bank_transfer', 'other'];

export const HotelReservationsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();
  const [reservations, setReservations] = useState<HotelReservation[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const [allRoomUnits, setAllRoomUnits] = useState<HotelRoomUnit[]>([]);
  const [agencies, setAgencies] = useState<HotelAgency[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [agencyFilter, setAgencyFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<HotelReservation | null>(null);
  // тарифы отеля открытой брони — для названия тарифа в карточке
  const [drawerPlans, setDrawerPlans] = useState<HotelRatePlan[]>([]);
  useEffect(() => {
    if (!selected?.hotelId) return;
    fetchRatePlans(selected.hotelId).then(setDrawerPlans).catch(() => setDrawerPlans([]));
  }, [selected?.hotelId]);
  const [modalState, setModalState] = useState<'new' | HotelReservation | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [checkInUnits, setCheckInUnits] = useState<HotelRoomUnit[]>([]);
  const [checkInUnitId, setCheckInUnitId] = useState('');
  const [checkInOutBusy, setCheckInOutBusy] = useState(false);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [lifecycleDialog, setLifecycleDialog] = useState<'cancel' | 'noShow' | null>(null);

  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const statusLabel = (s: HotelReservationStatus) => t(`crm.hotels.reservations.status.${s}`);
  const paidStatusLabel = (s: HotelReservationPaidStatus) => t(`crm.hotels.reservations.paidStatus.${s}`);
  const paymentMethodLabel = (m: string) => (PAYMENT_METHOD_KEYS.includes(m) ? t(`crm.hotels.reservations.paymentMethods.${m}`) : m);

  const hotelById = useMemo(() => new Map(hotels.map((h) => [h.id, h])), [hotels]);
  const roomTypeById = useMemo(() => new Map(roomTypes.map((r) => [r.id, r])), [roomTypes]);
  const agencyById = useMemo(() => new Map(agencies.map((a) => [a.id, a])), [agencies]);
  const roomUnitById = useMemo(() => new Map(allRoomUnits.map((u) => [u.id, u])), [allRoomUnits]);

  const load = () => {
    fetchReservations()
      .then((list) => {
        setReservations(list);
        // открытая карточка — свежая версия (бронь могли изменить у другого сотрудника)
        setSelected((cur) => (cur ? list.find((x) => x.id === cur.id) || cur : cur));
        // ?reservation=<id> — открыть бронь сразу (ссылка из карточки отзыва)
        const want = new URLSearchParams(window.location.search).get('reservation');
        if (want) {
          const found = list.find((x) => x.id === want);
          if (found) setSelected((cur) => cur || found);
        }
      })
      .catch((e) => showAlert(e.message || t('crm.hotels.reservations.loadError'), { variant: 'error' }));
  };

  // новые и изменённые брони других сотрудников — без перезагрузки страницы
  useHotelLive(['reservation'], () => load(), 800);

  useEffect(() => {
    load();
    fetchHotels()
      .then((h) => {
        setHotels(h);
        return Promise.all(h.map((hotel) => fetchRoomTypes(hotel.id)));
      })
      .then((lists) => {
        const flat = lists.flat();
        setRoomTypes(flat);
        return Promise.all(flat.map((rt) => fetchRoomUnits({ roomTypeId: rt.id })));
      })
      .then((unitLists) => setAllRoomUnits(unitLists.flat()))
      .catch((e) => showAlert(e.message || t('crm.hotels.reservations.loadHotelsError'), { variant: 'error' }));
    fetchAgencies()
      .then(setAgencies)
      .catch((e) => showAlert(e.message || t('crm.hotels.reservations.loadAgenciesError'), { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCheckInUnitId('');
    if (selected && (selected.status === 'confirmed' || selected.status === 'pending')) {
      fetchRoomUnits({ roomTypeId: selected.roomTypeId }).then((units) => setCheckInUnits(units.filter((u) => u.active))).catch(() => setCheckInUnits([]));
    } else {
      setCheckInUnits([]);
    }
  }, [selected?.id, selected?.roomTypeId, selected?.status]);

  const handleCheckIn = () => {
    if (!selected) return;
    setCheckInOutBusy(true);
    checkInReservation(selected.id, checkInUnitId || undefined)
      .then((r) => { setSelected(r); load(); })
      .catch((e) => showAlert(e.message || t('crm.hotels.reservations.checkInError'), { variant: 'error' }))
      .finally(() => setCheckInOutBusy(false));
  };

  const handleCheckOut = () => {
    if (!selected) return;
    setCheckInOutBusy(true);
    checkOutReservation(selected.id)
      .then((r) => { setSelected(r); load(); })
      .catch((e) => showAlert(e.message || t('crm.hotels.reservations.checkOutError'), { variant: 'error' }))
      .finally(() => setCheckInOutBusy(false));
  };

  const handleAddPayment = () => {
    if (!selected || !paymentAmount) return;
    setPaymentBusy(true);
    addReservationPayment(selected.id, { date: paymentDate, amount: paymentAmount, method: paymentMethod, note: paymentNote || undefined })
      .then((r) => { setSelected(r); load(); setPaymentAmount(''); setPaymentNote(''); })
      .catch((e) => showAlert(e.message || t('crm.hotels.reservations.addPaymentError'), { variant: 'error' }))
      .finally(() => setPaymentBusy(false));
  };

  const handleSendFolioEmail = () => {
    if (!selected) return;
    setEmailBusy(true);
    sendFolioEmail(selected.id)
      .then(() => showAlert(t('crm.hotels.reservations.folioSentSuccess'), { variant: 'success' }))
      .catch((e) => showAlert(e.message || t('crm.hotels.reservations.folioSentError'), { variant: 'error' }))
      .finally(() => setEmailBusy(false));
  };

  const handleRemovePayment = (paymentId: string) => {
    if (!selected) return;
    removeReservationPayment(selected.id, paymentId)
      .then((r) => { setSelected(r); load(); })
      .catch((e) => showAlert(e.message || t('crm.hotels.reservations.removePaymentError'), { variant: 'error' }));
  };

  const filtered = useMemo(
    () =>
      reservations.filter(
        (r) =>
          (filter === 'all' || r.status === filter) &&
          (agencyFilter === 'all' || r.agencyId === agencyFilter) &&
          (!countryFilter || r.guestCountry === countryFilter) &&
          [r.guestName, r.bookingCode, r.guestEmail].some((f) => f && f.toLowerCase().includes(q.toLowerCase())),
      ),
    [reservations, filter, agencyFilter, countryFilter, q],
  );
  // валюта отеля брони; в KPI — общая, только если у всех отелей она одна
  const curOf = (r: HotelReservation) => hotelById.get(r.hotelId)?.currency || null;
  const kpiCurrency = (() => {
    const set = new Set(filtered.map(curOf));
    return set.size === 1 ? [...set][0] : null;
  })();
  const fmt = (v: number, cur: string | null) => money(v, cur, i18n.language);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (a, r) => ({
          rooms: a.rooms + Number(r.roomTotal),
          cost: a.cost + Number(r.costPerNight) * nights(r.checkIn, r.checkOut),
          disc: a.disc + (Number(r.roomTotal) - Number(r.total)),
        }),
        { rooms: 0, cost: 0, disc: 0 },
      ),
    [filtered],
  );

  return (
    <MainLayout>
      <PageHelpButton topic="hotelReservations" />
      <div className="px-scope">
        <HotelsSubnav active="reservations" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.hotels.reservations.kicker', { count: reservations.length, channels: agencies.length })}</div>
            <h1>{t('crm.hotels.reservations.title')}</h1>
            <p className="sub">{t('crm.hotels.reservations.subtitle')}</p>
          </div>
          <div className="htl-hero-r io-toolbar">
            <button data-tour="hres-import" className="btn" onClick={() => setShowImport(true)}><Ic d={HTL_ICON.download} size={13} />{t('crm.hotels.reservations.importBtn')}</button>
            <button data-tour="hres-create" className="btn btn-primary" onClick={() => setModalState('new')}><Ic d={HTL_ICON.plus} size={14} />{t('crm.hotels.reservations.newBooking')}</button>
          </div>
        </div>

        <div data-tour="hres-kpis" className="htl-kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <div className="htl-kpi"><div className="l">{t('crm.hotels.reservations.kpis.roomsSum')}</div><div className="v">{fmt(totals.rooms, kpiCurrency)}</div></div>
          <div className="htl-kpi"><div className="l">{t('crm.hotels.reservations.kpis.costPeriod')}</div><div className="v">{fmt(totals.cost, kpiCurrency)}</div></div>
          <div className="htl-kpi"><div className="l">{t('crm.hotels.reservations.kpis.discountsGiven')}</div><div className="v">{fmt(totals.disc, kpiCurrency)}</div></div>
          <div className="htl-kpi"><div className="l">{t('crm.hotels.reservations.kpis.marginEst')}</div><div className="v">{fmt(totals.rooms - totals.disc - totals.cost, kpiCurrency)}</div></div>
        </div>

        <div style={{ display: 'flex', gap: 10, margin: '16px 0', flexWrap: 'wrap' }}>
          <div data-tour="hres-search" className="bk-search" style={{ flex: 1, maxWidth: 280 }}>
            <Ic d={HTL_ICON.search} size={14} />
            <input placeholder={t('crm.hotels.reservations.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select value={agencyFilter} onChange={(e) => setAgencyFilter(e.target.value)} style={{ padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 9, fontSize: 12.5 }}>
            <option value="all">{t('crm.hotels.reservations.allAgencies')}</option>
            {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <div style={{ width: 200 }}>
            <CountrySelect value={countryFilter} onChange={setCountryFilter} placeholder={t('crm.hotels.reservations.allCountries')} />
          </div>
          <div data-tour="hres-status" className="bk-savedviews" style={{ flex: 'none' }}>
            {STATUS_FILTER_KEYS.map((k) => (
              <div key={k} className={`bk-sv-tab${filter === k ? ' active' : ''}`} onClick={() => setFilter(k)}>{t(`crm.hotels.reservations.statusFilters.${k}`)}</div>
            ))}
          </div>
        </div>

        <div className="bk-table-wrap">
          <table data-tour="hres-table" className="bk-table">
            <thead>
              <tr>
                <th>{t('crm.hotels.reservations.table.colGuest')}</th>
                <th>{t('crm.hotels.reservations.table.colHotelRoom')}</th>
                <th>{t('crm.hotels.reservations.table.colAgency')}</th>
                <th>{t('crm.hotels.reservations.table.colCountry')}</th>
                <th>{t('crm.hotels.reservations.table.colCreated')}</th>
                <th>{t('crm.hotels.reservations.table.colDates')}</th>
                <th>{t('crm.hotels.reservations.table.colNightsPax')}</th>
                <th>{t('crm.hotels.reservations.table.colCost')}</th>
                <th>{t('crm.hotels.reservations.table.colPp')}</th>
                <th>{t('crm.hotels.reservations.table.colGross')}</th>
                <th>{t('crm.hotels.reservations.table.colDiscount')}</th>
                <th>{t('crm.hotels.reservations.table.colTotal')}</th>
                <th>{t('crm.hotels.reservations.table.colNet')}</th>
                <th>{t('crm.hotels.reservations.table.colPaid')}</th>
                <th>{t('crm.hotels.reservations.table.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => setSelected(r)}>
                  <td style={{ fontWeight: 600 }}>
                    {r.guestName}
                    {r.source === 'demo' && <span className="bk-badge draft" style={{ marginLeft: 6 }}>{t('crm.hotels.demo.badge')}</span>}
                    {r.source === 'channel' && <span className="htl-ota" style={{ marginLeft: 6 }} title={r.otaCode || ''}>{r.otaName || t('crm.hotels.channels.ota')}</span>}
                  </td>
                  <td>
                    <div>{hotelById.get(r.hotelId)?.name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      {roomTypeById.get(r.roomTypeId)?.name || '—'}
                      {r.roomUnitId && roomUnitById.get(r.roomUnitId) && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 600, color: 'var(--ink)' }}>
                          · <HousekeepingBadge status={roomUnitById.get(r.roomUnitId)!.housekeepingStatus} />
                          {roomUnitById.get(r.roomUnitId)!.label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td><span className="agency-pill"><i />{r.agencyId ? agencyById.get(r.agencyId)?.name || '—' : '—'}</span></td>
                  <td style={{ fontSize: 12 }}><CountryTag code={r.guestCountry} /></td>
                  <td style={{ fontSize: 11, color: 'var(--fg-3)' }}>{new Date(r.createdAt).toLocaleDateString(dateLocale)}</td>
                  <td style={{ fontSize: 12 }}>{r.checkIn} → {r.checkOut}</td>
                  <td style={{ fontSize: 11.5 }}>{t('crm.hotels.reservations.table.nightsPax', { nights: nights(r.checkIn, r.checkOut), pax: r.pax })}</td>
                  <td style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--fg-3)' }}>{fmt(Number(r.costPerNight), curOf(r))}</td>
                  <td style={{ fontFamily: 'var(--ff-mono)', fontSize: 11 }}>{fmt(Number(r.ppPerNight), curOf(r))}</td>
                  <td style={{ fontFamily: 'var(--ff-mono)', fontSize: 11 }}>{fmt(Number(r.grossPerNight), curOf(r))}</td>
                  <td style={{ fontSize: 11, color: Number(r.discountPct) ? '#cc2f47' : 'var(--fg-3)' }}>{Number(r.discountPct) ? `-${r.discountPct}%` : '—'}</td>
                  <td style={{ fontFamily: 'var(--ff-mono)', fontWeight: 700 }}>{fmt(Number(r.total), curOf(r))}</td>
                  <td style={{ fontFamily: 'var(--ff-mono)', fontSize: 11.5 }} title={Number(r.commissionAmount) ? t('crm.hotels.reservations.table.commissionTip', { pct: Number(r.commissionPct), amount: fmt(Number(r.commissionAmount), curOf(r)) }) : undefined}>
                    {fmt(Number(r.netTotal || r.total), curOf(r))}
                    {Number(r.commissionPct) > 0 && <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>−{Number(r.commissionPct)}%</div>}
                  </td>
                  <td style={{ fontSize: 11, color: r.paidStatus === 'full' ? '#1f8a5e' : r.paidStatus === 'none' ? '#cc2f47' : 'var(--fg-3)' }}>{paidStatusLabel(r.paidStatus)}</td>
                  <td><span className={`bk-badge ${r.status === 'checked_out' ? '' : r.status === 'checked_in' ? 'confirmed' : r.status === 'no_show' ? 'cancelled' : r.status}`}>{statusLabel(r.status)}</span>{r.isComplimentary && <span className="htl-comp-tag" style={{ marginLeft: 6 }}>{t('crm.hotels.lifecycle.compTag')}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="px-scope">
          <div className="bk-drawer-back" onClick={() => setSelected(null)} />
          <div className="bk-drawer htl-res-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="bk-drawer-head">
              <div>
                <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--fg-3)' }}>{selected.id.slice(0, 8)}</div>
                <h3>{selected.guestName}</h3>
                {selected.source === 'channel' && (
                  <span className="htl-ota" style={{ marginTop: 6 }}>{selected.otaName || t('crm.hotels.channels.ota')}{selected.otaCode ? ` · ${selected.otaCode}` : ''}</span>
                )}
                {selected.isComplimentary && (
                  <span className="htl-comp-tag" style={{ marginTop: 6 }}>
                    {t('crm.hotels.lifecycle.compTag')} · {selected.compReason ? t(`crm.hotels.lifecycle.compReasons.${selected.compReason}`) : ''} · {fmt(Number(selected.compValue), curOf(selected))}
                  </span>
                )}
                {selected.status === 'pending' && selected.optionUntil && (
                  <div className="htl-sub" style={{ marginTop: 6 }}>{t('crm.hotels.lifecycle.optionUntilLine', { date: new Date(selected.optionUntil).toLocaleString(dateLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => setModalState(selected)} title={t('crm.hotels.reservations.drawer.edit')}><Ic d={HTL_ICON.pencil} size={16} /></button>
                <button onClick={() => setSelected(null)}><Ic d={HTL_ICON.x} size={16} /></button>
              </div>
            </div>
            <div className="bk-drawer-body">
              <div className="htl-info-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="htl-info-item"><div className="l">{t('crm.hotels.reservations.drawer.hotelRoomType')}</div><div className="v" style={{ fontSize: 12.5 }}>{hotelById.get(selected.hotelId)?.name}<br /><span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>{roomTypeById.get(selected.roomTypeId)?.name}</span></div></div>
                <div className="htl-info-item">
                  <div className="l">{t('crm.hotels.reservations.drawer.room')}</div>
                  <div className="v" style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {selected.roomUnitId && roomUnitById.get(selected.roomUnitId) ? (
                      <>
                        <HousekeepingBadge status={roomUnitById.get(selected.roomUnitId)!.housekeepingStatus} />
                        {roomUnitById.get(selected.roomUnitId)!.label}
                      </>
                    ) : (
                      <span style={{ color: 'var(--fg-3)' }}>{t('crm.hotels.reservations.drawer.unassigned')}</span>
                    )}
                  </div>
                </div>
                <div className="htl-info-item"><div className="l">{t('crm.hotels.reservations.drawer.agency')}</div><div className="v" style={{ fontSize: 12.5 }}>{selected.agencyId ? agencyById.get(selected.agencyId)?.name : '—'}</div></div>
                <div className="htl-info-item"><div className="l">{t('crm.hotels.reservations.drawer.guestEmail')}</div><div className="v" style={{ fontSize: 12.5 }}>{selected.guestEmail || '—'}</div></div>
                <div className="htl-info-item"><div className="l">{t('crm.hotels.reservations.drawer.guestPhone')}</div><div className="v" style={{ fontSize: 12.5 }}>{selected.guestPhone || '—'}</div></div>
                <div className="htl-info-item"><div className="l">{t('crm.hotels.reservations.drawer.createdDate')}</div><div className="v" style={{ fontSize: 12.5 }}>{new Date(selected.createdAt).toLocaleDateString(dateLocale)}</div></div>
                <div className="htl-info-item"><div className="l">{t('crm.hotels.reservations.drawer.market')}</div><div className="v" style={{ fontSize: 12.5 }}>{selected.market || '—'}</div></div>
                <div className="htl-info-item"><div className="l">{t('crm.hotels.reservations.drawer.guestCountry')}</div><div className="v" style={{ fontSize: 12.5 }}><CountryTag code={selected.guestCountry} /></div></div>
                <div className="htl-info-item"><div className="l">{t('crm.hotels.reservations.drawer.saleCountry')}</div><div className="v" style={{ fontSize: 12.5 }}><CountryTag code={selected.saleCountry} /></div></div>
                <div className="htl-info-item"><div className="l">{t('crm.hotels.reservations.drawer.board')}</div><div className="v" style={{ fontSize: 12.5 }}>{selected.boardType ? `${selected.boardType} · ${t(`crm.hotels.board.${selected.boardType}`)}` : '—'}</div></div>
                <div className="htl-info-item">
                  <div className="l">{t('crm.hotels.reservations.drawer.contract')}</div>
                  <div className="v" style={{ fontSize: 12.5 }}>
                    {selected.contractId ? <a href={`/hotels/contracts/${selected.contractId}`} style={{ color: 'var(--ink)', textDecoration: 'underline' }}>{t('crm.hotels.reservations.drawer.openContract')}</a> : '—'}
                  </div>
                </div>
                <div className="htl-info-item"><div className="l">{t('crm.hotels.reservations.drawer.commission')}</div><div className="v" style={{ fontSize: 12.5 }}>{Number(selected.commissionPct) ? `${Number(selected.commissionPct)}% · ${fmt(Number(selected.commissionAmount), curOf(selected))}` : '—'}</div></div>
                <div className="htl-info-item"><div className="l">{t('crm.hotels.reservations.drawer.net')}</div><div className="v" style={{ fontSize: 12.5 }}>{fmt(Number(selected.netTotal || selected.total), curOf(selected))}</div></div>
                <div className="htl-info-item"><div className="l">{t('crm.hotels.reservations.drawer.checkIn')}</div><div className="v" style={{ fontSize: 12.5 }}>{selected.checkIn}</div></div>
                <div className="htl-info-item"><div className="l">{t('crm.hotels.reservations.drawer.checkOut')}</div><div className="v" style={{ fontSize: 12.5 }}>{selected.checkOut}</div></div>
                <div className="htl-info-item"><div className="l">{t('crm.hotels.reservations.drawer.nights')}</div><div className="v" style={{ fontSize: 12.5 }}>{nights(selected.checkIn, selected.checkOut)}</div></div>
                <div className="htl-info-item"><div className="l">{t('crm.hotels.reservations.drawer.pax')}</div><div className="v" style={{ fontSize: 12.5 }}>{selected.pax}{(selected.childAges || []).some(isInfant) ? ` · ${t('crm.hotels.guestsPicker.babyCot', { count: (selected.childAges || []).filter(isInfant).length })}` : ''}</div></div>
              </div>

              {(selected.earlyCheckIn || selected.lateCheckOut) && (
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {selected.earlyCheckIn && <span className="ppt-stop-badge" style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}>{t('crm.hotels.reservations.drawer.earlyCheckInBadge')}</span>}
                  {selected.lateCheckOut && <span className="ppt-stop-badge" style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}>{t('crm.hotels.reservations.drawer.lateCheckOutBadge')}</span>}
                </div>
              )}
              {selected.notes && (
                <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--fg-3)', whiteSpace: 'pre-wrap' }}>{selected.notes}</div>
              )}

              {selected.guests.length > 0 && (
                <>
                  <div style={{ marginTop: 16, fontSize: 11.5, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.03em' }}>
                    {t('crm.hotels.reservations.drawer.guestsTitle', { count: selected.guests.length })}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selected.guests.map((g) => (
                      <div key={g.id} style={{ border: '1px solid var(--line-2)', borderRadius: 10, padding: '8px 10px', fontSize: 12.5 }}>
                        <div style={{ fontWeight: 600 }}>{g.fullName || '—'}{g.age ? t('crm.hotels.reservations.drawer.ageSuffix', { age: g.age }) : ''}</div>
                        <div style={{ color: 'var(--fg-3)', fontSize: 11.5, marginTop: 2 }}>
                          {g.citizenship && <span>{g.citizenship} · </span>}
                          {g.passportNumber && <span>{t('crm.hotels.reservations.drawer.passportPrefix', { number: g.passportNumber })}</span>}
                          {g.passportExpiry && <span>{t('crm.hotels.reservations.drawer.passportExpirySuffix', { date: g.passportExpiry })}</span>}
                        </div>
                        {g.note && <div style={{ color: 'var(--fg-3)', fontSize: 11.5, marginTop: 2 }}>{g.note}</div>}
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div style={{ marginTop: 16, fontSize: 11.5, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{t('crm.hotels.reservations.drawer.financialTitle')}</div>
              <div className="htl-price-breakdown" style={{ marginTop: 8 }}>
                <div className="row"><span>{t('crm.hotels.reservations.drawer.costPerNight')}</span><b>{fmt(Number(selected.costPerNight), curOf(selected))}</b></div>
                <div className="row"><span>{t('crm.hotels.reservations.drawer.ppPerNight')}</span><b>{fmt(Number(selected.ppPerNight), curOf(selected))}</b></div>
                <div className="row"><span>{t('crm.hotels.reservations.drawer.grossPerNight')}</span><b>{fmt(Number(selected.grossPerNight), curOf(selected))}</b></div>
                <div className="row"><span>{t('crm.hotels.reservations.drawer.ppTotal')}</span><b>{fmt(Number(selected.ppTotal), curOf(selected))}</b></div>
                <div className="row"><span>{t('crm.hotels.reservations.drawer.roomTotal')}</span><b>{fmt(Number(selected.roomTotal), curOf(selected))}</b></div>
                <div className="row"><span>{t('crm.hotels.reservations.drawer.discount')}</span><b style={{ color: Number(selected.discountPct) ? '#cc2f47' : 'inherit' }}>{Number(selected.discountPct) ? `-${selected.discountPct}%` : '—'}</b></div>
                <div className="row final" style={{ gridColumn: '1 / -1' }}><span>{t('crm.hotels.reservations.drawer.finalTotal')}</span><b>{fmt(Number(selected.total), curOf(selected))}</b></div>
              </div>
              {(() => {
                const tx = hotelTaxes(Number(selected.total), hotelById.get(selected.hotelId));
                if (!tx.has) return null;
                return (
                  <div className="htl-price-breakdown" style={{ marginTop: 8 }}>
                    <div className="row"><span>{t('crm.hotels.reservations.drawer.taxBase')}</span><b>{fmt(tx.base, curOf(selected))}</b></div>
                    {tx.accommodationTaxPct > 0 && <div className="row"><span>{t('crm.hotels.reservations.drawer.accTax', { pct: tx.accommodationTaxPct })}</span><b>{fmt(tx.accommodationTax, curOf(selected))}</b></div>}
                    {tx.vatPct > 0 && <div className="row"><span>{t('crm.hotels.reservations.drawer.vat', { pct: tx.vatPct })}</span><b>{fmt(tx.vat, curOf(selected))}</b></div>}
                    <div className="row final" style={{ gridColumn: '1 / -1' }}><span>{tx.included ? t('crm.hotels.reservations.drawer.taxIncluded') : t('crm.hotels.reservations.drawer.totalWithTax')}</span><b>{fmt(tx.total, curOf(selected))}</b></div>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 13 }}>
                <span style={{ color: 'var(--fg-3)' }}>{t('crm.hotels.reservations.drawer.paidStatusLabel')}</span>
                <select
                  style={{ padding: '6px 10px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}
                  value={selected.paidStatus}
                  onChange={(e) => {
                    const paidStatus = e.target.value as HotelReservation['paidStatus'];
                    updateReservation(selected.id, { paidStatus })
                      .then((r) => { setSelected(r); load(); })
                      .catch((err) => showAlert(err.message || t('crm.hotels.reservations.updatePaidStatusError'), { variant: 'error' }));
                  }}
                >
                  {PAID_STATUS_KEYS.map((k) => (
                    <option key={k} value={k}>{paidStatusLabel(k)}</option>
                  ))}
                </select>
              </div>

              {selected.ratePlanId && (() => {
                const p = drawerPlans.find((x) => x.id === selected.ratePlanId);
                return p ? (
                  <div className="rtp-terms">
                    <span>{t('crm.hotels.ratePlans.formLabel')}: {p.code} · {p.name}</span>
                    <span className={p.refundable ? 'ok' : 'nrf'}>{p.refundable ? t('crm.hotels.ratePlans.refundable') : t('crm.hotels.ratePlans.nonRefundable')}</span>
                  </div>
                ) : null;
              })()}
              {(!!selected.promotions?.length || selected.promotionsOff) && (
                <div className="rtp-terms">
                  {selected.promotions?.map((p) => <span key={p.id} className="ok">{p.name} · −{fmt(p.amount, curOf(selected))}</span>)}
                  {selected.promotionsOff && <span>{t('crm.hotels.promos.drawerOff')}</span>}
                </div>
              )}
              {selected.depositAmount && Number(selected.depositAmount) > 0 && (() => {
                const paid = (selected.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
                const due = Number(selected.depositAmount);
                const todayIso = new Date().toISOString().slice(0, 10);
                const state = paid + 0.009 >= due ? 'paid' : selected.depositDueDate && selected.depositDueDate < todayIso ? 'overdue' : 'due';
                // предоплата по условиям акции не внесена в срок — по условиям акции скидку можно снять
                const promoPrepay = (selected.promotions || []).some((p) => p.prepaymentPct > 0);
                const canRevoke = state === 'overdue' && promoPrepay && selected.priceMode === 'auto' && ['confirmed', 'pending'].includes(selected.status);
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13 }}>
                      <span style={{ color: 'var(--fg-3)' }}>{t('crm.hotels.reservations.drawer.deposit')}</span>
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{fmt(due, curOf(selected))}</span>
                        <span className={`rtp-dep s-${state}`}>
                          {state === 'paid' ? t('crm.hotels.ratePlans.depPaid') : state === 'overdue' ? t('crm.hotels.ratePlans.depOverdue', { date: selected.depositDueDate }) : selected.depositDueDate ? t('crm.hotels.ratePlans.depDue', { date: selected.depositDueDate }) : t('crm.hotels.ratePlans.depOpen')}
                        </span>
                      </span>
                    </div>
                    {canRevoke && (
                      <div className="pe-box warn prm-revoke">
                        <span>{t('crm.hotels.promos.revokeHint', { amount: fmt((selected.promotions || []).reduce((s, p) => s + p.amount, 0), curOf(selected)) })}</span>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={async () => {
                            if (!(await showConfirm(t('crm.hotels.promos.revokeBody'), { title: t('crm.hotels.promos.revoke'), confirmLabel: t('crm.hotels.promos.revoke'), danger: true }))) return;
                            updateReservation(selected.id, { promotionsOff: true, expectedUpdatedAt: selected.updatedAt } as Partial<HotelReservation>)
                              .then((r) => { setSelected(r); load(); showAlert(t('crm.hotels.promos.revoked'), { variant: 'success' }); })
                              .catch((err) => showAlert(hotelErrorText(t, err, t('crm.hotels.promos.saveError')), { variant: 'error' }));
                          }}
                        >
                          {t('crm.hotels.promos.revoke')}
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}

              {(selected.priceMode === 'auto' || selected.source === 'channel') && selected.nightlyRates?.length ? <NightlyRatesSummary nights={selected.nightlyRates} currency={curOf(selected)} /> : null}
              {selected.source === 'channel' && selected.paymentCollect && (
                <div className={`pe-box${selected.paymentCollect === 'ota' ? '' : ' muted'}`} style={{ marginTop: 8 }}>
                  {t(`crm.hotels.reservations.drawer.paymentCollect.${selected.paymentCollect}`, { ota: selected.otaName || 'OTA' })}
                  {selected.channelPaymentType ? ` · ${t(`crm.hotels.reservations.drawer.channelPaymentType.${selected.channelPaymentType}`, { defaultValue: selected.channelPaymentType })}` : ''}
                </div>
              )}
              <div style={{ marginTop: 16, fontSize: 11.5, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{t('crm.hotels.folio.title')}</div>
              <FolioPanel
                reservation={selected}
                currency={curOf(selected)}
                onChanged={() => fetchReservation(selected.id).then((r) => { setSelected(r); load(); }).catch(() => load())}
              />

              {(selected.checkedInAt || selected.checkedOutAt) && (
                <div className="htl-info-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 10 }}>
                  {selected.checkedInAt && (
                    <div className="htl-info-item"><div className="l">{t('crm.hotels.reservations.drawer.checkedInLabel')}</div><div className="v" style={{ fontSize: 12.5 }}>{new Date(selected.checkedInAt).toLocaleString(dateLocale)}</div></div>
                  )}
                  {selected.checkedOutAt && (
                    <div className="htl-info-item"><div className="l">{t('crm.hotels.reservations.drawer.checkedOutLabel')}</div><div className="v" style={{ fontSize: 12.5 }}>{new Date(selected.checkedOutAt).toLocaleString(dateLocale)}</div></div>
                  )}
                </div>
              )}

              {(selected.status === 'confirmed' || selected.status === 'pending') && (
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  {checkInUnits.length > 0 && (
                    <select
                      style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--line-2)', borderRadius: 8 }}
                      value={checkInUnitId}
                      onChange={(e) => setCheckInUnitId(e.target.value)}
                    >
                      <option value="">{t('crm.hotels.reservations.drawer.noRoomOption')}</option>
                      {checkInUnits.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                    </select>
                  )}
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={checkInOutBusy} onClick={handleCheckIn}>
                    <Ic d={HTL_ICON.check} size={14} />{t('crm.hotels.reservations.drawer.checkInBtn')}
                  </button>
                </div>
              )}
              {selected.status === 'checked_in' && (
                <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={checkInOutBusy} onClick={handleCheckOut}>
                  <Ic d={HTL_ICON.check} size={14} />{t('crm.hotels.reservations.drawer.checkOutBtn')}
                </button>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <select
                  style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--line-2)', borderRadius: 8 }}
                  value={selected.status}
                  onChange={(e) => {
                    const status = e.target.value as HotelReservation['status'];
                    updateReservation(selected.id, { status })
                      .then((r) => {
                        setSelected(r);
                        load();
                      })
                      .catch((err) => showAlert(err.message || t('crm.hotels.reservations.updateStatusError'), { variant: 'error' }));
                  }}
                >
                  {(STATUS_KEYS.includes(selected.status) ? STATUS_KEYS : [selected.status, ...STATUS_KEYS]).map((k) => (
                    <option key={k} value={k} disabled={k === 'cancelled' || k === 'no_show'}>{statusLabel(k)}</option>
                  ))}
                </select>
              </div>
              <ReservationClosedNote r={selected} currency={curOf(selected)} />
              {(selected.status === 'confirmed' || selected.status === 'pending') && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {selected.checkIn <= todayIso() && (
                    <button className="btn" style={{ flex: 1 }} onClick={() => setLifecycleDialog('noShow')}>{t('crm.hotels.frontDesk.noShow')}</button>
                  )}
                  <button className="btn" style={{ flex: 1, color: '#cc2f47' }} onClick={() => setLifecycleDialog('cancel')}>
                    {t('crm.hotels.reservations.drawer.cancelBooking')}
                  </button>
                </div>
              )}
              <ReservationHistoryPanel
                reservationId={selected.id}
                refreshKey={selected.updatedAt}
                units={allRoomUnits}
                roomTypes={roomTypes}
                agencies={agencies}
                lang={dateLocale}
              />
            </div>
          </div>
        </div>
      )}

      {modalState && (
        <ReservationModal
          hotels={hotels}
          roomTypes={roomTypes}
          agencies={agencies}
          initial={modalState === 'new' ? null : modalState}
          saving={saving}
          setSaving={setSaving}
          onClose={() => setModalState(null)}
          onSaved={(r) => {
            setModalState(null);
            setSelected((prev) => (prev && prev.id === r.id ? r : prev));
            load();
          }}
        />
      )}

      {selected && lifecycleDialog === 'cancel' && (
        <CancelReservationDialog
          reservation={selected}
          currency={curOf(selected)}
          onClose={() => setLifecycleDialog(null)}
          onDone={(r) => { setLifecycleDialog(null); setSelected(r); load(); }}
        />
      )}
      {selected && lifecycleDialog === 'noShow' && (
        <NoShowDialog
          reservation={selected}
          currency={curOf(selected)}
          onClose={() => setLifecycleDialog(null)}
          onDone={(r) => { setLifecycleDialog(null); setSelected(r); load(); }}
        />
      )}

      {showImport && (
        <ImportModal
          hotels={hotels}
          onClose={() => setShowImport(false)}
          onDone={() => {
            setShowImport(false);
            load();
          }}
        />
      )}
    </MainLayout>
  );
};

/** Фото с телефона бывают 4000px+ и HEIC — уменьшаем и перекодируем в JPEG до отправки на распознавание. */
async function toScanJpeg(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.9));
  } catch {
    return file;
  }
}

/** Полных лет на дату (заезда или сегодня). */
function ageOn(birthDate: string, on: string): string {
  const b = new Date(`${birthDate}T00:00:00`);
  const d = on ? new Date(`${on}T00:00:00`) : new Date();
  if (Number.isNaN(b.getTime()) || Number.isNaN(d.getTime())) return '';
  let age = d.getFullYear() - b.getFullYear();
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) age--;
  return age >= 0 ? String(age) : '';
}

type ScanNote = { tone: 'ok' | 'warn' | 'err'; text: string };

/** prefill — значения новой брони (из шахматки: отель, тип, номер, даты); initial — редактирование */
export const ReservationModal: React.FC<{
  hotels: Hotel[];
  roomTypes: HotelRoomType[];
  agencies: HotelAgency[];
  initial: HotelReservation | null;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onClose: () => void;
  onSaved: (r: HotelReservation) => void;
  prefill?: Partial<Pick<HotelReservation, 'hotelId' | 'roomTypeId' | 'roomUnitId' | 'checkIn' | 'checkOut'>>;
}> = ({ hotels, roomTypes, agencies, initial, saving, setSaving, onClose, onSaved, prefill }) => {
  const { t, i18n } = useTranslation();
  const { showAlert } = useAlertModal();
  const [hotelId, setHotelId] = useState(initial?.hotelId || prefill?.hotelId || hotels[0]?.id || '');
  const [roomTypeId, setRoomTypeId] = useState(initial?.roomTypeId || prefill?.roomTypeId || '');
  const [agencyId, setAgencyId] = useState(initial?.agencyId || '');
  const [roomUnitId, setRoomUnitId] = useState(initial?.roomUnitId || prefill?.roomUnitId || '');
  const [guestName, setGuestName] = useState(initial?.guestName || '');
  const [guestEmail, setGuestEmail] = useState(initial?.guestEmail || '');
  const [guestPhone, setGuestPhone] = useState(initial?.guestPhone || '');
  // состав гостей: взрослые + возраст каждого ребёнка (у старых броней без возрастов — дети «без возраста»)
  const initialAges: Array<number | null> = initial ? (initial.childAges?.length ? initial.childAges : Array.from({ length: initial.children || 0 }, () => null)) : [];
  const [adults, setAdults] = useState(initial ? Math.max(1, (initial.pax || 1) - initialAges.length) : 2);
  const [childAges, setChildAges] = useState<Array<number | null>>(initialAges);
  /** '' — размещение подбирается по составу, иначе выбрано вручную */
  const [occupancyOverride, setOccupancyOverride] = useState('');
  const [market, setMarket] = useState(initial?.market || '');
  const [checkIn, setCheckIn] = useState(initial?.checkIn || prefill?.checkIn || '');
  const [checkOut, setCheckOut] = useState(initial?.checkOut || prefill?.checkOut || '');
  const [costPerNight, setCostPerNight] = useState(initial?.costPerNight || '0');
  const [ppPerNight, setPpPerNight] = useState(initial?.ppPerNight || '0');
  const [grossPerNight, setGrossPerNight] = useState(initial?.grossPerNight || '0');
  const [discountPct, setDiscountPct] = useState(initial?.discountPct || '0');
  const [depositAmount, setDepositAmount] = useState(initial?.depositAmount || '0');
  /** предоплату правили руками — иначе её считает сервер по тарифу */
  const [depositTouched, setDepositTouched] = useState(false);
  const [ratePlans, setRatePlans] = useState<HotelRatePlan[]>([]);
  /** '' — без тарифа; при создании подставляется тариф по умолчанию */
  const [ratePlanId, setRatePlanId] = useState<string>(initial?.ratePlanId || '');
  /** акции отеля сняты с брони — цена без акций */
  const [promotionsOff, setPromotionsOff] = useState(!!initial?.promotionsOff);
  const [earlyCheckIn, setEarlyCheckIn] = useState(initial?.earlyCheckIn || false);
  const [lateCheckOut, setLateCheckOut] = useState(initial?.lateCheckOut || false);
  const [notes, setNotes] = useState(initial?.notes || '');
  const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [isOption, setIsOption] = useState(!!(initial?.status === 'pending' && initial?.optionUntil));
  const [optionUntil, setOptionUntil] = useState(initial?.optionUntil ? toLocalInput(new Date(initial.optionUntil)) : toLocalInput(new Date(Date.now() + 48 * 3600_000)));
  const [isComp, setIsComp] = useState(!!initial?.isComplimentary);
  const [compReason, setCompReason] = useState<string>(initial?.compReason || '');
  const [compNote, setCompNote] = useState(initial?.compNote || '');
  const canOption = !initial || initial.status === 'pending' || initial.status === 'confirmed';
  const [guests, setGuests] = useState<HotelReservationGuest[]>(initial?.guests || []);
  const [guestCountry, setGuestCountry] = useState<string | null>(initial?.guestCountry || null);
  const [saleCountry, setSaleCountry] = useState<string | null>(initial?.saleCountry || null);
  /** '' — подобрать автоматически по партнёру/отелю/дате, 'none' — без контракта */
  const [contractId, setContractId] = useState<string>(initial ? initial.contractId || 'none' : '');
  const [blockId, setBlockId] = useState(initial?.blockId || '');
  const [boardType, setBoardType] = useState(initial?.boardType || '');
  const [commissionPct, setCommissionPct] = useState(initial ? String(Number(initial.commissionPct) || '') : '');
  const [contracts, setContracts] = useState<HotelContract[]>([]);
  const [blocks, setBlocks] = useState<HotelRoomBlock[]>([]);
  // тарифы отеля; новая бронь — тариф по умолчанию
  useEffect(() => {
    if (!hotelId) { setRatePlans([]); return; }
    fetchRatePlans(hotelId)
      .then((list) => {
        setRatePlans(list);
        if (!initial) setRatePlanId(list.find((p) => p.isDefault && p.active)?.id || '');
      })
      .catch(() => setRatePlans([]));
  }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addGuestRow = () => setGuests((prev) => [...prev, { id: crypto.randomUUID(), fullName: '', citizenship: '', passportNumber: '', passportExpiry: '', age: '', note: null }]);
  const updateGuestRow = (id: string, patch: Partial<HotelReservationGuest>) =>
    setGuests((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const removeGuestRow = (id: string) => setGuests((prev) => prev.filter((g) => g.id !== id));

  // ─── скан паспорта / ID-карты → строка гостя ───
  const scanInput = React.useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(0);
  const [scanNotes, setScanNotes] = useState<ScanNote[]>([]);
  const applyScan = (r: GuestDocumentScan) => {
    const patch: Partial<HotelReservationGuest> = {
      fullName: r.fullName,
      citizenship: r.nationalityName || r.nationalityIso3 || '',
      passportNumber: r.documentNumber,
      passportExpiry: r.expiryDate || '',
      birthDate: r.birthDate || '',
      gender: r.sex || '',
      documentType: r.documentType,
      nationalityCode: r.nationalityCode,
      ...(r.birthDate ? { age: ageOn(r.birthDate, checkIn) } : {}),
    };
    if (r.nationalityCode) setGuestCountry((c) => c || r.nationalityCode);
    setGuests((prev) => {
      // заполняем первую пустую строку, иначе — новый гость
      const empty = prev.find((g) => !g.fullName.trim() && !g.passportNumber.trim());
      if (empty) return prev.map((g) => (g.id === empty.id ? { ...g, ...patch } : g));
      return [...prev, { id: crypto.randomUUID(), fullName: '', citizenship: '', passportNumber: '', passportExpiry: '', age: '', note: null, ...patch }];
    });
    if (!guestName.trim() && r.fullName) setGuestName(r.fullName);
  };
  const scanFiles = async (files: FileList | null) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    setScanNotes([]);
    setScanning(list.length);
    const lang = (i18n.language || 'ru').slice(0, 2);
    for (const f of list) {
      try {
        const r = await scanGuestDocument(await toScanJpeg(f), lang);
        applyScan(r);
        const who = r.fullName || r.documentNumber;
        const notes: ScanNote[] = [];
        if (r.warnings.includes('expired')) notes.push({ tone: 'err', text: t('crm.hotels.reservations.scan.expired', { name: who }) });
        if (r.mrzVerified) notes.push({ tone: 'ok', text: t('crm.hotels.reservations.scan.verified', { name: who }) });
        else if (r.warnings.includes('mrz_checksum_failed')) notes.push({ tone: 'warn', text: t('crm.hotels.reservations.scan.checksumFailed', { name: who }) });
        else notes.push({ tone: 'warn', text: t('crm.hotels.reservations.scan.noMrz', { name: who }) });
        setScanNotes((prev) => [...prev, ...notes]);
      } catch (e) {
        const code = (e as { code?: string }).code;
        const known = ['AI_QUOTA_EXCEEDED', 'AI_NOT_CONFIGURED', 'AI_UNAVAILABLE', 'NOT_A_DOCUMENT', 'FILE_TOO_LARGE', 'BAD_FORMAT'];
        const text = code && known.includes(code) ? t(`crm.hotels.reservations.scan.err.${code}`) : t('crm.hotels.reservations.scan.err.generic', { error: (e as Error).message });
        setScanNotes((prev) => [...prev, { tone: 'err', text: `${f.name}: ${text}` }]);
      } finally {
        setScanning((n) => n - 1);
      }
    }
    if (scanInput.current) scanInput.current.value = '';
  };

  const [occupancyTypes, setOccupancyTypes] = useState<HotelRoomOccupancyType[]>([]);
  const [roomUnits, setRoomUnits] = useState<HotelRoomUnit[]>([]);
  const [markets, setMarkets] = useState<HotelMarket[]>([]);
  const [marketGroups, setMarketGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [marketPrices, setMarketPrices] = useState<HotelRoomMarketPrice[]>([]);
  const [roomTypeReservations, setRoomTypeReservations] = useState<HotelReservation[]>([]);
  /** auto — цена считается прайсом на сервере по ночам и пересчитывается при смене условий; manual — введена руками */
  const [priceMode, setPriceMode] = useState<'auto' | 'manual'>(initial ? (initial.priceMode === 'auto' ? 'auto' : 'manual') : 'auto');
  const [quote, setQuote] = useState<HotelQuote | null>(null);
  const [quoteError, setQuoteError] = useState('');

  // мягкая блокировка: пока форма открыта, бронь помечена «редактирует …» у остальных (продление каждые 20 с)
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const { locks } = useHotelLive([], () => {});
  useEffect(() => {
    if (!initial?.id) return;
    const id = initial.id;
    const take = () => acquireReservationLock(id).then((r) => setLockedBy(r.ok ? null : r.lock.userName)).catch(() => {});
    void take();
    const t = window.setInterval(take, 20_000);
    return () => { window.clearInterval(t); void releaseReservationLock(id).catch(() => {}); };
  }, [initial?.id]);
  const otherLock = initial ? locks.find((l) => l.reservationId === initial.id && l.userName === lockedBy) : undefined;

  const roomsForHotel = roomTypes.filter((r) => r.hotelId === hotelId);

  useEffect(() => {
    if (!hotelId) { setMarkets([]); return; }
    fetchMarkets(hotelId).then(setMarkets).catch(() => setMarkets([]));
    fetchMarketGroups(hotelId).then(setMarketGroups).catch(() => setMarketGroups([]));
  }, [hotelId]);

  useEffect(() => {
    if (!roomTypeId) { setOccupancyTypes([]); setRoomUnits([]); setMarketPrices([]); setRoomTypeReservations([]); return; }
    fetchOccupancyTypes(roomTypeId).then(setOccupancyTypes).catch(() => setOccupancyTypes([]));
    fetchRoomUnits({ roomTypeId }).then((units) => setRoomUnits(units.filter((u) => u.active))).catch(() => setRoomUnits([]));
    fetchReservations({ roomTypeId }).then(setRoomTypeReservations).catch(() => setRoomTypeReservations([]));
  }, [roomTypeId]);

  // Units already booked for an overlapping range on the picked dates — excludes this same
  // reservation's own existing booking when editing, mirrors HotelAvailabilityService's
  // excludeReservationId convention server-side.
  const occupiedUnitIds = useMemo(() => {
    const set = new Set<string>();
    if (!checkIn || !checkOut) return set;
    for (const r of roomTypeReservations) {
      if (!r.roomUnitId || r.status === 'cancelled') continue;
      if (initial && r.id === initial.id) continue;
      if (r.checkIn < checkOut && r.checkOut > checkIn) set.add(r.roomUnitId);
    }
    return set;
  }, [roomTypeReservations, checkIn, checkOut, initial]);

  // контракты партнёра по отелю и блоки по типу номера — для выбора в брони
  useEffect(() => {
    if (!agencyId || !hotelId) { setContracts([]); return; }
    fetchContracts({ agencyId, hotelId }).then((x) => setContracts(x.filter((c) => c.status === 'active' || c.id === initial?.contractId))).catch(() => setContracts([]));
  }, [agencyId, hotelId, initial?.contractId]);
  useEffect(() => {
    if (!hotelId) { setBlocks([]); return; }
    fetchRoomBlocks({ hotelId })
      .then((x) => setBlocks(x.filter((b) => (b.roomTypeId === roomTypeId || b.id === initial?.blockId) && (b.status === 'definite' || b.status === 'tentative' || b.id === initial?.blockId))))
      .catch(() => setBlocks([]));
  }, [hotelId, roomTypeId, initial?.blockId]);
  // рынок следует за страной гостя: при смене страны подставляется её рынок (выбрать другой вручную можно после)
  const prevGuestCountry = React.useRef(guestCountry);
  useEffect(() => {
    const changed = prevGuestCountry.current !== guestCountry;
    prevGuestCountry.current = guestCountry;
    if (!guestCountry || !markets.length || (market && !changed)) return;
    const m = markets.find((x) => (x.countryCodes || []).includes(guestCountry));
    if (m) setMarket(m.code);
  }, [guestCountry, markets]); // eslint-disable-line react-hooks/exhaustive-deps
  const partner = agencies.find((a) => a.id === agencyId);
  const autoContract = contracts.find((c) => c.validFrom <= (checkIn || '9999') && c.validTo >= (checkIn || '0000') && (!c.marketCountries?.length || (guestCountry && c.marketCountries.includes(guestCountry))));
  const effectiveContract = contractId === 'none' ? null : contractId ? contracts.find((c) => c.id === contractId) || null : autoContract || null;
  const childMaxAge = hotels.find((h) => h.id === hotelId)?.childMaxAge || 12;
  const guestSplit = splitGuests(adults, childAges, childMaxAge);
  // есть детская политика (контракта или отеля) — дети доплачиваются по ней, размещение подбирается по взрослым
  const childPolicy = effectiveContract?.childPolicy?.length ? effectiveContract.childPolicy : hotels.find((h) => h.id === hotelId)?.childPolicy || [];
  const kidAges = childAges.filter((a) => a === null || a < childMaxAge);
  const autoOccupancy = matchOccupancyByAges(occupancyTypes, guestSplit.adults, guestSplit.children > 0 && childPolicy.length ? [] : kidAges);
  const occupancyTypeId = occupancyOverride || autoOccupancy?.id || '';
  const occupancy = occupancyTypes.find((o) => o.id === occupancyTypeId) || null;
  // при редактировании: размещение брони не совпадает с составом — значит его выбрали вручную
  const occInit = React.useRef(false);
  useEffect(() => {
    if (occInit.current || !initial?.occupancyTypeId || !occupancyTypes.length) return;
    occInit.current = true;
    if (initial.occupancyTypeId !== autoOccupancy?.id && occupancyTypes.some((o) => o.id === initial.occupancyTypeId)) setOccupancyOverride(initial.occupancyTypeId);
  }, [occupancyTypes]); // eslint-disable-line react-hooks/exhaustive-deps
  const autoCommission = effectiveContract ? (effectiveContract.pricing === 'net' ? 0 : Number(effectiveContract.commissionPct)) : Number(partner?.commissionPct || 0);
  const nightsCount = checkIn && checkOut ? Math.max(1, Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000)) : 0;
  const roomSum = priceMode === 'auto' && quote ? quote.total : Number(grossPerNight || 0) * nightsCount;
  const totalPreview = roomSum * (1 - Number(discountPct || 0) / 100);
  const pctPreview = commissionPct !== '' ? Number(commissionPct) : autoCommission;

  // цена блока / контракта партнёра — приоритетнее рынка и прайса (пока цену не правили руками)
  const block = blocks.find((b) => b.id === blockId) || null;
  const contractRate = effectiveContract?.rooms.find((l) => l.roomTypeId === roomTypeId)?.rate ?? null;
  const partnerRate = block?.ratePerNight ?? contractRate;
  const partnerRateSource = block?.ratePerNight ? 'block' : contractRate ? 'contract' : null;
  // единый расчёт цены по ночам (блок → контракт → календарь → сезон по рынку гостя / цена рынка → база)
  const quoteContractId = blockId ? null : contractId === 'none' ? null : contractId || autoContract?.id || null;
  // тариф — только для прямой продажи по прайсу: у контракта и блока свои условия
  const planApplies = !blockId && !quoteContractId;
  const planOptions = ratePlans.filter((p) => (p.active && p.sellDirect && (!p.roomTypeIds?.length || p.roomTypeIds.includes(roomTypeId))) || p.id === ratePlanId);
  const plan = planApplies ? ratePlans.find((p) => p.id === ratePlanId) || null : null;
  // выбранный тариф не действует для нового типа номера — сбрасываем на тариф по умолчанию
  useEffect(() => {
    if (!ratePlanId || !roomTypeId) return;
    const p = ratePlans.find((x) => x.id === ratePlanId);
    if (p && p.roomTypeIds?.length && !p.roomTypeIds.includes(roomTypeId)) setRatePlanId(ratePlans.find((x) => x.isDefault && x.active && (!x.roomTypeIds?.length || x.roomTypeIds.includes(roomTypeId)))?.id || '');
  }, [roomTypeId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (priceMode !== 'auto') return;
    if (!roomTypeId || !checkIn || !checkOut || checkOut <= checkIn) { setQuote(null); return; }
    const timer = window.setTimeout(() => {
      fetchQuote({
        roomTypeId, occupancyTypeId: occupancyTypeId || undefined, adults, childAges, checkIn, checkOut, market: market || undefined, guestCountry: guestCountry || undefined,
        contractId: quoteContractId || undefined, blockId: blockId || undefined, ratePlanId: planApplies ? ratePlanId || 'none' : undefined,
        // акции: как у сервера при сохранении — дата брони (раннее бронирование) у существующей брони — день её создания
        promotions: promotionsOff || initial?.source === 'channel' ? 'none' : 'auto',
        salesChannel: initial?.source === 'website' ? 'website' : 'direct',
        bookedAt: initial?.createdAt || undefined,
      })
        .then((q) => {
          setQuote(q);
          setQuoteError('');
          setGrossPerNight(String(q.average));
          setPpPerNight(String(q.ppAverage || q.seasonAverage || q.average));
        })
        .catch((e) => { setQuote(null); setQuoteError(hotelErrorText(t, e, '')); });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [priceMode, roomTypeId, occupancyTypeId, adults, childAges.join(','), checkIn, checkOut, market, guestCountry, quoteContractId, blockId, ratePlanId, planApplies, promotionsOff]); // eslint-disable-line react-hooks/exhaustive-deps
  // предоплату считает сервер (тариф и условия акций), пока её не правили руками
  const serverDeposit = !depositTouched && (!!plan || !!quote?.promotions?.some((p) => p.prepaymentPct > 0) || !!initial?.promotions?.some((p) => p.prepaymentPct > 0));

  // акции контракта — только для новой брони и пока скидку не правили руками
  const discountTouched = React.useRef(false);
  const promo = contractPromotionDiscount(effectiveContract, checkIn, checkOut, new Date().toISOString().slice(0, 10));
  useEffect(() => {
    if (initial || discountTouched.current) return;
    setDiscountPct(String(promo.pct));
  }, [promo.pct]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    if (!guestName.trim() || !hotelId || !roomTypeId || !checkIn || !checkOut) {
      showAlert(t('crm.hotels.reservations.modal.requiredError'), { variant: 'error' });
      return;
    }
    if (isComp && !compReason) {
      showAlert(t('crm.hotels.lifecycle.errors.HOTEL_COMP_REASON_REQUIRED'), { variant: 'error' });
      return;
    }
    if (isOption && canOption && !(Date.parse(optionUntil) > Date.now())) {
      showAlert(t('crm.hotels.lifecycle.optionPast'), { variant: 'error' });
      return;
    }
    setSaving(true);
    const optionDto: Partial<HotelReservation> = !canOption
      ? {}
      : isOption
        ? { status: 'pending', optionUntil: new Date(optionUntil).toISOString() }
        : initial?.optionUntil
          ? { optionUntil: null, ...(initial.status === 'pending' ? { status: 'confirmed' as const } : {}) }
          : {};
    const dto = {
      ...optionDto,
      ...(initial?.updatedAt ? { expectedUpdatedAt: initial.updatedAt } : {}),
      priceMode,
      isComplimentary: isComp,
      compReason: isComp ? compReason || null : null,
      compNote: isComp ? compNote || null : null,
      hotelId,
      roomTypeId,
      agencyId: agencyId || null,
      roomUnitId: roomUnitId || null,
      occupancyTypeId: occupancyTypeId || null,
      guestName,
      guestEmail: guestEmail || null,
      guestPhone: guestPhone || null,
      adults,
      childAges,
      market: market || null,
      checkIn,
      checkOut,
      costPerNight,
      ppPerNight,
      grossPerNight,
      discountPct,
      // предоплату по тарифу считает сервер, если её не правили руками
      ...(serverDeposit ? {} : { depositAmount }),
      ratePlanId: planApplies ? ratePlanId || 'none' : null,
      ...(planApplies && priceMode === 'auto' && promotionsOff !== !!initial?.promotionsOff ? { promotionsOff } : {}),
      earlyCheckIn,
      lateCheckOut,
      notes: notes || null,
      guests,
      guestCountry,
      saleCountry,
      marketId: markets.find((m) => m.code === market)?.id ?? null,
      ...(contractId === '' ? {} : { contractId: contractId === 'none' ? null : contractId }),
      blockId: blockId || null,
      ...(plan ? {} : { boardType: boardType || null }),
      ...(commissionPct !== '' ? { commissionPct } : {}),
    } as Partial<HotelReservation>;
    const req = initial ? updateReservation(initial.id, dto) : createReservation(dto);
    req
      .then((r) => onSaved(r))
      .catch((e) => showAlert(hotelErrorText(t, e, t('crm.hotels.reservations.modal.saveError')), { variant: 'error' }))
      .finally(() => setSaving(false));
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal htl-res-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bk-modal-head">
          <h3>{initial ? t('crm.hotels.reservations.modal.titleEdit') : t('crm.hotels.reservations.modal.titleNew')}</h3>
          <button onClick={onClose}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="bk-modal-body">
          {lockedBy && <div className="pe-box warn" style={{ marginTop: 0, marginBottom: 12 }}>{t('crm.hotels.live.lockedBy', { name: otherLock?.userName || lockedBy })}</div>}
          <label>{t('crm.hotels.reservations.modal.guestLabel')}</label>
          <input value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          <div className="bk-row2">
            <div><label>{t('crm.hotels.reservations.modal.guestEmailLabel')}</label><input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} /></div>
            <div><label>{t('crm.hotels.reservations.modal.guestPhoneLabel')}</label><input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} /></div>
          </div>
          <div className="bk-row2">
            <div>
              <label>{t('crm.hotels.reservations.modal.hotelLabel')}</label>
              <select value={hotelId} onChange={(e) => { setHotelId(e.target.value); setRoomTypeId(''); setOccupancyOverride(''); setRoomUnitId(''); }}>
                {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div>
              <label>{t('crm.hotels.reservations.modal.roomTypeLabel')}</label>
              <select value={roomTypeId} onChange={(e) => { setRoomTypeId(e.target.value); setOccupancyOverride(''); setRoomUnitId(''); }}>
                <option value="">{t('crm.hotels.reservations.modal.roomTypeNone')}</option>
                {roomsForHotel.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <div className="bk-row2">
            <div><label>{t('crm.hotels.reservations.modal.checkInLabel')}</label><DateInput value={checkIn} onChange={(v) => setCheckIn(v)} /></div>
            <div><label>{t('crm.hotels.reservations.modal.checkOutLabel')}</label><DateInput value={checkOut} onChange={(v) => setCheckOut(v)} /></div>
          </div>
          <label>{t('crm.hotels.guestsPicker.title')}</label>
          <GuestsPicker adults={adults} childAges={childAges} childMaxAge={childMaxAge} onChange={(a, ages) => { setAdults(a); setChildAges(ages); setOccupancyOverride(''); }} />
          <div className="bk-row2">
            <div>
              <label>{t('crm.hotels.reservations.modal.occupancyLabel')}</label>
              <select value={occupancyOverride} onChange={(e) => setOccupancyOverride(e.target.value)} disabled={!roomTypeId}>
                <option value="">
                  {autoOccupancy
                    ? t('crm.hotels.guestsPicker.occAuto', { label: autoOccupancy.label, coef: Number(autoOccupancy.coefficient) })
                    : t('crm.hotels.guestsPicker.occAutoNone')}
                </option>
                {occupancyTypes.map((o) => <option key={o.id} value={o.id}>{o.label} · ×{Number(o.coefficient)}</option>)}
              </select>
              {roomTypeId && occupancyTypes.length > 0 && !occupancy && (
                <div className="gp-note warn">{t('crm.hotels.guestsPicker.noMatch', { adults: guestSplit.adults, children: guestSplit.children })}</div>
              )}
            </div>
            <div>
              <label>{t('crm.hotels.reservations.modal.roomLabel')}</label>
              <select value={roomUnitId} onChange={(e) => setRoomUnitId(e.target.value)} disabled={!roomTypeId}>
                <option value="">{t('crm.hotels.reservations.modal.roomNone')}</option>
                {roomUnits.map((u) => {
                  const occupied = occupiedUnitIds.has(u.id);
                  return (
                    <option key={u.id} value={u.id} disabled={occupied} style={{ color: occupied ? '#d64545' : '#2f9e5c' }}>
                      {u.label}{occupied ? t('crm.hotels.reservations.modal.roomOccupiedSuffix') : t('crm.hotels.reservations.modal.roomFreeSuffix')}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="htl-form-sec" style={{ marginTop: 14 }}>{t('crm.hotels.reservations.modal.secPartner')}</div>
          <div className="bk-row2">
            <div>
              <label>{t('crm.hotels.reservations.modal.partnerLabel')}</label>
              <select value={agencyId} onChange={(e) => { setAgencyId(e.target.value); setContractId(''); }}>
                <option value="">{t('crm.hotels.reservations.modal.directSale')}</option>
                {agencies.filter((a) => a.status !== 'archived' || a.id === agencyId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label>{t('crm.hotels.reservations.modal.contractLabel')}</label>
              <select value={contractId} onChange={(e) => setContractId(e.target.value)} disabled={!agencyId}>
                <option value="">{autoContract ? t('crm.hotels.reservations.modal.contractAuto', { name: autoContract.name }) : t('crm.hotels.reservations.modal.contractAutoNone')}</option>
                <option value="none">{t('crm.hotels.reservations.modal.contractNone')}</option>
                {contracts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="bk-row2">
            <div>
              <label>{t('crm.hotels.reservations.modal.blockLabel')}</label>
              <select value={blockId} onChange={(e) => setBlockId(e.target.value)} disabled={!blocks.length}>
                <option value="">—</option>
                {blocks.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.dateFrom} — {b.dateTo}</option>)}
              </select>
            </div>
            {planApplies && ratePlans.length > 0 ? (
              <div>
                <label>{t('crm.hotels.ratePlans.formLabel')}</label>
                <select value={ratePlanId} onChange={(e) => setRatePlanId(e.target.value)}>
                  <option value="">{t('crm.hotels.ratePlans.noPlan')}</option>
                  {planOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name} · {p.boardType}{p.refundable ? '' : ` · ${t('crm.hotels.ratePlans.nrfShort')}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {!plan && <div>
              <label>{t('crm.hotels.reservations.modal.boardLabel')}</label>
              <select value={boardType} onChange={(e) => setBoardType(e.target.value)}>
                <option value="">{effectiveContract ? t('crm.hotels.reservations.modal.fromContract', { v: effectiveContract.boardType }) : '—'}</option>
                {HOTEL_BOARD_TYPES.map((b) => <option key={b} value={b}>{b} · {t(`crm.hotels.board.${b}`)}</option>)}
              </select>
            </div>}
          </div>
          {plan && (
            <div className="rtp-terms">
              <span>{plan.boardType} · {t(`crm.hotels.board.${plan.boardType}`)}</span>
              <span className={plan.refundable ? 'ok' : 'nrf'}>{plan.refundable ? t('crm.hotels.ratePlans.refundable') : t('crm.hotels.ratePlans.nonRefundable')}</span>
              {quote?.prepayment && quote.prepayment.amount > 0 && (
                <span>{t('crm.hotels.ratePlans.prepayLine', { amount: money(quote.prepayment.amount, hotels.find((h) => h.id === hotelId)?.currency, i18n.language), date: quote.prepayment.dueDate ? new Date(`${quote.prepayment.dueDate}T00:00:00`).toLocaleDateString(i18n.language) : '—' })}</span>
              )}
            </div>
          )}
          <div className="bk-row2">
            <div>
              <label>{t('crm.hotels.reservations.modal.commissionLabel')}</label>
              <input type="number" min={0} max={100} step="0.5" value={commissionPct} placeholder={t('crm.hotels.reservations.modal.commissionAuto', { v: autoCommission })} onChange={(e) => setCommissionPct(e.target.value)} />
            </div>
            <div>
              <label>{t('crm.hotels.reservations.modal.netPreviewLabel')}</label>
              <div className="htl-readonly">
                {nightsCount ? `${Math.round(totalPreview - (totalPreview * pctPreview) / 100).toLocaleString(i18n.language)} · ${t('crm.hotels.reservations.modal.commissionShort', { v: Math.round((totalPreview * pctPreview) / 100).toLocaleString(i18n.language) })}` : '—'}
              </div>
            </div>
          </div>

          <div className="htl-form-sec" style={{ marginTop: 14 }}>{t('crm.hotels.reservations.modal.secCountries')}</div>
          <div className="bk-row2">
            <div>
              <label>{t('crm.hotels.reservations.modal.guestCountryLabel')}</label>
              <CountrySelect value={guestCountry} onChange={setGuestCountry} />
            </div>
            <div>
              <label>{t('crm.hotels.reservations.modal.saleCountryLabel')}</label>
              <CountrySelect value={saleCountry} onChange={setSaleCountry} placeholder={partner?.countryCode ? t('crm.hotels.reservations.modal.saleCountryAuto') : undefined} />
            </div>
          </div>
          <label>{t('crm.hotels.reservations.modal.marketLabel')}</label>
          <select value={market} onChange={(e) => setMarket(e.target.value)} disabled={!markets.length}>
            <option value="">—</option>
            {markets.map((m) => <option key={m.id} value={m.code}>{m.name} ({m.code})</option>)}
          </select>
          {!markets.length && hotelId && (
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>{t('crm.hotels.reservations.modal.noMarketsHint')}</div>
          )}
          {promo.applied.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: '#175c3d' }}>
              {t('crm.hotels.reservations.modal.promoApplied', { names: promo.applied.map((p) => `${p.name} −${p.discountPct}%`).join(', ') })}
            </div>
          )}
          <QuoteBreakdown
            mode={priceMode}
            quote={quote}
            error={quoteError}
            currency={hotels.find((h) => h.id === hotelId)?.currency}
            netContract={effectiveContract?.pricing === 'net' && !blockId}
            marketGroupName={quote?.marketGroupId ? marketGroups.find((g) => g.id === quote.marketGroupId)?.name : undefined}
            onAuto={() => setPriceMode('auto')}
            promotionsOff={promotionsOff}
            onTogglePromotions={planApplies && initial?.source !== 'channel' ? setPromotionsOff : undefined}
          />
          <div className="bk-row2" style={{ marginTop: 8 }}>
            <div><label>{t('crm.hotels.reservations.modal.costPerNightLabel')}</label><input value={costPerNight} onChange={(e) => setCostPerNight(e.target.value)} /></div>
            <div><label>{t('crm.hotels.reservations.modal.ppPerNightLabel')}</label><input value={ppPerNight} onChange={(e) => { setPriceMode('manual'); setPpPerNight(e.target.value); }} /></div>
          </div>
          <div className="bk-row2">
            <div><label>{t('crm.hotels.reservations.modal.grossPerNightLabel')}</label><input value={grossPerNight} onChange={(e) => { setPriceMode('manual'); setGrossPerNight(e.target.value); }} /></div>
            <div><label>{t('crm.hotels.reservations.modal.discountLabel')}</label><input value={discountPct} onChange={(e) => { discountTouched.current = true; setDiscountPct(e.target.value); }} /></div>
          </div>
          <label>{t('crm.hotels.reservations.modal.depositLabel')}</label>
          <input value={serverDeposit && priceMode === 'auto' ? String(quote?.prepayment?.amount ?? 0) : depositAmount} onChange={(e) => { setDepositTouched(true); setDepositAmount(e.target.value); }} />
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer', margin: 0 }}>
              <input type="checkbox" checked={earlyCheckIn} onChange={(e) => setEarlyCheckIn(e.target.checked)} />
              {t('crm.hotels.reservations.modal.earlyCheckIn')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer', margin: 0 }}>
              <input type="checkbox" checked={lateCheckOut} onChange={(e) => setLateCheckOut(e.target.checked)} />
              {t('crm.hotels.reservations.modal.lateCheckOut')}
            </label>
          </div>
          <div className="htl-life-box">
            {canOption && (
              <div className="row">
                <label className="chk"><input type="checkbox" checked={isOption} onChange={(e) => setIsOption(e.target.checked)} />{t('crm.hotels.lifecycle.optionToggle')}</label>
                {isOption && <input type="datetime-local" value={optionUntil} onChange={(e) => setOptionUntil(e.target.value)} />}
                <span className="hint">{t('crm.hotels.lifecycle.optionHint')}</span>
              </div>
            )}
            <div className="row">
              <label className="chk"><input type="checkbox" checked={isComp} onChange={(e) => setIsComp(e.target.checked)} />{t('crm.hotels.lifecycle.compToggle')}</label>
              {isComp && (
                <>
                  <select value={compReason} onChange={(e) => setCompReason(e.target.value)}>
                    <option value="">{t('crm.hotels.lifecycle.pickCompReason')}</option>
                    {HOTEL_COMP_REASONS.map((r) => <option key={r} value={r}>{t(`crm.hotels.lifecycle.compReasons.${r}`)}</option>)}
                  </select>
                  <input value={compNote} onChange={(e) => setCompNote(e.target.value)} placeholder={t('crm.hotels.lifecycle.compNotePh')} />
                </>
              )}
              <span className="hint">{t('crm.hotels.lifecycle.compHint')}</span>
            </div>
          </div>
          <label style={{ marginTop: 8 }}>{t('crm.hotels.reservations.modal.notesLabel')}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line-2)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <label style={{ margin: 0 }}>{t('crm.hotels.reservations.modal.guestsLabel')}</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                ref={scanInput}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => void scanFiles(e.target.files)}
              />
              <button
                type="button"
                className="btn btn-sm"
                disabled={scanning > 0}
                title={t('crm.hotels.reservations.scan.hint')}
                onClick={() => scanInput.current?.click()}
              >
                <Ic d={HTL_ICON.scan} size={12} />
                {scanning > 0 ? t('crm.hotels.reservations.scan.busy', { count: scanning }) : t('crm.hotels.reservations.scan.button')}
              </button>
              <button type="button" className="btn btn-sm" onClick={addGuestRow}><Ic d={HTL_ICON.plus} size={12} />{t('crm.hotels.reservations.modal.addGuest')}</button>
            </div>
          </div>
          {scanNotes.length > 0 && (
            <div className="htl-scan-notes">
              {scanNotes.map((n, i) => (
                <div key={i} className={`htl-scan-note ${n.tone}`}>{n.text}</div>
              ))}
              <div className="htl-scan-note muted">{t('crm.hotels.reservations.scan.privacy')}</div>
            </div>
          )}
          {guests.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 6 }}>{t('crm.hotels.reservations.modal.noGuests')}</div>
          )}
          {guests.map((g, gi) => (
            <div key={g.id} style={{ border: '1px solid var(--line-2)', borderRadius: 10, padding: 10, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{t('crm.hotels.reservations.modal.guestN', { n: gi + 1 })}</span>
                <button
                  type="button"
                  onClick={() => removeGuestRow(g.id)}
                  title={t('crm.hotels.reservations.modal.removeGuestTitle')}
                  style={{ background: 'none', border: 'none', color: '#9a1f31', cursor: 'pointer', display: 'flex' }}
                >
                  <Ic d={HTL_ICON.x} size={13} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  placeholder={t('crm.hotels.reservations.modal.guestFullNamePlaceholder')}
                  value={g.fullName}
                  onChange={(e) => updateGuestRow(g.id, { fullName: e.target.value })}
                  style={{ flex: 2, minWidth: 0, padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }}
                />
                <input
                  placeholder={t('crm.hotels.reservations.modal.guestCitizenshipPlaceholder')}
                  value={g.citizenship}
                  onChange={(e) => updateGuestRow(g.id, { citizenship: e.target.value })}
                  style={{ flex: 1, minWidth: 0, padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }}
                />
                <input
                  placeholder={t('crm.hotels.reservations.modal.guestAgePlaceholder')}
                  value={g.age}
                  onChange={(e) => updateGuestRow(g.id, { age: e.target.value })}
                  style={{ width: 70, padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input
                  placeholder={t('crm.hotels.reservations.modal.guestPassportPlaceholder')}
                  value={g.passportNumber}
                  onChange={(e) => updateGuestRow(g.id, { passportNumber: e.target.value })}
                  style={{ flex: 1, minWidth: 0, padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t('crm.hotels.reservations.modal.guestPassportExpiryLabel')}</label>
                  <DateInput
                    value={g.passportExpiry}
                    onChange={(v) => updateGuestRow(g.id, { passportExpiry: v })}
                    style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }} />
                </div>
                <input
                  placeholder={t('crm.hotels.reservations.modal.guestNotePlaceholder')}
                  value={g.note || ''}
                  onChange={(e) => updateGuestRow(g.id, { note: e.target.value || null })}
                  style={{ flex: 1, minWidth: 0, padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t('crm.hotels.reservations.modal.guestBirthDateLabel')}</label>
                  <DateInput
                    value={g.birthDate || ''}
                    onChange={(v) =>
                      updateGuestRow(g.id, { birthDate: v, ...(v ? { age: ageOn(v, checkIn) } : {}) })
                    }
                    style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t('crm.hotels.reservations.modal.guestGenderLabel')}</label>
                  <select
                    value={g.gender || ''}
                    onChange={(e) => updateGuestRow(g.id, { gender: e.target.value as HotelReservationGuest['gender'] })}
                    style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }}
                  >
                    <option value="">—</option>
                    <option value="M">{t('crm.hotels.reservations.modal.genderM')}</option>
                    <option value="F">{t('crm.hotels.reservations.modal.genderF')}</option>
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t('crm.hotels.reservations.modal.guestDocTypeLabel')}</label>
                  <select
                    value={g.documentType || ''}
                    onChange={(e) => updateGuestRow(g.id, { documentType: e.target.value as HotelReservationGuest['documentType'] })}
                    style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }}
                  >
                    <option value="">—</option>
                    <option value="passport">{t('crm.hotels.reservations.modal.docPassport')}</option>
                    <option value="id_card">{t('crm.hotels.reservations.modal.docIdCard')}</option>
                    <option value="other">{t('crm.hotels.reservations.modal.docOther')}</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t('crm.hotels.reservations.modal.guestNationalityLabel')}</label>
                  <CountrySelect value={g.nationalityCode || null} onChange={(c) => updateGuestRow(g.id, { nationalityCode: c })} />
                </div>
                {g.nationalityCode === 'TR' && (
                  <>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <label style={{ fontSize: 10, color: 'var(--fg-3)' }}>T.C. Kimlik No</label>
                      <input
                        value={g.tcKimlikNo || ''}
                        maxLength={11}
                        inputMode="numeric"
                        onChange={(e) => updateGuestRow(g.id, { tcKimlikNo: e.target.value.replace(/\D/g, '') })}
                        style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5, fontFamily: 'var(--ff-mono)' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <label style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t('crm.hotels.reservations.modal.guestFatherLabel')}</label>
                      <input value={g.fatherName || ''} onChange={(e) => updateGuestRow(g.id, { fatherName: e.target.value })} style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <label style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t('crm.hotels.reservations.modal.guestMotherLabel')}</label>
                      <input value={g.motherName || ''} onChange={(e) => updateGuestRow(g.id, { motherName: e.target.value })} style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }} />
                    </div>
                  </>
                )}
              </div>
              {isRussiaCountry(hotels.find((h) => h.id === hotelId)?.country) && g.nationalityCode && g.nationalityCode !== 'RU' && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {([
                    ['birthPlace', 'guestBirthPlaceLabel', 'text'],
                    ['documentIssueDate', 'guestDocIssueLabel', 'date'],
                    ['migrationCard', 'guestMigrationCardLabel', 'text'],
                    ['visaNumber', 'guestVisaLabel', 'text'],
                  ] as const).map(([k, label, type]) => (
                    <div key={k} style={{ flex: '1 1 140px', minWidth: 0 }}>
                      <label style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t(`crm.hotels.reservations.modal.${label}`)}</label>
                      <input
                        type={type}
                        value={(g[k] as string) || ''}
                        onChange={(e) => updateGuestRow(g.id, { [k]: e.target.value } as Partial<HotelReservationGuest>)}
                        style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }}
                      />
                    </div>
                  ))}
                  <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                    <label style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t('crm.hotels.reservations.modal.guestPurposeLabel')}</label>
                    <select
                      value={g.entryPurpose || ''}
                      onChange={(e) => updateGuestRow(g.id, { entryPurpose: e.target.value as HotelReservationGuest['entryPurpose'] })}
                      style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }}
                    >
                      <option value="">—</option>
                      {(['tourism', 'business', 'private', 'work', 'study', 'other'] as const).map((x) => (
                        <option key={x} value={x}>{t(`crm.hotels.reservations.modal.purpose.${x}`)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>{t('crm.hotels.reservations.modal.cancel')}</button>
          <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
            <Ic d={HTL_ICON.check} size={14} />{initial ? t('crm.hotels.reservations.modal.save') : t('crm.hotels.reservations.modal.create')}
          </button>
        </div>
      </div>
    </div>
  );
};

const ImportModal: React.FC<{ hotels: Hotel[]; onClose: () => void; onDone: () => void }> = ({ hotels, onClose, onDone }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [preview, setPreview] = useState<HotelReservationImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [defaultHotelId, setDefaultHotelId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: Array<{ row: number; message: string }>; total: number } | null>(null);

  const handleFile = (file: File) => {
    setBusy(true);
    previewReservationsImport(file)
      .then((p) => {
        setPreview(p);
        setMapping(p.suggestedMapping);
      })
      .catch((e) => showAlert(e.message || t('crm.hotels.reservations.importModal.readError'), { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  const handleApply = () => {
    if (!preview) return;
    setBusy(true);
    applyReservationsImport({ importId: preview.importId, mapping, defaultHotelId: defaultHotelId || undefined })
      .then(setResult)
      .catch((e) => showAlert(e.message || t('crm.hotels.reservations.importModal.applyError'), { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, calc(100vw - 32px))' }}>
        <div className="bk-modal-head">
          <h3>{t('crm.hotels.reservations.importModal.title')}</h3>
          <button onClick={onClose}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="bk-modal-body">
          {!preview && !result && (
            <div style={{ border: '1.5px dashed var(--line-2)', borderRadius: 12, padding: '28px 20px', textAlign: 'center', color: 'var(--fg-3)' }}>
              <Ic d={HTL_ICON.download} size={22} style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: 13, marginBottom: 4 }}>{t('crm.hotels.reservations.importModal.dropHint')}</div>
              <div style={{ fontSize: 11.5 }}>{t('crm.hotels.reservations.importModal.formatHint')}</div>
              <label className="btn btn-sm" style={{ marginTop: 14, display: 'inline-flex', cursor: 'pointer' }}>
                {t('crm.hotels.reservations.importModal.chooseFile')}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>
            </div>
          )}

          {preview && !result && (
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-3)', marginBottom: 10 }}>
                {t('crm.hotels.reservations.importModal.foundRows', { count: preview.totalRows })}
              </div>
              {preview.mappableFields.map((f) => (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 140, fontSize: 12 }}>{f.label}</span>
                  <select
                    style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--line-2)', borderRadius: 6 }}
                    value={mapping[f.key] || ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || null }))}
                  >
                    <option value="">—</option>
                    {preview.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
              {hotels.length > 1 && (
                <>
                  <label>{t('crm.hotels.reservations.importModal.defaultHotelLabel')}</label>
                  <select value={defaultHotelId} onChange={(e) => setDefaultHotelId(e.target.value)}>
                    <option value="">—</option>
                    {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </>
              )}
            </div>
          )}

          {result && (
            <div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>{t('crm.hotels.reservations.importModal.createdOf', { created: result.created, total: result.total })}</div>
              {result.errors.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 12, color: '#cc2f47' }}>
                  {result.errors.map((e, i) => <div key={i}>{t('crm.hotels.reservations.importModal.rowError', { row: e.row, message: e.message })}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>{result ? t('crm.hotels.reservations.importModal.close') : t('crm.hotels.reservations.importModal.cancel')}</button>
          {preview && !result && (
            <button className="btn btn-primary" disabled={busy} onClick={handleApply}>
              <Ic d={HTL_ICON.check} size={14} />{t('crm.hotels.reservations.importModal.upload')}
            </button>
          )}
          {result && (
            <button className="btn btn-primary" onClick={onDone}>{t('crm.hotels.reservations.importModal.done')}</button>
          )}
        </div>
      </div>
    </div>
  );
};
