import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { HotelsSubnav } from './HotelsSubnav';
import { HotelPricingCalendar } from './HotelPricingCalendar';
import { Ic, HTL_ICON } from './HotelIcons';
import {
  fetchHotel,
  updateHotel,
  fetchRoomTypes,
  createRoomType,
  updateRoomType,
  deleteRoomType,
  fetchMarkets,
  createMarket,
  updateMarket,
  deleteMarket,
  fetchMarketPrices,
  upsertMarketPrice,
  type Hotel,
  type HotelRoomType,
  type HotelMarket,
  type HotelRoomMarketPrice,
} from '../../api/hotels';
import './hotels-design.css';

type Tab = 'rooms' | 'calendar' | 'markets' | 'settings';

function pctDiff(base: number, val: number) {
  if (!base) return 0;
  return Math.round(((val - base) / base) * 100);
}

const RoomTypeModal: React.FC<{
  hotelId: string;
  initial: HotelRoomType | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ hotelId, initial, onClose, onSaved }) => {
  const { showAlert } = useAlertModal();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initial?.name || '');
  const [sizeM2, setSizeM2] = useState(initial?.sizeM2 || '');
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '');
  const [capacityLabel, setCapacityLabel] = useState(initial?.capacityLabel || '');
  const [basePrice, setBasePrice] = useState(initial?.basePrice || '');
  const [amenities, setAmenities] = useState(initial?.amenities.join(', ') || '');

  const handleSave = () => {
    if (!name.trim()) {
      showAlert('Укажите название типа номера', { variant: 'error' });
      return;
    }
    const dto = {
      name,
      sizeM2: sizeM2 || null,
      quantity: Number(quantity) || 0,
      capacityLabel: capacityLabel || null,
      basePrice: basePrice || '0',
      amenities: amenities.split(',').map((a) => a.trim()).filter(Boolean),
    };
    setSaving(true);
    const req = initial ? updateRoomType(initial.id, dto) : createRoomType(hotelId, dto);
    req
      .then(() => onSaved())
      .catch((e) => showAlert(e.message || 'Не удалось сохранить', { variant: 'error' }))
      .finally(() => setSaving(false));
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bk-modal-head">
          <h3>{initial ? 'Изменить тип номера' : 'Новый тип номера'}</h3>
          <button onClick={onClose}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="bk-modal-body">
          <label>Название типа</label>
          <input placeholder="Например, Deluxe Twin" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="bk-row2">
            <div><label>Площадь, м²</label><input placeholder="28" value={sizeM2 || ''} onChange={(e) => setSizeM2(e.target.value)} /></div>
            <div><label>Кол-во номеров этого типа</label><input placeholder="18" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
          </div>
          <div className="bk-row2">
            <div><label>Вместимость</label><input placeholder="2 взрослых + 1 ребёнок" value={capacityLabel || ''} onChange={(e) => setCapacityLabel(e.target.value)} /></div>
            <div><label>Базовая цена / ночь</label><input placeholder="142" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} /></div>
          </div>
          <label>Удобства (через запятую)</label>
          <input placeholder="Wi-Fi, Вид на море, Мини-бар" value={amenities} onChange={(e) => setAmenities(e.target.value)} />
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
            <Ic d={HTL_ICON.check} size={14} />{initial ? 'Сохранить' : 'Создать тип номера'}
          </button>
        </div>
      </div>
    </div>
  );
};

