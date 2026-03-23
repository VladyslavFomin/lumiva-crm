import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  createCustomObjectField,
  fetchCustomObjectAnalytics,
  fetchCustomObjectFields,
  fetchCustomObjects,
  updateCustomObject,
  updateCustomObjectField,
  type CustomObjectField,
  type CustomObjectFieldType,
} from '../../api/customObjects';
import {
  WORKSPACE_STATUS_COLOR_PRESETS,
  WORKSPACE_STATUS_DEFAULT_COLOR,
} from '../../components/workspace/workspaceStatusColorPresets';
import { WorkspaceViewTabs } from '../../components/workspace/WorkspaceViewTabs';

const FIELD_TYPES: CustomObjectFieldType[] = [
  'text',
  'number',
  'date',
  'datetime',
  'boolean',
  'status',
  'select',
  'multiselect',
  'file',
];

const STATUS_COLOR_PRESETS = [...WORKSPACE_STATUS_COLOR_PRESETS];
const FALLBACK_STATUSES = [
  { value: 'working_on_it', label: 'Working on it' },
  { value: 'done', label: 'Done' },
  { value: 'stuck', label: 'Stuck' },
  { value: 'in_review', label: 'In review' },
];
const SYSTEM_FIELD_OPTIONS = [
  { value: '$record.id', label: 'Record ID' },
  { value: '$record.externalId', label: 'External ID' },
  { value: '$record.createdAt', label: 'Created at' },
  { value: '$record.updatedAt', label: 'Updated at' },
];
const normalizeOptionValue = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_а-яё-]/gi, '');
const hashString = (input: string) =>
  input.split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 997, 7);
