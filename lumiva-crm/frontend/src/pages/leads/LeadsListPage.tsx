// src/pages/leads/LeadsListPage.tsx

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { AiSmartSearchBar } from '../../components/ai/AiSmartSearchBar';
import { AiDuplicatesModal } from '../../components/ai/AiDuplicatesModal';
import type { AiSmartSearchFilters } from '../../api/ai';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Lead, LeadStatus } from '../../api/leads';
import { fetchLeads, updateLead } from '../../api/leads';
import { fetchCompanies, fetchCompany, type Company } from '../../api/companies';
import { fetchContacts, type Contact } from '../../api/contacts';
import { fetchStaff, type StaffUser } from '../../api/staff';
import {
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';
import { AutomationPanel } from '../../components/AutomationPanel';
import { ViewNameModal } from '../../components/ViewNameModal';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  createLeadsCustomView,
  deleteLeadsCustomView,
  loadLeadsCustomViews,
  type LeadsCustomView,
  updateLeadsCustomView,
} from './leadsViewsStore';
import { useWorkspaceStyleColumnDrag } from '../../components/table/useWorkspaceStyleColumnDrag';
import { WorkspaceCrmEntityMultiField } from '../../components/workspace/WorkspaceCrmEntityMultiField';
import { parseCrmEntityIdsFromCell } from '../../workspace/workspaceCrmEntityIds';
import { getFixedPopoverLayout, type FixedPopoverLayout } from '../../utils/tablePopoverFixedPosition';
import '../projects/ProjectsListPage.css';
import { LeadsCsvImportModal } from './LeadsCsvImportModal';

type LeadListColumn =
  | { id: string; label: string }
  | { id: string; label: string; field: CustomField };

type LeadsCustomGroup = {
  id: string;
  name: string;
  order: number;
};

const LEADS_GROUPS_KEY = 'leads_custom_groups_v1';
const LEADS_GROUP_ASSIGNMENTS_KEY = 'leads_custom_group_assignments_v1';

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