const RoomsTab: React.FC<{ hotelId: string; roomTypes: HotelRoomType[]; onChanged: () => void }> = ({
  hotelId,
  roomTypes,
  onChanged,
}) => {
  const { showAlert, showConfirm } = useAlertModal();
  const navigate = useNavigate();
  const [modalState, setModalState] = useState<'new' | HotelRoomType | null>(null);
  const [editingQty, setEditingQty] = useState<string | null>(null);

  const totalRooms = roomTypes.reduce((s, r) => s + r.quantity, 0);

  const saveQty = (id: string, val: string) => {
    const n = Math.max(0, parseInt(val, 10) || 0);
    updateRoomType(id, { quantity: n })
      .then(() => onChanged())
      .catch((e) => showAlert(e.message || 'Не удалось сохранить', { variant: 'error' }))
      .finally(() => setEditingQty(null));
  };

  const handleDelete = async (r: HotelRoomType) => {
    const ok = await showConfirm(`Удалить тип номера «${r.name}»? Это действие нельзя отменить.`, {
      title: 'Удалить тип номера',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    deleteRoomType(r.id)
      .then(() => onChanged())
      .catch((e) => showAlert(e.message || 'Не удалось удалить тип номера', { variant: 'error' }));
  };

  const toggleStopSale = (r: HotelRoomType) => {
    updateRoomType(r.id, { stopSale: !r.stopSale })
      .then(() => onChanged())
      .catch((e) => showAlert(e.message || 'Не удалось изменить стоп-продажу', { variant: 'error' }));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>
          {roomTypes.length} типа номеров · <b style={{ color: 'var(--ink)' }}>{totalRooms}</b> номеров всего
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModalState('new')}>
          <Ic d={HTL_ICON.plus} size={13} />Тип номера
        </button>
      </div>

      <div className="rm-grid">
        {roomTypes.map((r) => (
          <div key={r.id} className={r.stopSale ? 'rm-card rm-card-stopped' : 'rm-card'}>
            <div className="rm-card-top">
              <div>
                <div className="rm-card-name">
                  {r.name}
                  {r.stopSale && <span className="ppt-stop-badge" style={{ marginLeft: 8 }}>СТОП-ПРОДАЖА</span>}
                </div>
                <div className="rm-card-meta">{r.sizeM2 ? `${r.sizeM2} м² · ` : ''}{r.capacityLabel}</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  style={{ background: 'none', border: 'none', color: r.stopSale ? '#d64545' : 'var(--fg-3)', cursor: 'pointer' }}
                  title={r.stopSale ? 'Снять стоп-продажу' : 'Поставить стоп-продажу на весь тип номера'}
                  onClick={() => toggleStopSale(r)}
                >
                  <Ic d={HTL_ICON.ban} size={14} />
                </button>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer' }}
                  title="Изменить"
                  onClick={() => setModalState(r)}
                >
                  <Ic d={HTL_ICON.pencil} size={14} />
                </button>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer' }}
                  title="Удалить"
                  onClick={() => handleDelete(r)}
                >
                  <Ic d={HTL_ICON.x} size={14} />
                </button>
              </div>
            </div>
            <div className="rm-card-price">${r.basePrice}<small>/ ночь, база</small></div>
            <div className="rm-card-tags">{r.amenities.map((t) => <span key={t} className="rm-tag">{t}</span>)}</div>
            <div className="rm-card-foot">
              {editingQty === r.id ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>Кол-во номеров:</span>
                  <input
                    autoFocus
                    type="number"
                    defaultValue={r.quantity}
                    style={{ width: 56, padding: '4px 6px', border: '1px solid var(--line-2)', borderRadius: 6, fontFamily: 'var(--ff-mono)', fontSize: 12.5 }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveQty(r.id, (e.target as HTMLInputElement).value);
                      if (e.key === 'Escape') setEditingQty(null);
                    }}
                    onBlur={(e) => saveQty(r.id, e.target.value)}
                  />
                </span>
              ) : (
                <span
                  style={{ fontSize: 11.5, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                  onClick={() => setEditingQty(r.id)}
                  title="Изменить количество номеров"
                >
                  Кол-во номеров: <b style={{ color: 'var(--ink)' }}>{r.quantity}</b>
                  <Ic d={HTL_ICON.pencil} size={12} />
                </span>
              )}
              <button className="btn btn-sm" onClick={() => navigate(`/hotels/room-types/${r.id}/pricing`)}>Редактировать цены</button>
            </div>
          </div>
        ))}
      </div>

      {modalState && (
        <RoomTypeModal
          hotelId={hotelId}
          initial={modalState === 'new' ? null : modalState}
          onClose={() => setModalState(null)}
          onSaved={() => {
            setModalState(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
};

const MarketsTab: React.FC<{ hotelId: string; roomTypes: HotelRoomType[] }> = ({ hotelId, roomTypes }) => {
  const { showAlert, showConfirm } = useAlertModal();
  const [markets, setMarkets] = useState<HotelMarket[]>([]);
  const [pricesByRoom, setPricesByRoom] = useState<Record<string, HotelRoomMarketPrice[]>>({});
  const [showAddMarket, setShowAddMarket] = useState(false);
  const [newMarketCode, setNewMarketCode] = useState('');
  const [newMarketName, setNewMarketName] = useState('');
  const [editingMarketId, setEditingMarketId] = useState<string | null>(null);

  const load = () => {
    fetchMarkets(hotelId)
      .then(setMarkets)
      .catch((e) => showAlert(e.message || 'Не удалось загрузить рынки', { variant: 'error' }));
    Promise.all(roomTypes.map((r) => fetchMarketPrices(r.id).then((p) => [r.id, p] as const)))
      .then((pairs) => setPricesByRoom(Object.fromEntries(pairs)))
      .catch((e) => showAlert(e.message || 'Не удалось загрузить цены', { variant: 'error' }));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId, roomTypes.length]);

  const priceFor = (roomId: string, marketId: string) => {
    const row = (pricesByRoom[roomId] || []).find((p) => p.marketId === marketId);
    return row?.price ?? '0';
  };

  const update = (roomId: string, marketId: string, val: string) => {
    upsertMarketPrice(roomId, marketId, val)
      .then((row) => {
        setPricesByRoom((prev) => {
          const list = (prev[roomId] || []).filter((p) => p.marketId !== marketId);
          list.push(row as any);
          return { ...prev, [roomId]: list };
        });
      })
      .catch((e) => showAlert(e.message || 'Не удалось сохранить цену', { variant: 'error' }));
  };

  const addMarket = () => {
    if (!newMarketCode.trim() || !newMarketName.trim()) {
      showAlert('Укажите код и название рынка', { variant: 'error' });
      return;
    }
    createMarket(hotelId, { code: newMarketCode, name: newMarketName })
      .then(() => {
        setShowAddMarket(false);
        setNewMarketCode('');
        setNewMarketName('');
        load();
      })
      .catch((e) => showAlert(e.message || 'Не удалось добавить рынок', { variant: 'error' }));
  };

  const renameMarket = (id: string, name: string) => {
    if (!name.trim()) {
      setEditingMarketId(null);
      return;
    }
    updateMarket(id, { name })
      .then(() => load())
      .catch((e) => showAlert(e.message || 'Не удалось переименовать рынок', { variant: 'error' }))
      .finally(() => setEditingMarketId(null));
  };

  const removeMarket = async (m: HotelMarket) => {
    const ok = await showConfirm(`Удалить рынок «${m.name}»? Цены по этому рынку будут удалены.`, {
      title: 'Удалить рынок',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    deleteMarket(m.id)
      .then(() => load())
      .catch((e) => showAlert(e.message || 'Не удалось удалить рынок', { variant: 'error' }));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>Разные цены для разных рынков продаж. База — внутренний рынок.</div>
        <button className="btn btn-sm" onClick={() => setShowAddMarket(true)}><Ic d={HTL_ICON.plus} size={13} />Добавить рынок</button>
      </div>
      <div className="mkt-table-wrap">
        <table className="mkt-table">
          <thead>
            <tr>
              <th>Тип номера</th>
              <th>База ($)</th>
              {markets.map((m) => (
                <th key={m.id}>
                  {editingMarketId === m.id ? (
                    <input
                      autoFocus
                      defaultValue={m.name}
                      style={{ width: 100, padding: '3px 6px', fontSize: 11.5, fontWeight: 400, textTransform: 'none' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') renameMarket(m.id, (e.target as HTMLInputElement).value);
                        if (e.key === 'Escape') setEditingMarketId(null);
                      }}
                      onBlur={(e) => renameMarket(m.id, e.target.value)}
                    />
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span className="mkt-flag">{m.code.toUpperCase()}</span>
                      <span style={{ cursor: 'pointer' }} onClick={() => setEditingMarketId(m.id)} title="Переименовать">{m.name}</span>
                      <button
                        style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}
                        title="Удалить рынок"
                        onClick={() => removeMarket(m)}
                      >
                        ×
                      </button>
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roomTypes.map((r) => (
              <tr key={r.id}>
                <td className="room-cell">{r.name}</td>
                <td style={{ fontFamily: 'var(--ff-mono)', color: 'var(--fg-3)' }}>${r.basePrice}</td>
                {markets.map((m) => {
                  const val = Number(priceFor(r.id, m.id));
                  const diff = pctDiff(Number(r.basePrice), val);
                  return (
                    <td key={m.id}>
                      <input
                        className="mkt-price-input"
                        defaultValue={val}
                        onBlur={(e) => update(r.id, m.id, e.target.value)}
                      />
                      <span className={`mkt-diff${diff > 0 ? ' up' : diff < 0 ? ' down' : ''}`}>{diff > 0 ? '+' : ''}{diff}%</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddMarket && (
        <div className="px-scope">
          <div className="bk-modal-back" onClick={() => setShowAddMarket(false)} />
          <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bk-modal-head">
              <h3>Новый рынок</h3>
              <button onClick={() => setShowAddMarket(false)}><Ic d={HTL_ICON.x} size={16} /></button>
            </div>
            <div className="bk-modal-body">
              <label>Код (напр. DE, RU, UK)</label>
              <input value={newMarketCode} onChange={(e) => setNewMarketCode(e.target.value)} />
              <label>Название</label>
              <input value={newMarketName} onChange={(e) => setNewMarketName(e.target.value)} />
            </div>
            <div className="bk-modal-foot">
              <button className="btn" onClick={() => setShowAddMarket(false)}>Отмена</button>
              <button className="btn btn-primary" onClick={addMarket}><Ic d={HTL_ICON.check} size={14} />Добавить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const HotelDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { showAlert } = useAlertModal();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const [tab, setTab] = useState<Tab>('rooms');
  const [settingsName, setSettingsName] = useState('');
  const [settingsCheckIn, setSettingsCheckIn] = useState('');
  const [settingsCheckOut, setSettingsCheckOut] = useState('');
  const [settingsRevenueTarget, setSettingsRevenueTarget] = useState('');
  const [settingsRiskBad, setSettingsRiskBad] = useState('');
  const [settingsRiskWarn, setSettingsRiskWarn] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const load = () => {
    if (!id) return;
    fetchHotel(id)
      .then((h) => {
        setHotel(h);
        setSettingsName(h.name);
        setSettingsCheckIn(h.checkInTime);
        setSettingsCheckOut(h.checkOutTime);
        setSettingsRevenueTarget(h.seasonRevenueTarget);
        setSettingsRiskBad(h.riskThresholdBadPct ?? '');
        setSettingsRiskWarn(h.riskThresholdWarnPct ?? '');
      })
      .catch((e) => showAlert(e.message || 'Не удалось загрузить отель', { variant: 'error' }));
    fetchRoomTypes(id)
      .then(setRoomTypes)
      .catch((e) => showAlert(e.message || 'Не удалось загрузить типы номеров', { variant: 'error' }));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const totalRooms = useMemo(() => roomTypes.reduce((s, r) => s + r.quantity, 0), [roomTypes]);

  const saveSettings = () => {
    if (!id) return;
    setSavingSettings(true);
    updateHotel(id, {
      name: settingsName,
      checkInTime: settingsCheckIn,
      checkOutTime: settingsCheckOut,
      seasonRevenueTarget: settingsRevenueTarget || '0',
      riskThresholdBadPct: settingsRiskBad || null,
      riskThresholdWarnPct: settingsRiskWarn || null,
    })
      .then(() => load())
      .catch((e) => showAlert(e.message || 'Не удалось сохранить', { variant: 'error' }))
      .finally(() => setSavingSettings(false));
  };

  if (!hotel) return null;

  return (
    <MainLayout>
      <div className="px-scope">
        <HotelsSubnav active="hotels" />
        <div className="htl-detail-cover">
          <div style={{ background: 'rgba(255,255,255,.92)', borderRadius: 10, padding: '8px 14px' }}>
            <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 600, fontSize: 16 }}>{hotel.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
              {[hotel.city, hotel.country].filter(Boolean).join(', ')} · {hotel.stars}★ · {totalRooms} номеров
            </div>
          </div>
        </div>

        <div className="htl-info-grid">
          <div className="htl-info-item"><div className="l">Загрузка сегодня</div><div className="v">{hotel.occupancyToday}%</div></div>
          <div className="htl-info-item"><div className="l">Средний ADR</div><div className="v">${hotel.adr}</div></div>
          <div className="htl-info-item"><div className="l">Типов номеров</div><div className="v">{hotel.roomTypesCount}</div></div>
          <div className="htl-info-item"><div className="l">Рынков подключено</div><div className="v">{hotel.marketsCount}</div></div>
        </div>

        <div className="htl-detail-tabs">
          <div className={`htl-detail-tab${tab === 'rooms' ? ' active' : ''}`} onClick={() => setTab('rooms')}>Номера</div>
          <div className={`htl-detail-tab${tab === 'calendar' ? ' active' : ''}`} onClick={() => setTab('calendar')}>Календарь цен</div>
          <div className={`htl-detail-tab${tab === 'markets' ? ' active' : ''}`} onClick={() => setTab('markets')}>Рынки и цены</div>
          <div className={`htl-detail-tab${tab === 'settings' ? ' active' : ''}`} onClick={() => setTab('settings')}>Настройки отеля</div>
        </div>

        {tab === 'rooms' && <RoomsTab hotelId={hotel.id} roomTypes={roomTypes} onChanged={load} />}
        {tab === 'calendar' && <HotelPricingCalendar roomTypes={roomTypes} />}
        {tab === 'markets' && <MarketsTab hotelId={hotel.id} roomTypes={roomTypes} />}
        {tab === 'settings' && (
          <div style={{ maxWidth: 520 }}>
            <label style={{ fontSize: 11, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>Название отеля</label>
            <input
              value={settingsName}
              onChange={(e) => setSettingsName(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 8, marginBottom: 12 }}
            />
            <div className="bk-row2">
              <div>
                <label style={{ fontSize: 11, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>Заезд с</label>
                <input
                  value={settingsCheckIn}
                  onChange={(e) => setSettingsCheckIn(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 8 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>Выезд до</label>
                <input
                  value={settingsCheckOut}
                  onChange={(e) => setSettingsCheckOut(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 8 }}
                />
              </div>
            </div>
            <label style={{ fontSize: 11, color: 'var(--fg-3)', display: 'block', marginBottom: 4, marginTop: 12 }}>
              Плановая выручка на сезон ({hotel.currency})
            </label>
            <input
              value={settingsRevenueTarget}
              onChange={(e) => setSettingsRevenueTarget(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 8, marginBottom: 12 }}
            />
            <div className="bk-row2">
              <div>
                <label style={{ fontSize: 11, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>
                  Риск: низкая загрузка ниже, %
                </label>
                <input
                  value={settingsRiskBad}
                  onChange={(e) => setSettingsRiskBad(e.target.value)}
                  placeholder="45 (по умолчанию)"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 8 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>
                  Риск: внимание ниже, %
                </label>
                <input
                  value={settingsRiskWarn}
                  onChange={(e) => setSettingsRiskWarn(e.target.value)}
                  placeholder="65 (по умолчанию)"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 8 }}
                />
              </div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" disabled={savingSettings} onClick={saveSettings}>
                <Ic d={HTL_ICON.check} size={14} />Сохранить
              </button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
