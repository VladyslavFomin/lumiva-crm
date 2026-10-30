import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../../layout/MainLayout';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
import { CountryTag } from '../CountrySelect';
import { PartnerForm, type PartnerDraft } from './PartnerForm';
import { CountryTable } from './CountryTable';
import { PartnerStatementTab } from './PartnerStatementTab';
import { money, fmtDate, todayIso, addDaysIso } from './partnerUtils';
import {
  deletePartner,
  fetchContracts,
  fetchHotelAnalyticsSummary,
  fetchHotels,
  fetchPartner,
  fetchReservations,
  fetchRoomBlocks,
  fetchAllRoomTypes,
  updatePartner,
  type Hotel,
  type HotelAgency,
  type HotelAnalyticsSummary,
  type HotelContract,
  type HotelReservation,
  type HotelRoomBlock,
  type HotelRoomType,
} from '../../../api/hotels';
import '../hotels-design.css';
import { DateInput } from '../../../components/ui/DateInput';

type Tab = 'profile' | 'contracts' | 'blocks' | 'bookings' | 'statement' | 'analytics';
const TABS: Tab[] = ['profile', 'contracts', 'blocks', 'bookings', 'statement', 'analytics'];

export const HotelPartnerPage: React.FC = () => {
  const { id = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const tab = (TABS.includes(sp.get('tab') as Tab) ? sp.get('tab') : 'profile') as Tab;
  const { t, i18n } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`crm.hotels.partners.${k}`, o);
  const lang = i18n.language;
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [partner, setPartner] = useState<HotelAgency | null>(null);
  const [draft, setDraft] = useState<PartnerDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const [contracts, setContracts] = useState<HotelContract[]>([]);
  const [blocks, setBlocks] = useState<HotelRoomBlock[]>([]);
  const [bookings, setBookings] = useState<HotelReservation[] | null>(null);
  const [summary, setSummary] = useState<HotelAnalyticsSummary | null>(null);
  const [range, setRange] = useState({ from: addDaysIso(todayIso(), -365), to: addDaysIso(todayIso(), 365) });

  useEffect(() => {
    fetchPartner(id)
      .then((x) => {
        setPartner(x);
        setDraft(x);
      })
      .catch((e) => showAlert(e.message, { variant: 'error' }));
    fetchHotels()
      .then((h) => {
        setHotels(h);
        return fetchAllRoomTypes(h);
      })
      .then(setRoomTypes)
      .catch(() => undefined);
    fetchContracts({ agencyId: id }).then(setContracts).catch(() => undefined);
    fetchRoomBlocks({ agencyId: id }).then(setBlocks).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (tab === 'bookings' && bookings === null) fetchReservations({ agencyId: id }).then(setBookings).catch(() => setBookings([]));
    if (tab === 'analytics') {
      fetchHotelAnalyticsSummary({ agencyId: id, dateFrom: range.from, dateTo: range.to })
        .then(setSummary)
        .catch((e) => showAlert(e.message, { variant: 'error' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id, range.from, range.to]);

  const hotelName = useMemo(() => new Map(hotels.map((h) => [h.id, h.name])), [hotels]);
  const rtName = useMemo(() => new Map(roomTypes.map((r) => [r.id, r.name])), [roomTypes]);
  const dirty = !!partner && !!draft && JSON.stringify(partner) !== JSON.stringify(draft);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await updatePartner(id, draft);
      setPartner(saved);
      setDraft(saved);
      showAlert(p('saved'), { variant: 'success' });
    } catch (e) {
      showAlert((e as Error).message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(p('deleteConfirm'))) return;
    try {
      const r = await deletePartner(id);
      if (r.archived) {
        showAlert(p('archivedMsg'), { variant: 'success' });
        setPartner((x) => (x ? { ...x, status: 'archived' } : x));
        setDraft((x) => (x ? { ...x, status: 'archived' } : x));
      } else navigate('/hotels/partners');
    } catch (e) {
      showAlert((e as Error).message, { variant: 'error' });
    }
  };

  if (!partner || !draft) {
    return (
      <MainLayout>
        <div className="px-scope"><HotelsSubnav active="partners" /><div className="htl-sub" style={{ padding: 24 }}>{t('crm.hotels.common.loading')}</div></div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="px-scope">
        <HotelsSubnav active="partners" />
        <div className="htl-hero">
          <div>
            <div className="kicker">
              <span className="dot" />
              <button className="htl-crumb" onClick={() => navigate('/hotels/partners')}>{p('title')}</button>
              {' · '}{t(`crm.hotels.partners.types.${partner.type}`)}
            </div>
            <h1>
              {partner.name}
              {partner.status === 'archived' && <span className="bk-badge draft" style={{ marginLeft: 10, verticalAlign: 'middle' }}>{p('archived')}</span>}
            </h1>
            <p className="sub">
              <CountryTag code={partner.countryCode} empty={p('noCountry')} />
              {partner.city ? ` · ${partner.city}` : ''}
              {Number(partner.commissionPct) ? ` · ${p('commissionShort', { v: Number(partner.commissionPct) })}` : ''}
            </p>
          </div>
          <div className="htl-hero-r">
            {partner.status === 'archived' ? (
              <button className="btn" onClick={() => updatePartner(id, { status: 'active' }).then((x) => { setPartner(x); setDraft(x); })}>{p('restore')}</button>
            ) : (
              <button className="btn btn-danger" onClick={remove}>{p('delete')}</button>
            )}
            <button className="btn btn-primary" onClick={() => navigate(`/hotels/contracts/new?agencyId=${id}`)}>
              <Ic d={HTL_ICON.plus} size={14} />{p('newContract')}
            </button>
          </div>
        </div>

        <div className="htl-detail-tabs" style={{ marginTop: 14 }}>
          {TABS.map((k) => (
            <div key={k} className={`htl-detail-tab${tab === k ? ' active' : ''}`} onClick={() => setSp({ tab: k })}>
              {p(`tabs.${k}`)}
              {k === 'contracts' && contracts.length > 0 && <em className="htl-count">{contracts.length}</em>}
              {k === 'blocks' && blocks.length > 0 && <em className="htl-count">{blocks.length}</em>}
            </div>
          ))}
        </div>

        {tab === 'profile' && (
          <div className="htl-panel">
            <PartnerForm value={draft} onChange={setDraft} columns={4} />
            <div className="htl-panel-foot">
              {dirty && <span className="htl-sub">{p('unsaved')}</span>}
              <button className="btn" disabled={!dirty} onClick={() => setDraft(partner)}>{t('crm.hotels.common.cancel')}</button>
              <button className="btn btn-primary" disabled={!dirty || saving} onClick={save}><Ic d={HTL_ICON.check} size={14} />{t('crm.hotels.common.save')}</button>
            </div>
          </div>
        )}

        {tab === 'contracts' && (
          contracts.length === 0 ? (
            <div className="htl-empty">
              <h4>{p('contractsEmptyTitle')}</h4>
              <p>{p('contractsEmptyBody')}</p>
              <button className="btn btn-primary" onClick={() => navigate(`/hotels/contracts/new?agencyId=${id}`)}><Ic d={HTL_ICON.plus} size={14} />{p('newContract')}</button>
            </div>
          ) : (
            <div className="bk-table-wrap">
              <table className="bk-table htl-click-rows">
                <thead>
                  <tr>
                    <th>{t('crm.hotels.contracts.col.name')}</th>
                    <th>{t('crm.hotels.contracts.col.hotel')}</th>
                    <th>{t('crm.hotels.contracts.col.period')}</th>
                    <th>{t('crm.hotels.contracts.col.pricing')}</th>
                    <th>{t('crm.hotels.contracts.col.board')}</th>
                    <th>{t('crm.hotels.contracts.col.release')}</th>
                    <th>{t('crm.hotels.contracts.col.allotment')}</th>
                    <th>{t('crm.hotels.contracts.col.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id} onClick={() => navigate(`/hotels/contracts/${c.id}`)}>
                      <td><div style={{ fontWeight: 600 }}>{c.name}</div><div className="htl-sub mono">{c.code || ''}</div></td>
                      <td>{hotelName.get(c.hotelId) || '—'}</td>
                      <td className="mono">{fmtDate(c.validFrom, lang)} — {fmtDate(c.validTo, lang)}</td>
                      <td>{c.pricing === 'net' ? t('crm.hotels.contracts.pricing.net') : `${t('crm.hotels.contracts.pricing.commission')} ${Number(c.commissionPct)}%`}</td>
                      <td className="mono">{c.boardType}</td>
                      <td className="mono">{c.releaseDays} {p('days')}{c.guaranteed ? ` · ${t('crm.hotels.contracts.guaranteedShort')}` : ''}</td>
                      <td className="mono">{c.rooms.reduce((s, r) => s + r.allotment, 0) || '—'}</td>
                      <td><span className={`bk-badge ${c.status === 'active' ? 'completed' : c.status === 'draft' ? 'draft' : c.status === 'cancelled' ? 'rejected' : 'no_show'}`}>{t(`crm.hotels.contracts.status.${c.status}`)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === 'blocks' && (
          blocks.length === 0 ? (
            <div className="htl-empty">
              <h4>{p('blocksEmptyTitle')}</h4>
              <p>{p('blocksEmptyBody')}</p>
              <button className="btn" onClick={() => navigate('/hotels/inventory')}>{p('openInventory')}</button>
            </div>
          ) : (
            <div className="bk-table-wrap">
              <table className="bk-table">
                <thead>
                  <tr>
                    <th>{t('crm.hotels.blocks.col.name')}</th>
                    <th>{t('crm.hotels.blocks.col.hotelRoom')}</th>
                    <th>{t('crm.hotels.blocks.col.dates')}</th>
                    <th>{t('crm.hotels.blocks.col.rooms')}</th>
                    <th>{t('crm.hotels.blocks.col.cutoff')}</th>
                    <th>{t('crm.hotels.blocks.col.pickup')}</th>
                    <th>{t('crm.hotels.blocks.col.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600 }}>{b.name}</td>
                      <td>{hotelName.get(b.hotelId) || '—'}<div className="htl-sub">{rtName.get(b.roomTypeId) || ''}</div></td>
                      <td className="mono">{fmtDate(b.dateFrom, lang)} — {fmtDate(b.dateTo, lang)}</td>
                      <td className="mono">{b.rooms}</td>
                      <td className="mono">{fmtDate(b.cutoffDate, lang)}</td>
                      <td className="mono">{b.pickup ? `${b.pickup.pct}% · ${b.pickup.bookings}` : '—'}</td>
                      <td><span className={`bk-badge ${b.status === 'definite' ? 'confirmed' : b.status === 'tentative' ? 'pending' : 'draft'}`}>{t(`crm.hotels.blocks.status.${b.status}`)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === 'bookings' && (
          <div className="bk-table-wrap">
            <table className="bk-table">
              <thead>
                <tr>
                  <th>{t('crm.hotels.reservations.table.colGuest')}</th>
                  <th>{t('crm.hotels.reservations.table.colHotelRoom')}</th>
                  <th>{p('col.guestCountry')}</th>
                  <th>{t('crm.hotels.reservations.table.colDates')}</th>
                  <th>{p('col.gross')}</th>
                  <th>{p('col.commissionAmt')}</th>
                  <th>{p('col.net')}</th>
                  <th>{t('crm.hotels.reservations.table.colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {(bookings || []).map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.guestName}{r.source === 'demo' && <span className="bk-badge draft" style={{ marginLeft: 6 }}>{t('crm.hotels.demo.badge')}</span>}</td>
                    <td>{hotelName.get(r.hotelId) || '—'}<div className="htl-sub">{rtName.get(r.roomTypeId) || ''}</div></td>
                    <td><CountryTag code={r.guestCountry} /></td>
                    <td className="mono">{fmtDate(r.checkIn, lang)} — {fmtDate(r.checkOut, lang)}</td>
                    <td className="mono">{money(Number(r.total), null, lang)}</td>
                    <td className="mono">{Number(r.commissionAmount) ? `${money(Number(r.commissionAmount), null, lang)} · ${Number(r.commissionPct)}%` : '—'}</td>
                    <td className="mono">{money(Number(r.netTotal || r.total), null, lang)}</td>
                    <td><span className="bk-badge draft">{t(`crm.hotels.reservations.status.${r.status}`, { defaultValue: r.status })}</span></td>
                  </tr>
                ))}
                {bookings && bookings.length === 0 && (
                  <tr><td colSpan={8} className="htl-sub" style={{ textAlign: 'center', padding: 24 }}>{p('noBookings')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'statement' && <PartnerStatementTab partner={partner} />}

        {tab === 'analytics' && (
          <>
            <div className="htl-toolbar">
              <label className="htl-sub">{p('period')}</label>
              <DateInput className="htl-date" value={range.from} onChange={(v) => setRange((r) => ({ ...r, from: v }))}  inline clearable={false} />
              <span className="htl-sub">—</span>
              <DateInput className="htl-date" value={range.to} onChange={(v) => setRange((r) => ({ ...r, to: v }))}  inline clearable={false} />
              <span className="htl-sub">{p('byArrival')}</span>
            </div>
            {summary && (
              <>
                <div className="htl-kpis" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
                  <div className="htl-kpi"><div className="l">{p('kpi.bookings')}</div><div className="v">{summary.totals.bookings}</div><div className="d">{p('kpi.cancelled', { n: summary.totals.cancelled })}</div></div>
                  <div className="htl-kpi"><div className="l">{p('kpi.roomNights')}</div><div className="v">{summary.totals.roomNights}</div></div>
                  <div className="htl-kpi"><div className="l">{p('kpi.gross')}</div><div className="v">{money(summary.totals.gross, summary.kpis.currency, lang)}</div></div>
                  <div className="htl-kpi"><div className="l">{p('kpi.commission')}</div><div className="v">{money(summary.totals.commission, summary.kpis.currency, lang)}</div></div>
                  <div className="htl-kpi"><div className="l">{p('kpi.netRevenue')}</div><div className="v">{money(summary.totals.net, summary.kpis.currency, lang)}</div></div>
                </div>
                <div className="htl-panel">
                  <h3 className="htl-h3">{p('guestCountries')}</h3>
                  <CountryTable rows={summary.countries.guest} currency={summary.kpis.currency} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
};
