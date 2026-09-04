import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { useKanbanSensors } from '../../components/kanban/useKanbanSensors';
import { kanbanCollisionDetection } from '../../components/kanban/kanbanCollisionDetection';
import { useHorizontalWheelScroll } from '../../components/kanban/useHorizontalWheelScroll';
import '../projects/ProjectsListPage.css';
import { ApiError } from '../../api/client';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchCustomObjects,
  fetchCustomObjectFields,
  fetchCustomObjectRecords,
  updateCustomObjectRecord,
  createCustomObjectRecord,
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
import { getWorkspaceTableKind } from '../../workspace/workspaceTableKind';
import { WsAreaBar } from '../../components/workspace/WsAreaBar';
import { fetchWorkspaceArea, type WorkspaceArea } from '../../api/workspaceAreas';
import './WorkspaceArea.css';

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

type StatusOption = { value: string; label: string; color: string };

const DraggableRecordCard: React.FC<{
  id: string;
  className?: string;
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  children: React.ReactNode;
}> = ({ id, className, onClick, onKeyDown, children }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  // Visual feedback while dragging comes from the floating DragOverlay, not an in-place
  // transform — see LeadsBoardPage/ProjectsBoardPage for why an in-place transform can read as
  // "snapping back" for a frame on a card that moves between columns.
  const style: React.CSSProperties = { opacity: isDragging ? 0.35 : undefined };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={className}
      {...attributes}
      {...listeners}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
};

