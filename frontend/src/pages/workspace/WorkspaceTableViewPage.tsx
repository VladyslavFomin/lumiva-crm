import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { MainLayout } from '../../layout/MainLayout';
import {
  createCustomObjectField,
  createCustomObjectRecord,
  deleteCustomObjectField,
  deleteCustomObjectRecord,
  fetchCustomObjectFields,
  fetchCustomObjectRecords,
  fetchCustomObjects,
  updateCustomObjectField,
  updateCustomObjectRecord,
  uploadWorkspaceFile,
  WORKSPACE_UPLOAD_MAX_FILE_LABEL,
  type CustomObject,
  type CustomObjectField,
  type CustomObjectFieldType,
  type CustomObjectRecord,
  type WorkspaceFileFieldValue,
} from '../../api/customObjects';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { WorkspaceViewTabs } from '../../components/workspace/WorkspaceViewTabs';
import { WorkspaceRecordDetailDrawer } from '../../components/workspace/WorkspaceRecordDetailDrawer';
import { WorkspaceFileViewerModal } from '../../components/workspace/WorkspaceFileViewerModal';
import {
  collectStatusValuesFromRecords,
  pickStatusLikeField,
} from '../../components/workspace/workspaceStatusField';

const GROUP_COLORS = ['#3b82f6', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#22c55e'];
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
const STATUS_PALETTE = [
  'bg-emerald-100 text-emerald-700 border border-emerald-200',
  'bg-amber-100 text-amber-700 border border-amber-200',
  'bg-sky-100 text-sky-700 border border-sky-200',
  'bg-rose-100 text-rose-700 border border-rose-200',
  'bg-violet-100 text-violet-700 border border-violet-200',
  'bg-teal-100 text-teal-700 border border-teal-200',
];
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
  if (!rgb) return '#111827';
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? '#0f172a' : '#ffffff';
};
const getInitials = (fullName: string) =>
  fullName
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
const slugOptionValue = (label: string) =>
  String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_а-яё-]/gi, '');
const normalizePriorityBucket = (raw: string) => {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return 'normal';
  if (
    v.includes('high') ||
    v.includes('urgent') ||
    v.includes('выс') ||
    v === 'option_3' ||
    v === 'option3'
  ) {
    return 'high';
  }
  if (v.includes('low') || v.includes('низ') || v === 'option_1' || v === 'option1') {
    return 'low';
  }
  return 'normal';
};

type Subitem = {
  id: string;
  values: Record<string, any>;
};

type DeleteDialogState =
  | { kind: 'column'; field: CustomObjectField }
  | { kind: 'group'; groupTitle: string; itemCount: number };

/** Позиция выпадашки owner/multiselect в viewport (для портала в body) */
type ActiveMultiCellState = {
  recordId: string;
  fieldKey: string;
  menuTop: number;
  menuLeft: number;
};

