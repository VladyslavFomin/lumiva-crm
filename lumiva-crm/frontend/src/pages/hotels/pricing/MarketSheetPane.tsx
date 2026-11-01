import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { Ic, HTL_ICON } from '../HotelIcons';
import { hotelErrorText } from '../ReservationLifecycle';
import { applyMarketSheet, previewMarketSheet, type HotelMarketGroup, type HotelMarketSheetPreview, type HotelMarketSheetResult } from '../../../api/hotels';

/**
 * Рыночный лист прайса (Avrupa / İngiltere / İç Pazar…) → цены группы рынков: PP минимальной категории по периодам,
 * свой PP категорий, где разница другая, пересчёт валюты по курсу, раннее бронирование листа — акциями этой группы.
 */
export const MarketSheetPane: React.FC<{ hotelId: string; groups: HotelMarketGroup[]; onClose: () => void; onDone: () => void }> = ({ hotelId, groups, onClose, onDone }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.season.import.market.${key}`, o);
  const loc = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const { showAlert } = useAlertModal();
  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [fx, setFx] = useState('');
  const [promos, setPromos] = useState(true);
  const [pv, setPv] = useState<HotelMarketSheetPreview | null>(null);
  const [res, setRes] = useState<HotelMarketSheetResult | null>(null);
  const [busy, setBusy] = useState(false);
  const d = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: '2-digit' });
  const n = (v: number) => v.toLocaleString(loc, { maximumFractionDigits: 2 });
  const rate = Number(fx.replace(',', '.'));

  const load = (f: File, sh: string | null, gid: string) => {
    setFile(f);
    setBusy(true);
    previewMarketSheet(hotelId, f, sh, gid || null)
      .then((x) => {
        setPv(x);
        setSheet(x.sheet);
        if (!gid && !newName) {
          // лист «İngiltere Pazarı (2)» → группа с похожим названием, иначе новая с именем листа
          const base = (x.sheet || '').replace(/\(\d+\)|pazar[ıi]?/gi, '').trim().toLowerCase();
          const hit = groups.find((g) => g.id !== x.referenceGroupId && base && g.name.toLowerCase().includes(base.split(' ')[0]));
          if (hit) setGroupId(hit.id);
          else setNewName(x.sheet || '');
        }
      })
      .catch((e) => showAlert(hotelErrorText(t, e, k('readError')), { variant: 'error' }))
      .finally(() => setBusy(false));
  };
  const apply = () => {
    if (!file) return;
    setBusy(true);
    applyMarketSheet(hotelId, file, { sheet, groupId: groupId || null, newGroupName: groupId ? null : newName, fxRate: pv?.currencyMismatch ? rate : null, importPromotions: promos })
      .then(setRes)
      .catch((e) => showAlert(hotelErrorText(t, e, k('applyError')), { variant: 'error' }))
      .finally(() => setBusy(false));
  };
  const mapped = pv?.periods.filter((p) => p.sheet).length || 0;
  const conv = (v: number) => (pv?.currencyMismatch ? (rate > 0 ? v * rate : null) : v);
  const canApply = !!pv && mapped > 0 && (!!groupId || !!newName.trim()) && (!pv.currencyMismatch || rate > 0);

  return (
    <>
      <div className="bk-modal-body">
        {!res && (
          <div className="sp-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) load(f, null, groupId); }}>
            <div>{k('drop')}</div>
            <div className="sp-muted">{k('hint')}</div>
            <div className="sp-file">
              <label className="btn btn-sm">{k('choose')}<input type="file" accept=".xlsx" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f, null, groupId); e.target.value = ''; }} /></label>
              <span>{file?.name || ''}</span>
            </div>
          </div>
        )}
        {busy && !pv && <div className="sp-muted" style={{ marginTop: 10 }}>{k('reading')}</div>}
        {pv && !res && (
          <div className="sp-prev">
            <div className="mk-row">
              {pv.sheets.length > 1 && (
                <label className="sp-sheet">{k('sheet')}
                  <select className="base-select" value={pv.sheet || ''} disabled={busy} onChange={(e) => file && load(file, e.target.value, groupId)}>
                    {pv.sheets.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              )}
              <label className="sp-sheet">{k('group')}
                <select className="base-select" value={groupId} onChange={(e) => { setGroupId(e.target.value); if (file) load(file, sheet, e.target.value); }}>
                  <option value="">{k('newGroup')}</option>
                  {groups.filter((g) => g.id !== pv.referenceGroupId).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
              {!groupId && <label className="sp-sheet">{k('newName')}<input value={newName} onChange={(e) => setNewName(e.target.value)} /></label>}
            </div>
            {pv.referenceGroupId && <div className="sp-muted">{k('refNote', { name: groups.find((g) => g.id === pv.referenceGroupId)?.name || '' })}</div>}
            {!pv.referenceGroupId && <div className="sp-note">{k('refCreate')}</div>}
            {pv.group?.importedSheet && <div className="sp-note">{k('reimport', { sheet: pv.group.importedSheet })}</div>}
            <div className={`sp-note${pv.mode === 'order' ? ' warn' : ''}`}>{pv.mode === 'order' ? k('modeOrder') : k('modeDates', { count: mapped, total: pv.periods.length })}</div>
            {pv.currencyMismatch && (
              <div className="sp-note warn mk-fx">
                <span>{k('fx', { from: pv.currency, to: pv.hotelCurrency })}</span>
                <input inputMode="decimal" value={fx} onChange={(e) => setFx(e.target.value)} placeholder="1,17" />
                <span className="sp-muted">{k('fxHint', { from: pv.currency, to: pv.hotelCurrency })}</span>
              </div>
            )}
            <h4>{k('periods')}</h4>
            <div className="sp-scroll small">
              <table className="sp-table">
                <thead><tr><th className="sp-c0">{k('hotelPeriod')}</th>{pv.periods.map((p) => <th key={p.id}>{d(p.startDate)}<div>{d(p.endDate)}</div></th>)}</tr></thead>
                <tbody>
                  <tr><td className="sp-c0">{k('basePP')}</td>{pv.periods.map((p) => <td key={p.id}>{n(p.basePP)}</td>)}</tr>
                  <tr className="sp-base"><td className="sp-c0">{k('marketPP', { cur: pv.hotelCurrency })}</td>{pv.periods.map((p) => { const v = p.sheet ? conv(p.sheet.ppBase) : null; return <td key={p.id}>{v === null || v === undefined ? '—' : n(Math.round(v * 100) / 100)}</td>; })}</tr>
                  <tr><td className="sp-c0">{k('sheetPeriod')}</td>{pv.periods.map((p) => <td key={p.id} className="sp-muted">{p.sheet ? `${d(p.sheet.startDate)}–${d(p.sheet.endDate)}` : '—'}</td>)}</tr>
                </tbody>
              </table>
            </div>
            <h4>{k('categories')}</h4>
            <div className="sp-rows mk-cats">
              {pv.categories.map((c) => (
                <div key={c.name}>
                  <span>{c.name}</span>
                  <span className="mono">{k('offsets', { sheet: `${c.sheetOffset >= 0 ? '+' : ''}${n(c.sheetOffset)}`, hotel: c.hotelOffset === null ? '—' : `${c.hotelOffset >= 0 ? '+' : ''}${n(c.hotelOffset)}` })}</span>
                  <span className={`sp-tag${c.roomTypeId ? (c.ownPeriods ? ' new' : '') : ''}`}>
                    {!c.roomTypeId ? k('noRoom') : c.ownPeriods ? k('own', { count: c.ownPeriods }) : pv.currencyMismatch && c.sheetOffset !== 0 ? k('fxDiff', { from: pv.currency }) : k('same')}
                  </span>
                </div>
              ))}
            </div>
            {pv.earlyBooking.length > 0 && (
              <label className="sp-eb-opt"><input type="checkbox" checked={promos} onChange={(e) => setPromos(e.target.checked)} />{k('eb', { count: pv.earlyBooking.length, list: pv.earlyBooking.map((e) => `−${n(e.discountPct)}%`).join(', ') })}</label>
            )}
            {pv.unusedSheetPeriods.length > 0 && pv.mode === 'dates' && <div className="sp-note warn">{k('unused', { count: pv.unusedSheetPeriods.length })}</div>}
          </div>
        )}
        {res && (
          <div className="sp-prev">
            <div className="sp-kpis">
              <div><span>{k('rGroup')}</span><b>{res.groupName}</b></div>
              <div><span>{k('rPeriods')}</span><b>{res.periods}</b></div>
              <div><span>{k('rCells')}</span><b>{res.roomCells}</b></div>
            </div>
            {!!(res.promotionsCreated || res.promotionsUpdated) && <div className="sp-note">{t('crm.hotels.season.import.eb.result', { created: res.promotionsCreated, updated: res.promotionsUpdated })}</div>}
          </div>
        )}
      </div>
      <div className="bk-modal-foot">
        {res ? <button type="button" className="btn btn-primary" onClick={onDone}>{k('done')}</button> : (
          <>
            <button type="button" className="btn" onClick={onClose}>{k('cancel')}</button>
            <button type="button" className="btn btn-primary" disabled={!canApply || busy} onClick={apply}><Ic d={HTL_ICON.check} size={14} />{k('apply')}</button>
          </>
        )}
      </div>
    </>
  );
};
