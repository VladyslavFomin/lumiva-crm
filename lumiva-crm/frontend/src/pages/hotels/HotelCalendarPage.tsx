import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { HotelsSubnav } from './HotelsSubnav';
import { HotelPricingCalendar } from './HotelPricingCalendar';
import { HotelRoomOccupancyGrid } from './HotelRoomOccupancyGrid';
import { fetchHotels, fetchRoomTypes, type Hotel, type HotelRoomType } from '../../api/hotels';
import './hotels-design.css';

export const HotelCalendarPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelId, setHotelId] = useState('');
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const [tab, setTab] = useState<'price' | 'occupancy'>('price');

  useEffect(() => {
    fetchHotels()
      .then((h) => {
        setHotels(h);
        if (h.length) setHotelId(h[0].id);
      })
      .catch((e) => showAlert(e.message || t('crm.hotels.calendarPage.error'), { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hotelId) return;
    fetchRoomTypes(hotelId)
      .then(setRoomTypes)
      .catch((e) => showAlert(e.message || t('crm.hotels.calendarPage.roomTypesError'), { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  return (
    <MainLayout>
      <PageHelpButton topic="hotelCalendar" />
      <div className="px-scope">
        <HotelsSubnav active="calendar" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.hotels.calendarPage.kicker')}</div>
            <h1>{t('crm.hotels.calendarPage.title')}</h1>
            <p className="sub">{t('crm.hotels.calendarPage.subtitle')}</p>
          </div>
          <div className="htl-hero-r">
            <select value={hotelId} onChange={(e) => setHotelId(e.target.value)}>
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bk-savedviews" style={{ marginTop: 16 }}>
          <div className={`bk-sv-tab${tab === 'price' ? ' active' : ''}`} onClick={() => setTab('price')}>{t('crm.hotels.calendarPage.tabPrice')}</div>
          <div className={`bk-sv-tab${tab === 'occupancy' ? ' active' : ''}`} onClick={() => setTab('occupancy')}>{t('crm.hotels.calendarPage.tabOccupancy')}</div>
        </div>

        <div style={{ marginTop: 16 }}>
          {tab === 'price' ? (
            <HotelPricingCalendar roomTypes={roomTypes} />
          ) : (
            <HotelRoomOccupancyGrid roomTypes={roomTypes} />
          )}
        </div>
      </div>
    </MainLayout>
  );
};
