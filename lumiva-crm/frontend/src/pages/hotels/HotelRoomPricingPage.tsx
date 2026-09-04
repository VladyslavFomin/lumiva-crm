import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
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
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();
  const [photos, setPhotos] = useState<HotelPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<HotelPhoto | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    fetchGalleryPhotos(hotelId, { roomTypeId })
      .then(setPhotos)
      .catch((e) => showAlert(e.message || t('crm.hotels.roomPricing.gallery.loadError'), { variant: 'error' }));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId, roomTypeId]);

  const handleUpload = (files: FileList) => {
    setUploading(true);
    Promise.all(Array.from(files).map((file) => uploadGalleryPhoto(hotelId, file, { roomTypeId })))
      .then(() => load())
      .catch((e) => showAlert(e.message || t('crm.hotels.roomPricing.gallery.uploadError'), { variant: 'error' }))
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
            <button onClick={(e) => { e.stopPropagation(); setEditingPhoto(p); }} title={t('crm.hotels.roomPricing.gallery.edit')}>
              <Ic d={HTL_ICON.pencil} size={11} />
            </button>
          </div>
        ))}
        <div className="htl-gallery-dropzone" onClick={() => addInputRef.current?.click()}>
          {uploading ? <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{t('crm.hotels.roomPricing.gallery.uploading')}</span> : '+'}
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

const INFO_FIELD_KEYS: Array<{ key: string; type: 'text' | 'bool' }> = [
  { key: 'qty', type: 'text' },
  { key: 'area', type: 'text' },
  { key: 'capacity', type: 'text' },
  { key: 'layout', type: 'text' },
  { key: 'accessible', type: 'text' },
  { key: 'bed', type: 'text' },
  { key: 'balcony', type: 'bool' },
  { key: 'shower', type: 'bool' },
  { key: 'jacuzzi', type: 'bool' },
  { key: 'bath', type: 'bool' },
  { key: 'toilet', type: 'bool' },
  { key: 'livingArea', type: 'bool' },
  { key: 'workArea', type: 'bool' },
  { key: 'safe', type: 'bool' },
  { key: 'phone', type: 'bool' },
  { key: 'tv', type: 'bool' },
  { key: 'musicCh', type: 'bool' },
  { key: 'minibar', type: 'bool' },
  { key: 'floor', type: 'text' },
  { key: 'turndown', type: 'bool' },
  { key: 'robe', type: 'bool' },
  { key: 'slippers', type: 'bool' },
  { key: 'dryer', type: 'bool' },
  { key: 'wifi', type: 'bool' },
  { key: 'ac', type: 'text' },
  { key: 'kettle', type: 'bool' },
  { key: 'teaCoffee', type: 'bool' },
  { key: 'nespresso', type: 'bool' },
  { key: 'cleaning', type: 'text' },
  { key: 'linen', type: 'text' },
  { key: 'view', type: 'text' },
];

