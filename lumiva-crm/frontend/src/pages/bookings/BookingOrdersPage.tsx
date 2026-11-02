import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { Ic, BK_ICON } from './BookingIcons';
import { fetchBookingResources, type BookingResourceItem } from '../../api/bookings';
import { fetchOrders, createOrder, type BookingOrder } from '../../api/bookingVerticals';
import { useBookingVertical } from './useBookingVertical';
import { BkModal, MiniKpi, errMsg, fmtDate, fmtMoney, fmtTime, useDateLocale, ymdLocal, addDays } from './verticalUi';
import './bookings-design.css';
import './bookings-verticals.css';

const STATUS_TABS = ['active', 'open', 'billed', 'paid', 'cancelled', 'all'] as const;
type StatusTab = (typeof STATUS_TABS)[number];
const PERIODS = ['today', '7d', '30d', 'all'] as const;

export const BookingOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const locale = useDateLocale();
  const { type, terms } = useBookingVertical();
  const [orders, setOrders] = useState<BookingOrder[]>([]);
  const [resources, setResources] = useState<BookingResourceItem[]>([]);
  const [tab, setTab] = useState<StatusTab>('active');
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('7d');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [nf, setNf] = useState({ customerName: '', customerPhone: '', guests: 1, resourceId: '' });

  const from = period === 'all' ? undefined : ymdLocal(period === 'today' ? new Date() : addDays(new Date(), period === '7d' ? -6 : -29));

  const load = () => {
    setLoading(true);
    const status = tab === 'active' ? 'open,billed' : tab === 'all' ? undefined : tab;
    fetchOrders({ status, from: tab === 'active' ? undefined : from, search: search.trim() || undefined })
      .then(setOrders)
      .catch((e) => showAlert(errMsg(e, t('crm.bookings.v.common.loadError')), { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const id = window.setTimeout(load, search ? 300 : 0);
    return () => window.clearTimeout(id);
  }, [tab, period, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchBookingResources().then(setResources).catch(() => undefined);
  }, []);

  const resName = (id: string | null) => (id ? resources.find((r) => r.id === id)?.name || '—' : '—');

  const kpi = useMemo(() => {
    const paid = orders.filter((o) => o.status === 'paid');
    const cur = paid[0]?.currency || orders[0]?.currency || 'RUB';
    const sameCur = paid.filter((o) => o.currency === cur);
    const revenue = sameCur.reduce((s, o) => s + Number(o.total), 0);
    return {
      open: orders.filter((o) => o.status === 'open').length,
      billed: orders.filter((o) => o.status === 'billed').length,
      revenue,
      avg: sameCur.length ? revenue / sameCur.length : 0,
      cur,
    };
  }, [orders]);

  const create = async () => {
    try {
      const o = await createOrder({
        kind: type === 'restaurant' && nf.resourceId ? 'table' : 'walkin',
        customerName: nf.customerName.trim() || null,
        customerPhone: nf.customerPhone.trim() || null,
        guests: nf.guests,
        resourceId: nf.resourceId || null,
      });
      setNewOpen(false);
      navigate(`/bookings/orders/${o.id}`);
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    }
  };

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="orders" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.bookings.v.orders.kicker')}</div>
            <h1>{t(`crm.bookings.v.orders.title_${type}`, { defaultValue: t('crm.bookings.v.orders.title') })}</h1>
            <p className="sub">{t(`crm.bookings.v.orders.subtitle_${type}`, { defaultValue: t('crm.bookings.v.orders.subtitle') })}</p>
          </div>
          <div className="bk-hero-r">
            <button className="btn btn-primary btn-sm" onClick={() => { setNf({ customerName: '', customerPhone: '', guests: 1, resourceId: '' }); setNewOpen(true); }}>
              <Ic d={BK_ICON.plus} size={13} /> {t('crm.bookings.v.orders.new')}
            </button>
          </div>
        </div>

        <div className="bk-mini-kpis">
          <MiniKpi label={t('crm.bookings.v.orders.kpiOpen')} value={kpi.open} />
          <MiniKpi label={t('crm.bookings.v.orders.kpiBilled')} value={kpi.billed} tone={kpi.billed ? 'warn' : undefined} />
          <MiniKpi label={t('crm.bookings.v.orders.kpiRevenue')} value={fmtMoney(kpi.revenue, kpi.cur, locale)} />
          <MiniKpi label={t('crm.bookings.v.orders.kpiAvg')} value={fmtMoney(kpi.avg, kpi.cur, locale)} />
        </div>

        <div className="bk-savedviews">
          {STATUS_TABS.map((s) => (
            <div key={s} className={`bk-sv-tab${s === tab ? ' active' : ''}`} onClick={() => setTab(s)}>{t(`crm.bookings.v.orders.tab.${s}`)}</div>
          ))}
        </div>
        <div className="bk-filters">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line-2)', borderRadius: 8, padding: '7px 12px', width: 220, background: '#fff' }}>
            <Ic d={BK_ICON.search} size={13} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('crm.bookings.v.orders.search')} style={{ border: 0, outline: 'none', fontSize: 12.5, width: '100%' }} />
          </div>
          {tab !== 'active' && (
            <div className="bk-seg">
              {PERIODS.map((p) => <button key={p} className={p === period ? 'on' : ''} onClick={() => setPeriod(p)}>{t(`crm.bookings.v.common.period.${p}`)}</button>)}
            </div>
          )}
        </div>

        <div className="bk-table-wrap">
          <table className="bk-table">
            <thead>
              <tr>
                <th>№</th>
                <th>{t('crm.bookings.v.orders.colDate')}</th>
                {(type === 'restaurant' || type === 'rental') && <th>{terms.resource}</th>}
                <th>{terms.client}</th>
                <th>{t('crm.bookings.v.orders.colKind')}</th>
                <th>{t('crm.bookings.v.orders.colItems')}</th>
                <th style={{ textAlign: 'right' }}>{t('crm.bookings.v.orders.colTotal')}</th>
                <th>{t('crm.bookings.v.orders.colStatus')}</th>
                <th>{t('crm.bookings.v.orders.colMethod')}</th>
              </tr>
            </thead>
            <tbody>
              {!loading && orders.length === 0 && <tr><td colSpan={9} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>{t('crm.bookings.v.orders.empty')}</td></tr>}
              {orders.map((o) => (
                <tr key={o.id} className="clickable" onClick={() => navigate(`/bookings/orders/${o.id}`)}>
                  <td className="id">#{o.number}</td>
                  <td>{fmtDate(o.createdAt, locale)} <span style={{ color: 'var(--fg-3)' }}>· {fmtTime(o.createdAt, locale)}</span></td>
                  {(type === 'restaurant' || type === 'rental') && <td>{resName(o.resourceId)}</td>}
                  <td className="cust-cell"><span className="n">{o.customerName || '—'}</span><span className="s">{o.guests > 1 ? t('crm.bookings.v.common.guests', { count: o.guests }) : o.customerPhone || ''}</span></td>
                  <td><span className="src">{t(`crm.bookings.v.orders.kind.${o.kind}`)}</span></td>
                  <td>{o.itemsCount ?? 0}</td>
                  <td style={{ textAlign: 'right' }} className="bk-money">{fmtMoney(o.total, o.currency, locale)}</td>
                  <td><span className={`bk-badge ord-${o.status}`}>{t(`crm.bookings.v.orders.status.${o.status}`)}</span></td>
                  <td style={{ color: 'var(--fg-3)', fontSize: 11.5 }}>{o.paymentMethod ? t(`crm.bookings.v.orders.method.${o.paymentMethod}`) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <BkModal
        open={newOpen}
        title={t('crm.bookings.v.orders.new')}
        onClose={() => setNewOpen(false)}
        footer={<><button className="btn btn-sm" onClick={() => setNewOpen(false)}>{t('crm.bookings.v.common.cancel')}</button><button className="btn btn-primary btn-sm" onClick={create}>{t('crm.bookings.v.orders.createOpen')}</button></>}
      >
        <div className="bk-hint" style={{ marginBottom: 12 }}>{t(`crm.bookings.v.orders.newHint_${type}`, { defaultValue: t('crm.bookings.v.orders.newHint') })}</div>
        {type === 'restaurant' && (
          <div className="bk-field"><label>{terms.resource}</label>
            <select value={nf.resourceId} onChange={(e) => setNf({ ...nf, resourceId: e.target.value })}>
              <option value="">{t('crm.bookings.v.orders.noTable')}</option>
              {resources.filter((r) => r.type === 'table' && r.active).map((r) => <option key={r.id} value={r.id}>{r.name} · {r.capacity}</option>)}
            </select>
          </div>
        )}
        <div className="bk-row2">
          <div className="bk-field"><label>{t('crm.bookings.v.common.clientName')}</label><input value={nf.customerName} onChange={(e) => setNf({ ...nf, customerName: e.target.value })} /></div>
          <div className="bk-field"><label>{t('crm.bookings.v.common.phone')}</label><input value={nf.customerPhone} onChange={(e) => setNf({ ...nf, customerPhone: e.target.value })} /></div>
        </div>
        {type === 'restaurant' && (
          <div className="bk-field"><label>{t('crm.bookings.v.rbook.guests')}</label><input type="number" min={1} value={nf.guests} onChange={(e) => setNf({ ...nf, guests: Math.max(1, Number(e.target.value) || 1) })} /></div>
        )}
      </BkModal>
    </MainLayout>
  );
};
