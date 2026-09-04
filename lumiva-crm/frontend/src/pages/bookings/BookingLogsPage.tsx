import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { fetchBookingLogs, type BookingLogEntry } from '../../api/bookings';
import './bookings-design.css';

const TYPE_KEYS = ['created', 'status_changed', 'rescheduled', 'staff_changed', 'resource_changed', 'notification_sent', 'note_added'];

export const BookingLogsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [logs, setLogs] = useState<BookingLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const typeLabel = (type: string) => (TYPE_KEYS.includes(type) ? t(`crm.bookings.detail.activityTab.types.${type}`) : type);

  useEffect(() => {
    fetchBookingLogs(200)
      .then(setLogs)
      .catch((e) => showAlert(e.message || t('crm.bookings.logs.error'), { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MainLayout>
      <PageHelpButton topic="bookingLogs" />
      <div className="px-scope">
        <BookingsSubnav active="logs" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.bookings.logs.kicker', { count: logs.length })}</div>
            <h1>{t('crm.bookings.logs.title')}</h1>
            <p className="sub">{t('crm.bookings.logs.subtitle')}</p>
          </div>
        </div>

        <div className="bk-table-wrap" style={{ marginTop: 16 }}>
          <table className="bk-table">
            <thead>
              <tr>
                <th>{t('crm.bookings.logs.table.colTime')}</th>
                <th>{t('crm.bookings.logs.table.colEvent')}</th>
                <th>{t('crm.bookings.logs.table.colBooking')}</th>
                <th>{t('crm.bookings.logs.table.colComment')}</th>
                <th>{t('crm.bookings.logs.table.colWho')}</th>
              </tr>
            </thead>
            <tbody>
              {!loading && logs.length === 0 && (
                <tr><td colSpan={5} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>{t('crm.bookings.logs.table.empty')}</td></tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className={l.reservationId ? 'clickable' : undefined} onClick={() => l.reservationId && navigate(`/bookings/reservations/${l.reservationId}`)}>
                  <td style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--fg-3)' }}>{new Date(l.createdAt).toLocaleString(dateLocale)}</td>
                  <td style={{ fontWeight: 500, color: 'var(--ink)' }}>{typeLabel(l.type)}</td>
                  <td style={{ fontFamily: 'var(--ff-mono)', fontSize: 11 }}>{l.reservation?.customerName || l.reservationId.slice(0, 8)}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{l.description || '—'}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{l.user?.fullName || t('crm.bookings.logs.table.system')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
};
