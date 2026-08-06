import React, { useEffect, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { HotelsSubnav } from './HotelsSubnav';
import { HotelPricingCalendar } from './HotelPricingCalendar';
import { HotelRoomOccupancyGrid } from './HotelRoomOccupancyGrid';
import { fetchHotels, fetchRoomTypes, type Hotel, type HotelRoomType } from '../../api/hotels';
import './hotels-design.css';

export const HotelCalendarPage: React.FC = () => {
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
      .catch((e) => showAlert(e.message || 'Не удалось загрузить отели', { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hotelId) return;
    fetchRoomTypes(hotelId)
      .then(setRoomTypes)
      .catch((e) => showAlert(e.message || 'Не удалось загрузить типы номеров', { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  return (
    <MainLayout>
      <div className="px-scope">
        <HotelsSubnav active="calendar" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />КАЛЕНДАРЬ ДОСТУПНОСТИ И ЦЕН</div>
            <h1>Календарь номеров</h1>
            <p className="sub">Устанавливайте цену, скидку и стоп-продажи по конкретным датам для каждого типа номера.</p>
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
          <div className={`bk-sv-tab${tab === 'price' ? ' active' : ''}`} onClick={() => setTab('price')}>Цены и доступность</div>
          <div className={`bk-sv-tab${tab === 'occupancy' ? ' active' : ''}`} onClick={() => setTab('occupancy')}>Занятость номеров</div>
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