export const WorkspaceTableViewPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { objectId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const newGroupInputRef = useRef<HTMLInputElement>(null);

  const normalizePriorityLabel = useCallback(
    (raw: string) => {
      const v = String(raw || '').trim();
      if (!v) return t('crm.workspace.table.subitemPriority.normal');
      const vl = v.toLowerCase();
      if (
        vl.includes('high') ||
        vl.includes('urgent') ||
        vl.includes('выс') ||
        vl === 'option_3' ||
        vl === 'option3'
      ) {
        return t('crm.workspace.table.subitemPriority.high');
      }
      if (vl.includes('low') || vl.includes('низ') || vl === 'option_1' || vl === 'option1') {
        return t('crm.workspace.table.subitemPriority.low');
      }
      if (
        vl.includes('normal') ||
        vl.includes('medium') ||
        vl.includes('обыч') ||
        vl === 'option_2' ||
        vl === 'option2'
      ) {
        return t('crm.workspace.table.subitemPriority.normal');
      }
      return raw;
    },
    [t],
  );

  const subitemStatusOptions = useMemo(
    () =>
      [
        { value: 'todo', label: t('crm.workspace.table.subitemStatus.todo') },
        { value: 'in_progress', label: t('crm.workspace.table.subitemStatus.in_progress') },
        { value: 'review', label: t('crm.workspace.table.subitemStatus.review') },
        { value: 'blocked', label: t('crm.workspace.table.subitemStatus.blocked') },
        { value: 'done', label: t('crm.workspace.table.subitemStatus.done') },
      ] as const,
    [t],
  );

  const subitemPriorityOptions = useMemo(
    () => [
      { value: 'low', label: t('crm.workspace.table.subitemPriority.low') },
      { value: 'normal', label: t('crm.workspace.table.subitemPriority.normal') },
      { value: 'high', label: t('crm.workspace.table.subitemPriority.high') },
    ],
    [t],
  );

  const defaultFieldPresets = useMemo(
    () =>
      [
        { key: 'owner', label: t('crm.workspace.table.presetOwner'), type: 'text' as const, required: false },
        {
          key: 'priority',
          label: t('crm.workspace.table.presetPriority'),
          type: 'select' as const,
          options: [
            { value: 'low', label: t('crm.workspace.table.presetPriLow') },
            { value: 'medium', label: t('crm.workspace.table.presetPriMedium') },
            { value: 'high', label: t('crm.workspace.table.presetPriHigh') },
            { value: 'urgent', label: t('crm.workspace.table.presetPriUrgent') },
          ],
        },
        { key: 'due_date', label: t('crm.workspace.table.presetDueDate'), type: 'date' as const },
        {
          key: 'status',
          label: t('crm.workspace.table.presetStatus'),
          type: 'status' as const,
          options: [
            { value: 'working_on_it', label: t('crm.workspace.table.presetStWorking') },
            { value: 'done', label: t('crm.workspace.table.presetStDone') },
            { value: 'stuck', label: t('crm.workspace.table.presetStStuck') },
            { value: 'in_review', label: t('crm.workspace.table.presetStReview') },
          ],
        },
      ] as const,
    [t],
  );

  const [fields, setFields] = useState<CustomObjectField[]>([]);
  const [objectMeta, setObjectMeta] = useState<CustomObject['meta'] | null>(null);
  const [records, setRecords] = useState<CustomObjectRecord[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeRecord, setActiveRecord] = useState<CustomObjectRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savingRecordId, setSavingRecordId] = useState<string | null>(null);
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupError, setNewGroupError] = useState<string | null>(null);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [filterFieldKey, setFilterFieldKey] = useState('');
  const [filterFieldValue, setFilterFieldValue] = useState('');
  const [sortFieldKey, setSortFieldKey] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [groupByFieldKey, setGroupByFieldKey] = useState('');

  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [hiddenColumns, setHiddenColumns] = useState<Record<string, boolean>>({});
  const [groupHiddenColumns, setGroupHiddenColumns] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [rowOrderByGroup, setRowOrderByGroup] = useState<Record<string, string[]>>({});
  const [hiddenRows, setHiddenRows] = useState<Record<string, boolean>>({});
  const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null);
  const [dragReadyRowId, setDragReadyRowId] = useState<string | null>(null);
  const [holdingRowId, setHoldingRowId] = useState<string | null>(null);
  const [dragReadyColumnKey, setDragReadyColumnKey] = useState<string | null>(null);
  const [holdingColumnKey, setHoldingColumnKey] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{
    key: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [columnMenuState, setColumnMenuState] = useState<{
    key: string;
    groupTitle: string;
  } | null>(null);

  const [showAddField, setShowAddField] = useState(false);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomObjectFieldType>('text');
  const [newFieldOptionsText, setNewFieldOptionsText] = useState('');
  const [addingField, setAddingField] = useState(false);
  const [addFieldError, setAddFieldError] = useState<string | null>(null);
  const [activeMultiCell, setActiveMultiCell] = useState<ActiveMultiCellState | null>(null);
  const [activeSubitemOwnerMenu, setActiveSubitemOwnerMenu] = useState<{
    recordId: string;
    subitemId: string;
  } | null>(null);
  const [activePriorityMenu, setActivePriorityMenu] = useState<{ recordId: string; fieldKey: string } | null>(null);
  const [activeSubitemPriorityMenu, setActiveSubitemPriorityMenu] = useState<{
    recordId: string;
    subitemId: string;
  } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [rowMenuRecordId, setRowMenuRecordId] = useState<string | null>(null);
  const [bulkTargetGroup, setBulkTargetGroup] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [showEditField, setShowEditField] = useState(false);
  const [editingField, setEditingField] = useState<CustomObjectField | null>(null);
  const [editFieldKey, setEditFieldKey] = useState('');
  const [editFieldLabel, setEditFieldLabel] = useState('');
  const [editFieldType, setEditFieldType] = useState<CustomObjectFieldType>('text');
  const [editFieldOptionsText, setEditFieldOptionsText] = useState('');
  const [updatingField, setUpdatingField] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<{
    recordId: string;
    fieldKey: string;
    fileName: string;
    relativePath: string;
  } | null>(null);

  const [commentDraft, setCommentDraft] = useState('');
  const [commentsByRecord, setCommentsByRecord] = useState<
    Record<string, Array<{ id: string; text: string; createdAt: string; author: string }>>
  >({});
  const [activityByRecord, setActivityByRecord] = useState<
    Record<string, Array<{ id: string; text: string; createdAt: string }>>
  >({});
  const rowHoldTimerRef = useRef<number | null>(null);
  const columnHoldTimerRef = useRef<number | null>(null);

  const loadRecords = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const loadedRecords = await fetchCustomObjectRecords(objectId, search || undefined);
      setRecords(loadedRecords.items);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [loadedFields, loadedRecords, loadedStaff, objects] = await Promise.all([
        fetchCustomObjectFields(objectId),
        fetchCustomObjectRecords(objectId, search || undefined),
        fetchStaff().catch(() => [] as StaffUser[]),
        fetchCustomObjects().catch(() => [] as CustomObject[]),
      ]);
      setFields(loadedFields.filter((f) => f.isActive));
      setRecords(loadedRecords.items);
      setStaff(loadedStaff.filter((u) => u.isActive));
      const object = objects.find((item) => item.id === objectId);
      setObjectMeta((object?.meta as Record<string, any> | null) || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!objectId) return;
    void load();
  }, [objectId]);

  /** Сайдбар: «новая таблица» в области → фокус на блоке создания группы */
  useEffect(() => {
    if (searchParams.get('addGroup') !== '1' || loading) return;
    const t = window.setTimeout(() => {
      newGroupInputRef.current?.focus();
      newGroupInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev);
        n.delete('addGroup');
        return n;
      }, { replace: true });
    }, 200);
    return () => window.clearTimeout(t);
  }, [searchParams, setSearchParams, loading]);

  useEffect(() => {
    if (!objectId) return;
    void loadRecords();
  }, [search]);

  useEffect(() => {
    if (!activeRecord) return;
    const fresh = records.find((r) => r.id === activeRecord.id);
    if (fresh) setActiveRecord(fresh);
  }, [records, activeRecord?.id]);

  useEffect(() => {
    if (!objectId) return;
    try {
      const hiddenRaw = localStorage.getItem(`workspace_hidden_cols_${objectId}`);
      const groupHiddenRaw = localStorage.getItem(`workspace_hidden_cols_by_group_${objectId}`);
      const rowOrderRaw = localStorage.getItem(`workspace_row_order_${objectId}`);
      const hiddenRowsRaw = localStorage.getItem(`workspace_hidden_rows_${objectId}`);
      const commentsRaw = localStorage.getItem(`workspace_comments_${objectId}`);
      const activityRaw = localStorage.getItem(`workspace_activity_${objectId}`);
      if (hiddenRaw) setHiddenColumns(JSON.parse(hiddenRaw));
      if (groupHiddenRaw) setGroupHiddenColumns(JSON.parse(groupHiddenRaw));
      if (rowOrderRaw) setRowOrderByGroup(JSON.parse(rowOrderRaw));
      if (hiddenRowsRaw) setHiddenRows(JSON.parse(hiddenRowsRaw));
      if (commentsRaw) setCommentsByRecord(JSON.parse(commentsRaw));
      if (activityRaw) setActivityByRecord(JSON.parse(activityRaw));
    } catch {
      // ignore
    }
  }, [objectId]);

  useEffect(() => {
    if (!objectId) return;
    try {
      localStorage.setItem(`workspace_hidden_cols_${objectId}`, JSON.stringify(hiddenColumns));
      localStorage.setItem(
        `workspace_hidden_cols_by_group_${objectId}`,
        JSON.stringify(groupHiddenColumns),
      );
      localStorage.setItem(`workspace_row_order_${objectId}`, JSON.stringify(rowOrderByGroup));
      localStorage.setItem(`workspace_hidden_rows_${objectId}`, JSON.stringify(hiddenRows));
      localStorage.setItem(`workspace_comments_${objectId}`, JSON.stringify(commentsByRecord));
      localStorage.setItem(`workspace_activity_${objectId}`, JSON.stringify(activityByRecord));
    } catch {
      // ignore
    }
  }, [
    objectId,
    hiddenColumns,
    groupHiddenColumns,
    rowOrderByGroup,
    hiddenRows,
    commentsByRecord,
    activityByRecord,
  ]);

  const visibleColumns = useMemo(
    () =>
      fields.length > 0
        ? fields
        : [{ id: 'fallback', key: 'name', label: 'Name', type: 'text' } as CustomObjectField],
    [fields],
  );

  useEffect(() => {
    setColumnOrder((prev) => {
      const keys = visibleColumns.map((c) => c.key);
      if (!prev.length) return keys;
      const filtered = prev.filter((k) => keys.includes(k));
      const missing = keys.filter((k) => !filtered.includes(k));
      return [...filtered, ...missing];
    });
  }, [visibleColumns]);

  const orderedColumns = useMemo(() => {
    const map = new Map(visibleColumns.map((c) => [c.key, c]));
    const order = columnOrder.length > 0 ? columnOrder : visibleColumns.map((c) => c.key);
    const result: CustomObjectField[] = [];
    order.forEach((key) => {
      const field = map.get(key);
      if (field && !hiddenColumns[key]) result.push(field);
    });
    visibleColumns.forEach((field) => {
      if (!hiddenColumns[field.key] && !result.find((r) => r.key === field.key)) result.push(field);
    });
    return result;
  }, [visibleColumns, columnOrder, hiddenColumns]);

  const hiddenColumnList = useMemo(
    () => visibleColumns.filter((f) => hiddenColumns[f.key]),
    [visibleColumns, hiddenColumns],
  );
  const hiddenRowsCount = useMemo(
    () => Object.values(hiddenRows).filter(Boolean).length,
    [hiddenRows],
  );

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const next = Math.max(120, resizing.startWidth + (e.clientX - resizing.startX));
      setColumnWidths((prev) => ({ ...prev, [resizing.key]: next }));
    };
    const onUp = () => setResizing(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizing]);

  useEffect(() => {
    const hasOpen =
      activeMultiCell != null ||
      activePriorityMenu != null ||
      activeSubitemOwnerMenu != null ||
      activeSubitemPriorityMenu != null;
    if (!hasOpen) return;

    const closeInlineMenus = () => {
      setActiveMultiCell(null);
      setActivePriorityMenu(null);
      setActiveSubitemOwnerMenu(null);
      setActiveSubitemPriorityMenu(null);
    };

    const onOutsidePointer = (e: MouseEvent | PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-workspace-inline-popover]')) return;
      closeInlineMenus();
    };

    // window + mousedown & pointerdown: надёжнее, чем только document/mousedown (тач, перекрытия)
    window.addEventListener('mousedown', onOutsidePointer, true);
    window.addEventListener('pointerdown', onOutsidePointer, true);
    // смена окна/вкладки браузера — закрыть выпадашку
    window.addEventListener('blur', closeInlineMenus);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeInlineMenus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onOutsidePointer, true);
      window.removeEventListener('pointerdown', onOutsidePointer, true);
      window.removeEventListener('blur', closeInlineMenus);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeMultiCell, activePriorityMenu, activeSubitemOwnerMenu, activeSubitemPriorityMenu]);

  useEffect(() => {
    if (!activeMultiCell) return;
    const close = () => setActiveMultiCell(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [activeMultiCell]);

  const titleField = useMemo(
    () =>
      orderedColumns.find((f) => f.key === 'name') ||
      orderedColumns.find((f) => f.key === 'title') ||
      orderedColumns[0],
    [orderedColumns],
  );
  /* Полный список fields + meta.kanban.statusFieldKey — как в канбане; orderedColumns мог скрыть колонку или не совпасть с выбранным в meta полем. */
  const statusField = useMemo(
    () =>
      pickStatusLikeField(
        fields.length > 0 ? fields : visibleColumns,
        objectMeta as Record<string, any> | null,
      ),
    [fields, visibleColumns, objectMeta],
  );
  /** Как в канбане: в API уходит ровно option.value из схемы, а не нормализованный токен из выпадашки. */
  const canonicalStatusPayloadValue = (field: CustomObjectField, uiValue: string) => {
    const opts = field.options;
    if (!opts?.length) return uiValue;
    const norm = (s: string) =>
      String(s || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_а-яё-]/gi, '');
    const token = norm(uiValue);
    const hit = opts.find((o) => norm(String(o.value || o.label || '')) === token);
    return hit ? String(hit.value ?? '').trim() || uiValue : uiValue;
  };
  const groupField = useMemo(
    () => orderedColumns.find((f) => f.key === 'group' || f.key === 'group_name'),
    [orderedColumns],
  );
  const effectiveGroupKey = groupByFieldKey || groupField?.key || 'group';
  const isPrimaryGrouping = effectiveGroupKey === (groupField?.key || 'group');
  const numberField = useMemo(
    () => orderedColumns.find((f) => f.type === 'number'),
    [orderedColumns],
  );
  const priorityField = useMemo(
    () =>
      orderedColumns.find((f) => {
        const key = f.key.toLowerCase();
        const label = f.label.toLowerCase();
        return key.includes('priority') || label.includes('priority') || label.includes('приоритет');
      }) || null,
    [orderedColumns],
  );

  const statusOptions = useMemo(() => {
    const fromField =
      statusField?.options?.map((o) => String(o.value || '').trim()).filter(Boolean) || [];
    const fromRecords = statusField
      ? collectStatusValuesFromRecords(records, statusField.key)
      : [];
    const merged = [...new Set([...fromField, ...fromRecords])].filter(Boolean);
    if (merged.length) return merged;
    return ['working_on_it', 'done', 'stuck', 'in_review'];
  }, [statusField, records]);
  const normalizeStatusToken = (value: string) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_а-яё-]/gi, '');
  const statusLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    statusField?.options?.forEach((o) => {
      const value = String(o.value || '').trim();
      if (!value) return;
      map[value] = o.label || o.value;
    });
    statusOptions.forEach((opt) => {
      if (!map[opt]) map[opt] = opt.replace(/_/g, ' ');
    });
    return map;
  }, [statusField, statusOptions]);
  const statusColorMap = useMemo(() => {
    const raw = statusField?.meta?.statusColors;
    const map: Record<string, string> = {};
    if (raw && typeof raw === 'object') {
      Object.entries(raw as Record<string, any>).forEach(([key, value]) => {
        const normalizedKey = normalizeStatusToken(key);
        if (normalizedKey && typeof value === 'string' && value.trim()) {
          map[normalizedKey] = value.trim();
        }
      });
    }
    return map;
  }, [statusField]);
  const resolveStatusOptionValue = (value: string) => {
    const normalized = normalizeStatusToken(value);
    if (!normalized) return '';
    const byValue = statusOptions.find((opt) => normalizeStatusToken(opt) === normalized);
    if (byValue) return byValue;
    const byLabel = Object.entries(statusLabelMap).find(
      ([, label]) => normalizeStatusToken(label) === normalized,
    );
    if (byLabel?.[0]) return byLabel[0];
    return normalized;
  };

  const staffByDepartment = useMemo(() => {
    const map = new Map<string, StaffUser[]>();
    staff.forEach((user) => {
      const department = user.department?.trim() || t('crm.workspace.table.withoutDepartment');
      const list = map.get(department) || [];
      list.push(user);
      map.set(department, list);
    });
    return Array.from(map.entries()).map(([department, users]) => ({
      department,
      users: [...users].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    }));
  }, [staff, t]);

  const fieldValueOptions = useMemo(() => {
    if (!filterFieldKey) return [];
    const values = new Set<string>();
    records.forEach((record) => {
      const raw = record.values?.[filterFieldKey];
      if (raw === undefined || raw === null || raw === '') return;
      if (Array.isArray(raw)) {
        raw.forEach((value) => {
          const normalized = String(value || '').trim();
          if (normalized) values.add(normalized);
        });
        return;
      }
      const text = String(raw).trim();
      if (text) values.add(text);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [filterFieldKey, records]);

  const filteredAndSortedRecords = useMemo(() => {
    let list = [...records];
    if (filterFieldKey && filterFieldValue) {
      const needle = filterFieldValue.trim().toLowerCase();
      list = list.filter((record) => {
        const raw = record.values?.[filterFieldKey];
        if (raw === undefined || raw === null) return false;
        if (Array.isArray(raw)) {
          return raw.some((value) => String(value || '').trim().toLowerCase() === needle);
        }
        return String(raw).trim().toLowerCase() === needle;
      });
    }
    if (sortFieldKey) {
      list.sort((a, b) => {
        const av = a.values?.[sortFieldKey];
        const bv = b.values?.[sortFieldKey];
        const aNum = Number(av);
        const bNum = Number(bv);
        const bothNumeric = Number.isFinite(aNum) && Number.isFinite(bNum);
        const delta = bothNumeric
          ? aNum - bNum
          : String(av ?? '').localeCompare(String(bv ?? ''), undefined, { sensitivity: 'base' });
        return sortDirection === 'asc' ? delta : -delta;
      });
    }
    return list;
  }, [records, filterFieldKey, filterFieldValue, sortFieldKey, sortDirection]);

  const groupedRecords = useMemo(() => {
    const map = new Map<string, CustomObjectRecord[]>();
    filteredAndSortedRecords.forEach((record) => {
      const key =
        String(
          record.values?.[effectiveGroupKey] || record.values?.group || t('crm.workspace.table.groupTitle'),
        ) || t('crm.workspace.table.groupTitle');
      const list = map.get(key) || [];
      list.push(record);
      map.set(key, list);
    });
    return Array.from(map.entries()).map(([title, items], idx) => {
      const order = rowOrderByGroup[title] || [];
      const orderIndex = new Map(order.map((id, i) => [id, i]));
      const sortedItems = [...items].sort((a, b) => {
        const ai = orderIndex.get(a.id);
        const bi = orderIndex.get(b.id);
        if (ai === undefined && bi === undefined) return 0;
        if (ai === undefined) return 1;
        if (bi === undefined) return -1;
        return ai - bi;
      });
      return {
        title,
        items: sortedItems,
        color: GROUP_COLORS[idx % GROUP_COLORS.length],
      };
    });
  }, [filteredAndSortedRecords, effectiveGroupKey, rowOrderByGroup, t]);
  const groupTitles = useMemo(
    () => groupedRecords.map((g) => g.title),
    [groupedRecords],
  );

  const getStatusColor = (value: string) => {
    const idx = hashString(value || 'status') % STATUS_PALETTE.length;
    return STATUS_PALETTE[idx];
  };
  const getStatusStyle = (value: string): React.CSSProperties | undefined => {
    const statusKey = resolveStatusOptionValue(value);
    const hex = statusColorMap[statusKey];
    if (!hex) return undefined;
    return {
      backgroundColor: hex,
      color: pickTextColorForBg(hex),
      borderColor: hex,
    };
  };
  const getStatusLabel = (value: string) =>
    statusLabelMap[resolveStatusOptionValue(value)] || value.replace(/_/g, ' ');
  const getRowStatusHex = (record: CustomObjectRecord) => {
    if (!statusField) return null;
    const raw = String(record.values?.[statusField.key] || '').trim();
    const key = resolveStatusOptionValue(raw);
    if (!key) return null;
    return statusColorMap[key] || null;
  };
  const getPriorityStripColor = (value: string) => {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'high' || normalized === 'urgent' || normalized === 'высокий') {
      return 'bg-rose-500';
    }
    if (normalized === 'low' || normalized === 'низкий') {
      return 'bg-emerald-500';
    }
    return 'bg-slate-400';
  };
  const getPriorityStripHex = (value: string) => {
    const bucket = normalizePriorityBucket(value);
    if (bucket === 'high') {
      return '#f43f5e';
    }
    if (bucket === 'low') {
      return '#22c55e';
    }
    return '#f59e0b';
  };
  const getSubitemStatusColor = (value: string) => {
    const map: Record<string, string> = {
      todo: 'bg-slate-100 text-slate-700 border border-slate-200',
      in_progress: 'bg-sky-100 text-sky-700 border border-sky-200',
      review: 'bg-violet-100 text-violet-700 border border-violet-200',
      blocked: 'bg-rose-100 text-rose-700 border border-rose-200',
      done: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    };
    return map[value] || 'bg-slate-100 text-slate-700 border border-slate-200';
  };
  const getSubitemPriorityColor = (value: string) => {
    const map: Record<string, string> = {
      low: 'bg-emerald-100 text-emerald-700',
      normal: 'bg-slate-200 text-slate-700',
      high: 'bg-rose-100 text-rose-700',
    };
    return map[value] || 'bg-slate-200 text-slate-700';
  };

  const getDefaultValueForField = (field: CustomObjectField) => {
    const maybePerson =
      field.key.includes('person') ||
      field.key.includes('assignee') ||
      field.key.includes('owner') ||
      field.key.includes('responsible');
    if (maybePerson) return staff[0]?.fullName || t('crm.workspace.table.unassigned');
    if (field.type === 'number') return 0;
    if (field.type === 'boolean') return false;
    if (field.type === 'date') return new Date().toISOString().slice(0, 10);
    if (field.type === 'datetime') return new Date().toISOString();
    if (field.type === 'status' || field.type === 'select')
      return field.options?.[0]?.value || 'working_on_it';
    if (field.type === 'multiselect') return field.options?.[0]?.value || '';
    if (field.type === 'file') return null;
    return '';
  };

  const buildRequiredDefaults = (baseValues: Record<string, any>) => {
    const next = { ...baseValues };
    fields.forEach((field) => {
      if (!field.required) return;
      const current = next[field.key];
      if (current === undefined || current === null || current === '') {
        next[field.key] = getDefaultValueForField(field);
      }
    });
    return next;
  };

  const sanitizeFieldValueForDuplicate = (field: CustomObjectField, raw: any) => {
    if (raw === undefined) return undefined;
    if (raw === null) return null;
    if (field.type === 'status' || field.type === 'select') {
      const options = field.options || [];
      if (!options.length) return raw;
      const rawText = String(raw).trim();
      const byValue = options.find((opt) => String(opt.value) === rawText);
      if (byValue) return byValue.value;
      const byLabel = options.find(
        (opt) => String(opt.label || '').trim().toLowerCase() === rawText.toLowerCase(),
      );
      return byLabel?.value ?? options[0]?.value ?? null;
    }
    if (field.type === 'multiselect') {
      const options = field.options || [];
      const optionValues = new Set(options.map((opt) => String(opt.value)));
      const optionLabels = new Map(
        options.map((opt) => [String(opt.label || '').trim().toLowerCase(), String(opt.value)]),
      );
      const list = Array.isArray(raw)
        ? raw.map((v) => String(v).trim()).filter(Boolean)
        : String(raw)
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
      if (!options.length) return list;
      return list
        .map((v) => (optionValues.has(v) ? v : optionLabels.get(v.toLowerCase()) || null))
        .filter(Boolean);
    }
    if (field.type === 'file') {
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return { ...(raw as WorkspaceFileFieldValue) };
      }
      return raw;
    }
    return raw;
  };

  useEffect(() => {
    return () => {
      if (rowHoldTimerRef.current) {
        window.clearTimeout(rowHoldTimerRef.current);
      }
      if (columnHoldTimerRef.current) {
        window.clearTimeout(columnHoldTimerRef.current);
      }
    };
  }, []);

  const clearRowHoldTimer = () => {
    if (rowHoldTimerRef.current) {
      window.clearTimeout(rowHoldTimerRef.current);
      rowHoldTimerRef.current = null;
    }
  };
  const clearColumnHoldTimer = () => {
    if (columnHoldTimerRef.current) {
      window.clearTimeout(columnHoldTimerRef.current);
      columnHoldTimerRef.current = null;
    }
  };

  const getRecordGroupTitle = (record: CustomObjectRecord) =>
    String(record.values?.[effectiveGroupKey] || record.values?.group || 'Group Title');

  const armRowDragAfterHold = (recordId: string) => {
    clearRowHoldTimer();
    setHoldingRowId(recordId);
    rowHoldTimerRef.current = window.setTimeout(() => {
      setDragReadyRowId(recordId);
      setHoldingRowId(null);
    }, 500);
  };
  const armColumnDragAfterHold = (fieldKey: string) => {
    clearColumnHoldTimer();
    setHoldingColumnKey(fieldKey);
    columnHoldTimerRef.current = window.setTimeout(() => {
      setDragReadyColumnKey(fieldKey);
      setHoldingColumnKey(null);
    }, 500);
  };

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
      setActionError(null);
      const valuesForRequest =
        changedField && Object.prototype.hasOwnProperty.call(nextValues, changedField)
          ? { [changedField]: nextValues[changedField] }
          : nextValues;
      await updateCustomObjectRecord(objectId, record.id, {
        externalId: record.externalId || undefined,
        values: valuesForRequest,
      });
      if (changedField) {
        const field = visibleColumns.find((f) => f.key === changedField);
        pushActivity(
          record.id,
          t('crm.workspace.table.activityUpdated', { field: field?.label || changedField }),
        );
      }
      await loadRecords();
    } catch (error) {
      console.error('Failed to save record', { recordId: record.id, changedField, error });
      const msg =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : t('crm.workspace.table.saveRecordFailed');
      setActionError(msg);
    } finally {
      setSavingRecordId(null);
    }
  };

  const updateCell = (
    record: CustomObjectRecord,
    field: CustomObjectField,
    value: string | WorkspaceFileFieldValue | null,
    forceFullPayload = false,
  ) => {
    const isStatusLikeColumn =
      statusField &&
      field.key === statusField.key &&
      (field.type === 'status' || field.type === 'select');
    const storedValue =
      field.type === 'file'
        ? value
        : isStatusLikeColumn
          ? canonicalStatusPayloadValue(field, value as string)
          : value;
    const nextValues = { ...(record.values || {}), [field.key]: storedValue };
    const isPriorityLike =
      field.key.toLowerCase().includes('priority') ||
      field.label.toLowerCase().includes('priority') ||
      field.label.toLowerCase().includes('приоритет');
    void saveRecord(
      record,
      nextValues,
      forceFullPayload || isPriorityLike ? undefined : field.key,
    );
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createRowInGroup = async (groupTitle: string) => {
    if (!titleField) return;
    setSavingRecordId(`new-${groupTitle}`);
    try {
      const payloadBase: Record<string, any> = {
        [titleField.key]: t('crm.workspace.table.newItem'),
        [effectiveGroupKey]: groupTitle,
      };
      if (statusField) payloadBase[statusField.key] = statusOptions[0] || 'working_on_it';
      const payload = buildRequiredDefaults(payloadBase);
      await createCustomObjectRecord(objectId, { values: payload });
      await loadRecords();
    } finally {
      setSavingRecordId(null);
    }
  };

  const createGroup = async () => {
    if (!newGroupTitle.trim()) {
      setNewGroupError(t('crm.workspace.table.newGroupNameRequired'));
      return;
    }
    if (!titleField) return;
    setNewGroupError(null);
    setCreatingGroup(true);
    try {
      const payloadBase: Record<string, any> = {
        [titleField.key]: t('crm.workspace.table.groupFirstRowTitle', { name: newGroupTitle.trim() }),
        [effectiveGroupKey]: newGroupTitle.trim(),
      };
      if (statusField) payloadBase[statusField.key] = statusOptions[0] || 'working_on_it';
      const payload = buildRequiredDefaults(payloadBase);
      await createCustomObjectRecord(objectId, { values: payload });
      setNewGroupTitle('');
      setNewGroupError(null);
      await loadRecords();
    } finally {
      setCreatingGroup(false);
    }
  };

  const moveRecordToGroup = async (recordId: string, targetGroup: string) => {
    const record = records.find((r) => r.id === recordId);
    if (!record) return;
    const nextValues = {
      ...(record.values || {}),
      [effectiveGroupKey]: targetGroup,
    };
    await saveRecord(record, nextValues, effectiveGroupKey);
  };

  const reorderRowsInsideGroup = (groupTitle: string, sourceRowId: string, targetRowId: string) => {
    setRowOrderByGroup((prev) => {
      const fallbackOrder =
        groupedRecords.find((g) => g.title === groupTitle)?.items.map((item) => item.id) || [];
      const current = (prev[groupTitle] || fallbackOrder).filter((id) => fallbackOrder.includes(id));
      const from = current.indexOf(sourceRowId);
      const to = current.indexOf(targetRowId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, sourceRowId);
      return { ...prev, [groupTitle]: next };
    });
  };

  const duplicateRow = async (record: CustomObjectRecord) => {
    setActionError(null);
    try {
      const nextValues: Record<string, any> = {};
      fields.forEach((field) => {
        const sanitized = sanitizeFieldValueForDuplicate(field, record.values?.[field.key]);
        if (sanitized !== undefined) nextValues[field.key] = sanitized;
      });
      if (titleField) {
        const base = String(nextValues[titleField.key] || record.values?.[titleField.key] || 'Item').trim();
        nextValues[titleField.key] = `${base} (copy)`;
      }
      const payload = buildRequiredDefaults(nextValues);
      const created = await createCustomObjectRecord(objectId, { values: payload });
      const groupTitle = getRecordGroupTitle(record);
      setRowOrderByGroup((prev) => {
        const fallbackOrder =
          groupedRecords.find((g) => g.title === groupTitle)?.items.map((item) => item.id) || [];
        const current = (prev[groupTitle] || fallbackOrder).filter((id) => fallbackOrder.includes(id));
        const sourceIndex = current.indexOf(record.id);
        if (sourceIndex < 0) return { ...prev, [groupTitle]: [...current, created.id] };
        const next = [...current];
        next.splice(sourceIndex + 1, 0, created.id);
        return { ...prev, [groupTitle]: next };
      });
      await loadRecords();
    } catch (e: any) {
      setActionError(e?.message || 'Failed to duplicate row');
    }
  };

  const deleteRow = async (recordId: string) => {
    await deleteCustomObjectRecord(objectId, recordId);
    await loadRecords();
  };

  const bulkHideRows = () => {
    if (selectedIds.size === 0) return;
    setHiddenRows((prev) => {
      const next = { ...prev };
      Array.from(selectedIds).forEach((id) => {
        next[id] = true;
      });
      return next;
    });
    setSelectedIds(new Set());
  };

  const bulkDeleteRows = async () => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => deleteCustomObjectRecord(objectId, id)));
      setSelectedIds(new Set());
      await loadRecords();
    } finally {
      setBulkProcessing(false);
    }
  };

  const bulkMoveRowsToGroup = async () => {
    if (selectedIds.size === 0 || !bulkTargetGroup.trim()) return;
    setBulkProcessing(true);
    try {
      const groupKey = effectiveGroupKey;
      const selectedRecords = records.filter((r) => selectedIds.has(r.id));
      await Promise.all(
        selectedRecords.map((record) =>
          updateCustomObjectRecord(objectId, record.id, {
            externalId: record.externalId || undefined,
            values: { [groupKey]: bulkTargetGroup.trim() },
          }),
        ),
      );
      setSelectedIds(new Set());
      await loadRecords();
    } finally {
      setBulkProcessing(false);
    }
  };

  const parseOptions = (input: string) =>
    input
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => ({ value: v.toLowerCase().replace(/\s+/g, '_'), label: v }));

  const normalizeFieldKey = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, '_')
      .replace(/^_+|_+$/g, '');

  const openEditColumn = (field: CustomObjectField) => {
    setEditingField(field);
    setEditFieldKey(field.key);
    setEditFieldLabel(field.label);
    setEditFieldType(field.type);
    setEditFieldOptionsText((field.options || []).map((o) => o.label || o.value).join(', '));
    setShowEditField(true);
  };

  const saveEditedColumn = async () => {
    if (!editingField || !editFieldLabel.trim()) return;
    const normalizedKey = normalizeFieldKey(editFieldKey);
    if (!normalizedKey) return;
    setUpdatingField(true);
    try {
      await updateCustomObjectField(objectId, editingField.id, {
        key: normalizedKey,
        label: editFieldLabel.trim(),
        type: editFieldType,
        options:
          editFieldType === 'select' || editFieldType === 'status' || editFieldType === 'multiselect'
            ? parseOptions(editFieldOptionsText)
            : undefined,
      });
      setShowEditField(false);
      setEditingField(null);
      await load();
    } finally {
      setUpdatingField(false);
    }
  };

  const handleAddField = async () => {
    if (!newFieldLabel.trim()) {
      setAddFieldError(t('crm.workspace.table.addFieldEmptyLabel'));
      return;
    }
    const normalizedKey = normalizeFieldKey(newFieldKey || newFieldLabel);
    if (!normalizedKey) {
      setAddFieldError(t('crm.workspace.table.addFieldInvalidKey'));
      return;
    }
    setAddFieldError(null);
    setAddingField(true);
    try {
      await createCustomObjectField(objectId, {
        key: normalizedKey,
        label: newFieldLabel.trim(),
        type: newFieldType,
        options:
          newFieldType === 'select' ||
          newFieldType === 'status' ||
          newFieldType === 'multiselect'
            ? parseOptions(newFieldOptionsText)
            : undefined,
      });
      setNewFieldKey('');
      setNewFieldLabel('');
      setNewFieldType('text');
      setNewFieldOptionsText('');
      setAddFieldError(null);
      setShowAddField(false);
      await load();
    } finally {
      setAddingField(false);
    }
  };

  const applyPreset = async (preset: (typeof defaultFieldPresets)[number]) => {
    await createCustomObjectField(objectId, preset);
    await load();
  };

  const duplicateColumn = async (field: CustomObjectField) => {
    const baseKey = `${field.key}_copy`;
    const existingKeys = new Set(visibleColumns.map((f) => f.key));
    let key = baseKey;
    let i = 1;
    while (existingKeys.has(key)) {
      key = `${baseKey}_${i++}`;
    }
    await createCustomObjectField(objectId, {
      key,
      label: `${field.label}${t('crm.workspace.table.fieldCopySuffix')}`,
      type: field.type,
      options: field.options || undefined,
      required: false,
    });
    await load();
  };

  const deleteColumnInGroup = (groupTitle: string, fieldKey: string) => {
    setGroupHiddenColumns((prev) => ({
      ...prev,
      [groupTitle]: {
        ...(prev[groupTitle] || {}),
        [fieldKey]: true,
      },
    }));
  };

  const deleteGroup = async (groupTitle: string) => {
    const groupRecords = groupedRecords.find((g) => g.title === groupTitle)?.items || [];
    if (!groupRecords.length) return;
    setDeleteDialog({ kind: 'group', groupTitle, itemCount: groupRecords.length });
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;
    setDeleting(true);
    try {
      if (deleteDialog.kind === 'column') {
        await deleteCustomObjectField(objectId, deleteDialog.field.id);
        await load();
      } else {
        const groupRecords = groupedRecords.find((g) => g.title === deleteDialog.groupTitle)?.items || [];
        await Promise.all(groupRecords.map((record) => deleteCustomObjectRecord(objectId, record.id)));
        await loadRecords();
      }
      setDeleteDialog(null);
    } finally {
      setDeleting(false);
    }
  };

  const getSubitems = (record: CustomObjectRecord): Subitem[] => {
    const source = record.values?.__subitems;
    return Array.isArray(source) ? (source as Subitem[]) : [];
  };

  const addSubitem = async (record: CustomObjectRecord) => {
    const subitems = getSubitems(record);
    const next: Subitem[] = [
      ...subitems,
      {
        id: crypto.randomUUID(),
        values: {
          name: t('crm.workspace.table.subitemDefaultName'),
          owner: '',
          status: 'todo',
          priority: 'normal',
          due_date: '',
        },
      },
    ];
    await saveRecord(record, { ...(record.values || {}), __subitems: next }, '__subitems');
    setExpandedRows((prev) => ({ ...prev, [record.id]: true }));
  };

  const updateSubitem = async (
    record: CustomObjectRecord,
    subitemId: string,
    key: string,
    value: string,
  ) => {
    const next = getSubitems(record).map((subitem) =>
      subitem.id === subitemId
        ? { ...subitem, values: { ...(subitem.values || {}), [key]: value } }
        : subitem,
    );
    await saveRecord(record, { ...(record.values || {}), __subitems: next }, '__subitems');
  };

  const deleteSubitem = async (record: CustomObjectRecord, subitemId: string) => {
    const next = getSubitems(record).filter((subitem) => subitem.id !== subitemId);
    await saveRecord(record, { ...(record.values || {}), __subitems: next }, '__subitems');
  };

  const parseOwnerValues = (raw: any) =>
    String(raw || '')
      .split(/[,;/]+/)
      .map((v) => v.trim())
      .filter(Boolean);

  const toggleSubitemOwner = async (
    record: CustomObjectRecord,
    subitemId: string,
    ownerName: string,
  ) => {
    const subitem = getSubitems(record).find((s) => s.id === subitemId);
    const owners = parseOwnerValues(subitem?.values?.owner);
    const nextOwners = owners.includes(ownerName)
      ? owners.filter((name) => name !== ownerName)
      : [...owners, ownerName];
    await updateSubitem(record, subitemId, 'owner', nextOwners.join(', '));
  };

  const toggleSubitemDepartment = async (
    record: CustomObjectRecord,
    subitemId: string,
    users: StaffUser[],
  ) => {
    const subitem = getSubitems(record).find((s) => s.id === subitemId);
    const owners = parseOwnerValues(subitem?.values?.owner);
    const userNames = users.map((u) => u.fullName);
    const everySelected = userNames.every((name) => owners.includes(name));
    const nextOwners = everySelected
      ? owners.filter((name) => !userNames.includes(name))
      : Array.from(new Set([...owners, ...userNames]));
    await updateSubitem(record, subitemId, 'owner', nextOwners.join(', '));
  };

  const getMobilePreviewFieldRank = (field: CustomObjectField) => {
    const key = field.key.toLowerCase();
    const label = field.label.toLowerCase();
    if (field.type === 'status' || key.includes('status') || label.includes('статус')) return 0;
    if (key.includes('priority') || label.includes('priority') || label.includes('приоритет')) return 1;
    if (
      key.includes('owner') ||
      key.includes('assignee') ||
      key.includes('person') ||
      key.includes('responsible') ||
      label.includes('owner') ||
      label.includes('ответ')
    ) {
      return 2;
    }
    if (field.type === 'date' || field.type === 'datetime') return 3;
    return 10;
  };

  const getMobilePreviewValue = (record: CustomObjectRecord, field: CustomObjectField) => {
    const raw = record.values?.[field.key];
    if (raw === undefined || raw === null || raw === '') return '';

    if (field.type === 'status') {
      return getStatusLabel(String(raw));
    }

    if (field.type === 'date' || field.type === 'datetime') {
      const date = new Date(String(raw));
      if (Number.isNaN(date.getTime())) return String(raw);
      if (field.type === 'datetime') {
        return date.toLocaleString(i18n.language, {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      return date.toLocaleDateString(i18n.language);
    }

    if (field.type === 'boolean') {
      return Boolean(raw)
        ? t('crm.workspace.table.booleanYes')
        : t('crm.workspace.table.booleanNo');
    }

    if (field.type === 'multiselect') {
      const list = Array.isArray(raw)
        ? (raw as string[])
        : String(raw)
            .split(/[,;/]+/)
            .map((value) => value.trim())
            .filter(Boolean);
      if (!list.length) return '';
      const compact = list.slice(0, 2).join(', ');
      return list.length > 2 ? `${compact} +${list.length - 2}` : compact;
    }

    if (field.type === 'select') {
      const value = String(raw);
      const byOption = field.options?.find((opt) => String(opt.value) === value)?.label || value;
      const key = field.key.toLowerCase();
      const label = field.label.toLowerCase();
      if (key.includes('priority') || label.includes('priority') || label.includes('приоритет')) {
        return normalizePriorityLabel(byOption);
      }
      return byOption;
    }

    const maybePerson =
      field.key.includes('person') ||
      field.key.includes('assignee') ||
      field.key.includes('owner') ||
      field.key.includes('responsible');
    if (maybePerson) {
      const owners = parseOwnerValues(raw);
      if (!owners.length) return '';
      const compact = owners.slice(0, 2).map(getInitials).join(' ');
      return owners.length > 2 ? `${compact} +${owners.length - 2}` : compact;
    }

    return String(raw);
  };

  const renderDateInput = (
    record: CustomObjectRecord,
    field: CustomObjectField,
    value: string,
    type: 'date' | 'datetime',
    stickyClass: string,
    width: number,
  ) => (
    <td key={field.id} className={`px-3 py-1.5 min-w-0 overflow-hidden ${stickyClass} border-y border-slate-200`} style={{ width, minWidth: 120 }}>
      <div className="relative">
        <span className="absolute left-2 top-1.5 text-slate-400 pointer-events-none">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-4 w-4"
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M16 3v4M8 3v4M3 10h18" />
          </svg>
        </span>
        <input
          type="text"
          inputMode="numeric"
          defaultValue={type === 'date' ? value.slice(0, 10) : value.slice(0, 16)}
          onBlur={(e) => updateCell(record, field, e.target.value)}
          placeholder={
            type === 'date'
              ? t('crm.workspace.table.datePlaceholder')
              : t('crm.workspace.table.datetimePlaceholder')
          }
          className="block w-full max-w-full md:hidden rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-2 py-1.5 text-xs leading-5 focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
        />
        <input
          type={type === 'date' ? 'date' : 'datetime-local'}
          lang={i18n.language}
          defaultValue={type === 'date' ? value.slice(0, 10) : value.slice(0, 16)}
          onBlur={(e) => updateCell(record, field, e.target.value)}
          className="hidden md:block w-full max-w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-7 py-1.5 text-xs leading-5 focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
        />
      </div>
    </td>
  );

  const isRenderableDateField = (field: CustomObjectField) => {
    const type = String(field.type || '').toLowerCase();
    if (type !== 'date' && type !== 'datetime') return false;
    const key = String(field.key || '').toLowerCase();
    const label = String(field.label || '').toLowerCase();
    const isIdLike =
      key.endsWith('id') ||
      key.includes('_id') ||
      key.includes('id_') ||
      label.endsWith(' id');
    if (isIdLike) return false;
    return true;
  };

  const renderCell = (record: CustomObjectRecord, field: CustomObjectField) => {
    const value = record.values?.[field.key];
    const textValue = String(value ?? '');
    const width = columnWidths[field.key] || 180;
    const sticky = field.key === titleField?.key ? 'md:sticky md:left-44 bg-white md:z-10' : '';
    const fieldType = String(field.type || '').toLowerCase();
    const isDateField = isRenderableDateField(field);

    if (field.type === 'file') {
      const raw = record.values?.[field.key];
      const fileVal =
        raw && typeof raw === 'object' && !Array.isArray(raw)
          ? (raw as WorkspaceFileFieldValue)
          : null;
      const has = Boolean(fileVal?.relativePath && fileVal?.name);
      const inputId = `ws-file-${record.id}-${field.key}`;
      return (
        <td
          key={field.id}
          className={`px-3 py-1.5 ${sticky} border-y border-slate-200`}
          style={{ width, minWidth: 160 }}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2">
            <input
              id={inputId}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.rtf,.odt,.ods"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  setSavingRecordId(record.id);
                  setActionError(null);
                  const uploaded = await uploadWorkspaceFile(objectId, f);
                  updateCell(record, field, uploaded);
                } catch (err) {
                  console.error(err);
                  setActionError(
                    err instanceof Error ? err.message : t('crm.workspace.recordDrawer.uploadFailed'),
                  );
                } finally {
                  setSavingRecordId(null);
                }
              }}
            />
            {has ? (
              <button
                type="button"
                onClick={() =>
                  setFilePreview({
                    recordId: record.id,
                    fieldKey: field.key,
                    fileName: fileVal!.name,
                    relativePath: fileVal!.relativePath,
                  })
                }
                className="min-w-0 max-w-[220px] truncate rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-left text-xs font-medium text-slate-900 hover:bg-slate-100"
              >
                {fileVal!.name}
              </button>
            ) : (
              <label
                htmlFor={inputId}
                className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                title={t('crm.workspace.table.filePickTitle', { label: WORKSPACE_UPLOAD_MAX_FILE_LABEL })}
              >
                {t('crm.workspace.table.addFileShort')}
              </label>
            )}
            {has && (
              <button
                type="button"
                className="shrink-0 text-xs text-rose-600 underline"
                onClick={() => updateCell(record, field, null)}
              >
                {t('crm.workspace.recordDrawer.removeFile')}
              </button>
            )}
            </div>
            <span className="text-[10px] leading-tight text-slate-400">
              {t('crm.workspace.table.fileMaxLine', { label: WORKSPACE_UPLOAD_MAX_FILE_LABEL })}
            </span>
          </div>
        </td>
      );
    }

    const isSingularStatusColumn =
      statusField &&
      field.key === statusField.key &&
      (field.type === 'status' || field.type === 'select');

    if (isSingularStatusColumn) {
      const resolvedStatus =
        resolveStatusOptionValue(textValue) || statusOptions[0] || 'working_on_it';
      const style = getStatusStyle(resolvedStatus);
      return (
        <td key={field.id} className={`px-3 py-1.5 ${sticky} border-y border-slate-200`} style={{ width, minWidth: 120 }}>
          <select
            value={resolvedStatus}
            onChange={(e) => updateCell(record, field, e.target.value)}
            style={style}
            className={`rounded-full px-2.5 py-1 text-xs border ${
              style ? 'bg-transparent' : getStatusColor(resolvedStatus)
            }`}
          >
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>
                {getStatusLabel(opt)}
              </option>
            ))}
          </select>
        </td>
      );
    }
    if (field.type === 'boolean') {
      return (
        <td key={field.id} className={`px-3 py-1.5 ${sticky} border-y border-slate-200`} style={{ width, minWidth: 120 }}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => updateCell(record, field, e.target.checked ? 'true' : 'false')}
            className="h-4 w-4 rounded border-slate-300"
          />
        </td>
      );
    }
    if (isDateField && fieldType === 'date')
      return renderDateInput(record, field, textValue, 'date', sticky, width);
    if (isDateField && fieldType === 'datetime')
      return renderDateInput(record, field, textValue, 'datetime', sticky, width);

    if (field.type === 'multiselect') {
      const selected = Array.isArray(value)
        ? (value as string[])
        : String(value || '')
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
      const options = field.options?.map((o) => o.value) || [];
      return (
        <td key={field.id} className={`px-3 py-1.5 ${sticky} border-y border-slate-200`} style={{ width, minWidth: 120 }}>
          <div className="flex flex-wrap items-center gap-1">
            {selected.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-slate-100 text-lumiva-accent text-[11px] px-2 py-0.5"
              >
                {tag}
              </span>
            ))}
            {selected.length > 2 && (
              <span className="text-[11px] text-slate-500">+{selected.length - 2}</span>
            )}
            <div className="relative inline-flex" data-workspace-inline-popover>
              <button
                type="button"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setActiveMultiCell((prev) =>
                    prev?.recordId === record.id && prev?.fieldKey === field.key
                      ? null
                      : {
                          recordId: record.id,
                          fieldKey: field.key,
                          menuTop: rect.bottom + 4,
                          menuLeft: rect.left,
                        },
                  );
                }}
                className="text-[11px] rounded-full border border-slate-300 px-2 py-0.5 text-slate-500"
              >
                {t('crm.workspace.table.editTags')}
              </button>
            </div>
          </div>
        </td>
      );
    }

    if (field.type === 'select') {
      const normalizedOptions =
        (field.options || [])
          .map((opt) => {
            const label = String(opt?.label || opt?.value || '').trim();
            const value = String(opt?.value || opt?.label || '').trim();
            return { value, label: label || value };
          })
          .filter((opt) => opt.value) || [];
      const priorityLikeOptions =
        normalizedOptions.length > 0
          ? normalizedOptions.map((opt, index) => {
              const bucket = normalizePriorityBucket(opt.value || opt.label);
              const fallbackLabel =
                index === 0
                  ? t('crm.workspace.table.subitemPriority.low')
                  : index === 1
                    ? t('crm.workspace.table.subitemPriority.normal')
                    : index === 2
                      ? t('crm.workspace.table.subitemPriority.high')
                      : '';
              const nextLabel =
                normalizePriorityLabel(opt.label || opt.value) ||
                fallbackLabel ||
                (bucket === 'high'
                  ? t('crm.workspace.table.subitemPriority.high')
                  : bucket === 'low'
                    ? t('crm.workspace.table.subitemPriority.low')
                    : t('crm.workspace.table.subitemPriority.normal'));
              return {
                value: opt.value,
                label: nextLabel,
              };
            })
          : subitemPriorityOptions;
      const lowerKey = field.key.toLowerCase();
      const lowerLabel = field.label.toLowerCase();
      const isPriorityField =
        lowerKey.includes('priority') || lowerLabel.includes('priority') || lowerLabel.includes('приоритет');
      let options = isPriorityField ? priorityLikeOptions : [...normalizedOptions];
      if (!isPriorityField) {
        const seen = new Set(options.map((o) => o.value));
        records.forEach((r) => {
          const raw = r.values?.[field.key];
          if (raw === undefined || raw === null || raw === '') return;
          const v = String(raw).trim();
          if (v && !seen.has(v)) {
            seen.add(v);
            options.push({ value: v, label: v });
          }
        });
      }
      const currentValue = textValue || options[0]?.value || 'normal';
      const currentLabel =
        options.find((opt) => opt.value === currentValue)?.label ||
        subitemPriorityOptions.find((opt) => opt.value === currentValue)?.label ||
        currentValue ||
        t('crm.workspace.table.subitemPriority.normal');
      return (
        <td key={field.id} className={`px-3 py-1.5 ${sticky} border-y border-slate-200`} style={{ width, minWidth: 120 }}>
          {isPriorityField ? (
            <div className="relative" data-workspace-inline-popover>
              <button
                type="button"
                onClick={() =>
                  setActivePriorityMenu((prev) =>
                    prev?.recordId === record.id && prev?.fieldKey === field.key
                      ? null
                      : { recordId: record.id, fieldKey: field.key },
                  )
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-xs font-medium text-slate-800 hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{currentLabel}</span>
                  <span className="text-slate-400">▾</span>
                </div>
              </button>
              {activePriorityMenu?.recordId === record.id && activePriorityMenu?.fieldKey === field.key && (
                <div className="absolute z-40 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg p-1">
                  {options.map((opt) => {
                    const value = 'value' in opt ? opt.value : '';
                    const label =
                      ('label' in opt ? opt.label : '') || value || t('crm.workspace.table.subitemPriority.normal');
                    const isActive = value === currentValue;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          updateCell(record, field, value, true);
                          setActivePriorityMenu(null);
                        }}
                        className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ${
                          isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <select
              value={currentValue}
              onChange={(e) => updateCell(record, field, e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white text-slate-700 px-2 py-1.5 text-xs"
            >
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label || opt.value}
                </option>
              ))}
            </select>
          )}
        </td>
      );
    }

    const maybePerson =
      field.key.includes('person') ||
      field.key.includes('assignee') ||
      field.key.includes('owner') ||
      field.key.includes('responsible');
    if (maybePerson) {
      const selectedOwners = textValue
        .split(/[,;/]+/)
        .map((v) => v.trim())
        .filter(Boolean);
      return (
        <td key={field.id} className={`px-3 py-1.5 ${sticky} border-y border-slate-200`} style={{ width, minWidth: 120 }}>
          <div className="flex flex-wrap items-center gap-1">
            {selectedOwners.slice(0, 2).map((owner) => (
              <span
                key={owner}
                className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 text-[11px] px-2 py-0.5"
              >
                {owner}
              </span>
            ))}
            {selectedOwners.length > 2 && (
              <span className="text-[11px] text-slate-500">+{selectedOwners.length - 2}</span>
            )}
            <div className="relative inline-flex" data-workspace-inline-popover>
              <button
                type="button"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setActiveMultiCell((prev) =>
                    prev?.recordId === record.id && prev?.fieldKey === field.key
                      ? null
                      : {
                          recordId: record.id,
                          fieldKey: field.key,
                          menuTop: rect.bottom + 4,
                          menuLeft: rect.left,
                        },
                  );
                }}
                className="text-[11px] rounded-full border border-slate-300 px-2 py-0.5 text-slate-500"
              >
                select
              </button>
            </div>
          </div>
        </td>
      );
    }

    return (
      <td key={field.id} className={`px-3 py-1.5 ${sticky} border-y border-slate-200`} style={{ width, minWidth: 120 }}>
        <input
          defaultValue={textValue}
          onBlur={(e) => updateCell(record, field, e.target.value)}
          className="w-full rounded-md border border-transparent px-2 py-1 text-sm focus:border-slate-300 focus:bg-white"
        />
      </td>
    );
  };

  const renderWorkspaceMultiCellPortal = (): React.ReactNode => {
    if (!activeMultiCell || typeof document === 'undefined') return null;
    const rec = records.find((r) => r.id === activeMultiCell.recordId);
    const fld = orderedColumns.find((f) => f.key === activeMultiCell.fieldKey);
    if (!rec || !fld) return null;

    const isMultiselectField = fld.type === 'multiselect';
    const isPersonField =
      fld.key.includes('person') ||
      fld.key.includes('assignee') ||
      fld.key.includes('owner') ||
      fld.key.includes('responsible');
    if (!isMultiselectField && !isPersonField) return null;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelWidth = isMultiselectField ? 192 : 256;
    const left = Math.max(8, Math.min(activeMultiCell.menuLeft, vw - panelWidth - 8));
    const top = Math.max(8, activeMultiCell.menuTop);

    const rawVal = rec.values?.[fld.key];
    const multiselectSelected = Array.isArray(rawVal)
      ? (rawVal as string[])
      : String(rawVal || '')
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
    const fromFieldOpts = fld.options?.map((o) => String(o.value || '').trim()).filter(Boolean) || [];
    const fromRecOpts = collectStatusValuesFromRecords(records, fld.key);
    const multiselectOptions = [...new Set([...fromFieldOpts, ...fromRecOpts])].sort((a, b) =>
      a.localeCompare(b),
    );
    const textVal = String(rawVal ?? '');
    const ownerSelected = textVal
      .split(/[,;/]+/)
      .map((v) => v.trim())
      .filter(Boolean);

    return createPortal(
      <div
        data-workspace-inline-popover
        className={`fixed z-[100000] rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-100 p-2 overflow-y-auto ${
          isMultiselectField ? 'w-48' : 'w-64'
        }`}
        style={{
          top,
          left,
          maxHeight: Math.min(320, Math.max(120, vh - top - 12)),
        }}
      >
        {isMultiselectField ? (
          <div className="space-y-1">
            {(multiselectOptions.length ? multiselectOptions : ['option_1', 'option_2', 'option_3']).map((opt) => {
              const isActive = multiselectSelected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const next = isActive
                      ? multiselectSelected.filter((v) => v !== opt)
                      : [...multiselectSelected, opt];
                    updateCell(rec, fld, next.join(','));
                    setActiveMultiCell(null);
                  }}
                  className={`w-full text-left text-xs rounded-lg px-2 py-1 ${
                    isActive ? 'bg-slate-100 text-lumiva-accent' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          staffByDepartment.map((group) => (
            <div key={group.department} className="mb-2 last:mb-0">
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 px-1 py-1">
                {group.department}
              </div>
              <div className="space-y-1">
                {group.users.map((user) => {
                  const active = ownerSelected.includes(user.fullName);
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? ownerSelected.filter((name) => name !== user.fullName)
                          : [...ownerSelected, user.fullName];
                        updateCell(rec, fld, next.join(', '));
                        setActiveMultiCell(null);
                      }}
                      className={`w-full text-left text-xs rounded-lg px-2 py-1.5 ${
                        active ? 'bg-slate-100 text-lumiva-accent' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {user.fullName}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>,
      document.body,
    );
  };

  return (
    <MainLayout>
      {renderWorkspaceMultiCellPortal()}
      <div className="max-w-[1700px] mx-auto space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 break-words">
              {t('crm.workspace.table.startFromScratch')}
            </h1>
          </div>
          <div className="flex w-full sm:w-auto gap-2">
            <button
              type="button"
              onClick={() => navigate(`/workspace/${objectId}/import`)}
              className="flex-1 sm:flex-none px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              {t('crm.workspace.table.importButton')}
            </button>
            <button
              type="button"
              onClick={() => setShowAddField(true)}
              className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-lumiva-accent text-white text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:bg-lumiva-accent-soft hover:shadow-md whitespace-nowrap"
            >
              {t('crm.workspace.table.addField')}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-2 sm:p-3 flex flex-col gap-2 sm:gap-3 text-sm shadow-sm">
          <div className="w-full min-w-0">
            <WorkspaceViewTabs objectId={objectId} active="table" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setFilterMenuOpen((prev) => !prev);
                setSortMenuOpen(false);
                setGroupMenuOpen(false);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs sm:text-sm whitespace-nowrap"
            >
              {t('crm.workspace.table.filterButton')}
              {filterFieldKey && filterFieldValue ? ' •' : ''}
            </button>
            {filterMenuOpen && (
              <div className="absolute left-0 mt-1 z-30 w-64 rounded-xl border border-slate-200 bg-white shadow-xl p-2 space-y-2">
                <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  {t('crm.workspace.table.filterRows')}
                </div>
                <select
                  value={filterFieldKey}
                  onChange={(e) => {
                    setFilterFieldKey(e.target.value);
                    setFilterFieldValue('');
                  }}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                >
                  <option value="">{t('crm.workspace.table.fieldPlaceholder')}</option>
                  {orderedColumns.map((field) => (
                    <option key={`filter-${field.key}`} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>
                <select
                  value={filterFieldValue}
                  onChange={(e) => setFilterFieldValue(e.target.value)}
                  disabled={!filterFieldKey}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-50"
                >
                  <option value="">{t('crm.workspace.table.valuePlaceholder')}</option>
                  {fieldValueOptions.map((value) => (
                    <option key={`filter-value-${value}`} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setFilterFieldKey('');
                    setFilterFieldValue('');
                  }}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  {t('crm.workspace.table.clearFilter')}
                </button>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setSortMenuOpen((prev) => !prev);
                setFilterMenuOpen(false);
                setGroupMenuOpen(false);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs sm:text-sm whitespace-nowrap"
            >
              {t('crm.workspace.table.sortButton')}
              {sortFieldKey ? ' •' : ''}
            </button>
            {sortMenuOpen && (
              <div className="absolute left-0 mt-1 z-30 w-64 rounded-xl border border-slate-200 bg-white shadow-xl p-2 space-y-2">
                <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  {t('crm.workspace.table.sortRows')}
                </div>
                <select
                  value={sortFieldKey}
                  onChange={(e) => setSortFieldKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                >
                  <option value="">{t('crm.workspace.table.noSorting')}</option>
                  {orderedColumns.map((field) => (
                    <option key={`sort-${field.key}`} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>
                <select
                  value={sortDirection}
                  onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                >
                  <option value="asc">{t('crm.workspace.table.ascending')}</option>
                  <option value="desc">{t('crm.workspace.table.descending')}</option>
                </select>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setGroupMenuOpen((prev) => !prev);
                setSortMenuOpen(false);
                setFilterMenuOpen(false);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs sm:text-sm whitespace-nowrap"
            >
              {t('crm.workspace.table.groupByButton')}
              {groupByFieldKey ? ' •' : ''}
            </button>
            {groupMenuOpen && (
              <div className="absolute left-0 mt-1 z-30 w-64 rounded-xl border border-slate-200 bg-white shadow-xl p-2 space-y-2">
                <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  {t('crm.workspace.table.groupRows')}
                </div>
                <select
                  value={groupByFieldKey}
                  onChange={(e) => setGroupByFieldKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                >
                  <option value="">{t('crm.workspace.table.defaultGroupField')}</option>
                  {orderedColumns.map((field) => (
                    <option key={`group-${field.key}`} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {hiddenColumnList.length > 0 && (
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs sm:text-sm whitespace-nowrap"
              onClick={() => setHiddenColumns({})}
            >
              {t('crm.workspace.table.showHiddenColumns', { count: hiddenColumnList.length })}
            </button>
          )}
          {hiddenRowsCount > 0 && (
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs sm:text-sm whitespace-nowrap"
              onClick={() => setHiddenRows({})}
            >
              {t('crm.workspace.table.showHiddenRows', { count: hiddenRowsCount })}
            </button>
          )}
          <div className="w-full md:w-auto md:ml-auto flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
              {t('crm.workspace.table.groupsCountLabel', { count: groupTitles.length })}
            </span>
            {selectedIds.size > 0 && (
              <>
                <span className="text-xs text-slate-600">
                  {t('crm.workspace.table.selectedCount', { count: selectedIds.size })}
                </span>
                <select
                  value={bulkTargetGroup}
                  onChange={(e) => setBulkTargetGroup(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs bg-white text-slate-700"
                >
                  <option value="">{t('crm.workspace.table.moveToGroup')}</option>
                  {groupTitles.map((title) => (
                    <option key={title} value={title}>
                      {title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void bulkMoveRowsToGroup()}
                  disabled={bulkProcessing || !bulkTargetGroup}
                  className="px-2 py-1 rounded-lg border border-slate-300 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {t('crm.workspace.table.move')}
                </button>
                <button
                  type="button"
                  onClick={bulkHideRows}
                  disabled={bulkProcessing}
                  className="px-2 py-1 rounded-lg border border-slate-300 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {t('crm.workspace.table.hide')}
                </button>
                <button
                  type="button"
                  onClick={() => void bulkDeleteRows()}
                  disabled={bulkProcessing}
                  className="px-2 py-1 rounded-lg border border-rose-200 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                >
                  {bulkProcessing ? t('crm.workspace.table.deleting') : t('crm.workspace.table.bulkDelete')}
                </button>
              </>
            )}
            <span className="text-xs text-slate-500">
              {selectedIds.size > 0
                ? t('crm.workspace.table.selectedCount', { count: selectedIds.size })
                : t('crm.workspace.table.footerItemsCount', { count: records.length })}
            </span>
          </div>
          </div>
        </div>
        {actionError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {actionError}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('crm.workspace.table.searchRecords')}
              className="w-full md:w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {loading ? (
            <div className="text-sm text-slate-500">{t('crm.workspace.table.loadingData')}</div>
          ) : (
            <div className="space-y-4">
              {groupedRecords.map((group) => {
                const collapsed = !!collapsedGroups[group.title];
                const visibleGroupItems = group.items.filter((record) => !hiddenRows[record.id]);
                const groupColumns = orderedColumns.filter(
                  (field) => !groupHiddenColumns[group.title]?.[field.key],
                );
                return (
                  <div
                    key={group.title}
                    className="rounded-3xl border border-slate-200 overflow-hidden bg-white"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverGroup(group.title);
                    }}
                    onDragLeave={() => setDragOverGroup(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      const rowIdFromDnd = e.dataTransfer.getData('text/workspace-row-id');
                      const rowId = rowIdFromDnd || draggingRowId;
                      if (!rowId) return;
                      void moveRecordToGroup(rowId, group.title);
                      setDraggingRowId(null);
                      setDragReadyRowId(null);
                      setDragOverGroup(null);
                    }}
                  >
                    <div
                      className={`group/header flex items-center justify-between bg-slate-50 px-3 py-2 border-b border-slate-200 ${
                        dragOverGroup === group.title ? 'ring-2 ring-slate-300' : ''
                      }`}
                      style={{ borderLeft: `4px solid ${group.color}` }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedGroups((prev) => ({
                            ...prev,
                            [group.title]: !prev[group.title],
                          }))
                        }
                        className="text-sm font-semibold text-slate-700 flex items-center gap-2"
                      >
                        <span>{collapsed ? '▶' : '▼'}</span>
                        {group.title}
                      </button>
                      <div className="text-xs text-slate-500 flex items-center gap-3">
                        <span>
                          {t('crm.workspace.table.groupHeaderItems', { count: group.items.length })}
                        </span>
                        {numberField && (
                          <span>
                            {t('crm.workspace.table.sumLabel', { label: numberField.label })}{' '}
                            {group.items.reduce((sum, item) => {
                              const raw = item.values?.[numberField.key];
                              const parsed = typeof raw === 'number' ? raw : Number(raw || 0);
                              return sum + (Number.isNaN(parsed) ? 0 : parsed);
                            }, 0)}
                          </span>
                        )}
                        {isPrimaryGrouping && (
                          <button
                            type="button"
                            onClick={() => void deleteGroup(group.title)}
                            className="h-6 w-6 rounded-full text-rose-500 hover:bg-rose-50 opacity-0 group-hover/header:opacity-100 transition-opacity"
                            title={t('crm.workspace.table.deleteGroupTitle')}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              className="h-4 w-4 mx-auto"
                            >
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v6M14 11v6" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {!collapsed && (
                      <div className="overflow-x-auto max-h-[560px] px-1">
                        <table className="min-w-[1000px] w-full text-xs border-separate border-spacing-y-1 table-fixed">
                          <thead className="text-slate-500">
                            <tr className="sticky top-0 bg-white z-20">
                              <th className="px-3 py-1 w-44 md:sticky md:left-0 bg-white md:z-30" />
                              {groupColumns.map((field) => (
                                <th
                                  key={field.id}
                                  draggable={dragReadyColumnKey === field.key}
                                  onMouseDown={(e) => {
                                    const target = e.target as HTMLElement;
                                    if (target.closest('button')) return;
                                    armColumnDragAfterHold(field.key);
                                  }}
                                  onMouseUp={() => {
                                    clearColumnHoldTimer();
                                    setHoldingColumnKey((prev) => (prev === field.key ? null : prev));
                                    setDragReadyColumnKey((prev) => (prev === field.key ? null : prev));
                                  }}
                                  onMouseLeave={() => {
                                    clearColumnHoldTimer();
                                    setHoldingColumnKey((prev) => (prev === field.key ? null : prev));
                                    setDragReadyColumnKey((prev) => (prev === field.key ? null : prev));
                                  }}
                                  onDragStart={(e) => {
                                    if (dragReadyColumnKey !== field.key) {
                                      e.preventDefault();
                                      return;
                                    }
                                    setDraggingColumnKey(field.key);
                                  }}
                                  onDragEnd={() => {
                                    setDraggingColumnKey(null);
                                    setDragReadyColumnKey(null);
                                  }}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={() => {
                                    if (!draggingColumnKey || draggingColumnKey === field.key) return;
                                    setColumnOrder((prev) => {
                                      const base = prev.length ? [...prev] : orderedColumns.map((c) => c.key);
                                      const from = base.indexOf(draggingColumnKey);
                                      const to = base.indexOf(field.key);
                                      if (from < 0 || to < 0) return base;
                                      const [moved] = base.splice(from, 1);
                                      base.splice(to, 0, moved);
                                      return base;
                                    });
                                    setDraggingColumnKey(null);
                                    setDragReadyColumnKey(null);
                                  }}
                                  className={`px-3 py-1 font-medium text-slate-600 whitespace-nowrap relative select-none ${
                                    field.key === titleField?.key ? 'md:sticky md:left-44 bg-white md:z-20' : ''
                                  } ${
                                    holdingColumnKey === field.key
                                      ? 'bg-slate-50 ring-1 ring-slate-300'
                                      : ''
                                  } ${
                                    dragReadyColumnKey === field.key
                                      ? 'bg-slate-100 ring-2 ring-slate-400'
                                      : ''
                                  }`}
                                  style={{ width: columnWidths[field.key] || 180, minWidth: 120 }}
                                >
                                  <div className="group/colmenu flex items-center justify-between gap-2">
                                    <span className="truncate">{field.label}</span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setColumnMenuState((prev) =>
                                            prev?.key === field.key && prev?.groupTitle === group.title
                                              ? null
                                              : { key: field.key, groupTitle: group.title },
                                          )
                                        }
                                        className="h-5 w-5 rounded-full hover:bg-slate-100 text-slate-400 opacity-0 group-hover/colmenu:opacity-100 transition-opacity"
                                      >
                                        ⋯
                                      </button>
                                      <span className="text-[10px] text-slate-400 opacity-0 group-hover/colmenu:opacity-100 transition-opacity">⋮⋮</span>
                                    </div>
                                  </div>
                                  {columnMenuState?.key === field.key &&
                                    columnMenuState?.groupTitle === group.title && (
                                    <div className="absolute right-2 top-8 z-40 w-48 rounded-xl border border-slate-200 bg-white shadow-xl p-1.5 ring-1 ring-slate-100">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          openEditColumn(field);
                                          setColumnMenuState(null);
                                        }}
                                        className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="1.8"
                                          className="h-4 w-4"
                                        >
                                          <path d="M12 20h9" />
                                          <path d="m16.5 3.5 4 4L7 21H3v-4L16.5 3.5Z" />
                                        </svg>
                                        <span>{t('crm.workspace.table.editColumn')}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void duplicateColumn(field);
                                          setColumnMenuState(null);
                                        }}
                                        className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="1.8"
                                          className="h-4 w-4"
                                        >
                                          <rect x="9" y="9" width="11" height="11" rx="2" />
                                          <rect x="4" y="4" width="11" height="11" rx="2" />
                                        </svg>
                                        <span>{t('crm.workspace.table.duplicateColumn')}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setGroupHiddenColumns((prev) => ({
                                            ...prev,
                                            [group.title]: {
                                              ...(prev[group.title] || {}),
                                              [field.key]: true,
                                            },
                                          }));
                                          setColumnMenuState(null);
                                        }}
                                        className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="1.8"
                                          className="h-4 w-4"
                                        >
                                          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                                          <circle cx="12" cy="12" r="3" />
                                        </svg>
                                        <span>{t('crm.workspace.table.hideColumn')}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          deleteColumnInGroup(group.title, field.key);
                                          setColumnMenuState(null);
                                        }}
                                        className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 flex items-center gap-2"
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="1.8"
                                          className="h-4 w-4"
                                        >
                                          <path d="M3 6h18" />
                                          <path d="M8 6V4h8v2" />
                                          <path d="M19 6l-1 14H6L5 6" />
                                          <path d="M10 11v6M14 11v6" />
                                        </svg>
                                        <span>{t('crm.workspace.table.deleteColumnInGroup')}</span>
                                      </button>
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setResizing({
                                        key: field.key,
                                        startX: e.clientX,
                                        startWidth: columnWidths[field.key] || 180,
                                      });
                                    }}
                                    className="absolute top-0 right-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-slate-300/70"
                                  />
                                </th>
                              ))}
                              <th className="px-2 py-2 text-center w-12">
                                <button
                                  type="button"
                                  onClick={() => setShowAddField(true)}
                                  className="h-6 w-6 rounded-full border border-slate-300 text-slate-500 hover:text-slate-900"
                                >
                                  +
                                </button>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleGroupItems.map((record, rowIndex) => {
                              const subitems = getSubitems(record);
                              const expanded = !!expandedRows[record.id];
                              const recordPriorityValue = String(
                                record.values?.[priorityField?.key || 'priority'] || 'normal',
                              );
                              const mobilePreviewFields = groupColumns
                                .filter((field) => field.key !== titleField?.key)
                                .sort((a, b) => getMobilePreviewFieldRank(a) - getMobilePreviewFieldRank(b))
                                .slice(0, 3);
                              const isFirstRow = rowIndex === 0;
                              const isLastRow = rowIndex === visibleGroupItems.length - 1;
                              return (
                                <React.Fragment key={record.id}>
                                  <tr
                                    draggable={dragReadyRowId === record.id}
                                    onMouseDown={(e) => {
                                      const target = e.target as HTMLElement;
                                      if (
                                        target.closest('button') ||
                                        target.closest('input') ||
                                        target.closest('select') ||
                                        target.closest('textarea') ||
                                        target.closest('label')
                                      ) {
                                        return;
                                      }
                                      armRowDragAfterHold(record.id);
                                    }}
                                    onMouseUp={() => {
                                      clearRowHoldTimer();
                                      setHoldingRowId((prev) => (prev === record.id ? null : prev));
                                      setDragReadyRowId((prev) => (prev === record.id ? null : prev));
                                    }}
                                    onMouseLeave={() => {
                                      clearRowHoldTimer();
                                      setHoldingRowId((prev) => (prev === record.id ? null : prev));
                                      setDragReadyRowId((prev) => (prev === record.id ? null : prev));
                                    }}
                                    onDragStart={(e) => {
                                      if (dragReadyRowId !== record.id) {
                                        e.preventDefault();
                                        return;
                                      }
                                      setDraggingRowId(record.id);
                                      e.dataTransfer.effectAllowed = 'move';
                                      e.dataTransfer.setData('text/workspace-row-id', record.id);
                                    }}
                                    onDragEnd={() => {
                                      setDraggingRowId(null);
                                      setDragOverGroup(null);
                                      setDragReadyRowId(null);
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const sourceId =
                                        e.dataTransfer.getData('text/workspace-row-id') || draggingRowId;
                                      if (!sourceId || sourceId === record.id) return;
                                      const sourceRecord = records.find((r) => r.id === sourceId);
                                      if (!sourceRecord) return;
                                      const sourceGroup = getRecordGroupTitle(sourceRecord);
                                      const targetGroup = group.title;
                                      if (sourceGroup === targetGroup) {
                                        reorderRowsInsideGroup(group.title, sourceId, record.id);
                                      } else {
                                        void moveRecordToGroup(sourceId, targetGroup);
                                      }
                                      setDraggingRowId(null);
                                      setDragReadyRowId(null);
                                    }}
                                    className={`group/row relative border-b border-slate-100 hover:bg-slate-50/80 ${
                                      holdingRowId === record.id ? 'bg-slate-50 ring-1 ring-slate-300' : ''
                                    } ${dragReadyRowId === record.id ? 'bg-slate-100 ring-2 ring-slate-400' : ''} ${
                                      rowMenuRecordId === record.id ||
                                      activeMultiCell?.recordId === record.id ||
                                      activePriorityMenu?.recordId === record.id
                                        ? 'z-[210]'
                                        : 'z-0'
                                    }`}
                                  >
                                    <td
                                      className={`px-3 py-1.5 w-44 min-w-[11rem] md:sticky md:left-0 bg-white border-y border-slate-200 border-l-4 ${
                                        isFirstRow ? 'rounded-tl-xl' : ''
                                      } ${isLastRow ? 'rounded-bl-xl' : ''} ${
                                        rowMenuRecordId === record.id ||
                                        activeMultiCell?.recordId === record.id ||
                                        activePriorityMenu?.recordId === record.id
                                          ? 'z-[220]'
                                          : 'z-30'
                                      }`}
                                      style={{ borderLeftColor: getRowStatusHex(record) || getPriorityStripHex(recordPriorityValue) }}
                                    >
                                      <div className="flex w-full flex-wrap items-start gap-2">
                                        <div className="flex min-w-0 flex-1 items-center gap-2">
                                        <label className="inline-flex shrink-0 cursor-pointer items-center">
                                          <input
                                            type="checkbox"
                                            checked={selectedIds.has(record.id)}
                                            onChange={() => toggleSelected(record.id)}
                                            className="peer sr-only"
                                          />
                                          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-md border border-slate-300 bg-white text-white transition peer-checked:border-sky-600 peer-checked:bg-sky-600">
                                            <svg className="h-3 w-3 opacity-0 peer-checked:opacity-100" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                              <path d="M2.5 6.2L4.8 8.5L9.5 3.5" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                          </span>
                                        </label>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedRows((prev) => ({
                                              ...prev,
                                              [record.id]: !prev[record.id],
                                            }))
                                          }
                                          className="shrink-0 text-[11px] text-slate-500 hover:text-slate-800 opacity-0 group-hover/row:opacity-100 transition-opacity"
                                        >
                                          {expanded ? '▼' : '▶'}
                                        </button>
                                        <button
                                          type="button"
                                          onMouseDown={(e) => e.stopPropagation()}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveRecord(record);
                                          }}
                                          className="shrink-0 whitespace-nowrap px-3 py-0.5 rounded-full border border-[#b8c6d8] text-[11px] text-slate-700"
                                        >
                                          Open
                                        </button>
                                        <div className="relative ml-auto shrink-0">
                                          <button
                                            type="button"
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onClick={() =>
                                              setRowMenuRecordId((prev) => (prev === record.id ? null : record.id))
                                            }
                                            className={`h-6 w-6 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-opacity ${
                                              rowMenuRecordId === record.id
                                                ? 'opacity-100'
                                                : 'opacity-0 group-hover/row:opacity-100'
                                            }`}
                                          >
                                            ⋯
                                          </button>
                                          {rowMenuRecordId === record.id && (
                                            <div className="absolute left-full ml-1 top-0 z-[80] w-44 rounded-xl border border-slate-200 bg-white shadow-xl p-1.5">
                                              <button
                                                type="button"
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={() => {
                                                  void duplicateRow(record);
                                                  setRowMenuRecordId(null);
                                                }}
                                                className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50"
                                              >
                                                {t('crm.workspace.table.duplicateRow')}
                                              </button>
                                              <button
                                                type="button"
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={() => {
                                                  setHiddenRows((prev) => ({ ...prev, [record.id]: true }));
                                                  setRowMenuRecordId(null);
                                                }}
                                                className="w-full text-left text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50"
                                              >
                                                {t('crm.workspace.table.hideRow')}
                                              </button>
                                              <button
                                                type="button"
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={() => {
                                                  void deleteRow(record.id);
                                                  setRowMenuRecordId(null);
                                                }}
                                                className="w-full text-left text-xs px-2 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                                              >
                                                {t('crm.workspace.table.deleteRow')}
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                        </div>
                                        <div className="mt-1 basis-full space-y-1 md:hidden">
                                          {mobilePreviewFields.map((field) => {
                                            const preview = getMobilePreviewValue(record, field);
                                            if (!preview) return null;
                                            return (
                                              <div
                                                key={`mobile-preview-${record.id}-${field.key}`}
                                                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1"
                                              >
                                                <span className="min-w-0 truncate text-[10px] uppercase tracking-wide text-slate-500">
                                                  {field.label}
                                                </span>
                                                <span className="min-w-0 truncate text-right text-[11px] text-slate-800">
                                                  {preview}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </td>
                                    {groupColumns.map((field) => renderCell(record, field))}
                                    <td />
                                  </tr>
                                  {expanded && (
                                    <tr className="bg-sky-50/50">
                                      <td
                                        className="p-0 w-3 md:sticky md:left-0 bg-sky-50/60 md:z-10 text-xs text-slate-600 align-top border-r border-sky-100"
                                        style={{ borderLeft: `4px solid ${getRowStatusHex(record) || getPriorityStripHex(recordPriorityValue)}` }}
                                      >
                                        <div className="h-full min-h-[42px]" />
                                      </td>
                                      <td colSpan={groupColumns.length + 1} className="px-3 py-2">
                                        <div className="mt-2 rounded-2xl border border-sky-100 bg-sky-50/30 p-3 pl-5 relative">
                                          <div className="absolute left-2 top-2 bottom-2 w-[3px] rounded-full bg-sky-300/90" />
                                          <div className="overflow-x-auto">
                                          <table className="w-full min-w-[760px] text-xs">
                                            <thead className="bg-sky-50/70">
                                              <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                                                <th className="px-2 py-2 text-left">
                                                  {t('crm.workspace.table.subitemColTask')}
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                  {t('crm.workspace.table.subitemColOwner')}
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                  {t('crm.workspace.table.subitemColStatus')}
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                  {t('crm.workspace.table.subitemColPriority')}
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                  {t('crm.workspace.table.subitemColDue')}
                                                </th>
                                                <th className="px-2 py-2 text-left">
                                                  {t('crm.workspace.table.subitemColActions')}
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {subitems.map((subitem) => {
                                                const subStatus = String(subitem.values?.status || 'todo');
                                                const subPriority = String(subitem.values?.priority || 'normal');
                                                return (
                                                  <tr key={subitem.id} className="border-t border-slate-100">
                                                    <td className="px-2 py-1.5">
                                                      <input
                                                        defaultValue={String(subitem.values?.name || '')}
                                                        onBlur={(e) =>
                                                          void updateSubitem(record, subitem.id, 'name', e.target.value)
                                                        }
                                                        placeholder={t('crm.workspace.table.subitemTitlePlaceholder')}
                                                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                                                      />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                      <div className="relative" data-workspace-inline-popover>
                                                        {(() => {
                                                          const selectedOwners = parseOwnerValues(subitem.values?.owner);
                                                          const menuOpen =
                                                            activeSubitemOwnerMenu?.recordId === record.id &&
                                                            activeSubitemOwnerMenu?.subitemId === subitem.id;
                                                          return (
                                                            <>
                                                              <button
                                                                type="button"
                                                                onClick={() =>
                                                                  setActiveSubitemOwnerMenu((prev) =>
                                                                    prev?.recordId === record.id &&
                                                                    prev?.subitemId === subitem.id
                                                                      ? null
                                                                      : { recordId: record.id, subitemId: subitem.id },
                                                                  )
                                                                }
                                                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-xs"
                                                              >
                                                                <div className="flex items-center justify-between gap-2">
                                                                  <div className="flex items-center gap-1.5 min-w-0">
                                                                    {selectedOwners.length ? (
                                                                      <>
                                                                        {selectedOwners.slice(0, 3).map((name) => (
                                                                          <span
                                                                            key={name}
                                                                            title={name}
                                                                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700"
                                                                          >
                                                                            {getInitials(name)}
                                                                          </span>
                                                                        ))}
                                                                        {selectedOwners.length > 3 && (
                                                                          <span className="text-[10px] text-slate-500">
                                                                            +{selectedOwners.length - 3}
                                                                          </span>
                                                                        )}
                                                                      </>
                                                                    ) : (
                                                                      <span className="truncate text-slate-500">
                                                                        {t('crm.workspace.table.selectOwner')}
                                                                      </span>
                                                                    )}
                                                                  </div>
                                                                  <span className="text-[10px] text-slate-500">{selectedOwners.length}</span>
                                                                </div>
                                                              </button>
                                                              {menuOpen && (
                                                                <div className="absolute z-[220] mt-1 w-72 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-100 p-2">
                                                                  {staffByDepartment.map((group) => {
                                                                    const groupNames = group.users.map((u) => u.fullName);
                                                                    const groupSelected =
                                                                      groupNames.length > 0 &&
                                                                      groupNames.every((name) => selectedOwners.includes(name));
                                                                    return (
                                                                      <div key={group.department} className="mb-2 last:mb-0">
                                                                        <button
                                                                          type="button"
                                                                          onClick={() =>
                                                                            void toggleSubitemDepartment(record, subitem.id, group.users)
                                                                          }
                                                                          className={`w-full text-left rounded-lg px-2 py-1 text-[11px] font-semibold ${
                                                                            groupSelected
                                                                              ? 'bg-slate-100 text-lumiva-accent'
                                                                              : 'text-slate-600 hover:bg-slate-50'
                                                                          }`}
                                                                        >
                                                                          {group.department}
                                                                        </button>
                                                                        <div className="mt-1 space-y-1">
                                                                          {group.users.map((user) => {
                                                                            const selected = selectedOwners.includes(user.fullName);
                                                                            return (
                                                                              <label
                                                                                key={user.id}
                                                                                className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-50"
                                                                              >
                                                                                <input
                                                                                  type="checkbox"
                                                                                  checked={selected}
                                                                                  onChange={() =>
                                                                                    void toggleSubitemOwner(record, subitem.id, user.fullName)
                                                                                  }
                                                                                />
                                                                                <span className="text-xs text-slate-700">{user.fullName}</span>
                                                                              </label>
                                                                            );
                                                                          })}
                                                                        </div>
                                                                      </div>
                                                                    );
                                                                  })}
                                                                </div>
                                                              )}
                                                            </>
                                                          );
                                                        })()}
                                                      </div>
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                      <select
                                                        value={subStatus}
                                                        onChange={(e) =>
                                                          void updateSubitem(record, subitem.id, 'status', e.target.value)
                                                        }
                                                        className={`w-full rounded-lg px-2 py-1.5 text-xs ${getSubitemStatusColor(subStatus)} font-medium`}
                                                      >
                                                        {subitemStatusOptions.map((opt) => (
                                                          <option key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                          </option>
                                                        ))}
                                                      </select>
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                      <div className="relative" data-workspace-inline-popover>
                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            setActiveSubitemPriorityMenu((prev) =>
                                                              prev?.recordId === record.id &&
                                                              prev?.subitemId === subitem.id
                                                                ? null
                                                                : { recordId: record.id, subitemId: subitem.id },
                                                            )
                                                          }
                                                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-xs font-medium text-slate-800"
                                                        >
                                                          <div className="flex items-center justify-between gap-2">
                                                            <span className="truncate">
                                                              {subitemPriorityOptions.find((o) => o.value === subPriority)?.label ||
                                                                subPriority}
                                                            </span>
                                                            <span className="text-slate-400">▾</span>
                                                          </div>
                                                        </button>
                                                        {activeSubitemPriorityMenu?.recordId === record.id &&
                                                          activeSubitemPriorityMenu?.subitemId === subitem.id && (
                                                            <div className="absolute z-40 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg p-1">
                                                              {subitemPriorityOptions.map((opt) => {
                                                                const isActive = opt.value === subPriority;
                                                                return (
                                                                  <button
                                                                    key={opt.value}
                                                                    type="button"
                                                                    onClick={() => {
                                                                      void updateSubitem(record, subitem.id, 'priority', opt.value);
                                                                      setActiveSubitemPriorityMenu(null);
                                                                    }}
                                                                    className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ${
                                                                      isActive
                                                                        ? 'bg-slate-100 text-slate-900'
                                                                        : 'text-slate-700 hover:bg-slate-50'
                                                                    }`}
                                                                  >
                                                                    {opt.label}
                                                                  </button>
                                                                );
                                                              })}
                                                            </div>
                                                          )}
                                                      </div>
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                      <input
                                                        type="date"
                                                        lang={i18n.language}
                                                        value={String(subitem.values?.due_date || '')}
                                                        onChange={(e) =>
                                                          void updateSubitem(record, subitem.id, 'due_date', e.target.value)
                                                        }
                                                        className="w-full min-w-[132px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs leading-5"
                                                      />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                      <button
                                                        type="button"
                                                        onClick={() => void deleteSubitem(record, subitem.id)}
                                                        className="text-[11px] text-rose-500 hover:text-rose-600"
                                                      >
                                                        {t('crm.workspace.table.bulkDelete')}
                                                      </button>
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                              <tr className="border-t border-slate-100">
                                                <td colSpan={6} className="px-2 py-1.5">
                                                  <button
                                                    type="button"
                                                    onClick={() => void addSubitem(record)}
                                                    className="text-xs text-sky-600 hover:text-sky-700"
                                                  >
                                                    {t('crm.workspace.table.addSubitem')}
                                                  </button>
                                                </td>
                                              </tr>
                                            </tbody>
                                          </table>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                            <tr>
                              <td className="px-3 py-2 text-slate-400 text-xs md:sticky md:left-0 bg-white md:z-10">+</td>
                              <td colSpan={groupColumns.length + 1} className="px-3 py-2">
                                {isPrimaryGrouping ? (
                                  <button
                                    type="button"
                                    onClick={() => void createRowInGroup(group.title)}
                                    disabled={savingRecordId === `new-${group.title}`}
                                    className="text-sm text-slate-500 hover:text-slate-800"
                                  >
                                    {savingRecordId === `new-${group.title}`
                                      ? t('crm.workspace.table.addingRow')
                                      : t('crm.workspace.table.addItem')}
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400">
                                    {t('crm.workspace.table.addItemOnlyDefault')}
                                  </span>
                                )}
                              </td>
                            </tr>
                            <tr className="border-t-2 border-slate-200 bg-slate-50">
                              <td className="px-3 py-2 text-xs font-semibold text-slate-600 md:sticky md:left-0 bg-slate-50 md:z-10">
                                {t('crm.workspace.table.summary')}
                              </td>
                              {groupColumns.map((field) => {
                                const keyNorm = field.key.toLowerCase();
                                const labelNorm = field.label.toLowerCase();
                                const isLikelyNumeric =
                                  field.type === 'number' ||
                                  keyNorm.includes('price') ||
                                  keyNorm.includes('value') ||
                                  keyNorm.includes('amount') ||
                                  keyNorm.includes('sum') ||
                                  labelNorm.includes('цена') ||
                                  labelNorm.includes('стоим') ||
                                  labelNorm.includes('сумм') ||
                                  labelNorm.includes('value') ||
                                  labelNorm.includes('amount');
                                if (isLikelyNumeric) {
                                  const sum = group.items.reduce((acc, item) => {
                                    const raw = item.values?.[field.key];
                                    const value =
                                      typeof raw === 'number'
                                        ? raw
                                        : Number(
                                            String(raw ?? '')
                                              .replace(/\s+/g, '')
                                              .replace(',', '.')
                                              .replace(/[^0-9.-]/g, '') || 0,
                                          );
                                    return acc + (Number.isNaN(value) ? 0 : value);
                                  }, 0);
                                  return (
                                    <td key={field.id} className="px-3 py-2 text-xs font-semibold text-slate-700">
                                      {sum}
                                    </td>
                                  );
                                }
                                return <td key={field.id} className="px-3 py-2 text-xs text-slate-400">-</td>;
                              })}
                              <td />
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {isPrimaryGrouping ? (
                <>
                  <div className="rounded-2xl border border-dashed border-slate-300 p-3 flex items-center gap-2">
                    <input
                      ref={newGroupInputRef}
                      value={newGroupTitle}
                      onChange={(e) => {
                        setNewGroupTitle(e.target.value);
                        if (newGroupError) setNewGroupError(null);
                      }}
                      placeholder={t('crm.workspace.table.newGroupTitle')}
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void createGroup()}
                      disabled={creatingGroup}
                      className="px-3 py-2 rounded-lg bg-lumiva-accent text-white text-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-lumiva-accent-soft hover:shadow-md disabled:opacity-60"
                    >
                      {creatingGroup ? t('crm.workspace.table.creatingGroup') : t('crm.workspace.table.addGroup')}
                    </button>
                  </div>
                  {newGroupError && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      {newGroupError}
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {t('crm.workspace.table.groupCreationOnlyDefault')}
                </div>
              )}
            </div>
          )}
        </div>

        <WorkspaceRecordDetailDrawer
          record={activeRecord}
          onClose={() => setActiveRecord(null)}
          onEditRecord={setActiveRecord}
          orderedColumns={orderedColumns}
          titleField={titleField}
          statusField={statusField}
          staffByDepartment={staffByDepartment}
          commentsByRecord={commentsByRecord}
          setCommentsByRecord={setCommentsByRecord}
          activityByRecord={activityByRecord}
          pushActivity={pushActivity}
          commentDraft={commentDraft}
          setCommentDraft={setCommentDraft}
          saveRecord={saveRecord}
          savingRecordId={savingRecordId}
          showAddFieldButton
          onAddField={() => setShowAddField(true)}
          recordsForStatusOptions={records}
          objectId={objectId}
        />

        {deleteDialog && (
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]"
              onClick={() => {
                if (!deleting) setDeleteDialog(null);
              }}
            />
            <div className="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                  >
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold text-white">{t('crm.workspace.table.deleteConfirm')}</h3>
                  <p className="mt-1 text-sm text-slate-300">
                    {deleteDialog.kind === 'column'
                      ? t('crm.workspace.table.deleteColumnConfirm', { label: deleteDialog.field.label })
                      : t('crm.workspace.table.deleteGroupConfirm', {
                          title: deleteDialog.groupTitle,
                          count: deleteDialog.itemCount,
                        })}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">{t('crm.workspace.table.deleteIrreversible')}</p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteDialog(null)}
                  disabled={deleting}
                  className="rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-60"
                >
                  {t('crm.workspace.table.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDelete()}
                  disabled={deleting}
                  className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-60"
                >
                  {deleting ? t('crm.workspace.table.deleting') : t('crm.workspace.table.bulkDelete')}
                </button>
              </div>
            </div>
          </div>
        )}

        {showEditField && editingField && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowEditField(false)} />
            <div className="absolute left-1/2 top-1/2 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
              <h3 className="text-lg font-semibold text-slate-900">{t('crm.workspace.table.editColumnTitle')}</h3>
              <div className="mt-4 grid grid-cols-1 gap-3">
                <input
                  value={editFieldKey}
                  onChange={(e) => setEditFieldKey(e.target.value)}
                  placeholder={t('crm.workspace.settings.fieldKeyPlaceholder')}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={editFieldLabel}
                  onChange={(e) => setEditFieldLabel(e.target.value)}
                  placeholder={t('crm.workspace.table.columnLabelPlaceholder')}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <select
                  value={editFieldType}
                  onChange={(e) => setEditFieldType(e.target.value as CustomObjectFieldType)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {(editFieldType === 'status' ||
                  editFieldType === 'select' ||
                  editFieldType === 'multiselect') && (
                  <input
                    value={editFieldOptionsText}
                    onChange={(e) => setEditFieldOptionsText(e.target.value)}
                    placeholder={t('crm.workspace.table.selectOptionsPlaceholder')}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                )}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditField(false)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
                >
                  {t('crm.workspace.table.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void saveEditedColumn()}
                  disabled={updatingField}
                  className="px-3 py-2 rounded-lg bg-lumiva-accent text-white text-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-lumiva-accent-soft hover:shadow-md disabled:opacity-60"
                >
                  {updatingField ? t('crm.workspace.table.saving') : t('crm.workspace.table.saveChanges')}
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddField && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowAddField(false)} />
            <div className="absolute left-1/2 top-1/2 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
              <h3 className="text-lg font-semibold text-slate-900">{t('crm.workspace.table.addFieldTitle')}</h3>
              <p className="text-xs text-slate-500 mt-1">{t('crm.workspace.table.addFieldHint')}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {defaultFieldPresets.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => void applyPreset(preset)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs hover:bg-slate-50"
                  >
                    + {preset.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3">
                <input
                  value={newFieldKey}
                  onChange={(e) => {
                    setNewFieldKey(e.target.value);
                    if (addFieldError) setAddFieldError(null);
                  }}
                  placeholder={t('crm.workspace.settings.fieldKeyPlaceholder')}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={newFieldLabel}
                  onChange={(e) => {
                    setNewFieldLabel(e.target.value);
                    if (addFieldError) setAddFieldError(null);
                  }}
                  placeholder={t('crm.workspace.table.fieldLabelPlaceholder')}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as CustomObjectFieldType)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {(newFieldType === 'status' ||
                  newFieldType === 'select' ||
                  newFieldType === 'multiselect') && (
                  <input
                    value={newFieldOptionsText}
                    onChange={(e) => setNewFieldOptionsText(e.target.value)}
                    placeholder={t('crm.workspace.table.statusOptionsPlaceholder')}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                )}
                {addFieldError && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {addFieldError}
                  </div>
                )}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddField(false)}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
                >
                  {t('crm.workspace.table.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleAddField()}
                  disabled={addingField}
                  className="px-3 py-2 rounded-lg bg-lumiva-accent text-white text-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-lumiva-accent-soft hover:shadow-md disabled:opacity-60"
                >
                  {addingField ? t('crm.workspace.table.adding') : t('crm.workspace.table.addField')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {filePreview && (
        <WorkspaceFileViewerModal
          open
          fileName={filePreview.fileName}
          relativePath={filePreview.relativePath}
          onClose={() => setFilePreview(null)}
          onRemove={() => {
            const rec = records.find((r) => r.id === filePreview.recordId);
            const fld = fields.find((f) => f.key === filePreview.fieldKey);
            if (rec && fld) updateCell(rec, fld, null);
            setFilePreview(null);
          }}
        />
      )}
    </MainLayout>
  );
};

