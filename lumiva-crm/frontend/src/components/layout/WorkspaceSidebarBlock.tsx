import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  deleteCustomObject,
  duplicateCustomObject,
  fetchCustomObjects,
  updateCustomObject,
  type CustomObject,
} from '../../api/customObjects';
import {
  NavChevronDown,
  NavIconDots,
  NavIconFolder,
  NavIconPlus,
  NAV_ICON_MAP,
} from './NavSidebarIcons';
import {
  addEnabledView,
  parseEnabledViews,
  type ExtraWorkspaceViewKey,
} from '../../workspace/workspaceEnabledViews';

type Props = {
  enabled: boolean;
  onMobileNavigate?: () => void;
  /** Узкий сайдбар: только иконки */
  compact?: boolean;
};

const MENU_W = 208;
const MENU_H = 340;
const PLUS_MENU_W = 220;
const PLUS_MENU_H = 280;

const PLUS_MENU_EXTRA_VIEWS: Array<{
  key: ExtraWorkspaceViewKey;
  iconClass: string;
}> = [
  { key: 'kanban', iconClass: 'text-teal-600' },
  { key: 'calendar', iconClass: 'text-violet-600' },
  { key: 'analytics', iconClass: 'text-sky-600' },
];

const COLLAPSED_CAT_STORAGE = 'lumiva_workspace_collapsed_categories';
const UNCATEGORIZED_KEY = '__uncategorized__';

const CATEGORY_PRESET_KEYS = [
  'leads',
  'sales',
  'projects',
  'marketing',
  'finance',
  'other',
] as const;

function readCollapsedCategories(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_CAT_STORAGE);
    if (!raw) return new Set();
    const a = JSON.parse(raw) as unknown;
    if (!Array.isArray(a)) return new Set();
    return new Set(a.map(String));
  } catch {
    return new Set();
  }
}

function workspaceCategoryStorageKey(obj: CustomObject): string {
  const c = obj.meta?.sidebarCategory;
  if (typeof c === 'string' && c.trim()) return c.trim();
  return UNCATEGORIZED_KEY;
}

function placeFixedMenu(
  anchor: DOMRect,
  menuW: number,
  menuH: number,
): { top: number; left: number } {
  let left = anchor.right - menuW;
  left = Math.min(Math.max(8, left), window.innerWidth - menuW - 8);
  let top = anchor.bottom + 6;
  if (top + menuH > window.innerHeight - 8) {
    top = anchor.top - menuH - 6;
  }
  top = Math.max(8, Math.min(top, window.innerHeight - menuH - 8));
  return { top, left };
}

