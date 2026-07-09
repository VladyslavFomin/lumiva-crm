// src/pages/products/ProductImportPage.tsx
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  previewProductImport,
  applyProductImport,
  type ProductImportPreview,
  type ProductImportResult,
} from '../../api/products';

const INK = '#222';
const FG3 = '#888';
const LINE = '#e7e7e7';
const BG_MUTED = '#fafafa';

const inpCls =
  'px-3 py-2 text-[13px] rounded-[10px] border border-[#e7e7e7] bg-white outline-none focus:border-[#222] transition-colors text-[#222]';

export const ProductImportPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ProductImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [updateExisting, setUpdateExisting] = useState(true);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<ProductImportResult | null>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const res = await previewProductImport(file);
      setPreview(res);
      setMapping(res.suggestedMapping || {});
    } catch (err: any) {
      showAlert(err.message || t('crm.products.import.errors.previewFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleApply = async () => {
    if (!preview) return;
    setApplying(true);
    try {
      const res = await applyProductImport({ importId: preview.importId, mapping, updateExisting });
      setResult(res);
    } catch (err: any) {
      showAlert(err.message || t('crm.products.import.errors.applyFailed'), { variant: 'error' });
    } finally {
      setApplying(false);
    }
  };

  return (
    <MainLayout>
      <div style={{ color: INK }}>
        <div style={{ borderBottom: `1px solid ${LINE}`, paddingBottom: 20, marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => navigate('/products')}
            style={{ fontSize: 11, color: FG3, letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            ← {t('crm.products.list.title')}
          </button>
          <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 10 }}>{t('crm.products.import.title')}</h1>
          <div style={{ fontSize: 13, color: FG3, marginTop: 6 }}>{t('crm.products.import.subtitle')}</div>
        </div>

        {result ? (
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 24, maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 14 }}>{t('crm.products.import.resultTitle')}</div>
            <div style={{ fontSize: 13, color: FG3, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>{t('crm.products.import.resultCreated', { count: result.created })}</div>
              <div>{t('crm.products.import.resultUpdated', { count: result.updated })}</div>
              <div>{t('crm.products.import.resultErrors', { count: result.errors.length })}</div>
            </div>
            {!!result.errors.length && (
              <div style={{ marginTop: 14, maxHeight: 200, overflowY: 'auto', border: `1px solid ${LINE}`, borderRadius: 8, padding: 10 }}>
                {result.errors.map((e, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#9a1f31', marginBottom: 4 }}>
                    {t('crm.products.import.errors.applyFailed')} — {e.row}: {e.message}
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => navigate('/products')}
              style={{ marginTop: 18, padding: '8px 20px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: `1px solid ${INK}`, background: INK, color: '#fff', cursor: 'pointer' }}
            >
              {t('crm.products.import.close')}
            </button>
          </div>
        ) : !preview ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${LINE}`, borderRadius: 16, padding: '64px 24px', textAlign: 'center',
              cursor: 'pointer', background: BG_MUTED, color: FG3, fontSize: 14,
            }}
          >
            {loading ? t('crm.common.loading') : t('crm.products.import.dropHint')}
            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                style={{ padding: '8px 20px', fontSize: 13, borderRadius: 8, border: `1px solid ${INK}`, background: '#fff', color: INK, cursor: 'pointer' }}
              >
                {t('crm.products.import.chooseFile')}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: FG3, marginBottom: 12 }}>
              {preview.totalRows} {t('crm.products.list.columns.name')}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>{t('crm.products.import.mappingTitle')}</div>
            <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: BG_MUTED, borderBottom: `1px solid ${LINE}` }}>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, textTransform: 'uppercase', color: FG3 }}>{t('crm.products.import.fieldHeader')}</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, textTransform: 'uppercase', color: FG3 }}>{t('crm.products.import.columnHeader')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.mappableFields.map((f) => (
                    <tr key={f.key} style={{ borderBottom: `1px solid ${LINE}` }}>
                      <td style={{ padding: '8px 14px' }}>{f.label}</td>
                      <td style={{ padding: '8px 14px' }}>
                        <select
                          className={inpCls}
                          value={mapping[f.key] || ''}
                          onChange={(e) => setMapping((p) => ({ ...p, [f.key]: e.target.value || null }))}
                        >
                          <option value="">—</option>
                          {preview.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 20 }}>
              <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
              {t('crm.products.import.updateExistingLabel')}
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => { setPreview(null); setMapping({}); }}
                style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: FG3, cursor: 'pointer' }}
              >
                {t('crm.products.import.back')}
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={applying}
                style={{ padding: '8px 20px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: `1px solid ${INK}`, background: INK, color: '#fff', cursor: 'pointer', opacity: applying ? 0.65 : 1 }}
              >
                {applying ? t('crm.products.import.applying') : t('crm.products.import.applyButton')}
              </button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
