import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { fetchBookingLogs, type BookingLogEntry } from '../../api/bookings';
import './bookings-design.css';

const TYPE_LABELS: Record<string, string> = {
  created: 'Бронь создана',
  status_changed: 'Статус изменён',
  rescheduled: 'Бронь перенесена',
  staff_changed: 'Мастер изменён',
  resource_changed: 'Ресурс изменён',
  notification_sent: 'Уведомление отправлено',
  note_added: 'Добавлена заметка',
};

export const BookingLogsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [logs, setLogs] = useState<BookingLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookingLogs(200)
      .then(setLogs)
      .catch((e) => showAlert(e.message || 'Не удалось загрузить логи', { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="logs" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{logs.length} СОБЫТИЙ</div>
            <h1>Логи и диагностика</h1>
            <p className="sub">Журнал событий по бронированиям: создание, смена статуса, перенос.</p>
          </div>
        </div>

        <div className="bk-table-wrap" style={{ marginTop: 16 }}>
          <table className="bk-table">
            <thead>
              <tr><th>Время</th><th>Событие</th><th>Бронь</th><th>Комментарий</th><th>Кто</th></tr>
            </thead>
            <tbody>
              {!loading && logs.length === 0 && (
                <tr><td colSpan={5} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>Пока нет событий</td></tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className={l.reservationId ? 'clickable' : undefined} onClick={() => l.reservationId && navigate(`/bookings/reservations/${l.reservationId}`)}>
                  <td style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--fg-3)' }}>{new Date(l.createdAt).toLocaleString('ru-RU')}</td>
                  <td style={{ fontWeight: 500, color: 'var(--ink)' }}>{TYPE_LABELS[l.type] || l.type}</td>
                  <td style={{ fontFamily: 'var(--ff-mono)', fontSize: 11 }}>{l.reservation?.customerName || l.reservationId.slice(0, 8)}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{l.description || '—'}</td>
                  <td style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{l.user?.fullName || 'Система'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
};
