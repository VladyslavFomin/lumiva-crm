import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  applyCustomObjectImport,
  createCustomObjectField,
  fetchCustomObjectFields,
  fetchCustomObjectRecords,
  previewCustomObjectImport,
  type CustomObjectField,
  type CustomObjectImportPreview,
} from '../../api/customObjects';

/** Как в таблице/канбане по умолчанию — только если в файле нет ни одного значения статуса */
const DEFAULT_STATUS_FIELD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'working_on_it', label: 'Working on it' },
  { value: 'done', label: 'Done' },
  { value: 'stuck', label: 'Stuck' },
  { value: 'in_review', label: 'In review' },
];

function slugifyStatusValue(label: string): string {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_а-яё-]/gi, '');
}

/** Уникальные строки из файла → { value, label } для поля status (как на бэкенде при импорте). */
function statusOptionsFromFileValues(values: string[]): Array<{ value: string; label: string }> {
  const used = new Set<string>();
  const out: Array<{ value: string; label: string }> = [];
  for (const raw of values) {
    const labelRaw = raw.trim();
    if (!labelRaw) continue;
    let value = slugifyStatusValue(labelRaw);
    if (!value) continue;
    let v = value;
    let n = 2;
    while (used.has(v)) {
      v = `${value}_${n++}`;
    }
    used.add(v);
    const forDisplay = labelRaw.replace(/_/g, ' ');
    const label =
      forDisplay.length > 0
        ? forDisplay.charAt(0).toUpperCase() + forDisplay.slice(1)
        : v;
    out.push({ value: v, label });
  }
  return out;
}

