import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { Ic, HTL_ICON } from '../HotelIcons';
import { hotelErrorText } from '../ReservationLifecycle';
import {
  createRatePlan,
  deleteRatePlan,
  fetchRatePlans,
  fetchRoomTypes,
  makeDefaultRatePlan,
  updateRatePlan,
  HOTEL_BOARD_CODES,
  type HotelBoardCode,
  type HotelCancelRule,
  type HotelRatePlan,
  type HotelRatePlanInput,
  type HotelRoomType,
} from '../../../api/hotels';

type Draft = {
  code: string;
  name: string;
  description: string;
  boardType: HotelBoardCode;
  boardSupplementAdult: string;
  boardSupplementChild: string;
  adjustType: 'percent' | 'amount';
  adjustValue: string;
  refundable: boolean;
  cancellationPolicy: HotelCancelRule[];
  prepaymentType: HotelRatePlan['prepaymentType'];
  prepaymentValue: string;
  prepaymentDueDays: string;
  minNights: string;
  roomTypeIds: string[];
  sellDirect: boolean;
  sellWebsite: boolean;
  active: boolean;
};

const empty = (): Draft => ({
  code: '', name: '', description: '', boardType: 'BB', boardSupplementAdult: '0', boardSupplementChild: '0',
  adjustType: 'percent', adjustValue: '0', refundable: true, cancellationPolicy: [{ daysBefore: 7, penaltyType: 'nights', value: 1 }],
  prepaymentType: 'none', prepaymentValue: '', prepaymentDueDays: '0', minNights: '1', roomTypeIds: [], sellDirect: true, sellWebsite: true, active: true,
});

const toDraft = (p: HotelRatePlan): Draft => ({
  code: p.code, name: p.name, description: p.description || '', boardType: p.boardType,
  boardSupplementAdult: String(Number(p.boardSupplementAdult)), boardSupplementChild: String(Number(p.boardSupplementChild)),
  adjustType: p.adjustType, adjustValue: String(Number(p.adjustValue)), refundable: p.refundable, cancellationPolicy: p.cancellationPolicy || [],
  prepaymentType: p.prepaymentType, prepaymentValue: Number(p.prepaymentValue) ? String(Number(p.prepaymentValue)) : '', prepaymentDueDays: String(p.prepaymentDueDays),
  minNights: String(p.minNights), roomTypeIds: p.roomTypeIds || [], sellDirect: p.sellDirect, sellWebsite: p.sellWebsite, active: p.active,
});

const toInput = (d: Draft): HotelRatePlanInput => ({
  code: d.code, name: d.name, description: d.description || null, boardType: d.boardType,
  boardSupplementAdult: d.boardSupplementAdult || '0', boardSupplementChild: d.boardSupplementChild || '0',
  adjustType: d.adjustType, adjustValue: d.adjustValue || '0', refundable: d.refundable,
  cancellationPolicy: d.refundable ? d.cancellationPolicy : [],
  prepaymentType: d.prepaymentType, prepaymentValue: d.prepaymentType === 'percent' || d.prepaymentType === 'nights' ? d.prepaymentValue : '0',
  prepaymentDueDays: Number(d.prepaymentDueDays) || 0, minNights: Number(d.minNights) || 1, roomTypeIds: d.roomTypeIds,
  sellDirect: d.sellDirect, sellWebsite: d.sellWebsite, active: d.active,
});

/**
 * Тарифы отеля поверх прайса сезона: питание с доплатой, корректировка цены (невозвратный −10 % и т. п.),
 * условия отмены и предоплаты. Тариф по умолчанию подставляется в новую бронь.
 */
