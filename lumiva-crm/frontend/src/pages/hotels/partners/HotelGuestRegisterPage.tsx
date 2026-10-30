import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../../layout/MainLayout';
import { PageHelpButton } from '../../../components/help/PageHelpButton';
import { useAlertModal } from '../../../contexts/AlertModalContext';
import { HotelsSubnav } from '../HotelsSubnav';
import { Ic, HTL_ICON } from '../HotelIcons';
import { CountryTag } from '../CountrySelect';
import { fmtDate, todayIso, addDaysIso } from './partnerUtils';
import {
  downloadGuestRegisterXlsx,
  fetchGuestRegister,
  fetchHotels,
  markGuestsReported,
  type GuestRegister,
  type GuestRegisterRow,
  type Hotel,
} from '../../../api/hotels';
import '../hotels-design.css';
import { DateInput } from '../../../components/ui/DateInput';

type Mode = 'inhouse' | 'arrivals' | 'departures';
const MODES: Mode[] = ['arrivals', 'inhouse', 'departures'];
const keyOf = (r: GuestRegisterRow) => `${r.reservationId}:${r.guestId ?? ''}`;

/** Журнал гостей для KBS (Турция) / МВД (Россия): полнота данных каждого гостя, выгрузка, отметка «передано». */
export const HotelGuestRegisterPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const g = (k: string, o?: Record<string, unknown>) => t(`crm.hotels.guestRegister.${k}`, o);
  const lang = i18n.language;
  const { showAlert } = useAlertModal();
  const [sp, setSp] = useSearchParams();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const hotelId = sp.get('hotelId') || hotels[0]?.id || '';
  const [date, setDate] = useState(todayIso());
  const [mode, setMode] = useState<Mode>('arrivals');
  /** '' — по стране отеля (решает сервер), иначе выбран вручную */
  const [regimePick, setRegimePick] = useState<'' | 'kbs' | 'mvd'>('');
  const [data, setData] = useState<GuestRegister | null>(null);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchHotels().then(setHotels).catch((e) => showAlert(e.message, { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const load = () => {
    if (!hotelId) return;
    fetchGuestRegister({ hotelId, date, mode, regime: regimePick || undefined })
      .then((d) => {
        setData(d);
        setSelected(new Set());
      })
      .catch((e) => showAlert(e.message, { variant: 'error' }));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId, date, mode, regimePick]);
  useEffect(() => setRegimePick(''), [hotelId]);
  const regime = data?.regime || 'kbs';
  const mvd = regime === 'mvd';

  const rows = useMemo(() => (data?.rows || []).filter((r) => !onlyIssues || r.issues.length), [data, onlyIssues]);
  const readyUnreported = (data?.rows || []).filter((r) => !r.issues.length && !r.reportedAt && r.guestId);
  const toggle = (k: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    return n;
  });

  const mark = async (list: GuestRegisterRow[], reported: boolean) => {
    const items = list.filter((r) => r.guestId).map((r) => ({ reservationId: r.reservationId, guestId: r.guestId }));
    if (!items.length) return showAlert(g('nothingToMark'), { variant: 'error' });
    setBusy(true);
    try {
      const r = await markGuestsReported(items, reported);
      showAlert(reported ? g('marked', { n: r.marked }) : g('unmarked', { n: r.marked }), { variant: 'success' });
      load();
    } catch (e) {
      showAlert((e as Error).message, { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <MainLayout>
      <PageHelpButton topic="hotels" />
      <div className="px-scope">
        <HotelsSubnav active="guestRegister" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{mvd ? g('kickerMvd') : g('kicker')}</div>
            <h1>{g('title')}</h1>
            <p className="sub">{g('subtitle')}</p>
          </div>
          <div className="htl-hero-r">
            <button
              className="btn"
              disabled={!data?.rows.length}
              onClick={() => downloadGuestRegisterXlsx({ hotelId, date, mode, regime }).catch((e) => showAlert(e.message, { variant: 'error' }))}
            >
              <Ic d={HTL_ICON.download} size={13} />{g('export')}
            </button>
            <button className="btn btn-primary" disabled={busy || !readyUnreported.length} onClick={() => mark(readyUnreported, true)}>
              <Ic d={HTL_ICON.check} size={14} />{g('markReady', { n: readyUnreported.length })}
            </button>
          </div>
        </div>

        <div className="htl-toolbar">
          <select className="htl-select" value={hotelId} onChange={(e) => setSp({ hotelId: e.target.value })}>
            {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <button className="btn btn-sm" onClick={() => setDate(addDaysIso(date, -1))}>‹</button>
          <DateInput className="htl-date" value={date} onChange={(v) => v && setDate(v)}  inline clearable={false} />
          <button className="btn btn-sm" onClick={() => setDate(addDaysIso(date, 1))}>›</button>
          <button className="btn btn-sm" onClick={() => setDate(todayIso())}>{g('today')}</button>
          <div className="bk-savedviews" style={{ flex: 'none' }}>
            {MODES.map((m) => (
              <div key={m} className={`bk-sv-tab${mode === m ? ' active' : ''}`} onClick={() => setMode(m)}>{g(`modes.${m}`)}</div>
            ))}
          </div>
          <div className="htl-seg">
            {(['kbs', 'mvd'] as const).map((x) => (
              <button key={x} type="button" className={regime === x ? 'on' : ''} onClick={() => setRegimePick(x)}>{g(`regime.${x}`)}</button>
            ))}
          </div>
          <label className="htl-check"><input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />{g('onlyIssues')}</label>
        </div>

        {data && (
          <div className="htl-kpis" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginTop: 0 }}>
            <div className="htl-kpi"><div className="l">{g('kpi.guests')}</div><div className="v">{data.summary.guests}</div></div>
            <div className="htl-kpi"><div className="l">{g('kpi.foreigners')}</div><div className="v">{data.summary.foreigners}</div></div>
            <div className="htl-kpi"><div className="l">{g('kpi.ready')}</div><div className="v">{data.summary.ready}</div></div>
            <div className="htl-kpi"><div className="l">{g('kpi.issues')}</div><div className="v">{data.summary.withIssues}</div><div className={`d${data.summary.withIssues ? ' down' : ''}`}>{data.summary.withIssues ? g('kpi.fixHint') : ''}</div></div>
            <div className="htl-kpi">
              <div className="l">{g('kpi.reported')}</div>
              <div className="v">{data.summary.reported}</div>
              {mvd && data.summary.overdue > 0 && <div className="d down">{g('kpi.overdue', { n: data.summary.overdue })}</div>}
            </div>
          </div>
        )}

        {selected.size > 0 && (
          <div className="htl-toolbar" style={{ marginTop: 0 }}>
            <span className="htl-sub">{g('selected', { n: selected.size })}</span>
            <button className="btn btn-sm" disabled={busy} onClick={() => mark(rows.filter((r) => selected.has(keyOf(r))), true)}>{g('markSelected')}</button>
            <button className="btn btn-sm" disabled={busy} onClick={() => mark(rows.filter((r) => selected.has(keyOf(r))), false)}>{g('unmarkSelected')}</button>
          </div>
        )}

        {!hotels.length ? (
          <div className="htl-empty"><h4>{t('crm.hotels.inventory.noHotels')}</h4></div>
        ) : data && !rows.length ? (
          <div className="htl-empty">
            <h4>{onlyIssues ? g('emptyIssues') : g(`empty.${mode}`)}</h4>
            <p>{g('emptyHint')}</p>
          </div>
        ) : (
          <div className="bk-table-wrap">
            <table className="bk-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }} />
                  <th>{g('col.guest')}</th>
                  <th>{g('col.nationality')}</th>
                  <th>{g('col.document')}</th>
                  <th>{g('col.birth')}</th>
                  <th>{g('col.gender')}</th>
                  <th>{g('col.room')}</th>
                  {mvd && <th>{g('col.migration')}</th>}
                  <th>{g('col.stay')}</th>
                  <th>{g('col.check')}</th>
                  <th>{g('col.reported')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={keyOf(r)}>
                    <td>{r.guestId && <input type="checkbox" checked={selected.has(keyOf(r))} onChange={() => toggle(keyOf(r))} />}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.lastName ? <>{r.lastName}, {r.firstName}</> : r.fullName || '—'}</div>
                      {r.nationality === 'TR' && (r.fatherName || r.motherName) && <div className="htl-sub">{[r.fatherName, r.motherName].filter(Boolean).join(' / ')}</div>}
                    </td>
                    <td><CountryTag code={r.nationality} /></td>
                    <td className="mono">
                      {!mvd && r.nationality === 'TR' ? (r.tcKimlikNo ? `TC ${r.tcKimlikNo}` : '—') : r.documentNumber || '—'}
                      {r.documentExpiry && (mvd || r.nationality !== 'TR') && <div className="htl-sub">{g('until', { d: fmtDate(r.documentExpiry, lang) })}</div>}
                    </td>
                    <td className="mono">{r.birthDate ? fmtDate(r.birthDate, lang) : '—'}</td>
                    <td>{r.gender ? g(`gender.${r.gender}`) : '—'}</td>
                    <td>{r.room || '—'}<div className="htl-sub">{r.roomType || ''}</div></td>
                    {mvd && (
                      <td className="mono">
                        {r.nationality && r.nationality !== 'RU' ? r.migrationCard || '—' : <span className="htl-sub">{g('citizenRu')}</span>}
                        {r.deadline && !r.reportedAt && (
                          <div className={`htl-sub${r.deadline < todayIso() ? ' htl-overdue' : ''}`}>{g('deadline', { d: fmtDate(r.deadline, lang) })}</div>
                        )}
                      </td>
                    )}
                    <td className="mono">{fmtDate(r.checkIn, lang)} — {fmtDate(r.checkOut, lang)}</td>
                    <td>
                      {r.issues.length === 0 ? (
                        <span className="bk-badge completed">{g('ok')}</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {r.issues.map((i) => <span key={i} className="bk-badge rejected">{g(`issues.${i}`)}</span>)}
                        </div>
                      )}
                      {r.issues.length > 0 && (
                        <a className="htl-sub" style={{ textDecoration: 'underline', display: 'inline-block', marginTop: 4 }} href={`/hotels/reservations?reservation=${r.reservationId}`}>{g('fix')}</a>
                      )}
                    </td>
                    <td className="htl-sub">{r.reportedAt ? new Date(r.reportedAt).toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="htl-hint" style={{ marginTop: 10, maxWidth: 760 }}>{mvd ? g('legalMvd') : g('legal')}</p>
      </div>
    </MainLayout>
  );
};