const InfoTab: React.FC<{ roomType: HotelRoomType; onSaved: () => void }> = ({ roomType, onSaved }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const [data, setData] = useState<Record<string, string | boolean>>(roomType.infoFields || {});

  useEffect(() => setData(roomType.infoFields || {}), [roomType]);

  const update = (key: string, val: string | boolean) => {
    const next = { ...data, [key]: val };
    setData(next);
    updateRoomTypeInfo(roomType.id, { [key]: val }).then(onSaved).catch((e) => showAlert(e.message || t('crm.hotels.roomPricing.saveError'), { variant: 'error' }));
  };

  return (
    <div className="occ-wrap">
      <table className="occ-table info-table">
        <tbody>
          {INFO_FIELD_KEYS.map((f) => (
            <tr key={f.key}>
              <td className="occ-name" style={{ width: 260 }}>{t(`crm.hotels.roomPricing.infoFields.${f.key}`)}</td>
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
  const { t } = useTranslation();
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
      .catch((e) => showAlert(e.message || t('crm.hotels.roomPricing.loadRoomError'), { variant: 'error' }));
    fetchOccupancyTypes(roomTypeId)
      .then(setOccupancyTypes)
      .catch((e) => showAlert(e.message || t('crm.hotels.roomPricing.loadOccupancyError'), { variant: 'error' }));
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
      .catch((e) => showAlert(e.message || t('crm.hotels.roomPricing.calcError'), { variant: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomType]);

  const saveOffset = () => {
    if (!roomType) return;
    updateRoomType(roomType.id, { ppNetOffset: offset })
      .then(() => load())
      .catch((e) => showAlert(e.message || t('crm.hotels.roomPricing.saveError'), { variant: 'error' }));
  };

  const updateCoef = (id: string, coefficient: string) => {
    updateOccupancyType(id, { coefficient })
      .then(() => {
        load();
        if (roomType) fetchRoomPricing(roomType.hotelId, roomType.id).then(setPricing);
      })
      .catch((e) => showAlert(e.message || t('crm.hotels.roomPricing.saveError'), { variant: 'error' }));
  };

  const reloadPricing = () => {
    if (roomType) fetchRoomPricing(roomType.hotelId, roomType.id).then(setPricing);
  };

  const saveOverride = (occId: string, periodId: string, value: string) => {
    const price = value.trim() === '' ? null : value.trim();
    setOccupancyOverride(occId, periodId, price)
      .then(() => reloadPricing())
      .catch((e) => showAlert(e.message || t('crm.hotels.roomPricing.saveCellError'), { variant: 'error' }))
      .finally(() => setEditingCell(null));
  };

  const renameOccupancyRow = (id: string, label: string) => {
    if (!label.trim()) return;
    updateOccupancyType(id, { label })
      .then(() => {
        load();
        reloadPricing();
      })
      .catch((e) => showAlert(e.message || t('crm.hotels.roomPricing.renameError'), { variant: 'error' }));
  };

  const removeOccupancyRow = async (row: { id: string; label: string }) => {
    const ok = await showConfirm(t('crm.hotels.roomPricing.deleteRowConfirm.body', { label: row.label }), {
      title: t('crm.hotels.roomPricing.deleteRowConfirm.title'),
      confirmLabel: t('crm.hotels.roomPricing.deleteRowConfirm.confirmLabel'),
      danger: true,
    });
    if (!ok) return;
    deleteOccupancyType(row.id)
      .then(() => {
        load();
        reloadPricing();
      })
      .catch((e) => showAlert(e.message || t('crm.hotels.roomPricing.deleteRowError'), { variant: 'error' }));
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
      t(selectedRows.length === 1 ? 'crm.hotels.roomPricing.bulkDeleteConfirm.bodyOne' : 'crm.hotels.roomPricing.bulkDeleteConfirm.bodyOther', { count: selectedRows.length }),
      { title: t('crm.hotels.roomPricing.bulkDeleteConfirm.title'), confirmLabel: t('crm.hotels.roomPricing.bulkDeleteConfirm.confirmLabel'), danger: true },
    );
    if (!ok) return;
    setBulkDeleting(true);
    Promise.all(selectedRows.map((id) => deleteOccupancyType(id)))
      .then(() => {
        setSelectedRows([]);
        load();
        reloadPricing();
      })
      .catch((e) => showAlert(e.message || t('crm.hotels.roomPricing.deleteRowsError'), { variant: 'error' }))
      .finally(() => setBulkDeleting(false));
  };

  const addRow = () => {
    if (!roomTypeId || !roomType) return;
    createOccupancyType(roomTypeId, {
      label: t('crm.hotels.roomPricing.newRowLabel'),
      coefficient: roomType.pricingMode === 'fixed_rate' ? '25' : '2',
      paidChildCount: 0,
      sortOrder: occupancyTypes.length,
    })
      .then(() => load())
      .catch((e) => showAlert(e.message || t('crm.hotels.roomPricing.addRowError'), { variant: 'error' }));
  };

  if (!roomType || !pricing) return null;
  const isFixedRate = roomType.pricingMode === 'fixed_rate';

  return (
    <MainLayout>
      <PageHelpButton topic="hotelPricing" />
      <div className="px-scope">
        <HotelsSubnav active="hotels" />
        <div className="htl-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.hotels.roomPricing.kicker')}</div>
            <h1>{t('crm.hotels.roomPricing.title')}</h1>
            <p className="sub">{t('crm.hotels.roomPricing.subtitle')}</p>
          </div>
          <div className="htl-hero-r">
            <div style={{ fontSize: 13, fontWeight: 500, alignSelf: 'center' }}>{hotelName} · {roomType.name}</div>
            <button className="btn" onClick={() => setShowImport(true)}><Ic d={HTL_ICON.download} size={13} />{t('crm.hotels.roomPricing.importBtn')}</button>
            <button className="btn" onClick={() => navigate('/hotels/pricing')}><Ic d={HTL_ICON.settings} size={13} />{t('crm.hotels.roomPricing.marketPricingBtn')}</button>
          </div>
        </div>

        <div className="htl-detail-tabs" style={{ marginTop: 16 }}>
          <div className={`htl-detail-tab${tab === 'pricing' ? ' active' : ''}`} onClick={() => setTab('pricing')}>{t('crm.hotels.roomPricing.tabs.pricing')}</div>
          <div className={`htl-detail-tab${tab === 'info' ? ' active' : ''}`} onClick={() => setTab('info')}>{t('crm.hotels.roomPricing.tabs.info')}</div>
          <div className={`htl-detail-tab${tab === 'gallery' ? ' active' : ''}`} onClick={() => setTab('gallery')}>{t('crm.hotels.roomPricing.tabs.gallery')}</div>
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
                  {t('crm.hotels.roomPricing.offsetBox.basePriceLabel')}{' '}
                  <b style={{ color: 'var(--ink)', fontFamily: 'var(--ff-mono)' }}>
                    {pricing.periods.length ? `${Math.min(...pricing.periods.map((p) => p.referenceNetPP))}–${Math.max(...pricing.periods.map((p) => p.referenceNetPP))} €` : '—'}
                  </b>
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>·</span>
                <span style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>{t('crm.hotels.roomPricing.offsetBox.diffLabel')}</span>
                <input value={offset} onChange={(e) => setOffset(e.target.value)} onBlur={saveOffset} />
                <span style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>{t('crm.hotels.roomPricing.offsetBox.perNight')}</span>
                <span style={{ fontSize: 11, color: 'var(--fg-3)', marginLeft: 'auto' }}>
                  {t('crm.hotels.roomPricing.offsetBox.totalLabel', { name: roomType.name })}{' '}
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
                        title={t('crm.hotels.roomPricing.table.selectAll')}
                      />
                    </th>
                    <th className="occ-h" rowSpan={2}>{roomType.name}</th>
                    <th rowSpan={2}>{t('crm.hotels.roomPricing.table.coefficient')}</th>
                    <th rowSpan={2}>{t('crm.hotels.roomPricing.table.paidChildren')}</th>
                    {pricing.periods.map((p) => <th key={p.id}>{p.startDate}</th>)}
                  </tr>
                  <tr className="range2">
                    {pricing.periods.map((p) => <th key={p.id}>{p.endDate}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr className="pp-row">
                    <td></td>
                    <td className="occ-name">{!isFixedRate && Number(offset) !== 0 ? t('crm.hotels.roomPricing.table.ppNetBaseWithDiff') : t('crm.hotels.roomPricing.table.ppNetBase')}</td>
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
                            <span style={{ cursor: 'pointer' }} onClick={() => setEditingLabelId(row.id)} title={t('crm.hotels.roomPricing.table.rename')}>{row.label}</span>
                            <button
                              style={{ background: 'none', border: 'none', color: '#9a1f31', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}
                              title={t('crm.hotels.roomPricing.table.deleteRow')}
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
                            title={isOverridden ? t('crm.hotels.roomPricing.table.manualOverrideTitle') : t('crm.hotels.roomPricing.table.calculatedTitle')}
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
              <button className="btn btn-sm" onClick={addRow}><Ic d={HTL_ICON.plus} size={13} />{t('crm.hotels.roomPricing.addRow')}</button>
              <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                {t('crm.hotels.roomPricing.footnote')}
              </span>
            </div>
          </>
        )}
      </div>

      {selectedRows.length > 0 && (
        <div className="px-scope">
          <div className="bk-bulkbar">
            <div className="bk-bulkbar-count"><strong>{selectedRows.length}</strong> {t('crm.hotels.roomPricing.bulkbar.selected')}</div>
            <div className="bk-bulkbar-divider" />
            <button type="button" className="bk-bulkbar-btn danger" disabled={bulkDeleting} onClick={bulkDeleteRows}>
              <Ic d={HTL_ICON.x} size={13} />{t('crm.hotels.roomPricing.bulkbar.deleteSelected')}
            </button>
            <div className="bk-bulkbar-divider" />
            <button type="button" className="bk-bulkbar-close" onClick={() => setSelectedRows([])} aria-label={t('crm.hotels.roomPricing.bulkbar.closeAria')}>×</button>
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
  const { t } = useTranslation();
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
      .catch((e) => showAlert(e.message || t('crm.hotels.roomPricing.importModal.readError'), { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  const handleApply = () => {
    if (!preview) return;
    setBusy(true);
    applyRoomPricingImport({ importId: preview.importId, hotelId, roomTypeId })
      .then(setResult)
      .catch((e) => showAlert(e.message || t('crm.hotels.roomPricing.importModal.applyError'), { variant: 'error' }))
      .finally(() => setBusy(false));
  };

  return (
    <div className="px-scope">
      <div className="bk-modal-back" onClick={onClose} />
      <div className="bk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bk-modal-head">
          <h3>{t('crm.hotels.roomPricing.importModal.title')}</h3>
          <button onClick={onClose}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="bk-modal-body">
          {!preview && !result && (
            <div style={{ border: '1.5px dashed var(--line-2)', borderRadius: 12, padding: '28px 20px', textAlign: 'center', color: 'var(--fg-3)' }}>
              <Ic d={HTL_ICON.download} size={22} style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: 13, marginBottom: 4 }}>{t('crm.hotels.roomPricing.importModal.dropHint')}</div>
              <div style={{ fontSize: 11.5 }}>
                {t('crm.hotels.roomPricing.importModal.formatHint')}
              </div>
              <label className="btn btn-sm" style={{ marginTop: 14, display: 'inline-flex', cursor: 'pointer' }}>
                {t('crm.hotels.roomPricing.importModal.chooseFile')}
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
              {t('crm.hotels.roomPricing.importModal.foundPeriods')} <b style={{ color: 'var(--ink)' }}>{preview.periods.length}</b> ({preview.periods.map((p) => `${p.startDate}–${p.endDate}`).join(', ')}).<br />
              {t('crm.hotels.roomPricing.importModal.foundOccupancy')} <b style={{ color: 'var(--ink)' }}>{preview.occupancyLabels.length}</b> ({preview.occupancyLabels.join(', ')}).
            </div>
          )}
          {result && (
            <div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>{t('crm.hotels.roomPricing.importModal.updatedPrefix')} <b>{result.cellsSet}</b> {t('crm.hotels.roomPricing.importModal.updatedSuffix', { total: result.total })}</div>
              {result.occupancyRowsCreated.length > 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--fg-3)', marginBottom: 8 }}>
                  {t('crm.hotels.roomPricing.importModal.createdRows', { names: result.occupancyRowsCreated.join(', ') })}
                </div>
              )}
              {result.errors.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 12, color: '#cc2f47' }}>
                  {result.errors.map((e, i) => <div key={i}>{e.row ? t('crm.hotels.roomPricing.importModal.rowError', { row: e.row, message: e.message }) : t('crm.hotels.roomPricing.importModal.rowErrorNoRow', { message: e.message })}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="bk-modal-foot">
          <button className="btn" onClick={onClose}>{result ? t('crm.hotels.roomPricing.importModal.close') : t('crm.hotels.roomPricing.importModal.cancel')}</button>
          {preview && !result && <button className="btn btn-primary" disabled={busy} onClick={handleApply}><Ic d={HTL_ICON.check} size={14} />{t('crm.hotels.roomPricing.importModal.upload')}</button>}
          {result && <button className="btn btn-primary" onClick={onDone}>{t('crm.hotels.roomPricing.importModal.done')}</button>}
        </div>
      </div>
    </div>
  );
};
