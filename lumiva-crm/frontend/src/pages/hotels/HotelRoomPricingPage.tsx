import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { resolvePublicAssetUrl } from '../../api/client';
import { HotelsSubnav } from './HotelsSubnav';
import { Ic, HTL_ICON } from './HotelIcons';
import { PhotoEditDrawer } from './PhotoEditDrawer';
import {
  fetchRoomType,
  updateRoomType,
  updateRoomTypeInfo,
  fetchRoomPricing,
  fetchOccupancyTypes,
  createOccupancyType,
  updateOccupancyType,
  deleteOccupancyType,
  setOccupancyOverride,
  fetchHotel,
  previewRoomPricingImport,
  applyRoomPricingImport,
  fetchGalleryPhotos,
  uploadGalleryPhoto,
  type HotelRoomType,
  type HotelRoomPricing,
  type HotelRoomOccupancyType,
  type HotelRoomPricingImportPreview,
  type HotelPhoto,
} from '../../api/hotels';
import './hotels-design.css';

const RoomGalleryTab: React.FC<{ hotelId: string; roomTypeId: string }> = ({ hotelId, roomTypeId }) => {
  const { showAlert, showConfirm } = useAlertModal();
  const [photos, setPhotos] = useState<HotelPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<HotelPhoto | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    fetchGalleryPhotos(hotelId, { roomTypeId })
      .then(setPhotos)
      .catch((e) => showAlert(e.message || 'Не удалось загрузить фото', { variant: 'error' }));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId, roomTypeId]);

  const handleUpload = (files: FileList) => {
    setUploading(true);
    Promise.all(Array.from(files).map((file) => uploadGalleryPhoto(hotelId, file, { roomTypeId })))
      .then(() => load())
      .catch((e) => showAlert(e.message || 'Не удалось загрузить фото', { variant: 'error' }))
      .finally(() => setUploading(false));
  };

  return (
    <div>
      <div
        className="htl-gallery-grid"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) handleUpload(e.dataTransfer.files); }}
      >
        {photos.map((p) => (
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
          onClose={() => setEditingPhoto(null)}
          onSaved={load}
          onDeleted={load}
          showAlert={showAlert}
          showConfirm={showConfirm}
        />
      )}
    </div>
  );
};

