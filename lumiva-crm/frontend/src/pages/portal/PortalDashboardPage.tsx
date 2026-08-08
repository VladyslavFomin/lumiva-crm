// src/pages/portal/PortalDashboardPage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchPortalMe,
  fetchPortalBookings,
  fetchPortalOrders,
  type PortalMe,
  type PortalBooking,
  type PortalOrder,
} from '../../api/portal';
import { clearPortalSession } from '../../portal/portalSession';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждено',
  completed: 'Завершено',
  cancelled_by_customer: 'Отменено вами',
  cancelled_by_business: 'Отменено',
  rejected: 'Отклонено',
  no_show: 'Неявка',
  new: 'Новый',
  other: 'Обработка',
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });

export const PortalDashboardPage: React.FC = () => {
  const { clientKey = '' } = useParams<{ clientKey: string }>();
  const navigate = useNavigate();
  const [me, setMe] = useState<PortalMe | null>(null);
  const [bookings, setBookings] = useState<PortalBooking[]>([]);
  const [orders, setOrders] = useState<PortalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchPortalMe(), fetchPortalBookings(), fetchPortalOrders()])
      .then(([meData, bookingsData, ordersData]) => {
        if (!alive) return;
        setMe(meData);
        setBookings(bookingsData);
        setOrders(ordersData);
      })
      .catch((e: any) => {
        if (!alive) return;
        if (e?.message?.includes('401') || e?.message?.toLowerCase().includes('session')) {
          clearPortalSession();
          navigate(`/portal/${clientKey}/login`, { replace: true });
          return;
        }
        setError(e?.message || 'Не удалось загрузить личный кабинет');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    clearPortalSession();
    navigate(`/portal/${clientKey}/login`, { replace: true });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Загрузка…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
              {me?.companyName || 'Личный кабинет'}
            </div>
            <h1 className="text-2xl font-semibold text-lumiva-accent mt-1">
              {me?.name ? `Здравствуйте, ${me.name}` : 'Личный кабинет'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(`/portal/${clientKey}/tickets`)}
              className="text-sm text-lumiva-accent font-medium hover:underline"
            >
              Поддержка →
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-slate-500 hover:text-slate-800"
            >
              Выйти
            </button>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Ваши бронирования</h2>
          {bookings.length === 0 ? (
            <div className="text-sm text-slate-500">Пока нет бронирований</div>
          ) : (
            <div className="space-y-2">
              {bookings.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{fmtDate(b.startAt)}</div>
                    <div className="text-xs text-slate-500">{STATUS_LABEL[b.status] || b.status}</div>
                  </div>
                  {b.price && (
                    <div className="text-sm text-slate-700">
                      {Number(b.price).toLocaleString('ru-RU')} {b.currency}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Ваши заказы</h2>
          {orders.length === 0 ? (
            <div className="text-sm text-slate-500">Пока нет заказов</div>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{fmtDate(o.date)}</div>
                    <div className="text-xs text-slate-500">
                      {STATUS_LABEL[o.status] || o.status}
                      {o.externalOrderNo ? ` · №${o.externalOrderNo}` : ''}
                    </div>
                  </div>
                  <div className="text-sm text-slate-700">
                    {Number(o.amount).toLocaleString('ru-RU')} {o.currency}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PortalDashboardPage;
