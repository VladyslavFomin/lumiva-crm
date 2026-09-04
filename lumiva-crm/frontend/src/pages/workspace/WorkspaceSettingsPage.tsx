import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import './WorkspaceArea.css';
import { WsAreaBar } from '../../components/workspace/WsAreaBar';
import {
  clearCustomObjectRecords,
  createCustomObjectField,
  deleteCustomObject,
  deleteCustomObjectField,
  fetchCustomObjectAnalytics,
  fetchCustomObjectFields,
  fetchCustomObjects,
  updateCustomObject,
  updateCustomObjectField,
  type CustomObject,
  type CustomObjectField,
  type CustomObjectFieldType,
} from '../../api/customObjects';
import {
  fetchWorkspaceArea,
  fetchWorkspaceAreaMembers,
  fetchWorkspaceAreas,
  type WorkspaceArea,
} from '../../api/workspaceAreas';
import type { WorkspaceAreaMember, WorkspaceAreaRole } from '../../workspace/workspaceAreaRole';
import {
  getWorkspaceTableKind,
} from '../../workspace/workspaceTableKind';
import { WORKSPACE_LINKED_DATA_OBJECT_IDS_KEY } from '../../workspace/workspaceRecordLink';
import { WORKSPACE_ENTITY_REF_KEY } from '../../workspace/workspaceEntityRef';
import {
  parseWorkspaceColumnBindingV1,
  WORKSPACE_COLUMN_BINDING_META_KEY,
  type WorkspaceColumnBindingV1,
} from '../../workspace/workspaceColumnBinding';
import { parseEnabledViews, type ExtraWorkspaceViewKey } from '../../workspace/workspaceEnabledViews';
import {
  WORKSPACE_STATUS_COLOR_PRESETS,
  WORKSPACE_STATUS_DEFAULT_COLOR,
} from '../../components/workspace/workspaceStatusColorPresets';
import { pickStatusLikeField } from '../../components/workspace/workspaceStatusField';
import { WorkspaceViewTabs } from '../../components/workspace/WorkspaceViewTabs';
import { NAV_ICON_MAP, type NavIconKey } from '../../components/layout/NavSidebarIcons';

const WORKSPACE_NAV_ICON_KEYS = Object.keys(NAV_ICON_MAP) as NavIconKey[];
const ROLES: WorkspaceAreaRole[] = ['owner', 'editor', 'reader', 'own_rows_only'];
type AccessOverride = WorkspaceAreaRole | 'none' | '';
const BIND_MODES: WorkspaceColumnBindingV1['mode'][] = [
  'from_pushed_source',
  'lookup_by_key',
  'pick_from_data',
  'cached_snapshot',
  'rollup',
];

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

const VIEW_TOGGLES: ExtraWorkspaceViewKey[] = ['kanban', 'calendar', 'gantt', 'analytics'];

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

type StatusOption = { value: string; label: string; color: string };
type Section = 'fields' | 'bindings' | 'statuses' | 'views' | 'access' | 'danger';

