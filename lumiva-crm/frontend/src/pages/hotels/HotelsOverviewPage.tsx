import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { HotelsSubnav } from './HotelsSubnav';
import { Ic, HTL_ICON } from './HotelIcons';
import { fetchHotels, fetchHotelsOverviewKpis, type Hotel, type HotelsOverviewKpis } from '../../api/hotels';
import './hotels-design.css';

export const HotelsOverviewPage: React.FC = () => {
  const { t } = useTranslation();
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
      .catch((e) => showAlert(e.message || t('crm.hotels.overview.error'), { variant: 'error' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalRooms = hotels.reduce((s, h) => s + h.roomsCount, 0);

  return (
    <MainLayout>
      <PageHelpButton topic="hotels" />
      <div className="px-scope">
        <HotelsSubnav active="overview" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.hotels.overview.kicker', { count: hotels.length, rooms: totalRooms })}</div>
            <h1>{t('crm.hotels.overview.title')}</h1>
            <p className="sub">{t('crm.hotels.overview.subtitle')}</p>
          </div>
          <div className="htl-hero-r">
            <button className="btn" onClick={() => navigate('/hotels/pricing')}>
              <Ic d={HTL_ICON.settings} size={14} />{t('crm.hotels.overview.pricingBtn')}
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/hotels/list')}>
              <Ic d={HTL_ICON.plus} size={14} />{t('crm.hotels.overview.newHotelBtn')}
            </button>
          </div>
        </div>

        {kpis && (
          <div className="htl-kpis">
            <div className="htl-kpi"><div className="l">{t('crm.hotels.overview.kpis.occupancyToday')}</div><div className="v">{kpis.occupancyToday}%</div></div>
            <div className="htl-kpi"><div className="l">{t('crm.hotels.overview.kpis.adr')}</div><div className="v">${kpis.adr}</div></div>
            <div className="htl-kpi"><div className="l">{t('crm.hotels.overview.kpis.bookings30d')}</div><div className="v">{kpis.bookings30d}</div></div>
            <div className="htl-kpi"><div className="l">{t('crm.hotels.overview.kpis.revenue30d')}</div><div className="v">${kpis.revenue30d.toLocaleString()}</div></div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 12px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>{t('crm.hotels.overview.yourHotels')}</h3>
          <button className="btn-link" style={{ fontSize: 12.5, color: 'var(--fg-3)', background: 'none', border: 0, cursor: 'pointer' }} onClick={() => navigate('/hotels/list')}>
            {t('crm.hotels.overview.viewAll')}
          </button>
        </div>

        {!loading && hotels.length === 0 && (
          <div style={{ padding: 24, color: 'var(--fg-3)', fontSize: 13 }}>{t('crm.hotels.overview.empty')}</div>
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
                  {h.status === 'active' ? t('crm.hotels.status.active') : t('crm.hotels.status.draft')}
                </span>
              </div>
              <div className="htl-card-body">
                <div className="htl-card-name">{h.name}</div>
                <div className="htl-card-loc"><Ic d={HTL_ICON.calendar} size={12} />{[h.city, h.country].filter(Boolean).join(', ')}</div>
                <div className="htl-card-stats">
                  <span><b>{h.roomsCount}</b> {t('crm.hotels.overview.card.rooms')}</span>
                  <span><b>{h.occupancyToday}%</b> {t('crm.hotels.overview.card.occupancy')}</span>
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
