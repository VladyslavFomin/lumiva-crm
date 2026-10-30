import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
import { CountrySelect, CountryTag } from '../CountrySelect';
import { fmtDate, todayIso, addDaysIso } from './partnerUtils';
import {
  createRoomBlock,
  deleteRoomBlock,
  fetchContracts,
  fetchHotelInventory,
  fetchHotels,
  fetchPartners,
  fetchRoomBlocks,
  fetchRoomTypes,
  updateRoomBlock,
  HOTEL_BOARD_TYPES,
  type Hotel,
  type HotelAgency,
  type HotelContract,
  type HotelInventory,
  type HotelRoomBlock,
  type HotelRoomType,
} from '../../../api/hotels';
import '../hotels-design.css';
import { DateInput } from '../../../components/ui/DateInput';

const SPANS = [14, 30, 60, 90];

const BlockSheet: React.FC<{
  hotelId: string;
  roomTypes: HotelRoomType[];
  partners: HotelAgency[];
  initial: Partial<HotelRoomBlock>;
  onClose: () => void;
  onSaved: () => void;
}> = ({ hotelId, roomTypes, partners, initial, onClose, onSaved }) => {
  const { t } = useTranslation();
  const b = (k: string) => t(`crm.hotels.blocks.${k}`);
  const { showAlert } = useAlertModal();
  const [d, setD] = useState<Partial<HotelRoomBlock>>(initial);
  const [contracts, setContracts] = useState<HotelContract[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<HotelRoomBlock>) => setD((x) => ({ ...x, ...p }));
  useEffect(() => {
    if (d.agencyId) fetchContracts({ agencyId: d.agencyId, hotelId }).then(setContracts).catch(() => setContracts([]));
    else setContracts([]);
  }, [d.agencyId, hotelId]);
  const save = async () => {
    setBusy(true);
    try {
      if (d.id) await updateRoomBlock(d.id, d);
      else await createRoomBlock({ ...d, hotelId });
      showAlert(b('saved'), { variant: 'success' });
      onSaved();
    } catch (e) {
      showAlert((e as Error).message, { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="px-scope">
      <div className="lv-backdrop htl-sheet-back" onClick={onClose} />
      <div className="lv-sheet-right htl-sheet">
        <div className="htl-sheet-head">
          <h3>{d.id ? b('editTitle') : b('newTitle')}</h3>
          <button onClick={onClose}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="htl-sheet-body">
          <div className="htl-form" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{b('name')} *</label><input value={d.name || ''} onChange={(e) => set({ name: e.target.value })} placeholder={b('namePh')} /></div>
            <div className="htl-f"><label>{b('roomType')} *</label>
              <select value={d.roomTypeId || ''} onChange={(e) => set({ roomTypeId: e.target.value })}>
                <option value="">—</option>
                {roomTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="htl-f"><label>{b('rooms')} *</label><input type="number" min={1} value={d.rooms ?? ''} onChange={(e) => set({ rooms: Number(e.target.value) })} /></div>
            <div className="htl-f"><label>{b('dateFrom')} *</label><DateInput value={d.dateFrom || ''} onChange={(v) => set({ dateFrom: v })} /></div>
            <div className="htl-f"><label>{b('dateTo')} *</label><DateInput value={d.dateTo || ''} onChange={(v) => set({ dateTo: v })} /></div>
            <div className="htl-f"><label>{b('cutoff')} *</label><DateInput value={d.cutoffDate || ''} onChange={(v) => set({ cutoffDate: v })} /><div className="htl-hint">{b('cutoffHint')}</div></div>
            <div className="htl-f"><label>{b('statusLabel')}</label>
              <select value={d.status || 'tentative'} onChange={(e) => set({ status: e.target.value as HotelRoomBlock['status'] })}>
                {(['tentative', 'definite', 'released', 'cancelled'] as const).map((s) => <option key={s} value={s}>{b(`status.${s}`)}</option>)}
              </select>
              <div className="htl-hint">{b('statusHint')}</div>
            </div>
            <div className="htl-f"><label>{b('partner')}</label>
              <select value={d.agencyId || ''} onChange={(e) => set({ agencyId: e.target.value || null, contractId: null })}>
                <option value="">{b('noPartner')}</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="htl-f"><label>{b('contract')}</label>
              <select value={d.contractId || ''} disabled={!contracts.length} onChange={(e) => set({ contractId: e.target.value || null })}>
                <option value="">—</option>
                {contracts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="htl-f"><label>{b('rate')}</label><input type="number" min={0} value={d.ratePerNight ?? ''} onChange={(e) => set({ ratePerNight: e.target.value || null })} /></div>
            <div className="htl-f"><label>{b('board')}</label>
              <select value={d.boardType || ''} onChange={(e) => set({ boardType: e.target.value || null })}>
                <option value="">—</option>
                {HOTEL_BOARD_TYPES.map((x) => <option key={x} value={x}>{x} · {t(`crm.hotels.board.${x}`)}</option>)}
              </select>
            </div>
            <div className="htl-f"><label>{b('country')}</label><CountrySelect value={d.countryCode} onChange={(c) => set({ countryCode: c })} /></div>
            <div className="htl-f"><label>{b('contact')}</label><input value={d.contactName || ''} onChange={(e) => set({ contactName: e.target.value })} /></div>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{b('notes')}</label><textarea rows={3} value={d.notes || ''} onChange={(e) => set({ notes: e.target.value })} /></div>
          </div>
        </div>
        <div className="htl-sheet-foot">
          {d.id && (
            <button
              className="btn btn-danger"
              style={{ marginRight: 'auto' }}
              onClick={() => {
                if (!window.confirm(b('deleteConfirm'))) return;
                deleteRoomBlock(d.id!).then(onSaved).catch((e) => showAlert(e.message, { variant: 'error' }));
              }}
            >
              {t('crm.hotels.common.delete')}
            </button>
          )}
          <button className="btn" onClick={onClose}>{t('crm.hotels.common.cancel')}</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}><Ic d={HTL_ICON.check} size={14} />{t('crm.hotels.common.save')}</button>
        </div>
      </div>
    </div>
  );
};

export const HotelInventoryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const q = (k: string, o?: Record<string, unknown>) => t(`crm.hotels.inventory.${k}`, o);
  const lang = i18n.language;
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [sp, setSp] = useSearchParams();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [partners, setPartners] = useState<HotelAgency[]>([]);
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const hotelId = sp.get('hotelId') || hotels[0]?.id || '';
  const [from, setFrom] = useState(todayIso());
  const [span, setSpan] = useState(30);
  const [inv, setInv] = useState<HotelInventory | null>(null);
  const [blocks, setBlocks] = useState<HotelRoomBlock[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<Partial<HotelRoomBlock> | null>(null);

  useEffect(() => {
    fetchHotels().then(setHotels).catch((e) => showAlert(e.message, { variant: 'error' }));
    fetchPartners().then((x) => setPartners(x.filter((p) => p.status === 'active'))).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = () => {
    if (!hotelId) return;
    fetchHotelInventory(hotelId, from, addDaysIso(from, span)).then(setInv).catch((e) => showAlert(e.message, { variant: 'error' }));
    fetchRoomBlocks({ hotelId }).then(setBlocks).catch(() => setBlocks([]));
  };
  useEffect(() => {
    if (!hotelId) return;
    fetchRoomTypes(hotelId).then(setRoomTypes).catch(() => setRoomTypes([]));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId, from, span]);

  const rtName = useMemo(() => new Map(roomTypes.map((r) => [r.id, r.name])), [roomTypes]);
  const pName = useMemo(() => new Map(partners.map((p) => [p.id, p.name])), [partners]);
  const toggle = (id: string) => setOpen((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const dayHead = (d: string) => {
    const x = new Date(`${d}T00:00:00`);
    return { dd: x.getDate(), wd: x.toLocaleDateString(lang, { weekday: 'short' }).slice(0, 2), we: x.getDay() === 0 || x.getDay() === 6, first: x.getDate() === 1 };
  };

  return (
    <MainLayout>
      <PageHelpButton topic="hotels" />
      <div className="px-scope">
        <HotelsSubnav active="inventory" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{q('kicker')}</div>
            <h1>{q('title')}</h1>
            <p className="sub">{q('subtitle')}</p>
          </div>
          <div className="htl-hero-r">
            <button className="btn" onClick={() => navigate('/hotels/partners')}>{q('partners')}</button>
            <button
              className="btn btn-primary"
              disabled={!hotelId}
              onClick={() => setSheet({ status: 'tentative', rooms: 5, dateFrom: addDaysIso(todayIso(), 30), dateTo: addDaysIso(todayIso(), 33), cutoffDate: addDaysIso(todayIso(), 16), name: '' })}
            >
              <Ic d={HTL_ICON.plus} size={14} />{q('newBlock')}
            </button>
          </div>
        </div>

        <div className="htl-toolbar">
          <select className="htl-select" value={hotelId} onChange={(e) => setSp({ hotelId: e.target.value })}>
            {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <button className="btn btn-sm" onClick={() => setFrom(addDaysIso(from, -span))}>‹</button>
          <DateInput className="htl-date" value={from} onChange={(v) => v && setFrom(v)}  inline clearable={false} />
          <button className="btn btn-sm" onClick={() => setFrom(addDaysIso(from, span))}>›</button>
          <button className="btn btn-sm" onClick={() => setFrom(todayIso())}>{q('today')}</button>
          <div className="bk-savedviews" style={{ flex: 'none' }}>
            {SPANS.map((s) => (
              <div key={s} className={`bk-sv-tab${span === s ? ' active' : ''}`} onClick={() => setSpan(s)}>{q('nights', { n: s })}</div>
            ))}
          </div>
        </div>

        {!hotels.length ? (
          <div className="htl-empty"><h4>{q('noHotels')}</h4></div>
        ) : inv && (
          <>
            <div className="htl-inv-wrap">
              <table className="htl-inv">
                <thead>
                  <tr>
                    <th className="sticky">{q('roomType')}</th>
                    {inv.nights.map((d) => {
                      const h = dayHead(d);
                      return (
                        <th key={d} className={`${h.we ? 'we' : ''}${h.first ? ' first' : ''}`}>
                          <div className="wd">{h.wd}</div>
                          <div className="dd">{h.dd}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {inv.rows.map((row) => {
                    const expanded = open.has(row.roomTypeId);
                    const subCount = row.contracts.length + row.blocks.length;
                    return (
                      <React.Fragment key={row.roomTypeId}>
                        <tr className="main">
                          <td className="sticky">
                            <button className="htl-inv-name" onClick={() => subCount && toggle(row.roomTypeId)}>
                              {subCount > 0 && <span className={`chev${expanded ? ' on' : ''}`}>›</span>}
                              <b>{row.name}</b>
                              <span className="htl-sub">{q('capacity', { n: row.capacity })}{subCount ? ` · ${q('subRows', { n: subCount })}` : ''}</span>
                            </button>
                          </td>
                          {row.days.map((d) => (
                            <td
                              key={d.date}
                              className={`cell ${d.free < 0 ? 'over' : d.free === 0 ? 'zero' : d.free <= Math.max(1, Math.round(d.capacity * 0.15)) ? 'low' : 'ok'}`}
                              title={`${fmtDate(d.date, lang)}\n${q('tip', { cap: d.capacity, sold: d.sold, blocks: d.heldBlocks, allot: d.heldAllot, free: d.free })}`}
                            >
                              <span className="n">{d.free}</span>
                              {(d.heldBlocks > 0 || d.heldAllot > 0) && <span className="h" />}
                            </td>
                          ))}
                        </tr>
                        {expanded && row.contracts.map((c) => (
                          <tr key={c.contractId} className="sub">
                            <td className="sticky">
                              <button className="htl-inv-sub" onClick={() => navigate(`/hotels/contracts/${c.contractId}`)}>
                                <span>{c.partner}</span>
                                <span className="htl-sub">{c.name}{c.guaranteed ? ` · ${t('crm.hotels.contracts.guaranteedShort')}` : ''}</span>
                              </button>
                            </td>
                            {c.days.map((d) => (
                              <td key={d.date} className={`cell sm ${d.stop ? 'stop' : d.released ? 'rel' : d.allotment === 0 ? 'none' : d.sold >= d.allotment ? 'full' : ''}`} title={`${d.sold}/${d.allotment}${d.released ? ` · ${t('crm.hotels.contracts.released')}` : ''}`}>
                                {d.stop ? '×' : d.allotment === 0 && !d.sold ? '' : `${d.sold}/${d.allotment}`}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {expanded && row.blocks.map((b) => (
                          <tr key={b.blockId} className="sub">
                            <td className="sticky">
                              <button className="htl-inv-sub" onClick={() => setSheet(blocks.find((x) => x.id === b.blockId) || null)}>
                                <span>{q('block')} · {b.name}</span>
                                <span className="htl-sub">{t(`crm.hotels.blocks.status.${b.status}`)}{b.partner ? ` · ${b.partner}` : ''} · {q('cutoffShort', { d: fmtDate(b.cutoffDate, lang) })}</span>
                              </button>
                            </td>
                            {b.days.map((d) => (
                              <td key={d.date} className={`cell sm blk ${d.rooms === 0 ? 'none' : d.picked >= d.rooms ? 'full' : ''}`}>
                                {d.rooms ? `${d.picked}/${d.rooms}` : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="htl-legend" style={{ marginTop: 8 }}>
              <span><i className="ok" />{q('lgOk')}</span>
              <span><i className="low" />{q('lgLow')}</span>
              <span><i className="zero" />{q('lgZero')}</span>
              <span><i className="over" />{q('lgOver')}</span>
              <span><i className="held" />{q('lgHeld')}</span>
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '26px 0 10px' }}>
          <h3 className="htl-h3" style={{ margin: 0 }}>{q('blocksTitle')}</h3>
        </div>
        {blocks.length === 0 ? (
          <div className="htl-empty">
            <h4>{q('blocksEmptyTitle')}</h4>
            <p>{q('blocksEmptyBody')}</p>
          </div>
        ) : (
          <div className="bk-table-wrap">
            <table className="bk-table htl-click-rows">
              <thead>
                <tr>
                  <th>{t('crm.hotels.blocks.col.name')}</th>
                  <th>{t('crm.hotels.blocks.col.room')}</th>
                  <th>{t('crm.hotels.blocks.col.partner')}</th>
                  <th>{t('crm.hotels.blocks.col.dates')}</th>
                  <th>{t('crm.hotels.blocks.col.rooms')}</th>
                  <th>{t('crm.hotels.blocks.col.cutoff')}</th>
                  <th>{t('crm.hotels.blocks.col.pickup')}</th>
                  <th>{t('crm.hotels.blocks.col.country')}</th>
                  <th>{t('crm.hotels.blocks.col.status')}</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((b) => (
                  <tr key={b.id} onClick={() => setSheet(b)}>
                    <td style={{ fontWeight: 600 }}>{b.name}</td>
                    <td>{rtName.get(b.roomTypeId) || '—'}</td>
                    <td>{b.agencyId ? pName.get(b.agencyId) || '—' : '—'}</td>
                    <td className="mono">{fmtDate(b.dateFrom, lang)} — {fmtDate(b.dateTo, lang)}</td>
                    <td className="mono">{b.rooms}</td>
                    <td className="mono">{fmtDate(b.cutoffDate, lang)}{b.holds ? <span className="htl-sub"> · {q('holding')}</span> : null}</td>
                    <td style={{ minWidth: 130 }}>
                      {b.pickup && (
                        <div className="htl-share">
                          <div className="bar"><div style={{ width: `${Math.min(100, b.pickup.pct)}%` }} /></div>
                          <span className="mono">{b.pickup.pct}%</span>
                        </div>
                      )}
                    </td>
                    <td><CountryTag code={b.countryCode} /></td>
                    <td><span className={`bk-badge ${b.status === 'definite' ? 'confirmed' : b.status === 'tentative' ? 'pending' : 'draft'}`}>{t(`crm.hotels.blocks.status.${b.status}`)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sheet && (
        <BlockSheet
          hotelId={hotelId}
          roomTypes={roomTypes}
          partners={partners}
          initial={sheet}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            load();
          }}
        />
      )}
    </MainLayout>
  );
};
