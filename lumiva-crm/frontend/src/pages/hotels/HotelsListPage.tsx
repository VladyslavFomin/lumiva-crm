import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { HotelsSubnav } from './HotelsSubnav';
import { Ic, HTL_ICON } from './HotelIcons';
import { fetchHotels, createHotel, type Hotel } from '../../api/hotels';
import './hotels-design.css';

export const HotelsListPage: React.FC = () => {
  const { t } = useTranslation();
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
      .catch((e) => showAlert(e.message || t('crm.hotels.list.error'), { variant: 'error' }))
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
      showAlert(t('crm.hotels.list.modal.nameRequired'), { variant: 'error' });
      return;
    }
    setSaving(true);
    createHotel({ name, city, country, stars: Number(stars), currency, address, description })
      .then((h) => {
        setShowNew(false);
        resetForm();
        navigate(`/hotels/${h.id}`);
      })
      .catch((e) => showAlert(e.message || t('crm.hotels.list.modal.createError'), { variant: 'error' }))
      .finally(() => setSaving(false));
  };

  return (
    <MainLayout>
      <PageHelpButton topic="hotelsList" />
      <div className="px-scope">
        <HotelsSubnav active="hotels" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.hotels.list.kicker', { count: hotels.length })}</div>
            <h1>{t('crm.hotels.list.title')}</h1>
            <p className="sub">{t('crm.hotels.list.subtitle')}</p>
          </div>
          <div className="htl-hero-r">
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>
              <Ic d={HTL_ICON.plus} size={14} />{t('crm.hotels.list.addHotel')}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, margin: '16px 0' }}>
          <div className="bk-search" style={{ flex: 1, maxWidth: 340 }}>
            <Ic d={HTL_ICON.search} size={14} />
            <input placeholder={t('crm.hotels.list.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="btn"><Ic d={HTL_ICON.filter} size={13} />{t('crm.hotels.list.filters')}</button>
          <button className="btn"><Ic d={HTL_ICON.sort} size={13} />{t('crm.hotels.list.sort')}</button>
        </div>

        {!loading && filtered.length === 0 && hotels.length > 0 && (
          <div style={{ padding: 24, color: 'var(--fg-3)', fontSize: 13 }}>{t('crm.hotels.list.empty')}</div>
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
                  {h.status === 'active' ? t('crm.hotels.status.active') : t('crm.hotels.status.draft')}
                </span>
              </div>
              <div className="htl-card-body">
                <div className="htl-card-name">{h.name}</div>
                <div className="htl-card-loc"><Ic d={HTL_ICON.calendar} size={12} />{[h.city, h.country].filter(Boolean).join(', ')}</div>
                <div className="htl-card-stats">
                  <span><b>{h.roomsCount}</b> {t('crm.hotels.list.card.rooms')}</span>
                  <span><b>{h.roomTypesCount}</b> {t('crm.hotels.list.card.types')}</span>
                  <span><b>{h.occupancyToday}%</b> {t('crm.hotels.list.card.occupancy')}</span>
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
            <span style={{ fontSize: 13 }}>{t('crm.hotels.list.addCard')}</span>
          </div>
        </div>
      </div>

      {showNew && (
        <div className="px-scope">
          <div className="bk-modal-back" onClick={() => setShowNew(false)} />
          <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bk-modal-head">
              <h3>{t('crm.hotels.list.modal.title')}</h3>
              <button onClick={() => setShowNew(false)}><Ic d={HTL_ICON.x} size={16} /></button>
            </div>
            <div className="bk-modal-body">
              <label>{t('crm.hotels.list.modal.nameLabel')}</label>
              <input placeholder={t('crm.hotels.list.modal.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
              <div className="bk-row2">
                <div><label>{t('crm.hotels.list.modal.cityLabel')}</label><input placeholder={t('crm.hotels.list.modal.cityPlaceholder')} value={city} onChange={(e) => setCity(e.target.value)} /></div>
                <div><label>{t('crm.hotels.list.modal.countryLabel')}</label><input placeholder={t('crm.hotels.list.modal.countryPlaceholder')} value={country} onChange={(e) => setCountry(e.target.value)} /></div>
              </div>
              <div className="bk-row2">
                <div>
                  <label>{t('crm.hotels.list.modal.starsLabel')}</label>
                  <select value={stars} onChange={(e) => setStars(e.target.value)}>
                    <option value="5">{t('crm.hotels.list.modal.stars5')}</option>
                    <option value="4">{t('crm.hotels.list.modal.stars4')}</option>
                    <option value="3">{t('crm.hotels.list.modal.stars3')}</option>
                  </select>
                </div>
                <div>
                  <label>{t('crm.hotels.list.modal.currencyLabel')}</label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="TRY">TRY</option>
                  </select>
                </div>
              </div>
              <label>{t('crm.hotels.list.modal.addressLabel')}</label>
              <input placeholder={t('crm.hotels.list.modal.addressPlaceholder')} value={address} onChange={(e) => setAddress(e.target.value)} />
              <label>{t('crm.hotels.list.modal.descriptionLabel')}</label>
              <textarea rows={3} placeholder={t('crm.hotels.list.modal.descriptionPlaceholder')} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="bk-modal-foot">
              <button className="btn" onClick={() => setShowNew(false)}>{t('crm.hotels.list.modal.cancel')}</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleCreate}>
                <Ic d={HTL_ICON.check} size={14} />{t('crm.hotels.list.modal.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};
