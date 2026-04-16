import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../api/client';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchCustomObjects,
  fetchCustomObjectFields,
  fetchCustomObjectRecords,
  updateCustomObjectRecord,
  type CustomObjectField,
  type CustomObject,
  type CustomObjectRecord,
} from '../../api/customObjects';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { WorkspaceRecordDetailDrawer } from '../../components/workspace/WorkspaceRecordDetailDrawer';
import { WORKSPACE_STATUS_COLOR_PRESETS } from '../../components/workspace/workspaceStatusColorPresets';
import { pickStatusLikeField } from '../../components/workspace/workspaceStatusField';
import { WorkspaceViewTabs } from '../../components/workspace/WorkspaceViewTabs';
import { useWorkspaceViewAccess } from '../../workspace/useWorkspaceViewAccess';

const FALLBACK_STATUSES = [
  { value: 'working_on_it', label: 'Working on it' },
  { value: 'done', label: 'Done' },
  { value: 'stuck', label: 'Stuck' },
  { value: 'in_review', label: 'In review' },
];
const KANBAN_COLOR_POOL = [...WORKSPACE_STATUS_COLOR_PRESETS];
const makeStatusLabel = (value: string) =>
  String(value || '')
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
const normalizeOptionValue = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_а-яё-]/gi, '');
const hashString = (input: string) =>
  input.split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 997, 7);
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const normalized = String(hex || '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{3,8}$/.test(normalized)) return null;
  const short = normalized.length === 3 || normalized.length === 4;
  const full = short
    ? normalized
        .slice(0, 3)
        .split('')
        .map((ch) => ch + ch)
        .join('')
    : normalized.slice(0, 6);
  const int = Number.parseInt(full, 16);
  if (!Number.isFinite(int)) return null;
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
};
const pickTextColorForBg = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#0f172a';
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? '#0f172a' : '#ffffff';
};

type StatusOption = { value: string; label: string; color: string };