export const WorkspaceImportPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { objectId = '' } = useParams();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CustomObjectImportPreview | null>(null);
  const [fields, setFields] = useState<CustomObjectField[]>([]);
  const [columnToField, setColumnToField] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [creatingForColumn, setCreatingForColumn] = useState<string | null>(null);
  const [importGroupMode, setImportGroupMode] = useState<'keep' | 'existing' | 'new'>('keep');
  const [targetGroup, setTargetGroup] = useState('');
  const [existingGroups, setExistingGroups] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [applyErrors, setApplyErrors] = useState<Array<{ row: number; reason: string }>>([]);

  const mappedCount = useMemo(
    () => Object.values(columnToField).filter(Boolean).length,
    [columnToField],
  );
  const fieldOptions = useMemo(
    () =>
      [...fields]
        .filter((f) => f.isActive)
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((f) => ({ value: f.key, label: `${f.label} (${f.key})` })),
    [fields],
  );
  const existingFieldKeys = useMemo(
    () => new Set(fields.map((f) => f.key)),
    [fields],
  );
  const groupField = useMemo(
    () =>
      fields.find((f) => {
        const key = f.key.toLowerCase();
        const label = f.label.toLowerCase();
        return key === 'group' || key === 'group_name' || key.includes('group') || label.includes('груп');
      }) || null,
    [fields],
  );

  const toFieldKey = (columnName: string) => {
    const base =
      columnName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, '_')
        .replace(/^_+|_+$/g, '') || 'field';
    let key = base;
    let i = 1;
    while (existingFieldKeys.has(key)) {
      key = `${base}_${i++}`;
    }
    return key;
  };

  const inferType = (columnName: string): CustomObjectField['type'] => {
    const v = columnName.toLowerCase();
    if (v.includes('date') || v.includes('дата')) return 'date';
    if (v.includes('status') || v.includes('статус')) return 'status';
    if (v.includes('priority') || v.includes('приоритет')) return 'select';
    if (v.includes('sum') || v.includes('amount') || v.includes('value') || v.includes('сумм')) return 'number';
    return 'text';
  };

  const pickBestColumnForField = (
    fieldKey: string,
    fieldLabel: string,
    columns: string[],
  ): string | null => {
    const key = fieldKey.toLowerCase();
    const label = fieldLabel.toLowerCase();
    const list = columns.map((c) => ({ raw: c, norm: c.toLowerCase().trim() }));

    const preferNameLike =
      key === 'name' || key.includes('name') || label.includes('name') || label.includes('наз');
    if (preferNameLike) {
      const preferred = list.find(
        (c) =>
          c.norm.includes('name') ||
          c.norm.includes('title') ||
          c.norm.includes('hotel') ||
          c.norm.includes('назв') ||
          c.norm.includes('проект'),
      );
      if (preferred) return preferred.raw;
    }

    const exact = list.find((c) => c.norm === key || c.norm === label);
    if (exact) return exact.raw;
    const partial = list.find((c) => c.norm.includes(key) || c.norm.includes(label));
    if (partial) return partial.raw;
    return columns[0] || null;
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setMessage(null);
    try {
      const [previewRes, fields, records] = await Promise.all([
        previewCustomObjectImport(objectId, file),
        fetchCustomObjectFields(objectId),
        fetchCustomObjectRecords(objectId).catch(() => ({ items: [], total: 0 })),
      ]);
      setPreview(previewRes);
      setFields(fields);
      const nextMap: Record<string, string> = {};
      previewRes.columns.forEach((column) => {
        const suggestedField = fields.find(
          (f) => previewRes.suggestedMapping?.[f.key] === column,
        );
        nextMap[column] = suggestedField?.key || '';
      });
      setColumnToField(nextMap);
      const groupCandidate =
        fields.find((f) => {
          const key = f.key.toLowerCase();
          const label = f.label.toLowerCase();
          return key === 'group' || key === 'group_name' || key.includes('group') || label.includes('груп');
        }) || null;
      if (groupCandidate) {
        const groups = Array.from(
          new Set(
            records.items
              .map((r) => String(r.values?.[groupCandidate.key] || '').trim())
              .filter(Boolean),
          ),
        ).sort((a, b) => a.localeCompare(b));
        setExistingGroups(groups);
        if (groups.length > 0) setTargetGroup(groups[0]);
      } else {
        setExistingGroups([]);
        setTargetGroup('');
      }
    } catch (e: any) {
      setMessage(e?.message || t('crm.workspace.import.previewError'));
    } finally {
      setLoading(false);
    }
  };

  const createFieldFromColumn = async (column: string) => {
    setCreatingForColumn(column);
    setMessage(null);
    try {
      const key = toFieldKey(column);
      const type = inferType(column);
      const payload: Parameters<typeof createCustomObjectField>[1] = {
        key,
        label: column.trim() || key,
        type,
      };
      if (type === 'status') {
        const uniques =
          preview?.uniqueValuesByColumn?.[column]?.filter((s) => s.trim()) ?? [];
        payload.options =
          uniques.length > 0
            ? statusOptionsFromFileValues(uniques)
            : DEFAULT_STATUS_FIELD_OPTIONS;
      }
      if (type === 'select') {
        payload.options = [
          { value: 'low', label: 'Low' },
          { value: 'normal', label: 'Normal' },
          { value: 'high', label: 'High' },
        ];
      }
      const created = await createCustomObjectField(objectId, payload);
      setFields((prev) => [...prev, created]);
      setColumnToField((prev) => ({ ...prev, [column]: created.key }));
      setMessage(t('crm.workspace.import.fieldCreated', { label: created.label, column }));
    } catch (e: any) {
      setMessage(e?.message || t('crm.workspace.import.createFieldError', { column }));
    } finally {
      setCreatingForColumn(null);
    }
  };

  const handleApply = async () => {
    if (!preview) return;
    setApplying(true);
    setMessage(null);
    setApplyErrors([]);
    try {
      const fieldMapping = Object.entries(columnToField).reduce<Record<string, string | null>>(
        (acc, [column, fieldKey]) => {
          if (fieldKey) acc[fieldKey] = column;
          return acc;
        },
        {},
      );
      const requiredFields = fields.filter((f) => f.isActive && f.required);
      const missingRequired: string[] = [];
      requiredFields.forEach((field) => {
        if (fieldMapping[field.key]) return;
        const fallbackColumn = pickBestColumnForField(field.key, field.label, preview.columns);
        if (fallbackColumn) {
          fieldMapping[field.key] = fallbackColumn;
        } else {
          missingRequired.push(`${field.label} (${field.key})`);
        }
      });
      if (missingRequired.length > 0) {
        setMessage(t('crm.workspace.import.mapRequired', { fields: missingRequired.join(', ') }));
        setApplying(false);
        return;
      }
      const res = await applyCustomObjectImport(objectId, {
        importId: preview.importId,
        fieldMapping,
        defaultValues:
          importGroupMode !== 'keep' && groupField && targetGroup.trim()
            ? { [groupField.key]: targetGroup.trim() }
            : undefined,
      });
      setMessage(
        t('crm.workspace.import.importedSummary', {
          created: res.created,
          updated: res.updated,
          skipped: res.skipped,
        }),
      );
      setApplyErrors(res.errors || []);
    } catch (e: any) {
      setMessage(e?.message || t('crm.workspace.import.applyFailed'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">{t('crm.workspace.import.title')}</h1>
          <button
            type="button"
            onClick={() => navigate(`/workspace/${objectId}/table`)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-sm"
          >
            {t('crm.workspace.import.backToTable')}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="workspace-import-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="sr-only"
            />
            <label
              htmlFor="workspace-import-file"
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-lumiva-accent bg-lumiva-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-lumiva-accent-soft hover:shadow-md"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="M7 10l5-5 5 5" />
                <path d="M12 5v12" />
              </svg>
              {t('crm.workspace.import.chooseFile')}
            </label>
            <div className="text-sm text-slate-600">
              {file ? file.name : t('crm.workspace.import.fileNotSelected')}
            </div>
          </div>
          <button
            type="button"
            onClick={handlePreview}
            disabled={!file || loading}
            className="px-3 py-2 rounded-lg bg-lumiva-accent text-white text-sm transition-colors hover:bg-lumiva-accent-soft disabled:opacity-60"
          >
            {loading ? t('crm.workspace.import.reading') : t('crm.workspace.import.preview')}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{t('crm.workspace.import.importViaApi')}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('crm.workspace.import.importViaApiHint')}
              </p>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-700">
              {t('crm.workspace.import.soon')}
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            POST <span className="font-mono">/public/custom-objects/:slug/ingest</span>
          </div>
          <div className="text-xs text-slate-500">
            {t('crm.workspace.import.apiSectionHint')}
          </div>
        </div>

        {preview && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="text-sm text-slate-700">
              {t('crm.workspace.import.columnsRows', {
                cols: preview.columns.length,
                rows: preview.totalRows,
              })}
            </div>
            {preview.headerRowNumber ? (
              <div className="text-xs text-slate-500">
                {t('crm.workspace.import.headerRow', { n: preview.headerRowNumber })}
              </div>
            ) : null}
            <div className="text-xs text-slate-500">
              {t('crm.workspace.import.mapped', {
                mapped: mappedCount,
                total: preview.columns.length,
              })}
            </div>
            {groupField && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="text-sm font-medium text-slate-700">{t('crm.workspace.import.importTargetGroup')}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={importGroupMode}
                    onChange={(e) => setImportGroupMode(e.target.value as 'keep' | 'existing' | 'new')}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="keep">{t('crm.workspace.import.groupKeep')}</option>
                    <option value="existing">{t('crm.workspace.import.groupExisting')}</option>
                    <option value="new">{t('crm.workspace.import.groupNew')}</option>
                  </select>
                  {importGroupMode === 'existing' && (
                    <select
                      value={targetGroup}
                      onChange={(e) => setTargetGroup(e.target.value)}
                      className="min-w-[220px] rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white"
                    >
                      {existingGroups.map((groupName) => (
                        <option key={groupName} value={groupName}>
                          {groupName}
                        </option>
                      ))}
                    </select>
                  )}
                  {importGroupMode === 'new' && (
                    <input
                      value={targetGroup}
                      onChange={(e) => setTargetGroup(e.target.value)}
                      placeholder={t('crm.workspace.import.newGroupName')}
                      className="min-w-[220px] rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white"
                    />
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2">
              {preview.columns.map((column) => (
                <div key={column} className="flex items-center gap-2">
                  <div className="w-48 text-sm text-slate-700">{column}</div>
                  <select
                    value={columnToField[column] || ''}
                    onChange={(e) =>
                      setColumnToField((prev) => ({
                        ...prev,
                        [column]: e.target.value,
                      }))
                    }
                    className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">{t('crm.workspace.import.notMapped')}</option>
                    {fieldOptions.map((field) => (
                      <option key={field.value} value={field.value}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void createFieldFromColumn(column)}
                    disabled={creatingForColumn === column}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs hover:bg-slate-50 disabled:opacity-60"
                  >
                    {creatingForColumn === column ? t('crm.workspace.import.creatingField') : t('crm.workspace.import.createField')}
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleApply}
              disabled={applying}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-60"
            >
              {applying ? t('crm.workspace.import.applying') : t('crm.workspace.import.apply')}
            </button>
          </div>
        )}

        {message && <div className="text-sm text-slate-700">{message}</div>}
        {applyErrors.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
            <div className="text-sm font-medium text-amber-900">
              {t('crm.workspace.import.rowErrors', { count: applyErrors.length })}
            </div>
            <div className="max-h-64 overflow-auto space-y-1">
              {applyErrors.map((error, idx) => (
                <div
                  key={`${error.row}-${idx}`}
                  className="text-xs text-amber-900 rounded-lg border border-amber-200 bg-white px-2 py-1.5"
                >
                  Row {error.row}: {error.reason}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

