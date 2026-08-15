import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { resolvePublicAssetUrl } from '../../api/client';
import { HotelsSubnav } from './HotelsSubnav';
import { HotelPricingCalendar } from './HotelPricingCalendar';
import { Ic, HTL_ICON } from './HotelIcons';
import { PhotoEditDrawer } from './PhotoEditDrawer';
import {
  fetchHotel,
  updateHotel,
  updateHotelInfo,
  uploadHotelCover,
  uploadRoomTypeCover,
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
  fetchGalleryCategories,
  createGalleryCategory,
  renameGalleryCategory,
  removeGalleryCategory,
  fetchGalleryPhotos,
  uploadGalleryPhoto,
  fetchFactsheetItems,
  createFactsheetItem,
  updateFactsheetItem,
  removeFactsheetItem,
  previewHotelInfoImport,
  applyHotelInfoImport,
  exportHotelInfo,
  fetchFeedToken,
  regenerateFeedToken,
  fetchPeriodPriceSummary,
  fetchRoomUnits,
  createRoomUnit,
  updateRoomUnitHousekeeping,
  deleteRoomUnit,
  type Hotel,
  type HotelRoomType,
  type HotelMarket,
  type HotelRoomMarketPrice,
  type HotelGalleryCategory,
  type HotelPhoto,
  type HotelFactsheetItem,
  type HotelFactsheetItemKind,
  type HotelFactsheetItemInput,
  type HotelInfoImportPreview,
  type HotelPeriodPriceSummaryRow,
  type HotelRoomUnit,
  type HotelRoomUnitHousekeepingStatus,
  HOTEL_ROOM_UNIT_HOUSEKEEPING_LABELS_RU,
} from '../../api/hotels';
import './hotels-design.css';

type Tab = 'rooms' | 'calendar' | 'markets' | 'info' | 'gallery' | 'settings';

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

const HOUSEKEEPING_COLORS: Record<HotelRoomUnitHousekeepingStatus, string> = {
  clean: '#2f9e5c',
  dirty: '#d64545',
  inspected: '#3b7fd6',
  out_of_order: '#8a8f98',
};

const HOUSEKEEPING_CYCLE: HotelRoomUnitHousekeepingStatus[] = ['clean', 'dirty', 'inspected', 'out_of_order'];

export const HousekeepingBadge: React.FC<{ status: HotelRoomUnitHousekeepingStatus; onClick?: () => void; title?: string }> = ({
  status,
  onClick,
  title,
}) => (
  <span
    onClick={onClick}
    title={title || HOTEL_ROOM_UNIT_HOUSEKEEPING_LABELS_RU[status]}
    style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: HOUSEKEEPING_COLORS[status],
      cursor: onClick ? 'pointer' : 'default',
      flexShrink: 0,
    }}
  />
);

