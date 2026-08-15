import React, { useRef, useState } from 'react';
import { resolvePublicAssetUrl } from '../../api/client';
import { Ic, HTL_ICON } from './HotelIcons';
import {
  updateGalleryPhoto,
  replaceGalleryPhoto,
  removeGalleryPhoto,
  type HotelPhoto,
  type HotelGalleryCategory,
} from '../../api/hotels';

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se';

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** Правая выезжающая панель для одной фотографии галереи: смена категории (если применимо —
 * галерея номера категорий не имеет), обрезка/уменьшение через canvas (без внешних библиотек —
 * ни одной в проекте нет) и удаление. Общий для галереи отеля и галереи типа номера. */
export const PhotoEditDrawer: React.FC<{
  photo: HotelPhoto;
  categories?: HotelGalleryCategory[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  showAlert: (message: string, opts?: { variant?: 'error' | 'success' }) => void;
  showConfirm: (message: string, opts?: { title?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
}> = ({ photo, categories, onClose, onSaved, onDeleted, showAlert, showConfirm }) => {
  const [categoryId, setCategoryId] = useState<string>(photo.categoryId || '');
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, w: 1, h: 1 });
  const [maxWidth, setMaxWidth] = useState('');
  const [saving, setSaving] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number; start: CropRect } | null>(null);

  const src = resolvePublicAssetUrl(photo.url) || photo.url;

  const onPointerDown = (mode: DragMode) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, start: crop };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragRef.current.startX) / rect.width;
    const dy = (e.clientY - dragRef.current.startY) / rect.height;
    const s = dragRef.current.start;
    const mode = dragRef.current.mode;
    let next: CropRect = { ...s };
    if (mode === 'move') {
      next.x = clamp(s.x + dx, 0, 1 - s.w);
      next.y = clamp(s.y + dy, 0, 1 - s.h);
    } else {
      if (mode.includes('w')) {
        const nx = clamp(s.x + dx, 0, s.x + s.w - 0.05);
        next.w = s.w - (nx - s.x);
        next.x = nx;
      }
      if (mode.includes('e')) {
        next.w = clamp(s.w + dx, 0.05, 1 - s.x);
      }
      if (mode.includes('n')) {
        const ny = clamp(s.y + dy, 0, s.y + s.h - 0.05);
        next.h = s.h - (ny - s.y);
        next.y = ny;
      }
      if (mode.includes('s')) {
        next.h = clamp(s.h + dy, 0.05, 1 - s.y);
      }
    }
    setCrop(next);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const resetCrop = () => setCrop({ x: 0, y: 0, w: 1, h: 1 });

  const applyAndSave = async () => {
    setSaving(true);
    try {
      const isFullCrop = crop.x === 0 && crop.y === 0 && crop.w === 1 && crop.h === 1;
      if (!isFullCrop || maxWidth) {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Не удалось загрузить изображение'));
          img.src = src;
        });
        const sx = crop.x * img.naturalWidth;
        const sy = crop.y * img.naturalHeight;
        const sw = crop.w * img.naturalWidth;
        const sh = crop.h * img.naturalHeight;
        const targetW = maxWidth ? Math.min(Number(maxWidth), sw) : sw;
        const targetH = sh * (targetW / sw);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(targetW));
        canvas.height = Math.max(1, Math.round(targetH));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas недоступен в этом браузере');
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        const blob: Blob = await new Promise((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось сохранить изображение'))), 'image/jpeg', 0.9),
        );
        await replaceGalleryPhoto(photo.id, blob);
      }
      if (categories && categoryId !== (photo.categoryId || '')) {
        await updateGalleryPhoto(photo.id, { categoryId: categoryId || null });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      showAlert(e.message || 'Не удалось сохранить', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await showConfirm('Удалить это фото? Действие нельзя отменить.', {
      title: 'Удалить фото',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    removeGalleryPhoto(photo.id)
      .then(() => {
        onDeleted();
        onClose();
      })
      .catch((e) => showAlert(e.message || 'Не удалось удалить', { variant: 'error' }));
  };

  const corners: DragMode[] = ['nw', 'ne', 'sw', 'se'];

  return (
    <div className="px-scope">
      <div className="bk-drawer-back" onClick={onClose} />
      <div className="bk-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="bk-drawer-head">
          <h3>Редактировать фото</h3>
          <button onClick={onClose}><Ic d={HTL_ICON.x} size={16} /></button>
        </div>
        <div className="bk-drawer-body">
          <div
            ref={boxRef}
            style={{ position: 'relative', width: '100%', userSelect: 'none', background: '#111', borderRadius: 10, overflow: 'hidden', touchAction: 'none' }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <img src={src} alt="" style={{ width: '100%', display: 'block' }} draggable={false} />
            <div
              onPointerDown={onPointerDown('move')}
              style={{
                position: 'absolute',
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
                border: '2px solid #fff',
                boxShadow: '0 0 0 2000px rgba(0,0,0,.45)',
                cursor: 'move',
              }}
            >
              {corners.map((corner) => (
                <div
                  key={corner}
                  onPointerDown={onPointerDown(corner)}
                  style={{
                    position: 'absolute',
                    width: 12,
                    height: 12,
                    background: '#fff',
                    borderRadius: 3,
                    cursor: `${corner}-resize`,
                    ...(corner.includes('n') ? { top: -6 } : { bottom: -6 }),
                    ...(corner.includes('w') ? { left: -6 } : { right: -6 }),
                  }}
                />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>Перетащите рамку или её углы, чтобы обрезать</span>
            <button className="btn btn-sm" onClick={resetCrop}>Сбросить обрезку</button>
          </div>

          <label style={{ fontSize: 11, color: 'var(--fg-3)', display: 'block', marginTop: 16, marginBottom: 4 }}>
            Уменьшить ширину до, px (необязательно)
          </label>
          <input
            type="number"
            value={maxWidth}
            onChange={(e) => setMaxWidth(e.target.value)}
            placeholder="например, 1200"
            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 8 }}
          />

          {categories && (
            <>
              <label style={{ fontSize: 11, color: 'var(--fg-3)', display: 'block', marginTop: 16, marginBottom: 4 }}>Категория</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line-2)', borderRadius: 8 }}
              >
                <option value="">Без категории</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
        <div className="bk-modal-foot" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button className="btn" style={{ color: '#9a1f31' }} onClick={handleDelete}>Удалить фото</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onClose}>Отмена</button>
            <button className="btn btn-primary" disabled={saving} onClick={applyAndSave}>
              <Ic d={HTL_ICON.check} size={14} />Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
