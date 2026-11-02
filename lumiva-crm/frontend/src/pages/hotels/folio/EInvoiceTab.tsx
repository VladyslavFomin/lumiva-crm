import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { hotelErrorText } from '../ReservationLifecycle';
import { fetchEInvoiceConnection, saveEInvoiceConnection, testEInvoiceConnection, type HotelEInvoiceConnection } from '../../../api/hotels';
import { EInvoiceDocs } from './EInvoiceDocs';

const STATUSES = ['', 'sending', 'issued', 'error', 'cancelled'];

/** Касса → e-Fatura: доступы интегратора (секреты не возвращаются — только «задан, …1234»), ставки, документы отеля */
export const EInvoiceTab: React.FC<{ hotelId: string }> = ({ hotelId }) => {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`crm.hotels.einvoice.${key}`, o);
  const { showAlert } = useAlertModal();
  const [c, setC] = useState<HotelEInvoiceConnection | null>(null);
  const [f, setF] = useState({ clientId: '', clientSecret: '', username: '', password: '', externalCompanyId: '', invoiceSeries: '', extrasVatPct: '20', accTaxMode: 'line_tax', active: true });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const apply = (x: HotelEInvoiceConnection) => {
    setC(x);
    setF({
      clientId: x.clientId || '', clientSecret: '', username: x.username || '', password: '', externalCompanyId: x.externalCompanyId || '',
      invoiceSeries: x.settings.invoiceSeries || '', extrasVatPct: String(x.settings.extrasVatPct ?? 20), accTaxMode: x.settings.accTaxMode || 'line_tax', active: x.connected ? x.active : true,
    });
  };
  useEffect(() => { setC(null); fetchEInvoiceConnection(hotelId).then(apply).catch(() => undefined); }, [hotelId]);
  const err = (e: unknown) => showAlert(hotelErrorText(t, e, k('saveError')), { variant: 'error' });
  const save = () => {
    setBusy(true);
    saveEInvoiceConnection({
      hotelId, provider: 'parasut', active: f.active, clientId: f.clientId, clientSecret: f.clientSecret || undefined, username: f.username, password: f.password || undefined,
      externalCompanyId: f.externalCompanyId, settings: { invoiceSeries: f.invoiceSeries, extrasVatPct: Number(f.extrasVatPct.replace(',', '.')), accTaxMode: f.accTaxMode as 'line_tax' | 'separate_line' },
    })
      .then((x) => { apply(x); showAlert(k('saved'), { variant: 'success' }); })
      .catch(err)
      .finally(() => setBusy(false));
  };
  const test = () => {
    setBusy(true);
    testEInvoiceConnection(hotelId)
      .then(() => { showAlert(k('testOk'), { variant: 'success' }); return fetchEInvoiceConnection(hotelId).then(apply); })
      .catch((e) => { err(e); return fetchEInvoiceConnection(hotelId).then(apply); })
      .finally(() => setBusy(false));
  };
  if (!c) return <div className="htl-rack-skel">{[0, 1].map((i) => <div key={i} />)}</div>;
  const inp = (key: keyof typeof f, label: string, opts: { type?: string; ph?: string } = {}) => (
    <div className="htl-f"><label>{label}</label><input type={opts.type || 'text'} placeholder={opts.ph} value={String(f[key])} autoComplete="off" onChange={(e) => setF({ ...f, [key]: e.target.value })} /></div>
  );
  return (
    <>
      <div className="htl-panel">
        <p className="htl-fd-note">{k('setupHint')}</p>
        <div className="htl-form ei-setup">
          <div className="htl-f"><label>{k('provider')}</label><select value="parasut" disabled><option value="parasut">Paraşüt</option></select></div>
          {inp('externalCompanyId', k('companyId'), { ph: '123456' })}
          {inp('clientId', 'Client ID')}
          {inp('clientSecret', 'Client secret', { type: 'password', ph: c.clientSecretMasked ? k('secretSet', { tail: c.clientSecretMasked }) : '' })}
          {inp('username', k('username'))}
          {inp('password', k('password'), { type: 'password', ph: c.passwordSet ? k('passwordSet') : '' })}
          {inp('invoiceSeries', k('series'), { ph: 'ABC' })}
          {inp('extrasVatPct', k('extrasVat'), { type: 'number' })}
          <div className="htl-f">
            <label>{k('accTaxMode')}</label>
            <select value={f.accTaxMode} onChange={(e) => setF({ ...f, accTaxMode: e.target.value })}>
              <option value="line_tax">{k('accTax.line_tax')}</option>
              <option value="separate_line">{k('accTax.separate_line')}</option>
            </select>
          </div>
        </div>
        <label className="hk-check inline" style={{ marginTop: 10 }}><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /><span>{k('active')}</span></label>
        <div className="htl-hint">{k('accTaxHint')}</div>
        {c.lastError && <div className="ei-warn">{k('lastError', { error: c.lastError })}</div>}
        {!c.lastError && c.lastCheckedAt && <div className="htl-sub" style={{ marginTop: 6 }}>{k('lastOk', { at: new Date(c.lastCheckedAt).toLocaleString() })}</div>}
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{t('crm.hotels.common.save')}</button>
          <button className="btn" disabled={busy || !c.connected} onClick={test}>{k('test')}</button>
        </div>
      </div>
      <div className="htl-toolbar" style={{ marginTop: 18 }}>
        <div className="htl-sub">{k('docsAll')}</div>
        <select className="htl-select" style={{ marginLeft: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s ? k(`status.${s}`) : k('allStatuses')}</option>)}
        </select>
      </div>
      <EInvoiceDocs hotelId={hotelId} status={status} full />
    </>
  );
};