export const WorkspaceSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { objectId = '' } = useParams();
  const [section, setSection] = useState<Section>('fields');
  const [objectName, setObjectName] = useState('');
  const [fields, setFields] = useState<CustomObjectField[]>([]);
  const [objectMeta, setObjectMeta] = useState<Record<string, any> | null>(null);
  const [analytics, setAnalytics] = useState<{
    totalRecords: number;
    byStatus: Record<string, number>;
  } | null>(null);
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<string>('text');
  const [saving, setSaving] = useState(false);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [draftStatuses, setDraftStatuses] = useState<StatusOption[]>([]);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [savingStatuses, setSavingStatuses] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [cardTitleField, setCardTitleField] = useState('');
  const [clientField, setClientField] = useState('');
  const [cardExtraFields, setCardExtraFields] = useState<string[]>([]);
  const [savingCardSettings, setSavingCardSettings] = useState(false);
  const [cardSettingsError, setCardSettingsError] = useState<string | null>(null);
  const [navIconKey, setNavIconKey] = useState<NavIconKey | ''>('');
  const [viewsEnabled, setViewsEnabled] = useState<Record<ExtraWorkspaceViewKey, boolean>>({
    kanban: false,
    calendar: false,
    gantt: false,
    analytics: false,
  });
  const [areaWorkspaceObjects, setAreaWorkspaceObjects] = useState<CustomObject[]>([]);
  const [linkedDataObjectIds, setLinkedDataObjectIds] = useState<string[]>([]);
  const [savingDataSources, setSavingDataSources] = useState(false);
  const [area, setArea] = useState<WorkspaceArea | null>(null);
  const [allAreas, setAllAreas] = useState<WorkspaceArea[]>([]);
  const [moveToAreaId, setMoveToAreaId] = useState('');
  const [movingArea, setMovingArea] = useState(false);

  const [bindEditingKey, setBindEditingKey] = useState('');
  const [bindMode, setBindMode] = useState<WorkspaceColumnBindingV1['mode']>('from_pushed_source');
  const [bindSourceField, setBindSourceField] = useState('');
  const [bindDataObjectId, setBindDataObjectId] = useState('');
  const [bindBoardMatch, setBindBoardMatch] = useState('');
  const [bindDataMatch, setBindDataMatch] = useState('');
  const [bindDataDisplay, setBindDataDisplay] = useState('');
  const [bindDataField, setBindDataField] = useState('');
  const [bindGroupBy, setBindGroupBy] = useState('');
  const [bindValueField, setBindValueField] = useState('');
  const [bindAggregate, setBindAggregate] = useState<'sum' | 'count' | 'avg' | 'min' | 'max'>('sum');
  const [savingBinding, setSavingBinding] = useState(false);

  const [members, setMembers] = useState<WorkspaceAreaMember[]>([]);
  const [accessDraft, setAccessDraft] = useState<Record<string, AccessOverride>>({});
  const [savingAccess, setSavingAccess] = useState(false);

  const [clearBusy, setClearBusy] = useState(false);
  const [clearConfirmInput, setClearConfirmInput] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  const load = async () => {
    const [fieldItems, stats, objects, workspaceAreaList] = await Promise.all([
      fetchCustomObjectFields(objectId),
      fetchCustomObjectAnalytics(objectId),
      fetchCustomObjects().catch(() => []),
      fetchWorkspaceAreas().catch(() => []),
    ]);
    setFields(fieldItems);
    setAnalytics(stats);
    setAllAreas(workspaceAreaList);
    const object = objects.find((item) => item.id === objectId);
    const meta = (object?.meta as Record<string, any> | null) || null;
    setObjectMeta(meta);
    setObjectName(object?.name || '');
    setMoveToAreaId(object?.workspaceAreaId || '');
    const wIcon = meta?.workspaceNavIcon;
    setNavIconKey(
      typeof wIcon === 'string' && wIcon in NAV_ICON_MAP ? (wIcon as NavIconKey) : '',
    );
    const ev = parseEnabledViews(meta);
    setViewsEnabled({ kanban: ev.kanban, calendar: ev.calendar, gantt: ev.gantt, analytics: ev.analytics });
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
    const overrides = meta?.roleOverrides;
    setAccessDraft(
      overrides && typeof overrides === 'object' && !Array.isArray(overrides)
        ? (overrides as Record<string, AccessOverride>)
        : {},
    );
    let workspaceObjects: CustomObject[] = [];
    const wid = object?.workspaceAreaId;
    if (wid) {
      workspaceObjects = await fetchCustomObjects(wid);
      fetchWorkspaceArea(wid).then(setArea).catch(() => setArea(null));
      fetchWorkspaceAreaMembers(wid)
        .then(setMembers)
        .catch(() => setMembers([]));
    } else {
      setArea(null);
      setMembers([]);
    }
    setAreaWorkspaceObjects(workspaceObjects);
    const rawLinked = meta?.[WORKSPACE_LINKED_DATA_OBJECT_IDS_KEY];
    setLinkedDataObjectIds(
      Array.isArray(rawLinked)
        ? rawLinked.map((x) => String(x)).filter((id) => /^[0-9a-f-]{36}$/i.test(id))
        : [],
    );
  };

  useEffect(() => {
    if (!objectId) return;
    void load();
  }, [objectId]);

  /** То же поле, что таблица/канбан (meta.kanban.statusFieldKey имеет приоритет). */
  const statusField = useMemo(
    () => pickStatusLikeField(fields, objectMeta as Record<string, unknown> | null),
    [fields, objectMeta],
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
  const isBoardTable = useMemo(
    () => getWorkspaceTableKind(objectMeta as Record<string, unknown> | null) === 'board',
    [objectMeta],
  );

  const dataTablesInArea = useMemo(
    () =>
      areaWorkspaceObjects.filter(
        (o) => o.id !== objectId && getWorkspaceTableKind(o.meta) === 'data',
      ),
    [areaWorkspaceObjects, objectId],
  );

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

  const boundFields = useMemo(
    () =>
      fields
        .map((f) => ({ field: f, binding: parseWorkspaceColumnBindingV1(f.meta) }))
        .filter((x): x is { field: CustomObjectField; binding: WorkspaceColumnBindingV1 } => Boolean(x.binding)),
    [fields],
  );
  const unboundFields = useMemo(
    () => fields.filter((f) => !parseWorkspaceColumnBindingV1(f.meta)),
    [fields],
  );

  useEffect(() => {
    if (savingStatuses) return;
    setDraftStatuses(derivedStatusOptions);
  }, [derivedStatusOptions, savingStatuses]);

  const handleAddField = async () => {
    if (!key.trim() || !label.trim()) return;
    setSaving(true);
    try {
      const isCrmLead = type === 'crm_lead';
      const isCrmProject = type === 'crm_project';
      const isCrmCompany = type === 'crm_company';
      const resolvedFieldType: CustomObjectFieldType =
        isCrmLead || isCrmProject || isCrmCompany ? 'text' : (type as CustomObjectFieldType);
      const meta: Record<string, unknown> = {};
      if (isCrmLead) meta[WORKSPACE_ENTITY_REF_KEY] = 'lead';
      if (isCrmProject) meta[WORKSPACE_ENTITY_REF_KEY] = 'project';
      if (isCrmCompany) meta[WORKSPACE_ENTITY_REF_KEY] = 'company';
      await createCustomObjectField(objectId, {
        key: key.trim(),
        label: label.trim(),
        type: resolvedFieldType,
        meta: Object.keys(meta).length ? meta : undefined,
      });
      setKey('');
      setLabel('');
      setType('text');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleFieldRequired = async (f: CustomObjectField) => {
    await updateCustomObjectField(objectId, f.id, { required: !f.required });
    await load();
  };

  const deleteField = async (f: CustomObjectField) => {
    await deleteCustomObjectField(objectId, f.id);
    await load();
  };

  const moveField = async (id: string, dir: 'up' | 'down') => {
    const sorted = [...fields].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((f) => f.id === id);
    const j = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || j < 0 || j >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[j];
    setReorderBusy(true);
    try {
      await updateCustomObjectField(objectId, a.id, { order: b.order });
      await updateCustomObjectField(objectId, b.id, { order: a.order });
      await load();
    } finally {
      setReorderBusy(false);
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
      await load();
    } catch (e: any) {
      setStatusError(e?.message || t('crm.workspace.settings.failedSaveStatuses'));
    } finally {
      setSavingStatuses(false);
    }
  };

  const saveViewsAndCard = async () => {
    if (!objectId) return;
    setSavingCardSettings(true);
    setCardSettingsError(null);
    try {
      const nextMeta: Record<string, unknown> = {
        ...(objectMeta || {}),
        enabledViews: ['table', ...VIEW_TOGGLES.filter((k) => viewsEnabled[k])],
        kanban: {
          ...((objectMeta || {}).kanban || {}),
          cardTitleField: cardTitleField || '',
          clientField: clientField || '',
          extraFields: cardExtraFields
            .map((fieldKey) => String(fieldKey || '').trim())
            .filter(Boolean),
        },
      };
      if (navIconKey) nextMeta.workspaceNavIcon = navIconKey;
      else delete nextMeta.workspaceNavIcon;
      await updateCustomObject(objectId, { meta: nextMeta });
      setObjectMeta(nextMeta);
    } catch (e: any) {
      setCardSettingsError(e?.message || t('crm.workspace.settings.failedSaveCard'));
    } finally {
      setSavingCardSettings(false);
    }
  };

  const saveLinkedDataSources = async () => {
    if (!objectId) return;
    setSavingDataSources(true);
    try {
      const nextMeta: Record<string, unknown> = { ...(objectMeta || {}) };
      if (linkedDataObjectIds.length) {
        nextMeta[WORKSPACE_LINKED_DATA_OBJECT_IDS_KEY] = linkedDataObjectIds;
      } else {
        delete nextMeta[WORKSPACE_LINKED_DATA_OBJECT_IDS_KEY];
      }
      await updateCustomObject(objectId, { meta: nextMeta as Record<string, any> });
      setObjectMeta(nextMeta as Record<string, any>);
    } finally {
      setSavingDataSources(false);
    }
  };

  const resetBindForm = () => {
    setBindEditingKey('');
    setBindMode('from_pushed_source');
    setBindSourceField('');
    setBindDataObjectId('');
    setBindBoardMatch('');
    setBindDataMatch('');
    setBindDataDisplay('');
    setBindDataField('');
    setBindGroupBy('');
    setBindValueField('');
    setBindAggregate('sum');
  };

  const startEditBinding = (f: CustomObjectField, b: WorkspaceColumnBindingV1) => {
    setBindEditingKey(f.key);
    setBindMode(b.mode);
    setBindSourceField(b.mode === 'from_pushed_source' ? b.sourceFieldKey : '');
    setBindDataObjectId(
      b.mode === 'lookup_by_key' || b.mode === 'pick_from_data' || b.mode === 'rollup'
        ? b.dataObjectId
        : '',
    );
    setBindBoardMatch(b.mode === 'lookup_by_key' || b.mode === 'rollup' ? b.boardMatchFieldKey : '');
    setBindDataMatch(b.mode === 'lookup_by_key' ? b.dataMatchFieldKey : '');
    setBindDataDisplay(b.mode === 'lookup_by_key' ? b.dataDisplayFieldKey : '');
    setBindDataField(b.mode === 'pick_from_data' ? b.dataFieldKey : '');
    setBindGroupBy(b.mode === 'rollup' ? b.groupByFieldKey : '');
    setBindValueField(b.mode === 'rollup' ? b.valueFieldKey : '');
    setBindAggregate(b.mode === 'rollup' ? b.aggregate : 'sum');
  };

  const removeBinding = async (f: CustomObjectField) => {
    const nextMeta = { ...(f.meta || {}) } as Record<string, unknown>;
    delete nextMeta[WORKSPACE_COLUMN_BINDING_META_KEY];
    await updateCustomObjectField(objectId, f.id, { meta: nextMeta });
    await load();
  };

  const saveBinding = async () => {
    const f = fields.find((x) => x.key === bindEditingKey);
    if (!f) return;
    let binding: WorkspaceColumnBindingV1 | null = null;
    if (bindMode === 'from_pushed_source' && bindSourceField.trim()) {
      binding = { version: 1, mode: 'from_pushed_source', sourceFieldKey: bindSourceField.trim() };
    } else if (
      bindMode === 'lookup_by_key' &&
      bindDataObjectId &&
      bindBoardMatch.trim() &&
      bindDataMatch.trim() &&
      bindDataDisplay.trim()
    ) {
      binding = {
        version: 1,
        mode: 'lookup_by_key',
        dataObjectId: bindDataObjectId,
        boardMatchFieldKey: bindBoardMatch.trim(),
        dataMatchFieldKey: bindDataMatch.trim(),
        dataDisplayFieldKey: bindDataDisplay.trim(),
      };
    } else if (bindMode === 'pick_from_data' && bindDataObjectId && bindDataField.trim()) {
      binding = {
        version: 1,
        mode: 'pick_from_data',
        dataObjectId: bindDataObjectId,
        dataFieldKey: bindDataField.trim(),
      };
    } else if (bindMode === 'cached_snapshot') {
      binding = { version: 1, mode: 'cached_snapshot' };
    } else if (
      bindMode === 'rollup' &&
      bindDataObjectId &&
      bindBoardMatch.trim() &&
      bindGroupBy.trim() &&
      bindValueField.trim()
    ) {
      binding = {
        version: 1,
        mode: 'rollup',
        dataObjectId: bindDataObjectId,
        boardMatchFieldKey: bindBoardMatch.trim(),
        groupByFieldKey: bindGroupBy.trim(),
        valueFieldKey: bindValueField.trim(),
        aggregate: bindAggregate,
      };
    }
    if (!binding) return;
    setSavingBinding(true);
    try {
      await updateCustomObjectField(objectId, f.id, {
        meta: { ...(f.meta || {}), [WORKSPACE_COLUMN_BINDING_META_KEY]: binding },
      });
      resetBindForm();
      await load();
    } finally {
      setSavingBinding(false);
    }
  };

  const moveToArea = async () => {
    if (!moveToAreaId) return;
    setMovingArea(true);
    try {
      await updateCustomObject(objectId, { workspaceAreaId: moveToAreaId });
      await load();
    } finally {
      setMovingArea(false);
    }
  };

  const saveAccess = async () => {
    setSavingAccess(true);
    try {
      const cleaned: Record<string, AccessOverride> = {};
      Object.entries(accessDraft).forEach(([staffId, role]) => {
        if (role) cleaned[staffId] = role;
      });
      const nextMeta: Record<string, unknown> = { ...(objectMeta || {}) };
      if (Object.keys(cleaned).length) nextMeta.roleOverrides = cleaned;
      else delete nextMeta.roleOverrides;
      await updateCustomObject(objectId, { meta: nextMeta });
      setObjectMeta(nextMeta as Record<string, any>);
    } finally {
      setSavingAccess(false);
    }
  };

  const clearRows = async () => {
    if (clearConfirmInput.trim() !== objectName) return;
    setClearBusy(true);
    try {
      await clearCustomObjectRecords(objectId);
      setClearConfirmInput('');
      await load();
    } finally {
      setClearBusy(false);
    }
  };

  const deleteTable = async () => {
    if (deleteConfirmInput.trim() !== objectName) return;
    setDeleteBusy(true);
    try {
      await deleteCustomObject(objectId);
      navigate(area ? `/workspace/areas/${area.id}` : '/workspace/areas');
    } finally {
      setDeleteBusy(false);
    }
  };

  const SIDE_ITEMS: { key: Section; label: string; icon: NavIconKey }[] = [
    { key: 'fields', label: t('crm.workspace.tableSettings.sectionFields'), icon: 'table' },
    { key: 'bindings', label: t('crm.workspace.tableSettings.sectionBindings'), icon: 'analytics' },
    { key: 'statuses', label: t('crm.workspace.tableSettings.sectionStatuses'), icon: 'chat' },
    { key: 'views', label: t('crm.workspace.tableSettings.sectionViews'), icon: 'kanban' },
    { key: 'access', label: t('crm.workspace.tableSettings.sectionAccess'), icon: 'contacts' },
  ];

  return (
    <MainLayout>
      <div
        className="ws-page w-full min-w-0"
        style={{
          marginLeft: -24,
          marginRight: -24,
          paddingLeft: 24,
          paddingRight: 24,
          width: 'calc(100% + 48px)',
        }}
      >
        {area && (
          <WsAreaBar
            areaId={area.id}
            areaName={area.name}
            areaIconKey={area.iconKey}
            current={objectName}
            kind={getWorkspaceTableKind(objectMeta as Record<string, unknown> | null)}
          />
        )}
        <div className="page-head">
          <div>
            <h1>
              {t('crm.workspace.tableSettings.title')} <span style={{ color: 'var(--fg-4)', fontWeight: 400 }}>·</span>{' '}
              <span style={{ color: 'var(--fg-3)', fontWeight: 500 }}>{objectName}</span>
            </h1>
            <div className="sub">{t('crm.workspace.tableSettings.subtitle')}</div>
          </div>
          <div className="page-head-actions">
            <button type="button" className="tb-icon-btn" onClick={() => navigate(`/workspace/${objectId}/import`)}>
              {t('crm.workspace.settings.importData')}
            </button>
            <button type="button" className="tb-icon-btn" onClick={() => navigate(`/workspace/${objectId}/table`)}>
              {t('crm.workspace.settings.openTable')}
            </button>
          </div>
        </div>

        <WorkspaceViewTabs objectId={objectId} active="settings" />

        <div className="ws-cols">
          <div className="ws-side">
            {SIDE_ITEMS.map((it) => {
              const Icon = NAV_ICON_MAP[it.icon];
              if (it.key === 'bindings' && !isBoardTable) return null;
              return (
                <button
                  key={it.key}
                  type="button"
                  className={section === it.key ? 'on' : ''}
                  onClick={() => setSection(it.key)}
                >
                  <Icon className="!h-[14px] !w-[14px]" />
                  {it.label}
                </button>
              );
            })}
            <div className="gt">{t('crm.workspace.areaSettings.dangerGroup')}</div>
            <button
              type="button"
              className={section === 'danger' ? 'on' : ''}
              onClick={() => setSection('danger')}
              style={section !== 'danger' ? { color: '#9c2338' } : undefined}
            >
              <NAV_ICON_MAP.tools className="!h-[14px] !w-[14px]" />
              {t('crm.workspace.areaSettings.sectionDanger')}
            </button>
          </div>

          <div>
            {section === 'fields' && (
              <div className="ws-sec">
                <div className="ws-sec-head">
                  <div>
                    <h2>{t('crm.workspace.tableSettings.sectionFields')}</h2>
                    <div className="s">{t('crm.workspace.tableSettings.fieldsHint')}</div>
                  </div>
                </div>
                <div className="ws-sec-body">
                  {[...fields].sort((a, b) => a.order - b.order).map((f, i, arr) => (
                    <div className="ws-fieldrow" key={f.id}>
                      <span className="drag">⋮⋮</span>
                      <span>
                        <span className="lb">{f.label}</span>
                        <span className="kk">{f.key}</span>
                      </span>
                      <span className="ty">{f.type}</span>
                      <span>
                        {parseWorkspaceColumnBindingV1(f.meta) ? (
                          <span className="ws-mode">{t('crm.workspace.tableSettings.bound')}</span>
                        ) : (
                          <span className="ty">{t('crm.workspace.tableSettings.manualEntry')}</span>
                        )}
                      </span>
                      <span style={{ display: 'flex', gap: 4 }}>
                        <button type="button" className="tb-icon-btn" disabled={reorderBusy || i === 0} onClick={() => void moveField(f.id, 'up')}>
                          ↑
                        </button>
                        <button type="button" className="tb-icon-btn" disabled={reorderBusy || i === arr.length - 1} onClick={() => void moveField(f.id, 'down')}>
                          ↓
                        </button>
                        <button type="button" className="tb-icon-btn" onClick={() => void toggleFieldRequired(f)}>
                          {f.required ? t('crm.workspace.tableSettings.required') : t('crm.workspace.tableSettings.optional')}
                        </button>
                        <button type="button" className="tb-icon-btn" onClick={() => void deleteField(f)} title={t('crm.workspace.settings.deleteStatus')}>
                          <NAV_ICON_MAP.tools className="!h-[12px] !w-[12px]" />
                        </button>
                      </span>
                    </div>
                  ))}
                  {fields.length === 0 && <div className="ws-note">{t('crm.workspace.settings.noFieldsYet')}</div>}
                </div>
                <div className="ws-sec-foot" style={{ flexWrap: 'wrap' }}>
                  <input
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder={t('crm.workspace.settings.fieldKeyPlaceholder')}
                    className="ws-input"
                    style={{ width: 140 }}
                  />
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={t('crm.workspace.settings.fieldLabelPlaceholder')}
                    className="ws-input"
                    style={{ width: 160 }}
                  />
                  <select value={type} onChange={(e) => setType(e.target.value)} className="ws-input" style={{ width: 150 }}>
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
                  </select>
                  <span className="sp" />
                  <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={() => void handleAddField()}>
                    {saving ? '…' : t('crm.workspace.settings.addField')}
                  </button>
                </div>
              </div>
            )}

            {section === 'bindings' && isBoardTable && (
              <>
                <div className="ws-sec">
                  <div className="ws-sec-head">
                    <div>
                      <h2>{t('crm.workspace.tableSettings.sectionBindings')}</h2>
                      <div className="s">{t('crm.workspace.tableSettings.bindingsHint')}</div>
                    </div>
                  </div>
                  <div className="ws-sec-body" style={{ padding: boundFields.length ? 0 : 16 }}>
                    {boundFields.length === 0 && <div className="ws-note">{t('crm.workspace.tableSettings.noBindings')}</div>}
                    {boundFields.length > 0 && (
                      <table className="ws-bind">
                        <thead>
                          <tr>
                            <th>{t('crm.workspace.areaSettings.capabilityCol')}</th>
                            <th>{t('crm.workspace.table.columnBindingSection')}</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {boundFields.map(({ field: f, binding }) => (
                            <tr key={f.id}>
                              <td>
                                <span className="col">{f.label}</span> <span className="key">{f.key}</span>
                              </td>
                              <td>
                                <span className="ws-mode">{bindModeLabel(t, binding.mode)}</span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button type="button" className="tb-icon-btn" onClick={() => startEditBinding(f, binding)}>
                                  {t('crm.common.edit', { defaultValue: 'Изменить' })}
                                </button>{' '}
                                <button type="button" className="tb-icon-btn" onClick={() => void removeBinding(f)}>
                                  <NAV_ICON_MAP.tools className="!h-[12px] !w-[12px]" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div className="ws-sec-foot" style={{ flexWrap: 'wrap', gap: 10 }}>
                    <select className="ws-input" value={bindEditingKey} onChange={(e) => {
                      const f = fields.find((x) => x.key === e.target.value);
                      const b = f ? parseWorkspaceColumnBindingV1(f.meta) : null;
                      if (f && b) startEditBinding(f, b);
                      else { resetBindForm(); setBindEditingKey(e.target.value); }
                    }} style={{ width: 200 }}>
                      <option value="">{t('crm.workspace.table.columnBindingPickBoardKey')}</option>
                      {[...unboundFields, ...boundFields.map((x) => x.field)].map((f) => (
                        <option key={f.id} value={f.key}>{f.label}</option>
                      ))}
                    </select>
                    <select className="ws-input" value={bindMode} onChange={(e) => setBindMode(e.target.value as WorkspaceColumnBindingV1['mode'])} style={{ width: 190 }}>
                      {BIND_MODES.map((m) => (
                        <option key={m} value={m}>{bindModeLabel(t, m)}</option>
                      ))}
                    </select>
                    {bindMode === 'from_pushed_source' && (
                      <input className="ws-input" style={{ width: 160 }} placeholder={t('crm.workspace.table.columnBindingSourceField')} value={bindSourceField} onChange={(e) => setBindSourceField(e.target.value)} />
                    )}
                    {(bindMode === 'lookup_by_key' || bindMode === 'pick_from_data' || bindMode === 'rollup') && (
                      <select className="ws-input" style={{ width: 160 }} value={bindDataObjectId} onChange={(e) => setBindDataObjectId(e.target.value)}>
                        <option value="">{t('crm.workspace.table.columnBindingDataTable')}</option>
                        {dataTablesInArea.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    )}
                    {bindMode === 'lookup_by_key' && (
                      <>
                        <input className="ws-input" style={{ width: 130 }} placeholder={t('crm.workspace.table.columnBindingBoardKey')} value={bindBoardMatch} onChange={(e) => setBindBoardMatch(e.target.value)} />
                        <input className="ws-input" style={{ width: 130 }} placeholder={t('crm.workspace.table.columnBindingDataMatch')} value={bindDataMatch} onChange={(e) => setBindDataMatch(e.target.value)} />
                        <input className="ws-input" style={{ width: 130 }} placeholder={t('crm.workspace.table.columnBindingDataDisplay')} value={bindDataDisplay} onChange={(e) => setBindDataDisplay(e.target.value)} />
                      </>
                    )}
                    {bindMode === 'pick_from_data' && (
                      <input className="ws-input" style={{ width: 160 }} placeholder={t('crm.workspace.table.columnBindingPickFromDataField')} value={bindDataField} onChange={(e) => setBindDataField(e.target.value)} />
                    )}
                    {bindMode === 'rollup' && (
                      <>
                        <input className="ws-input" style={{ width: 130 }} placeholder={t('crm.workspace.table.columnBindingBoardKey')} value={bindBoardMatch} onChange={(e) => setBindBoardMatch(e.target.value)} />
                        <input className="ws-input" style={{ width: 130 }} placeholder={t('crm.workspace.table.columnBindingGroupBy')} value={bindGroupBy} onChange={(e) => setBindGroupBy(e.target.value)} />
                        <input className="ws-input" style={{ width: 130 }} placeholder={t('crm.workspace.table.columnBindingValueField')} value={bindValueField} onChange={(e) => setBindValueField(e.target.value)} />
                        <select className="ws-input" style={{ width: 110 }} value={bindAggregate} onChange={(e) => setBindAggregate(e.target.value as typeof bindAggregate)}>
                          <option value="sum">{t('crm.workspace.table.columnBindingAggSum')}</option>
                          <option value="count">{t('crm.workspace.table.columnBindingAggCount')}</option>
                          <option value="avg">{t('crm.workspace.table.columnBindingAggAvg')}</option>
                          <option value="min">{t('crm.workspace.table.columnBindingAggMin')}</option>
                          <option value="max">{t('crm.workspace.table.columnBindingAggMax')}</option>
                        </select>
                      </>
                    )}
                    <span className="sp" />
                    <button type="button" className="btn btn-primary btn-sm" disabled={!bindEditingKey || savingBinding} onClick={() => void saveBinding()}>
                      {savingBinding ? '…' : t('crm.workspace.tableSettings.saveBinding')}
                    </button>
                  </div>
                </div>

                <div className="ws-sec">
                  <div className="ws-sec-head">
                    <div>
                      <h2>{t('crm.workspace.settings.dataSourcesTitle')}</h2>
                      <div className="s">{t('crm.workspace.settings.dataSourcesHint')}</div>
                    </div>
                  </div>
                  <div className="ws-sec-body">
                    {dataTablesInArea.length === 0 && <div className="ws-note">{t('crm.workspace.settings.dataSourcesEmpty')}</div>}
                    {dataTablesInArea.map((tbl) => (
                      <label key={tbl.id} className="ws-check" style={{ marginBottom: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={linkedDataObjectIds.includes(tbl.id)}
                          onChange={() => {
                            setLinkedDataObjectIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(tbl.id)) next.delete(tbl.id);
                              else next.add(tbl.id);
                              return Array.from(next);
                            });
                          }}
                        />
                        {tbl.name}
                      </label>
                    ))}
                  </div>
                  <div className="ws-sec-foot">
                    <span className="sp" />
                    <button type="button" className="btn btn-primary btn-sm" disabled={savingDataSources} onClick={() => void saveLinkedDataSources()}>
                      {savingDataSources ? '…' : t('crm.workspace.settings.dataSourcesSave')}
                    </button>
                  </div>
                </div>
              </>
            )}

            {section === 'statuses' && (
              <div className="ws-sec">
                <div className="ws-sec-head">
                  <div>
                    <h2>{t('crm.workspace.tableSettings.sectionStatuses')}</h2>
                    <div className="s">{t('crm.workspace.settings.statusHint')}</div>
                  </div>
                </div>
                <div className="ws-sec-body">
                  {draftStatuses.map((status, index) => (
                    <div className="ws-strow" key={status.value}>
                      <span className="ord">{String(index + 1).padStart(2, '0')}</span>
                      <span className="sw" style={{ background: status.color }} />
                      <input
                        className="ws-input"
                        value={status.label}
                        onChange={(e) =>
                          setDraftStatuses((prev) => prev.map((item, i) => (i === index ? { ...item, label: e.target.value } : item)))
                        }
                      />
                      <input className="ws-input" value={status.value} readOnly style={{ width: 120, fontFamily: 'var(--ws-ff-mono)', fontSize: 11 }} />
                      <button type="button" className="tb-icon-btn" onClick={() => moveDraftStatus(index, -1)} disabled={index === 0}>↑</button>
                      <button type="button" className="tb-icon-btn" onClick={() => moveDraftStatus(index, 1)} disabled={index === draftStatuses.length - 1}>↓</button>
                      <button type="button" className="tb-icon-btn" onClick={() => setDraftStatuses((prev) => prev.filter((_, i) => i !== index))}>×</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <input
                      className="ws-input"
                      style={{ flex: 1 }}
                      value={newStatusLabel}
                      onChange={(e) => setNewStatusLabel(e.target.value)}
                      placeholder={t('crm.workspace.settings.newStatusPlaceholder')}
                    />
                    <button type="button" className="tb-icon-btn" onClick={addDraftStatus}>{t('crm.workspace.settings.addStatus')}</button>
                  </div>
                  {statusError && <p className="ws-note" style={{ color: '#9c2338', marginTop: 8 }}>{statusError}</p>}
                </div>
                <div className="ws-sec-foot">
                  <span className="ws-note">{t('crm.workspace.settings.deleteStatus')}</span>
                  <span className="sp" />
                  <button type="button" className="btn btn-primary btn-sm" disabled={savingStatuses} onClick={() => void saveStatusStructure()}>
                    {savingStatuses ? '…' : t('crm.workspace.settings.saveStructure')}
                  </button>
                </div>
              </div>
            )}

            {section === 'views' && (
              <>
                <div className="ws-sec">
                  <div className="ws-sec-head">
                    <div>
                      <h2>{t('crm.workspace.tableSettings.sectionViews')}</h2>
                      <div className="s">{t('crm.workspace.newTable.viewsHint')}</div>
                    </div>
                  </div>
                  <div className="ws-sec-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="ws-tog">
                      <button className="sw on" disabled />
                      <span><span style={{ fontWeight: 500 }}>{t('crm.workspace.views.table')}</span></span>
                    </div>
                    {VIEW_TOGGLES.map((v) => (
                      <div className="ws-tog" key={v}>
                        <button
                          type="button"
                          className={`sw${viewsEnabled[v] ? ' on' : ''}`}
                          onClick={() => setViewsEnabled((prev) => ({ ...prev, [v]: !prev[v] }))}
                        />
                        <span>
                          <span style={{ fontWeight: 500 }}>{t(`crm.workspace.views.${v}`)}</span>
                          <span className="h">{t(`crm.workspace.newTable.views.${v}Hint`)}</span>
                        </span>
                        <span className="sp" />
                        {viewsEnabled[v] && (
                          <a className="tb-icon-btn" href={`/workspace/${objectId}/${v}`}>{t('crm.workspace.areasList.open')}</a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ws-sec">
                  <div className="ws-sec-head">
                    <div>
                      <h2>{t('crm.workspace.settings.cardMapping')}</h2>
                      <div className="s">{t('crm.workspace.settings.cardMappingHintShort')}</div>
                    </div>
                  </div>
                  <div className="ws-sec-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="ws-grid2">
                      <div className="ws-field">
                        <label>{t('crm.workspace.settings.cardTitleField')}</label>
                        <select className="ws-input" value={cardTitleField} onChange={(e) => setCardTitleField(e.target.value)}>
                          <option value="">{t('crm.workspace.settings.selectTitleField')}</option>
                          {selectorOptions.map((o) => <option key={`t-${o.value}`} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div className="ws-field">
                        <label>{t('crm.workspace.settings.clientField')}</label>
                        <select className="ws-input" value={clientField} onChange={(e) => setClientField(e.target.value)}>
                          <option value="">{t('crm.workspace.settings.noClientLabel')}</option>
                          {selectorOptions.map((o) => <option key={`c-${o.value}`} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="ws-field">
                      <label>{t('crm.workspace.settings.additionalFields')}</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {selectorOptions.filter((o) => o.value !== cardTitleField && o.value !== clientField).map((o) => {
                          const checked = cardExtraFields.includes(o.value);
                          return (
                            <button
                              key={`e-${o.value}`}
                              type="button"
                              className={`ws-badge${checked ? ' board' : ''}`}
                              style={{ cursor: 'pointer' }}
                              onClick={() =>
                                setCardExtraFields((prev) => (checked ? prev.filter((k) => k !== o.value) : [...prev, o.value]))
                              }
                            >
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="ws-field">
                      <label>{t('crm.workspace.settings.workspaceNavIconTitle')}</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" className={`ws-pick${!navIconKey ? ' on' : ''}`} style={{ flex: '0 0 auto', padding: 9, justifyContent: 'center' }} onClick={() => setNavIconKey('')}>
                          {t('crm.workspace.settings.workspaceNavIconDefault')}
                        </button>
                        {WORKSPACE_NAV_ICON_KEYS.map((k) => {
                          const Ic = NAV_ICON_MAP[k];
                          return (
                            <button key={k} type="button" title={k} className={`ws-pick${navIconKey === k ? ' on' : ''}`} style={{ flex: '0 0 auto', padding: 9, justifyContent: 'center' }} onClick={() => setNavIconKey(k)}>
                              <Ic className="!h-[14px] !w-[14px]" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="ws-sec-foot">
                    {cardSettingsError && <span className="ws-note" style={{ color: '#9c2338' }}>{cardSettingsError}</span>}
                    <span className="sp" />
                    <button type="button" className="btn btn-primary btn-sm" disabled={savingCardSettings} onClick={() => void saveViewsAndCard()}>
                      {savingCardSettings ? '…' : t('crm.workspace.settings.save')}
                    </button>
                  </div>
                </div>
              </>
            )}

            {section === 'access' && (
              <div className="ws-sec">
                <div className="ws-sec-head">
                  <div>
                    <h2>{t('crm.workspace.tableSettings.sectionAccess')}</h2>
                    <div className="s">{t('crm.workspace.tableSettings.accessHint')}</div>
                  </div>
                </div>
                <div className="ws-sec-body">
                  {members.map((m) => (
                    <div className="ws-mrow" key={m.id}>
                      <span style={{ minWidth: 0 }}>
                        <span className="nm">{m.staffUser?.fullName || m.staffUser?.email || '—'}</span>
                        <div className="ml">{t(`crm.workspace.areaSettings.roles.${m.role}`)} {t('crm.workspace.tableSettings.inArea')}</div>
                      </span>
                      <span className="sp" />
                      <select
                        className="ws-input"
                        style={{ width: 190 }}
                        value={accessDraft[m.staffUserId] || ''}
                        onChange={(e) => setAccessDraft((prev) => ({ ...prev, [m.staffUserId]: e.target.value as AccessOverride }))}
                      >
                        <option value="">{t('crm.workspace.tableSettings.asInArea')}</option>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{t(`crm.workspace.areaSettings.roles.${r}`)}</option>
                        ))}
                        <option value="none">{t('crm.workspace.tableSettings.noAccess')}</option>
                      </select>
                    </div>
                  ))}
                  {members.length === 0 && <div className="ws-note">{t('crm.workspace.areaSettings.noMembers')}</div>}
                </div>
                <div className="ws-sec-foot">
                  <span className="sp" />
                  <button type="button" className="btn btn-primary btn-sm" disabled={savingAccess} onClick={() => void saveAccess()}>
                    {savingAccess ? '…' : t('crm.workspace.settings.save')}
                  </button>
                </div>
              </div>
            )}

            {section === 'danger' && (
              <>
                <div className="ws-sec">
                  <div className="ws-sec-head">
                    <div>
                      <h2>{t('crm.workspace.tableSettings.moveAreaTitle')}</h2>
                      <div className="s">{t('crm.workspace.tableSettings.moveAreaHint')}</div>
                    </div>
                  </div>
                  <div className="ws-sec-body">
                    <select className="ws-input" value={moveToAreaId} onChange={(e) => setMoveToAreaId(e.target.value)}>
                      {allAreas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div className="ws-sec-foot">
                    <span className="sp" />
                    <button type="button" className="btn btn-sm" disabled={movingArea || !moveToAreaId || moveToAreaId === area?.id} onClick={() => void moveToArea()}>
                      {movingArea ? '…' : t('crm.workspace.tableSettings.moveAreaBtn')}
                    </button>
                  </div>
                </div>

                <div className="ws-sec">
                  <div className="ws-sec-head">
                    <div>
                      <h2>{t('crm.workspace.tableSettings.clearRowsTitle')}</h2>
                      <div className="s">{t('crm.workspace.tableSettings.clearRowsHint')}</div>
                    </div>
                  </div>
                  <div className="ws-sec-body">
                    <div className="ws-field">
                      <label>{t('crm.workspace.areaSettings.deleteConfirmLabel')}</label>
                      <input className="ws-input" value={clearConfirmInput} onChange={(e) => setClearConfirmInput(e.target.value)} placeholder={objectName} />
                    </div>
                  </div>
                  <div className="ws-sec-foot">
                    <span className="sp" />
                    <button type="button" className="tb-icon-btn" disabled={clearBusy || clearConfirmInput.trim() !== objectName} onClick={() => void clearRows()}>
                      {clearBusy ? '…' : t('crm.workspace.tableSettings.clearRowsBtn')}
                    </button>
                  </div>
                </div>

                <div className="ws-sec danger">
                  <div className="ws-sec-head">
                    <div>
                      <h2>{t('crm.workspace.tableSettings.deleteTableTitle')}</h2>
                      <div className="s">{t('crm.workspace.tableSettings.deleteTableHint')}</div>
                    </div>
                  </div>
                  <div className="ws-sec-body">
                    <div className="ws-field">
                      <label>{t('crm.workspace.areaSettings.deleteConfirmLabel')}</label>
                      <input className="ws-input" value={deleteConfirmInput} onChange={(e) => setDeleteConfirmInput(e.target.value)} placeholder={objectName} />
                    </div>
                  </div>
                  <div className="ws-sec-foot">
                    <span className="sp" />
                    <button
                      type="button"
                      className="tb-icon-btn"
                      style={{ borderColor: '#f0d3d8', color: '#9c2338' }}
                      disabled={deleteBusy || deleteConfirmInput.trim() !== objectName}
                      onClick={() => void deleteTable()}
                    >
                      {deleteBusy ? '…' : t('crm.workspace.tableSettings.deleteTableBtn')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {analytics && (
          <div className="ws-kpi" style={{ marginTop: 18 }}>
            <div className="c">
              <div className="k">{t('crm.workspace.settings.records')}</div>
              <div className="v">{analytics.totalRecords}</div>
            </div>
            {Object.entries(analytics.byStatus).slice(0, 3).map(([k, v]) => (
              <div className="c" key={k}>
                <div className="k">{k}</div>
                <div className="v">{v}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

function bindModeLabel(t: (key: string, opts?: any) => string, mode: WorkspaceColumnBindingV1['mode']): string {
  switch (mode) {
    case 'from_pushed_source':
      return t('crm.workspace.table.columnBindingPushed');
    case 'lookup_by_key':
      return t('crm.workspace.table.columnBindingLookup');
    case 'pick_from_data':
      return t('crm.workspace.table.columnBindingPickFromData');
    case 'rollup':
      return t('crm.workspace.table.columnBindingRollup');
    case 'cached_snapshot':
    default:
      return t('crm.workspace.area.bindModeCachedSnapshot');
  }
}
