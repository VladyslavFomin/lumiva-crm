// src/pages/sales/SalesImportPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  previewSalesImport,
  applySalesImport,
  type ImportPreviewResponse,
  type ImportSystemField,
} from '../../api/imports';
import {
  fetchSalesChannels,
  type SalesChannel,
} from '../../api/salesChannels';
import { getLocale } from '../../i18n/utils';

const SYSTEM_FIELDS: ImportSystemField[] = [
  'purchaseDate',
  'customerName',
  'quantity',
  'type',
  'category',
  'size',
  'color',
  'url',
  'currency',
  'country',
];

type FieldMappingState = Record<ImportSystemField, string>;

export const SalesImportPage: React.FC = () => {
  const { t } = useTranslation();
  const locale = getLocale();
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [mapping, setMapping] = useState<FieldMappingState>(() =>
    Object.fromEntries(SYSTEM_FIELDS.map((f) => [f.key, ''])) as FieldMappingState,
  );
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const fieldLabels = useMemo(
    () =>
      Object.fromEntries(
        SYSTEM_FIELDS.map((key) => [
          key,
          t(`crm.salesImport.fields.${key}`),
        ]),
      ) as Record<ImportSystemField, string>,
    [t],
  );

  // Load channels for import mapping.
  useEffect(() => {
    let alive = true;

    fetchSalesChannels()
      .then((items) => {
        if (!alive) return;
        setChannels(items.filter((c) => !c.isDeleted));
      })
      .catch((e: any) => {
        console.error(e);
      });

    return () => {
      alive = false;
    };
  }, []);

  const columns = preview?.columns || [];

  // How many system fields are mapped.
  const mappedCount = useMemo(
    () =>
      SYSTEM_FIELDS.filter((key) => mapping[key] && mapping[key] !== '').length,
    [mapping],
  );

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(null);
    setError(null);
    setInfo(null);
    if (f) {
      setFileName(f.name);
    } else {
      setFileName('');
    }
  };

  const handlePreview = async () => {
    if (!file) {
      setError(t('crm.salesImport.errors.missingFile'));
      return;
    }
    setError(null);
    setInfo(null);
    setLoadingPreview(true);
    setPreview(null);

    try {
      const res = await previewSalesImport(file);
      setPreview(res);

      // Initialize mapping: use suggestedMapping when available.
      const initial: FieldMappingState = Object.fromEntries(
        SYSTEM_FIELDS.map((key) => {
          const suggested =
            res.suggestedMapping?.[key] ||
            res.suggestedMapping?.[key.toString()] ||
            '';
          return [key, suggested || ''];
        }),
      ) as FieldMappingState;

      setMapping(initial);
      setInfo(
        t('crm.salesImport.preview.summary', {
          rows: res.totalRows.toLocaleString(locale),
          columns: res.columns.length,
        }),
      );
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.salesImport.errors.preview'));
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleMappingChange = (field: ImportSystemField, column: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: column,
    }));
  };

  const handleApply = async () => {
    if (!preview || !preview.importId) {
      setError(t('crm.salesImport.errors.previewRequired'));
      return;
    }

    setError(null);
    setInfo(null);
    setApplying(true);

    try {
      const payload = {
        importId: preview.importId,
        channelId: selectedChannelId || undefined,
        fieldMapping: mapping,
      };

      const res = await applySalesImport(payload);
      const msg =
        res.message ||
        t('crm.salesImport.apply.summary', {
          created: res.created,
          skipped: res.skipped,
        });

      setInfo(msg);
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.salesImport.errors.apply'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        {/* Заголовок */}
        <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              {t('crm.salesImport.kicker')}
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              {t('crm.salesImport.title')}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {t('crm.salesImport.subtitle')}
            </p>
            <div className="flex flex-col items-stretch gap-2 md:items-end">
              <button
                type="button"
                onClick={() =>
                  (window.location.href = '/app/sales/integrations/new')
                }
                className="px-3 py-1.5 rounded-xl bg-lumiva-accent text-slate-950 text-[11px] font-semibold hover:bg-lumiva-accent-soft transition-colors"
              >
                {t('crm.salesImport.actions.newChannel')}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-start gap-1 text-[11px] text-slate-300">
            <span className="px-2 py-1 rounded-full bg-slate-900/80 border border-slate-800/80">
              {t('crm.salesImport.fileLabel', {
                name: fileName || t('crm.salesImport.fileNone'),
              })}
            </span>
            {preview && (
              <span className="px-2 py-1 rounded-full bg-slate-900/80 border border-slate-800/80">
                {t('crm.salesImport.previewMeta', {
                  rows: preview.totalRows.toLocaleString(locale),
                  columns: preview.columns.length,
                })}
              </span>
            )}
          </div>
        </section>

        {/* Блок выбора файла + канал */}
        <section className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)] gap-4">
            <div className="space-y-2">
              <label className="block text-[11px] text-slate-400 mb-1">
                {t('crm.salesImport.fileInputLabel')}
              </label>
              <input
                type="file"
                accept=".csv,.xml,text/csv,application/xml,text/xml"
                onChange={handleFileChange}
                className="block w-full text-[11px] text-slate-100
                           file:mr-3 file:py-1.5 file:px-3
                           file:rounded-xl file:border-0
                           file:bg-lumiva-accent file:text-slate-950
                           file:text-[11px] file:font-semibold
                           hover:file:bg-lumiva-accent-soft"
              />
              <p className="text-[10px] text-slate-500">
                {t('crm.salesImport.fileHint')}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] text-slate-400 mb-1">
                {t('crm.salesImport.channelLabel')}
              </label>
              <select
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                className="w-full h-8 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
              >
                <option value="">
                  {t('crm.salesImport.channelPlaceholder')}
                </option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500">
                {t('crm.salesImport.channelHint')}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handlePreview}
              disabled={loadingPreview || !file}
              className="px-4 py-1.5 rounded-xl bg-lumiva-accent text-slate-950 text-[11px] font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
            >
              {loadingPreview
                ? t('crm.salesImport.actions.previewing')
                : t('crm.salesImport.actions.preview')}
            </button>
          </div>
        </section>

        {/* Маппинг полей */}
        {preview && (
          <section className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  {t('crm.salesImport.mapping.title')}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {t('crm.salesImport.mapping.subtitle')}
                </p>
              </div>
              <div className="text-[11px] text-slate-300">
                {t('crm.salesImport.mapping.count', {
                  mapped: mappedCount,
                  total: SYSTEM_FIELDS.length,
                })}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] md:text-xs border-separate border-spacing-y-1">
                <thead className="text-slate-500">
                  <tr>
                    <th className="text-left font-normal px-2 py-1">
                      {t('crm.salesImport.mapping.headers.crmField')}
                    </th>
                    <th className="text-left font-normal px-2 py-1">
                      {t('crm.salesImport.mapping.headers.fileColumn')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SYSTEM_FIELDS.map((field) => (
                    <tr
                      key={field}
                      className="bg-slate-950/80 hover:bg-slate-900/80 transition-colors"
                    >
                      <td className="px-2 py-1.5 text-slate-100 whitespace-nowrap">
                        {fieldLabels[field]}
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={mapping[field] || ''}
                          onChange={(e) =>
                            handleMappingChange(field, e.target.value)
                          }
                          className="w-full h-7 rounded-lg bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-2 outline-none"
                        >
                          <option value="">
                            {t('crm.salesImport.mapping.skip')}
                          </option>
                          {columns.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Пример данных */}
            <div className="mt-3">
              <h3 className="text-[11px] font-semibold text-slate-200 mb-1">
                {t('crm.salesImport.sample.title')}
              </h3>
              {preview.sample && preview.sample.length ? (
                <div className="overflow-x-auto border border-slate-800/80 rounded-2xl">
                  <table className="min-w-full text-[10px] border-collapse">
                    <thead className="bg-slate-950/80 text-slate-400">
                      <tr>
                        {columns.map((col) => (
                          <th
                            key={col}
                            className="px-2 py-1 border-b border-slate-800/80 text-left"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sample.map((row, idx) => (
                        <tr
                          key={idx}
                          className={
                            idx % 2 === 0
                              ? 'bg-slate-950/60'
                              : 'bg-slate-900/60'
                          }
                        >
                          {columns.map((col) => (
                            <td
                              key={col}
                              className="px-2 py-1 border-b border-slate-900/60 text-slate-200 whitespace-nowrap"
                            >
                              {row[col] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 italic">
                  {t('crm.salesImport.sample.empty')}
                </div>
              )}
            </div>

            {/* Кнопка импорта */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleApply}
                disabled={applying}
              className="px-4 py-1.5 rounded-xl bg-lumiva-accent text-slate-950 text-[11px] font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
            >
              {applying
                ? t('crm.salesImport.actions.applying')
                : t('crm.salesImport.actions.apply')}
            </button>
          </div>
        </section>
        )}

        {/* уведомления */}
        {(error || info) && (
          <div className="fixed inset-x-0 bottom-3 flex justify-center pointer-events-none">
            {error && (
              <div className="px-3 py-1.5 rounded-full bg-red-950/95 border border-red-700/80 text-[11px] text-red-100">
                {error}
              </div>
            )}
            {info && !error && (
              <div className="px-3 py-1.5 rounded-full bg-slate-950/95 border border-slate-700/80 text-[11px] text-slate-100">
                {info}
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};