const pickTextColorForBg = (hex: string) => {
  const normalized = String(hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return '#0f172a';
  const int = Number.parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#0f172a' : '#ffffff';
};

type StatusOption = { value: string; label: string; color: string };

export const WorkspaceSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { objectId = '' } = useParams();
  const [fields, setFields] = useState<CustomObjectField[]>([]);
  const [objectMeta, setObjectMeta] = useState<Record<string, any> | null>(null);
  const [analytics, setAnalytics] = useState<{
    totalRecords: number;
    byStatus: Record<string, number>;
  } | null>(null);
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomObjectFieldType>('text');
  const [saving, setSaving] = useState(false);
  const [draftStatuses, setDraftStatuses] = useState<StatusOption[]>([]);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [savingStatuses, setSavingStatuses] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [cardTitleField, setCardTitleField] = useState('');
  const [clientField, setClientField] = useState('');
  const [cardExtraFields, setCardExtraFields] = useState<string[]>([]);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [savingCardSettings, setSavingCardSettings] = useState(false);
  const [cardSettingsError, setCardSettingsError] = useState<string | null>(null);

  const load = async () => {
    const [fieldItems, stats, objects] = await Promise.all([
      fetchCustomObjectFields(objectId),
      fetchCustomObjectAnalytics(objectId),
      fetchCustomObjects().catch(() => []),
    ]);
    setFields(fieldItems);
    setAnalytics(stats);
    const object = objects.find((item) => item.id === objectId);
    const meta = (object?.meta as Record<string, any> | null) || null;
    setObjectMeta(meta);
    const titleFallback =
      fieldItems.find((field) => field.key === 'name')?.key ||
      fieldItems.find((field) => field.key === 'title')?.key ||
      fieldItems[0]?.key ||
      '';
    const clientFallback =
      fieldItems.find((field) => field.key.toLowerCase().includes('client'))?.key ||
      fieldItems.find((field) => field.key.toLowerCase().includes('customer'))?.key ||
      fieldItems.find((field) => field.key.toLowerCase().includes('company'))?.key ||
      '';
    setCardTitleField(String(meta?.kanban?.cardTitleField || titleFallback || ''));
    setClientField(String(meta?.kanban?.clientField || clientFallback || ''));
    const extra = Array.isArray(meta?.kanban?.extraFields)
      ? (meta?.kanban?.extraFields as any[])
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      : [];
    setCardExtraFields(extra);
  };

  useEffect(() => {
    if (!objectId) return;
    void load();
  }, [objectId]);

  const statusField = useMemo(
    () => fields.find((f) => f.type === 'status' || f.key === 'status') || null,
    [fields],
  );
  const statusOrderFromMeta = useMemo(
    () =>
      Array.isArray((statusField?.meta as Record<string, any> | null)?.statusOrder)
        ? (((statusField?.meta as Record<string, any> | null)?.statusOrder as any[]) || [])
            .map((value) => normalizeOptionValue(String(value || '')))
            .filter(Boolean)
        : Array.isArray((objectMeta || {}).kanban?.statusOrder)
        ? ((objectMeta || {}).kanban?.statusOrder as any[])
            .map((value) => normalizeOptionValue(String(value || '')))
            .filter(Boolean)
        : [],
    [objectMeta, statusField],
  );
  const statusColorsFromMeta = useMemo(() => {
    const raw = statusField?.meta?.statusColors;
    const map: Record<string, string> = {};
    if (raw && typeof raw === 'object') {
      Object.entries(raw as Record<string, any>).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim()) map[key] = value.trim();
      });
    }
    return map;
  }, [statusField]);
  const derivedStatusOptions = useMemo<StatusOption[]>(() => {
    const fromField =
      statusField?.options?.length
        ? statusField.options
            .map((opt, idx) => {
              const value = normalizeOptionValue(String(opt.value || opt.label || ''));
              const label =
                String(opt.label || opt.value || '').trim() ||
                String(opt.value || '').trim();
              return {
                value,
                label,
                color:
                  statusColorsFromMeta[String(opt.value || '').trim()] ||
                  STATUS_COLOR_PRESETS[idx % STATUS_COLOR_PRESETS.length],
              };
            })
            .filter((opt) => opt.value && opt.label)
        : FALLBACK_STATUSES.map((item, idx) => ({
            ...item,
            color: STATUS_COLOR_PRESETS[idx % STATUS_COLOR_PRESETS.length],
          }));
    const used = new Set(fromField.map((item) => item.value));
    const byStatusKeys = Object.keys(analytics?.byStatus || {});
    const extra = byStatusKeys
      .filter((key) => key && !used.has(key))
      .map((key, idx) => ({
        value: normalizeOptionValue(key),
        label: key.replace(/_/g, ' '),
        color:
          statusColorsFromMeta[normalizeOptionValue(key)] ||
          STATUS_COLOR_PRESETS[(fromField.length + idx) % STATUS_COLOR_PRESETS.length],
      }))
      .filter((item) => item.value);
    const combined = [...fromField, ...extra];
    if (!statusOrderFromMeta.length) return combined;
    const orderIndex = new Map(statusOrderFromMeta.map((value, index) => [value, index]));
    return [...combined].sort((a, b) => {
      const ai = orderIndex.get(a.value);
      const bi = orderIndex.get(b.value);
      if (ai === undefined && bi === undefined) return 0;
      if (ai === undefined) return 1;
      if (bi === undefined) return -1;
      return ai - bi;
    });
  }, [analytics?.byStatus, statusColorsFromMeta, statusField, statusOrderFromMeta]);
  const selectorOptions = useMemo(
    () => [
      ...fields.map((field) => ({
        value: field.key,
        label: `${field.label} (${field.key})`,
      })),
      ...SYSTEM_FIELD_OPTIONS,
    ],
    [fields],
  );

  useEffect(() => {
    setDraftStatuses(derivedStatusOptions);
  }, [derivedStatusOptions]);

  const handleAddField = async () => {
    if (!key.trim() || !label.trim()) return;
    setSaving(true);
    try {
      await createCustomObjectField(objectId, {
        key: key.trim(),
        label: label.trim(),
        type,
      });
      setKey('');
      setLabel('');
      setType('text');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const moveDraftStatus = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draftStatuses.length) return;
    setDraftStatuses((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, moved);
      return copy;
    });
  };

  const addDraftStatus = () => {
    const labelText = newStatusLabel.trim();
    if (!labelText) return;
    setDraftStatuses((prev) => {
      const used = new Set(prev.map((item) => item.value));
      let value = normalizeOptionValue(labelText) || 'status';
      let i = 2;
      while (used.has(value)) {
        value = `${normalizeOptionValue(labelText) || 'status'}_${i}`;
        i += 1;
      }
      return [
        ...prev,
        {
          value,
          label: labelText,
          color: STATUS_COLOR_PRESETS[hashString(value) % STATUS_COLOR_PRESETS.length],
        },
      ];
    });
    setNewStatusLabel('');
  };

  const saveStatusStructure = async () => {
    if (!objectId) return;
    const cleanedRaw = draftStatuses
      .map((status) => ({
        value: normalizeOptionValue(status.value || status.label),
        label: String(status.label || status.value).trim(),
        color: status.color || WORKSPACE_STATUS_DEFAULT_COLOR,
      }))
      .filter((status) => status.value && status.label);
    const uniqueByValue = new Map<string, { value: string; label: string; color: string }>();
    cleanedRaw.forEach((status) => {
      if (!uniqueByValue.has(status.value)) uniqueByValue.set(status.value, status);
    });
    const cleaned = Array.from(uniqueByValue.values());
    if (!cleaned.length) {
      setStatusError(t('crm.workspace.settings.addAtLeastOneStatus'));
      return;
    }
    setSavingStatuses(true);
    setStatusError(null);
    try {
      const options = cleaned.map((status) => ({ value: status.value, label: status.label }));
      const statusColors = cleaned.reduce<Record<string, string>>((acc, status) => {
        acc[status.value] = status.color;
        return acc;
      }, {});
      const statusOrder = cleaned.map((status) => status.value);
      if (statusField) {
        await updateCustomObjectField(objectId, statusField.id, {
          options,
          meta: { ...(statusField.meta || {}), statusColors, statusOrder },
        });
      } else {
        const created = await createCustomObjectField(objectId, {
          key: 'status',
          label: t('crm.workspace.settings.statusFieldLabel'),
          type: 'status',
          options,
        });
        await updateCustomObjectField(objectId, created.id, {
          meta: { ...(created.meta || {}), statusColors, statusOrder },
        });
      }
      const nextMeta = {
        ...(objectMeta || {}),
        kanban: {
          ...((objectMeta || {}).kanban || {}),
          statusOrder,
        },
      };
      await updateCustomObject(objectId, { meta: nextMeta });
      setObjectMeta(nextMeta);
      await load();
    } catch (e: any) {
      setStatusError(e?.message || t('crm.workspace.settings.failedSaveStatuses'));
    } finally {
      setSavingStatuses(false);
    }
  };

  const saveCardViewSettings = async () => {
    if (!objectId) return;
    setSavingCardSettings(true);
    setCardSettingsError(null);
    try {
      const nextMeta = {
        ...(objectMeta || {}),
        kanban: {
          ...((objectMeta || {}).kanban || {}),
          cardTitleField: cardTitleField || '',
          clientField: clientField || '',
          extraFields: cardExtraFields
            .map((fieldKey) => String(fieldKey || '').trim())
            .filter(Boolean),
        },
      };
      await updateCustomObject(objectId, { meta: nextMeta });
      setObjectMeta(nextMeta);
    } catch (e: any) {
      setCardSettingsError(e?.message || t('crm.workspace.settings.failedSaveCard'));
    } finally {
      setSavingCardSettings(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-2xl font-semibold text-slate-900">{t('crm.workspace.settings.title')}</h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(`/workspace/${objectId}/import`)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white hover:bg-slate-50"
            >
              {t('crm.workspace.settings.importData')}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/workspace/${objectId}/table`)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white hover:bg-slate-50"
            >
              {t('crm.workspace.settings.openTable')}
            </button>
          </div>
        </div>
        <WorkspaceViewTabs objectId={objectId} active="settings" />

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{t('crm.workspace.settings.kanbanCards')}</div>
              <h2 className="text-lg font-semibold text-slate-900 mt-1">{t('crm.workspace.settings.cardMapping')}</h2>
              <p className="text-sm text-slate-500">
                {t('crm.workspace.settings.cardMappingHintShort')}
              </p>
            </div>
            <button
              type="button"
              onClick={saveCardViewSettings}
              disabled={savingCardSettings}
              className="px-3 py-2 rounded-xl bg-lumiva-accent text-white text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:bg-lumiva-accent-soft hover:shadow-md disabled:opacity-60"
            >
              {savingCardSettings ? t('crm.workspace.settings.saving') : t('crm.workspace.settings.saveCardMapping')}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-3">
              <div className="text-xs uppercase tracking-[0.14em] text-slate-500 mb-1">{t('crm.workspace.settings.cardTitleField')}</div>
              <select
                value={cardTitleField}
                onChange={(e) => setCardTitleField(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">{t('crm.workspace.settings.selectTitleField')}</option>
                {selectorOptions.map((option) => (
                  <option key={`title-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-3">
              <div className="text-xs uppercase tracking-[0.14em] text-slate-500 mb-1">{t('crm.workspace.settings.clientField')}</div>
              <select
                value={clientField}
                onChange={(e) => setClientField(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">{t('crm.workspace.settings.noClientLabel')}</option>
                {selectorOptions.map((option) => (
                  <option key={`client-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="relative mt-2">
                <button
                  type="button"
                  onClick={() => setExtrasOpen((prev) => !prev)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  {cardExtraFields.length
                    ? t('crm.workspace.settings.additionalFieldsCount', {
                        count: cardExtraFields.length,
                      })
                    : t('crm.workspace.settings.additionalFields')}
                </button>
                {extrasOpen && (
                  <div className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    <div className="space-y-1">
                      {selectorOptions.map((option) => {
                        const checked = cardExtraFields.includes(option.value);
                        return (
                          <label
                            key={`extra-${option.value}`}
                            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors cursor-pointer ${
                              checked ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setCardExtraFields((prev) =>
                                  checked
                                    ? prev.filter((key) => key !== option.value)
                                    : [...prev, option.value],
                                )
                              }
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <span className="truncate">{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {cardSettingsError && (
            <div className="mt-2 text-xs text-rose-600">{cardSettingsError}</div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{t('crm.workspace.settings.statusSection')}</div>
              <h2 className="text-lg font-semibold text-slate-900 mt-1">{t('crm.workspace.settings.statusStructure')}</h2>
              <p className="text-sm text-slate-500">
                {t('crm.workspace.settings.statusHint')}
              </p>
            </div>
            <button
              type="button"
              onClick={saveStatusStructure}
              disabled={savingStatuses}
              className="px-3 py-2 rounded-xl bg-lumiva-accent text-white text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:bg-lumiva-accent-soft hover:shadow-md disabled:opacity-60"
            >
              {savingStatuses ? t('crm.workspace.settings.saving') : t('crm.workspace.settings.saveStructure')}
            </button>
          </div>

          <div className="space-y-2">
            {draftStatuses.map((status, index) => (
              <div
                key={status.value}
                className="group rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/60 px-2 py-2 transition-all duration-200 hover:border-slate-300 hover:shadow-sm"
              >
                <div className="grid grid-cols-[24px_24px_minmax(80px,120px)_minmax(0,1fr)_auto] items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveDraftStatus(index, -1)}
                    disabled={index === 0}
                    className="h-6 w-6 rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40"
                    title={t('crm.workspace.settings.moveUp')}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDraftStatus(index, 1)}
                    disabled={index === draftStatuses.length - 1}
                    className="h-6 w-6 rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40"
                    title={t('crm.workspace.settings.moveDown')}
                  >
                    ↓
                  </button>
                  <span className="truncate text-[11px] text-slate-500">{status.value}</span>
                  <input
                    value={status.label}
                    onChange={(e) =>
                      setDraftStatuses((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, label: e.target.value } : item,
                        ),
                      )
                    }
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {STATUS_COLOR_PRESETS.map((preset) => {
                      const isActive = status.color === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            setDraftStatuses((prev) =>
                              prev.map((item, i) =>
                                i === index ? { ...item, color: preset } : item,
                              ),
                            )
                          }
                          className={`h-6 w-6 rounded-full border-2 transition-all duration-200 ${
                            isActive
                              ? 'scale-110 border-slate-500 shadow-[0_0_0_2px_rgba(100,116,139,0.25)]'
                              : 'border-slate-200/80 shadow-sm hover:scale-105 hover:border-slate-300'
                          }`}
                          style={{ backgroundColor: preset }}
                          title={preset}
                        />
                      );
                    })}
                    <button
                      type="button"
                      onClick={() =>
                        setDraftStatuses((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="ml-1 h-7 w-7 rounded-full border border-rose-200 text-rose-500 transition-colors hover:bg-rose-50"
                      title={t('crm.workspace.settings.deleteStatus')}
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div
                  className="mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-slate-900/8 shadow-sm"
                  style={{ backgroundColor: status.color, color: pickTextColorForBg(status.color) }}
                >
                  {t('crm.workspace.settings.statusPreview', { label: status.label || status.value })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={newStatusLabel}
              onChange={(e) => setNewStatusLabel(e.target.value)}
              placeholder={t('crm.workspace.settings.newStatusPlaceholder')}
              className="w-full sm:w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addDraftStatus}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 transition-colors hover:bg-slate-50"
            >
              {t('crm.workspace.settings.addStatus')}
            </button>
            {statusError && <span className="text-xs text-rose-600">{statusError}</span>}
          </div>
        </div>

        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{t('crm.workspace.settings.records')}</div>
              <div className="text-2xl font-semibold text-slate-900 mt-1">{analytics.totalRecords}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500 mb-2">{t('crm.workspace.settings.byStatus')}</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(analytics.byStatus).map(([k, v]) => (
                  <span
                    key={k}
                    className="px-2 py-1 rounded-full border border-slate-200 text-xs text-slate-700"
                  >
                    {k}: {v}
                  </span>
                ))}
                {Object.keys(analytics.byStatus).length === 0 && (
                  <span className="text-sm text-slate-500">{t('crm.workspace.settings.noStatusData')}</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-800 mb-3">{t('crm.workspace.settings.fields')}</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={t('crm.workspace.settings.fieldKeyPlaceholder')}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('crm.workspace.settings.fieldLabelPlaceholder')}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CustomObjectFieldType)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {FIELD_TYPES.map((ft) => (
                <option key={ft} value={ft}>
                  {ft}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddField}
              disabled={saving}
              className="rounded-lg bg-lumiva-accent text-white text-sm px-3 py-2 disabled:opacity-60"
            >
              {t('crm.workspace.settings.addField')}
            </button>
          </div>
          <div className="space-y-2">
            {fields.map((f) => (
              <div
                key={f.id}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm flex items-center justify-between"
              >
                <span>
                  {f.label} <span className="text-slate-400">({f.key})</span>
                </span>
                <span className="text-xs uppercase tracking-[0.14em] text-slate-500">{f.type}</span>
              </div>
            ))}
            {fields.length === 0 && <div className="text-sm text-slate-500">{t('crm.workspace.settings.noFieldsYet')}</div>}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

