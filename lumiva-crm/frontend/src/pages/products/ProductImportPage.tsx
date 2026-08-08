// src/pages/products/ProductImportPage.tsx
import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  previewProductImport,
  applyProductImport,
  createProductFieldDef,
  type ProductImportPreview,
  type ProductImportResult,
} from '../../api/products';
import './products-design.css';

const EXTRA_PRICE_MARKER = 'extraPrice';

export const ProductImportPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert } = useAlertModal();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ProductImportPreview | null>(null);
  // По колонке файла — какое поле товара она заполняет (обратное направление от того, что
  // хранит бэкенд: он ждёт fieldKey → column, здесь удобнее вести column → fieldKey, чтобы
  // на одну строку таблицы приходилась одна колонка файла — см. обсуждение с клиентом).
  const [columnToField, setColumnToField] = useState<Record<string, string>>({});
  // Для колонок в режиме "доп. цена в валюте" — сам код валюты, вводится отдельно от select.
  const [columnCurrency, setColumnCurrency] = useState<Record<string, string>>({});
  const [mappableFields, setMappableFields] = useState<Array<{ key: string; label: string }>>([]);
  const [creatingForColumn, setCreatingForColumn] = useState<string | null>(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<ProductImportResult | null>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const res = await previewProductImport(file);
      setPreview(res);
      setMappableFields(res.mappableFields);
      const inverted: Record<string, string> = {};
      for (const [fieldKey, column] of Object.entries(res.suggestedMapping || {})) {
        if (column) inverted[column] = fieldKey;
      }
      setColumnToField(inverted);
      setColumnCurrency({});
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

  const handleCreateField = async (column: string) => {
    setCreatingForColumn(column);
    try {
      const created = await createProductFieldDef({ label: column, type: 'text' });
      setMappableFields((prev) => [...prev, { key: created.key, label: created.label }]);
      setColumnToField((prev) => ({ ...prev, [column]: created.key }));
    } catch (err: any) {
      showAlert(err.message || t('crm.products.import.errors.createFieldFailed'), { variant: 'error' });
    } finally {
      setCreatingForColumn(null);
    }
  };

  const mappedCount = useMemo(
    () => (preview ? preview.columns.filter((c) => columnToField[c]).length : 0),
    [preview, columnToField],
  );

  const handleApply = async () => {
    if (!preview) return;
    setApplying(true);
    try {
      const mapping: Record<string, string | null> = {};
      for (const [column, fieldKey] of Object.entries(columnToField)) {
        if (!fieldKey) continue;
        if (fieldKey === EXTRA_PRICE_MARKER) {
          const code = (columnCurrency[column] || '').trim().toUpperCase();
          if (/^[A-Z]{3}$/.test(code)) mapping[`extraPrice:${code}`] = column;
          continue;
        }
        mapping[fieldKey] = column;
      }
      const res = await applyProductImport({ importId: preview.importId, mapping, updateExisting });
      setResult(res);
    } catch (err: any) {
      showAlert(err.message || t('crm.products.import.errors.applyFailed'), { variant: 'error' });
    } finally {
      setApplying(false);
    }
  };

  const resetPreview = () => {
    setPreview(null);
    setColumnToField({});
    setColumnCurrency({});
    setMappableFields([]);
    setResult(null);
  };

  return (
    <MainLayout>
      <div className="px-scope">
        <button type="button" className="px-back" onClick={() => navigate('/products')}>
          ← {t('crm.products.list.title')}
        </button>
        <div className="px-head">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.products.list.title')}</div>
            <h1>{t('crm.products.import.title')}</h1>
            <p className="sub">{t('crm.products.import.subtitle')}</p>
          </div>
        </div>

        {result ? (
          <div className="an-panel" style={{ maxWidth: 480 }}>
            <div className="an-panel-head"><div className="t">{t('crm.products.import.resultTitle')}</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--fg-2)' }}>
              <div>{t('crm.products.import.resultCreated', { count: result.created })}</div>
              <div>{t('crm.products.import.resultUpdated', { count: result.updated })}</div>
              <div>{t('crm.products.import.resultErrors', { count: result.errors.length })}</div>
              {!!result.createdFieldLabels?.length && (
                <div>{t('crm.products.import.resultFieldsCreated', { count: result.createdFieldLabels.length })}: {result.createdFieldLabels.join(', ')}</div>
              )}
            </div>
            {!!result.errors.length && (
              <div style={{ marginTop: 14, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--line-2)', borderRadius: 8, padding: 10 }}>
                {result.errors.map((e, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#9a1f31', marginBottom: 4 }}>
                    {t('crm.products.import.errors.applyFailed')} — {e.row}: {e.message}
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="aib" style={{ marginTop: 16 }} onClick={() => navigate('/products')}>
              {t('crm.products.import.close')}
            </button>
          </div>
        ) : !preview ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed var(--line-2)', borderRadius: 16, padding: '64px 24px', textAlign: 'center',
              cursor: 'pointer', background: 'var(--bg-muted)', color: 'var(--fg-3)', fontSize: 14,
            }}
          >
            {loading ? t('crm.common.loading') : t('crm.products.import.dropHint')}
            <div style={{ marginTop: 14 }}>
              <button type="button" className="aib ghost" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
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
            <div style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 4 }}>
              {t('crm.products.import.columnsRows', { columns: preview.columns.length, rows: preview.totalRows })}
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 16 }}>
              {t('crm.products.import.mappedCount', { mapped: mappedCount, total: preview.columns.length })}
            </div>

            <div className="px-toolbar" style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{t('crm.products.import.mappingTitle')}</div>
            </div>
            <div className="px-table-wrap" style={{ marginBottom: 20 }}>
              <table className="px-table">
                <thead>
                  <tr>
                    <th>{t('crm.products.import.columnHeader')}</th>
                    <th>{t('crm.products.import.fieldHeader')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {preview.columns.map((column) => {
                    const mappedKey = columnToField[column] || '';
                    const isExtraPrice = mappedKey === EXTRA_PRICE_MARKER;
                    return (
                      <tr key={column}>
                        <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={column}>
                          {column}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                            <select
                              className="ai-select"
                              style={{ minWidth: 200 }}
                              value={mappedKey}
                              onChange={(e) => setColumnToField((p) => ({ ...p, [column]: e.target.value }))}
                            >
                              <option value="">{t('crm.products.import.notMapped')}</option>
                              {mappableFields.map((f) => (
                                <option key={f.key} value={f.key}>{f.label}</option>
                              ))}
                              <option value={EXTRA_PRICE_MARKER}>{t('crm.products.import.extraPriceOption')}</option>
                            </select>
                            {isExtraPrice && (
                              <input
                                className="ai-input"
                                style={{ width: 90 }}
                                maxLength={3}
                                placeholder={t('crm.products.import.extraPriceCodePlaceholder') || ''}
                                value={columnCurrency[column] || ''}
                                onChange={(e) =>
                                  setColumnCurrency((p) => ({ ...p, [column]: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) }))
                                }
                              />
                            )}
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="tb-icon-btn"
                            onClick={() => handleCreateField(column)}
                            disabled={creatingForColumn === column}
                          >
                            {creatingForColumn === column ? t('crm.products.import.creatingField') : t('crm.products.import.createField')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 20, color: 'var(--fg-2)' }}>
              <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
              {t('crm.products.import.updateExistingLabel')}
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="aib ghost" onClick={resetPreview}>
                {t('crm.products.import.back')}
              </button>
              <button type="button" className="aib" onClick={handleApply} disabled={applying}>
                {applying ? t('crm.products.import.applying') : t('crm.products.import.applyButton')}
              </button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