export const LeadsListPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showConfirm } = useAlertModal();
  const locale = resolveLocale(i18n.language);
  const [searchParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [groupMode, setGroupMode] = useState<'status' | 'company' | 'channel' | 'none' | 'custom'>('status');
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<LeadStatus | ''>('');
  const [showArchived, setShowArchived] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [columnsSearch, setColumnsSearch] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [aiFilters, setAiFilters] = useState<AiSmartSearchFilters | null>(null);
  const [aiFilterDesc, setAiFilterDesc] = useState('');
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [statusOpenId, setStatusOpenId] = useState<string | null>(null);
  const [statusPopoverPos, setStatusPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const statusPopoverRef = useRef<HTMLDivElement | null>(null);
  const [colGhost, setColGhost] = useState<{
    colId: string;
    label: string;
    rows: string[];
    x: number;
    y: number;
  } | null>(null);
  const [resizing, setResizing] = useState<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);
  const viewsMenuRef = useRef<HTMLDivElement | null>(null);
  const [customViews, setCustomViews] = useState<LeadsCustomView[]>(() => loadLeadsCustomViews());
  const [viewsMenuOpen, setViewsMenuOpen] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameModalMode, setNameModalMode] = useState<'create' | 'rename'>('create');
  const [nameModalCreateType, setNameModalCreateType] = useState<'table' | 'kanban' | 'calendar'>('table');
  const [companiesMap, setCompaniesMap] = useState<Record<string, Company>>({});
  const [contactsMap, setContactsMap] = useState<Record<string, Contact>>({});
  const [customGroups, setCustomGroups] = useState<LeadsCustomGroup[]>([]);
  const [leadGroupMap, setLeadGroupMap] = useState<Record<string, string>>({});
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverGroupKey, setDragOverGroupKey] = useState<string | null>(null);
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [assigneeEditorLeadId, setAssigneeEditorLeadId] = useState<string | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [assigneeDraftIds, setAssigneeDraftIds] = useState<string[]>([]);
  const assigneeMenuRef = useRef<HTMLDivElement | null>(null);
  const assigneeAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [assigneePopoverLayout, setAssigneePopoverLayout] = useState<FixedPopoverLayout | null>(null);

  const navigate = useNavigate();
  const activeViewId = searchParams.get('view');
  const activeCustomView = customViews.find((view) => view.id === activeViewId) || null;

  const handleCreateLead = () => navigate('/leads/new');
  const handleOpenLead = (id: string) => navigate(`/leads/${id}`);
  const goBoard = () => navigate('/leads/board');
  const goCalendar = () => navigate('/leads/calendar');
  const statusLabels = useMemo<Record<string, string>>(
    () => ({
      new: t('crm.leads.statuses.new'),
      in_progress: t('crm.leads.statuses.inProgress'),
      waiting: t('crm.leads.statuses.waiting'),
      won: t('crm.leads.statuses.won'),
      lost: t('crm.leads.statuses.lost'),
    }),
    [t],
  );
  const statusOptions: LeadStatus[] = [
    'Новый клиент',
    'В работе',
    'Ожидает ответа',
    'Закрыт (успех)',
    'Закрыт (проигран)',
  ];
  const calendarLabel = t('crm.leads.board.viewCalendar');
  const menuCreateTable = t('crm.leads.board.menu.createTable');
  const menuCreateKanban = t('crm.leads.board.menu.createKanban');
  const menuCreateCalendar = t('crm.leads.board.menu.createCalendar');
  const menuRename = t('crm.leads.board.menu.renameView');
  const menuDelete = t('crm.leads.board.menu.deleteView');
  const isArchivedLead = (lead: Lead) => Boolean(lead.meta?.archived);
  const isDeletedLead = (lead: Lead) => Boolean(lead.meta?.deleted);
  const toggleCollapsed = (groupKey: string) => {
    setCollapsedGroups((prev) =>
      prev.includes(groupKey) ? prev.filter((s) => s !== groupKey) : [...prev, groupKey],
    );
  };
  const toggleSelected = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  };
  const toggleAllSelected = (items: Lead[]) => {
    if (!items.length) return;
    const ids = items.map((l) => l.id);
    const allSelected = ids.every((id) => selectedLeadIds.includes(id));
    setSelectedLeadIds(allSelected ? [] : ids);
  };
  const formatUtm = useCallback(
    (lead: Lead) => {
      const parts = [lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(
        (v) => v && String(v).trim().length > 0,
      );
      return parts.length ? parts.join(' / ') : t('crm.leads.list.emptyValue');
    },
    [t],
  );
  const formatStatus = (status?: string | null) => {
    if (!status) return t('crm.leads.list.emptyValue');
    return statusLabels[status] ?? status;
  };

  const activeCustomFields = useMemo(
    () => customFields.filter((field) => field.isActive),
    [customFields],
  );
  const suggestedKeys = useMemo(() => {
    const keys = new Set<string>();
    leads.forEach((lead) => {
      Object.keys(lead.customFields ?? {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [leads]);

  const baseColumns = useMemo((): LeadListColumn[] => [
      { id: 'name', label: t('crm.leads.list.columns.name') },
      { id: 'assignee', label: t('crm.leads.list.columns.assignee') },
      { id: 'status', label: t('crm.leads.list.columns.status') },
      { id: 'company', label: t('crm.leads.list.columns.company') },
      { id: 'contact', label: t('crm.leads.list.columns.contact') },
      { id: 'channel', label: t('crm.leads.list.columns.channel') },
      { id: 'utm', label: t('crm.leads.list.columns.utm') },
      { id: 'utmSource', label: 'UTM Source' },
      { id: 'utmMedium', label: 'UTM Medium' },
      { id: 'utmCampaign', label: 'UTM Campaign' },
      { id: 'utmTerm', label: 'UTM Term' },
      { id: 'utmContent', label: 'UTM Content' },
      { id: 'created', label: t('crm.leads.list.columns.created') },
    ], [t]);
  const coreColumnIds = useMemo(
    () => new Set(['name', 'assignee', 'status', 'company', 'created']),
    [],
  );

  const columns = useMemo((): LeadListColumn[] => {
    const customCols: LeadListColumn[] = activeCustomFields.map((field) => ({
      id: `cf:${field.id}`,
      label: field.label,
      field,
    }));
    return [...baseColumns, ...customCols];
  }, [activeCustomFields, baseColumns]);
  const visibleColumns = useMemo(
    () => columns.filter((col) => !hiddenColumns.includes(col.id)),
    [columns, hiddenColumns],
  );

  const orderedColumns = useMemo(() => {
    if (!visibleColumns.length) return [];
    const map = new Map(visibleColumns.map((col) => [col.id, col]));
    const order =
      columnOrder.length > 0 ? columnOrder : visibleColumns.map((col) => col.id);
    const result: typeof visibleColumns = [];
    order.forEach((id) => {
      const col = map.get(id);
      if (col) result.push(col);
    });
    visibleColumns.forEach((col) => {
      if (!result.find((r) => r.id === col.id)) result.push(col);
    });
    return result;
  }, [visibleColumns, columnOrder]);

  const getColumnWidth = (id: string, fallback: number) =>
    columnWidths[id] ?? fallback;
  const getFallbackColumnWidth = (id: string) => {
    if (id === 'name') return 280;
    if (id === 'assignee') return 160;
    if (id === 'company') return 200;
    if (id === 'contact') return 220;
    if (id === 'channel') return 160;
    if (id === 'utm') return 200;
    if (id === 'utmSource' || id === 'utmMedium' || id === 'utmCampaign') return 170;
    if (id === 'utmTerm' || id === 'utmContent') return 190;
    if (id === 'status') return 170;
    if (id === 'created') return 170;
    return 180;
  };

  const updateLeadInline = async (
    id: string,
    patch: Partial<Lead>,
    apiPatch: any,
  ) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    try {
      const updated = await updateLead(id, apiPatch);
      setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.leads.list.errors.loadFailed'));
    }
  };

  const initialsFromName = (name: string) => {
    const parts = name.split(' ').filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const second = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
    return `${first}${second}`.toUpperCase();
  };

  const resolveLeadAssignees = (lead: Lead): Array<StaffUser | string> => {
    if (lead.assignedUserIds?.length && staff.length) {
      const out: StaffUser[] = [];
      for (const id of lead.assignedUserIds) {
        const u = staff.find((s) => s.id === id);
        if (u) out.push(u);
      }
      if (out.length) return out;
    }
    if (lead.assignedUserId && staff.length) {
      const u = staff.find((s) => s.id === lead.assignedUserId);
      if (u) return [u];
    }
    const names =
      lead.assignedToList?.length
        ? lead.assignedToList
        : lead.assignedTo
          ? lead.assignedTo.split(/[,;/]+/).map((s) => s.trim()).filter(Boolean)
          : [];
    if (names.length) return names;
    return [];
  };

  const formatAssigneeDisplay = (lead: Lead): string => {
    const list = resolveLeadAssignees(lead);
    if (!list.length) return '—';
    return list
      .map((item) => (typeof item === 'string' ? item : item.fullName))
      .join(', ');
  };

  const openAssigneeEditor = (lead: Lead) => {
    const ids: string[] = lead.assignedUserIds?.length
      ? [...lead.assignedUserIds]
      : lead.assignedUserId
        ? [lead.assignedUserId]
        : (lead.assignedToList?.length
            ? lead.assignedToList
                .map((name) => staff.find((u) => u.fullName === name)?.id)
                .filter((id): id is string => Boolean(id))
            : lead.assignedTo
              ? lead.assignedTo
                  .split(/[,;/]+/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((name) => staff.find((u) => u.fullName === name)?.id)
                  .filter((id): id is string => Boolean(id))
              : []);
    setAssigneeDraftIds(ids);
    setAssigneeSearch('');
    setAssigneeEditorLeadId(lead.id);
  };

  const assigneeSelectableStaff = useMemo(
    () =>
      staff
        .filter((u) => u.isActive)
        .sort((a, b) => a.fullName.localeCompare(b.fullName, locale)),
    [staff, locale],
  );

  const assigneeDepartmentGroups = useMemo(() => {
    const q = assigneeSearch.trim().toLowerCase();
    const source = q.length
      ? assigneeSelectableStaff.filter(
          (u) =>
            u.fullName.toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q),
        )
      : assigneeSelectableStaff;
    const groups = new Map<string, StaffUser[]>();
    const noDept = t('crm.projects.detail.owner.noDepartment');
    source.forEach((u) => {
      const key = (u.department || '').trim() || noDept;
      const list = groups.get(key) || [];
      list.push(u);
      groups.set(key, list);
    });
    return Array.from(groups.entries())
      .map(([department, users]) => ({
        department,
        users: users.slice().sort((a, b) => a.fullName.localeCompare(b.fullName, locale)),
      }))
      .sort((a, b) => {
        if (a.department === noDept) return 1;
        if (b.department === noDept) return -1;
        return a.department.localeCompare(b.department, locale);
      });
  }, [assigneeSelectableStaff, assigneeSearch, t, locale]);

  const toggleAssigneeDepartment = (userIds: string[], checked: boolean) => {
    setAssigneeDraftIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...userIds]));
      }
      return current.filter((id) => !userIds.includes(id));
    });
  };

  const saveAssigneeSelection = (lead: Lead) => {
    const selected = staff.filter((u) => assigneeDraftIds.includes(u.id));
    const names = selected.map((u) => u.fullName);
    void updateLeadInline(
      lead.id,
      {
        assignedTo: names.length ? names.join(', ') : null,
        assignedUserId: selected.length ? selected[0].id : null,
        assignedUserIds: selected.length ? selected.map((u) => u.id) : [],
        assignedToList: names.length ? names : [],
      },
      {
        assignedTo: names.length ? names.join(', ') : null,
        assignedUserId: selected.length ? selected[0].id : null,
        assignedUserIds: selected.length ? selected.map((u) => u.id) : [],
        assignedToList: names.length ? names : null,
      },
    );
    setAssigneeEditorLeadId(null);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('leads_table_columns');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.order)) setColumnOrder(parsed.order);
        if (parsed.widths && typeof parsed.widths === 'object')
          setColumnWidths(parsed.widths);
        if (Array.isArray(parsed.hidden)) setHiddenColumns(parsed.hidden);
      } else {
        setHiddenColumns([
          'utmSource',
          'utmMedium',
          'utmCampaign',
          'utmTerm',
          'utmContent',
        ]);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'leads_table_columns',
        JSON.stringify({
          order: columnOrder,
          widths: columnWidths,
          hidden: hiddenColumns,
        }),
      );
    } catch {
      // ignore
    }
  }, [columnOrder, columnWidths, hiddenColumns]);

  useEffect(() => {
    if (!columns.length) return;
    setColumnOrder((prev) => {
      if (!prev.length) return columns.map((c) => c.id);
      const ids = columns.map((c) => c.id);
      const filtered = prev.filter((id) => ids.includes(id));
      const missing = ids.filter((id) => !filtered.includes(id));
      return [...filtered, ...missing];
    });
  }, [columns]);

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX;
      const next = Math.max(90, resizing.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [resizing.id]: next }));
    };
    const handleUp = () => setResizing(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [resizing]);

  useEffect(() => {
    if (!columnsOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(target)) {
        setColumnsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [columnsOpen]);

  useEffect(() => {
    if (!viewsMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (viewsMenuRef.current && !viewsMenuRef.current.contains(target)) {
        setViewsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [viewsMenuOpen]);

  useEffect(() => {
    if (!activeCustomView || activeCustomView.type !== 'table') return;
    setGroupMode(
      activeCustomView.settings?.groupMode ??
      (activeCustomView.settings?.groupByStatus ? 'status' : 'none'),
    );
    setShowArchived(activeCustomView.settings?.showArchived ?? false);
  }, [activeCustomView?.id]);

  useEffect(() => {
    if (!activeCustomView || activeCustomView.type !== 'table') return;
    const nextSettings = {
      ...activeCustomView.settings,
      groupByStatus: groupMode === 'status',
      groupMode,
      showArchived,
    };
    if (
      activeCustomView.settings?.groupMode === nextSettings.groupMode &&
      activeCustomView.settings?.showArchived === nextSettings.showArchived
    ) {
      return;
    }
    setCustomViews((prev) => updateLeadsCustomView(prev, activeCustomView.id, { settings: nextSettings }));
  }, [groupMode, showArchived, activeCustomView?.id]);

  const openView = (type: 'table' | 'kanban' | 'calendar', viewId?: string) => {
    const basePath =
      type === 'table'
        ? '/leads'
        : type === 'kanban'
          ? '/leads/board'
          : '/leads/calendar';
    navigate(viewId ? `${basePath}?view=${viewId}` : basePath);
  };

  const confirmCreateView = (name: string) => {
    setCustomViews((prev) => {
      const next = createLeadsCustomView(prev, nameModalCreateType, name);
      const created = next[next.length - 1];
      if (created) openView(nameModalCreateType, created.id);
      return next;
    });
    setViewsMenuOpen(false);
  };

  const confirmRenameView = (name: string) => {
    if (!activeCustomView) return;
    setCustomViews((prev) =>
      updateLeadsCustomView(prev, activeCustomView.id, { name: name.trim() }),
    );
    setViewsMenuOpen(false);
  };

  const startResize = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      id,
      startX: e.clientX,
      startWidth: columnWidths[id] ?? 160,
    });
  };

  const reorderColumns = useCallback((dragId: string, targetId: string) => {
    setColumnOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      return next;
    });
  }, []);

  const columnDrag = useWorkspaceStyleColumnDrag(reorderColumns, 'light', {
    useBuiltInDragImage: false,
  });
  const { draggingColumnKey: dragColId, columnDragOverKey: dropColId } = columnDrag;

  useEffect(() => {
    if (!statusOpenId) return;
    const close = () => {
      setStatusOpenId(null);
      setStatusPopoverPos(null);
    };
    const handleClick = (event: MouseEvent) => {
      if (!statusPopoverRef.current) return;
      if (!statusPopoverRef.current.contains(event.target as Node)) close();
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', close, true);
    };
  }, [statusOpenId]);

  useEffect(() => {
    if (!assigneeEditorLeadId) return;
    const handleClick = (event: MouseEvent) => {
      if (!assigneeMenuRef.current) return;
      const t = event.target as Node;
      if (assigneeMenuRef.current.contains(t)) return;
      if ((event.target as Element)?.closest?.('[data-lv-owner-popover-anchor]')) return;
      setAssigneeEditorLeadId(null);
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [assigneeEditorLeadId]);

  useLayoutEffect(() => {
    if (!assigneeEditorLeadId) {
      setAssigneePopoverLayout(null);
      return;
    }
    const el = assigneeAnchorRef.current;
    if (!el) return;
    const apply = () =>
      setAssigneePopoverLayout(
        getFixedPopoverLayout(el.getBoundingClientRect(), { popoverWidth: 420, maxScroll: 360 }),
      );
    apply();
    window.addEventListener('scroll', apply, true);
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('scroll', apply, true);
      window.removeEventListener('resize', apply);
    };
  }, [assigneeEditorLeadId, assigneeDepartmentGroups.length, assigneeSearch]);

  const filteredColumnsForPopover = useMemo(() => {
    if (!columnsSearch.trim()) return columns;
    const q = columnsSearch.toLowerCase();
    return columns.filter((c) => c.label.toLowerCase().includes(q));
  }, [columns, columnsSearch]);

  const leadStatusCls = (status: string) => {
    switch (status) {
      case 'Новый клиент':
        return 'lv-st lv-st-new';
      case 'В работе':
        return 'lv-st lv-st-progress';
      case 'Ожидает ответа':
        return 'lv-st lv-st-review';
      case 'Закрыт (успех)':
        return 'lv-st lv-st-won';
      case 'Закрыт (проигран)':
        return 'lv-st lv-st-lost';
      default:
        return 'lv-st lv-st-closed';
    }
  };

  const leadColorBarStyle = (status: string): React.CSSProperties => {
    const map: Record<string, string> = {
      'Новый клиент': '#1769d1',
      'В работе': '#3b6cb6',
      'Ожидает ответа': '#c08319',
      'Закрыт (успех)': '#1f8a5e',
      'Закрыт (проигран)': '#cc2f47',
    };
    return { background: map[status] ?? '#9a9a9a' };
  };

  const showColumn = (id: string) => {
    setHiddenColumns((prev) => prev.filter((colId) => colId !== id));
  };
  const hideColumn = (id: string) => {
    if (coreColumnIds.has(id)) return;
    setHiddenColumns((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  useEffect(() => {
    try {
      const rawGroups = localStorage.getItem(LEADS_GROUPS_KEY);
      const rawAssignments = localStorage.getItem(LEADS_GROUP_ASSIGNMENTS_KEY);
      if (rawGroups) {
        const parsed = JSON.parse(rawGroups);
        if (Array.isArray(parsed)) {
          setCustomGroups(
            parsed
              .filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string')
              .map((item, index) => ({
                id: item.id,
                name: item.name,
                order: typeof item.order === 'number' ? item.order : index,
              })),
          );
        }
      }
      if (rawAssignments) {
        const parsed = JSON.parse(rawAssignments);
        if (parsed && typeof parsed === 'object') {
          setLeadGroupMap(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LEADS_GROUPS_KEY, JSON.stringify(customGroups));
      localStorage.setItem(LEADS_GROUP_ASSIGNMENTS_KEY, JSON.stringify(leadGroupMap));
    } catch {
      // ignore
    }
  }, [customGroups, leadGroupMap]);

  const customGroupsOrdered = useMemo(
    () => [...customGroups].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, locale)),
    [customGroups, locale],
  );

  const companies = useMemo(() => Object.values(companiesMap), [companiesMap]);

  const baseFilteredLeads = useMemo(() => {
    const withoutDeleted = leads.filter((l) => !isDeletedLead(l));
    return showArchived
      ? withoutDeleted
      : withoutDeleted.filter((l) => !isArchivedLead(l));
  }, [leads, showArchived]);

  const filteredLeads = useMemo(() => {
    let result = baseFilteredLeads;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q) ||
          (l.companyId &&
            companiesMap[l.companyId]?.name?.toLowerCase().includes(q)),
      );
    }
    if (selectedCompanyId) {
      result = result.filter((l) => l.companyId === selectedCompanyId);
    }
    if (aiFilters) {
      if (aiFilters.status) result = result.filter(l => l.status === aiFilters.status);
      if (aiFilters.source) result = result.filter(l => l.source?.toLowerCase().includes(aiFilters.source!.toLowerCase()));
      if (aiFilters.channel) result = result.filter(l => (l as any).channel?.toLowerCase().includes(aiFilters.channel!.toLowerCase()));
      if (aiFilters.country) result = result.filter(l => (l as any).country?.toLowerCase().includes(aiFilters.country!.toLowerCase()));
      if (aiFilters.search) {
        const q = aiFilters.search.toLowerCase();
        result = result.filter(l => l.name?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q) || (l as any).phone?.toLowerCase().includes(q));
      }
      if (aiFilters.hasEmail === true) result = result.filter(l => Boolean(l.email?.trim()));
      if (aiFilters.hasEmail === false) result = result.filter(l => !l.email?.trim());
      if (aiFilters.hasPhone === true) result = result.filter(l => Boolean((l as any).phone?.trim()));
      if (aiFilters.hasPhone === false) result = result.filter(l => !(l as any).phone?.trim());
      if (aiFilters.createdAfter) result = result.filter(l => new Date(l.createdAt) >= new Date(aiFilters.createdAfter!));
      if (aiFilters.createdBefore) result = result.filter(l => new Date(l.createdAt) <= new Date(aiFilters.createdBefore!));
    }
    return result;
  }, [baseFilteredLeads, searchQuery, selectedCompanyId, companiesMap, aiFilters]);

  const groupedLeads = useMemo(() => {
    if (groupMode === 'none') return [];
    if (groupMode === 'status') {
      return statusOptions.map((status) => ({
        key: status,
        label: status,
        items: filteredLeads.filter((lead) => lead.status === status),
      }));
    }
    if (groupMode === 'custom') {
      const grouped = customGroupsOrdered.map((group) => ({
        key: group.id,
        label: group.name,
        items: filteredLeads.filter((lead) => leadGroupMap[lead.id] === group.id),
      }));
      const ungrouped = filteredLeads.filter((lead) => !leadGroupMap[lead.id]);
      return [
        ...grouped,
        { key: 'ungrouped', label: t('crm.leads.list.customGroups.ungrouped'), items: ungrouped },
      ];
    }

    const map = new Map<string, Lead[]>();
    filteredLeads.forEach((lead) => {
      const key =
        groupMode === 'company'
          ? lead.companyId
            ? companiesMap[lead.companyId]?.name || t('crm.leads.list.grouping.noCompany')
            : t('crm.leads.list.grouping.noCompany')
          : lead.channel || t('crm.leads.list.grouping.noChannel');
      const bucket = map.get(key) || [];
      bucket.push(lead);
      map.set(key, bucket);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], locale))
      .map(([key, items]) => ({
        key,
        label: key,
        items,
      }));
  }, [filteredLeads, statusOptions, groupMode, companiesMap, customGroupsOrdered, leadGroupMap, t, locale]);

  const ghostPreview = useCallback(
    (lead: Lead, colId: string): string => {
      switch (colId) {
        case 'name':
          return lead.name || '—';
        case 'assignee':
          return formatAssigneeDisplay(lead);
        case 'status':
          return lead.status || '—';
        case 'company':
          return lead.companyId ? companiesMap[lead.companyId]?.name ?? '—' : '—';
        case 'contact': {
          if (!lead.contactId) return '—';
          const contact = contactsMap[lead.contactId];
          return (
            contact?.fullName ||
            `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim() ||
            contact?.email ||
            '—'
          );
        }
        case 'channel':
          return lead.channel || '—';
        case 'utm':
          return formatUtm(lead);
        case 'created':
          return lead.createdAt ? new Date(lead.createdAt).toLocaleString(locale) : '—';
        default:
          return '—';
      }
    },
    [companiesMap, contactsMap, locale, formatUtm, staff],
  );

  const exportCsv = () => {
    const cols = orderedColumns.map((c) => c.label);
    const rows = filteredLeads.map((lead) =>
      orderedColumns.map((c) => {
        switch (c.id) {
          case 'name':
            return lead.name ?? '';
          case 'assignee': {
            const s = formatAssigneeDisplay(lead);
            return s === '—' ? '' : s;
          }
          case 'status':
            return lead.status ?? '';
          case 'company':
            return lead.companyId ? companiesMap[lead.companyId]?.name ?? '' : '';
          case 'contact':
            return ghostPreview(lead, 'contact');
          case 'channel':
            return lead.channel ?? '';
          case 'utm':
            return formatUtm(lead);
          case 'utmSource':
            return lead.utmSource ?? '';
          case 'utmMedium':
            return lead.utmMedium ?? '';
          case 'utmCampaign':
            return lead.utmCampaign ?? '';
          case 'utmTerm':
            return lead.utmTerm ?? '';
          case 'utmContent':
            return lead.utmContent ?? '';
          case 'created':
            return lead.createdAt ? new Date(lead.createdAt).toISOString() : '';
          default: {
            const col = c as LeadListColumn & { field?: CustomField };
            if (col.field) return String(lead.customFields?.[col.field.key] ?? '');
            return '';
          }
        }
      }),
    );
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [cols.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!dragColId) {
      setColGhost(null);
      return;
    }
    const col = orderedColumns.find((c) => c.id === dragColId);
    if (!col) return;
    const previewRows = filteredLeads.slice(0, 4).map((l) => ghostPreview(l, dragColId));
    const onMove = (e: MouseEvent) => {
      setColGhost({
        colId: dragColId,
        label: typeof col.label === 'string' ? col.label : String(col.label),
        rows: previewRows,
        x: e.clientX + 16,
        y: e.clientY + 4,
      });
    };
    window.addEventListener('dragover', onMove);
    return () => window.removeEventListener('dragover', onMove);
  }, [dragColId, orderedColumns, filteredLeads, ghostPreview]);

  const createCustomGroup = () => {
    const name = window.prompt(t('crm.leads.list.customGroups.createPrompt'));
    if (!name || !name.trim()) return;
    setCustomGroups((prev) => [
      ...prev,
      {
        id: `lg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim(),
        order: prev.length,
      },
    ]);
  };

  const renameCustomGroup = (groupId: string) => {
    const current = customGroups.find((group) => group.id === groupId);
    if (!current) return;
    const nextName = window.prompt(
      t('crm.leads.list.customGroups.renamePrompt'),
      current.name,
    );
    if (!nextName || !nextName.trim()) return;
    setCustomGroups((prev) =>
      prev.map((group) => (group.id === groupId ? { ...group, name: nextName.trim() } : group)),
    );
  };

  const deleteCustomGroup = async (groupId: string) => {
    const ok = await showConfirm(t('crm.leads.list.customGroups.deleteConfirm'), {
      title: 'Удаление',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      danger: true,
    });
    if (!ok) return;
    setCustomGroups((prev) => prev.filter((group) => group.id !== groupId));
    setLeadGroupMap((prev) => {
      const next: Record<string, string> = {};
      Object.entries(prev).forEach(([leadId, assignedGroupId]) => {
        if (assignedGroupId !== groupId) next[leadId] = assignedGroupId;
      });
      return next;
    });
    setCollapsedGroups((prev) => prev.filter((groupKey) => groupKey !== groupId));
  };

  const assignLeadGroup = (leadId: string, groupId: string) => {
    setLeadGroupMap((prev) => {
      if (!groupId) {
        const next = { ...prev };
        delete next[leadId];
        return next;
      }
      return { ...prev, [leadId]: groupId };
    });
  };

  const moveCustomGroup = (groupId: string, direction: 'up' | 'down') => {
    const ordered = [...customGroupsOrdered];
    const index = ordered.findIndex((group) => group.id === groupId);
    if (index === -1) return;
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= ordered.length) return;
    const next = [...ordered];
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    setCustomGroups(next.map((group, order) => ({ ...group, order })));
  };

  const reorderCustomGroups = (sourceGroupId: string, targetGroupId: string) => {
    if (sourceGroupId === targetGroupId) return;
    const ordered = [...customGroupsOrdered];
    const sourceIndex = ordered.findIndex((group) => group.id === sourceGroupId);
    const targetIndex = ordered.findIndex((group) => group.id === targetGroupId);
    if (sourceIndex === -1 || targetIndex === -1) return;
    const next = [...ordered];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setCustomGroups(next.map((group, order) => ({ ...group, order })));
  };

  const applyBulkStatus = async (status: LeadStatus) => {
    const ids = [...selectedLeadIds];
    setLeads((prev) =>
      prev.map((lead) =>
        ids.includes(lead.id) ? { ...lead, status } : lead,
      ),
    );
    await Promise.all(
      ids.map((id) => updateLead(id, { status }).catch(() => null)),
    );
  };

  const archiveSelected = async () => {
    const ids = [...selectedLeadIds];
    const archivedAt = new Date().toISOString();
    setLeads((prev) =>
      prev.map((lead) =>
        ids.includes(lead.id)
          ? {
              ...lead,
              meta: {
                ...(lead.meta ?? {}),
                archived: true,
                archivedAt,
              },
            }
          : lead,
      ),
    );
    await Promise.all(
      ids.map((id) =>
        updateLead(id, {
          meta: { archived: true, archivedAt },
        }).catch(() => null),
      ),
    );
    setSelectedLeadIds([]);
  };

  const deleteSelected = async () => {
    const ids = [...selectedLeadIds];
    const deletedAt = new Date().toISOString();
    setLeads((prev) =>
      prev.map((lead) =>
        ids.includes(lead.id)
          ? {
              ...lead,
              meta: {
                ...(lead.meta ?? {}),
                deleted: true,
                deletedAt,
              },
            }
          : lead,
      ),
    );
    await Promise.all(
      ids.map((id) =>
        updateLead(id, {
          meta: { deleted: true, deletedAt },
        }).catch(() => null),
      ),
    );
    setSelectedLeadIds([]);
  };

  const renderCustomFieldCell = (lead: Lead, field: CustomField) => {
    const value = lead.customFields?.[field.key];
    const commonClass =
      'w-full bg-transparent border-0 outline-none text-[12.5px] text-[#222] focus:shadow-[inset_0_0_0_1.5px_#222222]';

    if (field.type === 'boolean') {
      return (
        <label className="inline-flex items-center gap-2 text-[12px] text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => {
              const next = {
                ...(lead.customFields ?? {}),
                [field.key]: e.target.checked,
              };
              updateLeadInline(lead.id, { customFields: next }, { customFields: next });
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-3.5 h-3.5 rounded border-slate-300"
          />
          {Boolean(value) ? t('crm.leads.board.boolean.yes') : t('crm.leads.board.boolean.no')}
        </label>
      );
    }

    if (field.type === 'select') {
      return (
        <select
          className="w-full bg-transparent border-0 outline-none text-[12.5px] text-[#222] focus:shadow-[inset_0_0_0_1.5px_#222222] rounded"
          value={value ?? ''}
          onChange={(e) => {
            const next = {
              ...(lead.customFields ?? {}),
              [field.key]: e.target.value || null,
            };
            updateLeadInline(lead.id, { customFields: next }, { customFields: next });
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">—</option>
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'multiselect') {
      const arrayValue = Array.isArray(value)
        ? value.map(String)
        : typeof value === 'string' && value
          ? value.split(',').map((v) => v.trim())
          : [];
      return (
        <select
          multiple
          className={commonClass}
          value={arrayValue}
          onChange={(e) => {
            const nextValue = Array.from(e.target.selectedOptions).map((o) => o.value);
            const next = {
              ...(lead.customFields ?? {}),
              [field.key]: nextValue,
            };
            updateLeadInline(lead.id, { customFields: next }, { customFields: next });
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    const inputType =
      field.type === 'number'
        ? 'number'
        : field.type === 'email'
          ? 'email'
          : field.type === 'phone'
            ? 'tel'
            : field.type === 'date'
              ? 'date'
              : field.type === 'datetime'
                ? 'datetime-local'
                : field.type === 'url'
                  ? 'url'
                  : 'text';

    return (
      <input
        className={commonClass}
        type={inputType}
        value={value ?? ''}
        onChange={(e) => {
          setLeads((prev) =>
            prev.map((l) =>
              l.id === lead.id
                ? {
                    ...l,
                    customFields: {
                      ...(l.customFields ?? {}),
                      [field.key]: e.target.value,
                    },
                  }
                : l,
            ),
          );
        }}
        onBlur={(e) => {
          const next = {
            ...(lead.customFields ?? {}),
            [field.key]:
              field.type === 'number'
                ? e.target.value === ''
                  ? null
                  : Number(e.target.value)
                : e.target.value,
          };
          updateLeadInline(lead.id, { customFields: next }, { customFields: next });
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  };

  const renderCell = (lead: Lead, column: LeadListColumn | { id: string; label: string; field?: CustomField }) => {
    switch (column.id) {
      case 'name':
        return (
          <div className="lv-cell-name">
            <div className="lv-color-bar" style={leadColorBarStyle(lead.status)} />
            <span
              className="lv-name-text"
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => {
                const next = e.currentTarget.textContent ?? lead.name;
                updateLeadInline(lead.id, { name: next }, { name: next });
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {lead.name}
            </span>
            {groupMode === 'custom' && (
              <select
                value={leadGroupMap[lead.id] || ''}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  assignLeadGroup(lead.id, e.target.value);
                }}
                className="ml-1 rounded-md border border-[var(--line-2)] bg-white px-1.5 py-0.5 text-[10px] text-[var(--ink)] outline-none"
              >
                <option value="">{t('crm.leads.list.customGroups.ungrouped')}</option>
                {customGroupsOrdered.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      case 'assignee': {
        const assignees = resolveLeadAssignees(lead);
        const editorOpen = assigneeEditorLeadId === lead.id;
        return (
          <div className="relative" ref={editorOpen ? assigneeMenuRef : undefined}>
            <div className="lv-owners" onClick={(e) => e.stopPropagation()}>
              {assignees.map((item, idx) => {
                const label = typeof item === 'string' ? item : item.fullName;
                const avatarUrl = typeof item === 'string' ? null : item.avatarUrl;
                return (
                  <div key={`${lead.id}:${label}:${idx}`} className={`lv-ava${idx === 0 ? ' dark' : ''}`} title={label}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      initialsFromName(label)
                    )}
                  </div>
                );
              })}
              <button
                ref={editorOpen ? assigneeAnchorRef : undefined}
                type="button"
                data-lv-owner-popover-anchor
                onClick={(e) => {
                  e.stopPropagation();
                  openAssigneeEditor(lead);
                }}
                className="lv-owner-add"
                title={t('crm.projects.list.owner.edit')}
              >
                +
              </button>
            </div>
            {editorOpen && assigneePopoverLayout && (
              <div
                className="lv-owner-popover lv-owner-popover--departments lv-owner-popover--fixed"
                style={assigneePopoverLayout.style}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="lv-popover-title">{t('crm.projects.detail.owner.byDepartment')}</div>
                <div className="lv-owner-assignee-meta">
                  {t('crm.projects.detail.owner.selected', { count: assigneeDraftIds.length })}
                </div>
                <div className="lv-popover-search">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.5-4.5" />
                  </svg>
                  <input
                    autoFocus
                    value={assigneeSearch}
                    onChange={(e) => setAssigneeSearch(e.target.value)}
                    placeholder={t('crm.projects.list.owner.search')}
                  />
                </div>
                <div
                  className="lv-owner-dept-scroll"
                  style={{ maxHeight: assigneePopoverLayout.scrollMaxHeight }}
                >
                  {assigneeDepartmentGroups.map((group) => {
                    const groupIds = group.users.map((u) => u.id);
                    const selectedInGroup = groupIds.filter((id) => assigneeDraftIds.includes(id)).length;
                    const allChecked =
                      selectedInGroup > 0 && selectedInGroup === groupIds.length;
                    return (
                      <div key={group.department} className="lv-owner-dept-card">
                        <div className="lv-owner-dept-head">
                          <div className="lv-owner-dept-name" title={group.department}>
                            {group.department}
                          </div>
                          <label className="lv-owner-dept-all">
                            <input
                              type="checkbox"
                              checked={allChecked}
                              onChange={(e) =>
                                toggleAssigneeDepartment(groupIds, e.target.checked)
                              }
                            />
                            <span>{t('crm.projects.detail.owner.wholeDepartment')}</span>
                          </label>
                        </div>
                        <div className="lv-owner-dept-users">
                          {group.users.map((u) => {
                            const checked = assigneeDraftIds.includes(u.id);
                            return (
                              <label key={u.id} className="lv-owner-dept-user-row">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const on = e.target.checked;
                                    setAssigneeDraftIds((prev) =>
                                      on
                                        ? prev.includes(u.id)
                                          ? prev
                                          : [...prev, u.id]
                                        : prev.filter((x) => x !== u.id),
                                    );
                                  }}
                                />
                                <span className="lv-owner-dept-user-label">
                                  {u.fullName}
                                  {u.email ? ` · ${u.email}` : ''}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {!assigneeDepartmentGroups.length && (
                    <div className="lv-owner-dept-empty">{t('crm.projects.list.owner.empty')}</div>
                  )}
                </div>
                <div className="lv-owner-pop-foot">
                  <button type="button" className="lv-tb-btn" onClick={() => setAssigneeEditorLeadId(null)}>
                    {t('crm.common.cancel')}
                  </button>
                  <button
                    type="button"
                    className="lv-tb-btn"
                    style={{ background: '#222', color: '#fff', borderColor: '#222' }}
                    onClick={() => saveAssigneeSelection(lead)}
                  >
                    {t('crm.common.save')}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'company':
        return (
          <WorkspaceCrmEntityMultiField
            entity="company"
            rawValue={lead.companyId ?? ''}
            leads={[]}
            projects={[]}
            companies={companies}
            variant="table"
            hideAddButton
            onCommit={(serialized) => {
              const ids = parseCrmEntityIdsFromCell(serialized);
              const cid = ids[0] ?? null;
              void (async () => {
                if (cid && !companies.some((c) => c.id === cid)) {
                  try {
                    const comp = await fetchCompany(cid);
                    setCompaniesMap((prev) => ({ ...prev, [cid]: comp }));
                  } catch {
                    /* ignore */
                  }
                }
                await updateLeadInline(lead.id, { companyId: cid }, { companyId: cid });
              })();
            }}
          />
        );
      case 'contact': {
        if (!lead.contactId) {
          return <span className="lv-cell-empty">{t('crm.leads.list.emptyValue')}</span>;
        }
        const contact = contactsMap[lead.contactId];
        const fullName =
          contact?.fullName ||
          `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim() ||
          contact?.email ||
          t('crm.leads.list.actions.openContact');
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/app/contacts/${lead.contactId}`);
            }}
            className="lv-cell-pill"
          >
            <span className="dot" style={{ background: '#60a5fa' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName}</span>
          </button>
        );
      }
      case 'channel':
        return (
          <input
            value={lead.channel}
            onChange={(e) =>
              setLeads((prev) =>
                prev.map((l) =>
                  l.id === lead.id ? { ...l, channel: e.target.value } : l,
                ),
              )
            }
            onBlur={(e) =>
              updateLeadInline(
                lead.id,
                { channel: e.target.value },
                { source: e.target.value || null },
              )
            }
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-transparent border-0 outline-none text-[12.5px] text-[#222] focus:shadow-[inset_0_0_0_1.5px_#222222]"
          />
        );
      case 'utm':
        return <span className="text-[12.5px] text-[var(--ink)]">{formatUtm(lead)}</span>;
      case 'utmSource':
        return <span className="text-[12.5px] text-[var(--ink)]">{lead.utmSource || t('crm.leads.list.emptyValue')}</span>;
      case 'utmMedium':
        return <span className="text-[12.5px] text-[var(--ink)]">{lead.utmMedium || t('crm.leads.list.emptyValue')}</span>;
      case 'utmCampaign':
        return <span className="text-[12.5px] text-[var(--ink)]">{lead.utmCampaign || t('crm.leads.list.emptyValue')}</span>;
      case 'utmTerm':
        return <span className="text-[12.5px] text-[var(--ink)]">{lead.utmTerm || t('crm.leads.list.emptyValue')}</span>;
      case 'utmContent':
        return <span className="text-[12.5px] text-[var(--ink)]">{lead.utmContent || t('crm.leads.list.emptyValue')}</span>;
      case 'status': {
        const isOpen = statusOpenId === lead.id;
        return (
          <div>
            <button
              type="button"
              className={leadStatusCls(lead.status)}
              onClick={(e) => {
                e.stopPropagation();
                if (isOpen) {
                  setStatusOpenId(null);
                  setStatusPopoverPos(null);
                } else {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setStatusPopoverPos({ top: rect.bottom + 6, left: rect.left });
                  setStatusOpenId(lead.id);
                }
              }}
            >
              <span className="dot" />
              {lead.status}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ opacity: 0.6 }}><path d="M6 9l6 6 6-6"/></svg>
            </button>
          </div>
        );
      }
      case 'created': {
        const dateStr = lead.createdAt ? String(lead.createdAt) : '';
        if (!dateStr) return <span className="lv-cell-date">—</span>;
        const [datePart, timePart] = dateStr.includes('T') ? dateStr.split('T') : [dateStr, ''];
        return (
          <span className="lv-cell-date">
            {datePart}
            {timePart && <span className="time"> {timePart.slice(0, 5)}</span>}
          </span>
        );
      }
      default:
        if ('field' in column && column.field) return renderCustomFieldCell(lead, column.field);
        return null;
    }
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchLeads()
      .then((items) => {
        if (!alive) return;
        // fetchLeads уже возвращает Lead[]
        setLeads(items);
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.leads.list.errors.loadFailed'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchStaff()
      .then((users) => {
        if (!alive) return;
        setStaff(users);
      })
      .catch(() => {
        if (!alive) return;
        setStaff([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchCustomFields('lead')
      .then((items) => {
        if (!alive) return;
        setCustomFields([...items].sort((a, b) => a.order - b.order));
      })
      .catch((e) => console.error('Failed to load lead custom fields:', e));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchCompanies({ limit: 500 })
      .then((res) => {
        if (!alive) return;
        const map: Record<string, Company> = {};
        res.items.forEach((company) => {
          map[company.id] = company;
        });
        setCompaniesMap(map);
      })
      .catch(() => {
        // non-blocking
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchContacts({ limit: 500 })
      .then((res) => {
        if (!alive) return;
        const map: Record<string, Contact> = {};
        res.items.forEach((contact) => {
          map[contact.id] = contact;
        });
        setContactsMap(map);
      })
      .catch(() => {
        // non-blocking
      });
    return () => {
      alive = false;
    };
  }, []);

  const viewQs = activeViewId ? `?view=${encodeURIComponent(activeViewId)}` : '';

  const renderLeadRow = (lead: Lead) => {
    const isSelected = selectedLeadIds.includes(lead.id);
    return (
      <tr
        key={lead.id}
        className={`lv-proj-row${isSelected ? ' selected' : ''}`}
        onClick={() => handleOpenLead(lead.id)}
        draggable={groupMode === 'custom'}
        onDragStart={(e) => {
          if (groupMode !== 'custom') return;
          setDraggingLeadId(lead.id);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', lead.id);
        }}
        onDragEnd={() => {
          setDraggingLeadId(null);
          setDragOverGroupKey(null);
        }}
      >
        <td className="lv-col-check" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`lv-checkbox${isSelected ? ' checked' : ''}`}
            onClick={() => toggleSelected(lead.id)}
            role="checkbox"
            aria-checked={isSelected}
          >
            {isSelected && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12l4 4 10-10" />
              </svg>
            )}
          </button>
        </td>
        {orderedColumns.map((col) => {
          const width = getColumnWidth(col.id, getFallbackColumnWidth(col.id));
          const isDragging = dragColId === col.id;
          const isDropTarget = dropColId === col.id && !isDragging;
          return (
            <td
              key={col.id}
              className={[
                isDragging ? 'lv-col-dragging-td' : '',
                isDropTarget ? 'lv-col-drop-target-td' : '',
                ['status', 'company', 'name', 'assignee', 'contact', 'channel'].includes(col.id)
                  ? 'lv-td-popover'
                  : '',
                col.id === 'name' ? 'lv-tcol-name' : 'lv-tcol-center',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                width,
                minWidth: width,
                maxWidth: width,
                padding: '10px 14px',
                borderBottom: '1px solid var(--line-3)',
                verticalAlign: 'middle',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {renderCell(lead, col)}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <MainLayout>
      <ViewNameModal
        open={nameModalOpen}
        title={
          nameModalMode === 'rename'
            ? t('crm.leads.board.menu.renameViewModalTitle')
            : nameModalCreateType === 'table'
              ? t('crm.leads.board.menu.createTableModalTitle')
              : nameModalCreateType === 'calendar'
                ? t('crm.leads.board.menu.createCalendarModalTitle')
                : t('crm.leads.board.menu.createKanbanModalTitle')
        }
        label={t('crm.leads.board.menu.viewNamePrompt')}
        initialValue={nameModalMode === 'rename' && activeCustomView ? activeCustomView.name : ''}
        confirmLabel={
          nameModalMode === 'rename'
            ? t('crm.common.save')
            : t('crm.leads.board.menu.viewModalConfirmCreate')
        }
        cancelLabel={t('crm.common.cancel')}
        onClose={() => setNameModalOpen(false)}
        onConfirm={(name) => {
          if (nameModalMode === 'rename') confirmRenameView(name);
          else confirmCreateView(name);
        }}
      />
      <div className="lv-pt w-full pb-8 min-w-0" style={{ marginLeft: -24, marginRight: -24, paddingLeft: 24, paddingRight: 24, width: 'calc(100% + 48px)' }}>
        <div className="lv-pt-head">
          <div>
            <h1>{t('crm.leads.list.title')}</h1>
            <div className="sub">{t('crm.leads.list.subtitle')}</div>
          </div>
          <div className="lv-pt-head-actions">
            <button type="button" className="lv-tb-btn" onClick={() => setAutomationOpen(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
              </svg>
              {t('crm.automations.panel.button')}
            </button>
            <button type="button" onClick={handleCreateLead} className="lv-tb-btn" style={{ background: '#222', color: '#fff', borderColor: '#222', borderRadius: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t('crm.leads.list.create')}
            </button>
          </div>
        </div>

        <div className="lv-view-tabs">
          <button type="button" className="lv-view-tab active" onClick={() => navigate(`/leads${viewQs}`)}>
            {t('crm.leads.list.viewList')}
            <span className="badge">{filteredLeads.length}</span>
          </button>
          <button type="button" className="lv-view-tab" onClick={goBoard}>
            {t('crm.leads.list.viewKanban')}
          </button>
          <button type="button" className="lv-view-tab" onClick={goCalendar}>
            {calendarLabel}
          </button>
          {customViews.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => openView(view.type, view.id)}
              className={`group lv-view-tab${activeCustomView?.id === view.id ? ' active' : ''}`}
            >
              {view.name}
              {activeCustomView?.id === view.id && (
                <span
                  role="button"
                  tabIndex={0}
                  className="lv-view-tab-menu-btn visible"
                  aria-label="menu"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewsMenuOpen((v) => !v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      setViewsMenuOpen((v) => !v);
                    }
                  }}
                >
                  ⋯
                </span>
              )}
            </button>
          ))}
          <div className="relative" ref={viewsMenuRef}>
            <button type="button" className="lv-view-tabs-add" onClick={() => setViewsMenuOpen((v) => !v)} title="…">
              +
            </button>
            {viewsMenuOpen && (
              <div className="lv-popover" style={{ top: 'calc(100% + 6px)', left: 0, zIndex: 40 }}>
                <div className="lv-popover-title">{t('crm.leads.board.pageTitle')}</div>
                <button
                  type="button"
                  className="lv-st-popover-item"
                  onClick={() => {
                    setNameModalCreateType('table');
                    setNameModalMode('create');
                    setNameModalOpen(true);
                    setViewsMenuOpen(false);
                  }}
                >
                  {menuCreateTable}
                </button>
                <button
                  type="button"
                  className="lv-st-popover-item"
                  onClick={() => {
                    setNameModalCreateType('kanban');
                    setNameModalMode('create');
                    setNameModalOpen(true);
                    setViewsMenuOpen(false);
                  }}
                >
                  {menuCreateKanban}
                </button>
                <button
                  type="button"
                  className="lv-st-popover-item"
                  onClick={() => {
                    setNameModalCreateType('calendar');
                    setNameModalMode('create');
                    setNameModalOpen(true);
                    setViewsMenuOpen(false);
                  }}
                >
                  {menuCreateCalendar}
                </button>
                {activeCustomView ? (
                  <>
                    <div style={{ borderTop: '1px solid var(--line-2)', margin: '6px 0' }} />
                    <button
                      type="button"
                      className="lv-st-popover-item"
                      onClick={() => {
                        setNameModalMode('rename');
                        setNameModalOpen(true);
                        setViewsMenuOpen(false);
                      }}
                    >
                      {menuRename}
                    </button>
                    <button
                      type="button"
                      className="lv-st-popover-item"
                      style={{ color: '#9a1f31' }}
                      onClick={async () => {
                        setViewsMenuOpen(false);
                        const ok = await showConfirm(t('crm.leads.board.deleteViewConfirm', { defaultValue: 'Удалить вид? Действие необратимо.' }), {
                          title: 'Удаление',
                          confirmLabel: 'Удалить',
                          cancelLabel: 'Отмена',
                          danger: true,
                        });
                        if (!ok) return;
                        setCustomViews((prev) => deleteLeadsCustomView(prev, activeCustomView.id));
                        navigate('/leads');
                      }}
                    >
                      {menuDelete}
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-[8px] px-3 py-2 mb-[14px]">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-[12px] text-slate-400 mb-[14px]">
            {t('crm.leads.list.loading')}
          </div>
        )}

        {!loading && (
          <>
            <div className="lv-toolbar">
              <div className="lv-tb-search" style={{ flex: '1 1 180px', maxWidth: 300 }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--fg-4)', flexShrink: 0 }} aria-hidden>
                  <circle cx="6.5" cy="6.5" r="5.5" />
                  <path d="M11 11l3.5 3.5" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('crm.leads.list.search')}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--fg-3)', fontSize: 14, padding: 0, lineHeight: 1 }}>
                    ×
                  </button>
                )}
              </div>

              <div className="lv-toolbar-divider" />

              {/* AI Smart Search */}
              <AiSmartSearchBar
                active={aiFilters !== null}
                onFilters={(filters, desc) => { setAiFilters(filters); setAiFilterDesc(desc); }}
                onClear={() => { setAiFilters(null); setAiFilterDesc(''); }}
              />

              {/* AI Duplicates */}
              <button
                type="button"
                onClick={() => setDuplicatesOpen(true)}
                title="Найти дубли лидов"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 500, border: '1px solid #e0e0e0', background: '#fff', color: '#555', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.color = '#7c3aed'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.color = '#555'; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
                Дубли
              </button>

              <div className="lv-toolbar-divider" />

              <label className="lv-tb-select">
                <span className="lbl">{t('crm.leads.list.groupMode.label')}:</span>
                <select
                  value={groupMode}
                  onChange={(e) => setGroupMode(e.target.value as 'status' | 'company' | 'channel' | 'none' | 'custom')}
                >
                  <option value="status">{t('crm.leads.list.groupMode.status')}</option>
                  <option value="company">{t('crm.leads.list.groupMode.company')}</option>
                  <option value="channel">{t('crm.leads.list.groupMode.channel')}</option>
                  <option value="custom">{t('crm.leads.list.groupMode.custom')}</option>
                  <option value="none">{t('crm.leads.list.groupMode.none')}</option>
                </select>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--fg-3)', flexShrink: 0 }} aria-hidden>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </label>

              <label className="lv-tb-select">
                <span className="lbl">{t('crm.leads.list.filters.companyLabel')}:</span>
                <select value={selectedCompanyId || ''} onChange={(e) => setSelectedCompanyId(e.target.value || null)} style={{ maxWidth: 160 }}>
                  <option value="">{t('crm.leads.list.filters.allCompanies')}</option>
                  {companies
                    .filter((c) => c.name)
                    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--fg-3)', flexShrink: 0 }} aria-hidden>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </label>

              {groupMode === 'custom' && (
                <>
                  <div className="lv-toolbar-divider" />
                  <button type="button" className="lv-tb-btn" onClick={createCustomGroup}>
                    + {t('crm.leads.list.customGroups.add')}
                  </button>
                  {customGroupsOrdered.map((group) => (
                    <div
                      key={group.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggingGroupId(group.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', group.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverGroupId(group.id);
                      }}
                      onDragLeave={() => {
                        setDragOverGroupId((prev) => (prev === group.id ? null : prev));
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!draggingGroupId) return;
                        reorderCustomGroups(draggingGroupId, group.id);
                        setDraggingGroupId(null);
                        setDragOverGroupId(null);
                      }}
                      onDragEnd={() => {
                        setDraggingGroupId(null);
                        setDragOverGroupId(null);
                      }}
                      className="lv-tb-btn"
                      style={{
                        borderColor: dragOverGroupId === group.id ? 'var(--ink)' : undefined,
                      }}
                    >
                      <span style={{ fontSize: 11 }}>{group.name}</span>
                      <button type="button" className="lv-tb-btn" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => moveCustomGroup(group.id, 'up')}>
                        ↑
                      </button>
                      <button type="button" className="lv-tb-btn" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => moveCustomGroup(group.id, 'down')}>
                        ↓
                      </button>
                      <button type="button" className="lv-tb-btn" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => renameCustomGroup(group.id)}>
                        {t('crm.leads.list.customGroups.renameShort')}
                      </button>
                      <button type="button" className="lv-tb-btn" style={{ padding: '2px 6px', fontSize: 10, color: '#9a1f31' }} onClick={() => void deleteCustomGroup(group.id)}>
                        {t('crm.leads.list.customGroups.deleteShort')}
                      </button>
                    </div>
                  ))}
                </>
              )}

              <button
                type="button"
                className={`lv-tb-btn${showArchived ? ' active' : ''}`}
                onClick={() => setShowArchived((prev) => !prev)}
              >
                {t('crm.leads.list.showArchived')}
              </button>

              <div className="lv-toolbar-spacer" />

              <button type="button" className="lv-tb-btn" title={t('crm.leads.list.export')} onClick={exportCsv}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M14 10v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3M8 1v9M5 7l3 3 3-3" />
                </svg>
                {t('crm.leads.list.export')}
              </button>

              <button
                type="button"
                className="lv-tb-btn"
                title="Import leads from CSV"
                onClick={() => setCsvImportOpen(true)}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M14 10v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3M8 14V5M5 8l3-3 3 3" />
                </svg>
                Import CSV
              </button>

              <div style={{ position: 'relative' }} ref={columnsMenuRef}>
                <button type="button" className={`lv-tb-btn${columnsOpen ? ' active' : ''}`} onClick={() => setColumnsOpen((prev) => !prev)}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                    <path d="M1 4h14M1 8h14M1 12h14" />
                  </svg>
                  {t('crm.leads.list.columns.label')}
                  <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--fg-4)', marginLeft: 2 }}>
                    {visibleColumns.length}/{columns.length}
                  </span>
                </button>
                {columnsOpen && (
                  <div className="lv-popover" style={{ top: 'calc(100% + 6px)', right: 0 }}>
                    <div className="lv-popover-title">{t('crm.leads.list.columns.label')}</div>
                    <div className="lv-popover-search">
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--fg-4)' }} aria-hidden>
                        <circle cx="5.5" cy="5.5" r="4.5" />
                        <path d="M9.5 9.5L13 13" />
                      </svg>
                      <input
                        type="text"
                        value={columnsSearch}
                        onChange={(e) => setColumnsSearch(e.target.value)}
                        placeholder={t('crm.projects.list.columns.search', 'Поиск колонки...')}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="lv-popover-list">
                      {filteredColumnsForPopover.map((col) => {
                        const checked = !hiddenColumns.includes(col.id);
                        const isCore = coreColumnIds.has(col.id);
                        return (
                          <label key={col.id} className="lv-popover-item" style={{ cursor: 'pointer' }}>
                            <span style={{ color: 'var(--fg-4)', fontSize: 11, fontFamily: 'var(--ff-mono)', userSelect: 'none', opacity: isCore ? 0.3 : 1 }}>⋮⋮</span>
                            <span style={{ flex: 1, color: 'var(--ink)' }}>{col.label}</span>
                            {isCore && (
                              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--fg-4)', border: '1px solid var(--line-2)', borderRadius: 3, padding: '1px 4px' }}>Core</span>
                            )}
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isCore}
                              onChange={(e) => {
                                if (e.target.checked) showColumn(col.id);
                                else hideColumn(col.id);
                              }}
                              style={{ width: 14, height: 14, flexShrink: 0 }}
                            />
                          </label>
                        );
                      })}
                    </div>
                    <div className="lv-popover-foot">
                      <button type="button" className="lv-popover-link" onClick={() => { setColumnsOpen(false); setCustomFieldsOpen(true); }}>
                        {t('crm.leads.list.columns.add')}
                      </button>
                      <button type="button" className="lv-tb-btn" onClick={() => setColumnsOpen(false)}>
                        {t('crm.common.done', 'Готово')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {(searchQuery || selectedCompanyId || aiFilters) && (
              <div className="lv-filter-strip">
                {searchQuery && (
                  <span className="lv-filter-chip">
                    <span className="key">{t('crm.leads.list.search')}:</span>
                    <span className="val">«{searchQuery}»</span>
                    <button type="button" className="x" onClick={() => setSearchQuery('')}>×</button>
                  </span>
                )}
                {selectedCompanyId && (
                  <span className="lv-filter-chip">
                    <span className="key">{t('crm.leads.list.filters.companyLabel')}</span>
                    <span className="val">{companiesMap[selectedCompanyId]?.name ?? selectedCompanyId}</span>
                    <button type="button" className="x" onClick={() => setSelectedCompanyId(null)}>×</button>
                  </span>
                )}
                {aiFilters && (
                  <span className="lv-filter-chip" style={{ background: '#f5f3ff', borderColor: '#7c3aed40', color: '#7c3aed' }}>
                    <span style={{ fontSize: 10 }}>✦</span>
                    <span className="val" style={{ color: '#7c3aed' }}>{aiFilterDesc}</span>
                    <span style={{ fontSize: 9, color: '#888', }}>({filteredLeads.length})</span>
                    <button type="button" className="x" onClick={() => { setAiFilters(null); setAiFilterDesc(''); }}>×</button>
                  </span>
                )}
              </div>
            )}

            <div className="lv-proj-wrap">
              <div className="lv-proj-scroll">
                <table className="lv-proj-table lv-leads-table">
                  <thead>
                    <tr>
                      <th className="lv-col-check">
                        <button
                          type="button"
                          className={`lv-checkbox${filteredLeads.length > 0 && selectedLeadIds.length === filteredLeads.length ? ' checked' : selectedLeadIds.length > 0 ? ' indet' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAllSelected(filteredLeads);
                          }}
                          role="checkbox"
                          aria-checked={filteredLeads.length > 0 && selectedLeadIds.length === filteredLeads.length}
                        >
                          {selectedLeadIds.length > 0 && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M5 12l4 4 10-10" />
                            </svg>
                          )}
                        </button>
                      </th>
                      {orderedColumns.map((col) => {
                        const width = getColumnWidth(col.id, getFallbackColumnWidth(col.id));
                        const isDragging = dragColId === col.id;
                        const isDropTarget = dropColId === col.id && !isDragging;
                        return (
                          <th
                            key={col.id}
                            {...(() => {
                              const props = columnDrag.getThProps(col.id, typeof col.label === 'string' ? col.label : String(col.label), '');
                              const { className: _cls, ...rest } = props as any;
                              return rest;
                            })()}
                            style={{ width, minWidth: width }}
                            className={[
                              isDragging ? 'lv-col-dragging' : '',
                              isDropTarget ? 'lv-col-drop-target' : '',
                              col.id === 'name' ? 'lv-tcol-name' : 'lv-tcol-center',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            <span className="lv-th-inner">
                              <span className="lv-th-grip">⋮⋮</span>
                              {col.label}
                            </span>
                            <span className="lv-th-resize" onMouseDown={(e) => startResize(col.id, e)} />
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {groupMode !== 'none'
                      ? groupedLeads.map((group) => {
                          const isCollapsed = collapsedGroups.includes(group.key);
                          if (!group.items.length) return null;
                          return (
                            <React.Fragment key={group.key}>
                              <tr
                                className="lv-proj-group-row"
                                style={
                                  groupMode === 'custom' && dragOverGroupKey === group.key
                                    ? { boxShadow: 'inset 0 0 0 2px rgba(59, 130, 246, 0.35)' }
                                    : undefined
                                }
                                onDragOver={(e) => {
                                  if (groupMode !== 'custom' || !draggingLeadId) return;
                                  e.preventDefault();
                                  setDragOverGroupKey(group.key);
                                }}
                                onDragLeave={() => {
                                  if (groupMode !== 'custom') return;
                                  setDragOverGroupKey((prev) => (prev === group.key ? null : prev));
                                }}
                                onDrop={(e) => {
                                  if (groupMode !== 'custom' || !draggingLeadId) return;
                                  e.preventDefault();
                                  assignLeadGroup(draggingLeadId, group.key === 'ungrouped' ? '' : group.key);
                                  setDraggingLeadId(null);
                                  setDragOverGroupKey(null);
                                }}
                              >
                                <td colSpan={orderedColumns.length + 1}>
                                  <div className="lv-proj-group-inner">
                                    <button type="button" className={`lv-group-toggle${isCollapsed ? ' collapsed' : ''}`} onClick={() => toggleCollapsed(group.key)}>
                                      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
                                        <path d="M2.5 4.5L6 8L9.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    </button>
                                    {groupMode === 'status' ? (
                                      <span className={leadStatusCls(group.key)} style={{ cursor: 'default', pointerEvents: 'none' }}>
                                        <span className="dot" />
                                        {group.label}
                                      </span>
                                    ) : (
                                      <span style={{ fontWeight: 500, fontSize: 12.5, color: 'var(--ink)' }}>{group.label}</span>
                                    )}
                                    <span className="lv-group-meta">
                                      {t('crm.leads.list.groupSummary', { count: group.items.length })}
                                    </span>
                                    <button type="button" className="lv-group-add" onClick={handleCreateLead}>
                                      + {t('crm.leads.list.create')}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {!isCollapsed && group.items.map((lead) => renderLeadRow(lead))}
                            </React.Fragment>
                          );
                        })
                      : filteredLeads.map((lead) => renderLeadRow(lead))}

                    {!filteredLeads.length && !error && (
                      <tr>
                        <td colSpan={orderedColumns.length + 1} style={{ padding: '32px 14px', textAlign: 'center', fontSize: 12, color: 'var(--fg-3)' }}>
                          {t('crm.leads.list.empty')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="lv-proj-foot">
                <div className="lv-proj-foot-stats">
                  <span>
                    <span className="lbl">{t('crm.leads.list.footerTotal', 'Всего')}:</span>
                    <strong>{filteredLeads.length}</strong>
                  </span>
                </div>
                <div style={{ color: 'var(--fg-3)', fontSize: 11.5 }}>
                  {t('crm.projects.list.summary.updated', 'Обновлено только что')}
                </div>
              </div>
            </div>
          </>
        )}

        {statusOpenId && statusPopoverPos && (
          <div
            ref={statusPopoverRef}
            className="lv-st-popover"
            style={{ position: 'fixed', top: statusPopoverPos.top, left: statusPopoverPos.left, zIndex: 60 }}
            onClick={(e) => e.stopPropagation()}
          >
            {statusOptions.map((st) => (
              <button
                key={st}
                type="button"
                className="lv-st-popover-item"
                onClick={() => {
                  updateLeadInline(statusOpenId, { status: st }, { status: st });
                  setStatusOpenId(null);
                  setStatusPopoverPos(null);
                }}
              >
                <span className={leadStatusCls(st)} style={{ pointerEvents: 'none' }}>
                  <span className="dot" />
                  {st}
                </span>
              </button>
            ))}
          </div>
        )}

        {colGhost && (
          <div className="lv-col-ghost" style={{ left: colGhost.x, top: colGhost.y, minWidth: 140, maxWidth: 220 }}>
            <div className="lv-col-ghost-head">
              <span style={{ fontSize: 11 }}>⋮⋮</span>
              {colGhost.label}
            </div>
            {colGhost.rows.map((row, i) => (
              <div key={i} className="lv-col-ghost-row">
                {row}
              </div>
            ))}
            {filteredLeads.length > 4 && (
              <div
                className="lv-col-ghost-row"
                style={{
                  color: 'var(--fg-3)',
                  fontFamily: 'var(--ff-mono)',
                  fontSize: 10,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                +{filteredLeads.length - 4}
              </div>
            )}
          </div>
        )}

        {groupMode === 'custom' && draggingLeadId && (
          <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700 shadow-xl">
            {dragOverGroupKey
              ? t('crm.leads.list.customGroups.moveTo', {
                  group: groupedLeads.find((g) => g.key === dragOverGroupKey)?.label || t('crm.leads.list.customGroups.ungrouped'),
                })
              : t('crm.leads.list.customGroups.dragHint')}
          </div>
        )}

        {selectedLeadIds.length > 0 && (
          <div className="lv-bulk-bar">
            <div className="lv-bulk-count">
              <strong>{selectedLeadIds.length}</strong> {t('crm.leads.list.bulk.selected', { count: selectedLeadIds.length })}
            </div>
            <div className="lv-bulk-divider" />
            <button type="button" className="lv-bulk-btn" style={{ position: 'relative' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 4h16v4H4z" />
                <path d="M4 8l2 12h12l2-12" />
                <path d="M10 12h4" />
              </svg>
              {t('crm.leads.list.bulk.status')}
              <select
                value={bulkStatus}
                onChange={(e) => {
                  const val = e.target.value as LeadStatus | '';
                  if (val) {
                    applyBulkStatus(val);
                    setBulkStatus('');
                  }
                }}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">—</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </button>
            <div className="lv-bulk-divider" />
            <button type="button" className="lv-bulk-btn" onClick={archiveSelected}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="4" width="18" height="4" rx="1" />
                <rect x="3" y="10" width="18" height="10" rx="1" />
                <path d="M8 14h8" />
              </svg>
              {t('crm.leads.list.bulk.archive')}
            </button>
            <button type="button" className="lv-bulk-btn danger" onClick={deleteSelected}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 6h18M8 6V4h8v2" />
                <rect x="6" y="6" width="12" height="14" rx="1" />
                <path d="M10 11v6M14 11v6" />
              </svg>
              {t('crm.leads.list.bulk.delete')}
            </button>
            <div className="lv-bulk-divider" />
            <button type="button" className="lv-bulk-close" onClick={() => setSelectedLeadIds([])}>
              ×
            </button>
          </div>
        )}
      </div>
      {customFieldsOpen && (
        <CustomFieldsManager
          entityType="lead"
          title={t('crm.leads.board.customFieldsTitle')}
          suggestedKeys={suggestedKeys}
          onClose={() => setCustomFieldsOpen(false)}
          onUpdated={(items) =>
            setCustomFields([...items].sort((a, b) => a.order - b.order))
          }
        />
      )}
      <AutomationPanel
        open={automationOpen}
        onClose={() => setAutomationOpen(false)}
        entityType="lead"
      />

      {duplicatesOpen && (
        <AiDuplicatesModal onClose={() => setDuplicatesOpen(false)} />
      )}

      <LeadsCsvImportModal
        open={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
        onImported={() => {
          setCsvImportOpen(false);
          // Reload leads after import
          setLoading(true);
          fetchLeads()
            .then((data) => setLeads(data))
            .catch(() => {})
            .finally(() => setLoading(false));
        }}
      />
    </MainLayout>
  );
};
