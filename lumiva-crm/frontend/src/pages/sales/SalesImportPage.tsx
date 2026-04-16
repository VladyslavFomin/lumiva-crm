// src/pages/sales/SalesImportPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import {
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';
import { getLocale } from '../../i18n/utils';

const BASE_FIELDS: ImportSystemField[] = [
  'orderId',
  'productId',
  'purchaseDate',
  'updatedAt',
  'status',
  'amount',
  'channel',
  'integration',
  'customerName',
  'country',
  'managerName',
  'productName',
  'productUrl',
  'quantity',
  'type',
  'category',
  'size',
  'color',
  'currency',
];

type FieldMappingState = Record<ImportSystemField, string>;
const PREVIEW_STORAGE_PREFIX = 'sales_import_preview:';

export const SalesImportPage: React.FC = () => {
  const { t } = useTranslation();
  const locale = getLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [mapping, setMapping] = useState<FieldMappingState>(() =>
    Object.fromEntries(BASE_FIELDS.map((f) => [f, ''])) as FieldMappingState,
  );
  const [mappingColumnOrder, setMappingColumnOrder] = useState<string[]>([]);
  const [mappingColumnWidths, setMappingColumnWidths] = useState<
    Record<string, number>
  >({});
  const [mappingDragColumnId, setMappingDragColumnId] = useState<string | null>(
    null,
  );
  const [mappingResizing, setMappingResizing] = useState<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [sampleColumnOrder, setSampleColumnOrder] = useState<string[]>([]);
  const [sampleColumnWidths, setSampleColumnWidths] = useState<
    Record<string, number>
  >({});
  const [sampleDragColumnId, setSampleDragColumnId] = useState<string | null>(
    null,
  );
  const [sampleResizing, setSampleResizing] = useState<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const activeStep = preview ? 2 : 1;

  const activeCustomFields = useMemo(
    () => customFields.filter((field) => field.isActive),
    [customFields],
  );

  const allFieldKeys = useMemo(
    () => [
      ...BASE_FIELDS,
      ...activeCustomFields.map((field) => field.key),
    ],
    [activeCustomFields],
  );

  const applyPreview = (res: ImportPreviewResponse, storedFileName?: string) => {
    setPreview(res);

    setMapping((prev) => {
      const next: FieldMappingState = { ...prev };
      BASE_FIELDS.forEach((key) => {
        const suggested =
          res.suggestedMapping?.[key] ||
          res.suggestedMapping?.[key.toString()] ||
          '';
        next[key] = suggested || '';
      });
      allFieldKeys.forEach((key) => {
        if (!(key in next)) next[key] = '';
      });
      Object.keys(next).forEach((key) => {
        if (!allFieldKeys.includes(key)) delete next[key];
      });
      return next;
    });
    if (storedFileName) setFileName(storedFileName);
    setInfo(
      t('crm.salesImport.preview.summary', {
        rows: res.totalRows.toLocaleString(locale),
        columns: res.columns.length,
      }),
    );
  };

  const fieldLabels = useMemo(
    () => {
      const labels: Record<ImportSystemField, string> = {};
      BASE_FIELDS.forEach((key) => {
        labels[key] = t(`crm.salesImport.fields.${key}`);
      });
      activeCustomFields.forEach((field) => {
        labels[field.key] = field.label;
      });
      return labels;
    },
    [t, activeCustomFields],
  );

  const mappingColumns = useMemo(
    () => [
      { id: 'crmField', label: t('crm.salesImport.mapping.headers.crmField') },
      { id: 'fileColumn', label: t('crm.salesImport.mapping.headers.fileColumn') },
    ],
    [t],
  );

  const orderedMappingColumns = useMemo(() => {
    if (!mappingColumns.length) return [];
    const map = new Map(mappingColumns.map((col) => [col.id, col]));
    const order =
      mappingColumnOrder.length > 0
        ? mappingColumnOrder
        : mappingColumns.map((col) => col.id);
    const result: typeof mappingColumns = [];
    order.forEach((id) => {
      const col = map.get(id);
      if (col) result.push(col);
    });
    mappingColumns.forEach((col) => {
      if (!result.find((r) => r.id === col.id)) result.push(col);
    });
    return result;
  }, [mappingColumns, mappingColumnOrder]);

  const columns = preview?.columns || [];

  useEffect(() => {
    const importId = searchParams.get('importId');
    if (!importId || preview) return;

    try {
      const raw = sessionStorage.getItem(`${PREVIEW_STORAGE_PREFIX}${importId}`);
      if (!raw) {
        setError(t('crm.salesImport.errors.previewRequired'));
        return;
      }
      const parsed = JSON.parse(raw) as ImportPreviewResponse & {
        fileName?: string;
      };
      applyPreview(parsed, parsed.fileName);
    } catch (e) {
      console.error(e);
      setError(t('crm.salesImport.errors.preview'));
    }
  }, [searchParams, preview, t, locale]);

  const orderedSampleColumns = useMemo(() => {
    if (!columns.length) return [];
    const order =
      sampleColumnOrder.length > 0 ? sampleColumnOrder : [...columns];
    const filtered = order.filter((c) => columns.includes(c));
    const missing = columns.filter((c) => !filtered.includes(c));
    return [...filtered, ...missing];
  }, [columns, sampleColumnOrder]);

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

  useEffect(() => {
    let alive = true;
    fetchCustomFields('sale')
      .then((items) => {
        if (!alive) return;
        setCustomFields([...items].sort((a, b) => a.order - b.order));
      })
      .catch((e: any) => {
        console.error(e);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setMapping((prev) => {
      const next: FieldMappingState = { ...prev };
      allFieldKeys.forEach((key) => {
        if (!(key in next)) next[key] = '';
      });
      Object.keys(next).forEach((key) => {
        if (!allFieldKeys.includes(key)) delete next[key];
      });
      return next;
    });
  }, [allFieldKeys]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('sales_import_mapping_columns');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.order)) setMappingColumnOrder(parsed.order);
        if (parsed.widths && typeof parsed.widths === 'object')
          setMappingColumnWidths(parsed.widths);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'sales_import_mapping_columns',
        JSON.stringify({ order: mappingColumnOrder, widths: mappingColumnWidths }),
      );
    } catch {
      // ignore
    }
  }, [mappingColumnOrder, mappingColumnWidths]);

  useEffect(() => {
    if (!mappingColumns.length) return;
    setMappingColumnOrder((prev) => {
      if (!prev.length) return mappingColumns.map((c) => c.id);
      const ids = mappingColumns.map((c) => c.id);
      const filtered = prev.filter((id) => ids.includes(id));
      const missing = ids.filter((id) => !filtered.includes(id));
      return [...filtered, ...missing];
    });
  }, [mappingColumns]);

  useEffect(() => {
    if (!mappingResizing) return;
    const handleMove = (e: MouseEvent) => {
      const delta = e.clientX - mappingResizing.startX;
      const next = Math.max(90, mappingResizing.startWidth + delta);
      setMappingColumnWidths((prev) => ({ ...prev, [mappingResizing.id]: next }));
    };
    const handleUp = () => setMappingResizing(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [mappingResizing]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('sales_import_sample_columns');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.order)) setSampleColumnOrder(parsed.order);
        if (parsed.widths && typeof parsed.widths === 'object')
          setSampleColumnWidths(parsed.widths);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'sales_import_sample_columns',
        JSON.stringify({ order: sampleColumnOrder, widths: sampleColumnWidths }),
      );
    } catch {
      // ignore
    }
  }, [sampleColumnOrder, sampleColumnWidths]);

  useEffect(() => {
    if (!columns.length) return;
    setSampleColumnOrder((prev) => {
      if (!prev.length) return [...columns];
      const filtered = prev.filter((id) => columns.includes(id));
      const missing = columns.filter((id) => !filtered.includes(id));
      return [...filtered, ...missing];
    });
  }, [columns]);

  useEffect(() => {
    if (!sampleResizing) return;
    const handleMove = (e: MouseEvent) => {
      const delta = e.clientX - sampleResizing.startX;
      const next = Math.max(90, sampleResizing.startWidth + delta);
      setSampleColumnWidths((prev) => ({ ...prev, [sampleResizing.id]: next }));
    };
    const handleUp = () => setSampleResizing(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [sampleResizing]);


  // How many system fields are mapped.
  const mappedCount = useMemo(
    () =>
      allFieldKeys.filter((key) => mapping[key] && mapping[key] !== '').length,
    [mapping, allFieldKeys],
  );

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(null);
    setError(null);
    setInfo(null);
    if (searchParams.get('importId')) {
      navigate('/app/sales/import', { replace: true });
    }
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
      const storeKey = `${PREVIEW_STORAGE_PREFIX}${res.importId}`;
      try {
        sessionStorage.setItem(
          storeKey,
          JSON.stringify({ ...res, fileName: file.name }),
        );
      } catch {
        // ignore storage failures
      }
      navigate(`/app/sales/import?importId=${res.importId}`, { replace: true });
      applyPreview(res, file.name);
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

  const startMappingResize = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMappingResizing({
      id,
      startX: e.clientX,
      startWidth: mappingColumnWidths[id] ?? 160,
    });
  };

  const handleMappingColumnDrop = (targetId: string) => {
    if (!mappingDragColumnId || mappingDragColumnId === targetId) return;
    setMappingColumnOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(mappingDragColumnId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, mappingDragColumnId);
      return next;
    });
    setMappingDragColumnId(null);
  };

  const startSampleResize = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSampleResizing({
      id,
      startX: e.clientX,
      startWidth: sampleColumnWidths[id] ?? 160,
    });
  };

  const handleSampleColumnDrop = (targetId: string) => {
    if (!sampleDragColumnId || sampleDragColumnId === targetId) return;
    setSampleColumnOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(sampleDragColumnId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, sampleDragColumnId);
      return next;
    });
    setSampleDragColumnId(null);
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

      if (res.errors && res.errors.length > 0) {
        console.warn('Import errors', res.errors);
        const previewErrors = res.errors
          .slice(0, 3)
          .map((e) => `#${e.row}: ${e.reason}`)
          .join('; ');
        setInfo(`${msg} Примеры ошибок: ${previewErrors}`);
      } else {
        setInfo(msg);
      }
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

        {/* Степпер */}
        <section className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                id: 1,
                title: t('crm.salesImport.actions.preview'),
                subtitle: t('crm.salesImport.fileInputLabel'),
              },
              {
                id: 2,
                title: t('crm.salesImport.mapping.title'),
                subtitle: t('crm.salesImport.mapping.subtitle'),
              },
            ].map((step, idx, arr) => {
              const isActive = activeStep === step.id;
              const isDone = activeStep > step.id;
              return (
                <div key={step.id} className="flex items-center gap-3">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-semibold
                    ${
                      isDone
                        ? 'bg-lumiva-accent text-slate-950'
                        : isActive
                          ? 'bg-slate-50 text-slate-900'
                          : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isDone ? '✓' : step.id}
                  </div>
                  <div className="flex-1">
                    <div
                      className={`text-[12px] font-semibold ${
                        isActive || isDone ? 'text-slate-100' : 'text-slate-400'
                      }`}
                    >
                      {step.title}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {step.subtitle}
                    </div>
                  </div>
                  {idx < arr.length - 1 && (
                    <div className="hidden md:block h-px flex-1 bg-slate-800/80" />
                  )}
                </div>
              );
            })}
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
              <div className="flex items-center gap-2">
                <div className="text-[11px] text-slate-300">
                  {t('crm.salesImport.mapping.count', {
                    mapped: mappedCount,
                    total: allFieldKeys.length,
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setCustomFieldsOpen(true)}
                  className="px-2 py-1 rounded-lg text-[10px] border border-slate-700/80 text-slate-200 bg-slate-950/80 hover:bg-slate-900/80"
                >
                  {t('crm.salesImport.mapping.manageFields')}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] md:text-xs border-separate border-spacing-y-1 table-fixed">
                <thead className="text-slate-500">
                  <tr>
                    {orderedMappingColumns.map((col) => {
                      const fallback = col.id === 'crmField' ? 200 : 260;
                      const width = mappingColumnWidths[col.id] ?? fallback;
                      return (
                        <th
                          key={col.id}
                          draggable
                          onDragStart={(e) => {
                            setMappingDragColumnId(col.id);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', col.id);
                          }}
                          onDragEnd={() => setMappingDragColumnId(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleMappingColumnDrop(col.id)}
                          className="text-left font-normal px-2 py-1 relative group"
                          style={{ width, minWidth: width }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="cursor-move">⋮⋮</span>
                            <span>{col.label}</span>
                          </div>
                          <div
                            className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100"
                            onMouseDown={(e) => startMappingResize(col.id, e)}
                          />
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {allFieldKeys.map((field) => (
                    <tr
                      key={field}
                      className="bg-slate-950/80 hover:bg-slate-900/80 transition-colors"
                    >
                      {orderedMappingColumns.map((col) => {
                        const fallback = col.id === 'crmField' ? 200 : 260;
                        const width = mappingColumnWidths[col.id] ?? fallback;
                        return (
                          <td
                            key={col.id}
                            className="px-2 py-1.5"
                            style={{ width, minWidth: width }}
                          >
                            {col.id === 'crmField' ? (
                              <span className="text-slate-100 whitespace-nowrap">
                                {fieldLabels[field] || field}
                              </span>
                            ) : (
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
                            )}
                          </td>
                        );
                      })}
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
                        {orderedSampleColumns.map((col) => {
                          const width = sampleColumnWidths[col] ?? 160;
                          return (
                            <th
                              key={col}
                              draggable
                              onDragStart={(e) => {
                                setSampleDragColumnId(col);
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', col);
                              }}
                              onDragEnd={() => setSampleDragColumnId(null)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => handleSampleColumnDrop(col)}
                              className="px-2 py-1 border-b border-slate-800/80 text-left relative group"
                              style={{ width, minWidth: width }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="cursor-move">⋮⋮</span>
                                <span>{col}</span>
                              </div>
                              <div
                                className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100"
                                onMouseDown={(e) => startSampleResize(col, e)}
                              />
                            </th>
                          );
                        })}
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
                          {orderedSampleColumns.map((col) => (
                            <td
                              key={col}
                              className="px-2 py-1 border-b border-slate-900/60 text-slate-200 whitespace-nowrap"
                              style={{
                                width: sampleColumnWidths[col] ?? 160,
                                minWidth: sampleColumnWidths[col] ?? 160,
                              }}
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
              <div className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-[11px] text-[#222222] shadow-sm">
                {error}
              </div>
            )}
            {info && !error && (
              <div className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-[11px] text-[#222222] shadow-sm">
                {info}
              </div>
            )}
          </div>
        )}
      </div>
      {customFieldsOpen && (
        <CustomFieldsManager
          entityType="sale"
          title={t('crm.salesImport.mapping.manageFieldsTitle')}
          onClose={() => setCustomFieldsOpen(false)}
          onUpdated={(list) =>
            setCustomFields([...list].sort((a, b) => a.order - b.order))
          }
        />
      )}
    </MainLayout>
  );
};
