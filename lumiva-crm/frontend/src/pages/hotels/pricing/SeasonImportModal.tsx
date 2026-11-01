import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { Ic, HTL_ICON } from '../HotelIcons';
import { previewPriceListImport, applyPriceListImport, fetchMarketGroups, type HotelMarketGroup, type HotelPriceListPreview, type HotelPriceListResult } from '../../../api/hotels';

/** Импорт прайс-листа сезона из Excel: предпросмотр (что найдено и что изменится) → применить */
export const SeasonImportModal: React.FC<{ hotelId: string; onClose: () => void; onDone: () => void }> = ({ hotelId, onClose, onDone }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.season.import.${key}`, o);
  const loc = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const { showAlert } = useAlertModal();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<HotelPriceListPreview | null>(null);
  const [result, setResult] = useState<HotelPriceListResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [replacePeriods, setReplacePeriods] = useState(true);
  const [clearDaily, setClearDaily] = useState(true);
  const [sheet, setSheet] = useState<string | null>(null);
  // раннее бронирование листа → акции отеля; для каких групп рынков (лист прайса обычно — один рынок)
  const [importPromotions, setImportPromotions] = useState(true);
  const [promoGroups, setPromoGroups] = useState<string[]>([]);
  const [groups, setGroups] = useState<HotelMarketGroup[]>([]);
  useEffect(() => { fetchMarketGroups(hotelId).then(setGroups).catch(() => setGroups([])); }, [hotelId]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const pick = (f: File, sh: string | null = null) => {
    setFile(f);
    setPreview(null);
    setSheet(sh);
    setBusy(true);
    previewPriceListImport(hotelId, f, sh)
      .then(setPreview)
      .catch((e) => showAlert(e.message || k('readError'), { variant: 'error' }))
      .finally(() => setBusy(false));
  };
  const apply = () => {
    if (!file) return;
    setBusy(true);
    applyPriceListImport(hotelId, file, { replacePeriods, clearDaily, sheet: preview?.sheet ?? sheet, importPromotions, promoMarketGroupIds: promoGroups })
      .then(setResult)
      .catch((e) => showAlert(e.message || k('applyError'), { variant: 'error' }))
      .finally(() => setBusy(false));
  };
  const d = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: '2-digit' });
  const n = (v: number) => v.toLocaleString(loc, { maximumFractionDigits: 2 });
  const peaks = preview?.periods.filter((p) => p.isPeak).length || 0;
  const overrides = preview?.categories.reduce((s, c) => s + c.rows.reduce((a, r) => a + r.overrides, 0), 0) || 0;

  return createPortal(
    <div className="px-scope">
      <div className="lv-backdrop bk-modal-back" onClick={onClose} />
      <div className="bk-modal sp-import lv-dialog" role="dialog" aria-modal="true">
        <div className="bk-modal-head">
          <h3>{k('title')}</h3>
          <button type="button" onClick={onClose} aria-label={k('close')}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="bk-modal-body">
          {!result && (
            <div className="sp-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) pick(f); }}>
              <div>{k('dropHint')}</div>
              <div className="sp-muted">{k('formatHint')}</div>
              <div className="sp-file">
                <button type="button" className="btn btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>{k('chooseFile')}</button>
                <span>{file ? file.name : k('noFile')}</span>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} />
            </div>
          )}
          {busy && !preview && !result && <div className="sp-muted" style={{ marginTop: 12 }}>{k('reading')}</div>}

          {preview && !result && (
            <div className="sp-prev">
              {preview.sheets.length > 1 && (
                <label className="sp-sheet">
                  {k('sheet')}
                  <select className="base-select" value={preview.sheet || ''} disabled={busy} onChange={(e) => file && pick(file, e.target.value)}>
                    {preview.sheets.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span className="sp-muted">{k('sheetHint')}</span>
                </label>
              )}
              <div className="sp-kpis">
                <div><span>{k('kPeriods')}</span><b>{preview.periods.length}</b><em>{k('kPeaks', { count: peaks })}</em></div>
                <div><span>{k('kRooms')}</span><b>{preview.categories.length}</b><em>{k('kNew', { count: preview.categories.filter((c) => !c.exists).length })}</em></div>
                <div><span>{k('kRows')}</span><b>{preview.categories.reduce((s, c) => s + c.rows.length, 0)}</b><em>{k('kOverrides', { count: overrides })}</em></div>
              </div>
              {preview.currencyMismatch && <div className="sp-note warn">{k('currency', { file: preview.currency, hotel: preview.hotelCurrency })}</div>}
              {preview.warnings.map((w) => <div key={w} className="sp-note warn">{w.startsWith('no_pp:') ? k('noPP', { name: w.replace(/^no_pp:/, '') }) : k(`warn.${w}`, { defaultValue: w })}</div>)}

              <h4>{k('periods')}</h4>
              <div className="sp-scroll small">
                <table className="sp-table">
                  <thead><tr><th className="sp-c0">#</th>{preview.periods.map((p, i) => <th key={i} className={p.isPeak ? 'pk' : ''}>{i + 1}<div>{d(p.startDate)}</div><div>{d(p.endDate)}</div></th>)}</tr></thead>
                  <tbody>
                    <tr className="sp-base"><td className="sp-c0">{k('ppBase')}</td>{preview.periods.map((p, i) => <td key={i} className={p.isPeak ? 'pk' : ''}>{n(p.ppBase)}</td>)}</tr>
                    <tr><td className="sp-c0">{k('minNights')}</td>{preview.periods.map((p, i) => <td key={i} className={p.isPeak ? 'pk' : ''}>{p.minNights ?? '—'}</td>)}</tr>
                    <tr><td className="sp-c0">{k('release')}</td>{preview.periods.map((p, i) => <td key={i} className={p.isPeak ? 'pk' : ''}>{p.releaseDays ?? '—'}</td>)}</tr>
                  </tbody>
                </table>
              </div>

              <h4>{k('rooms')}</h4>
              <div className="sp-cats">
                {preview.categories.map((c) => (
                  <details key={c.name}>
                    <summary>
                      <b>{c.name}</b>
                      {c.area && <span className="sp-area">{c.area}</span>}
                      {c.isBase ? <span className="sp-tag base">{k('base')}</span> : <span className="sp-tag">{k('offset', { v: `${c.offset >= 0 ? '+' : ''}${n(c.offset)}` })}</span>}
                      {c.ownPeriods > 0 && <span className="sp-tag">{k('own', { count: c.ownPeriods })}</span>}
                      <span className={`sp-tag ${c.exists ? '' : 'new'}`}>{c.exists ? k('update') : k('create')}</span>
                    </summary>
                    <div className="sp-rows">
                      {c.rows.map((r) => (
                        <div key={r.label}>
                          <span>{r.label}</span>
                          <span className="mono">{n(r.coefficient)}{r.peakCoefficient ? ` / ${n(r.peakCoefficient)}` : ''}</span>
                          <span className="sp-muted">{r.adults !== null ? k('guests', { a: r.adults, c: r.children }) + (r.infants ? ` + ${k('inf', { n: r.infants })}` : '') : '—'}</span>
                          <span className="sp-muted">{r.overrides ? k('rowOverrides', { count: r.overrides }) : ''}</span>
                          <span className={`sp-tag ${r.exists ? '' : 'new'}`}>{r.exists ? k('update') : k('create')}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>

              {!!preview.earlyBooking?.length && (
                <>
                  <h4>{k('eb.title')}</h4>
                  <div className="sp-scroll small">
                    <table className="sp-table sp-eb">
                      <thead>
                        <tr><th className="sp-c0">{k('eb.rooms')}</th><th>{k('eb.booking')}</th><th>{k('eb.stay')}</th><th>{k('eb.discount')}</th><th>{k('eb.prepay')}</th><th>{k('eb.list')}</th><th /></tr>
                      </thead>
                      <tbody>
                        {preview.earlyBooking.map((e, i) => (
                          <tr key={i}>
                            <td className="sp-c0">{e.roomType || k('eb.allRooms')}</td>
                            <td>{e.bookFrom ? `${d(e.bookFrom)} – ${e.bookTo ? d(e.bookTo) : ''}` : e.bookTo ? k('eb.until', { date: d(e.bookTo) }) : '—'}</td>
                            <td>{e.stayFrom && e.stayTo ? `${d(e.stayFrom)} – ${d(e.stayTo)}` : '—'}</td>
                            <td><b>−{n(e.discountPct)} %</b></td>
                            <td>{e.prepaymentPct ? (e.prepaymentDueDate ? k('eb.prepUntil', { pct: n(e.prepaymentPct), date: d(e.prepaymentDueDate) }) : `${n(e.prepaymentPct)} %`) : '—'}</td>
                            <td>{e.listDate ? d(e.listDate) : '—'}</td>
                            <td>{!e.roomTypeKnown ? <span className="sp-tag">{k('eb.skip')}</span> : <span className={`sp-tag ${e.exists ? '' : 'new'}`}>{e.exists ? k('update') : k('create')}</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <label className="sp-eb-opt">
                    <input type="checkbox" checked={importPromotions} onChange={(e) => setImportPromotions(e.target.checked)} />
                    {k('eb.importAsPromos')}
                  </label>
                  {importPromotions && groups.length > 0 && (
                    <div className="sp-eb-groups">
                      <span className="sp-muted">{k('eb.forGroups')}</span>
                      <div className="rtp-chips">
                        <button type="button" className={`rtp-chip${!promoGroups.length ? ' on' : ''}`} onClick={() => setPromoGroups([])}>{k('eb.allGroups')}</button>
                        {groups.map((g) => (
                          <button key={g.id} type="button" className={`rtp-chip${promoGroups.includes(g.id) ? ' on' : ''}`} onClick={() => setPromoGroups(promoGroups.includes(g.id) ? promoGroups.filter((x) => x !== g.id) : [...promoGroups, g.id])}>{g.name}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {importPromotions && <div className="sp-muted" style={{ marginTop: 6 }}>{k('eb.hint')}</div>}
                </>
              )}

              <div className="sp-opts">
                {preview.stalePeriods.length > 0 && (
                  <label>
                    <input type="checkbox" checked={replacePeriods} onChange={(e) => setReplacePeriods(e.target.checked)} />
                    {k('replacePeriods', { count: preview.stalePeriods.length, list: preview.stalePeriods.map((p) => `${d(p.startDate)}–${d(p.endDate)}`).join(', ') })}
                  </label>
                )}
                {preview.dailyDays > 0 && (
                  <label>
                    <input type="checkbox" checked={clearDaily} onChange={(e) => setClearDaily(e.target.checked)} />
                    {k('clearDaily', { count: preview.dailyDays })}
                  </label>
                )}
              </div>
            </div>
          )}

          {result && (
            <div className="sp-prev">
              <div className="sp-kpis">
                <div><span>{k('kPeriods')}</span><b>{result.periodsCreated + result.periodsUpdated}</b><em>{k('rPeriods', { created: result.periodsCreated, removed: result.periodsRemoved })}</em></div>
                <div><span>{k('kRooms')}</span><b>{result.roomTypesCreated.length + result.roomTypesUpdated}</b><em>{k('kNew', { count: result.roomTypesCreated.length })}</em></div>
                <div><span>{k('kRows')}</span><b>{result.rowsCreated + result.rowsUpdated}</b><em>{k('kOverrides', { count: result.overrides })}</em></div>
              </div>
              {result.roomTypesCreated.length > 0 && <div className="sp-note">{k('createdRooms', { list: result.roomTypesCreated.join(', ') })}</div>}
              {result.dailyCleared > 0 && <div className="sp-note">{k('dailyCleared', { count: result.dailyCleared })}</div>}
              {!!(result.promotionsCreated || result.promotionsUpdated) && <div className="sp-note">{k('eb.result', { created: result.promotionsCreated || 0, updated: result.promotionsUpdated || 0 })}</div>}
              {!!result.promotionsSkipped && <div className="sp-note warn">{k('eb.skipped', { count: result.promotionsSkipped })}</div>}
            </div>
          )}
        </div>
        <div className="bk-modal-foot">
          {result ? (
            <button type="button" className="btn btn-primary" onClick={onDone}>{k('done')}</button>
          ) : (
            <>
              <button type="button" className="btn" onClick={onClose}>{k('cancel')}</button>
              <button type="button" className="btn btn-primary" disabled={!preview || busy} onClick={apply}><Ic d={HTL_ICON.check} size={14} />{k('apply')}</button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
