import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { HotelsSubnav } from './HotelsSubnav';
import { Ic, HTL_ICON } from './HotelIcons';
import { fetchHotels, createHotel, type Hotel } from '../../api/hotels';
import './hotels-design.css';

export const HotelsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [stars, setStars] = useState('5');
  const [currency, setCurrency] = useState('USD');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');

  const load = () => {
    setLoading(true);
    fetchHotels()
      .then(setHotels)
      .catch((e) => showAlert(e.message || 'Не удалось загрузить отели', { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () =>
      hotels.filter(
        (h) =>
          h.name.toLowerCase().includes(q.toLowerCase()) ||
          (h.city || '').toLowerCase().includes(q.toLowerCase()),
      ),
    [hotels, q],
  );

  const resetForm = () => {
    setName('');
    setCity('');
    setCountry('');
    setStars('5');
    setCurrency('USD');
    setAddress('');
    setDescription('');
  };

  const handleCreate = () => {
    if (!name.trim()) {
      showAlert('Укажите название отеля', { variant: 'error' });
      return;
    }
    setSaving(true);
    createHotel({ name, city, country, stars: Number(stars), currency, address, description })
      .then((h) => {
        setShowNew(false);
        resetForm();
        navigate(`/hotels/${h.id}`);
      })
      .catch((e) => showAlert(e.message || 'Не удалось создать отель', { variant: 'error' }))
      .finally(() => setSaving(false));
  };

  return (
    <MainLayout>
      <div className="px-scope">
        <HotelsSubnav active="hotels" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{hotels.length} ОТЕЛЯ</div>
            <h1>Отели</h1>
            <p className="sub">Управляйте объектами, типами номеров и базовыми настройками каждого отеля.</p>
          </div>
          <div className="htl-hero-r">
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>
              <Ic d={HTL_ICON.plus} size={14} />Добавить отель
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, margin: '16px 0' }}>
          <div className="bk-search" style={{ flex: 1, maxWidth: 340 }}>
            <Ic d={HTL_ICON.search} size={14} />
            <input placeholder="Поиск отеля или города…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="btn"><Ic d={HTL_ICON.filter} size={13} />Фильтры</button>
          <button className="btn"><Ic d={HTL_ICON.sort} size={13} />Сортировка</button>
        </div>

        {!loading && filtered.length === 0 && hotels.length > 0 && (
          <div style={{ padding: 24, color: 'var(--fg-3)', fontSize: 13 }}>Ничего не найдено.</div>
        )}

        <div className="htl-grid">
          {filtered.map((h) => (
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
                  <span><b>{h.roomTypesCount}</b> типов</span>
                  <span><b>{h.occupancyToday}%</b> загрузка</span>
                </div>
              </div>
            </div>
          ))}

          <div
            className="htl-card"
            onClick={() => setShowNew(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 8,
              minHeight: 230,
              color: 'var(--fg-3)',
              border: '1.5px dashed var(--line-2)',
            }}
          >
            <Ic d={HTL_ICON.plus} size={22} />
            <span style={{ fontSize: 13 }}>Добавить новый отель</span>
          </div>
        </div>
      </div>

      {showNew && (
        <div className="px-scope">
          <div className="bk-modal-back" onClick={() => setShowNew(false)} />
          <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bk-modal-head">
              <h3>Новый отель</h3>
              <button onClick={() => setShowNew(false)}><Ic d={HTL_ICON.x} size={16} /></button>
            </div>
            <div className="bk-modal-body">
              <label>Название отеля</label>
              <input placeholder="Например, Lumiva Sea View Hotel" value={name} onChange={(e) => setName(e.target.value)} />
              <div className="bk-row2">
                <div><label>Город</label><input placeholder="Анталья" value={city} onChange={(e) => setCity(e.target.value)} /></div>
                <div><label>Страна</label><input placeholder="Турция" value={country} onChange={(e) => setCountry(e.target.value)} /></div>
              </div>
              <div className="bk-row2">
                <div>
                  <label>Звёзд</label>
                  <select value={stars} onChange={(e) => setStars(e.target.value)}>
                    <option value="5">5 звёзд</option>
                    <option value="4">4 звезды</option>
                    <option value="3">3 звезды</option>
                  </select>
                </div>
                <div>
                  <label>Валюта по умолчанию</label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="TRY">TRY</option>
                  </select>
                </div>
              </div>
              <label>Адрес</label>
              <input placeholder="Полный адрес объекта" value={address} onChange={(e) => setAddress(e.target.value)} />
              <label>Описание</label>
              <textarea rows={3} placeholder="Краткое описание для витрины бронирования" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="bk-modal-foot">
              <button className="btn" onClick={() => setShowNew(false)}>Отмена</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleCreate}>
                <Ic d={HTL_ICON.check} size={14} />Создать и настроить номера
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};
