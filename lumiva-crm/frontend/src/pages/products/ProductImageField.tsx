// src/pages/products/ProductImageField.tsx
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolvePublicAssetUrl } from '../../api/client';
import { uploadProductImage, type ProductImage } from '../../api/products';

const INK = '#222';
const FG3 = '#888';
const FG4 = '#b5b5b5';
const LINE = '#e7e7e7';
const BG_MUTED = '#fafafa';

const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';

function Thumb({ image, onRemove, onSetCover, isCover }: {
  image: ProductImage;
  onRemove: () => void;
  onSetCover?: () => void;
  isCover?: boolean;
}) {
  const src = resolvePublicAssetUrl(image.url) || image.url;
  return (
    <div
      style={{
        position: 'relative', aspectRatio: '1 / 1', borderRadius: 9,
        background: BG_MUTED, border: `1px solid ${LINE}`, overflow: 'hidden',
      }}
    >
      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      {onSetCover && (
        <button
          type="button"
          onClick={onSetCover}
          title="cover"
          style={{
            position: 'absolute', bottom: 4, left: 4, fontSize: 9, padding: '2px 6px', borderRadius: 999,
            border: 'none', cursor: 'pointer',
            background: isCover ? INK : 'rgba(255,255,255,0.9)', color: isCover ? '#fff' : FG3,
          }}
        >
          ★
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        style={{
          position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

/** Загрузка одного изображения (главное фото товара, поле типа "media"). */
export const ProductImageField: React.FC<{
  value: ProductImage | null;
  onChange: (value: ProductImage | null) => void;
  onError?: (message: string) => void;
}> = ({ value, onChange, onError }) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const { url } = await uploadProductImage(file);
      onChange({ url });
    } catch (err: any) {
      onError?.(err.message || t('crm.products.form.errors.saveFailed'));
    } finally {
      setUploading(false);
    }
  };

  if (value) {
    return (
      <div style={{ width: 140 }}>
        <Thumb image={value} onRemove={() => onChange(null)} />
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
      style={{
        width: 140, aspectRatio: '1 / 1', borderRadius: 9, border: `1.5px dashed ${LINE}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4,
        cursor: 'pointer', color: FG3, fontSize: 11, textAlign: 'center', padding: 8,
      }}
    >
      {uploading ? t('crm.common.loading') : t('crm.products.form.fields.uploadImage')}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
};

/** Загрузка нескольких изображений (галерея). */
export const ProductGalleryField: React.FC<{
  value: ProductImage[];
  onChange: (value: ProductImage[]) => void;
  onError?: (message: string) => void;
}> = ({ value, onChange, onError }) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList) => {
    setUploading(true);
    try {
      const uploaded: ProductImage[] = [];
      for (const file of Array.from(files)) {
        const { url } = await uploadProductImage(file);
        uploaded.push({ url });
      }
      onChange([...value, ...uploaded]);
    } catch (err: any) {
      onError?.(err.message || t('crm.products.form.errors.saveFailed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, maxWidth: 480 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
      }}
    >
      {value.map((img, i) => (
        <Thumb key={i} image={img} onRemove={() => onChange(value.filter((_, idx) => idx !== i))} />
      ))}
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          aspectRatio: '1 / 1', borderRadius: 9, border: `1.5px dashed ${LINE}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: FG4, fontSize: 20,
        }}
      >
        {uploading ? <span style={{ fontSize: 11, color: FG3 }}>{t('crm.common.loading')}</span> : '+'}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
};
