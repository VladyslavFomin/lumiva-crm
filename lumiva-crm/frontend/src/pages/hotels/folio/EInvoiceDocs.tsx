import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { hotelErrorText } from '../ReservationLifecycle';
import { money } from '../partners/partnerUtils';
import { cancelEInvoice, fetchEInvoicePdf, fetchEInvoices, refreshEInvoice, type HotelEInvoiceDoc } from '../../../api/hotels';

/** Выставленные e-Fatura / e-Arşiv: в фолио брони (reservationId) или все по отелю (hotelId, в кассе) */
export const EInvoiceDocs: React.FC<{ reservationId?: string; hotelId?: string; status?: string; full?: boolean }> = ({ reservationId, hotelId, status, full }) => {
  const { t, i18n } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.einvoice.${key}`, o);
  const loc = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlertModal();
  const [rows, setRows] = useState<HotelEInvoiceDoc[] | null>(null);
  const load = useCallback(() => fetchEInvoices({ reservationId, hotelId, status: status || undefined }).then(setRows).catch(() => setRows([])), [reservationId, hotelId, status]);
  useEffect(() => { void load(); }, [load]);
  // документ формируется у интегратора — подтягиваем статус, пока открыт экран
  useEffect(() => {
    if (!rows?.some((d) => d.status === 'sending')) return;
    const h = window.setTimeout(() => void load(), 15_000);
    return () => window.clearTimeout(h);
  }, [rows, load]);
  const err = (e: unknown) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' });
  const pdf = (d: HotelEInvoiceDoc) => fetchEInvoicePdf(d.id).then((r) => window.open(r.url, '_blank', 'noopener')).catch(err);
  const refresh = (d: HotelEInvoiceDoc) => refreshEInvoice(d.id).then(load).catch(err);
  const cancel = async (d: HotelEInvoiceDoc) => {
    const ok = await showConfirm(d.status === 'error' ? k('dismissBody') : k('cancelBody', { no: d.invoiceNo || '' }), { title: k('cancelTitle'), confirmLabel: k('cancel'), cancelLabel: t('crm.hotels.common.cancel'), danger: true });
    if (ok) cancelEInvoice(d.id).then(load).catch(err);
  };
  if (!rows) return full ? <div className="htl-rack-skel">{[0, 1].map((i) => <div key={i} />)}</div> : null;
  if (!rows.length) return full ? <div className="htl-empty"><h4>{k('noDocs')}</h4><p>{k('noDocsHint')}</p></div> : null;
  return (
    <div className={full ? 'bk-table-wrap' : 'ei-docs'}>
      {!full && <div className="htl-folio-sec">{k('docs')}</div>}
      <table className="bk-table">
        <thead><tr><th>{k('col.no')}</th>{full && <th>{k('col.recipient')}</th>}<th>{k('col.type')}</th><th>{k('col.status')}</th><th className="num">{k('col.gross')}</th><th /></tr></thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className={d.status === 'cancelled' ? 'grp-off' : undefined}>
              <td className="mono">{d.invoiceNo || '—'}<div className="htl-sub">{d.issueDate}</div></td>
              {full && <td><button type="button" className="lnk" onClick={() => navigate(`/hotels/reservations?reservation=${d.reservationId}`)}>{d.recipient.name}</button><div className="htl-sub">{t(`crm.hotels.folio.folios.${d.folio}`)}</div></td>}
              <td>{d.docType ? k(`type.${d.docType}`) : '—'}</td>
              <td><span className={`ei-st s-${d.status}`}>{k(`status.${d.status}`)}</span>{d.error && <div className="htl-sub ei-err">{d.error}</div>}</td>
              <td className="num mono">{money(d.totals.gross, d.currency, loc)}</td>
              <td className="ei-acts">
                {(d.status === 'issued' || (d.status === 'cancelled' && d.invoiceNo)) && <button type="button" className="btn btn-sm" onClick={() => void pdf(d)}>PDF</button>}
                {d.status === 'sending' && <button type="button" className="btn btn-sm" onClick={() => void refresh(d)}>{k('refresh')}</button>}
                {(d.status === 'error' || (d.status === 'issued' && d.docType === 'e_archive')) && <button type="button" className="btn btn-sm" onClick={() => void cancel(d)}>{d.status === 'error' ? k('dismiss') : k('cancel')}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