export const WorkspaceKanbanViewPage: React.FC = () => {
  const { t } = useTranslation();
  const { objectId = '' } = useParams();
  useWorkspaceViewAccess(objectId, 'kanban');
  const [fields, setFields] = useState<CustomObjectField[]>([]);
  const [objectMeta, setObjectMeta] = useState<CustomObject['meta'] | null>(null);
  const [records, setRecords] = useState<CustomObjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeDropStatus, setActiveDropStatus] = useState<string | null>(null);
  const [activeRecord, setActiveRecord] = useState<CustomObjectRecord | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [savingRecordId, setSavingRecordId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentsByRecord, setCommentsByRecord] = useState<
    Record<string, Array<{ id: string; text: string; createdAt: string; author: string }>>
  >({});
  const [activityByRecord, setActivityByRecord] = useState<
    Record<string, Array<{ id: string; text: string; createdAt: string }>>
  >({});
  /** Подавить клик сразу после drag-and-drop (иначе откроется дровер). */
  const dragEndTsRef = useRef(0);
  /** После переноса — карточка наверху колонки + подсветка. */
  const [pinnedKanban, setPinnedKanban] = useState<{
    recordId: string;
    columnStatus: string;
  } | null>(null);
  const pinClearTimerRef = useRef<number | null>(null);

  const refreshRecordsOnly = async () => {
    if (!objectId) return;
    const result = await fetchCustomObjectRecords(objectId);
    setRecords(result.items);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [loadedFields, result, objects, staffList] = await Promise.all([
        fetchCustomObjectFields(objectId),
        fetchCustomObjectRecords(objectId),
        fetchCustomObjects().catch(() => [] as CustomObject[]),
        fetchStaff().catch(() => [] as StaffUser[]),
      ]);
      setFields(loadedFields.filter((field) => field.isActive));
      setRecords(result.items);
      setStaff(staffList);
      const object = objects.find((item) => item.id === objectId);
      setObjectMeta((object?.meta as Record<string, any> | null) || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!objectId) return;
    load();
  }, [objectId]);

  useEffect(
    () => () => {
      if (pinClearTimerRef.current) window.clearTimeout(pinClearTimerRef.current);
    },
    [objectId],
  );

  useEffect(() => {
    if (!objectId) return;
    try {
      const commentsRaw = localStorage.getItem(`workspace_comments_${objectId}`);
      const activityRaw = localStorage.getItem(`workspace_activity_${objectId}`);
      if (commentsRaw) setCommentsByRecord(JSON.parse(commentsRaw));
      if (activityRaw) setActivityByRecord(JSON.parse(activityRaw));
    } catch {
      // ignore
    }
  }, [objectId]);

  useEffect(() => {
    if (!objectId) return;
    try {
      localStorage.setItem(`workspace_comments_${objectId}`, JSON.stringify(commentsByRecord));
      localStorage.setItem(`workspace_activity_${objectId}`, JSON.stringify(activityByRecord));
    } catch {
      // ignore
    }
  }, [objectId, commentsByRecord, activityByRecord]);

  useEffect(() => {
    if (!activeRecord) return;
    const fresh = records.find((r) => r.id === activeRecord.id);
    if (fresh) setActiveRecord(fresh);
  }, [records, activeRecord?.id]);

  const orderedColumns = useMemo(() => fields, [fields]);
  const titleField = useMemo(
    () =>
      fields.find((f) => f.key === 'name') ||
      fields.find((f) => f.key === 'title') ||
      fields[0],
    [fields],
  );

  const staffByDepartment = useMemo(() => {
    const map = new Map<string, StaffUser[]>();
    staff.forEach((user) => {
      const department = user.department?.trim() || 'Without department';
      const list = map.get(department) || [];
      list.push(user);
      map.set(department, list);
    });
    return Array.from(map.entries()).map(([department, users]) => ({
      department,
      users: [...users].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    }));
  }, [staff]);

  const pushActivity = (recordId: string, text: string) => {
    setActivityByRecord((prev) => {
      const list = prev[recordId] || [];
      return {
        ...prev,
        [recordId]: [
          { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() },
          ...list,
        ].slice(0, 120),
      };
    });
  };

  const saveRecord = async (
    record: CustomObjectRecord,
    nextValues: Record<string, any>,
    changedField?: string,
  ) => {
    setSavingRecordId(record.id);
    try {
      const valuesForRequest =
        changedField && Object.prototype.hasOwnProperty.call(nextValues, changedField)
          ? { [changedField]: nextValues[changedField] }
          : nextValues;
      const saved = await updateCustomObjectRecord(objectId, record.id, {
        externalId: record.externalId || undefined,
        values: valuesForRequest,
      });
      mergeRecordFromApi(saved);
      if (changedField) {
        const field = fields.find((f) => f.key === changedField);
        pushActivity(record.id, `Updated ${field?.label || changedField}`);
      }
    } catch (error) {
      console.error('Failed to save record', { recordId: record.id, changedField, error });
      await refreshRecordsOnly();
    } finally {
      setSavingRecordId(null);
    }
  };

  const statusField = useMemo(
    () => pickStatusLikeField(fields, objectMeta as Record<string, any> | null),
    [fields, objectMeta],
  );
  const statusOrderFromMeta = useMemo(
    () =>
      Array.isArray((statusField?.meta as Record<string, any> | null)?.statusOrder)
        ? (((statusField?.meta as Record<string, any> | null)?.statusOrder as any[]) || [])
            .map((value) => normalizeOptionValue(String(value || '')))
            .filter(Boolean)
        : Array.isArray((objectMeta as Record<string, any> | null)?.kanban?.statusOrder)
        ? ((objectMeta as Record<string, any> | null)?.kanban?.statusOrder as any[])
            .map((value) => normalizeOptionValue(String(value || '')))
            .filter(Boolean)
        : [],
    [objectMeta, statusField],
  );
  const cardTitleField = useMemo(() => {
    const saved = String((objectMeta as Record<string, any> | null)?.kanban?.cardTitleField || '').trim();
    if (saved) return saved;
    return fields.find((field) => field.key === 'name')?.key || fields.find((field) => field.key === 'title')?.key || '';
  }, [fields, objectMeta]);
  const cardClientField = useMemo(
    () => String((objectMeta as Record<string, any> | null)?.kanban?.clientField || '').trim(),
    [objectMeta],
  );
  const cardExtraFields = useMemo(
    () =>
      Array.isArray((objectMeta as Record<string, any> | null)?.kanban?.extraFields)
        ? ((objectMeta as Record<string, any> | null)?.kanban?.extraFields as any[])
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        : [],
    [objectMeta],
  );
  const statusFieldKey = statusField?.key || 'status';
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
  const allStatusValues = useMemo(() => {
    const values = new Set<string>();
    records.forEach((record) => {
      const raw = String(record.values?.[statusFieldKey] || '').trim();
      const normalized = normalizeOptionValue(raw);
      if (normalized) values.add(normalized);
    });
    return Array.from(values);
  }, [records, statusFieldKey]);
  const statusOptions = useMemo<StatusOption[]>(() => {
    const base =
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
                  statusColorsFromMeta[value] ||
                  KANBAN_COLOR_POOL[idx % KANBAN_COLOR_POOL.length],
              };
            })
            .filter((opt) => opt.value && opt.label)
        : (allStatusValues.length ? allStatusValues : FALLBACK_STATUSES.map((s) => s.value)).map(
            (value, idx) => ({
              value,
              label: makeStatusLabel(value),
              color:
                statusColorsFromMeta[value] ||
                KANBAN_COLOR_POOL[hashString(value) % KANBAN_COLOR_POOL.length],
            }),
          );
    const known = new Set(base.map((item) => item.value));
    const extra = allStatusValues
      .filter((value) => !known.has(value))
      .map((value, idx) => ({
        value,
        label: makeStatusLabel(value),
        color:
          statusColorsFromMeta[value] ||
          KANBAN_COLOR_POOL[(base.length + idx) % KANBAN_COLOR_POOL.length],
      }));
    const combined = [...base, ...extra];
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
  }, [allStatusValues, statusColorsFromMeta, statusField, statusOrderFromMeta]);

  /** Значение из схемы поля (как ждёт бэкенд), чтобы PATCH не зависел от расхождения нормализации UI vs optionToken на сервере. */
  const resolveCanonicalStatusPayload = useCallback(
    (columnNormalizedValue: string) => {
      const opts = statusField?.options;
      if (!opts?.length) return columnNormalizedValue;
      const hit = opts.find(
        (opt) =>
          normalizeOptionValue(String(opt.value || opt.label || '')) === columnNormalizedValue,
      );
      return hit ? String(hit.value ?? '').trim() || columnNormalizedValue : columnNormalizedValue;
    },
    [statusField],
  );

  const mergeRecordFromApi = useCallback((saved: CustomObjectRecord) => {
    setRecords((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        ...saved,
        values: saved.values ?? next[idx].values,
        updatedAt: saved.updatedAt ?? next[idx].updatedAt,
        externalId: saved.externalId ?? next[idx].externalId,
      };
      return next;
    });
  }, []);

  const getRecordStatus = (record: CustomObjectRecord) => {
    const rawValue = String(record.values?.[statusFieldKey] || '').trim();
    const normalized = normalizeOptionValue(rawValue);
    if (!normalized) return statusOptions[0]?.value || 'working_on_it';
    const byValue = statusOptions.find((option) => option.value === normalized);
    if (byValue) return byValue.value;
    const byLabel = statusOptions.find(
      (option) => normalizeOptionValue(option.label) === normalized,
    );
    if (byLabel) return byLabel.value;
    /* Значение из БД не совпало с label/value опций — кладём карточку в колонку по нормализованному raw (extra-колонки из allStatusValues). */
    return normalized;
  };
  const resolveSystemValue = (record: CustomObjectRecord, key: string) => {
    if (key === '$record.id') return record.id;
    if (key === '$record.externalId') return record.externalId || '';
    if (key === '$record.createdAt') return record.createdAt || '';
    if (key === '$record.updatedAt') return record.updatedAt || '';
    return '';
  };
  const resolveRecordFieldText = (record: CustomObjectRecord, key: string) => {
    if (!key) return '';
    const raw = key.startsWith('$record.') ? resolveSystemValue(record, key) : record.values?.[key];
    if (raw === undefined || raw === null) return '';
    if (Array.isArray(raw)) return raw.map((value) => String(value)).join(', ');
    if (typeof raw === 'object') return '';
    return String(raw).trim();
  };
  const getCardTitle = (record: CustomObjectRecord) =>
    resolveRecordFieldText(record, cardTitleField) ||
    String(record.values?.name || record.values?.title || record.id);
  const getCardClient = (record: CustomObjectRecord) =>
    resolveRecordFieldText(record, cardClientField);
  const getCardExtraPairs = (record: CustomObjectRecord) =>
    cardExtraFields
      .filter((fieldKey) => fieldKey !== cardTitleField && fieldKey !== cardClientField)
      .map((fieldKey) => {
        const value = resolveRecordFieldText(record, fieldKey);
        if (!value) return null;
        const label =
          fieldKey.startsWith('$record.')
            ? fieldKey.replace('$record.', '')
            : fields.find((field) => field.key === fieldKey)?.label || fieldKey;
        return { label, value };
      })
      .filter(Boolean) as Array<{ label: string; value: string }>;

  const columns = useMemo(
    () =>
      statusOptions.map((statusItem) => {
        const filtered = records.filter((r) => {
          if (getRecordStatus(r) !== statusItem.value) return false;
          if (!search.trim()) return true;
          const haystack = `${getCardTitle(r)} ${getCardClient(r)} ${String(r.values?.description || '')}`.toLowerCase();
          return haystack.includes(search.trim().toLowerCase());
        });
        const sorted = [...filtered].sort((a, b) => {
          const pinA =
            pinnedKanban?.recordId === a.id && pinnedKanban.columnStatus === statusItem.value;
          const pinB =
            pinnedKanban?.recordId === b.id && pinnedKanban.columnStatus === statusItem.value;
          if (pinA && !pinB) return -1;
          if (!pinA && pinB) return 1;
          const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return tb - ta;
        });
        return {
          status: statusItem.value,
          label: statusItem.label,
          color: statusItem.color,
          items: sorted,
        };
      }),
    [
      records,
      search,
      statusOptions,
      statusFieldKey,
      cardTitleField,
      cardClientField,
      pinnedKanban,
    ],
  );

  const moveTo = async (record: CustomObjectRecord, nextStatus: string) => {
    const currentStatus = getRecordStatus(record);
    if (currentStatus === nextStatus) {
      setDraggingId(null);
      setActiveDropStatus(null);
      return;
    }

    if (pinClearTimerRef.current) {
      window.clearTimeout(pinClearTimerRef.current);
      pinClearTimerRef.current = null;
    }
    setPinnedKanban({ recordId: record.id, columnStatus: nextStatus });
    setMoveError(null);

    const nowIso = new Date().toISOString();
    const payloadValue = resolveCanonicalStatusPayload(nextStatus);
    setRecords((prev) =>
      prev.map((r) =>
        r.id === record.id
          ? {
              ...r,
              values: { ...(r.values || {}), [statusFieldKey]: nextStatus },
              updatedAt: nowIso,
            }
          : r,
      ),
    );

    setSaving(record.id);
    try {
      const saved = await updateCustomObjectRecord(objectId, record.id, {
        externalId: record.externalId || undefined,
        values: { [statusFieldKey]: payloadValue },
      });
      mergeRecordFromApi(saved);
    } catch (error) {
      console.error('Kanban: failed to update status', { recordId: record.id, nextStatus, error });
      const msg =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Не удалось сохранить статус';
      setMoveError(msg);
      await refreshRecordsOnly();
      setPinnedKanban(null);
    } finally {
      setSaving(null);
      setDraggingId(null);
      setActiveDropStatus(null);
      pinClearTimerRef.current = window.setTimeout(() => {
        pinClearTimerRef.current = null;
        setPinnedKanban(null);
      }, 10000);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{t('crm.workspace.kanban.title')}</h1>
            <p className="text-sm text-slate-500">{t('crm.workspace.kanban.subtitle')}</p>
          </div>
          <WorkspaceViewTabs objectId={objectId} active="kanban" />
        </div>
        {moveError && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 flex justify-between gap-2 items-start"
            role="alert"
          >
            <span>{moveError}</span>
            <button
              type="button"
              className="shrink-0 text-red-700 underline text-xs"
              onClick={() => setMoveError(null)}
            >
              {t('crm.workspace.kanban.dismiss')}
            </button>
          </div>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('crm.workspace.kanban.searchPlaceholder')}
              className="w-full md:w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="ml-auto text-xs text-slate-500">
              {t('crm.workspace.kanban.cardsTotal', { count: records.length })}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">{t('crm.workspace.common.loading')}</div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-1">
            {columns.map((col) => (
              <div
                key={col.status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setActiveDropStatus(col.status);
                }}
                onDragLeave={() => setActiveDropStatus((prev) => (prev === col.status ? null : prev))}
                onDrop={(e) => {
                  e.preventDefault();
                  const rawId =
                    e.dataTransfer.getData('application/x-lumiva-kanban-id') ||
                    e.dataTransfer.getData('text/plain') ||
                    draggingId;
                  const rec = rawId ? records.find((r) => r.id === rawId) : undefined;
                  if (rec) void moveTo(rec, col.status);
                  else {
                    setDraggingId(null);
                    setActiveDropStatus(null);
                  }
                }}
                className={`rounded-2xl border bg-white p-3 min-h-52 min-w-[280px] md:min-w-[320px] flex-1 transition-all duration-200 ${
                  activeDropStatus === col.status
                    ? 'border-slate-300 shadow-[0_12px_26px_rgba(15,23,42,0.12)]'
                    : 'border-slate-200'
                }`}
                style={{ borderTop: `3px solid ${col.color}` }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div
                    className="rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em]"
                    style={{ backgroundColor: col.color, color: pickTextColorForBg(col.color) }}
                  >
                    {col.label}
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    {col.items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {col.items.map((item) => (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      draggable
                      onDragStart={(e) => {
                        setDraggingId(item.id);
                        try {
                          e.dataTransfer.setData('application/x-lumiva-kanban-id', item.id);
                          e.dataTransfer.setData('text/plain', item.id);
                          e.dataTransfer.effectAllowed = 'move';
                        } catch {
                          // ignore
                        }
                      }}
                      onDragEnd={() => {
                        dragEndTsRef.current = Date.now();
                        setDraggingId(null);
                        setActiveDropStatus(null);
                      }}
                      onClick={() => {
                        if (Date.now() - dragEndTsRef.current < 280) return;
                        setActiveRecord(item);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setActiveRecord(item);
                        }
                      }}
                      className={`rounded-xl border p-3 bg-slate-50 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                        pinnedKanban?.recordId === item.id
                          ? 'ring-2 ring-sky-500 border-sky-300 shadow-md bg-white'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="text-sm font-medium text-slate-800">
                        {getCardTitle(item)}
                      </div>
                      {getCardClient(item) && (
                        <div className="mt-1 inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                          {getCardClient(item)}
                        </div>
                      )}
                      {getCardExtraPairs(item).length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {getCardExtraPairs(item).slice(0, 4).map((pair) => (
                            <span
                              key={`${item.id}-${pair.label}`}
                              className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600"
                            >
                              {pair.label}: {pair.value}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-slate-500 mt-1">
                        {String(item.values?.description || '')}
                      </div>
                      {saving === item.id && (
                        <div className="text-[11px] text-slate-400 mt-2">{t('crm.workspace.common.updating')}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <WorkspaceRecordDetailDrawer
          record={activeRecord}
          onClose={() => setActiveRecord(null)}
          onEditRecord={setActiveRecord}
          orderedColumns={orderedColumns}
          titleField={titleField}
          statusField={statusField ?? undefined}
          staffByDepartment={staffByDepartment}
          commentsByRecord={commentsByRecord}
          setCommentsByRecord={setCommentsByRecord}
          activityByRecord={activityByRecord}
          pushActivity={pushActivity}
          commentDraft={commentDraft}
          setCommentDraft={setCommentDraft}
          saveRecord={saveRecord}
          savingRecordId={savingRecordId}
          overlayZIndex={50}
          recordsForStatusOptions={records}
          objectId={objectId}
        />
      </div>
    </MainLayout>
  );
};