function sortWorkspaceObjects(list: CustomObject[]): CustomObject[] {
  return [...list].sort((a, b) => {
    const ra = typeof a.meta?.sidebarRank === 'number' ? a.meta.sidebarRank : null;
    const rb = typeof b.meta?.sidebarRank === 'number' ? b.meta.sidebarRank : null;
    if (ra !== null && rb !== null) return ra - rb;
    if (ra !== null) return -1;
    if (rb !== null) return 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export const WorkspaceSidebarBlock: React.FC<Props> = ({
  enabled,
  onMobileNavigate,
  compact = false,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [objects, setObjects] = useState<CustomObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [dotsMenu, setDotsMenu] = useState<{ id: string; top: number; left: number } | null>(
    null,
  );
  const [plusMenu, setPlusMenu] = useState<{ id: string; top: number; left: number } | null>(
    null,
  );
  const [renameTarget, setRenameTarget] = useState<CustomObject | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomObject | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [plusEnablingKey, setPlusEnablingKey] = useState<ExtraWorkspaceViewKey | null>(null);
  const plusEnablingRef = useRef(false);
  const createRef = useRef<HTMLDivElement | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(readCollapsedCategories);
  const [hiddenSectionOpen, setHiddenSectionOpen] = useState(false);
  const [categoryTarget, setCategoryTarget] = useState<CustomObject | null>(null);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [categorySaving, setCategorySaving] = useState(false);

  const closeOverlays = useCallback(() => {
    setDotsMenu(null);
    setPlusMenu(null);
  }, []);

  const persistCollapsedCategories = useCallback((next: Set<string>) => {
    try {
      localStorage.setItem(COLLAPSED_CAT_STORAGE, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
    setCollapsedCategories(next);
  }, []);

  const toggleCategoryCollapsed = (catKey: string) => {
    const next = new Set(collapsedCategories);
    if (next.has(catKey)) next.delete(catKey);
    else next.add(catKey);
    persistCollapsedCategories(next);
  };

  const load = async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const list = await fetchCustomObjects();
      setObjects(list);
    } catch {
      setObjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [enabled]);

  useEffect(() => {
    if (!createOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [createOpen]);

  useEffect(() => {
    const onScroll = () => closeOverlays();
    const onResize = () => closeOverlays();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [closeOverlays]);

  useLayoutEffect(() => {
    if (!dotsMenu && !plusMenu && !categoryTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (categoryTarget && !categorySaving) setCategoryTarget(null);
      else closeOverlays();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dotsMenu, plusMenu, categoryTarget, categorySaving, closeOverlays]);

  const go = (path: string) => {
    navigate(path);
    onMobileNavigate?.();
    setCreateOpen(false);
    closeOverlays();
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openDots = (obj: CustomObject, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setPlusMenu(null);
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = placeFixedMenu(rect, MENU_W, MENU_H);
    setDotsMenu({ id: obj.id, ...pos });
  };

  const openPlus = (obj: CustomObject, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDotsMenu(null);
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = placeFixedMenu(rect, PLUS_MENU_W, PLUS_MENU_H);
    setPlusMenu({ id: obj.id, ...pos });
  };

  const openRename = (obj: CustomObject) => {
    setRenameTarget(obj);
    setRenameValue(obj.name);
    setDotsMenu(null);
  };

  const saveRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    setRenameSaving(true);
    try {
      const updated = await updateCustomObject(renameTarget.id, { name: renameValue.trim() });
      setObjects((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setRenameTarget(null);
    } finally {
      setRenameSaving(false);
    }
  };

  const sortedObjects = useMemo(() => sortWorkspaceObjects(objects), [objects]);
  const visibleSorted = useMemo(
    () => sortedObjects.filter((o) => !o.meta?.sidebarHidden),
    [sortedObjects],
  );
  const hiddenSorted = useMemo(
    () => sortedObjects.filter((o) => !!o.meta?.sidebarHidden),
    [sortedObjects],
  );

  const workspaceGroups = useMemo(() => {
    const map = new Map<string, CustomObject[]>();
    for (const o of visibleSorted) {
      const k = workspaceCategoryStorageKey(o);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(o);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const ra = typeof a.meta?.sidebarRank === 'number' ? a.meta.sidebarRank : null;
        const rb = typeof b.meta?.sidebarRank === 'number' ? b.meta.sidebarRank : null;
        if (ra !== null && rb !== null) return ra - rb;
        if (ra !== null) return -1;
        if (rb !== null) return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    }
    const keys = [...map.keys()].sort((a, b) => {
      if (a === UNCATEGORIZED_KEY) return 1;
      if (b === UNCATEGORIZED_KEY) return -1;
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
    return keys.map((catKey) => ({
      catKey,
      label:
        catKey === UNCATEGORIZED_KEY
          ? t('crm.sidebar.uncategorized')
          : (CATEGORY_PRESET_KEYS as readonly string[]).includes(catKey)
            ? t(`crm.sidebar.categoryPresets.${catKey}`)
            : catKey,
      items: map.get(catKey)!,
    }));
  }, [visibleSorted, t]);

  const openCategoryModal = (obj: CustomObject) => {
    const raw = obj.meta?.sidebarCategory;
    setCategoryDraft(typeof raw === 'string' ? raw : '');
    setCategoryTarget(obj);
    setDotsMenu(null);
  };

  const saveCategory = async () => {
    if (!categoryTarget) return;
    setCategorySaving(true);
    try {
      const trimmed = categoryDraft.trim();
      const nextMeta = {
        ...(categoryTarget.meta && typeof categoryTarget.meta === 'object'
          ? categoryTarget.meta
          : {}),
      } as Record<string, unknown>;
      if (trimmed) nextMeta.sidebarCategory = trimmed;
      else delete nextMeta.sidebarCategory;
      const updated = await updateCustomObject(categoryTarget.id, { meta: nextMeta });
      setObjects((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setCategoryTarget(null);
    } finally {
      setCategorySaving(false);
    }
  };

  const hideWorkspaceFromSidebar = async (obj: CustomObject) => {
    setDotsMenu(null);
    try {
      const nextMeta = {
        ...(obj.meta && typeof obj.meta === 'object' ? obj.meta : {}),
        sidebarHidden: true,
      } as Record<string, unknown>;
      const updated = await updateCustomObject(obj.id, { meta: nextMeta });
      setObjects((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch {
      /* ignore */
    }
  };

  const restoreWorkspaceToSidebar = async (obj: CustomObject) => {
    try {
      const nextMeta = {
        ...(obj.meta && typeof obj.meta === 'object' ? obj.meta : {}),
      } as Record<string, unknown>;
      delete nextMeta.sidebarHidden;
      const updated = await updateCustomObject(obj.id, { meta: nextMeta });
      setObjects((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch {
      /* ignore */
    }
  };

  const moveWorkspace = async (id: string, dir: 'up' | 'down') => {
    const sorted = sortWorkspaceObjects(objects);
    const idx = sorted.findIndex((o) => o.id === id);
    const j = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || j < 0 || j >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[j];
    const rankA = typeof a.meta?.sidebarRank === 'number' ? a.meta.sidebarRank : idx * 10;
    const rankB = typeof b.meta?.sidebarRank === 'number' ? b.meta.sidebarRank : j * 10;
    await updateCustomObject(a.id, { meta: { ...(a.meta || {}), sidebarRank: rankB } });
    await updateCustomObject(b.id, { meta: { ...(b.meta || {}), sidebarRank: rankA } });
    await load();
    setDotsMenu(null);
  };

  const duplicateWorkspace = async (obj: CustomObject) => {
    setDotsMenu(null);
    try {
      await duplicateCustomObject(obj.id);
      await load();
    } catch {
      // ignore
    }
  };

  const openDeleteWorkspace = (obj: CustomObject) => {
    setDotsMenu(null);
    setDeleteTarget(obj);
  };

  const confirmDeleteWorkspace = async () => {
    if (!deleteTarget) return;
    setDeleteSaving(true);
    try {
      await deleteCustomObject(deleteTarget.id);
      if (location.pathname.startsWith(`/workspace/${deleteTarget.id}`)) {
        navigate('/workspace', { replace: true });
      }
      await load();
      setDeleteTarget(null);
    } catch {
      // ignore
    } finally {
      setDeleteSaving(false);
    }
  };

  const enableViewAndGo = useCallback(
    async (obj: CustomObject, key: ExtraWorkspaceViewKey) => {
      if (plusEnablingRef.current) return;
      plusEnablingRef.current = true;
      setPlusEnablingKey(key);
      try {
        const next = addEnabledView(obj.meta, key);
        const mergedMeta = {
          ...(obj.meta && typeof obj.meta === 'object' ? obj.meta : {}),
          enabledViews: next,
        };
        const updated = await updateCustomObject(obj.id, { meta: mergedMeta });
        setObjects((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        setPlusMenu(null);
        navigate(`/workspace/${obj.id}/${key}`);
        onMobileNavigate?.();
      } catch {
        // ignore
      } finally {
        plusEnablingRef.current = false;
        setPlusEnablingKey(null);
      }
    },
    [navigate, onMobileNavigate],
  );

  if (!enabled) return null;

  const TableIcon = NAV_ICON_MAP.table;
  const KanbanIcon = NAV_ICON_MAP.kanban;
  const AnalyticsIcon = NAV_ICON_MAP.analytics;
  const CalendarIcon = NAV_ICON_MAP.calendar;
  const WorkspaceNewIcon = NAV_ICON_MAP.workspaceNew;

  const renderWorkspaceItem = (obj: CustomObject) => {
    const base = `/workspace/${obj.id}`;
    const enabledViews = parseEnabledViews(obj.meta);
    const isActive =
      location.pathname.startsWith(`${base}/`) || location.pathname === base;
    const isOpen = expanded.has(obj.id);
    return (
      <div key={obj.id} className="group relative">
        <div className={`flex items-center gap-0.5 ${compact ? 'justify-center' : ''}`}>
          <NavLink
            to={`${base}/table`}
            title={compact ? obj.name : undefined}
            onClick={() => onMobileNavigate?.()}
            className={({ isActive: navActive }) =>
              [
                'min-w-0 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition-colors',
                compact ? 'justify-center flex-1' : 'flex-1',
                navActive || isActive
                  ? 'bg-sky-50 text-sky-900 font-medium'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              ].join(' ')
            }
          >
            <NavIconFolder className={isActive ? 'text-sky-600' : 'text-slate-400'} />
            <span
              className={
                compact ? 'sr-only' : 'line-clamp-2 min-w-0 break-words text-left leading-snug'
              }
            >
              {obj.name}
            </span>
          </NavLink>
          {!compact && (
            <button
              type="button"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-emerald-800 hover:bg-emerald-50"
              aria-expanded={isOpen}
              title={t('crm.sidebar.toggleWorkspaceViews')}
              onClick={(e) => {
                e.preventDefault();
                toggleExpand(obj.id);
              }}
            >
              <NavChevronDown expanded={isOpen} />
            </button>
          )}
          {!compact && (
            <div className="shrink-0 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-within:opacity-100">
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label={t('crm.sidebar.workspaceMenu')}
                onClick={(e) => openDots(obj, e)}
              >
                <NavIconDots />
              </button>
            </div>
          )}
        </div>

        {isOpen && !compact && (
          <div className="mt-1 ml-1 border-l border-slate-200 pl-2 space-y-0.5">
            <NavLink
              to={`${base}/table`}
              onClick={() => onMobileNavigate?.()}
              className={({ isActive: a }) =>
                [
                  'flex items-center gap-2 rounded-md px-2 py-1 text-[11px]',
                  a || location.pathname === `${base}/table`
                    ? 'bg-slate-100 text-slate-900 font-medium'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
                ].join(' ')
              }
            >
              <TableIcon className="text-slate-400" />
              {t('crm.sidebar.linkTable')}
            </NavLink>
            {enabledViews.kanban && (
              <NavLink
                to={`${base}/kanban`}
                onClick={() => onMobileNavigate?.()}
                className={({ isActive: a }) =>
                  [
                    'flex items-center gap-2 rounded-md px-2 py-1 text-[11px]',
                    a ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-500 hover:bg-slate-50',
                  ].join(' ')
                }
              >
                <KanbanIcon className="text-slate-400" />
                {t('crm.sidebar.linkKanban')}
              </NavLink>
            )}
            {enabledViews.calendar && (
              <NavLink
                to={`${base}/calendar`}
                onClick={() => onMobileNavigate?.()}
                className={({ isActive: a }) =>
                  [
                    'flex items-center gap-2 rounded-md px-2 py-1 text-[11px]',
                    a ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-500 hover:bg-slate-50',
                  ].join(' ')
                }
              >
                <CalendarIcon className="text-slate-400" />
                {t('crm.workspace.views.calendar')}
              </NavLink>
            )}
            {enabledViews.analytics && (
              <NavLink
                to={`${base}/analytics`}
                onClick={() => onMobileNavigate?.()}
                className={({ isActive: a }) =>
                  [
                    'flex items-center gap-2 rounded-md px-2 py-1 text-[11px]',
                    a ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-500 hover:bg-slate-50',
                  ].join(' ')
                }
              >
                <AnalyticsIcon className="text-slate-400" />
                {t('crm.sidebar.linkAnalytics')}
              </NavLink>
            )}
            <div className="flex items-center justify-between gap-1 pt-1 pb-0.5">
              <span className="text-[10px] uppercase tracking-wide text-slate-400 pl-0.5">
                {t('crm.sidebar.quickAdd')}
              </span>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white shadow-sm hover:bg-teal-700"
                title={t('crm.sidebar.add')}
                aria-label={t('crm.sidebar.add')}
                onClick={(e) => openPlus(obj, e)}
              >
                <NavIconPlus className="!h-3.5 !w-3.5 text-white" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const dotsPortal =
    dotsMenu &&
    createPortal(
      <>
        <button
          type="button"
          className="fixed inset-0 z-[10040] cursor-default bg-transparent"
          aria-label="Close menu"
          onClick={() => setDotsMenu(null)}
        />
        <div
          role="menu"
          className="fixed z-[10050] w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
          style={{ top: dotsMenu.top, left: dotsMenu.left, width: MENU_W }}
        >
          {objects
            .filter((o) => o.id === dotsMenu.id)
            .map((obj) => {
              const base = `/workspace/${obj.id}`;
              const idx = sortedObjects.findIndex((o) => o.id === obj.id);
              const canUp = idx > 0;
              const canDown = idx >= 0 && idx < sortedObjects.length - 1;
              return (
                <React.Fragment key={obj.id}>
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    disabled={!canUp}
                    onClick={() => void moveWorkspace(obj.id, 'up')}
                  >
                    {t('crm.sidebar.moveUp')}
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    disabled={!canDown}
                    onClick={() => void moveWorkspace(obj.id, 'down')}
                  >
                    {t('crm.sidebar.moveDown')}
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50"
                    onClick={() => openRename(obj)}
                  >
                    {t('crm.sidebar.editWorkspace')}
                  </button>
                  <NavLink
                    to={`${base}/settings`}
                    className="block px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setDotsMenu(null);
                      onMobileNavigate?.();
                    }}
                  >
                    {t('crm.sidebar.openSettings')}
                  </NavLink>
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50"
                    onClick={() => openCategoryModal(obj)}
                  >
                    {t('crm.sidebar.categoryTitle')}
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50"
                    onClick={() => void hideWorkspaceFromSidebar(obj)}
                  >
                    {t('crm.sidebar.hideFromSidebar')}
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50"
                    onClick={() => void duplicateWorkspace(obj)}
                  >
                    {t('crm.sidebar.duplicateWorkspace')}
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-[12px] text-rose-600 hover:bg-rose-50"
                    onClick={() => openDeleteWorkspace(obj)}
                  >
                    {t('crm.sidebar.deleteWorkspace')}
                  </button>
                </React.Fragment>
              );
            })}
        </div>
      </>,
      document.body,
    );

  const plusPortal =
    plusMenu &&
    createPortal(
      <>
        <button
          type="button"
          className="fixed inset-0 z-[10040] cursor-default bg-transparent"
          aria-label="Close menu"
          onClick={() => setPlusMenu(null)}
        />
        <div
          role="menu"
          className="fixed z-[10050] rounded-xl border border-slate-200/90 bg-white py-1.5 shadow-xl ring-1 ring-slate-900/5"
          style={{ top: plusMenu.top, left: plusMenu.left, width: PLUS_MENU_W }}
        >
          {objects
            .filter((o) => o.id === plusMenu.id)
            .map((obj) => {
              const base = `/workspace/${obj.id}`;
              const ev = parseEnabledViews(obj.meta);
              const viewsToAdd = PLUS_MENU_EXTRA_VIEWS.filter(({ key }) => !ev[key]);
              return (
                <React.Fragment key={obj.id}>
                  {viewsToAdd.map(({ key, iconClass }) => {
                    const Icon = NAV_ICON_MAP[key];
                    const label = `${t('crm.workspace.views.add')} ${t(`crm.workspace.views.${key}`)}`;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={plusEnablingKey !== null}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        onClick={() => void enableViewAndGo(obj, key)}
                      >
                        <Icon className={iconClass} />
                        {plusEnablingKey === key ? '…' : label}
                      </button>
                    );
                  })}
                  {viewsToAdd.length > 0 && <div className="my-1 border-t border-slate-100" />}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                    disabled={plusEnablingKey !== null}
                    onClick={() => go(`${base}/table?addGroup=1`)}
                  >
                    <TableIcon className="text-slate-500" />
                    {t('crm.sidebar.newGroupInWorkspace')}
                  </button>
                </React.Fragment>
              );
            })}
        </div>
      </>,
      document.body,
    );

  return (
    <div
      className={`border-t border-slate-200/90 overflow-visible ${
        compact ? 'mt-3 pt-3' : 'mt-5 pt-4'
      }`}
    >
      {dotsPortal}
      {plusPortal}

      <div
        className={`flex items-center gap-2 mb-2 px-0.5 ${
          compact ? 'flex-col justify-center' : 'justify-between'
        }`}
      >
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 ${
            compact ? 'sr-only' : ''
          }`}
        >
          {t('crm.sidebar.workspaces')}
        </span>
        <div className="relative" ref={createRef}>
          <button
            type="button"
            onClick={() => setCreateOpen((v) => !v)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md shadow-teal-500/25 hover:from-teal-600 hover:to-teal-700 transition-all hover:scale-[1.03] active:scale-[0.98]"
            title={t('crm.sidebar.add')}
            aria-label={t('crm.sidebar.add')}
          >
            <NavIconPlus className="!h-4 !w-4 text-white" />
          </button>
          {createOpen && (
            <div className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-xl border border-slate-200/90 bg-white py-1.5 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5">
              <div className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                {t('crm.sidebar.addMenuTitle')}
              </div>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                onClick={() => go('/workspace/new?finish=table')}
              >
                <TableIcon className="text-slate-500" />
                {t('crm.sidebar.newTable')}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                onClick={() => go('/workspace/new?finish=kanban')}
              >
                <KanbanIcon className="text-teal-600" />
                {t('crm.sidebar.newKanban')}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                onClick={() => go('/workspace/new?finish=analytics')}
              >
                <AnalyticsIcon className="text-sky-600" />
                {t('crm.sidebar.newAnalytics')}
              </button>
              <div className="my-1.5 border-t border-slate-100" />
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                onClick={() => go('/workspace/new')}
              >
                <WorkspaceNewIcon className="text-indigo-600" />
                {t('crm.sidebar.newWorkspace')}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                onClick={() => go('/workspace')}
              >
                <TableIcon className="text-slate-400" />
                {t('crm.sidebar.allTables')}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-0.5 max-h-[min(42vh,360px)] overflow-y-auto overflow-x-visible pr-0.5 -mr-1">
        {loading && (
          <div className="space-y-2 py-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 rounded-lg bg-slate-100 animate-pulse" />
            ))}
          </div>
        )}
        {!loading && compact && visibleSorted.map((obj) => renderWorkspaceItem(obj))}
        {!loading &&
          !compact &&
          workspaceGroups.map((group) => {
            const hideCategoryHeader =
              workspaceGroups.length === 1 && group.catKey === UNCATEGORIZED_KEY;
            const sectionOpen =
              hideCategoryHeader || !collapsedCategories.has(group.catKey);
            return (
              <div key={group.catKey} className="space-y-0.5">
                {!hideCategoryHeader && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-1 rounded-lg px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 hover:bg-slate-50"
                    onClick={() => toggleCategoryCollapsed(group.catKey)}
                    aria-expanded={sectionOpen}
                  >
                    <NavChevronDown expanded={sectionOpen} />
                    <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
                    <span className="tabular-nums text-slate-300">{group.items.length}</span>
                  </button>
                )}
                {sectionOpen && group.items.map((obj) => renderWorkspaceItem(obj))}
              </div>
            );
          })}
        {!loading && !compact && hiddenSorted.length > 0 && (
          <div className="mt-2 border-t border-slate-200 pt-2">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 hover:bg-slate-50"
              onClick={() => setHiddenSectionOpen((v) => !v)}
              aria-expanded={hiddenSectionOpen}
            >
              <span>{t('crm.sidebar.showHiddenWorkspaces')}</span>
              <span className="text-slate-300">{hiddenSorted.length}</span>
            </button>
            {hiddenSectionOpen && (
              <div className="mt-1 space-y-1 pl-1">
                {hiddenSorted.map((obj) => (
                  <div
                    key={obj.id}
                    className="flex items-center gap-1 rounded-lg bg-slate-50/80 px-2 py-1"
                  >
                    <span className="min-w-0 flex-1 line-clamp-2 text-[11px] text-slate-500">
                      {obj.name}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-teal-700 ring-1 ring-slate-200 hover:bg-teal-50"
                      onClick={() => void restoreWorkspaceToSidebar(obj)}
                    >
                      {t('crm.sidebar.restoreWorkspace')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {!loading && visibleSorted.length === 0 && objects.length === 0 && (
          <p className="text-[11px] text-slate-400 px-1 py-2 leading-snug">{t('crm.sidebar.empty')}</p>
        )}
        {!loading && visibleSorted.length === 0 && objects.length > 0 && (
          <p className="text-[11px] text-slate-400 px-1 py-2 leading-snug">
            {t('crm.sidebar.allWorkspacesHiddenHint')}
          </p>
        )}
      </div>

      {renameTarget &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-rename-title"
            className="fixed inset-0 z-[10070] flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-sm"
            onClick={() => setRenameTarget(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div id="workspace-rename-title" className="mb-2 text-sm font-semibold text-slate-900">
                {t('crm.sidebar.editWorkspace')}
              </div>
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="mb-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                  onClick={() => setRenameTarget(null)}
                >
                  {t('crm.common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={renameSaving || !renameValue.trim()}
                  className="rounded-xl bg-lumiva-accent px-3 py-1.5 text-sm text-white disabled:opacity-50"
                  onClick={() => void saveRename()}
                >
                  {t('crm.common.save')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {deleteTarget &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-delete-title"
            className="fixed inset-0 z-[10070] flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-sm"
            onClick={() => !deleteSaving && setDeleteTarget(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div id="workspace-delete-title" className="mb-2 text-sm font-semibold text-slate-900">
                {t('crm.sidebar.deleteWorkspace')}
              </div>
              <p className="mb-4 text-sm leading-relaxed text-slate-600">
                {t('crm.sidebar.deleteWorkspaceConfirm', { name: deleteTarget.name })}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteSaving}
                >
                  {t('crm.common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={deleteSaving}
                  className="rounded-xl bg-rose-600 px-3 py-1.5 text-sm text-white hover:bg-rose-700 disabled:opacity-50"
                  onClick={() => void confirmDeleteWorkspace()}
                >
                  {t('crm.sidebar.deleteWorkspace')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {categoryTarget &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-category-title"
            className="fixed inset-0 z-[10070] flex items-center justify-center bg-slate-900/20 p-4 backdrop-blur-sm"
            onClick={() => !categorySaving && setCategoryTarget(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div id="workspace-category-title" className="mb-1 text-sm font-semibold text-slate-900">
                {t('crm.sidebar.categoryTitle')}
              </div>
              <p className="mb-3 text-xs leading-relaxed text-slate-500">
                {t('crm.sidebar.categoryHint')}
              </p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {CATEGORY_PRESET_KEYS.map((pk) => (
                  <button
                    key={pk}
                    type="button"
                    className={
                      'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ' +
                      (categoryDraft === pk
                        ? 'border-teal-500 bg-teal-50 text-teal-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
                    }
                    onClick={() => setCategoryDraft(pk)}
                  >
                    {t(`crm.sidebar.categoryPresets.${pk}`)}
                  </button>
                ))}
              </div>
              <input
                value={categoryDraft}
                onChange={(e) => setCategoryDraft(e.target.value)}
                className="mb-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder={t('crm.sidebar.categoryCustomPlaceholder')}
                aria-label={t('crm.sidebar.categoryCustomPlaceholder')}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                  onClick={() => !categorySaving && setCategoryTarget(null)}
                  disabled={categorySaving}
                >
                  {t('crm.common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={categorySaving}
                  className="rounded-xl bg-lumiva-accent px-3 py-1.5 text-sm text-white disabled:opacity-50"
                  onClick={() => void saveCategory()}
                >
                  {t('crm.sidebar.categorySave')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
