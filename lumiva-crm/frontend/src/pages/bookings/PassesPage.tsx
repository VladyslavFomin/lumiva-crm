import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { Ic, BK_ICON } from './BookingIcons';
import { fetchBookingProject, fetchBookingServices, type BookingServiceItem } from '../../api/bookings';
import {
  fetchPassPlans,
  createPassPlan,
  updatePassPlan,
  deletePassPlan,
  fetchPasses,
  fetchPass,
  fetchPassStats,
  sellPass,
  freezePass,
  unfreezePass,
  adjustPass,
  cancelPass,
  type ClientPass,
  type PassPlan,
  type BookingPaymentMethod,
} from '../../api/bookingVerticals';
import { useBookingVertical } from './useBookingVertical';
import { BkDrawer, BkModal, EmptyState, MiniKpi, errMsg, fmtDate, fmtMoney, fmtTime, useDateLocale, ymdLocal } from './verticalUi';
import './bookings-design.css';
import './bookings-verticals.css';

const FILTERS = ['active', 'frozen', 'expired', 'used_up', 'cancelled', 'all'] as const;

export const PassesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert, showConfirm, showPrompt } = useAlertModal();
  const locale = useDateLocale();
  const { type, terms } = useBookingVertical();
  // для консультаций — «пакеты сессий» вместо «абонементов» (ключи *_pkg), иначе общий текст
  const P = (k: string, o: Record<string, unknown> = {}): string =>
    String(t(`crm.bookings.v.passes.${k}${type === 'consultation' ? '_pkg' : ''}`, { ...o, defaultValue: String(t(`crm.bookings.v.passes.${k}`, o)) }));
  const [tab, setTab] = useState<'clients' | 'plans'>('clients');
  const [plans, setPlans] = useState<PassPlan[]>([]);
  const [passes, setPasses] = useState<ClientPass[]>([]);
  const [stats, setStats] = useState<{ active: number; frozen: number; expiringSoon: number; lowVisits: number; unpaid: number } | null>(null);
  const [services, setServices] = useState<BookingServiceItem[]>([]);
  const [currency, setCurrency] = useState('RUB');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('active');
  const [search, setSearch] = useState('');
  const [planEdit, setPlanEdit] = useState<Partial<PassPlan> | null>(null);
  const [sell, setSell] = useState<{ planId: string; name: string; phone: string; email: string; startsAt: string; price: string; method: '' | BookingPaymentMethod } | null>(null);
  const [detail, setDetail] = useState<ClientPass | null>(null);
  const [busy, setBusy] = useState(false);

  const loadPlans = () => fetchPassPlans().then(setPlans).catch(() => undefined);
  const loadPasses = () => {
    fetchPasses({ status: filter === 'all' ? undefined : filter, search: search.trim() || undefined })
      .then(setPasses)
      .catch((e) => showAlert(errMsg(e, t('crm.bookings.v.common.loadError')), { variant: 'error' }));
    fetchPassStats().then(setStats).catch(() => undefined);
  };

  useEffect(() => {
    loadPlans();
    fetchBookingServices().then(setServices).catch(() => undefined);
    fetchBookingProject().then((p) => setCurrency(p.currency)).catch(() => undefined);
  }, []);
  useEffect(() => {
    const id = window.setTimeout(loadPasses, search ? 300 : 0);
    return () => window.clearTimeout(id);
  }, [filter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = (id: string) => fetchPass(id).then(setDetail).catch((e) => showAlert(errMsg(e, t('crm.bookings.v.common.loadError')), { variant: 'error' }));

  const act = async (fn: () => Promise<ClientPass | unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) showAlert(ok, { variant: 'success' });
      loadPasses();
      if (detail) await openDetail(detail.id);
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const savePlan = async () => {
    if (!planEdit?.name?.trim()) return;
    setBusy(true);
    try {
      const dto = { ...planEdit, visits: planEdit.kind === 'unlimited' ? null : Number(planEdit.visits) || 1, validityDays: Number(planEdit.validityDays) || 30, price: String(Number(planEdit.price) || 0), freezeDaysAllowed: Number(planEdit.freezeDaysAllowed) || 0 };
      if (planEdit.id) await updatePassPlan(planEdit.id, dto);
      else await createPassPlan(dto);
      setPlanEdit(null);
      loadPlans();
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const removePlan = async (p: PassPlan) => {
    if (!(await showConfirm(t('crm.bookings.v.passes.deletePlanConfirm', { name: p.name }), { danger: true }))) return;
    const r = await deletePassPlan(p.id).catch((e) => { showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' }); return null; });
    if (r?.archived) showAlert(t('crm.bookings.v.passes.planArchived'), { variant: 'info' });
    loadPlans();
  };

  const doSell = async () => {
    if (!sell?.planId) return;
    if (!sell.name.trim() && !sell.phone.trim() && !sell.email.trim()) {
      showAlert(t('crm.bookings.v.passes.needClient'), { variant: 'error' });
      return;
    }
    setBusy(true);
    try {
      const p = await sellPass({ planId: sell.planId, customerName: sell.name.trim() || undefined, customerPhone: sell.phone.trim() || undefined, customerEmail: sell.email.trim() || undefined, startsAt: sell.startsAt, price: sell.price === '' ? undefined : sell.price, paymentMethod: sell.method || null });
      setSell(null);
      showAlert(P('sold', { number: p.number }), { variant: 'success' });
      loadPasses();
      setDetail(p);
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const svcNames = (ids: string[]) => (ids?.length ? ids.map((id) => services.find((s) => s.id === id)?.name).filter(Boolean).join(', ') : t('crm.bookings.v.passes.allServices'));
  const planOf = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);
  const soon = ymdLocal(new Date(Date.now() + 7 * 86400_000));

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="passes" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{P('kicker')}</div>
            <h1>{P('title')}</h1>
            <p className="sub">{P('subtitle')}</p>
          </div>
          <div className="bk-hero-r">
            <button className="btn btn-sm" onClick={() => setPlanEdit({ name: '', kind: 'visits', visits: 8, validityDays: 30, price: '', currency, serviceIds: [], freezeDaysAllowed: 0, active: true })}><Ic d={BK_ICON.plus} size={13} /> {t('crm.bookings.v.passes.newPlan')}</button>
            <button className="btn btn-primary btn-sm" disabled={!plans.some((p) => p.active)} onClick={() => setSell({ planId: plans.find((p) => p.active)?.id || '', name: '', phone: '', email: '', startsAt: ymdLocal(new Date()), price: '', method: '' })}>
              <Ic d={BK_ICON.plus} size={13} /> {P('sell')}
            </button>
          </div>
        </div>

        {stats && (
          <div className="bk-mini-kpis">
            <MiniKpi label={t('crm.bookings.v.passes.kpiActive')} value={stats.active} tone="good" />
            <MiniKpi label={t('crm.bookings.v.passes.kpiExpiring')} value={stats.expiringSoon} tone={stats.expiringSoon ? 'warn' : undefined} />
            <MiniKpi label={t('crm.bookings.v.passes.kpiLow')} value={stats.lowVisits} tone={stats.lowVisits ? 'warn' : undefined} />
            <MiniKpi label={t('crm.bookings.v.passes.kpiFrozen')} value={stats.frozen} />
            <MiniKpi label={t('crm.bookings.v.passes.kpiUnpaid')} value={stats.unpaid} tone={stats.unpaid ? 'bad' : undefined} />
          </div>
        )}

        <div className="bk-tabs">
          <div className={`bk-tab${tab === 'clients' ? ' active' : ''}`} onClick={() => setTab('clients')}>{P('tabClients')}</div>
          <div className={`bk-tab${tab === 'plans' ? ' active' : ''}`} onClick={() => setTab('plans')}>{t('crm.bookings.v.passes.tabPlans')} · {plans.length}</div>
        </div>

        {tab === 'clients' && (
          <>
            <div className="bk-filters">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line-2)', borderRadius: 8, padding: '7px 12px', width: 220, background: '#fff' }}>
                <Ic d={BK_ICON.search} size={13} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('crm.bookings.v.passes.search')} style={{ border: 0, outline: 'none', fontSize: 12.5, width: '100%' }} />
              </div>
              {FILTERS.map((f) => <span key={f} className={`bk-chip${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>{t(`crm.bookings.v.passes.status.${f}`)}</span>)}
            </div>
            <div className="bk-table-wrap">
              <table className="bk-table">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>{terms.client}</th>
                    <th>{t('crm.bookings.v.passes.colPlan')}</th>
                    <th>{t('crm.bookings.v.passes.colLeft')}</th>
                    <th>{t('crm.bookings.v.passes.colValid')}</th>
                    <th>{t('crm.bookings.v.passes.colStatus')}</th>
                    <th>{t('crm.bookings.v.passes.colPayment')}</th>
                  </tr>
                </thead>
                <tbody>
                  {passes.length === 0 && <tr><td colSpan={7} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>{P('empty')}</td></tr>}
                  {passes.map((p) => (
                    <tr key={p.id} className="clickable" onClick={() => openDetail(p.id)}>
                      <td className="id">№{p.number}</td>
                      <td className="cust-cell"><span className="n">{p.customerName || '—'}</span><span className="s">{p.customerPhone || p.customerEmail || ''}</span></td>
                      <td>{p.planName}</td>
                      <td style={{ minWidth: 120 }}>
                        {p.kind === 'unlimited' ? '∞' : (
                          <>
                            <span className="bk-money">{p.remaining}/{p.visitsTotal}</span>
                            <div className="sc-fill" style={{ maxWidth: 110 }}><i className={p.remaining !== null && p.remaining <= 1 ? 'mid' : ''} style={{ width: `${p.visitsTotal ? (p.visitsUsed / p.visitsTotal) * 100 : 0}%` }} /></div>
                          </>
                        )}
                      </td>
                      <td style={{ color: p.status === 'active' && p.expiresAt <= soon ? '#c08319' : undefined }}>{fmtDate(p.expiresAt, locale, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td><span className={`bk-badge pass-${p.status}`}>{t(`crm.bookings.v.passes.status.${p.status}`)}</span></td>
                      <td>{p.paymentStatus ? <span className={`bk-badge ord-${p.paymentStatus}`}>{t(`crm.bookings.v.orders.status.${p.paymentStatus}`)}</span> : <span className="bk-hint">{t('crm.bookings.v.passes.free')}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'plans' && (
          plans.length === 0 ? (
            <div className="bk-panel"><EmptyState title={t('crm.bookings.v.passes.noPlans')} text={P('noPlansText')} action={<button className="btn btn-primary btn-sm" onClick={() => setPlanEdit({ name: '', kind: 'visits', visits: 8, validityDays: 30, price: '', currency, serviceIds: [], freezeDaysAllowed: 0, active: true })}>{t('crm.bookings.v.passes.newPlan')}</button>} /></div>
          ) : (
            <div className="mn-grid">
              {plans.map((p) => (
                <div key={p.id} className={`mn-card${!p.active ? ' off' : ''}`} style={{ borderTop: `3px solid ${p.color || 'var(--ink)'}` }}>
                  <div className="body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><div className="nm">{p.name}</div>{!p.active && <span className="mn-tag">{t('crm.bookings.v.passes.archived')}</span>}</div>
                    <div style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600 }}>{fmtMoney(p.price, p.currency, locale)}</div>
                    <div className="ds">{p.kind === 'unlimited' ? t('crm.bookings.v.passes.unlimited') : t('crm.bookings.v.passes.visitsN', { count: p.visits || 0 })} · {t('crm.bookings.v.passes.daysN', { count: p.validityDays })}{p.freezeDaysAllowed ? ` · ${t('crm.bookings.v.passes.freezeN', { count: p.freezeDaysAllowed })}` : ''}</div>
                    <div className="ds">{svcNames(p.serviceIds)}</div>
                    {p.kind === 'visits' && p.visits ? <div className="bk-hint">{t('crm.bookings.v.passes.perVisit', { price: fmtMoney(Number(p.price) / p.visits, p.currency, locale) })}</div> : null}
                  </div>
                  <div className="ft">
                    <button className="btn btn-sm" disabled={!p.active} onClick={() => setSell({ planId: p.id, name: '', phone: '', email: '', startsAt: ymdLocal(new Date()), price: '', method: '' })}>{P('sell')}</button>
                    <span style={{ display: 'flex', gap: 4 }}>
                      <button className="bk-x" onClick={() => setPlanEdit({ ...p })}><Ic d={BK_ICON.edit} size={13} /></button>
                      <button className="bk-x" onClick={() => removePlan(p)}><Ic d={BK_ICON.trash} size={13} /></button>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* тариф */}
      <BkModal open={!!planEdit} title={planEdit?.id ? t('crm.bookings.v.passes.editPlan') : t('crm.bookings.v.passes.newPlan')} onClose={() => setPlanEdit(null)}
        footer={<><button className="btn btn-sm" onClick={() => setPlanEdit(null)}>{t('crm.bookings.v.common.cancel')}</button><button className="btn btn-primary btn-sm" disabled={busy || !planEdit?.name?.trim()} onClick={savePlan}>{t('crm.bookings.v.common.save')}</button></>}>
        {planEdit && (
          <>
            <div className="bk-field"><label>{t('crm.bookings.v.passes.planName')}</label><input autoFocus value={planEdit.name || ''} onChange={(e) => setPlanEdit({ ...planEdit, name: e.target.value })} placeholder={P('planNamePh')} /></div>
            <div className="bk-field"><label>{t('crm.bookings.v.passes.kind')}</label>
              <div className="bk-seg">
                <button className={planEdit.kind !== 'unlimited' ? 'on' : ''} onClick={() => setPlanEdit({ ...planEdit, kind: 'visits' })}>{P('kindVisits')}</button>
                <button className={planEdit.kind === 'unlimited' ? 'on' : ''} onClick={() => setPlanEdit({ ...planEdit, kind: 'unlimited' })}>{t('crm.bookings.v.passes.unlimited')}</button>
              </div>
            </div>
            <div className="bk-row3">
              {planEdit.kind !== 'unlimited' && <div className="bk-field"><label>{P('visits')}</label><input type="number" min={1} value={planEdit.visits ?? ''} onChange={(e) => setPlanEdit({ ...planEdit, visits: Number(e.target.value) || null })} /></div>}
              <div className="bk-field"><label>{t('crm.bookings.v.passes.validity')}</label><input type="number" min={1} value={planEdit.validityDays ?? ''} onChange={(e) => setPlanEdit({ ...planEdit, validityDays: Number(e.target.value) || 30 })} /></div>
              <div className="bk-field"><label>{t('crm.bookings.v.passes.freezeDays')}</label><input type="number" min={0} value={planEdit.freezeDaysAllowed ?? 0} onChange={(e) => setPlanEdit({ ...planEdit, freezeDaysAllowed: Number(e.target.value) || 0 })} /></div>
            </div>
            <div className="bk-row3">
              <div className="bk-field"><label>{t('crm.bookings.v.passes.price')}</label><input type="number" min={0} step="0.01" value={planEdit.price ?? ''} onChange={(e) => setPlanEdit({ ...planEdit, price: e.target.value })} /></div>
              <div className="bk-field"><label>{t('crm.bookings.v.menu.currency')}</label><input maxLength={3} value={planEdit.currency || ''} onChange={(e) => setPlanEdit({ ...planEdit, currency: e.target.value.toUpperCase() })} /></div>
              <div className="bk-field"><label>{t('crm.bookings.v.passes.color')}</label><input type="color" value={planEdit.color || '#222222'} onChange={(e) => setPlanEdit({ ...planEdit, color: e.target.value })} style={{ padding: 2, height: 36 }} /></div>
            </div>
            <div className="bk-field"><label>{t('crm.bookings.v.passes.validFor', { label: terms.servicePlural })}</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className={`bk-chip${!planEdit.serviceIds?.length ? ' on' : ''}`} onClick={() => setPlanEdit({ ...planEdit, serviceIds: [] })}>{t('crm.bookings.v.passes.allServices')}</span>
                {services.map((s) => {
                  const on = (planEdit.serviceIds || []).includes(s.id);
                  return <span key={s.id} className={`bk-chip${on ? ' on' : ''}`} onClick={() => setPlanEdit({ ...planEdit, serviceIds: on ? (planEdit.serviceIds || []).filter((x) => x !== s.id) : [...(planEdit.serviceIds || []), s.id] })}>{s.name}</span>;
                })}
              </div>
            </div>
            <div className="bk-field"><label>{t('crm.bookings.v.passes.description')}</label><textarea rows={2} value={planEdit.description || ''} onChange={(e) => setPlanEdit({ ...planEdit, description: e.target.value })} /></div>
            {planEdit.id && <label className="bk-check"><input type="checkbox" checked={planEdit.active !== false} onChange={(e) => setPlanEdit({ ...planEdit, active: e.target.checked })} /> {t('crm.bookings.v.passes.planActive')}</label>}
          </>
        )}
      </BkModal>

      {/* продажа */}
      <BkModal open={!!sell} title={P('sell')} onClose={() => setSell(null)}
        footer={<><button className="btn btn-sm" onClick={() => setSell(null)}>{t('crm.bookings.v.common.cancel')}</button><button className="btn btn-primary btn-sm" disabled={busy} onClick={doSell}><Ic d={BK_ICON.check} size={13} /> {P('sell')}</button></>}>
        {sell && (
          <>
            <div className="bk-field"><label>{t('crm.bookings.v.passes.colPlan')}</label>
              <select value={sell.planId} onChange={(e) => setSell({ ...sell, planId: e.target.value })}>
                {plans.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} · {fmtMoney(p.price, p.currency, locale)}</option>)}
              </select>
            </div>
            <div className="bk-row2">
              <div className="bk-field"><label>{t('crm.bookings.v.common.clientName')}</label><input value={sell.name} onChange={(e) => setSell({ ...sell, name: e.target.value })} /></div>
              <div className="bk-field"><label>{t('crm.bookings.v.common.phone')}</label><input value={sell.phone} onChange={(e) => setSell({ ...sell, phone: e.target.value })} /></div>
            </div>
            <div className="bk-field"><label>{t('crm.bookings.v.common.email')}</label><input value={sell.email} onChange={(e) => setSell({ ...sell, email: e.target.value })} /></div>
            <div className="bk-row2">
              <div className="bk-field"><label>{t('crm.bookings.v.passes.startsAt')}</label><input type="date" value={sell.startsAt} onChange={(e) => setSell({ ...sell, startsAt: e.target.value })} /></div>
              <div className="bk-field"><label>{t('crm.bookings.v.passes.priceOverride')}</label><input type="number" min={0} step="0.01" value={sell.price} placeholder={planOf.get(sell.planId)?.price || ''} onChange={(e) => setSell({ ...sell, price: e.target.value })} /></div>
            </div>
            <div className="bk-field"><label>{t('crm.bookings.v.passes.payment')}</label>
              <div className="bk-seg">
                <button className={sell.method === '' ? 'on' : ''} onClick={() => setSell({ ...sell, method: '' })}>{t('crm.bookings.v.passes.payLater')}</button>
                {(['cash', 'card', 'transfer'] as BookingPaymentMethod[]).map((m) => <button key={m} className={sell.method === m ? 'on' : ''} onClick={() => setSell({ ...sell, method: m })}>{t(`crm.bookings.v.orders.method.${m}`)}</button>)}
              </div>
              <div className="bk-hint" style={{ marginTop: 6 }}>{t('crm.bookings.v.passes.payHint')}</div>
            </div>
          </>
        )}
      </BkModal>

      {/* карточка абонемента */}
      <BkDrawer
        open={!!detail}
        width={460}
        kicker={detail ? `№${detail.number} · ${t(`crm.bookings.v.passes.status.${detail.status}`)}` : ''}
        title={detail?.customerName || detail?.customerPhone || '—'}
        onClose={() => setDetail(null)}
        footer={
          detail && detail.status !== 'cancelled' && (
            <>
              {detail.status === 'active' && detail.freezeDaysAllowed > detail.freezeDaysUsed && <button className="btn btn-sm" disabled={busy} onClick={() => act(() => freezePass(detail.id), t('crm.bookings.v.passes.frozen'))}>{t('crm.bookings.v.passes.freeze')}</button>}
              {detail.status === 'frozen' && <button className="btn btn-sm" disabled={busy} onClick={() => act(() => unfreezePass(detail.id), t('crm.bookings.v.passes.unfrozen'))}>{t('crm.bookings.v.passes.unfreeze')}</button>}
              {detail.kind === 'visits' && <button className="btn btn-sm" disabled={busy} onClick={async () => { const v = await showPrompt({ title: P('addVisits'), label: P('addVisitsLabel'), defaultValue: '1' }); if (v && Number(v)) act(() => adjustPass(detail.id, { visitsDelta: Number(v) })); }}>{P('addVisits')}</button>}
              <button className="btn btn-sm" disabled={busy} onClick={async () => { const v = await showPrompt({ title: t('crm.bookings.v.passes.extend'), label: t('crm.bookings.v.passes.extendLabel'), defaultValue: '7' }); if (v && Number(v)) act(() => adjustPass(detail.id, { extendDays: Number(v) })); }}>{t('crm.bookings.v.passes.extend')}</button>
              <button className="btn btn-sm btn-danger" disabled={busy} onClick={async () => { if (await showConfirm(P('cancelConfirm'), { danger: true })) act(() => cancelPass(detail.id)); }}>{t('crm.bookings.v.common.cancelAction')}</button>
            </>
          )
        }
      >
        {detail && (
          <>
            <div className="bk-info-row"><span className="l">{t('crm.bookings.v.passes.colPlan')}</span><span className="v">{detail.planName}</span></div>
            <div className="bk-info-row"><span className="l">{t('crm.bookings.v.passes.colLeft')}</span><span className="v">{detail.kind === 'unlimited' ? '∞' : `${detail.remaining} / ${detail.visitsTotal}`}</span></div>
            <div className="bk-info-row"><span className="l">{t('crm.bookings.v.passes.period')}</span><span className="v">{fmtDate(detail.startsAt, locale, { day: '2-digit', month: 'short' })} – {fmtDate(detail.expiresAt, locale, { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
            {detail.freezeDaysAllowed > 0 && <div className="bk-info-row"><span className="l">{t('crm.bookings.v.passes.freezeUsed')}</span><span className="v">{detail.freezeDaysUsed}/{detail.freezeDaysAllowed}{detail.frozenFrom ? ` · ${t('crm.bookings.v.passes.frozenSince', { date: fmtDate(detail.frozenFrom, locale) })}` : ''}</span></div>}
            <div className="bk-info-row"><span className="l">{t('crm.bookings.v.passes.price')}</span><span className="v bk-money">{fmtMoney(detail.price, detail.currency, locale)}</span></div>
            <div className="bk-info-row"><span className="l">{t('crm.bookings.v.passes.validFor', { label: terms.servicePlural })}</span><span className="v" style={{ maxWidth: 220 }}>{svcNames(detail.serviceIds)}</span></div>
            {detail.order && (
              <div className="bk-note" style={{ marginTop: 12 }}>
                <div className="hd"><b>{t('crm.bookings.v.passes.invoice', { number: detail.order.number })}</b><span className={`bk-badge ord-${detail.order.status}`}>{t(`crm.bookings.v.orders.status.${detail.order.status}`)}</span></div>
                <div className="body"><a style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/bookings/orders/${detail.order!.id}`)}>{detail.order.status === 'paid' ? t('crm.bookings.v.passes.openInvoice') : t('crm.bookings.v.passes.payInvoice')}</a></div>
              </div>
            )}
            <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--fg-3)', margin: '16px 0 4px' }}>{t('crm.bookings.v.passes.usage')}</div>
            {(detail.usage || []).length === 0 && <div className="bk-hint">{t('crm.bookings.v.passes.noUsage')}</div>}
            {(detail.usage || []).map((r) => (
              <div key={r.id} className="ro-row" style={{ cursor: 'pointer' }} onClick={() => navigate(`/bookings/reservations/${r.id}`)}>
                <div><div className="n">{fmtDate(r.startAt, locale)} · {fmtTime(r.startAt, locale)}</div><div className="s">{services.find((s) => s.id === r.serviceId)?.name || ''}</div></div>
                <span className={`bk-badge ${r.status}`}>{t(`crm.bookings.status.${r.status}`)}{r.passVisitCharged ? ' · −1' : ''}</span>
              </div>
            ))}
          </>
        )}
      </BkDrawer>
    </MainLayout>
  );
};
