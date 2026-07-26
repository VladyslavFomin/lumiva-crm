import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { HotelsSubnav } from './HotelsSubnav';
import { Ic, HTL_ICON } from './HotelIcons';
import { fetchHotels, fetchHotelsOverviewKpis, type Hotel, type HotelsOverviewKpis } from '../../api/hotels';
import './hotels-design.css';

export const HotelsOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [kpis, setKpis] = useState<HotelsOverviewKpis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchHotels(), fetchHotelsOverviewKpis()])
      .then(([h, k]) => {
        setHotels(h);
        setKpis(k);
      })
      .catch((e) => showAlert(e.message || 'Не удалось загрузить обзор', { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalRooms = hotels.reduce((s, h) => s + h.roomsCount, 0);

  return (
    <MainLayout>
      <div className="px-scope">
        <HotelsSubnav active="overview" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{hotels.length} ОБЪЕКТА · {totalRooms} НОМЕРОВ</div>
            <h1>Система резервации отелей</h1>
            <p className="sub">Отели, номера, цены по рынкам продаж и бронирования — в одном месте, отдельно от модуля услуг.</p>
          </div>
          <div className="htl-hero-r">
            <button className="btn" onClick={() => navigate('/hotels/pricing')}>
              <Ic d={HTL_ICON.settings} size={14} />Цены и рынки
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/hotels/list')}>
              <Ic d={HTL_ICON.plus} size={14} />Новый отель
            </button>
          </div>
        </div>

        {kpis && (
          <div className="htl-kpis">
            <div className="htl-kpi"><div className="l">Загрузка (сегодня)</div><div className="v">{kpis.occupancyToday}%</div></div>
            <div className="htl-kpi"><div className="l">Средний ADR</div><div className="v">${kpis.adr}</div></div>
            <div className="htl-kpi"><div className="l">Броней за 30 дней</div><div className="v">{kpis.bookings30d}</div></div>
            <div className="htl-kpi"><div className="l">Выручка (30 дней)</div><div className="v">${kpis.revenue30d.toLocaleString()}</div></div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 12px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Ваши отели</h3>
          <button className="btn-link" style={{ fontSize: 12.5, color: 'var(--fg-3)', background: 'none', border: 0, cursor: 'pointer' }} onClick={() => navigate('/hotels/list')}>
            Смотреть все →
          </button>
        </div>

        {!loading && hotels.length === 0 && (
          <div style={{ padding: 24, color: 'var(--fg-3)', fontSize: 13 }}>Отелей пока нет — добавьте первый.</div>
        )}

        <div className="htl-grid">
          {hotels.map((h) => (
            <div key={h.id} className="htl-card" onClick={() => navigate(`/hotels/${h.id}`)}>
              <div className="htl-card-img">
                <span
                  className="bk-badge"
                  style={{
                    background: h.status === 'active' ? '#eaf6ec' : '#f5f0e6',
                    color: h.status === 'active' ? '#1f8a5e' : '#a06b1a',
                  }}
                >
                  {h.status === 'active' ? 'Активен' : 'Черновик'}
                </span>
              </div>
              <div className="htl-card-body">
                <div className="htl-card-name">{h.name}</div>
                <div className="htl-card-loc"><Ic d={HTL_ICON.calendar} size={12} />{[h.city, h.country].filter(Boolean).join(', ')}</div>
                <div className="htl-card-stats">
                  <span><b>{h.roomsCount}</b> номеров</span>
                  <span><b>{h.occupancyToday}%</b> загрузка</span>
                  <span><b>${h.adr}</b> ADR</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
};
