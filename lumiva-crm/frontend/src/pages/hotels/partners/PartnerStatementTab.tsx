import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { Ic, HTL_ICON } from '../HotelIcons';
import { money, fmtDate } from './partnerUtils';
import { downloadPartnerStatement, fetchPartnerStatement, sendPartnerStatement, type HotelAgency, type PartnerStatement } from '../../../api/hotels';
import { DateInput } from '../../../components/ui/DateInput';

const prevMonth = () => {
  const n = new Date();
  const from = new Date(n.getFullYear(), n.getMonth() - 1, 1);
  const to = new Date(n.getFullYear(), n.getMonth(), 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: iso(from), to: iso(to) };
};

/** Выписка партнёру: брони за период с брутто/комиссией/нетто; PDF, Excel, отправка с почты отеля. */
export const PartnerStatementTab: React.FC<{ partner: HotelAgency }> = ({ partner }) => {
  const { t, i18n } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`crm.hotels.statement.${k}`, o);
  const lang = i18n.language;
  const { showAlert } = useAlertModal();
  const [q, setQ] = useState({ ...prevMonth(), basis: 'checkout' as 'checkout' | 'arrival' });
  const [st, setSt] = useState<PartnerStatement | null>(null);
  const [email, setEmail] = useState(partner.email || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!q.from || !q.to) return;
    fetchPartnerStatement(partner.id, q).then(setSt).catch((e) => showAlert(e.message, { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner.id, q.from, q.to, q.basis]);

  const cur = st?.currency || null;
  const dl = (f: 'pdf' | 'xlsx') => downloadPartnerStatement(partner.id, q, f).catch((e) => showAlert(e.message, { variant: 'error' }));
  const send = async () => {
    setBusy(true);
    try {
      const r = await sendPartnerStatement(partner.id, { ...q, email: email || undefined });
      showAlert(s('sent', { to: r.to }), { variant: 'success' });
    } catch (e) {
      showAlert((e as Error).message, { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="htl-toolbar">
        <label className="htl-sub">{s('period')}</label>
        <DateInput className="htl-date" value={q.from} onChange={(v) => setQ((x) => ({ ...x, from: v }))}  inline clearable={false} />
        <span className="htl-sub">—</span>
        <DateInput className="htl-date" value={q.to} onChange={(v) => setQ((x) => ({ ...x, to: v }))}  inline clearable={false} />
        <div className="htl-seg">
          {(['checkout', 'arrival'] as const).map((b) => (
            <button key={b} type="button" className={q.basis === b ? 'on' : ''} onClick={() => setQ((x) => ({ ...x, basis: b }))}>{s(`basis.${b}`)}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn btn-sm" disabled={!st?.rows.length} onClick={() => dl('pdf')}><Ic d={HTL_ICON.download} size={12} />PDF</button>
          <button className="btn btn-sm" disabled={!st?.rows.length} onClick={() => dl('xlsx')}><Ic d={HTL_ICON.download} size={12} />Excel</button>
          <input className="htl-date" style={{ width: 210 }} type="email" placeholder={s('emailPh')} value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn btn-sm btn-primary" disabled={busy || !st?.rows.length || !email} onClick={send}>{s('send')}</button>
        </div>
      </div>

      {st && (
        <>
          <div className="htl-kpis" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginTop: 0 }}>
            <div className="htl-kpi"><div className="l">{s('kpi.bookings')}</div><div className="v">{st.totals.bookings}</div></div>
            <div className="htl-kpi"><div className="l">{s('kpi.roomNights')}</div><div className="v">{st.totals.roomNights}</div></div>
            <div className="htl-kpi"><div className="l">{s('kpi.gross')}</div><div className="v">{money(st.totals.gross, cur, lang)}</div></div>
            <div className="htl-kpi"><div className="l">{s('kpi.commission')}</div><div className="v">{money(st.totals.commission, cur, lang)}</div><div className="d">{s('kpi.commissionHint')}</div></div>
            <div className="htl-kpi"><div className="l">{s('kpi.net')}</div><div className="v">{money(st.totals.net, cur, lang)}</div></div>
          </div>
          {!st.currency && st.rows.length > 0 && <p className="htl-hint" style={{ marginTop: -6 }}>{s('mixedCurrency')}</p>}
          <div className="bk-table-wrap">
            <table className="bk-table">
              <thead>
                <tr>
                  <th>{s('col.booking')}</th>
                  <th>{s('col.hotel')}</th>
                  <th>{s('col.guest')}</th>
                  <th>{s('col.dates')}</th>
                  <th>{s('col.nights')}</th>
                  <th>{s('col.gross')}</th>
                  <th>{s('col.commission')}</th>
                  <th>{s('col.net')}</th>
                </tr>
              </thead>
              <tbody>
                {st.rows.map((r) => (
                  <tr key={r.reservationId}>
                    <td className="mono">{r.bookingCode || r.reservationId.slice(0, 8)}</td>
                    <td>{r.hotel}</td>
                    <td style={{ fontWeight: 600 }}>{r.guestName}</td>
                    <td className="mono">{fmtDate(r.checkIn, lang)} — {fmtDate(r.checkOut, lang)}</td>
                    <td className="mono">{r.nights}</td>
                    <td className="mono">{money(r.gross, cur, lang)}</td>
                    <td className="mono">{r.commission ? `${money(r.commission, cur, lang)} · ${r.commissionPct}%` : '—'}</td>
                    <td className="mono">{money(r.net, cur, lang)}</td>
                  </tr>
                ))}
                {st.rows.length === 0 && (
                  <tr><td colSpan={8} className="htl-sub" style={{ textAlign: 'center', padding: 24 }}>{s('empty')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
};