export const RatePlansPanel: React.FC<{ hotelId: string; currency?: string | null }> = ({ hotelId, currency }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.ratePlans.${key}`, o);
  const loc = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const { showAlert, showConfirm } = useAlertModal();
  const [plans, setPlans] = useState<HotelRatePlan[] | null>(null);
  const [rooms, setRooms] = useState<HotelRoomType[]>([]);
  const [edit, setEdit] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!hotelId) return;
    fetchRatePlans(hotelId).then(setPlans).catch((e) => { setPlans([]); showAlert(hotelErrorText(t, e, k('loadError')), { variant: 'error' }); });
    fetchRoomTypes(hotelId).then(setRooms).catch(() => setRooms([]));
  }, [hotelId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const run = (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    return fn()
      .then(() => { if (ok) showAlert(ok, { variant: 'success' }); load(); return true; })
      .catch((e) => { showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }); return false; })
      .finally(() => setBusy(false));
  };
  const money = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString(loc, { maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`;
  const adjText = (p: HotelRatePlan) => {
    const v = Number(p.adjustValue);
    if (!v) return k('adjNone');
    return p.adjustType === 'percent' ? `${v > 0 ? '+' : '−'}${Math.abs(v)} %` : money(v);
  };
  const cancelText = (p: HotelRatePlan) => {
    if (!p.refundable) return k('nonRefundable');
    if (!p.cancellationPolicy?.length) return k('freeCancel');
    const first = [...p.cancellationPolicy].sort((a, b) => b.daysBefore - a.daysBefore)[0];
    return k('freeUntil', { days: first.daysBefore });
  };
  const prepText = (p: HotelRatePlan) => {
    if (p.prepaymentType === 'none') return k('prepNone');
    const what = p.prepaymentType === 'full' ? k('prepFull') : p.prepaymentType === 'percent' ? `${Number(p.prepaymentValue)} %` : k('prepNights', { count: Number(p.prepaymentValue) });
    return p.prepaymentDueDays > 0 ? k('prepBefore', { what, days: p.prepaymentDueDays }) : k('prepOnBooking', { what });
  };

  if (!plans) return <div className="rtp-empty"><p>{k('loading')}</p></div>;

  return (
    <div className="rtp-wrap">
      <div className="rtp-bar">
        <p className="htl-sub">{k('lead')}</p>
        <button type="button" className="btn btn-primary" onClick={() => setEdit({ id: null, draft: empty() })}><Ic d={HTL_ICON.plus} size={13} />{k('add')}</button>
      </div>
      {!plans.length ? (
        <div className="rtp-empty">
          <h4>{k('emptyTitle')}</h4>
          <p>{k('emptyText')}</p>
          <button type="button" className="btn btn-primary" onClick={() => setEdit({ id: null, draft: empty() })}><Ic d={HTL_ICON.plus} size={13} />{k('add')}</button>
        </div>
      ) : (
        <div className="rtp-table-wrap">
          <table className="rtp-table">
            <thead>
              <tr>
                <th>{k('col.plan')}</th>
                <th>{k('col.board')}</th>
                <th>{k('col.price')}</th>
                <th>{k('col.cancel')}</th>
                <th>{k('col.prepay')}</th>
                <th>{k('col.where')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className={p.active ? '' : 'off'} onClick={() => setEdit({ id: p.id, draft: toDraft(p) })}>
                  <td>
                    <div className="rtp-name"><span className="rtp-code">{p.code}</span><b>{p.name}</b>{p.isDefault && <span className="rtp-tag def">{k('default')}</span>}{!p.active && <span className="rtp-tag">{k('off')}</span>}</div>
                    {p.roomTypeIds?.length ? <div className="htl-sub">{p.roomTypeIds.map((id) => rooms.find((r) => r.id === id)?.name).filter(Boolean).join(', ')}</div> : null}
                  </td>
                  <td>
                    <b>{p.boardType}</b> <span className="htl-sub">{t(`crm.hotels.board.${p.boardType}`)}</span>
                    {(Number(p.boardSupplementAdult) !== 0 || Number(p.boardSupplementChild) !== 0) && (
                      <div className="htl-sub">{k('boardLine', { adult: money(Number(p.boardSupplementAdult)), child: money(Number(p.boardSupplementChild)) })}</div>
                    )}
                  </td>
                  <td className="mono">{adjText(p)}{p.minNights > 1 ? <div className="htl-sub">{k('minNightsShort', { n: p.minNights })}</div> : null}</td>
                  <td><span className={`rtp-pill ${p.refundable ? 'ok' : 'nrf'}`}>{cancelText(p)}</span></td>
                  <td>{prepText(p)}</td>
                  <td className="htl-sub">{[p.sellDirect && k('whereDirect'), p.sellWebsite && k('whereWebsite')].filter(Boolean).join(' · ') || '—'}</td>
                  <td onClick={(e) => e.stopPropagation()} className="rtp-actions">
                    {!p.isDefault && p.active && (
                      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void run(() => makeDefaultRatePlan(p.id), k('madeDefault', { code: p.code }))}>{k('makeDefault')}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <RatePlanSheet
          rooms={rooms}
          currency={currency}
          initial={edit.draft}
          plan={edit.id ? plans.find((p) => p.id === edit.id) || null : null}
          busy={busy}
          onClose={() => setEdit(null)}
          onSave={(d) => run(() => (edit.id ? updateRatePlan(edit.id, toInput(d)) : createRatePlan({ ...toInput(d), hotelId })), k('saved')).then((ok) => ok && setEdit(null))}
          onDelete={async () => {
            if (!edit.id) return;
            if (!(await showConfirm(k('deleteBody'), { title: k('delete'), confirmLabel: k('delete'), danger: true }))) return;
            const ok = await run(() => deleteRatePlan(edit.id!), k('deleted'));
            if (ok) setEdit(null);
          }}
        />
      )}
    </div>
  );
};

const RatePlanSheet: React.FC<{
  rooms: HotelRoomType[];
  currency?: string | null;
  initial: Draft;
  plan: HotelRatePlan | null;
  busy: boolean;
  onClose: () => void;
  onSave: (d: Draft) => void;
  onDelete: () => void;
}> = ({ rooms, currency, initial, plan, busy, onClose, onSave, onDelete }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.ratePlans.${key}`, o);
  const [d, setD] = useState<Draft>(initial);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  const numOk = (v: string, min: number, max: number) => v.trim() === '' || (Number.isFinite(Number(v.replace(',', '.'))) && Number(v.replace(',', '.')) >= min && Number(v.replace(',', '.')) <= max);
  const errors = [
    !d.code.trim() && k('err.code'),
    !d.name.trim() && k('err.name'),
    !numOk(d.adjustValue, d.adjustType === 'percent' ? -90 : -100000, d.adjustType === 'percent' ? 300 : 100000) && k('err.adjust'),
    (d.prepaymentType === 'percent' && !(Number(d.prepaymentValue) > 0 && Number(d.prepaymentValue) <= 100)) && k('err.prepPercent'),
    (d.prepaymentType === 'nights' && !(Number(d.prepaymentValue) >= 1)) && k('err.prepNights'),
    plan?.isDefault && !d.active && k('err.defaultOff'),
  ].filter(Boolean) as string[];
  const rule = (i: number, p: Partial<HotelCancelRule>) => set({ cancellationPolicy: d.cancellationPolicy.map((x, j) => (j === i ? { ...x, ...p } : x)) });

  return createPortal(
    <div className="px-scope">
      <div className="lv-backdrop htl-sheet-back" onClick={onClose} />
      <div className="lv-sheet-right htl-sheet" role="dialog" aria-modal="true">
        <div className="htl-sheet-head">
          <div>
            <h3>{plan ? `${plan.code} · ${plan.name}` : k('newTitle')}</h3>
            <div className="htl-sub" style={{ marginTop: 4 }}>{k('sheetHint')}</div>
          </div>
          <button onClick={onClose} aria-label={k('cancel')}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="htl-sheet-body">
          <div className="htl-form" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
            <div className="htl-form-sec" style={{ gridColumn: 'span 2' }}>{k('secMain')}</div>
            <div className="htl-f"><label>{k('code')} *</label><input value={d.code} maxLength={16} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} placeholder="BAR, NRF, BB" /></div>
            <div className="htl-f"><label>{k('name')} *</label><input value={d.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} /></div>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}><label>{k('description')}</label><textarea rows={2} value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder={k('descriptionPh')} /></div>

            <div className="htl-form-sec" style={{ gridColumn: 'span 2' }}>{k('secBoard')}</div>
            <div className="htl-f"><label>{k('board')}</label>
              <select value={d.boardType} onChange={(e) => set({ boardType: e.target.value as HotelBoardCode })}>
                {HOTEL_BOARD_CODES.map((b) => <option key={b} value={b}>{b} · {t(`crm.hotels.board.${b}`)}</option>)}
              </select>
            </div>
            <div className="htl-f" />
            <div className="htl-f"><label>{k('boardAdult', { currency: currency || '' })}</label><input inputMode="decimal" value={d.boardSupplementAdult} onChange={(e) => set({ boardSupplementAdult: e.target.value })} /></div>
            <div className="htl-f"><label>{k('boardChild', { currency: currency || '' })}</label><input inputMode="decimal" value={d.boardSupplementChild} onChange={(e) => set({ boardSupplementChild: e.target.value })} /></div>
            <div className="htl-hint" style={{ gridColumn: 'span 2' }}>{k('boardHint')}</div>

            <div className="htl-form-sec" style={{ gridColumn: 'span 2' }}>{k('secPrice')}</div>
            <div className="htl-f"><label>{k('adjust')}</label>
              <div className="rtp-inline">
                <div className="htl-seg">
                  <button type="button" className={d.adjustType === 'percent' ? 'on' : ''} onClick={() => set({ adjustType: 'percent' })}>%</button>
                  <button type="button" className={d.adjustType === 'amount' ? 'on' : ''} onClick={() => set({ adjustType: 'amount' })}>{currency || '¤'}</button>
                </div>
                <input inputMode="decimal" value={d.adjustValue} onChange={(e) => set({ adjustValue: e.target.value })} />
              </div>
            </div>
            <div className="htl-f"><label>{k('minNights')}</label><input type="number" min={1} max={60} value={d.minNights} onChange={(e) => set({ minNights: e.target.value })} /></div>
            <div className="htl-hint" style={{ gridColumn: 'span 2' }}>{k('adjustHint')}</div>

            <div className="htl-form-sec" style={{ gridColumn: 'span 2' }}>{k('secCancel')}</div>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}>
              <div className="htl-seg">
                <button type="button" className={d.refundable ? 'on' : ''} onClick={() => set({ refundable: true })}>{k('refundable')}</button>
                <button type="button" className={!d.refundable ? 'on' : ''} onClick={() => set({ refundable: false })}>{k('nonRefundable')}</button>
              </div>
            </div>
            {d.refundable ? (
              <div style={{ gridColumn: 'span 2' }}>
                {d.cancellationPolicy.map((r, i) => (
                  <div key={i} className="htl-rule">
                    <span>{k('cancelLess')}</span>
                    <input type="number" min={0} value={r.daysBefore} onChange={(e) => rule(i, { daysBefore: Number(e.target.value) })} />
                    <span>{k('daysPenalty')}</span>
                    <input type="number" min={0} value={r.value} onChange={(e) => rule(i, { value: Number(e.target.value) })} />
                    <select value={r.penaltyType} onChange={(e) => rule(i, { penaltyType: e.target.value as 'percent' | 'nights' })}>
                      <option value="percent">%</option>
                      <option value="nights">{k('nights')}</option>
                    </select>
                    <button type="button" className="btn-icon" onClick={() => set({ cancellationPolicy: d.cancellationPolicy.filter((_, j) => j !== i) })} aria-label={k('removeRule')}><Ic d={HTL_ICON.x} size={13} /></button>
                  </div>
                ))}
                <div className="htl-hint" style={{ marginBottom: 8 }}>{d.cancellationPolicy.length ? k('cancelHint') : k('freeCancel')}</div>
                <button type="button" className="btn btn-sm" onClick={() => set({ cancellationPolicy: [...d.cancellationPolicy, { daysBefore: 3, penaltyType: 'percent', value: 100 }] })}><Ic d={HTL_ICON.plus} size={12} />{k('addRule')}</button>
              </div>
            ) : (
              <div className="htl-hint" style={{ gridColumn: 'span 2' }}>{k('nrfHint')}</div>
            )}

            <div className="htl-form-sec" style={{ gridColumn: 'span 2' }}>{k('secPrepay')}</div>
            <div className="htl-f"><label>{k('prepay')}</label>
              <select value={d.prepaymentType} onChange={(e) => set({ prepaymentType: e.target.value as Draft['prepaymentType'] })}>
                {(['none', 'percent', 'nights', 'full'] as const).map((x) => <option key={x} value={x}>{k(`prepType.${x}`)}</option>)}
              </select>
            </div>
            {(d.prepaymentType === 'percent' || d.prepaymentType === 'nights') ? (
              <div className="htl-f"><label>{d.prepaymentType === 'percent' ? k('prepPercent') : k('prepNightsLabel')}</label><input inputMode="decimal" value={d.prepaymentValue} onChange={(e) => set({ prepaymentValue: e.target.value })} /></div>
            ) : <div className="htl-f" />}
            {d.prepaymentType !== 'none' && (
              <div className="htl-f"><label>{k('prepDue')}</label>
                <div className="rtp-inline">
                  <input type="number" min={0} max={365} value={d.prepaymentDueDays} onChange={(e) => set({ prepaymentDueDays: e.target.value })} />
                  <span className="htl-sub">{Number(d.prepaymentDueDays) > 0 ? k('prepDueBefore') : k('prepDueNow')}</span>
                </div>
              </div>
            )}

            <div className="htl-form-sec" style={{ gridColumn: 'span 2' }}>{k('secWhere')}</div>
            <div className="htl-f" style={{ gridColumn: 'span 2' }}>
              <label>{k('rooms')}</label>
              <div className="rtp-chips">
                <button type="button" className={`rtp-chip${!d.roomTypeIds.length ? ' on' : ''}`} onClick={() => set({ roomTypeIds: [] })}>{k('allRooms')}</button>
                {rooms.map((r) => (
                  <button key={r.id} type="button" className={`rtp-chip${d.roomTypeIds.includes(r.id) ? ' on' : ''}`} onClick={() => set({ roomTypeIds: d.roomTypeIds.includes(r.id) ? d.roomTypeIds.filter((x) => x !== r.id) : [...d.roomTypeIds, r.id] })}>{r.name}</button>
                ))}
              </div>
            </div>
            <label className="rtp-check"><input type="checkbox" checked={d.sellDirect} onChange={(e) => set({ sellDirect: e.target.checked })} />{k('sellDirect')}</label>
            <label className="rtp-check"><input type="checkbox" checked={d.sellWebsite} onChange={(e) => set({ sellWebsite: e.target.checked })} />{k('sellWebsite')}</label>
            <label className="rtp-check"><input type="checkbox" checked={d.active} onChange={(e) => set({ active: e.target.checked })} />{k('active')}</label>
          </div>
          {errors.length > 0 && <div className="pe-box warn" style={{ marginTop: 12 }}>{errors.map((x) => <div key={x}>{x}</div>)}</div>}
        </div>
        <div className="htl-sheet-foot">
          {plan && <button type="button" className="btn btn-danger" disabled={busy} onClick={onDelete} style={{ marginRight: 'auto' }}>{k('delete')}</button>}
          <button type="button" className="btn" onClick={onClose}>{k('cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={busy || errors.length > 0} onClick={() => onSave(d)}><Ic d={HTL_ICON.check} size={14} />{k('save')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