const DroppableRecordColumn: React.FC<{ id: string; className?: string; children: React.ReactNode }> = ({ id, className, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className || ''}${isOver ? ' over' : ''}`}>
      {children}
    </div>
  );
};

export const WorkspaceKanbanViewPage: React.FC = () => {
  const { t } = useTranslation();
  const { objectId = '' } = useParams();
  useWorkspaceViewAccess(objectId, 'kanban');
  const [fields, setFields] = useState<CustomObjectField[]>([]);
  const [objectMeta, setObjectMeta] = useState<CustomObject['meta'] | null>(null);
  const [objectName, setObjectName] = useState('');
  const [area, setArea] = useState<WorkspaceArea | null>(null);
  const [records, setRecords] = useState<CustomObjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
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
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [newCardDraft, setNewCardDraft] = useState('');
  const [creatingCard, setCreatingCard] = useState(false);

  /** Подавить клик сразу после drag-and-drop (иначе откроется дровер). */
  const dragEndTsRef = useRef(0);
  const kanbanSensors = useKanbanSensors();
  const { ref: boardScrollRef } = useHorizontalWheelScroll<HTMLDivElement>();
  const activeDragRecord = useMemo(() => records.find((r) => r.id === draggingId) ?? null, [records, draggingId]);
  /** После переноса — карточка наверху колонки + подсветка. */
  const [pinnedKanban, setPinnedKanban] = useState<{
    recordId: string;
    columnStatus: string;
  } | null>(null);
  const pinClearTimerRef = useRef<number | null>(null);

  const refreshRecordsOnly = async () => {
    if (!objectId) return;
    const enrich =
      getWorkspaceTableKind(objectMeta as Record<string, unknown> | null) === 'board';
    const result = await fetchCustomObjectRecords(objectId, undefined, {
      enrichColumnBindings: enrich,
    });
    setRecords(result.items);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [loadedFields, objects, staffList] = await Promise.all([
        fetchCustomObjectFields(objectId),
        fetchCustomObjects().catch(() => [] as CustomObject[]),
        fetchStaff().catch(() => [] as StaffUser[]),
      ]);
      const object = objects.find((item) => item.id === objectId);
      const enrich =
        getWorkspaceTableKind(object?.meta as Record<string, unknown> | null) === 'board';
      const result = await fetchCustomObjectRecords(objectId, undefined, {
        enrichColumnBindings: enrich,
      });
      setFields(loadedFields.filter((field) => field.isActive));
      setRecords(result.items);
      setStaff(staffList);
      setObjectMeta((object?.meta as Record<string, any> | null) || null);
      setObjectName(object?.name || '');
      if (object?.workspaceAreaId) {
        fetchWorkspaceArea(object.workspaceAreaId)
          .then(setArea)
          .catch(() => setArea(null));
      } else {
        setArea(null);
      }
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
  /** Числовое поле для суммы/полоски в шапке колонки — первое поле типа number, если оно есть. */
  const amountField = useMemo(() => fields.find((f) => f.type === 'number'), [fields]);
  /** Поле ответственного — та же эвристика, что и в WorkspaceRecordDetailDrawer. */
  const ownerField = useMemo(
    () =>
      fields.find(
        (f) =>
          f.key.includes('owner') ||
          f.key.includes('assignee') ||
          f.key.includes('person') ||
          f.key.includes('responsible'),
      ),
    [fields],
  );
  /** Доп. бейдж на карточке — поле-источник, если оно есть. */
  const sourceField = useMemo(
    () => fields.find((f) => /source|channel|utm/i.test(f.key)),
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
  const getOwnerInitials = (record: CustomObjectRecord) => {
    if (!ownerField) return '';
    const raw = String(record.values?.[ownerField.key] || '').trim();
    if (!raw) return '';
    const first = raw.split(/[,;/]+/)[0].trim();
    const parts = first.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return first.slice(0, 2).toUpperCase();
  };
  const getSourceLabel = (record: CustomObjectRecord) =>
    sourceField ? String(record.values?.[sourceField.key] || '').trim() : '';

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
        const sum = amountField
          ? filtered.reduce((acc, r) => acc + (Number(r.values?.[amountField.key]) || 0), 0)
          : 0;
        return {
          status: statusItem.value,
          label: statusItem.label,
          color: statusItem.color,
          items: sorted,
          sum,
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
      amountField,
    ],
  );
  const maxColumnSum = useMemo(
    () => Math.max(1, ...columns.map((c) => c.sum)),
    [columns],
  );

  const moveTo = async (record: CustomObjectRecord, nextStatus: string) => {
    const currentStatus = getRecordStatus(record);
    if (currentStatus === nextStatus) {
      setDraggingId(null);
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
      pinClearTimerRef.current = window.setTimeout(() => {
        pinClearTimerRef.current = null;
        setPinnedKanban(null);
      }, 10000);
    }
  };

  const handleKanbanDragStart = (id: string) => {
    setDraggingId(id);
  };

  const handleKanbanDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    dragEndTsRef.current = Date.now();
    if (!over) {
      setDraggingId(null);
      return;
    }
    const rec = records.find((r) => r.id === String(active.id));
    if (rec) void moveTo(rec, String(over.id));
    else setDraggingId(null);
  };

  const createCard = async (columnStatus: string) => {
    const name = newCardDraft.trim();
    if (!name || creatingCard) return;
    setCreatingCard(true);
    try {
      const titleKey = cardTitleField && !cardTitleField.startsWith('$record.') ? cardTitleField : 'name';
      const canonicalStatus = resolveCanonicalStatusPayload(columnStatus);
      const created = await createCustomObjectRecord(objectId, {
        values: { [titleKey]: name, [statusFieldKey]: canonicalStatus },
      });
      setRecords((prev) => [created, ...prev]);
      setNewCardDraft('');
      setAddingToColumn(null);
    } catch {
      // ignore, user can retry
    } finally {
      setCreatingCard(false);
    }
  };

  return (
    <MainLayout>
      <div className="lv-kb ws-page max-w-[120rem] mx-auto space-y-4">
        {area && (
          <WsAreaBar
            areaId={area.id}
            areaName={area.name}
            areaIconKey={area.iconKey}
            current={objectName}
            kind={getWorkspaceTableKind(objectMeta as Record<string, unknown> | null)}
          />
        )}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{t('crm.workspace.kanban.title')}</h1>
            <p className="text-sm text-slate-500">{t('crm.workspace.kanban.subtitle')}</p>
          </div>
        </div>
        <WorkspaceViewTabs objectId={objectId} active="kanban" />
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
        <div className="lv-toolbar">
          <div className="lv-tb-search" style={{ width: 288 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.5-4.5" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('crm.workspace.kanban.searchPlaceholder')}
            />
          </div>
          <div className="lv-toolbar-spacer" />
          <div className="text-xs" style={{ color: 'var(--fg-3)' }}>
            {t('crm.workspace.kanban.cardsTotal', { count: records.length })}
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">{t('crm.workspace.common.loading')}</div>
        ) : (
          <DndContext sensors={kanbanSensors} collisionDetection={kanbanCollisionDetection} onDragStart={(e) => handleKanbanDragStart(String(e.active.id))} onDragEnd={handleKanbanDragEnd}>
          <div className="kb-board" ref={boardScrollRef}>
            {columns.map((col) => (
              <DroppableRecordColumn key={col.status} id={col.status} className="kb-col">
                <div className="kb-col-head">
                  <div className="kb-col-titlerow">
                    <span className="kb-dot" style={{ background: col.color }} />
                    <span className="kb-col-title">{col.label}</span>
                    <span className="kb-count">{col.items.length}</span>
                  </div>
                  {amountField && (
                    <>
                      <div className="kb-col-meta">
                        <span>
                          <b>{new Intl.NumberFormat('ru-RU').format(col.sum)}</b>
                        </span>
                      </div>
                      <div className="kb-meter">
                        <i style={{ width: `${Math.round((col.sum / maxColumnSum) * 100)}%`, background: col.color }} />
                      </div>
                    </>
                  )}
                </div>
                <div className="kb-list">
                  {col.items.length === 0 && (
                    <div className="kb-empty">
                      {draggingId ? t('crm.workspace.kanban.dropHere') : t('crm.workspace.kanban.empty')}
                    </div>
                  )}
                  {col.items.map((item) => (
                    <DraggableRecordCard
                      key={item.id}
                      id={item.id}
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
                      className={`kb-card${draggingId === item.id ? ' dragging' : ''}${
                        pinnedKanban?.recordId === item.id ? ' pri-high' : ''
                      }`}
                    >
                      <div className="kb-name">
                        {getCardTitle(item)}
                      </div>
                      {getCardClient(item) && (
                        <div className="kb-chips">
                          <span className="kb-chip">{getCardClient(item)}</span>
                        </div>
                      )}
                      {getCardExtraPairs(item).length > 0 && (
                        <div className="kb-chips">
                          {getCardExtraPairs(item).slice(0, 4).map((pair) => (
                            <span
                              key={`${item.id}-${pair.label}`}
                              className="kb-chip"
                            >
                              {pair.label}: {pair.value}
                            </span>
                          ))}
                        </div>
                      )}
                      {String(item.values?.description || '') && (
                        <div className="kb-sub" style={{ marginTop: 8 }}>
                          {String(item.values?.description || '')}
                        </div>
                      )}
                      {(getOwnerInitials(item) || getSourceLabel(item)) && (
                        <div className="kb-foot">
                          {getOwnerInitials(item) && <span className="kb-ava">{getOwnerInitials(item)}</span>}
                          <span className="sp" />
                          {getSourceLabel(item) && <span className="kb-mini">{getSourceLabel(item)}</span>}
                        </div>
                      )}
                      {saving === item.id && (
                        <div className="text-[11px] mt-2" style={{ color: 'var(--fg-4)' }}>{t('crm.workspace.common.updating')}</div>
                      )}
                    </DraggableRecordCard>
                  ))}
                </div>

                {addingToColumn === col.status ? (
                  <div className="mt-2 space-y-1.5" style={{ padding: '0 10px 10px' }}>
                    <input
                      autoFocus
                      value={newCardDraft}
                      onChange={(e) => setNewCardDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void createCard(col.status);
                        if (e.key === 'Escape') { setAddingToColumn(null); setNewCardDraft(''); }
                      }}
                      placeholder={t('crm.workspace.kanban.cardNamePlaceholder')}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => void createCard(col.status)}
                        disabled={!newCardDraft.trim() || creatingCard}
                        className="rounded-lg bg-lumiva-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {creatingCard ? t('crm.workspace.common.updating') : t('crm.workspace.kanban.addCard')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAddingToColumn(null); setNewCardDraft(''); }}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setAddingToColumn(col.status); setNewCardDraft(''); }}
                    className="kb-add"
                  >
                    + {t('crm.workspace.kanban.addCard')}
                  </button>
                )}
              </DroppableRecordColumn>
            ))}
          </div>
          <DragOverlay>
            {/* DragOverlay portals to document.body, outside the .lv-kb scope its CSS classes rely on — re-establish it here (a real DOM ancestor, not just a class on the same node). */}
            {activeDragRecord ? (
              <div className="lv-kb">
                <div className="kb-card" style={{ cursor: 'grabbing', width: 268, boxShadow: '0 12px 28px rgba(16,24,40,.18)' }}>
                  <div className="kb-name">{getCardTitle(activeDragRecord)}</div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
          </DndContext>
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