function fmtEUR(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

const INFO_FIELDS: Array<{ key: string; label: string; type: 'text' | 'bool' }> = [
  { key: 'qty', label: 'Количество номеров', type: 'text' },
  { key: 'area', label: 'м²', type: 'text' },
  { key: 'capacity', label: 'Вместимость', type: 'text' },
  { key: 'layout', label: 'В номере', type: 'text' },
  { key: 'accessible', label: 'Для гостей с ОВ', type: 'text' },
  { key: 'bed', label: 'Тип кровати', type: 'text' },
  { key: 'balcony', label: 'Балкон или терраса', type: 'bool' },
  { key: 'shower', label: 'Душ / душевая кабина', type: 'bool' },
  { key: 'jacuzzi', label: 'Джакузи', type: 'bool' },
  { key: 'bath', label: 'Ванная', type: 'bool' },
  { key: 'toilet', label: 'Туалет', type: 'bool' },
  { key: 'livingArea', label: 'Гостиная зона', type: 'bool' },
  { key: 'workArea', label: 'Рабочая зона', type: 'bool' },
  { key: 'safe', label: 'Электронный сейф (бесплатно)', type: 'bool' },
  { key: 'phone', label: 'Телефон', type: 'bool' },
  { key: 'tv', label: 'ЖК ТВ (спутниковое)', type: 'bool' },
  { key: 'musicCh', label: 'Музыкальные каналы (по ТВ)', type: 'bool' },
  { key: 'minibar', label: 'Минибар (бесплатно)', type: 'bool' },
  { key: 'floor', label: 'Половое покрытие', type: 'text' },
  { key: 'turndown', label: 'Turn-down сервис', type: 'bool' },
  { key: 'robe', label: 'Халат', type: 'bool' },
  { key: 'slippers', label: 'Тапочки', type: 'bool' },
  { key: 'dryer', label: 'Фен', type: 'bool' },
  { key: 'wifi', label: 'Беспроводной интернет в номере', type: 'bool' },
  { key: 'ac', label: 'Кондиционер', type: 'text' },
  { key: 'kettle', label: 'Чайник', type: 'bool' },
  { key: 'teaCoffee', label: 'Чай, кофе', type: 'bool' },
  { key: 'nespresso', label: 'Кофемашина Nespresso', type: 'bool' },
  { key: 'cleaning', label: 'Уборка номера', type: 'text' },
  { key: 'linen', label: 'Смена белья и полотенец', type: 'text' },
  { key: 'view', label: 'Вид', type: 'text' },
];

const InfoTab: React.FC<{ roomType: HotelRoomType; onSaved: () => void }> = ({ roomType, onSaved }) => {
  const { showAlert } = useAlertModal();
  const [data, setData] = useState<Record<string, string | boolean>>(roomType.infoFields || {});

  useEffect(() => setData(roomType.infoFields || {}), [roomType]);

  const update = (key: string, val: string | boolean) => {
    const next = { ...data, [key]: val };
    setData(next);
    updateRoomTypeInfo(roomType.id, { [key]: val }).then(onSaved).catch((e) => showAlert(e.message || 'Не удалось сохранить', { variant: 'error' }));
  };

  return (
    <div className="occ-wrap">
      <table className="occ-table info-table">
        <tbody>
          {INFO_FIELDS.map((f) => (
            <tr key={f.key}>
              <td className="occ-name" style={{ width: 260 }}>{f.label}</td>
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
  );
};

export const HotelRoomPricingPage: React.FC = () => {
  const { roomTypeId } = useParams<{ roomTypeId: string }>();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlertModal();
  const [roomType, setRoomType] = useState<HotelRoomType | null>(null);
  const [hotelName, setHotelName] = useState('');
  const [pricing, setPricing] = useState<HotelRoomPricing | null>(null);
  const [occupancyTypes, setOccupancyTypes] = useState<HotelRoomOccupancyType[]>([]);
  const [tab, setTab] = useState<'pricing' | 'info' | 'gallery'>('pricing');
  const [offset, setOffset] = useState('0');
  const [showImport, setShowImport] = useState(false);
  const [editingCell, setEditingCell] = useState<{ occId: string; periodId: string } | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = () => {
    if (!roomTypeId) return;
    fetchRoomType(roomTypeId)
      .then((rt) => {
        setRoomType(rt);
        setOffset(rt.ppNetOffset);
        return fetchHotel(rt.hotelId);
      })
      .then((h) => setHotelName(h.name))
      .catch((e) => showAlert(e.message || 'Не удалось загрузить номер', { variant: 'error' }));
    fetchOccupancyTypes(roomTypeId)
      .then(setOccupancyTypes)
      .catch((e) => showAlert(e.message || 'Не удалось загрузить размещения', { variant: 'error' }));
  };

  useEffect(() => {
    load();
    setSelectedRows([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomTypeId]);

  useEffect(() => {
    if (!roomType) return;
    fetchRoomPricing(roomType.hotelId, roomType.id)
      .then(setPricing)
      .catch((e) => showAlert(e.message || 'Не удалось рассчитать цены', { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomType]);

  const saveOffset = () => {
    if (!roomType) return;
    updateRoomType(roomType.id, { ppNetOffset: offset })
      .then(() => load())
      .catch((e) => showAlert(e.message || 'Не удалось сохранить', { variant: 'error' }));
  };

  const updateCoef = (id: string, coefficient: string) => {
    updateOccupancyType(id, { coefficient })
      .then(() => {
        load();
        if (roomType) fetchRoomPricing(roomType.hotelId, roomType.id).then(setPricing);
      })
      .catch((e) => showAlert(e.message || 'Не удалось сохранить', { variant: 'error' }));
  };

  const reloadPricing = () => {
    if (roomType) fetchRoomPricing(roomType.hotelId, roomType.id).then(setPricing);
  };

  const saveOverride = (occId: string, periodId: string, value: string) => {
    const price = value.trim() === '' ? null : value.trim();
    setOccupancyOverride(occId, periodId, price)
      .then(() => reloadPricing())
      .catch((e) => showAlert(e.message || 'Не удалось сохранить цену', { variant: 'error' }))
      .finally(() => setEditingCell(null));
  };

  const renameOccupancyRow = (id: string, label: string) => {
    if (!label.trim()) return;
    updateOccupancyType(id, { label })
      .then(() => {
        load();
        reloadPricing();
      })
      .catch((e) => showAlert(e.message || 'Не удалось переименовать', { variant: 'error' }));
  };

  const removeOccupancyRow = async (row: { id: string; label: string }) => {
    const ok = await showConfirm(`Удалить строку размещения «${row.label}»?`, {
      title: 'Удалить размещение',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    deleteOccupancyType(row.id)
      .then(() => {
        load();
        reloadPricing();
      })
      .catch((e) => showAlert(e.message || 'Не удалось удалить строку', { variant: 'error' }));
  };

  const toggleRowSelected = (id: string) =>
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAllSelected = () => {
    if (!pricing) return;
    const allIds = pricing.occupancyRows.map((r) => r.id);
    setSelectedRows((prev) => (prev.length === allIds.length ? [] : allIds));
  };

  const bulkDeleteRows = async () => {
    if (!selectedRows.length) return;
    const ok = await showConfirm(
      `Удалить ${selectedRows.length} строк${selectedRows.length === 1 ? 'у' : ''} размещения? Это действие нельзя отменить.`,
      { title: 'Удалить выбранные строки', confirmLabel: 'Удалить', danger: true },
    );
    if (!ok) return;
    setBulkDeleting(true);
    Promise.all(selectedRows.map((id) => deleteOccupancyType(id)))
      .then(() => {
        setSelectedRows([]);
        load();
        reloadPricing();
      })
      .catch((e) => showAlert(e.message || 'Не удалось удалить строки', { variant: 'error' }))
      .finally(() => setBulkDeleting(false));
  };

  const addRow = () => {
    if (!roomTypeId || !roomType) return;
    createOccupancyType(roomTypeId, {
      label: 'Новое размещение',
      coefficient: roomType.pricingMode === 'fixed_rate' ? '25' : '2',
      paidChildCount: 0,
      sortOrder: occupancyTypes.length,
    })
      .then(() => load())
      .catch((e) => showAlert(e.message || 'Не удалось добавить строку', { variant: 'error' }));
  };

  if (!roomType || !pricing) return null;
  const isFixedRate = roomType.pricingMode === 'fixed_rate';

  return (
    <MainLayout>
      <div className="px-scope">
        <HotelsSubnav active="hotels" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />РЕДАКТИРОВАНИЕ НОМЕРА</div>
            <h1>Редактировать номер</h1>
            <p className="sub">Периоды и базовая цена (PP Net) берутся из «Цены и рынки». Цена = PP Net этого номера × коэффициент размещения.</p>
          </div>
          <div className="htl-hero-r">
            <div style={{ fontSize: 13, fontWeight: 500, alignSelf: 'center' }}>{hotelName} · {roomType.name}</div>
            <button className="btn" onClick={() => setShowImport(true)}><Ic d={HTL_ICON.download} size={13} />Импорт Excel</button>
            <button className="btn" onClick={() => navigate('/hotels/pricing')}><Ic d={HTL_ICON.settings} size={13} />Цены и рынки</button>
          </div>
        </div>

        <div className="htl-detail-tabs" style={{ marginTop: 16 }}>
          <div className={`htl-detail-tab${tab === 'pricing' ? ' active' : ''}`} onClick={() => setTab('pricing')}>Цены с размещением</div>
          <div className={`htl-detail-tab${tab === 'info' ? ' active' : ''}`} onClick={() => setTab('info')}>Информация по номеру</div>
          <div className={`htl-detail-tab${tab === 'gallery' ? ' active' : ''}`} onClick={() => setTab('gallery')}>Галерея</div>
        </div>

        {tab === 'info' ? (
          <InfoTab roomType={roomType} onSaved={load} />
        ) : tab === 'gallery' ? (
          <RoomGalleryTab hotelId={roomType.hotelId} roomTypeId={roomType.id} />
        ) : (
          <>
            {!isFixedRate && (
              <div className="pp-offset-box">
                <span style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>
                  Базовая цена (PP Net) из «Цены и рынки»:{' '}
                  <b style={{ color: 'var(--ink)', fontFamily: 'var(--ff-mono)' }}>
                    {pricing.periods.length ? `${Math.min(...pricing.periods.map((p) => p.referenceNetPP))}–${Math.max(...pricing.periods.map((p) => p.referenceNetPP))} €` : '—'}
                  </b>
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>·</span>
                <span style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>Разница цены относительно базы:</span>
                <input value={offset} onChange={(e) => setOffset(e.target.value)} onBlur={saveOffset} />
                <span style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>€ / ночь</span>
                <span style={{ fontSize: 11, color: 'var(--fg-3)', marginLeft: 'auto' }}>
                  Итоговый PP Net для {roomType.name}:{' '}
                  <b style={{ color: 'var(--ink)', fontFamily: 'var(--ff-mono)' }}>
                    {pricing.periods.length ? `${Math.min(...pricing.periods.map((p) => p.effectiveBasePP))}–${Math.max(...pricing.periods.map((p) => p.effectiveBasePP))} €` : '—'}
                  </b>
                </span>
              </div>
            )}

            <div className="occ-wrap">
              <table className="occ-table">
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width: 30 }}>
                      <input
                        type="checkbox"
                        checked={selectedRows.length > 0 && selectedRows.length === pricing.occupancyRows.length}
                        onChange={toggleAllSelected}
                        title="Выбрать все"
                      />
                    </th>
                    <th className="occ-h" rowSpan={2}>{roomType.name}</th>
                    <th rowSpan={2}>{isFixedRate ? 'Коэф.' : 'Коэф.'}</th>
                    <th rowSpan={2}>Paid C.</th>
                    {pricing.periods.map((p) => <th key={p.id}>{p.startDate}</th>)}
                  </tr>
                  <tr className="range2">
                    {pricing.periods.map((p) => <th key={p.id}>{p.endDate}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr className="pp-row">
                    <td></td>
                    <td className="occ-name">{!isFixedRate && Number(offset) !== 0 ? 'PP Net (база + разница)' : 'PP Net (база)'}</td>
                    <td></td><td></td>
                    {pricing.periods.map((p) => <td key={p.id}>{fmtEUR(p.effectiveBasePP)}</td>)}
                  </tr>
                  {pricing.occupancyRows.map((row) => (
                    <tr key={row.id} className={selectedRows.includes(row.id) ? 'occ-row-selected' : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(row.id)}
                          onChange={() => toggleRowSelected(row.id)}
                        />
                      </td>
                      <td className="occ-name">
                        {editingLabelId === row.id ? (
                          <input
                            autoFocus
                            defaultValue={row.label}
                            style={{ width: '100%' }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') renameOccupancyRow(row.id, (e.target as HTMLInputElement).value);
                              if (e.key === 'Escape') setEditingLabelId(null);
                            }}
                            onBlur={(e) => {
                              renameOccupancyRow(row.id, e.target.value);
                              setEditingLabelId(null);
                            }}
                          />
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <span style={{ cursor: 'pointer' }} onClick={() => setEditingLabelId(row.id)} title="Переименовать">{row.label}</span>
                            <button
                              style={{ background: 'none', border: 'none', color: '#9a1f31', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}
                              title="Удалить строку"
                              onClick={() => removeOccupancyRow(row)}
                            >
                              ×
                            </button>
                          </span>
                        )}
                      </td>
                      <td className="coef-cell">
                        <input defaultValue={row.coefficient} onBlur={(e) => updateCoef(row.id, e.target.value)} />
                      </td>
                      <td>{row.paidChildCount}</td>
                      {pricing.periods.map((p) => {
                        const isEditing = editingCell?.occId === row.id && editingCell?.periodId === p.id;
                        const isOverridden = row.overriddenPeriods.includes(p.id);
                        return (
                          <td
                            key={p.id}
                            className="price-cell"
                            style={isOverridden ? { background: '#fff8e1' } : undefined}
                            title={isOverridden ? 'Ручное значение — переопределяет расчёт по коэффициенту' : 'Рассчитано по коэффициенту'}
                            onClick={() => setEditingCell({ occId: row.id, periodId: p.id })}
                          >
                            {isEditing ? (
                              <input
                                autoFocus
                                defaultValue={row.pricesByPeriod[p.id] ?? 0}
                                style={{ width: 64, textAlign: 'center', fontFamily: 'var(--ff-mono)', fontSize: 11 }}
                                onBlur={(e) => saveOverride(row.id, p.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                              />
                            ) : (
                              fmtEUR(row.pricesByPeriod[p.id] || 0)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="occ-add-row">
              <button className="btn btn-sm" onClick={addRow}><Ic d={HTL_ICON.plus} size={13} />Добавить тип размещения</button>
              <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                Периоды синхронизированы с «Цены и рынки» — новые периоды добавляются там. Жёлтые ячейки —
                вручную заданные цены (переопределяют расчёт по коэффициенту); очистите значение, чтобы вернуть расчёт по формуле.
              </span>
            </div>
          </>
        )}
      </div>

      {selectedRows.length > 0 && (
        <div className="px-scope">
          <div className="bk-bulkbar">
            <div className="bk-bulkbar-count"><strong>{selectedRows.length}</strong> ВЫБРАНО</div>
            <div className="bk-bulkbar-divider" />
            <button type="button" className="bk-bulkbar-btn danger" disabled={bulkDeleting} onClick={bulkDeleteRows}>
              <Ic d={HTL_ICON.x} size={13} />Удалить выбранные
            </button>
            <div className="bk-bulkbar-divider" />
            <button type="button" className="bk-bulkbar-close" onClick={() => setSelectedRows([])} aria-label="Снять выбор">×</button>
          </div>
        </div>
      )}

      {showImport && (
        <RoomPricingImportModal
          hotelId={roomType.hotelId}
          roomTypeId={roomType.id}
          onClose={() => setShowImport(false)}
          onDone={() => {
            setShowImport(false);
            reloadPricing();
          }}
        />
      )}
    </MainLayout>
  );
};

const RoomPricingImportModal: React.FC<{
  hotelId: string;
  roomTypeId: string;
  onClose: () => void;
  onDone: () => void;
}> = ({ hotelId, roomTypeId, onClose, onDone }) => {
  const { showAlert } = useAlertModal();
  const [preview, setPreview] = useState<HotelRoomPricingImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    cellsSet: number;
    errors: Array<{ row: number; message: string }>;
    total: number;
    occupancyRowsCreated: string[];
  } | null>(null);

  const handleFile = (file: File) => {
    setBusy(true);
    previewRoomPricingImport(file)
      .then(setPreview)
      .catch((e) => showAlert(e.message || 'Не удалось прочитать файл', { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  const handleApply = () => {
    if (!preview) return;
    setBusy(true);
    applyRoomPricingImport({ importId: preview.importId, hotelId, roomTypeId })
      .then(setResult)
      .catch((e) => showAlert(e.message || 'Не удалось применить импорт', { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bk-modal-head">
          <h3>Импорт цен с размещением</h3>
          <button onClick={onClose}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="bk-modal-body">
          {!preview && !result && (
            <div style={{ border: '1.5px dashed var(--line-2)', borderRadius: 12, padding: '28px 20px', textAlign: 'center', color: 'var(--fg-3)' }}>
              <Ic d={HTL_ICON.download} size={22} style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: 13, marginBottom: 4 }}>Загрузите лист «Цены с размещением»</div>
              <div style={{ fontSize: 11.5 }}>
                Формат: строка дат начала периода, строка дат конца периода (по колонкам), затем строки размещений
                (SGL, 2 AD, ...) со значениями по тем же колонкам. Строка "PP in DBL"/базовая цена игнорируется —
                она берётся из «Цены и рынки». Периоды должны уже существовать на странице «Цены и рынки» (по датам) —
                создайте их там, если нет. Строки размещений, которых ещё нет на этой странице, будут созданы
                автоматически.
              </div>
              <label className="btn btn-sm" style={{ marginTop: 14, display: 'inline-flex', cursor: 'pointer' }}>
                Выбрать файл
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>
            </div>
          )}
          {preview && !result && (
            <div style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>
              Найдено периодов: <b style={{ color: 'var(--ink)' }}>{preview.periods.length}</b> ({preview.periods.map((p) => `${p.startDate}–${p.endDate}`).join(', ')}).<br />
              Найдено строк размещения: <b style={{ color: 'var(--ink)' }}>{preview.occupancyLabels.length}</b> ({preview.occupancyLabels.join(', ')}).
            </div>
          )}
          {result && (
            <div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>Обновлено <b>{result.cellsSet}</b> ячеек из {result.total} строк размещения.</div>
              {result.occupancyRowsCreated.length > 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--fg-3)', marginBottom: 8 }}>
                  Созданы новые строки размещения: {result.occupancyRowsCreated.join(', ')}.
                </div>
              )}
              {result.errors.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 12, color: '#cc2f47' }}>
                  {result.errors.map((e, i) => <div key={i}>{e.row ? `Строка ${e.row}: ` : ''}{e.message}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>{result ? 'Закрыть' : 'Отмена'}</button>
          {preview && !result && <button className="btn btn-primary" disabled={busy} onClick={handleApply}><Ic d={HTL_ICON.check} size={14} />Загрузить</button>}
          {result && <button className="btn btn-primary" onClick={onDone}>Готово</button>}
        </div>
      </div>
    </div>
  );
};