const RoomUnitsSection: React.FC<{ hotelId: string; roomTypeId: string; units: HotelRoomUnit[]; onChanged: () => void }> = ({
  roomTypeId,
  units,
  onChanged,
}) => {
  const { showAlert, showConfirm } = useAlertModal();
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const activeUnits = units.filter((u) => u.active);

  const cycleStatus = (u: HotelRoomUnit) => {
    const next = HOUSEKEEPING_CYCLE[(HOUSEKEEPING_CYCLE.indexOf(u.housekeepingStatus) + 1) % HOUSEKEEPING_CYCLE.length];
    updateRoomUnitHousekeeping(u.id, next).then(onChanged).catch((e) => showAlert(e.message || 'Не удалось изменить статус', { variant: 'error' }));
  };

  const handleAdd = () => {
    const label = newLabel.trim();
    if (!label) { setAdding(false); return; }
    createRoomUnit({ roomTypeId, label })
      .then(() => { setNewLabel(''); setAdding(false); onChanged(); })
      .catch((e) => showAlert(e.message || 'Не удалось добавить номер', { variant: 'error' }));
  };

  const handleRemove = async (u: HotelRoomUnit) => {
    const ok = await showConfirm(`Удалить номер «${u.label}»?`, { title: 'Удалить номер', confirmLabel: 'Удалить', danger: true });
    if (!ok) return;
    deleteRoomUnit(u.id).then(onChanged).catch((e) => showAlert(e.message || 'Не удалось удалить номер', { variant: 'error' }));
  };

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--line-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--fg-3)', marginRight: 2 }}>Номера:</span>
        {activeUnits.map((u) => (
          <span
            key={u.id}
            title={`${u.label} — ${HOTEL_ROOM_UNIT_HOUSEKEEPING_LABELS_RU[u.housekeepingStatus]} (клик — сменить статус)`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 999, padding: '2px 7px' }}
          >
            <HousekeepingBadge status={u.housekeepingStatus} onClick={() => cycleStatus(u)} />
            {u.label}
            <button
              type="button"
              onClick={() => handleRemove(u)}
              title="Удалить номер"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#9a1f31', display: 'flex' }}
            >
              <Ic d={HTL_ICON.x} size={10} />
            </button>
          </span>
        ))}
        {adding ? (
          <input
            autoFocus
            placeholder="204"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') { setAdding(false); setNewLabel(''); }
            }}
            onBlur={handleAdd}
            style={{ width: 60, fontSize: 11.5, padding: '2px 6px', border: '1px solid var(--line-2)', borderRadius: 999 }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            title="Добавить номер"
            style={{ display: 'inline-flex', alignItems: 'center', background: 'none', border: '1px dashed var(--line-2)', borderRadius: 999, padding: '2px 7px', cursor: 'pointer', color: 'var(--fg-3)' }}
          >
            <Ic d={HTL_ICON.plus} size={10} />
          </button>
        )}
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
  const [units, setUnits] = useState<HotelRoomUnit[]>([]);

  const loadUnits = () => {
    fetchRoomUnits({ hotelId }).then(setUnits).catch(() => {});
  };
  useEffect(() => {
    loadUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

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

  const coverInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const handleCoverFile = (r: HotelRoomType, file: File) => {
    uploadRoomTypeCover(r.id, file)
      .then(() => onChanged())
      .catch((e) => showAlert(e.message || 'Не удалось загрузить фото', { variant: 'error' }));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
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
            <div
              className="rm-card-photo"
              style={r.coverPhotoUrl ? { backgroundImage: `url(${resolvePublicAssetUrl(r.coverPhotoUrl)})` } : undefined}
              onClick={() => coverInputRefs.current[r.id]?.click()}
            >
              {!r.coverPhotoUrl && <span className="rm-card-photo-placeholder"><Ic d={HTL_ICON.plus} size={16} />Добавить фото</span>}
              <button
                type="button"
                className="rm-card-photo-btn"
                title="Изменить фото"
                onClick={(e) => { e.stopPropagation(); coverInputRefs.current[r.id]?.click(); }}
              >
                <Ic d={HTL_ICON.pencil} size={12} />
              </button>
              <input
                ref={(el) => { coverInputRefs.current[r.id] = el; }}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCoverFile(r, file);
                  e.target.value = '';
                }}
              />
            </div>
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
                  style={{ background: 'none', border: 'none', color: '#9a1f31', cursor: 'pointer' }}
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
            <RoomUnitsSection
              hotelId={hotelId}
              roomTypeId={r.id}
              units={units.filter((u) => u.roomTypeId === r.id)}
              onChanged={loadUnits}
            />
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
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
                        style={{ background: 'none', border: 'none', color: '#9a1f31', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}
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

const HOTEL_INFO_FIELDS: Array<{ key: string; label: string; type: 'text' | 'bool' }> = [
  { key: 'yearOpened', label: 'Год открытия', type: 'text' },
  { key: 'lastRenovation', label: 'Последняя реновация', type: 'text' },
  { key: 'category', label: 'Категория', type: 'text' },
  { key: 'concept', label: 'Концепция', type: 'text' },
  { key: 'heatingCooling', label: 'Отопление и охлаждение', type: 'text' },
  { key: 'totalAreaM2', label: 'Общая площадь', type: 'text' },
  { key: 'investor', label: 'Инвестор', type: 'text' },
  { key: 'accessibility', label: 'Для гостей с ограниченными возможностями', type: 'text' },
  { key: 'conferenceHalls', label: 'Конференц-залы', type: 'text' },
  { key: 'parking', label: 'Парковка', type: 'text' },
  { key: 'creditCards', label: 'Кредитные карты', type: 'text' },
  { key: 'elevators', label: 'Лифт', type: 'text' },
  { key: 'petsHookahPolicy', label: 'Домашние животные/Кальян', type: 'text' },
  { key: 'phone1', label: 'Телефон', type: 'text' },
  { key: 'phone2', label: 'Телефон 2', type: 'text' },
  { key: 'email1', label: 'Эл. Почта 1', type: 'text' },
  { key: 'email2', label: 'Эл. Почта 2', type: 'text' },
  { key: 'website', label: 'Веб сайт', type: 'text' },
  { key: 'airportDistance', label: 'Аэропорт', type: 'text' },
  { key: 'cityCenterDistance', label: 'Центр города', type: 'text' },
  { key: 'nearestTown', label: 'Ближайший населённый пункт', type: 'text' },
  { key: 'transport', label: 'Транспорт', type: 'text' },
  { key: 'buildingsCount', label: 'Количество зданий', type: 'text' },
  { key: 'floorsCount', label: 'Количество этажей', type: 'text' },
  { key: 'roomsBreakdown', label: 'Количество номеров', type: 'text' },
  { key: 'bedsBreakdown', label: 'Количество кроватей', type: 'text' },
  { key: 'disabledAccessRooms', label: 'Номера для гостей с ОВ', type: 'text' },
  { key: 'beachDescription', label: 'Расположение пляжа', type: 'text' },
  { key: 'beachLength', label: 'Протяжённость пляжа', type: 'text' },
  { key: 'poolsDescription', label: 'Бассейны (названия, площадь)', type: 'text' },
];

interface BlockColumnDef {
  key: 'name' | 'description' | 'hours' | 'paid' | `extra.${string}`;
  label: string;
}

const FACTSHEET_BLOCK_DEFS: Array<{ kind: HotelFactsheetItemKind; title: string; columns: BlockColumnDef[] }> = [
  {
    kind: 'restaurant',
    title: 'Рестораны',
    columns: [
      { key: 'name', label: 'Название' },
      { key: 'extra.mealType', label: 'Питание' },
      { key: 'description', label: 'Описание' },
      { key: 'hours', label: 'Часы работы' },
    ],
  },
  {
    kind: 'bar',
    title: 'Бары',
    columns: [
      { key: 'name', label: 'Название' },
      { key: 'description', label: 'Описание' },
      { key: 'hours', label: 'Часы работы' },
    ],
  },
  {
    kind: 'pool',
    title: 'Бассейны',
    columns: [
      { key: 'name', label: 'Название' },
      { key: 'extra.areaM2', label: 'Площадь' },
      { key: 'extra.depth', label: 'Глубина' },
      { key: 'description', label: 'Описание' },
      { key: 'hours', label: 'Часы работы' },
    ],
  },
  {
    kind: 'miniclub',
    title: 'Мини-клуб',
    columns: [
      { key: 'name', label: 'Возрастная группа' },
      { key: 'description', label: 'Активности' },
      { key: 'hours', label: 'Часы работы' },
    ],
  },
  {
    kind: 'service',
    title: 'Услуги',
    columns: [
      { key: 'name', label: 'Название' },
      { key: 'description', label: 'Описание' },
      { key: 'paid', label: 'Платно' },
    ],
  },
];

function getColVal(item: HotelFactsheetItem, col: BlockColumnDef): string {
  if (col.key === 'name') return item.name;
  if (col.key === 'description') return item.description || '';
  if (col.key === 'hours') return item.hours || '';
  if (col.key === 'paid') return '';
  return item.extra?.[col.key.slice('extra.'.length)] || '';
}

function buildItemInput(kind: HotelFactsheetItemKind, draft: Record<string, string>, columns: BlockColumnDef[]): HotelFactsheetItemInput {
  const dto: HotelFactsheetItemInput = { kind, name: draft.name || '', extra: {} };
  for (const col of columns) {
    if (col.key === 'name') continue;
    const val = (draft[col.key] || '').trim();
    if (col.key === 'description') dto.description = val || null;
    else if (col.key === 'hours') dto.hours = val || null;
    else if (col.key === 'paid') dto.paid = !!draft[col.key];
    else dto.extra![col.key.slice('extra.'.length)] = val;
  }
  return dto;
}

const FactsheetBlockSection: React.FC<{ hotelId: string; kind: HotelFactsheetItemKind; title: string; columns: BlockColumnDef[] }> = ({
  hotelId,
  kind,
  title,
  columns,
}) => {
  const { showAlert, showConfirm } = useAlertModal();
  const [items, setItems] = useState<HotelFactsheetItem[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);

  const load = () => {
    fetchFactsheetItems(hotelId, kind)
      .then(setItems)
      .catch((e) => showAlert(e.message || 'Не удалось загрузить данные', { variant: 'error' }));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  const saveCell = (item: HotelFactsheetItem, col: BlockColumnDef, val: string) => {
    const patch: Partial<HotelFactsheetItemInput> =
      col.key === 'name' ? { name: val }
      : col.key === 'description' ? { description: val || null }
      : col.key === 'hours' ? { hours: val || null }
      : { extra: { ...item.extra, [col.key.slice('extra.'.length)]: val } };
    updateFactsheetItem(item.id, patch)
      .then(load)
      .catch((e) => showAlert(e.message || 'Не удалось сохранить', { variant: 'error' }));
  };

  const togglePaid = (item: HotelFactsheetItem) => {
    updateFactsheetItem(item.id, { paid: !item.paid })
      .then(load)
      .catch((e) => showAlert(e.message || 'Не удалось сохранить', { variant: 'error' }));
  };

  const removeRow = async (item: HotelFactsheetItem) => {
    const ok = await showConfirm(`Удалить «${item.name}»?`, { title: 'Удалить запись', confirmLabel: 'Удалить', danger: true });
    if (!ok) return;
    removeFactsheetItem(item.id).then(load).catch((e) => showAlert(e.message || 'Не удалось удалить', { variant: 'error' }));
  };

  const addRow = () => {
    if (!draft.name?.trim()) {
      showAlert('Укажите название', { variant: 'error' });
      return;
    }
    createFactsheetItem(hotelId, buildItemInput(kind, draft, columns))
      .then(() => {
        setDraft({});
        setAdding(false);
        load();
      })
      .catch((e) => showAlert(e.message || 'Не удалось добавить', { variant: 'error' }));
  };

  return (
    <div style={{ marginTop: 20 }}>
      <div className="ha-section-head" style={{ marginBottom: 8 }}>
        <div className="sub" style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 12.5 }}>{title}</div>
      </div>
      <div className="occ-wrap" style={{ marginTop: 0 }}>
        <table className="occ-table">
          <thead>
            <tr>
              {columns.map((c) => <th key={c.key} className={c.key === 'name' ? 'occ-h' : undefined}>{c.label}</th>)}
              <th style={{ width: 36 }} />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                {columns.map((col) => (
                  <td key={col.key} className={col.key === 'name' ? 'occ-name' : 'price-cell'} style={{ textAlign: 'left' }}>
                    {col.key === 'paid' ? (
                      <button className={`bool-toggle${item.paid ? ' on' : ''}`} onClick={() => togglePaid(item)}>
                        {item.paid ? '✓' : '✕'}
                      </button>
                    ) : (
                      <input
                        key={`${item.id}-${col.key}-${getColVal(item, col)}`}
                        className="info-input"
                        defaultValue={getColVal(item, col)}
                        onBlur={(e) => saveCell(item, col, e.target.value)}
                      />
                    )}
                  </td>
                ))}
                <td>
                  <button
                    style={{ background: 'none', border: 'none', color: '#9a1f31', cursor: 'pointer' }}
                    title="Удалить"
                    onClick={() => removeRow(item)}
                  >
                    <Ic d={HTL_ICON.x} size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {adding && (
              <tr>
                {columns.map((col) => (
                  <td key={col.key} style={{ textAlign: 'left' }}>
                    {col.key === 'paid' ? (
                      <button
                        className={`bool-toggle${draft[col.key] ? ' on' : ''}`}
                        onClick={() => setDraft((d) => ({ ...d, [col.key]: d[col.key] ? '' : '1' }))}
                      >
                        {draft[col.key] ? '✓' : '✕'}
                      </button>
                    ) : (
                      <input
                        autoFocus={col.key === 'name'}
                        className="info-input"
                        value={draft[col.key] || ''}
                        onChange={(e) => setDraft((d) => ({ ...d, [col.key]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') addRow(); }}
                      />
                    )}
                  </td>
                ))}
                <td>
                  <button style={{ background: 'none', border: 'none', color: '#1f8a5e', cursor: 'pointer' }} onClick={addRow} title="Добавить">
                    <Ic d={HTL_ICON.check} size={14} />
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!adding && (
        <div className="occ-add-row">
          <button className="btn btn-sm" onClick={() => setAdding(true)}><Ic d={HTL_ICON.plus} size={12} />Добавить</button>
        </div>
      )}
    </div>
  );
};

const HotelInfoImportModal: React.FC<{ hotelId: string; onClose: () => void; onApplied: () => void }> = ({ hotelId, onClose, onApplied }) => {
  const { showAlert } = useAlertModal();
  const [preview, setPreview] = useState<HotelInfoImportPreview | null>(null);
  const [applying, setApplying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    previewHotelInfoImport(file)
      .then(setPreview)
      .catch((e) => showAlert(e.message || 'Не удалось прочитать файл', { variant: 'error' }));
  };

  const apply = () => {
    if (!preview) return;
    setApplying(true);
    applyHotelInfoImport({ importId: preview.importId, hotelId })
      .then(() => { onApplied(); onClose(); })
      .catch((e) => showAlert(e.message || 'Не удалось применить импорт', { variant: 'error' }))
      .finally(() => setApplying(false));
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bk-modal-head">
          <h3>Импорт данных отеля из Excel</h3>
          <button onClick={onClose}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="bk-modal-body">
          {!preview ? (
            <div
              onClick={() => inputRef.current?.click()}
              style={{ border: '1.5px dashed var(--line-2)', borderRadius: 10, padding: 24, textAlign: 'center', cursor: 'pointer', color: 'var(--fg-3)', fontSize: 12.5 }}
            >
              Выберите файл .xlsx (скачайте шаблон через «Скачать Excel», заполните и загрузите обратно)
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
              />
            </div>
          ) : (
            <div style={{ fontSize: 12.5, lineHeight: 1.7 }}>
              <div>Общих полей найдено: <b>{preview.infoFieldsCount}</b></div>
              {FACTSHEET_BLOCK_DEFS.map((b) => (
                <div key={b.kind}>{b.title}: <b>{preview.itemCounts[b.kind] || 0}</b></div>
              ))}
              {preview.unmatchedLabels.length > 0 && (
                <div style={{ marginTop: 8, color: '#a06b1a' }}>
                  Не распознаны подписи: {preview.unmatchedLabels.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>Отмена</button>
          {preview && (
            <button className="btn btn-primary" disabled={applying} onClick={apply}>
              <Ic d={HTL_ICON.check} size={14} />Применить
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const HotelInfoTab: React.FC<{ hotel: Hotel; onSaved: () => void }> = ({ hotel, onSaved }) => {
  const { showAlert } = useAlertModal();
  const [data, setData] = useState<Record<string, string | boolean>>(hotel.infoFields || {});
  const [showImport, setShowImport] = useState(false);
  const [blocksKey, setBlocksKey] = useState(0);
  const [revenueTarget, setRevenueTarget] = useState(hotel.seasonRevenueTarget);
  const [riskBad, setRiskBad] = useState(hotel.riskThresholdBadPct ?? '');
  const [riskWarn, setRiskWarn] = useState(hotel.riskThresholdWarnPct ?? '');
  const [savingPricingSettings, setSavingPricingSettings] = useState(false);

  useEffect(() => setData(hotel.infoFields || {}), [hotel]);
  useEffect(() => {
    setRevenueTarget(hotel.seasonRevenueTarget);
    setRiskBad(hotel.riskThresholdBadPct ?? '');
    setRiskWarn(hotel.riskThresholdWarnPct ?? '');
  }, [hotel]);

  const update = (key: string, val: string | boolean) => {
    const next = { ...data, [key]: val };
    setData(next);
    updateHotelInfo(hotel.id, { [key]: val }).then(onSaved).catch((e) => showAlert(e.message || 'Не удалось сохранить', { variant: 'error' }));
  };

  const savePricingSettings = () => {
    setSavingPricingSettings(true);
    updateHotel(hotel.id, {
      seasonRevenueTarget: revenueTarget || '0',
      riskThresholdBadPct: riskBad || null,
      riskThresholdWarnPct: riskWarn || null,
    })
      .then(() => onSaved())
      .catch((e) => showAlert(e.message || 'Не удалось сохранить', { variant: 'error' }))
      .finally(() => setSavingPricingSettings(false));
  };

  return (
    <div>
      <div className="ha-section-head" style={{ marginBottom: 10 }}>
        <div className="sub" style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 12.5 }}>Аналитика и риски</div>
      </div>
      <div style={{ maxWidth: 520, marginBottom: 24 }}>
        <label style={{ fontSize: 11, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>
          Плановая выручка на сезон ({hotel.currency})
        </label>
        <input
          value={revenueTarget}
          onChange={(e) => setRevenueTarget(e.target.value)}
          style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 8, marginBottom: 12 }}
        />
        <div className="bk-row2">
          <div>
            <label style={{ fontSize: 11, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>
              Риск: низкая загрузка ниже, %
            </label>
            <input
              value={riskBad}
              onChange={(e) => setRiskBad(e.target.value)}
              placeholder="45 (по умолчанию)"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 8 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>
              Риск: внимание ниже, %
            </label>
            <input
              value={riskWarn}
              onChange={(e) => setRiskWarn(e.target.value)}
              placeholder="65 (по умолчанию)"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 8 }}
            />
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-sm btn-primary" disabled={savingPricingSettings} onClick={savePricingSettings}>
            <Ic d={HTL_ICON.check} size={13} />Сохранить
          </button>
        </div>
      </div>

      <div className="ha-section-head" style={{ marginBottom: 10 }}>
        <div className="sub" style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 12.5 }}>Фактшит</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
        <button className="btn btn-sm" onClick={() => exportHotelInfo(hotel.id, hotel.name).catch((e) => showAlert(e.message || 'Не удалось экспортировать', { variant: 'error' }))}>
          <Ic d={HTL_ICON.download} size={13} />Скачать Excel
        </button>
        <button className="btn btn-sm" onClick={() => setShowImport(true)}>
          <Ic d={HTL_ICON.plus} size={13} />Загрузить Excel
        </button>
      </div>
      <div className="occ-wrap">
        <table className="occ-table info-table">
          <tbody>
            {HOTEL_INFO_FIELDS.map((f) => (
              <tr key={f.key}>
                <td className="occ-name" style={{ width: 280 }}>{f.label}</td>
                <td className="price-cell" style={{ textAlign: 'left' }}>
                  {f.type === 'bool' ? (
                    <button className={`bool-toggle${data[f.key] ? ' on' : ''}`} onClick={() => update(f.key, !data[f.key])}>
                      {data[f.key] ? '✓' : '✕'}
                    </button>
                  ) : (
                    <input
                      className="info-input"
                      defaultValue={(data[f.key] as string) || ''}
                      onBlur={(e) => update(f.key, e.target.value)}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {FACTSHEET_BLOCK_DEFS.map((b) => (
        <FactsheetBlockSection key={`${b.kind}-${blocksKey}`} hotelId={hotel.id} kind={b.kind} title={b.title} columns={b.columns} />
      ))}

      {showImport && (
        <HotelInfoImportModal
          hotelId={hotel.id}
          onClose={() => setShowImport(false)}
          onApplied={() => { onSaved(); setBlocksKey((k) => k + 1); }}
        />
      )}
    </div>
  );
};

const HotelGalleryTab: React.FC<{ hotelId: string }> = ({ hotelId }) => {
  const { showAlert, showConfirm } = useAlertModal();
  const [categories, setCategories] = useState<HotelGalleryCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | 'all' | 'none'>('all');
  const [photos, setPhotos] = useState<HotelPhoto[]>([]);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const newCatNameRef = useRef<HTMLInputElement>(null);
  const [showAddCat, setShowAddCat] = useState(false);

  const loadCategories = () => {
    fetchGalleryCategories(hotelId)
      .then(setCategories)
      .catch((e) => showAlert(e.message || 'Не удалось загрузить категории', { variant: 'error' }));
  };
  const loadPhotos = () => {
    fetchGalleryPhotos(hotelId, {})
      .then(setPhotos)
      .catch((e) => showAlert(e.message || 'Не удалось загрузить фото', { variant: 'error' }));
  };

  useEffect(() => {
    loadCategories();
    loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  const visiblePhotos = useMemo(() => {
    if (activeCategoryId === 'all') return photos;
    if (activeCategoryId === 'none') return photos.filter((p) => !p.categoryId);
    return photos.filter((p) => p.categoryId === activeCategoryId);
  }, [photos, activeCategoryId]);

  const addCategory = () => {
    const name = newCatNameRef.current?.value.trim();
    if (!name) return;
    createGalleryCategory(hotelId, name)
      .then((c) => {
        setShowAddCat(false);
        loadCategories();
        setActiveCategoryId(c.id);
      })
      .catch((e) => showAlert(e.message || 'Не удалось добавить категорию', { variant: 'error' }));
  };

  const renameCategory = (id: string, name: string) => {
    if (!name.trim()) { setEditingCatId(null); return; }
    renameGalleryCategory(id, name)
      .then(() => loadCategories())
      .catch((e) => showAlert(e.message || 'Не удалось переименовать категорию', { variant: 'error' }))
      .finally(() => setEditingCatId(null));
  };

  const removeCat = async (c: HotelGalleryCategory) => {
    const ok = await showConfirm(`Удалить категорию «${c.name}»? Фото останутся, но станут без категории.`, {
      title: 'Удалить категорию',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    removeGalleryCategory(c.id)
      .then(() => {
        if (activeCategoryId === c.id) setActiveCategoryId('all');
        loadCategories();
        loadPhotos();
      })
      .catch((e) => showAlert(e.message || 'Не удалось удалить категорию', { variant: 'error' }));
  };

  const [editingPhoto, setEditingPhoto] = useState<HotelPhoto | null>(null);

  const handleUpload = (files: FileList) => {
    const categoryId = activeCategoryId === 'all' || activeCategoryId === 'none' ? undefined : activeCategoryId;
    setUploading(true);
    Promise.all(Array.from(files).map((file) => uploadGalleryPhoto(hotelId, file, { categoryId })))
      .then(() => loadPhotos())
      .catch((e) => showAlert(e.message || 'Не удалось загрузить фото', { variant: 'error' }))
      .finally(() => setUploading(false));
  };

  return (
    <div>
      <div className="htl-gallery-cats">
        <div className={`htl-gallery-cat${activeCategoryId === 'all' ? ' active' : ''}`} onClick={() => setActiveCategoryId('all')}>Все фото</div>
        <div className={`htl-gallery-cat${activeCategoryId === 'none' ? ' active' : ''}`} onClick={() => setActiveCategoryId('none')}>Без категории</div>
        {categories.map((c) => (
          <div
            key={c.id}
            className={`htl-gallery-cat${activeCategoryId === c.id ? ' active' : ''}`}
            onClick={() => setActiveCategoryId(c.id)}
          >
            {editingCatId === c.id ? (
              <input
                autoFocus
                defaultValue={c.name}
                style={{ width: 100, padding: '2px 4px', fontSize: 12.5, border: '1px solid var(--line-2)', borderRadius: 5 }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') renameCategory(c.id, (e.target as HTMLInputElement).value);
                  if (e.key === 'Escape') setEditingCatId(null);
                }}
                onBlur={(e) => renameCategory(c.id, e.target.value)}
              />
            ) : (
              <span onDoubleClick={(e) => { e.stopPropagation(); setEditingCatId(c.id); }} title="Двойной клик — переименовать">{c.name}</span>
            )}
            <button onClick={(e) => { e.stopPropagation(); removeCat(c); }} title="Удалить категорию" style={{ background: 'none', border: 'none', color: '#9a1f31', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}>×</button>
          </div>
        ))}
        {showAddCat ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input
              ref={newCatNameRef}
              autoFocus
              placeholder="Название категории"
              style={{ padding: '6px 10px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }}
              onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') setShowAddCat(false); }}
            />
            <button className="btn btn-sm" onClick={addCategory}>Добавить</button>
          </span>
        ) : (
          <button className="htl-gallery-add" onClick={() => setShowAddCat(true)}><Ic d={HTL_ICON.plus} size={12} />Категория</button>
        )}
      </div>

      <div
        className="htl-gallery-grid"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) handleUpload(e.dataTransfer.files); }}
      >
        {visiblePhotos.map((p) => (
          <div
            key={p.id}
            className="htl-gallery-thumb"
            style={{ backgroundImage: `url(${resolvePublicAssetUrl(p.url)})`, cursor: 'pointer' }}
            onClick={() => setEditingPhoto(p)}
          >
            <button onClick={(e) => { e.stopPropagation(); setEditingPhoto(p); }} title="Редактировать">
              <Ic d={HTL_ICON.pencil} size={11} />
            </button>
          </div>
        ))}
        <div className="htl-gallery-dropzone" onClick={() => addInputRef.current?.click()}>
          {uploading ? <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>Загрузка…</span> : '+'}
          <input
            ref={addInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.length) handleUpload(e.target.files); e.target.value = ''; }}
          />
        </div>
      </div>

      {editingPhoto && (
        <PhotoEditDrawer
          photo={editingPhoto}
          categories={categories}
          onClose={() => setEditingPhoto(null)}
          onSaved={loadPhotos}
          onDeleted={loadPhotos}
          showAlert={showAlert}
          showConfirm={showConfirm}
        />
      )}
    </div>
  );
};

const SettingsTab: React.FC<{ hotel: Hotel; onSaved: () => void }> = ({ hotel, onSaved }) => {
  const { showAlert } = useAlertModal();
  const [name, setName] = useState(hotel.name);
  const [checkIn, setCheckIn] = useState(hotel.checkInTime);
  const [checkOut, setCheckOut] = useState(hotel.checkOutTime);
  const [allowOverbooking, setAllowOverbooking] = useState(hotel.allowOverbooking);
  const [savingBasics, setSavingBasics] = useState(false);

  const [links, setLinks] = useState<Array<{ label: string; url: string }>>(hotel.quickLinks || []);
  const [savingLinks, setSavingLinks] = useState(false);

  const [feedToken, setFeedToken] = useState<string | null>(null);
  const [regeneratingToken, setRegeneratingToken] = useState(false);

  const [periodSummary, setPeriodSummary] = useState<HotelPeriodPriceSummaryRow[]>([]);

  useEffect(() => {
    setName(hotel.name);
    setCheckIn(hotel.checkInTime);
    setCheckOut(hotel.checkOutTime);
    setAllowOverbooking(hotel.allowOverbooking);
    setLinks(hotel.quickLinks || []);
  }, [hotel]);

  useEffect(() => {
    fetchFeedToken(hotel.id).then((r) => setFeedToken(r.token)).catch(() => {});
    fetchPeriodPriceSummary(hotel.id).then((r) => setPeriodSummary(r.rows)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotel.id]);

  const saveBasics = () => {
    setSavingBasics(true);
    updateHotel(hotel.id, { name, checkInTime: checkIn, checkOutTime: checkOut, allowOverbooking })
      .then(() => onSaved())
      .catch((e) => showAlert(e.message || 'Не удалось сохранить', { variant: 'error' }))
      .finally(() => setSavingBasics(false));
  };

  const saveLinks = (next: Array<{ label: string; url: string }>) => {
    setLinks(next);
    setSavingLinks(true);
    updateHotel(hotel.id, { quickLinks: next })
      .then(() => onSaved())
      .catch((e) => showAlert(e.message || 'Не удалось сохранить ссылки', { variant: 'error' }))
      .finally(() => setSavingLinks(false));
  };

  const addLink = () => setLinks((prev) => [...prev, { label: '', url: '' }]);
  const editLink = (i: number, patch: Partial<{ label: string; url: string }>) => {
    setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };
  const commitLinks = () => saveLinks(links);
  const removeLink = (i: number) => saveLinks(links.filter((_, idx) => idx !== i));

  const regenerateToken = () => {
    setRegeneratingToken(true);
    regenerateFeedToken(hotel.id)
      .then((r) => setFeedToken(r.token))
      .catch((e) => showAlert(e.message || 'Не удалось обновить токен', { variant: 'error' }))
      .finally(() => setRegeneratingToken(false));
  };

  const feedBase = `${window.location.origin}/v1/public/hotel-feed/${hotel.id}/${feedToken || '…'}`;

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text)
      .then(() => showAlert('Ссылка скопирована', { variant: 'success' }))
      .catch(() => showAlert('Не удалось скопировать', { variant: 'error' }));
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="ha-section-head" style={{ marginBottom: 10 }}>
        <div className="sub" style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 12.5 }}>Основное</div>
      </div>
      <label style={{ fontSize: 11, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>Название отеля</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 8, marginBottom: 12 }}
      />
      <div className="bk-row2">
        <div>
          <label style={{ fontSize: 11, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>Заезд с</label>
          <input
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 8 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>Выезд до</label>
          <input
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 8 }}
          />
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12.5, cursor: 'pointer' }}>
        <input type="checkbox" checked={allowOverbooking} onChange={(e) => setAllowOverbooking(e.target.checked)} />
        Разрешить овербукинг (отключает проверку доступности номеров при создании броней)
      </label>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" disabled={savingBasics} onClick={saveBasics}>
          <Ic d={HTL_ICON.check} size={14} />Сохранить
        </button>
      </div>

      <div className="ha-section-head" style={{ marginTop: 28, marginBottom: 10 }}>
        <div>
          <div className="sub" style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 12.5 }}>Быстрые ссылки</div>
          <div className="sub" style={{ marginTop: 2 }}>Google, TripAdvisor, Booking.com и другие страницы отеля</div>
        </div>
      </div>
      {links.map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            placeholder="Название"
            value={l.label}
            onChange={(e) => editLink(i, { label: e.target.value })}
            onBlur={commitLinks}
            style={{ flex: '0 0 160px', padding: '8px 10px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }}
          />
          <input
            placeholder="https://…"
            value={l.url}
            onChange={(e) => editLink(i, { url: e.target.value })}
            onBlur={commitLinks}
            style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5 }}
          />
          {l.url && (
            <a href={l.url} target="_blank" rel="noreferrer" className="btn btn-sm" title="Открыть ссылку">
              Открыть
            </a>
          )}
          <button
            style={{ background: 'none', border: 'none', color: '#9a1f31', cursor: 'pointer' }}
            onClick={() => removeLink(i)}
            title="Удалить"
            disabled={savingLinks}
          >
            <Ic d={HTL_ICON.x} size={14} />
          </button>
        </div>
      ))}
      <button className="htl-gallery-add" onClick={addLink}><Ic d={HTL_ICON.plus} size={12} />Добавить ссылку</button>

      <div className="ha-section-head" style={{ marginTop: 28, marginBottom: 10 }}>
        <div>
          <div className="sub" style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 12.5 }}>XML/JSON лента (номера и цены)</div>
          <div className="sub" style={{ marginTop: 2 }}>
            Публичная ссылка для партнёров/каналов — доступна без входа в CRM, только по этому токену.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <code style={{ flex: 1, fontSize: 11, padding: '8px 10px', background: 'var(--bg-muted)', borderRadius: 7, overflowX: 'auto', whiteSpace: 'nowrap' }}>
          {feedBase}/json
        </code>
        <button className="btn btn-sm" disabled={!feedToken} onClick={() => copy(`${feedBase}/json`)}>Копировать</button>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <code style={{ flex: 1, fontSize: 11, padding: '8px 10px', background: 'var(--bg-muted)', borderRadius: 7, overflowX: 'auto', whiteSpace: 'nowrap' }}>
          {feedBase}/xml
        </code>
        <button className="btn btn-sm" disabled={!feedToken} onClick={() => copy(`${feedBase}/xml`)}>Копировать</button>
      </div>
      <button className="btn btn-sm" disabled={regeneratingToken} onClick={regenerateToken}>
        Обновить токен (старые ссылки перестанут работать)
      </button>

      <div className="ha-section-head" style={{ marginTop: 28, marginBottom: 10 }}>
        <div>
          <div className="sub" style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 12.5 }}>Средняя цена по периодам</div>
          <div className="sub" style={{ marginTop: 2 }}>Прайсовая Net PP из «Цены и рынки», по базовому типу номера</div>
        </div>
      </div>
      <div className="pace-table-wrap">
        <table className="pace-table">
          <thead>
            <tr><th>Период</th><th>Средняя цена</th></tr>
          </thead>
          <tbody>
            {periodSummary.map((p) => (
              <tr key={p.periodId}>
                <td>{p.startDate} – {p.endDate}</td>
                <td>{p.avgNetPP.toFixed(2)} €</td>
              </tr>
            ))}
            {periodSummary.length === 0 && (
              <tr><td colSpan={2} style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>Нет периодов — задайте их в «Цены и рынки»</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const HotelDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { showAlert } = useAlertModal();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [roomTypes, setRoomTypes] = useState<HotelRoomType[]>([]);
  const [tab, setTab] = useState<Tab>('rooms');
  const coverInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    if (!id) return;
    fetchHotel(id)
      .then((h) => setHotel(h))
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

  if (!hotel) return null;

  return (
    <MainLayout>
      <div className="px-scope">
        <HotelsSubnav active="hotels" />
        <div
          className="htl-detail-cover"
          style={hotel.coverPhotoUrl ? { backgroundImage: `url(${resolvePublicAssetUrl(hotel.coverPhotoUrl)})` } : undefined}
        >
          <div style={{ background: 'rgba(255,255,255,.92)', borderRadius: 10, padding: '8px 14px' }}>
            <div style={{ fontFamily: 'var(--ff-display)', fontWeight: 600, fontSize: 16 }}>{hotel.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
              {[hotel.city, hotel.country].filter(Boolean).join(', ')} · {hotel.stars}★ · {totalRooms} номеров
            </div>
          </div>
          <button className="htl-cover-upload-btn" onClick={() => coverInputRef.current?.click()}>
            <Ic d={HTL_ICON.pencil} size={12} />Фото
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                uploadHotelCover(hotel.id, file)
                  .then(() => load())
                  .catch((e2) => showAlert(e2.message || 'Не удалось загрузить фото', { variant: 'error' }));
              }
              e.target.value = '';
            }}
          />
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
          <div className={`htl-detail-tab${tab === 'info' ? ' active' : ''}`} onClick={() => setTab('info')}>Информация об отеле</div>
          <div className={`htl-detail-tab${tab === 'gallery' ? ' active' : ''}`} onClick={() => setTab('gallery')}>Галерея</div>
          <div className={`htl-detail-tab${tab === 'settings' ? ' active' : ''}`} onClick={() => setTab('settings')}>Настройки отеля</div>
        </div>

        {tab === 'rooms' && <RoomsTab hotelId={hotel.id} roomTypes={roomTypes} onChanged={load} />}
        {tab === 'calendar' && <HotelPricingCalendar roomTypes={roomTypes} />}
        {tab === 'markets' && <MarketsTab hotelId={hotel.id} roomTypes={roomTypes} />}
        {tab === 'info' && <HotelInfoTab hotel={hotel} onSaved={load} />}
        {tab === 'gallery' && <HotelGalleryTab hotelId={hotel.id} />}
        {tab === 'settings' && <SettingsTab hotel={hotel} onSaved={load} />}
      </div>
    </MainLayout>
  );
};
