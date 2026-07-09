import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import '../projects/ProjectsListPage.css';
import { ApiError } from '../../api/client';
import { MainLayout } from '../../layout/MainLayout';
import {
  createCustomObjectField,
  createCustomObjectRecord,
  deleteCustomObjectField,
  deleteCustomObjectRecord,
  fetchCustomObjectFields,
  fetchCustomObjectRecordsPage,
  fetchCustomObjectValueKeys,
  fetchCustomObjectDistinctFieldValues,
  clearAllCustomObjectRecords,
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
import { PushToBoardModal } from '../../components/workspace/PushToBoardModal';
import { getWorkspaceDataLink } from '../../workspace/workspaceRecordLink';
import { fetchStaff, type StaffUser } from '../../api/staff';
import {
  fetchLeadsList,
  isLeadOmittedFromAnalytics,
  type Lead,
} from '../../api/leads';
import { fetchProjects, type Project } from '../../api/projects';
import { fetchCompanies, type Company } from '../../api/companies';
import { WorkspaceCrmEntityMultiField } from '../../components/workspace/WorkspaceCrmEntityMultiField';
import { WorkspaceViewTabs } from '../../components/workspace/WorkspaceViewTabs';
import { WorkspaceRecordDetailDrawer } from '../../components/workspace/WorkspaceRecordDetailDrawer';
import { WorkspaceFileViewerModal } from '../../components/workspace/WorkspaceFileViewerModal';
import {
  collectStatusValuesFromRecords,
  pickStatusLikeField,
} from '../../components/workspace/workspaceStatusField';
import { normalizeOptionToken } from '../../workspace/normalizeOptionToken';
import { touchRecentWorkspaceTable } from '../../workspace/workspaceRecentTables';
import { getWorkspaceTableKind } from '../../workspace/workspaceTableKind';
import { parseWorkspaceColumnBindingV1 } from '../../workspace/workspaceColumnBinding';
import { createColumnDragGhostElement } from '../../components/table/columnDragGhost';
import {
  getWorkspaceFieldValueStorageKey,
  WORKSPACE_MAPS_TO_IMPORTED_KEY,
} from '../../workspace/workspaceFieldValueKey';
import { isRenderableWorkspaceDateField } from '../../workspace/workspaceDateField';
import {
  isWorkspaceEntityRefField,
  isWorkspaceReadOnlyField,
  parseWorkspaceEntityRef,
  WORKSPACE_ENTITY_REF_KEY,
  WORKSPACE_IS_READONLY_KEY,
} from '../../workspace/workspaceEntityRef';

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
  const groupTableScrollRefs = useRef(new Map<string, HTMLDivElement>());

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
        {
          key: 'crm_lead',
          label: t('crm.workspace.table.presetCrmLead'),
          type: 'text' as const,
          meta: { [WORKSPACE_ENTITY_REF_KEY]: 'lead' as const },
        },
        {
          key: 'crm_project',
          label: t('crm.workspace.table.presetCrmProject'),
          type: 'text' as const,
          meta: { [WORKSPACE_ENTITY_REF_KEY]: 'project' as const },
        },
      ] as const,
    [t],
  );

  const [fields, setFields] = useState<CustomObjectField[]>([]);
  const [objectMeta, setObjectMeta] = useState<CustomObject['meta'] | null>(null);
  const [workspaceTableName, setWorkspaceTableName] = useState<string | null>(null);
  const [records, setRecords] = useState<CustomObjectRecord[]>([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [tablePage, setTablePage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
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
  const [columnDragOverKey, setColumnDragOverKey] = useState<string | null>(null);
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
  const [newFieldType, setNewFieldType] = useState<string>('text');
  const [newFieldOptionsText, setNewFieldOptionsText] = useState('');
  /** Пусто — значение в json под ключом колонки; иначе — ключ из импорта (meta.mapsToImportedKey). */
  const [newFieldMapsToImportKey, setNewFieldMapsToImportKey] = useState('');
  const [importValueKeys, setImportValueKeys] = useState<string[]>([]);
  const [editMapsToImportedKey, setEditMapsToImportedKey] = useState('');
  const [editCrmEntityRef, setEditCrmEntityRef] = useState<'none' | 'lead' | 'project' | 'company'>('none');
  const [crmLeadList, setCrmLeadList] = useState<Lead[]>([]);
  const [crmProjectList, setCrmProjectList] = useState<Project[]>([]);
  const [crmCompanyList, setCrmCompanyList] = useState<Company[]>([]);
  const [dataBindingFieldKeys, setDataBindingFieldKeys] = useState<string[]>([]);
  const [pushedSourceFieldKeys, setPushedSourceFieldKeys] = useState<string[]>([]);
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
  const [editFieldType, setEditFieldType] = useState<CustomObjectFieldType | 'fixed'>('text');
  const [editFieldOptionsText, setEditFieldOptionsText] = useState('');
  const [editBindMode, setEditBindMode] = useState<
    'off' | 'from_pushed_source' | 'lookup_by_key' | 'pick_from_data' | 'rollup'
  >('off');
  const [editBindSourceField, setEditBindSourceField] = useState('');
  const [editBindPickDataField, setEditBindPickDataField] = useState('');
  const [editBindDataObjectId, setEditBindDataObjectId] = useState('');
  const [editBindBoardMatch, setEditBindBoardMatch] = useState('');
  const [editBindDataMatch, setEditBindDataMatch] = useState('');
  const [editBindDataDisplay, setEditBindDataDisplay] = useState('');
  const [editBindGroupBy, setEditBindGroupBy] = useState('');
  const [editBindValueField, setEditBindValueField] = useState('');
  const [editBindAggregate, setEditBindAggregate] = useState<'sum' | 'count' | 'avg' | 'min' | 'max'>(
    'sum',
  );
  const [updatingField, setUpdatingField] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [workspaceAreaId, setWorkspaceAreaId] = useState<string | null>(null);
  const [areaObjects, setAreaObjects] = useState<CustomObject[]>([]);
  const [pushBoardOpen, setPushBoardOpen] = useState(false);
  const [pushBoardRecordIds, setPushBoardRecordIds] = useState<string[]>([]);

  const workspaceTableKind = useMemo(
    () => getWorkspaceTableKind(objectMeta as Record<string, unknown> | null),
    [objectMeta],
  );
  const isDataTable = workspaceTableKind === 'data';
  const isBoardTable = workspaceTableKind === 'board';
  /** Доска: сетка в духе Monday (тулбар, заливка статусов). */
  const mondayBoardUi = isBoardTable;

  const dataTablesInArea = useMemo(
    () =>
      areaObjects.filter(
        (o) => getWorkspaceTableKind(o.meta as Record<string, unknown> | null) === 'data',
      ),
    [areaObjects],
  );

  const importKeyOptions = useMemo(() => {
    const s = new Set<string>();
    fields.forEach((f) => s.add(f.key));
    importValueKeys.forEach((k) => s.add(k));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [fields, importValueKeys]);

  const boardFieldKeyOptions = useMemo(
    () => fields.map((f) => f.key).sort((a, b) => a.localeCompare(b)),
    [fields],
  );

  const [pickFromDataOptionsByKey, setPickFromDataOptionsByKey] = useState<Record<string, string[]>>(
    {},
  );

  useEffect(() => {
    if (!isBoardTable || !fields.length) return;
    let cancelled = false;
    const seen = new Set<string>();
    const loads: Promise<void>[] = [];
    for (const f of fields) {
      const b = parseWorkspaceColumnBindingV1(f.meta as Record<string, unknown> | null);
      if (b?.mode !== 'pick_from_data') continue;
      const cacheKey = `${b.dataObjectId}\x1e${b.dataFieldKey}`;
      if (seen.has(cacheKey)) continue;
      seen.add(cacheKey);
      loads.push(
        fetchCustomObjectDistinctFieldValues(b.dataObjectId, b.dataFieldKey).then((res) => {
          if (!cancelled) {
            setPickFromDataOptionsByKey((prev) => ({
              ...prev,
              [cacheKey]: res.values || [],
            }));
          }
        }),
      );
    }
    void Promise.all(loads);
    return () => {
      cancelled = true;
    };
  }, [isBoardTable, fields]);

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
  const [justCreatedRecordId, setJustCreatedRecordId] = useState<string | null>(null);
  const justCreatedInputRef = useRef<HTMLInputElement | null>(null);
  const rowHoldTimerRef = useRef<number | null>(null);
  const columnHoldTimerRef = useRef<number | null>(null);
  const prevObjectIdRef = useRef<string>('');

  const buildRecordsListParams = () => ({
    limit: pageSize,
    offset: tablePage * pageSize,
    search: search.trim() || undefined,
    sortBy: sortFieldKey.trim() || undefined,
    sortOrder: sortFieldKey.trim()
      ? sortDirection === 'asc'
        ? ('ASC' as const)
        : ('DESC' as const)
      : undefined,
    /** Доска и слой данных: подстановка значений по columnBinding (rollup, lookup, импорт). */
    enrichColumnBindings: isBoardTable || isDataTable,
  });

  const loadRecords = async (showLoader = false) => {
    if (!objectId) return;
    if (showLoader) setLoading(true);
    try {
      const loaded = await fetchCustomObjectRecordsPage(objectId, buildRecordsListParams());
      setRecords(loaded.items);
      setRecordsTotal(loaded.total);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const reloadAll = async () => {
    if (!objectId) return;
    setLoading(true);
    try {
      const [loadedFields, loadedStaff, objects, vk] = await Promise.all([
        fetchCustomObjectFields(objectId),
        fetchStaff().catch(() => [] as StaffUser[]),
        fetchCustomObjects().catch(() => [] as CustomObject[]),
        fetchCustomObjectValueKeys(objectId).catch(() => ({ keys: [] as string[] })),
      ]);
      setImportValueKeys(vk.keys || []);
      setFields(loadedFields.filter((f) => f.isActive));
      setStaff(loadedStaff.filter((u) => u.isActive));
      const object = objects.find((item) => item.id === objectId);
      setObjectMeta((object?.meta as Record<string, any> | null) || null);
      setWorkspaceTableName(object?.name ?? null);
      setWorkspaceAreaId(object?.workspaceAreaId ?? null);
      if (object?.workspaceAreaId) {
        touchRecentWorkspaceTable(object.workspaceAreaId, objectId);
        const inArea = await fetchCustomObjects(object.workspaceAreaId);
        setAreaObjects(inArea);
      } else {
        setAreaObjects([]);
      }
      const loaded = await fetchCustomObjectRecordsPage(objectId, buildRecordsListParams());
      setRecords(loaded.items);
      setRecordsTotal(loaded.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTablePage(0);
  }, [objectId]);

  useEffect(() => {
    setPushBoardOpen(false);
    setPushBoardRecordIds([]);
  }, [objectId]);

  useEffect(() => {
    if (!objectId) return;
    let cancelled = false;
    (async () => {
      const objectChanged = prevObjectIdRef.current !== objectId;
      if (objectChanged) prevObjectIdRef.current = objectId;
      setLoading(true);
      try {
        if (objectChanged) {
          const [loadedFields, loadedStaff, objects, vk] = await Promise.all([
            fetchCustomObjectFields(objectId),
            fetchStaff().catch(() => [] as StaffUser[]),
            fetchCustomObjects().catch(() => [] as CustomObject[]),
            fetchCustomObjectValueKeys(objectId).catch(() => ({ keys: [] as string[] })),
          ]);
          if (cancelled) return;
          setImportValueKeys(vk.keys || []);
          setFields(loadedFields.filter((f) => f.isActive));
          setStaff(loadedStaff.filter((u) => u.isActive));
          const object = objects.find((item) => item.id === objectId);
          setObjectMeta((object?.meta as Record<string, any> | null) || null);
          setWorkspaceTableName(object?.name ?? null);
          setWorkspaceAreaId(object?.workspaceAreaId ?? null);
          if (object?.workspaceAreaId) {
            touchRecentWorkspaceTable(object.workspaceAreaId, objectId);
            const inArea = await fetchCustomObjects(object.workspaceAreaId);
            setAreaObjects(inArea);
          } else {
            setAreaObjects([]);
          }
        }
        const loaded = await fetchCustomObjectRecordsPage(objectId, buildRecordsListParams());
        if (cancelled) return;
        setRecords(loaded.items);
        setRecordsTotal(loaded.total);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [objectId, search, tablePage, pageSize, sortFieldKey, sortDirection]);

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
    if (!activeRecord) return;
    const fresh = records.find((r) => r.id === activeRecord.id);
    if (fresh) setActiveRecord(fresh);
  }, [records, activeRecord?.id]);

  useEffect(() => {
    if (!justCreatedRecordId || !justCreatedInputRef.current) return;
    justCreatedInputRef.current.focus();
    justCreatedInputRef.current.select();
    setJustCreatedRecordId(null);
  }, [justCreatedRecordId]);

  useEffect(() => {
    if (!showEditField || !editBindDataObjectId) {
      setDataBindingFieldKeys([]);
      return;
    }
    let cancelled = false;
    fetchCustomObjectFields(editBindDataObjectId)
      .then((list) => {
        if (!cancelled) {
          setDataBindingFieldKeys(
            list.filter((f) => f.isActive).map((f) => f.key).sort((a, b) => a.localeCompare(b)),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setDataBindingFieldKeys([]);
      });
    return () => {
      cancelled = true;
    };
  }, [showEditField, editBindDataObjectId]);

  useEffect(() => {
    if (!showEditField || editBindMode !== 'from_pushed_source' || !dataTablesInArea.length) {
      setPushedSourceFieldKeys([]);
      return;
    }
    let cancelled = false;
    Promise.all(dataTablesInArea.map((o) => fetchCustomObjectFields(o.id)))
      .then((arrays) => {
        if (cancelled) return;
        const s = new Set<string>();
        arrays.flat().forEach((f) => {
          if (f.isActive) s.add(f.key);
        });
        setPushedSourceFieldKeys([...s].sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => {
        if (!cancelled) setPushedSourceFieldKeys([]);
      });
    return () => {
      cancelled = true;
    };
  }, [showEditField, editBindMode, dataTablesInArea]);

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

  const needsCrmLeads = useMemo(
    () => orderedColumns.some((f) => isWorkspaceEntityRefField(f) === 'lead'),
    [orderedColumns],
  );
  const needsCrmProjects = useMemo(
    () => orderedColumns.some((f) => isWorkspaceEntityRefField(f) === 'project'),
    [orderedColumns],
  );
  const needsCrmCompanies = useMemo(
    () => orderedColumns.some((f) => isWorkspaceEntityRefField(f) === 'company'),
    [orderedColumns],
  );

  useEffect(() => {
    if (!needsCrmLeads) return;
    let cancelled = false;
    fetchLeadsList()
      .then((list) => {
        if (!cancelled)
          setCrmLeadList(list.filter((l) => !isLeadOmittedFromAnalytics(l)));
      })
      .catch(() => {
        if (!cancelled) setCrmLeadList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [needsCrmLeads]);

  useEffect(() => {
    if (!needsCrmProjects) return;
    let cancelled = false;
    fetchProjects()
      .then((res) => {
        if (!cancelled)
          setCrmProjectList(res.items.filter((p) => !p.isDeleted));
      })
      .catch(() => {
        if (!cancelled) setCrmProjectList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [needsCrmProjects]);

  useEffect(() => {
    if (!needsCrmCompanies) return;
    let cancelled = false;
    fetchCompanies({ limit: 500 })
      .then((res) => {
        if (!cancelled) setCrmCompanyList(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setCrmCompanyList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [needsCrmCompanies]);

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
    const token = normalizeOptionToken(uiValue);
    const hit = opts.find(
      (o) => normalizeOptionToken(String(o.value || o.label || '')) === token,
    );
    return hit ? String(hit.value ?? '').trim() || uiValue : uiValue;
  };
  const groupField = useMemo(
    () => orderedColumns.find((f) => f.key === 'group' || f.key === 'group_name'),
    [orderedColumns],
  );
  const effectiveGroupKey = groupByFieldKey || groupField?.key || 'group';
  const isPrimaryGrouping = effectiveGroupKey === (groupField?.key || 'group');
  const isStatusGrouping = Boolean(statusField && effectiveGroupKey === statusField.key);
  /** На доске новую строку можно добавить в любую группу (не только при группировке по «group»/статусу). */
  const canAddRowInGroup =
    Boolean(titleField) && (isBoardTable || isPrimaryGrouping || isStatusGrouping);

  useEffect(() => {
    if (!objectId || !isBoardTable || !statusField?.key) return;
    setGroupByFieldKey(statusField.key);
  }, [objectId, isBoardTable, statusField?.key]);

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
  const normalizeStatusToken = (value: string) => normalizeOptionToken(value);
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
    const fld = fields.find((f) => f.key === filterFieldKey);
    const sk = fld ? getWorkspaceFieldValueStorageKey(fld) : filterFieldKey;
    const values = new Set<string>();
    records.forEach((record) => {
      const raw = record.values?.[sk];
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
  }, [filterFieldKey, fields, records]);

  /** Фильтр по полю — только по загруженной странице; сортировка приходит с сервера (sortBy/sortOrder). */
  const filteredAndSortedRecords = useMemo(() => {
    let list = [...records];
    if (filterFieldKey && filterFieldValue) {
      const fld = fields.find((f) => f.key === filterFieldKey);
      const sk = fld ? getWorkspaceFieldValueStorageKey(fld) : filterFieldKey;
      const needle = filterFieldValue.trim().toLowerCase();
      list = list.filter((record) => {
        const raw = record.values?.[sk];
        if (raw === undefined || raw === null) return false;
        if (Array.isArray(raw)) {
          return raw.some((value) => String(value || '').trim().toLowerCase() === needle);
        }
        return String(raw).trim().toLowerCase() === needle;
      });
    }
    return list;
  }, [records, filterFieldKey, filterFieldValue, fields]);

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
  /** Первая группа для кнопки «Новая запись» в тулбаре (если таблица пуста — первый статус из схемы). */
  const primaryBoardToolbarGroup = useMemo(() => {
    if (groupTitles.length > 0) return groupTitles[0];
    if (isBoardTable && isStatusGrouping && statusOptions.length > 0) return statusOptions[0];
    return '';
  }, [groupTitles, isBoardTable, isStatusGrouping, statusOptions]);

  /** Загружен не весь набор — удаление «всей группы» и суммы по группе неполные. */
  const incompleteDataset = recordsTotal > records.length;
  const showTablePagination =
    recordsTotal > 0 && (recordsTotal > pageSize || tablePage > 0);
  const pageRowFrom = recordsTotal === 0 ? 0 : tablePage * pageSize + 1;
  const pageRowTo = Math.min((tablePage + 1) * pageSize, recordsTotal);

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
    const emptyish = (v: unknown) =>
      v === undefined ||
      v === null ||
      v === '' ||
      (Array.isArray(v) && v.length === 0);
    fields.forEach((field) => {
      if (!field.required) return;
      const sk = getWorkspaceFieldValueStorageKey(field);
      const current = next[sk];
      if (!emptyish(current)) return;
      let def = getDefaultValueForField(field);
      if (emptyish(def)) {
        if (field.type === 'text') {
          def = '\u2014';
        } else if (field.type === 'multiselect') {
          def = field.options?.[0]?.value ?? '\u2014';
        }
      }
      next[sk] = def;
      if (sk !== field.key && !emptyish(def)) {
        next[field.key] = def;
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

  useEffect(() => {
    if (!draggingColumnKey) return;
    const onDragOver = (e: DragEvent) => {
      groupTableScrollRefs.current.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (e.clientY < r.top || e.clientY > r.bottom) return;
        const margin = 56;
        const speed = 18;
        if (e.clientX < r.left + margin) {
          el.scrollLeft = Math.max(0, el.scrollLeft - speed);
        } else if (e.clientX > r.right - margin) {
          el.scrollLeft += speed;
        }
      });
    };
    document.addEventListener('dragover', onDragOver);
    return () => document.removeEventListener('dragover', onDragOver);
  }, [draggingColumnKey]);

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
    changedFieldUiKey?: string,
  ) => {
    setSavingRecordId(record.id);
    try {
      setActionError(null);
      const changedField =
        changedFieldUiKey && visibleColumns.find((f) => f.key === changedFieldUiKey);
      const storageKey = changedField ? getWorkspaceFieldValueStorageKey(changedField) : undefined;
      const valuesForRequest =
        changedFieldUiKey && storageKey && Object.prototype.hasOwnProperty.call(nextValues, storageKey)
          ? { [storageKey]: nextValues[storageKey] }
          : nextValues;
      await updateCustomObjectRecord(objectId, record.id, {
        externalId: record.externalId || undefined,
        values: valuesForRequest,
      });
      if (changedFieldUiKey) {
        const field = visibleColumns.find((f) => f.key === changedFieldUiKey);
        pushActivity(
          record.id,
          t('crm.workspace.table.activityUpdated', { field: field?.label || changedFieldUiKey }),
        );
      }
      await loadRecords();
    } catch (error) {
      console.error('Failed to save record', { recordId: record.id, changedFieldUiKey, error });
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
    const valueKey = getWorkspaceFieldValueStorageKey(field);
    const nextValues = { ...(record.values || {}), [valueKey]: storedValue };
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
      setActionError(null);
      const titleSk = getWorkspaceFieldValueStorageKey(titleField);
      const groupFieldDef =
        fields.find((f) => f.key === effectiveGroupKey) ||
        orderedColumns.find((f) => f.key === effectiveGroupKey);
      const groupSk = groupFieldDef
        ? getWorkspaceFieldValueStorageKey(groupFieldDef)
        : effectiveGroupKey;
      const payloadBase: Record<string, any> = {
        [titleSk]: t('crm.workspace.table.newItem'),
        [groupSk]: groupTitle,
      };
      if (statusField && statusField.key !== effectiveGroupKey) {
        payloadBase[getWorkspaceFieldValueStorageKey(statusField)] = statusOptions[0] || 'working_on_it';
      }
      const payload = buildRequiredDefaults(payloadBase);
      const created = await createCustomObjectRecord(objectId, { values: payload });
      await loadRecords();
      setJustCreatedRecordId(created.id);
    } catch (e: unknown) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : t('crm.workspace.table.saveRecordFailed');
      setActionError(msg);
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
      const titleSk = getWorkspaceFieldValueStorageKey(titleField);
      const groupFieldDef =
        fields.find((f) => f.key === effectiveGroupKey) ||
        orderedColumns.find((f) => f.key === effectiveGroupKey);
      const groupSk = groupFieldDef
        ? getWorkspaceFieldValueStorageKey(groupFieldDef)
        : effectiveGroupKey;
      const payloadBase: Record<string, any> = {
        [titleSk]: t('crm.workspace.table.groupFirstRowTitle', { name: newGroupTitle.trim() }),
        [groupSk]: newGroupTitle.trim(),
      };
      if (statusField && statusField.key !== effectiveGroupKey) {
        payloadBase[getWorkspaceFieldValueStorageKey(statusField)] = statusOptions[0] || 'working_on_it';
      }
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
        const sk = getWorkspaceFieldValueStorageKey(field);
        const sanitized = sanitizeFieldValueForDuplicate(field, record.values?.[sk]);
        if (sanitized !== undefined) nextValues[sk] = sanitized;
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

  const handleClearTable = async () => {
    if (!objectId) return;
    if (!window.confirm(t('crm.workspace.table.clearAllConfirm'))) return;
    setBulkProcessing(true);
    setActionError(null);
    try {
      await clearAllCustomObjectRecords(objectId);
      setSelectedIds(new Set());
      await reloadAll();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkProcessing(false);
    }
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
    setEditFieldType(isWorkspaceReadOnlyField(field) ? 'fixed' : field.type);
    setEditFieldOptionsText((field.options || []).map((o) => o.label || o.value).join(', '));
    const b = parseWorkspaceColumnBindingV1(field.meta as Record<string, unknown> | null);
    if (b?.mode === 'from_pushed_source') {
      setEditBindMode('from_pushed_source');
      setEditBindSourceField(b.sourceFieldKey);
      setEditBindDataObjectId('');
      setEditBindPickDataField('');
      setEditBindBoardMatch('');
      setEditBindDataMatch('');
      setEditBindDataDisplay('');
      setEditBindGroupBy('');
      setEditBindValueField('');
      setEditBindAggregate('sum');
    } else if (b?.mode === 'lookup_by_key') {
      setEditBindMode('lookup_by_key');
      setEditBindSourceField('');
      setEditBindDataObjectId(b.dataObjectId);
      setEditBindBoardMatch(b.boardMatchFieldKey);
      setEditBindDataMatch(b.dataMatchFieldKey);
      setEditBindDataDisplay(b.dataDisplayFieldKey);
      setEditBindPickDataField('');
      setEditBindGroupBy('');
      setEditBindValueField('');
      setEditBindAggregate('sum');
    } else if (b?.mode === 'pick_from_data') {
      setEditBindMode('pick_from_data');
      setEditBindSourceField('');
      setEditBindDataObjectId(b.dataObjectId);
      setEditBindPickDataField(b.dataFieldKey);
      setEditBindBoardMatch('');
      setEditBindDataMatch('');
      setEditBindDataDisplay('');
      setEditBindGroupBy('');
      setEditBindValueField('');
      setEditBindAggregate('sum');
    } else if (b?.mode === 'rollup') {
      setEditBindMode('rollup');
      setEditBindSourceField('');
      setEditBindDataObjectId(b.dataObjectId);
      setEditBindPickDataField('');
      setEditBindBoardMatch(b.boardMatchFieldKey);
      setEditBindDataMatch('');
      setEditBindDataDisplay('');
      setEditBindGroupBy(b.groupByFieldKey);
      setEditBindValueField(b.valueFieldKey);
      setEditBindAggregate(b.aggregate);
    } else {
      setEditBindMode('off');
      setEditBindSourceField('');
      setEditBindDataObjectId('');
      setEditBindPickDataField('');
      setEditBindBoardMatch('');
      setEditBindDataMatch('');
      setEditBindDataDisplay('');
      setEditBindGroupBy('');
      setEditBindValueField('');
      setEditBindAggregate('sum');
    }
    const mk = (field.meta as Record<string, unknown> | undefined)?.[WORKSPACE_MAPS_TO_IMPORTED_KEY];
    setEditMapsToImportedKey(typeof mk === 'string' ? mk : '');
    setEditCrmEntityRef(parseWorkspaceEntityRef(field.meta as Record<string, unknown> | null) ?? 'none');
    setShowEditField(true);
  };

  const saveEditedColumn = async () => {
    if (!editingField || !editFieldLabel.trim()) return;
    const normalizedKey = normalizeFieldKey(editFieldKey);
    if (!normalizedKey) return;
    setUpdatingField(true);
    try {
      const baseMeta: Record<string, unknown> = {
        ...(editingField.meta && typeof editingField.meta === 'object' && !Array.isArray(editingField.meta)
          ? (editingField.meta as Record<string, unknown>)
          : {}),
      };
      const mapTrim = editMapsToImportedKey.trim();
      if (mapTrim && mapTrim !== normalizedKey) {
        baseMeta[WORKSPACE_MAPS_TO_IMPORTED_KEY] = mapTrim;
      } else {
        delete baseMeta[WORKSPACE_MAPS_TO_IMPORTED_KEY];
      }
      const isFixedEdit = editFieldType === 'fixed';
      if (isFixedEdit) {
        baseMeta[WORKSPACE_IS_READONLY_KEY] = true;
      } else {
        delete baseMeta[WORKSPACE_IS_READONLY_KEY];
      }
      if (editFieldType === 'text') {
        if (
          editCrmEntityRef === 'lead' ||
          editCrmEntityRef === 'project' ||
          editCrmEntityRef === 'company'
        ) {
          baseMeta[WORKSPACE_ENTITY_REF_KEY] = editCrmEntityRef;
        } else {
          delete baseMeta[WORKSPACE_ENTITY_REF_KEY];
        }
      } else {
        delete baseMeta[WORKSPACE_ENTITY_REF_KEY];
      }
      if (isBoardTable) {
        delete baseMeta.columnBinding;
        if (editBindMode === 'from_pushed_source' && editBindSourceField.trim()) {
          baseMeta.columnBinding = {
            version: 1,
            mode: 'from_pushed_source',
            sourceFieldKey: editBindSourceField.trim(),
          };
        } else if (
          editBindMode === 'lookup_by_key' &&
          editBindDataObjectId &&
          editBindBoardMatch.trim() &&
          editBindDataMatch.trim() &&
          editBindDataDisplay.trim()
        ) {
          baseMeta.columnBinding = {
            version: 1,
            mode: 'lookup_by_key',
            dataObjectId: editBindDataObjectId,
            boardMatchFieldKey: editBindBoardMatch.trim(),
            dataMatchFieldKey: editBindDataMatch.trim(),
            dataDisplayFieldKey: editBindDataDisplay.trim(),
          };
        } else if (
          editBindMode === 'pick_from_data' &&
          editBindDataObjectId &&
          editBindPickDataField.trim()
        ) {
          baseMeta.columnBinding = {
            version: 1,
            mode: 'pick_from_data',
            dataObjectId: editBindDataObjectId,
            dataFieldKey: editBindPickDataField.trim(),
          };
        } else if (
          editBindMode === 'rollup' &&
          editBindDataObjectId &&
          editBindBoardMatch.trim() &&
          editBindGroupBy.trim() &&
          editBindValueField.trim()
        ) {
          baseMeta.columnBinding = {
            version: 1,
            mode: 'rollup',
            dataObjectId: editBindDataObjectId,
            boardMatchFieldKey: editBindBoardMatch.trim(),
            groupByFieldKey: editBindGroupBy.trim(),
            valueFieldKey: editBindValueField.trim(),
            aggregate: editBindAggregate,
          };
        }
      }
      const resolvedEditType: CustomObjectFieldType =
        editFieldType === 'fixed' ? 'text' : (editFieldType as CustomObjectFieldType);
      await updateCustomObjectField(objectId, editingField.id, {
        key: normalizedKey,
        label: editFieldLabel.trim(),
        type: resolvedEditType,
        options:
          resolvedEditType === 'select' || resolvedEditType === 'status' || resolvedEditType === 'multiselect'
            ? parseOptions(editFieldOptionsText)
            : undefined,
        meta: baseMeta,
      });
      setShowEditField(false);
      setEditingField(null);
      await reloadAll();
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
      const mapTrim = newFieldMapsToImportKey.trim();
      const meta: Record<string, unknown> = {};
      if (mapTrim && mapTrim !== normalizedKey) {
        meta[WORKSPACE_MAPS_TO_IMPORTED_KEY] = mapTrim;
      }
      const isCrmLead = newFieldType === 'crm_lead';
      const isCrmProject = newFieldType === 'crm_project';
      const isCrmCompany = newFieldType === 'crm_company';
      const isReadonlyPseudo = newFieldType === 'readonly';
      const resolvedFieldType: CustomObjectFieldType =
        isCrmLead || isCrmProject || isCrmCompany || isReadonlyPseudo
          ? 'text'
          : (newFieldType as CustomObjectFieldType);
      if (isCrmLead) meta[WORKSPACE_ENTITY_REF_KEY] = 'lead';
      if (isCrmProject) meta[WORKSPACE_ENTITY_REF_KEY] = 'project';
      if (isCrmCompany) meta[WORKSPACE_ENTITY_REF_KEY] = 'company';
      if (isReadonlyPseudo) meta[WORKSPACE_IS_READONLY_KEY] = true;
      await createCustomObjectField(objectId, {
        key: normalizedKey,
        label: newFieldLabel.trim(),
        type: resolvedFieldType,
        options:
          resolvedFieldType === 'select' ||
          resolvedFieldType === 'status' ||
          resolvedFieldType === 'multiselect'
            ? parseOptions(newFieldOptionsText)
            : undefined,
        meta: Object.keys(meta).length ? meta : undefined,
      });
      setNewFieldKey('');
      setNewFieldLabel('');
      setNewFieldType('text');
      setNewFieldOptionsText('');
      setNewFieldMapsToImportKey('');
      setAddFieldError(null);
      setShowAddField(false);
      await reloadAll();
    } finally {
      setAddingField(false);
    }
  };

  const applyPreset = async (preset: (typeof defaultFieldPresets)[number]) => {
    const payload = {
      key: preset.key,
      label: preset.label,
      type: preset.type,
      ...('required' in preset ? { required: preset.required as boolean } : {}),
      ...('options' in preset && preset.options
        ? { options: preset.options.map((o) => ({ ...o })) }
        : {}),
      ...('meta' in preset && preset.meta ? { meta: { ...preset.meta } } : {}),
    };
    await createCustomObjectField(objectId, payload);
    await reloadAll();
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
      options: field.options?.length ? field.options.map((o) => ({ ...o })) : undefined,
      required: false,
      meta:
        field.meta && typeof field.meta === 'object' && !Array.isArray(field.meta)
          ? { ...(field.meta as Record<string, unknown>) }
          : undefined,
    });
    await reloadAll();
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
        await reloadAll();
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
    const raw = record.values?.[getWorkspaceFieldValueStorageKey(field)];
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
      const on =
        raw === true ||
        raw === 1 ||
        raw === '1' ||
        raw === 'true' ||
        raw === 'yes';
      return on
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
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
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
          className="block w-full max-w-full md:hidden rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 pr-8 text-center text-xs leading-5 focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
        />
        <input
          type={type === 'date' ? 'date' : 'datetime-local'}
          lang={i18n.language}
          defaultValue={type === 'date' ? value.slice(0, 10) : value.slice(0, 16)}
          onBlur={(e) => updateCell(record, field, e.target.value)}
          className="hidden md:block w-full max-w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 pr-8 text-center text-xs leading-5 focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
        />
      </div>
    </td>
  );

  const renderCell = (record: CustomObjectRecord, field: CustomObjectField) => {
    const value = record.values?.[getWorkspaceFieldValueStorageKey(field)];
    const textValue = String(value ?? '');
    const width = columnWidths[field.key] || 180;
    const sticky = field.key === titleField?.key ? 'lv-ws-title-td' : '';
    const fieldType = String(field.type || '').toLowerCase();
    const isDateField = isRenderableWorkspaceDateField(field);

    if (isDataTable) {
      // --- DATA TABLE: read-only display, no editing ---
      if (field.type === 'file') {
        const raw = record.values?.[getWorkspaceFieldValueStorageKey(field)];
        const fileVal =
          raw && typeof raw === 'object' && !Array.isArray(raw)
            ? (raw as WorkspaceFileFieldValue)
            : null;
        const has = Boolean(fileVal?.relativePath && fileVal?.name);
        return (
          <td key={field.id} className={`px-3 py-1.5 ${sticky}`} style={{ width, minWidth: 160 }}>
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
                className="min-w-0 max-w-[220px] truncate rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-center text-xs font-medium text-slate-900 hover:bg-slate-100"
              >
                {fileVal!.name}
              </button>
            ) : (
              <span className="text-center text-xs text-slate-400">—</span>
            )}
          </td>
        );
      }

      const crmRefRo = isWorkspaceEntityRefField(field);
      if (crmRefRo) {
        return (
          <td key={field.id} className={`px-3 py-1.5 ${sticky} align-middle`} style={{ width, minWidth: 200 }}>
            <WorkspaceCrmEntityMultiField
              entity={crmRefRo}
              rawValue={record.values?.[getWorkspaceFieldValueStorageKey(field)]}
              leads={crmLeadList}
              projects={crmProjectList}
              companies={crmCompanyList}
              readOnly
              variant="table"
            />
          </td>
        );
      }

      if (field.type === 'boolean') {
        return (
          <td key={field.id} className={`px-3 py-1.5 ${sticky}`} style={{ width, minWidth: 120 }}>
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={Boolean(value)}
                readOnly
                className="h-4 w-4 rounded border-slate-300 opacity-60 cursor-default"
              />
            </div>
          </td>
        );
      }

      if (field.type === 'status') {
        const normalizedOpts = (field.options || [])
          .map((o) => ({ value: String(o.value ?? '').trim(), label: String(o.label ?? o.value ?? '').trim() }))
          .filter((o) => o.value);
        const fromRec = collectStatusValuesFromRecords([record], field.key);
        const seenVals = new Set(normalizedOpts.map((o) => o.value));
        const allOpts = [
          ...normalizedOpts,
          ...fromRec.filter((v) => v && !seenVals.has(v)).map((v) => ({ value: v, label: v.replace(/_/g, ' ') })),
        ];
        const colors = (field.meta?.statusColors || {}) as Record<string, string>;
        const raw = textValue.trim();
        const hit =
          allOpts.find((o) => o.value === raw) ||
          allOpts.find((o) => o.label === raw) ||
          allOpts.find((o) => normalizeOptionToken(o.value) === normalizeOptionToken(raw));
        const curVal = hit?.value || '';
        const curLabel = hit?.label || curVal || raw;
        const hex = colors[curVal];
        const badgeStyle = hex
          ? { backgroundColor: hex, color: pickTextColorForBg(hex), borderColor: hex }
          : undefined;
        return (
          <td key={field.id} className={`px-3 py-1.5 ${sticky}`} style={{ width, minWidth: 120 }}>
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-center text-xs border ${badgeStyle ? 'bg-transparent' : getStatusColor(curVal)}`}
              style={badgeStyle}
            >
              {curLabel || '—'}
            </span>
          </td>
        );
      }

      if (field.type === 'multiselect') {
        const selected = Array.isArray(value)
          ? (value as string[])
          : String(value || '').split(',').map((v) => v.trim()).filter(Boolean);
        return (
          <td key={field.id} className={`px-3 py-1.5 ${sticky}`} style={{ width, minWidth: 120 }}>
            <div className="flex flex-wrap items-center justify-center gap-1">
              {selected.length === 0 ? (
                <span className="text-xs text-slate-400">—</span>
              ) : (
                selected.map((tag) => (
                  <span key={tag} className="inline-flex items-center rounded-full bg-slate-100 text-lumiva-accent text-[11px] px-2 py-0.5">
                    {tag}
                  </span>
                ))
              )}
            </div>
          </td>
        );
      }

      if (field.type === 'select') {
        const selectColors = (field.meta?.selectColors || {}) as Record<string, string>;
        const selHex =
          selectColors[textValue] ||
          Object.entries(selectColors).find(
            ([k]) => normalizeOptionToken(k) === normalizeOptionToken(textValue),
          )?.[1];
        const selStyle = selHex
          ? { backgroundColor: selHex, color: pickTextColorForBg(selHex), borderColor: selHex }
          : undefined;
        return (
          <td key={field.id} className={`px-3 py-1.5 ${sticky}`} style={{ width, minWidth: 120 }}>
            <span
              className="inline-block rounded-full px-2.5 py-1 text-center text-xs border border-slate-200"
              style={selStyle}
            >
              {textValue || '—'}
            </span>
          </td>
        );
      }

      if (isDateField) {
        const display = fieldType === 'datetime' ? textValue.slice(0, 16) : textValue.slice(0, 10);
        return (
          <td key={field.id} className={`px-3 py-1.5 ${sticky}`} style={{ width, minWidth: 120 }}>
            <span className="text-center text-xs text-slate-700">{display || '—'}</span>
          </td>
        );
      }

      return (
        <td key={field.id} className={`px-3 py-1.5 ${sticky}`} style={{ width, minWidth: 120 }}>
          <div className="min-w-0 text-center text-xs text-slate-800 whitespace-pre-line break-words">
            {textValue || '—'}
          </div>
        </td>
      );
    }

    // Board table: readonly fields — display only, no editing
    if (isWorkspaceReadOnlyField(field)) {
      return (
        <td key={field.id} className={`px-3 py-1.5 ${sticky}`} style={{ width, minWidth: 120 }}>
          <div className="min-w-0 text-center text-xs text-slate-700 whitespace-pre-line break-words">
            {textValue || '—'}
          </div>
        </td>
      );
    }

    const pickBind = isBoardTable
      ? parseWorkspaceColumnBindingV1(field.meta as Record<string, unknown> | null)
      : null;
    if (
      pickBind?.mode === 'pick_from_data' &&
      (field.type === 'text' || field.type === 'number' || field.type === 'select')
    ) {
      const optKey = `${pickBind.dataObjectId}\x1e${pickBind.dataFieldKey}`;
      const opts = pickFromDataOptionsByKey[optKey] || [];
      const multiline = textValue.includes('\n');
      return (
        <td
          key={field.id}
          className={`px-3 py-1.5 ${sticky}`}
          style={{ width, minWidth: 120 }}
        >
          {multiline ? (
            <div className="mb-1 max-h-28 overflow-y-auto whitespace-pre-line text-center text-xs leading-snug text-slate-800">
              {textValue}
            </div>
          ) : null}
          <select
            value={textValue}
            onChange={(e) => updateCell(record, field, e.target.value)}
            className="w-full max-w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs"
            title={t('crm.workspace.table.pickFromDataTitle')}
          >
            <option value="">{t('crm.workspace.table.pickFromDataPlaceholder')}</option>
            {opts.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </td>
      );
    }

    const crmRef = isWorkspaceEntityRefField(field);
    if (crmRef) {
      const valueKey = getWorkspaceFieldValueStorageKey(field);
      return (
        <td
          key={field.id}
          className={`px-3 py-1.5 ${sticky} align-middle`}
          style={{ width, minWidth: 200 }}
        >
          <WorkspaceCrmEntityMultiField
            entity={crmRef}
            rawValue={record.values?.[valueKey]}
            leads={crmLeadList}
            projects={crmProjectList}
            companies={crmCompanyList}
            onCommit={(serialized) =>
              updateCell(record, field, serialized === '' ? null : serialized)
            }
            variant="table"
          />
        </td>
      );
    }

    if (field.type === 'file') {
      const raw = record.values?.[getWorkspaceFieldValueStorageKey(field)];
      const fileVal =
        raw && typeof raw === 'object' && !Array.isArray(raw)
          ? (raw as WorkspaceFileFieldValue)
          : null;
      const has = Boolean(fileVal?.relativePath && fileVal?.name);
      const inputId = `ws-file-${record.id}-${field.key}`;
      return (
        <td
          key={field.id}
          className={`px-3 py-1.5 ${sticky}`}
          style={{ width, minWidth: 160 }}
        >
          <div className="flex min-w-0 flex-col items-center gap-0.5">
            <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
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
                className="min-w-0 max-w-[220px] truncate rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-center text-xs font-medium text-slate-900 hover:bg-slate-100"
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
            <span className="text-center text-[10px] leading-tight text-slate-400">
              {t('crm.workspace.table.fileMaxLine', { label: WORKSPACE_UPLOAD_MAX_FILE_LABEL })}
            </span>
          </div>
        </td>
      );
    }

    if (field.type === 'status') {
      const normalizedOptions =
        (field.options || [])
          .map((o) => ({
            value: String(o.value ?? '').trim(),
            label: String(o.label ?? o.value ?? '').trim(),
          }))
          .filter((o) => o.value);
      const fromRecords = collectStatusValuesFromRecords([record], field.key);
      const seen = new Set(normalizedOptions.map((o) => o.value));
      const extras = fromRecords
        .filter((v) => v && !seen.has(v))
        .map((v) => ({ value: v, label: v.replace(/_/g, ' ') }));
      const allOptions = [...normalizedOptions, ...extras];
      const colors = (field.meta?.statusColors || {}) as Record<string, string>;
      const raw = textValue.trim();
      const hit =
        allOptions.find((o) => o.value === raw) ||
        allOptions.find((o) => o.label === raw) ||
        allOptions.find(
          (o) => normalizeOptionToken(o.value) === normalizeOptionToken(raw),
        );
      const currentValue = hit?.value || allOptions[0]?.value || '';
      const hex = colors[currentValue];
      const style = hex
        ? {
            backgroundColor: hex,
            color: pickTextColorForBg(hex),
            borderColor: hex,
          }
        : undefined;
      return (
        <td
          key={field.id}
          className={`${mondayBoardUi ? 'p-0 align-stretch' : 'px-3 py-1.5'} ${sticky}`}
          style={{ width, minWidth: 120 }}
        >
          <select
            value={currentValue}
            onChange={(e) =>
              updateCell(record, field, canonicalStatusPayloadValue(field, e.target.value))
            }
            style={style}
            className={
              mondayBoardUi
                ? `min-h-[42px] w-full max-w-full appearance-none rounded-none border-0 px-3 py-2.5 text-center text-xs font-semibold outline-none ring-0 focus:ring-2 focus:ring-inset focus:ring-black/10 ${
                    style ? '' : getStatusColor(currentValue)
                  }`
                : `rounded-full px-2.5 py-1 text-center text-xs border ${
                    style ? 'bg-transparent' : getStatusColor(currentValue)
                  }`
            }
          >
            {allOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label || opt.value}
              </option>
            ))}
          </select>
        </td>
      );
    }

    const isCanonicalSelectStatusColumn =
      statusField && field.key === statusField.key && field.type === 'select';

    if (isCanonicalSelectStatusColumn) {
      const resolvedStatus =
        resolveStatusOptionValue(textValue) || statusOptions[0] || 'working_on_it';
      const style = getStatusStyle(resolvedStatus);
      return (
        <td
          key={field.id}
          className={`${mondayBoardUi ? 'p-0 align-stretch' : 'px-3 py-1.5'} ${sticky}`}
          style={{ width, minWidth: 120 }}
        >
          <select
            value={resolvedStatus}
            onChange={(e) => updateCell(record, field, e.target.value)}
            style={style}
            className={
              mondayBoardUi
                ? `min-h-[42px] w-full max-w-full appearance-none rounded-none border-0 px-3 py-2.5 text-center text-xs font-semibold outline-none ring-0 focus:ring-2 focus:ring-inset focus:ring-black/10 ${
                    style ? '' : getStatusColor(resolvedStatus)
                  }`
                : `rounded-full px-2.5 py-1 text-center text-xs border ${
                    style ? 'bg-transparent' : getStatusColor(resolvedStatus)
                  }`
            }
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
        <td key={field.id} className={`px-3 py-1.5 ${sticky}`} style={{ width, minWidth: 120 }}>
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => updateCell(record, field, e.target.checked ? 'true' : 'false')}
              className="h-4 w-4 rounded border-slate-300"
            />
          </div>
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
      return (
        <td key={field.id} className={`px-3 py-1.5 ${sticky}`} style={{ width, minWidth: 120 }}>
          <div className="flex flex-wrap items-center justify-center gap-1">
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
      const options = isPriorityField ? priorityLikeOptions : [...normalizedOptions];
      if (!isPriorityField) {
        const seen = new Set(options.map((o) => o.value));
        records.forEach((r) => {
          const raw = r.values?.[getWorkspaceFieldValueStorageKey(field)];
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
      const selectColors = (field.meta?.selectColors || {}) as Record<string, string>;
      const selectHex =
        selectColors[currentValue] ||
        Object.entries(selectColors).find(
          ([k]) => normalizeOptionToken(k) === normalizeOptionToken(currentValue),
        )?.[1];
      const selectStyle = selectHex
        ? {
            backgroundColor: selectHex,
            color: pickTextColorForBg(selectHex),
            borderColor: selectHex,
          }
        : undefined;
      const priorityHex = getPriorityStripHex(currentValue);
      const priorityStyle = {
        backgroundColor: priorityHex,
        color: pickTextColorForBg(priorityHex),
      };

      return (
        <td
          key={field.id}
          className={`${mondayBoardUi ? 'p-0 align-stretch' : 'px-3 py-1.5'} ${sticky}`}
          style={{ width, minWidth: 120 }}
        >
          {isPriorityField ? (
            <div className="relative h-full min-h-[42px]" data-workspace-inline-popover>
              <button
                type="button"
                onClick={() =>
                  setActivePriorityMenu((prev) =>
                    prev?.recordId === record.id && prev?.fieldKey === field.key
                      ? null
                      : { recordId: record.id, fieldKey: field.key },
                  )
                }
                style={mondayBoardUi ? priorityStyle : undefined}
                className={
                  mondayBoardUi
                    ? 'flex h-full min-h-[42px] w-full items-center justify-center gap-2 border-0 px-3 py-2.5 text-center text-xs font-semibold outline-none ring-0 focus:ring-2 focus:ring-inset focus:ring-black/10'
                    : 'w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs font-medium text-slate-800 hover:bg-slate-50'
                }
              >
                <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
                  <span className="truncate">{currentLabel}</span>
                  <span className={mondayBoardUi ? 'opacity-90' : 'text-slate-400'}>▾</span>
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
                        className={`w-full rounded-lg px-2 py-1.5 text-center text-xs ${
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
            <>
              {textValue.includes('\n') ? (
                <div className="mb-1 max-h-24 overflow-y-auto whitespace-pre-line text-center text-xs leading-snug text-slate-800">
                  {textValue}
                </div>
              ) : null}
              <select
                value={currentValue}
                onChange={(e) => updateCell(record, field, e.target.value)}
                style={mondayBoardUi ? selectStyle : undefined}
                className={
                  mondayBoardUi
                    ? `min-h-[42px] w-full max-w-full appearance-none rounded-none border-0 px-3 py-2.5 text-center text-xs font-semibold outline-none ring-0 focus:ring-2 focus:ring-inset focus:ring-black/10 ${
                        selectStyle ? '' : getStatusColor(currentValue)
                      }`
                    : 'w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-xs text-slate-700'
                }
              >
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label || opt.value}
                  </option>
                ))}
              </select>
            </>
          )}
        </td>
      );
    }

    if (mondayBoardUi && titleField && field.key === titleField.key) {
      return (
        <td
          key={field.id}
          className={`px-2 py-0 ${sticky}`}
          style={{ width, minWidth: 200 }}
        >
          <div className="flex h-full min-h-[42px] items-center justify-center gap-1">
            <span
              className="hidden shrink-0 select-none text-slate-300 opacity-0 transition-opacity group-hover/row:opacity-100 sm:inline"
              aria-hidden
            >
              ⋮⋮
            </span>
            {textValue.includes('\n') ? (
              <textarea
                key={`${record.id}-${field.key}-title`}
                defaultValue={textValue}
                rows={Math.min(6, textValue.split('\n').length + 1)}
                onBlur={(e) => updateCell(record, field, e.target.value)}
                className="min-w-0 flex-1 resize-y border-0 bg-transparent py-2 text-center text-sm text-slate-900 outline-none ring-0 focus:ring-0 whitespace-pre-line"
              />
            ) : (
              <input
                key={`${record.id}-${field.key}-title`}
                ref={record.id === justCreatedRecordId ? justCreatedInputRef : undefined}
                defaultValue={textValue}
                onBlur={(e) => updateCell(record, field, e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent py-2 text-center text-sm text-slate-900 outline-none ring-0 focus:ring-0"
              />
            )}
            <button
              type="button"
              onClick={() => setActiveRecord(record)}
              className="btn-icon shrink-0"
              title={t('crm.workspace.table.boardOpenDrawer')}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
                aria-hidden
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M16 13H8" />
                <path d="M16 17H8" />
                <path d="M10 9H8" />
              </svg>
            </button>
          </div>
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
        .split(/[,;\/\n]+/)
        .map((v) => v.trim())
        .filter(Boolean);
      return (
        <td key={field.id} className={`px-3 py-1.5 ${sticky}`} style={{ width, minWidth: 120 }}>
          <div className="flex flex-wrap items-center justify-center gap-1">
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

    if (field.type === 'text' && textValue.includes('\n')) {
      const lineCount = textValue.split('\n').length;
      return (
        <td key={field.id} className={`px-3 py-1.5 ${sticky}`} style={{ width, minWidth: 120 }}>
          <textarea
            defaultValue={textValue}
            rows={Math.min(8, lineCount + 1)}
            onBlur={(e) => updateCell(record, field, e.target.value)}
            className="w-full min-h-[2.5rem] rounded-md border border-transparent px-2 py-1 text-center text-xs leading-snug focus:border-slate-300 focus:bg-white whitespace-pre-line"
          />
        </td>
      );
    }

    return (
      <td key={field.id} className={`px-3 py-1.5 ${sticky}`} style={{ width, minWidth: 120 }}>
        <input
          defaultValue={textValue}
          onBlur={(e) => updateCell(record, field, e.target.value)}
          className="w-full rounded-md border border-transparent px-2 py-1 text-center text-sm focus:border-slate-300 focus:bg-white"
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
                  className={`w-full text-center text-xs rounded-lg px-2 py-1 ${
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
                      className={`w-full text-center text-xs rounded-lg px-2 py-1.5 ${
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
      <div
        className="lv-pt w-full pb-8 min-w-0"
        style={{
          marginLeft: -24,
          marginRight: -24,
          paddingLeft: 24,
          paddingRight: 24,
          width: 'calc(100% + 48px)',
        }}
      >
      <div className="space-y-4">
        <div className="lv-pt-head">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
            <h1>{workspaceTableName || t('crm.workspace.table.startFromScratch')}</h1>
            {objectMeta &&
              (getWorkspaceTableKind(objectMeta as Record<string, unknown>) === 'board' ? (
                <span
                  className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border"
                  style={{
                    background: 'var(--ink)',
                    color: '#fff',
                    borderColor: 'var(--ink)',
                  }}
                  title={t('crm.workspace.kindBadge.board')}
                >
                  {t('crm.workspace.kindBadge.shortBoard')}
                </span>
              ) : (
                <span
                  className="shrink-0 inline-flex items-center gap-1 text-[12px] font-medium"
                  style={{ color: 'var(--fg-3)' }}
                  title={t('crm.workspace.kindBadge.dataLayerTitle')}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--fg-4)]" aria-hidden />
                  {t('crm.workspace.kindBadge.dataShortOnly')}
                </span>
              ))}
            </div>
            {isDataTable && (
              <p className="sub max-w-2xl">{t('crm.workspace.table.dataLayerSubtitle')}</p>
            )}
          </div>
          <div className="lv-pt-head-actions">
            <button
              type="button"
              onClick={() => navigate(`/workspace/${objectId}/import`)}
              className="lv-tb-btn"
            >
              {t('crm.workspace.table.importButton')}
            </button>
            {(isBoardTable || isDataTable) && (
              <button
                type="button"
                onClick={() => void handleClearTable()}
                disabled={bulkProcessing || loading}
                className="lv-tb-btn"
                style={{ borderColor: '#fecaca', color: '#b91c1c' }}
              >
                {t('crm.workspace.table.clearAllButton')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAddField(true)}
              className="lv-tb-btn"
              style={{ background: '#222', color: '#fff', borderColor: '#222' }}
            >
              {t('crm.workspace.table.addField')}
            </button>
          </div>
        </div>

        <WorkspaceViewTabs objectId={objectId} active="table" />

        <div className="lv-toolbar">
          {mondayBoardUi && (
            <button
              type="button"
              disabled={
                !titleField ||
                !primaryBoardToolbarGroup ||
                !canAddRowInGroup ||
                Boolean(savingRecordId?.startsWith('new-'))
              }
              onClick={() => void createRowInGroup(primaryBoardToolbarGroup)}
              className="lv-tb-btn shrink-0"
              style={{ background: '#222', color: '#fff', borderColor: '#222' }}
            >
              <span className="text-lg leading-none">+</span>
              {t('crm.workspace.table.boardToolbarNew')}
            </button>
          )}
          <div className="lv-tb-search" style={{ flex: '1 1 180px', maxWidth: mondayBoardUi ? 320 : 300 }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--fg-4)', flexShrink: 0 }} aria-hidden>
              <circle cx="6.5" cy="6.5" r="5.5" />
              <path d="M11 11l3.5 3.5" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setTablePage(0);
              }}
              placeholder={t('crm.workspace.table.searchRecords')}
            />
            {search ? (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setTablePage(0);
                }}
                style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--fg-3)', fontSize: 14, padding: 0, lineHeight: 1 }}
              >
                ×
              </button>
            ) : null}
          </div>

          <div className="lv-toolbar-divider" />

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setFilterMenuOpen((prev) => !prev);
                setSortMenuOpen(false);
                setGroupMenuOpen(false);
              }}
              className={`lv-tb-btn whitespace-nowrap${filterMenuOpen ? ' active' : ''}`}
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
                    setTablePage(0);
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
                  onChange={(e) => {
                    setFilterFieldValue(e.target.value);
                    setTablePage(0);
                  }}
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
                    setTablePage(0);
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
              className={`lv-tb-btn whitespace-nowrap${sortMenuOpen ? ' active' : ''}`}
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
                  onChange={(e) => {
                    setSortFieldKey(e.target.value);
                    setTablePage(0);
                  }}
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
                  onChange={(e) => {
                    setSortDirection(e.target.value as 'asc' | 'desc');
                    setTablePage(0);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                >
                  <option value="asc">{t('crm.workspace.table.ascending')}</option>
                  <option value="desc">{t('crm.workspace.table.descending')}</option>
                </select>
              </div>
            )}
          </div>
          {!mondayBoardUi && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setGroupMenuOpen((prev) => !prev);
                setSortMenuOpen(false);
                setFilterMenuOpen(false);
              }}
              className={`lv-tb-btn whitespace-nowrap${groupMenuOpen ? ' active' : ''}`}
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
          )}
          {mondayBoardUi && statusField && (
            <span className="text-[11px] text-slate-500 px-2 py-1 rounded-md bg-slate-100 border border-slate-200/80">
              {t('crm.workspace.table.groupByStatusLocked', { field: statusField.label })}
            </span>
          )}
          {hiddenColumnList.length > 0 && (
            <button type="button" className="lv-tb-btn whitespace-nowrap" onClick={() => setHiddenColumns({})}>
              {t('crm.workspace.table.showHiddenColumns', { count: hiddenColumnList.length })}
            </button>
          )}
          {hiddenRowsCount > 0 && (
            <button type="button" className="lv-tb-btn whitespace-nowrap" onClick={() => setHiddenRows({})}>
              {t('crm.workspace.table.showHiddenRows', { count: hiddenRowsCount })}
            </button>
          )}
          <div className="lv-toolbar-spacer" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="lv-group-meta rounded-full bg-[var(--bg-soft)] px-2 py-0.5">
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
                  className="rounded-lg border border-[var(--line-2)] px-2 py-1 text-xs bg-white text-[var(--ink)]"
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
                  className="lv-tb-btn px-2 py-1 text-xs disabled:opacity-60"
                >
                  {t('crm.workspace.table.move')}
                </button>
                {isDataTable && (
                  <button
                    type="button"
                    onClick={() => {
                      setPushBoardRecordIds(Array.from(selectedIds));
                      setPushBoardOpen(true);
                    }}
                    disabled={bulkProcessing}
                    className="lv-tb-btn px-2 py-1 text-xs disabled:opacity-60"
                    style={{ borderColor: '#bae6fd', background: '#f0f9ff', color: '#0369a1' }}
                  >
                    {t('crm.workspace.table.pushToBoardBulk')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={bulkHideRows}
                  disabled={bulkProcessing}
                  className="lv-tb-btn px-2 py-1 text-xs disabled:opacity-60"
                >
                  {t('crm.workspace.table.hide')}
                </button>
                <button
                  type="button"
                  onClick={() => void bulkDeleteRows()}
                  disabled={bulkProcessing}
                  className="lv-tb-btn px-2 py-1 text-xs disabled:opacity-60"
                  style={{ borderColor: '#fecaca', color: '#b91c1c' }}
                >
                  {bulkProcessing ? t('crm.workspace.table.deleting') : t('crm.workspace.table.bulkDelete')}
                </button>
              </>
            )}
            <span className="lv-group-meta">
              {selectedIds.size > 0
                ? t('crm.workspace.table.selectedCount', { count: selectedIds.size })
                : incompleteDataset
                  ? t('crm.workspace.table.footerItemsPage', {
                      total: recordsTotal,
                      from: pageRowFrom,
                      to: pageRowTo,
                    })
                  : t('crm.workspace.table.footerItemsCount', { count: recordsTotal })}
            </span>
          </div>
        </div>
        {actionError && (
          <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-[8px] px-3 py-2 mb-[14px]">
            {actionError}
          </div>
        )}

        {isDataTable && (
          <div className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded-[8px] px-3 py-2 mb-[14px]">
            {t('crm.workspace.table.dataRowsBulkHint')}
          </div>
        )}

        {loading ? (
          <div className="text-[12px] text-slate-400 mb-[14px]">{t('crm.workspace.table.loadingData')}</div>
        ) : (
          <div className="space-y-4">
            {isDataTable ? (
              <div className="lv-proj-wrap">
                <div className="lv-proj-scroll">
                  <table className="lv-proj-table min-w-[1000px] w-full text-[12.5px]">
                    <thead>
                      <tr>
                        <th className="lv-ws-lead-th" />
                        {orderedColumns.map((field) => (
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
                              setColumnDragOverKey(null);
                              const ghost = createColumnDragGhostElement(field.label);
                              document.body.appendChild(ghost);
                              e.dataTransfer.setDragImage(ghost, 26, 36);
                              requestAnimationFrame(() => ghost.remove());
                            }}
                            onDragEnd={() => {
                              setDraggingColumnKey(null);
                              setDragReadyColumnKey(null);
                              setColumnDragOverKey(null);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (draggingColumnKey && draggingColumnKey !== field.key) {
                                setColumnDragOverKey(field.key);
                              }
                            }}
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
                              setColumnDragOverKey(null);
                            }}
                            className={[
                              field.key === titleField?.key ? 'lv-ws-title-th' : '',
                              holdingColumnKey === field.key ? 'bg-slate-50 ring-1 ring-slate-300' : '',
                              dragReadyColumnKey === field.key ? 'bg-slate-100 ring-2 ring-slate-400' : '',
                              draggingColumnKey &&
                              columnDragOverKey === field.key &&
                              draggingColumnKey !== field.key
                                ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40'
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            style={{ width: columnWidths[field.key] || 180, minWidth: 120 }}
                          >
                            <div className="group/colmenu relative flex min-h-[28px] items-center gap-2 pr-8">
                              <span className="lv-th-inner min-w-0 flex-1 !cursor-grab">
                                <span className="lv-th-grip">⋮⋮</span>
                                <span className="flex min-w-0 items-center gap-1 truncate">
                                {parseWorkspaceColumnBindingV1(
                                  field.meta as Record<string, unknown> | null,
                                ) && (
                                  <span
                                    className="shrink-0 text-teal-600"
                                    title={t('crm.workspace.table.columnBindingBadgeTitle')}
                                    aria-hidden
                                  >
                                    ◇
                                  </span>
                                )}
                                <span className="truncate">{field.label}</span>
                              </span>
                              </span>
                              <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setColumnMenuState((prev) =>
                                      prev?.key === field.key && prev?.groupTitle === '__dt__'
                                        ? null
                                        : { key: field.key, groupTitle: '__dt__' },
                                    )
                                  }
                                  className="h-5 w-5 rounded-full hover:bg-slate-100 text-slate-400 opacity-0 group-hover/colmenu:opacity-100 transition-opacity"
                                >
                                  ⋯
                                </button>
                              </div>
                            </div>
                            {columnMenuState?.key === field.key && columnMenuState?.groupTitle === '__dt__' && (
                              <div className="absolute right-2 top-8 z-40 min-w-[13rem] w-max max-w-[min(92vw,22rem)] rounded-xl border border-slate-200 bg-white shadow-xl p-1.5 ring-1 ring-slate-100">
                                <button
                                  type="button"
                                  onClick={() => {
                                    openEditColumn(field);
                                    setColumnMenuState(null);
                                  }}
                                  className="w-full text-center text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-2"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0">
                                    <path d="M12 20h9" />
                                    <path d="m16.5 3.5 4 4L7 21H3v-4L16.5 3.5Z" />
                                  </svg>
                                  <span className="min-w-0 whitespace-normal break-words leading-snug">{t('crm.workspace.table.editColumn')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void duplicateColumn(field);
                                    setColumnMenuState(null);
                                  }}
                                  className="w-full text-center text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-2"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0">
                                    <rect x="9" y="9" width="11" height="11" rx="2" />
                                    <rect x="4" y="4" width="11" height="11" rx="2" />
                                  </svg>
                                  <span className="min-w-0 whitespace-normal break-words leading-snug">{t('crm.workspace.table.duplicateColumn')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteDialog({ kind: 'column', field });
                                    setColumnMenuState(null);
                                  }}
                                  className="w-full text-center text-xs px-2 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 flex items-center justify-center gap-2"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0">
                                    <path d="M3 6h18" />
                                    <path d="M8 6V4h8v2" />
                                    <path d="M19 6l-1 14H6L5 6" />
                                    <path d="M10 11v6M14 11v6" />
                                  </svg>
                                  <span className="min-w-0 whitespace-normal break-words leading-snug">{t('crm.workspace.table.deleteColumn')}</span>
                                </button>
                              </div>
                            )}
                            <span
                              className="lv-th-resize"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setResizing({
                                  key: field.key,
                                  startX: e.clientX,
                                  startWidth: columnWidths[field.key] || 180,
                                });
                              }}
                              role="presentation"
                            />
                          </th>
                        ))}
                        <th className="w-12 text-center align-middle" style={{ width: 48 }}>
                          <button
                            type="button"
                            onClick={() => setShowAddField(true)}
                            className="btn-icon h-6 w-6 rounded-full border border-border-default"
                          >
                            +
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedRecords.map((group) => {
                        const collapsed = !!collapsedGroups[group.title];
                        const visibleGroupItems = group.items.filter((record) => !hiddenRows[record.id]);
                        return (
                          <React.Fragment key={group.title}>
                            <tr
                              className="lv-proj-group-row"
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
                              <td colSpan={orderedColumns.length + 2} style={{ borderLeft: `4px solid ${group.color}` }}>
                                <div className="lv-proj-group-inner">
                                  <button
                                    type="button"
                                    className={`lv-group-toggle${collapsed ? ' collapsed' : ''}`}
                                    onClick={() =>
                                      setCollapsedGroups((prev) => ({
                                        ...prev,
                                        [group.title]: !prev[group.title],
                                      }))
                                    }
                                    aria-expanded={!collapsed}
                                  >
                                    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
                                      <path
                                        d="M2.5 4.5L6 8L9.5 4.5"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </button>
                                  <span className="truncate font-medium" style={{ fontSize: 12.5, color: 'var(--ink)' }}>
                                    {group.title}
                                  </span>
                                  <span className="lv-group-meta">
                                    {incompleteDataset
                                      ? t('crm.workspace.table.groupHeaderItemsPage', {
                                          count: group.items.length,
                                          total: recordsTotal,
                                        })
                                      : t('crm.workspace.table.groupHeaderItems', { count: group.items.length })}
                                  </span>
                                  {numberField && (
                                    <span className="lv-group-meta">
                                      {t('crm.workspace.table.sumLabel', { label: numberField.label })}{' '}
                                      {group.items.reduce((sum, item) => {
                                        const raw = item.values?.[numberField.key];
                                        const parsed = typeof raw === 'number' ? raw : Number(raw || 0);
                                        return sum + (Number.isNaN(parsed) ? 0 : parsed);
                                      }, 0)}
                                      {incompleteDataset ? ` ${t('crm.workspace.table.sumOnPageSuffix')}` : ''}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {!collapsed && visibleGroupItems.map((record) => {
                              const subitems = getSubitems(record);
                              const expanded = !!expandedRows[record.id];
                              const recordPriorityValue = String(
                                record.values?.[priorityField?.key || 'priority'] || 'normal',
                              );
                              const mobilePreviewFields = orderedColumns
                                .filter((f) => f.key !== titleField?.key)
                                .sort((a, b) => getMobilePreviewFieldRank(a) - getMobilePreviewFieldRank(b))
                                .slice(0, 3);
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
                                    className={`lv-proj-row group/row relative ${
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
                                      className={`lv-ws-lead-td px-2 py-1.5 ${
                                        rowMenuRecordId === record.id ||
                                        activeMultiCell?.recordId === record.id ||
                                        activePriorityMenu?.recordId === record.id
                                          ? 'lv-ws-lead-td--menu'
                                          : ''
                                      }`}
                                      style={{ borderLeftColor: getRowStatusHex(record) || getPriorityStripHex(recordPriorityValue) }}
                                    >
                                      <div className="flex w-full flex-wrap items-center gap-2">
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
                                        <div className="relative shrink-0">
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
                                                className="w-full text-center text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50"
                                              >
                                                {t('crm.workspace.table.duplicateRow')}
                                              </button>
                                              <button
                                                type="button"
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={() => {
                                                  setPushBoardRecordIds([record.id]);
                                                  setPushBoardOpen(true);
                                                  setRowMenuRecordId(null);
                                                }}
                                                className="w-full text-center text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50"
                                              >
                                                {t('crm.workspace.table.pushToBoardRow')}
                                              </button>
                                              <button
                                                type="button"
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={() => {
                                                  setHiddenRows((prev) => ({ ...prev, [record.id]: true }));
                                                  setRowMenuRecordId(null);
                                                }}
                                                className="w-full text-center text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50"
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
                                                className="w-full text-center text-xs px-2 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                                              >
                                                {t('crm.workspace.table.deleteRow')}
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                        </div>
                                        <div className="mt-1 basis-full space-y-1 md:hidden">
                                          {mobilePreviewFields.map((f) => {
                                            const preview = getMobilePreviewValue(record, f);
                                            if (!preview) return null;
                                            return (
                                              <div
                                                key={`mobile-preview-${record.id}-${f.key}`}
                                                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1"
                                              >
                                                <span className="min-w-0 truncate text-[10px] uppercase tracking-wide text-slate-500">
                                                  {f.label}
                                                </span>
                                                <span className="min-w-0 truncate text-center text-[11px] text-slate-800">
                                                  {preview}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </td>
                                    {orderedColumns.map((f) => renderCell(record, f))}
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
                                      <td colSpan={orderedColumns.length + 1} className="px-3 py-2">
                                        <div className="mt-2 rounded-2xl border border-sky-100 bg-sky-50/30 p-3 pl-5 relative">
                                          <div className="absolute left-2 top-2 bottom-2 w-[3px] rounded-full bg-sky-300/90" />
                                          <div className="overflow-x-auto">
                                          <table className="w-full min-w-[760px] text-xs [&_tbody>tr>td]:text-center [&_tbody>tr>td]:align-middle [&_thead>tr>th]:text-center [&_tbody>tr>td_select]:text-center [&_tbody>tr>td_input]:text-center [&_tbody>tr>td_button]:text-center">
                                            <thead className="bg-sky-50/70">
                                              <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                                                <th className="px-2 py-2">{t('crm.workspace.table.subitemColTask')}</th>
                                                <th className="px-2 py-2">{t('crm.workspace.table.subitemColOwner')}</th>
                                                <th className="px-2 py-2">{t('crm.workspace.table.subitemColStatus')}</th>
                                                <th className="px-2 py-2">{t('crm.workspace.table.subitemColPriority')}</th>
                                                <th className="px-2 py-2">{t('crm.workspace.table.subitemColDue')}</th>
                                                <th className="px-2 py-2">{t('crm.workspace.table.subitemColActions')}</th>
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
                                                        onBlur={(e) => void updateSubitem(record, subitem.id, 'name', e.target.value)}
                                                        placeholder={t('crm.workspace.table.subitemTitlePlaceholder')}
                                                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs text-slate-700"
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
                                                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs"
                                                              >
                                                                <div className="flex items-center justify-center gap-2">
                                                                  <div className="flex items-center justify-center gap-1.5 min-w-0">
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
                                                                          <span className="text-[10px] text-slate-500">+{selectedOwners.length - 3}</span>
                                                                        )}
                                                                      </>
                                                                    ) : (
                                                                      <span className="truncate text-slate-500">{t('crm.workspace.table.selectOwner')}</span>
                                                                    )}
                                                                  </div>
                                                                  <span className="text-[10px] text-slate-500">{selectedOwners.length}</span>
                                                                </div>
                                                              </button>
                                                              {menuOpen && (
                                                                <div className="absolute z-[220] mt-1 w-72 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-100 p-2">
                                                                  {staffByDepartment.map((dept) => {
                                                                    const deptNames = dept.users.map((u) => u.fullName);
                                                                    const deptSelected =
                                                                      deptNames.length > 0 &&
                                                                      deptNames.every((name) => selectedOwners.includes(name));
                                                                    return (
                                                                      <div key={dept.department} className="mb-2 last:mb-0">
                                                                        <button
                                                                          type="button"
                                                                          onClick={() =>
                                                                            void toggleSubitemDepartment(record, subitem.id, dept.users)
                                                                          }
                                                                          className={`w-full text-center rounded-lg px-2 py-1 text-[11px] font-semibold ${
                                                                            deptSelected
                                                                              ? 'bg-slate-100 text-lumiva-accent'
                                                                              : 'text-slate-600 hover:bg-slate-50'
                                                                          }`}
                                                                        >
                                                                          {dept.department}
                                                                        </button>
                                                                        <div className="mt-1 space-y-1">
                                                                          {dept.users.map((user) => {
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
                                                        onChange={(e) => void updateSubitem(record, subitem.id, 'status', e.target.value)}
                                                        className={`w-full rounded-lg px-2 py-1.5 text-center text-xs ${getSubitemStatusColor(subStatus)} font-medium`}
                                                      >
                                                        {subitemStatusOptions.map((opt) => (
                                                          <option key={opt.value} value={opt.value}>{opt.label}</option>
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
                                                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs font-medium text-slate-800"
                                                        >
                                                          <div className="flex items-center justify-center gap-2">
                                                            <span className="truncate">
                                                              {subitemPriorityOptions.find((o) => o.value === subPriority)?.label || subPriority}
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
                                                                    className={`w-full rounded-lg px-2 py-1.5 text-center text-xs ${
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
                                                        onChange={(e) => void updateSubitem(record, subitem.id, 'due_date', e.target.value)}
                                                        className="w-full min-w-[132px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-center text-xs leading-5"
                                                      />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                      <button
                                                        type="button"
                                                        onClick={() => void deleteSubitem(record, subitem.id)}
                                                        className="mx-auto block text-[11px] text-rose-500 hover:text-rose-600"
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
                                                    className="mx-auto block text-xs text-sky-600 hover:text-sky-700"
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
                            {!collapsed && (
                              <tr className="lv-proj-row">
                                <td className="lv-ws-lead-td px-2 py-2 text-[var(--fg-3)] text-xs font-medium">
                                  +
                                </td>
                                <td colSpan={orderedColumns.length + 1} className="px-3 py-2">
                                  {canAddRowInGroup ? (
                                    <button
                                      type="button"
                                      onClick={() => void createRowInGroup(group.title)}
                                      disabled={savingRecordId === `new-${group.title}`}
                                      className="mx-auto block text-sm text-slate-500 hover:text-slate-800"
                                    >
                                      {savingRecordId === `new-${group.title}`
                                        ? t('crm.workspace.table.addingRow')
                                        : t('crm.workspace.table.addItem')}
                                    </button>
                                  ) : (
                                    <span className="mx-auto block text-xs text-slate-400">
                                      {t('crm.workspace.table.addItemOnlyDefault')}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )}
                            {!collapsed && (
                              <tr className="lv-ws-summary-row">
                                <td className="lv-ws-lead-td px-2 py-2 text-xs font-semibold text-[var(--ink)]">
                                  {t('crm.workspace.table.summary')}
                                </td>
                                {orderedColumns.map((f) => {
                                  const keyNorm = f.key.toLowerCase();
                                  const labelNorm = f.label.toLowerCase();
                                  const isLikelyNumeric =
                                    f.type === 'number' ||
                                    keyNorm.includes('price') ||
                                    keyNorm.includes('value') ||
                                    keyNorm.includes('amount') ||
                                    keyNorm.includes('sum') ||
                                    keyNorm.includes('total') ||
                                    keyNorm.includes('revenue') ||
                                    keyNorm.includes('subtotal') ||
                                    keyNorm.includes('qty') ||
                                    keyNorm.includes('quantity') ||
                                    keyNorm.includes('count') ||
                                    labelNorm.includes('цена') ||
                                    labelNorm.includes('стоим') ||
                                    labelNorm.includes('сумм') ||
                                    labelNorm.includes('итог') ||
                                    labelNorm.includes('всег') ||
                                    labelNorm.includes('колич') ||
                                    labelNorm.includes('value') ||
                                    labelNorm.includes('amount') ||
                                    labelNorm.includes('total') ||
                                    labelNorm.includes('revenue');
                                  if (isLikelyNumeric) {
                                    const sum = group.items.reduce((acc, item) => {
                                      const raw = item.values?.[getWorkspaceFieldValueStorageKey(f)];
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
                                      <td key={f.id} className="px-3 py-2 text-left text-xs font-semibold text-[var(--ink)]">
                                        {sum}
                                      </td>
                                    );
                                  }
                                  return (
                                    <td key={f.id} className="px-3 py-2 text-left text-xs text-[var(--fg-3)]">
                                      -
                                    </td>
                                  );
                                })}
                                <td />
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
              {!isDataTable && groupedRecords.map((group) => {
                const collapsed = !!collapsedGroups[group.title];
                const visibleGroupItems = group.items.filter((record) => !hiddenRows[record.id]);
                const groupColumns = orderedColumns.filter(
                  (field) => !groupHiddenColumns[group.title]?.[field.key],
                );
                return (
                  <div
                    key={group.title}
                    className={`group/header lv-proj-wrap${dragOverGroup === group.title ? ' lv-proj-wrap--drop' : ''}`}
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
                      className={`lv-ws-group-banner${mondayBoardUi ? ' lv-ws-group-banner--board' : ''}`}
                      style={{ borderLeft: `4px solid ${group.color}` }}
                    >
                      <div className="lv-proj-group-inner min-w-0 flex-1">
                        <button
                          type="button"
                          className={`lv-group-toggle${collapsed ? ' collapsed' : ''}`}
                          onClick={() =>
                            setCollapsedGroups((prev) => ({
                              ...prev,
                              [group.title]: !prev[group.title],
                            }))
                          }
                          aria-expanded={!collapsed}
                        >
                          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
                            <path
                              d="M2.5 4.5L6 8L9.5 4.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                        <span className="truncate font-medium" style={{ fontSize: 12.5, color: 'var(--ink)' }}>
                          {group.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0" style={{ color: 'var(--fg-3)', fontSize: 11 }}>
                        <span>
                          {incompleteDataset
                            ? t('crm.workspace.table.groupHeaderItemsPage', {
                                count: group.items.length,
                                total: recordsTotal,
                              })
                            : t('crm.workspace.table.groupHeaderItems', { count: group.items.length })}
                        </span>
                        {numberField && (
                          <span>
                            {t('crm.workspace.table.sumLabel', { label: numberField.label })}{' '}
                            {group.items.reduce((sum, item) => {
                              const raw = item.values?.[numberField.key];
                              const parsed = typeof raw === 'number' ? raw : Number(raw || 0);
                              return sum + (Number.isNaN(parsed) ? 0 : parsed);
                            }, 0)}
                            {incompleteDataset
                              ? ` ${t('crm.workspace.table.sumOnPageSuffix')}`
                              : ''}
                          </span>
                        )}
                        {isPrimaryGrouping && !isStatusGrouping && (
                          <button
                            type="button"
                            onClick={() => void deleteGroup(group.title)}
                            disabled={incompleteDataset}
                            className="h-6 w-6 rounded-full text-rose-500 hover:bg-rose-50 opacity-0 group-hover/header:opacity-100 transition-opacity disabled:opacity-30 disabled:pointer-events-none border-0 bg-transparent cursor-pointer"
                            title={
                              incompleteDataset
                                ? t('crm.workspace.table.deleteGroupDisabledPaged')
                                : t('crm.workspace.table.deleteGroupTitle')
                            }
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
                      <div
                        ref={(el) => {
                          if (el) groupTableScrollRefs.current.set(group.title, el);
                          else groupTableScrollRefs.current.delete(group.title);
                        }}
                        className="lv-proj-scroll max-h-[560px]"
                      >
                        <table className="lv-proj-table min-w-[1000px] w-full text-[12.5px]">
                          <thead>
                            <tr>
                              <th className="lv-ws-lead-th" />
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
                                    setColumnDragOverKey(null);
                                    const ghost = createColumnDragGhostElement(field.label);
                                    document.body.appendChild(ghost);
                                    e.dataTransfer.setDragImage(ghost, 26, 36);
                                    requestAnimationFrame(() => ghost.remove());
                                  }}
                                  onDragEnd={() => {
                                    setDraggingColumnKey(null);
                                    setDragReadyColumnKey(null);
                                    setColumnDragOverKey(null);
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    if (draggingColumnKey && draggingColumnKey !== field.key) {
                                      setColumnDragOverKey(field.key);
                                    }
                                  }}
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
                                    setColumnDragOverKey(null);
                                  }}
                                  className={[
                                    field.key === titleField?.key ? 'lv-ws-title-th' : '',
                                    holdingColumnKey === field.key ? 'bg-slate-50 ring-1 ring-slate-300' : '',
                                    dragReadyColumnKey === field.key ? 'bg-slate-100 ring-2 ring-slate-400' : '',
                                    draggingColumnKey &&
                                    columnDragOverKey === field.key &&
                                    draggingColumnKey !== field.key
                                      ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/40'
                                      : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                  style={{ width: columnWidths[field.key] || 180, minWidth: 120 }}
                                >
                                  <div className="group/colmenu relative flex min-h-[28px] items-center gap-2 pr-8">
                                    <span className="lv-th-inner min-w-0 flex-1 !cursor-grab">
                                      <span className="lv-th-grip">⋮⋮</span>
                                      <span className="flex min-w-0 items-center gap-1 truncate">
                                      {parseWorkspaceColumnBindingV1(
                                        field.meta as Record<string, unknown> | null,
                                      ) && (
                                        <span
                                          className="shrink-0 text-teal-600"
                                          title={t('crm.workspace.table.columnBindingBadgeTitle')}
                                          aria-hidden
                                        >
                                          ◇
                                        </span>
                                      )}
                                      <span className="truncate">{field.label}</span>
                                    </span>
                                    </span>
                                    <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-1">
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
                                    </div>
                                  </div>
                                  {columnMenuState?.key === field.key &&
                                    columnMenuState?.groupTitle === group.title && (
                                    <div className="absolute right-2 top-8 z-40 min-w-[13rem] w-max max-w-[min(92vw,22rem)] rounded-xl border border-slate-200 bg-white shadow-xl p-1.5 ring-1 ring-slate-100">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          openEditColumn(field);
                                          setColumnMenuState(null);
                                        }}
                                        className="w-full text-center text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-2"
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="1.8"
                                          className="h-4 w-4 shrink-0"
                                        >
                                          <path d="M12 20h9" />
                                          <path d="m16.5 3.5 4 4L7 21H3v-4L16.5 3.5Z" />
                                        </svg>
                                        <span className="min-w-0 whitespace-normal break-words leading-snug">
                                          {t('crm.workspace.table.editColumn')}
                                        </span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void duplicateColumn(field);
                                          setColumnMenuState(null);
                                        }}
                                        className="w-full text-center text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-2"
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="1.8"
                                          className="h-4 w-4 shrink-0"
                                        >
                                          <rect x="9" y="9" width="11" height="11" rx="2" />
                                          <rect x="4" y="4" width="11" height="11" rx="2" />
                                        </svg>
                                        <span className="min-w-0 whitespace-normal break-words leading-snug">
                                          {t('crm.workspace.table.duplicateColumn')}
                                        </span>
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
                                        className="w-full text-center text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-2"
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="1.8"
                                          className="h-4 w-4 shrink-0"
                                        >
                                          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                                          <circle cx="12" cy="12" r="3" />
                                        </svg>
                                        <span className="min-w-0 whitespace-normal break-words leading-snug">
                                          {t('crm.workspace.table.hideColumn')}
                                        </span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDeleteDialog({ kind: 'column', field });
                                          setColumnMenuState(null);
                                        }}
                                        className="w-full text-center text-xs px-2 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 flex items-center justify-center gap-2"
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="1.8"
                                          className="h-4 w-4 shrink-0"
                                        >
                                          <path d="M3 6h18" />
                                          <path d="M8 6V4h8v2" />
                                          <path d="M19 6l-1 14H6L5 6" />
                                          <path d="M10 11v6M14 11v6" />
                                        </svg>
                                        <span className="min-w-0 whitespace-normal break-words leading-snug">
                                          {t('crm.workspace.table.deleteColumn')}
                                        </span>
                                      </button>
                                    </div>
                                  )}
                                  <span
                                    className="lv-th-resize"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setResizing({
                                        key: field.key,
                                        startX: e.clientX,
                                        startWidth: columnWidths[field.key] || 180,
                                      });
                                    }}
                                    role="presentation"
                                  />
                                </th>
                              ))}
                              <th className="w-12 text-center align-middle" style={{ width: 48 }}>
                                <button
                                  type="button"
                                  onClick={() => setShowAddField(true)}
                                  className="btn-icon h-6 w-6 rounded-full border border-border-default"
                                >
                                  +
                                </button>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleGroupItems.map((record) => {
                              const subitems = getSubitems(record);
                              const expanded = !!expandedRows[record.id];
                              const recordPriorityValue = String(
                                record.values?.[priorityField?.key || 'priority'] || 'normal',
                              );
                              const mobilePreviewFields = groupColumns
                                .filter((field) => field.key !== titleField?.key)
                                .sort((a, b) => getMobilePreviewFieldRank(a) - getMobilePreviewFieldRank(b))
                                .slice(0, 3);
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
                                    className={`lv-proj-row group/row relative ${
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
                                      className={`lv-ws-lead-td px-2 py-1.5 ${
                                        rowMenuRecordId === record.id ||
                                        activeMultiCell?.recordId === record.id ||
                                        activePriorityMenu?.recordId === record.id
                                          ? 'lv-ws-lead-td--menu'
                                          : ''
                                      }`}
                                      style={{ borderLeftColor: getRowStatusHex(record) || getPriorityStripHex(recordPriorityValue) }}
                                    >
                                      <div className="flex w-full flex-wrap items-center gap-2">
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
                                        {!mondayBoardUi && (
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
                                        )}
                                        {isBoardTable &&
                                          (() => {
                                            const dl = getWorkspaceDataLink(record.meta);
                                            return dl ? (
                                              <button
                                                type="button"
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={() => navigate(`/workspace/${dl.sourceObjectId}`)}
                                                className="shrink-0 text-[10px] rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-900 hover:bg-amber-100"
                                                title={t('crm.workspace.table.dataSourceLinkTitle')}
                                              >
                                                {t('crm.workspace.table.dataSourceLink')}
                                              </button>
                                            ) : null;
                                          })()}
                                        <div className="relative shrink-0">
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
                                                className="w-full text-center text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50"
                                              >
                                                {t('crm.workspace.table.duplicateRow')}
                                              </button>
                                              {isDataTable && (
                                                <button
                                                  type="button"
                                                  onMouseDown={(e) => e.stopPropagation()}
                                                  onClick={() => {
                                                    setPushBoardRecordIds([record.id]);
                                                    setPushBoardOpen(true);
                                                    setRowMenuRecordId(null);
                                                  }}
                                                  className="w-full text-center text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50"
                                                >
                                                  {t('crm.workspace.table.pushToBoardRow')}
                                                </button>
                                              )}
                                              <button
                                                type="button"
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={() => {
                                                  setHiddenRows((prev) => ({ ...prev, [record.id]: true }));
                                                  setRowMenuRecordId(null);
                                                }}
                                                className="w-full text-center text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50"
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
                                                className="w-full text-center text-xs px-2 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
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
                                                <span className="min-w-0 truncate text-center text-[11px] text-slate-800">
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
                                          <table className="w-full min-w-[760px] text-xs [&_tbody>tr>td]:text-center [&_tbody>tr>td]:align-middle [&_thead>tr>th]:text-center [&_tbody>tr>td_select]:text-center [&_tbody>tr>td_input]:text-center [&_tbody>tr>td_button]:text-center">
                                            <thead className="bg-sky-50/70">
                                              <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                                                <th className="px-2 py-2">
                                                  {t('crm.workspace.table.subitemColTask')}
                                                </th>
                                                <th className="px-2 py-2">
                                                  {t('crm.workspace.table.subitemColOwner')}
                                                </th>
                                                <th className="px-2 py-2">
                                                  {t('crm.workspace.table.subitemColStatus')}
                                                </th>
                                                <th className="px-2 py-2">
                                                  {t('crm.workspace.table.subitemColPriority')}
                                                </th>
                                                <th className="px-2 py-2">
                                                  {t('crm.workspace.table.subitemColDue')}
                                                </th>
                                                <th className="px-2 py-2">
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
                                                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs text-slate-700"
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
                                                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs"
                                                              >
                                                                <div className="flex items-center justify-center gap-2">
                                                                  <div className="flex items-center justify-center gap-1.5 min-w-0">
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
                                                                          className={`w-full text-center rounded-lg px-2 py-1 text-[11px] font-semibold ${
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
                                                        className={`w-full rounded-lg px-2 py-1.5 text-center text-xs ${getSubitemStatusColor(subStatus)} font-medium`}
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
                                                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs font-medium text-slate-800"
                                                        >
                                                          <div className="flex items-center justify-center gap-2">
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
                                                                    className={`w-full rounded-lg px-2 py-1.5 text-center text-xs ${
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
                                                        className="w-full min-w-[132px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-center text-xs leading-5"
                                                      />
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                      <button
                                                        type="button"
                                                        onClick={() => void deleteSubitem(record, subitem.id)}
                                                        className="mx-auto block text-[11px] text-rose-500 hover:text-rose-600"
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
                                                    className="mx-auto block text-xs text-sky-600 hover:text-sky-700"
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
                            <tr className="lv-proj-row">
                              <td className="lv-ws-lead-td px-2 py-2 text-[var(--fg-3)] text-xs font-medium">
                                +
                              </td>
                              <td colSpan={groupColumns.length + 1} className="px-3 py-2">
                                {canAddRowInGroup ? (
                                  <button
                                    type="button"
                                    onClick={() => void createRowInGroup(group.title)}
                                    disabled={savingRecordId === `new-${group.title}`}
                                    className="mx-auto block text-sm text-slate-500 hover:text-slate-800"
                                  >
                                    {savingRecordId === `new-${group.title}`
                                      ? t('crm.workspace.table.addingRow')
                                      : t('crm.workspace.table.addItem')}
                                  </button>
                                ) : (
                                  <span className="mx-auto block text-xs text-slate-400">
                                    {t('crm.workspace.table.addItemOnlyDefault')}
                                  </span>
                                )}
                              </td>
                            </tr>
                            <tr className="lv-ws-summary-row">
                              <td className="lv-ws-lead-td px-2 py-2 text-xs font-semibold text-[var(--ink)]">
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
                                  keyNorm.includes('total') ||
                                  keyNorm.includes('revenue') ||
                                  keyNorm.includes('subtotal') ||
                                  keyNorm.includes('qty') ||
                                  keyNorm.includes('quantity') ||
                                  keyNorm.includes('count') ||
                                  labelNorm.includes('цена') ||
                                  labelNorm.includes('стоим') ||
                                  labelNorm.includes('сумм') ||
                                  labelNorm.includes('итог') ||
                                  labelNorm.includes('всег') ||
                                  labelNorm.includes('колич') ||
                                  labelNorm.includes('value') ||
                                  labelNorm.includes('amount') ||
                                  labelNorm.includes('total') ||
                                  labelNorm.includes('revenue');
                                if (isLikelyNumeric) {
                                  const sum = group.items.reduce((acc, item) => {
                                    const raw = item.values?.[getWorkspaceFieldValueStorageKey(field)];
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
                                    <td key={field.id} className="px-3 py-2 text-left text-xs font-semibold text-[var(--ink)]">
                                      {sum}
                                    </td>
                                  );
                                }
                                return (
                                  <td key={field.id} className="px-3 py-2 text-left text-xs text-[var(--fg-3)]">
                                    -
                                  </td>
                                );
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

              {isBoardTable && !loading && groupedRecords.length === 0 && !search && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8 text-center">
                  <p className="text-base font-semibold text-slate-800">{t('crm.workspace.table.boardEmptyTitle')}</p>
                  <p className="mt-1 text-sm text-slate-500">{t('crm.workspace.table.boardEmptySubtitle')}</p>
                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    {([
                      {
                        num: '1',
                        title: t('crm.workspace.table.boardEmptyStep1Title'),
                        desc: t('crm.workspace.table.boardEmptyStep1Desc'),
                        icon: (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5" aria-hidden>
                            <rect x="3" y="3" width="18" height="4" rx="1" />
                            <rect x="3" y="10" width="18" height="4" rx="1" />
                            <rect x="3" y="17" width="18" height="4" rx="1" />
                          </svg>
                        ),
                      },
                      {
                        num: '2',
                        title: t('crm.workspace.table.boardEmptyStep2Title'),
                        desc: t('crm.workspace.table.boardEmptyStep2Desc'),
                        icon: (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5" aria-hidden>
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        ),
                      },
                      {
                        num: '3',
                        title: t('crm.workspace.table.boardEmptyStep3Title'),
                        desc: t('crm.workspace.table.boardEmptyStep3Desc'),
                        icon: (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5" aria-hidden>
                            <path d="M4 20h16M4 4h16" />
                            <path d="M9 4v16M15 4v16" />
                          </svg>
                        ),
                      },
                    ] as const).map((step) => (
                      <div key={step.num} className="rounded-xl border border-slate-100 bg-white p-4 text-left shadow-sm">
                        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                          {step.icon}
                        </div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                          {step.num}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-800">{step.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{step.desc}</p>
                      </div>
                    ))}
                  </div>
                  {isPrimaryGrouping && (
                    <button
                      type="button"
                      onClick={() => newGroupInputRef.current?.focus()}
                      className="btn-primary"
                      style={{ background: 'var(--ink)' }}
                    >
                      {t('crm.workspace.table.boardEmptyStartBtn')}
                    </button>
                  )}
                </div>
              )}

              {showTablePagination && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <div>
                    {t('crm.workspace.table.paginationRange', {
                      from: pageRowFrom,
                      to: pageRowTo,
                      total: recordsTotal,
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1">
                      <span>{t('crm.workspace.table.pageSize')}</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setTablePage(0);
                        }}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={200}>200</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={tablePage === 0}
                      onClick={() => setTablePage((p) => Math.max(0, p - 1))}
                      className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100 disabled:opacity-40"
                    >
                      {t('crm.workspace.table.prevPage')}
                    </button>
                    <span className="tabular-nums">
                      {tablePage + 1} / {Math.max(1, Math.ceil(recordsTotal / pageSize))}
                    </span>
                    <button
                      type="button"
                      disabled={(tablePage + 1) * pageSize >= recordsTotal}
                      onClick={() => setTablePage((p) => p + 1)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100 disabled:opacity-40"
                    >
                      {t('crm.workspace.table.nextPage')}
                    </button>
                  </div>
                </div>
              )}

              {filterFieldKey && filterFieldValue && incompleteDataset && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  {t('crm.workspace.table.filterOnlyCurrentPage')}
                </p>
              )}

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
          showAddFieldButton
          onAddField={() => setShowAddField(true)}
          recordsForStatusOptions={records}
          objectId={objectId}
          shelfLayout={isDataTable}
          crmLeadOptions={crmLeadList}
          crmProjectOptions={crmProjectList}
          crmCompanyOptions={crmCompanyList}
        />

        {deleteDialog && (
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
              onClick={() => {
                if (!deleting) setDeleteDialog(null);
              }}
            />
            <div className="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 modal-panel p-6">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-status-error-bg text-status-error">
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
                  <h3 className="text-lg font-semibold text-[#111827]">{t('crm.workspace.table.deleteConfirm')}</h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    {deleteDialog.kind === 'column'
                      ? t('crm.workspace.table.deleteColumnConfirm', { label: deleteDialog.field.label })
                      : t('crm.workspace.table.deleteGroupConfirm', {
                          title: deleteDialog.groupTitle,
                          count: deleteDialog.itemCount,
                        })}
                  </p>
                  <p className="mt-2 text-xs text-text-tertiary">{t('crm.workspace.table.deleteIrreversible')}</p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteDialog(null)}
                  disabled={deleting}
                  className="btn-secondary disabled:opacity-60"
                >
                  {t('crm.workspace.table.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDelete()}
                  disabled={deleting}
                  className="btn-danger disabled:opacity-60"
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
                  onChange={(e) => setEditFieldType(e.target.value as CustomObjectFieldType | 'fixed')}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <optgroup label={t('crm.workspace.table.fieldTypeGroupBasic')}>
                    {FIELD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={t('crm.workspace.table.fieldTypeGroupOther')}>
                    <option value="fixed">{t('crm.workspace.table.fieldTypeReadonly')}</option>
                  </optgroup>
                </select>
                {editFieldType === 'text' && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      {t('crm.workspace.table.crmLinkLabel')}
                    </label>
                    <select
                      value={editCrmEntityRef}
                      onChange={(e) =>
                        setEditCrmEntityRef(
                          e.target.value as 'none' | 'lead' | 'project' | 'company',
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                    >
                      <option value="none">{t('crm.workspace.table.crmLinkNone')}</option>
                      <option value="lead">{t('crm.workspace.table.fieldTypeCrmLead')}</option>
                      <option value="project">{t('crm.workspace.table.fieldTypeCrmProject')}</option>
                      <option value="company">{t('crm.workspace.table.fieldTypeCrmCompany')}</option>
                    </select>
                  </div>
                )}
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
                {(isDataTable || isBoardTable) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                    <div className="text-xs font-semibold text-slate-700">
                      {t('crm.workspace.table.columnImportKeySection')}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {t('crm.workspace.table.columnImportKeyHint')}
                    </p>
                    <select
                      value={editMapsToImportedKey}
                      onChange={(e) => setEditMapsToImportedKey(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                    >
                      <option value="">{t('crm.workspace.table.columnImportKeySameAsColumn')}</option>
                      {importKeyOptions.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {isBoardTable && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                    <div className="text-xs font-semibold text-slate-700">
                      {t('crm.workspace.table.columnBindingSection')}
                    </div>
                    <select
                      value={editBindMode}
                      onChange={(e) =>
                        setEditBindMode(
                          e.target.value as
                            | 'off'
                            | 'from_pushed_source'
                            | 'lookup_by_key'
                            | 'pick_from_data'
                            | 'rollup',
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                    >
                      <option value="off">{t('crm.workspace.table.columnBindingOff')}</option>
                      <option value="from_pushed_source">
                        {t('crm.workspace.table.columnBindingPushed')}
                      </option>
                      <option value="lookup_by_key">{t('crm.workspace.table.columnBindingLookup')}</option>
                      <option value="pick_from_data">{t('crm.workspace.table.columnBindingPickFromData')}</option>
                      <option value="rollup">{t('crm.workspace.table.columnBindingRollup')}</option>
                    </select>
                    {editBindMode === 'from_pushed_source' && (
                      <>
                        {pushedSourceFieldKeys.length > 0 ? (
                          <select
                            value={editBindSourceField}
                            onChange={(e) => setEditBindSourceField(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                          >
                            <option value="">{t('crm.workspace.table.columnBindingPickSourceField')}</option>
                            {pushedSourceFieldKeys.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={editBindSourceField}
                            onChange={(e) => setEditBindSourceField(e.target.value)}
                            placeholder={t('crm.workspace.table.columnBindingSourceField')}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                          />
                        )}
                        <p className="text-[11px] text-slate-500 leading-snug">
                          {t('crm.workspace.table.columnBindingHintPushed')}
                        </p>
                      </>
                    )}
                    {editBindMode === 'pick_from_data' && (
                      <>
                        <select
                          value={editBindDataObjectId}
                          onChange={(e) => setEditBindDataObjectId(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                        >
                          <option value="">{t('crm.workspace.table.columnBindingDataTable')}</option>
                          {dataTablesInArea.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                        <label className="block text-[11px] font-medium text-slate-600">
                          {t('crm.workspace.table.columnBindingPickFromDataField')}
                        </label>
                        <select
                          value={editBindPickDataField}
                          onChange={(e) => setEditBindPickDataField(e.target.value)}
                          disabled={!editBindDataObjectId || dataBindingFieldKeys.length === 0}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white disabled:bg-slate-50"
                        >
                          <option value="">{t('crm.workspace.table.columnBindingPickDataKey')}</option>
                          {dataBindingFieldKeys.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-slate-500 leading-snug">
                          {t('crm.workspace.table.columnBindingHintPickFromData')}
                        </p>
                      </>
                    )}
                    {editBindMode === 'lookup_by_key' && (
                      <>
                        <select
                          value={editBindDataObjectId}
                          onChange={(e) => setEditBindDataObjectId(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                        >
                          <option value="">{t('crm.workspace.table.columnBindingDataTable')}</option>
                          {dataTablesInArea.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                        <label className="block text-[11px] font-medium text-slate-600">
                          {t('crm.workspace.table.columnBindingBoardKey')}
                        </label>
                        <select
                          value={editBindBoardMatch}
                          onChange={(e) => setEditBindBoardMatch(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                        >
                          <option value="">{t('crm.workspace.table.columnBindingPickBoardKey')}</option>
                          {boardFieldKeyOptions.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                        <label className="block text-[11px] font-medium text-slate-600">
                          {t('crm.workspace.table.columnBindingDataMatch')}
                        </label>
                        <select
                          value={editBindDataMatch}
                          onChange={(e) => setEditBindDataMatch(e.target.value)}
                          disabled={!editBindDataObjectId || dataBindingFieldKeys.length === 0}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white disabled:bg-slate-50"
                        >
                          <option value="">{t('crm.workspace.table.columnBindingPickDataKey')}</option>
                          {dataBindingFieldKeys.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                        <label className="block text-[11px] font-medium text-slate-600">
                          {t('crm.workspace.table.columnBindingDataDisplay')}
                        </label>
                        <select
                          value={editBindDataDisplay}
                          onChange={(e) => setEditBindDataDisplay(e.target.value)}
                          disabled={!editBindDataObjectId || dataBindingFieldKeys.length === 0}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white disabled:bg-slate-50"
                        >
                          <option value="">{t('crm.workspace.table.columnBindingPickDataKey')}</option>
                          {dataBindingFieldKeys.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-slate-500 leading-snug">
                          {t('crm.workspace.table.columnBindingHintLookup')}
                        </p>
                      </>
                    )}
                    {editBindMode === 'rollup' && (
                      <>
                        <select
                          value={editBindDataObjectId}
                          onChange={(e) => setEditBindDataObjectId(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                        >
                          <option value="">{t('crm.workspace.table.columnBindingDataTable')}</option>
                          {dataTablesInArea.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                        <label className="block text-[11px] font-medium text-slate-600">
                          {t('crm.workspace.table.columnBindingBoardKey')}
                        </label>
                        <select
                          value={editBindBoardMatch}
                          onChange={(e) => setEditBindBoardMatch(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                        >
                          <option value="">{t('crm.workspace.table.columnBindingPickBoardKey')}</option>
                          {boardFieldKeyOptions.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                        <label className="block text-[11px] font-medium text-slate-600">
                          {t('crm.workspace.table.columnBindingGroupBy')}
                        </label>
                        <select
                          value={editBindGroupBy}
                          onChange={(e) => setEditBindGroupBy(e.target.value)}
                          disabled={!editBindDataObjectId || dataBindingFieldKeys.length === 0}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white disabled:bg-slate-50"
                        >
                          <option value="">{t('crm.workspace.table.columnBindingPickDataKey')}</option>
                          {dataBindingFieldKeys.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                        <label className="block text-[11px] font-medium text-slate-600">
                          {t('crm.workspace.table.columnBindingValueField')}
                        </label>
                        <select
                          value={editBindValueField}
                          onChange={(e) => setEditBindValueField(e.target.value)}
                          disabled={!editBindDataObjectId || dataBindingFieldKeys.length === 0}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white disabled:bg-slate-50"
                        >
                          <option value="">{t('crm.workspace.table.columnBindingPickDataKey')}</option>
                          {dataBindingFieldKeys.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editBindAggregate}
                          onChange={(e) =>
                            setEditBindAggregate(
                              e.target.value as 'sum' | 'count' | 'avg' | 'min' | 'max',
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                        >
                          <option value="sum">{t('crm.workspace.table.columnBindingAggSum')}</option>
                          <option value="count">{t('crm.workspace.table.columnBindingAggCount')}</option>
                          <option value="avg">{t('crm.workspace.table.columnBindingAggAvg')}</option>
                          <option value="min">{t('crm.workspace.table.columnBindingAggMin')}</option>
                          <option value="max">{t('crm.workspace.table.columnBindingAggMax')}</option>
                        </select>
                        <p className="text-[11px] text-slate-500 leading-snug">
                          {t('crm.workspace.table.columnBindingHintRollup')}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditField(false)}
                  className="btn-secondary"
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
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => {
                setShowAddField(false);
                setNewFieldMapsToImportKey('');
              }}
            />
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
                  onChange={(e) => setNewFieldType(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <optgroup label={t('crm.workspace.table.fieldTypeGroupBasic')}>
                    {FIELD_TYPES.map((ft) => (
                      <option key={ft} value={ft}>
                        {ft}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={t('crm.workspace.table.fieldTypeGroupCrm')}>
                    <option value="crm_lead">{t('crm.workspace.table.fieldTypeCrmLead')}</option>
                    <option value="crm_project">{t('crm.workspace.table.fieldTypeCrmProject')}</option>
                    <option value="crm_company">{t('crm.workspace.table.fieldTypeCrmCompany')}</option>
                  </optgroup>
                  <optgroup label={t('crm.workspace.table.fieldTypeGroupOther')}>
                    <option value="readonly">{t('crm.workspace.table.fieldTypeReadonly')}</option>
                  </optgroup>
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
                {(isDataTable || isBoardTable) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                    <div className="text-xs font-semibold text-slate-700">
                      {t('crm.workspace.table.columnImportKeySection')}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {t('crm.workspace.table.columnImportKeyHint')}
                    </p>
                    <select
                      value={newFieldMapsToImportKey}
                      onChange={(e) => setNewFieldMapsToImportKey(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                    >
                      <option value="">{t('crm.workspace.table.columnImportKeySameAsColumn')}</option>
                      {importKeyOptions.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
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
                  onClick={() => {
                    setShowAddField(false);
                    setNewFieldMapsToImportKey('');
                  }}
                  className="btn-secondary"
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
      <PushToBoardModal
        open={pushBoardOpen}
        onClose={() => {
          setPushBoardOpen(false);
          setPushBoardRecordIds([]);
        }}
        sourceObjectId={objectId}
        workspaceAreaId={workspaceAreaId}
        areaObjects={areaObjects}
        recordIds={pushBoardRecordIds}
        sourceFields={fields}
        onSuccess={() => void loadRecords(false)}
      />
    </MainLayout>
  );
};

