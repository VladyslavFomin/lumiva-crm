import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { Ic, HTL_ICON } from '../HotelIcons';
import { hotelErrorText } from '../ReservationLifecycle';
import { money } from '../partners/partnerUtils';
import {
  eInvoiceLineTotals,
  fetchEInvoiceDraft,
  issueEInvoice,
  type HotelEInvoiceDraft,
  type HotelEInvoiceLine,
  type HotelEInvoiceRecipient,
  type HotelFolioKind,
} from '../../../api/hotels';

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Выставление e-Fatura / e-Arşiv по фолио: черновик собирает сервер (проживание с налогами, услуги со своей ставкой KDV),
 * здесь можно поправить получателя, строки и курс. Тип документа выберет интегратор по налоговому номеру получателя.
 */
export const EInvoiceModal: React.FC<{ reservationId: string; folio: HotelFolioKind; onClose: () => void; onIssued: () => void }> = ({ reservationId, folio, onClose, onIssued }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.einvoice.${key}`, o);
  const loc = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const { showAlert, showConfirm } = useAlertModal();
  const [draft, setDraft] = useState<HotelEInvoiceDraft | null>(null);
  const [rcp, setRcp] = useState<HotelEInvoiceRecipient | null>(null);
  const [lines, setLines] = useState<HotelEInvoiceLine[]>([]);
  const [rate, setRate] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchEInvoiceDraft(reservationId, folio)
      .then((d) => { setDraft(d); setRcp(d.recipient); setLines(d.lines); setRate(d.exchangeRate ? String(d.exchangeRate) : ''); })
      .catch((e) => { showAlert(hotelErrorText(t, e, k('loadError')), { variant: 'error' }); onClose(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId, folio]);

  const totals = useMemo(() => {
    const s = { net: 0, acc: 0, vat: 0, gross: 0 };
    for (const l of lines) { const x = eInvoiceLineTotals(l); s.net += x.net; s.acc += x.acc; s.vat += x.vat; s.gross += x.gross; }
    return { net: r2(s.net), acc: r2(s.acc), vat: r2(s.vat), gross: r2(s.gross) };
  }, [lines]);

  if (!draft || !rcp) return null;
  const cur = draft.currency;
  const m = (n: number) => money(n, cur, loc);
  const setLine = (i: number, patch: Partial<HotelEInvoiceLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const numIn = (v: string) => (v === '' ? 0 : Number(v.replace(',', '.')) || 0);
  const mismatch = lines.length > 0 && Math.abs(totals.gross - draft.folioCharges) > 0.05;

  const issue = async () => {
    if (draft.existing.some((x) => x.status !== 'cancelled')) {
      const ok = await showConfirm(k('anotherBody'), { title: k('anotherTitle'), confirmLabel: k('issue'), cancelLabel: t('crm.hotels.common.cancel') });
      if (!ok) return;
    }
    setBusy(true);
    issueEInvoice(reservationId, { folio, recipient: rcp, lines, exchangeRate: cur === 'TRY' ? null : numIn(rate) || null, note: note || undefined, allowAnother: draft.existing.length > 0 })
      .then((d) => {
        showAlert(d.status === 'issued' ? k('issuedOk', { no: d.invoiceNo || '' }) : d.status === 'error' ? k('issuedError', { error: d.error || '' }) : k('sendingOk'), { variant: d.status === 'error' ? 'error' : 'success' });
        onIssued();
        onClose();
      })
      .catch((e) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  const field = (key: keyof HotelEInvoiceRecipient, label: string, wide = false) => (
    <label className={`ei-f${wide ? ' wide' : ''}`}>
      <span>{label}</span>
      <input value={String(rcp[key] ?? '')} onChange={(e) => setRcp({ ...rcp, [key]: e.target.value })} />
    </label>
  );

  return createPortal(
    <div className="px-scope">
      <div className="lv-backdrop bk-modal-back ei-back" onClick={onClose} />
      <div className="bk-modal ei-dialog lv-dialog" role="dialog" aria-modal="true">
        <div className="bk-modal-head">
          <h3>{k('title', { folio: t(`crm.hotels.folio.folios.${folio}`) })}</h3>
          <button type="button" onClick={onClose} aria-label={t('crm.hotels.common.cancel')}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="bk-modal-body">
          {!draft.connected && <div className="ei-warn">{k('notConnected')}</div>}
          {draft.existing.filter((x) => x.status !== 'cancelled').map((x) => (
            <div key={x.id} className="ei-warn">{k('existing', { no: x.invoiceNo || '—', amount: m(x.gross), status: k(`status.${x.status}`) })}</div>
          ))}

          <div className="ei-sec">{k('recipient')}</div>
          <div className="htl-seg ei-kind">
            {(['person', 'company'] as const).map((x) => <button key={x} type="button" className={rcp.kind === x ? 'on' : ''} onClick={() => setRcp({ ...rcp, kind: x })}>{k(`kind.${x}`)}</button>)}
          </div>
          <div className="ei-grid">
            {field('name', k('f.name'), true)}
            {field('taxNumber', rcp.kind === 'company' ? k('f.vkn') : k('f.tckn'))}
            {rcp.kind === 'company' && field('taxOffice', k('f.taxOffice'))}
            {field('address', k('f.address'), true)}
            {field('city', k('f.city'))}
            {field('district', k('f.district'))}
            {field('email', k('f.email'))}
            <label className="hk-check inline ei-abroad"><input type="checkbox" checked={!!rcp.abroad} onChange={(e) => setRcp({ ...rcp, abroad: e.target.checked })} /><span>{k('f.abroad')}</span></label>
          </div>
          {rcp.kind === 'person' && <div className="htl-hint">{k('tcknHint')}</div>}

          <div className="ei-sec">{k('lines')}</div>
          <div className="ei-lines">
            <div className="ei-ln head"><span>{k('col.description')}</span><span>{k('col.qty')}</span><span>{k('col.unit')}</span><span>{k('col.vat')}</span><span>{k('col.accTax')}</span><span>{k('col.discount')}</span><span className="num">{k('col.gross')}</span></div>
            {lines.map((l, i) => (
              <div key={i} className="ei-ln">
                <input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} aria-label={k('col.description')} />
                <input type="number" min={0.01} step="0.01" value={l.quantity} onChange={(e) => setLine(i, { quantity: numIn(e.target.value) })} aria-label={k('col.qty')} />
                <input type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: numIn(e.target.value) })} aria-label={k('col.unit')} />
                <input type="number" min={0} max={100} step="1" value={l.vatPct} onChange={(e) => setLine(i, { vatPct: numIn(e.target.value) })} aria-label={k('col.vat')} />
                {l.kind === 'accommodation' ? <input type="number" min={0} max={100} step="0.5" value={l.accTaxPct} onChange={(e) => setLine(i, { accTaxPct: numIn(e.target.value) })} aria-label={k('col.accTax')} /> : <span className="htl-sub">—</span>}
                <input type="number" min={0} step="0.01" value={l.discount} onChange={(e) => setLine(i, { discount: numIn(e.target.value) })} aria-label={k('col.discount')} />
                <b className="num mono">{m(eInvoiceLineTotals(l).gross)}</b>
              </div>
            ))}
            {!lines.length && <div className="htl-sub" style={{ padding: 10 }}>{k('noLines')}</div>}
          </div>
          <div className="ei-tot">
            <div><span>{k('t.net')}</span><b>{m(totals.net)}</b></div>
            {totals.acc > 0 && <div><span>{k('t.accTax')}</span><b>{m(totals.acc)}</b></div>}
            <div><span>{k('t.vat')}</span><b>{m(totals.vat)}</b></div>
            <div className="g"><span>{k('t.gross')}</span><b>{m(totals.gross)}</b></div>
          </div>
          {mismatch && <div className="ei-warn">{k('mismatch', { folio: m(draft.folioCharges) })}</div>}
          {draft.warnings.includes('discount_exceeds') && <div className="ei-warn">{k('discountExceeds')}</div>}

          <div className="ei-grid">
            {cur !== 'TRY' && (
              <label className="ei-f">
                <span>{k('rate', { cur })}</span>
                <input type="number" min={0} step="0.0001" value={rate} onChange={(e) => setRate(e.target.value)} />
                <em>{draft.exchangeRateDate ? k('rateHint', { date: draft.exchangeRateDate }) : k('rateManual')}</em>
              </label>
            )}
            <label className="ei-f wide"><span>{k('note')}</span><input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></label>
          </div>
          <div className="htl-hint">{k('docTypeHint')}</div>
        </div>
        <div className="bk-modal-foot">
          <button type="button" className="btn" onClick={onClose}>{t('crm.hotels.common.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={busy || !draft.connected || !lines.length} onClick={() => void issue()}><Ic d={HTL_ICON.check} size={14} />{k('issue')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
