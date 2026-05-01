import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  createWorkspaceArea,
  deleteWorkspaceArea,
  fetchWorkspaceAreas,
  type WorkspaceArea,
} from '../../api/workspaceAreas';
import { NAV_ICON_MAP, NavIconPlus, type NavIconKey } from '../layout/NavSidebarIcons';

const LS_KEY = 'lumiva_workspace_area_id';

type Props = {
  compact?: boolean;
  /** Текущая выбранная область (синхронизация с URL / parent) */
  activeAreaId: string | null;
};

function readStoredAreaId(): string | null {
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

function writeStoredAreaId(id: string | null) {
  try {
    if (id) localStorage.setItem(LS_KEY, id);
    else localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

const ROW_H = 'h-10';

/** Heroicons v2 outline trash */
const IconTrashSmall: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M14.7404 9L14.3942 18M9.60577 18L9.25962 9M19.2276 5.79057C19.5696 5.84221 19.9104 5.89747 20.25 5.95629M19.2276 5.79057L18.1598 19.6726C18.0696 20.8448 17.0921 21.75 15.9164 21.75H8.08357C6.90786 21.75 5.93037 20.8448 5.8402 19.6726L4.77235 5.79057M19.2276 5.79057C18.0812 5.61744 16.9215 5.48485 15.75 5.39432M3.75 5.95629C4.08957 5.89747 4.43037 5.84221 4.77235 5.79057M4.77235 5.79057C5.91878 5.61744 7.07849 5.48485 8.25 5.39432M15.75 5.39432V4.47819C15.75 3.29882 14.8393 2.31423 13.6606 2.27652C13.1092 2.25889 12.5556 2.25 12 2.25C11.4444 2.25 10.8908 2.25889 10.3394 2.27652C9.16065 2.31423 8.25 3.29882 8.25 4.47819V5.39432M15.75 5.39432C14.5126 5.2987 13.262 5.25 12 5.25C10.738 5.25 9.48744 5.2987 8.25 5.39432" />
  </svg>
);

function AreaOutlineIcon({
  iconKey,
  className,
  emphasized,
}: {
  iconKey?: string;
  className?: string;
  emphasized?: boolean;
}) {
  const I = (iconKey && NAV_ICON_MAP[iconKey as NavIconKey]) || NAV_ICON_MAP.folder;
  return (
    <span
      className={[
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-white',
        emphasized ? 'border-neutral-300 text-neutral-700' : 'border-neutral-200/90 text-neutral-500',
        className || '',
      ].join(' ')}
    >
      <I className="!h-[18px] !w-[18px]" />
    </span>
  );
}

export const WorkspaceAreaSwitcher: React.FC<Props> = ({ compact = false, activeAreaId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [areas, setAreas] = useState<WorkspaceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceArea | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchWorkspaceAreas();
      setAreas(list);
      const stored = readStoredAreaId();
      if (!activeAreaId && list.length && stored && list.some((a) => a.id === stored)) {
        navigate(`/workspace/areas/${stored}`, { replace: true });
      }
    } catch {
      setAreas([]);
    } finally {
      setLoading(false);
    }
  }, [activeAreaId, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  useLayoutEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc, true);
    return () => document.removeEventListener('mousedown', onDoc, true);
  }, [open]);

  useLayoutEffect(() => {
    if (!deleteTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleteSaving) setDeleteTarget(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteTarget, deleteSaving]);

  const current = useMemo(() => {
    if (!activeAreaId) return areas[0] ?? null;
    return areas.find((a) => a.id === activeAreaId) ?? areas[0] ?? null;
  }, [areas, activeAreaId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return areas;
    return areas.filter((a) => a.name.toLowerCase().includes(q));
  }, [areas, search]);

  const selectArea = (a: WorkspaceArea) => {
    writeStoredAreaId(a.id);
    setOpen(false);
    navigate(`/workspace/areas/${a.id}`);
  };

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const created = await createWorkspaceArea({
        name: newName.trim(),
        iconKey: 'folder',
        iconColor: '#64748b',
      });
      setAreas((prev) => [...prev, created].sort((x, y) => x.sortOrder - y.sortOrder));
      setNewName('');
      selectArea(created);
    } finally {
      setCreating(false);
    }
  };

  const openAddFocusSearch = () => {
    setOpen(true);
    setSearch('');
    setTimeout(() => {
      try {
        rootRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
      } catch {
        /* ignore */
      }
    }, 0);
  };

  const confirmDeleteArea = async () => {
    if (!deleteTarget || deleteTarget.slug === 'main') return;
    setDeleteSaving(true);
    try {
      await deleteWorkspaceArea(deleteTarget.id);
      const removedId = deleteTarget.id;
      const remaining = areas.filter((a) => a.id !== removedId);
      setAreas(remaining);
      if (activeAreaId === removedId) {
        const fallback = remaining.find((a) => a.slug === 'main') ?? remaining[0];
        if (fallback) {
          writeStoredAreaId(fallback.id);
          navigate(`/workspace/areas/${fallback.id}`, { replace: true });
        } else {
          writeStoredAreaId(null);
          navigate('/workspace', { replace: true });
        }
      }
      setDeleteTarget(null);
    } catch {
      /* ignore */
    } finally {
      setDeleteSaving(false);
    }
  };

  const addButtonClass = compact
    ? 'inline-flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-lg border border-neutral-200/90 bg-white text-neutral-600 shadow-none transition-colors hover:bg-neutral-100/90'
    : `inline-flex w-10 shrink-0 items-center justify-center rounded-lg border border-neutral-200/90 bg-white text-neutral-600 shadow-none transition-colors hover:bg-neutral-100/90 ${ROW_H}`;

  if (loading && areas.length === 0) {
    return (
      <div
        className={`mb-2 rounded-xl border border-neutral-200/90 bg-neutral-50/80 px-2 py-2 text-[11px] text-neutral-500 ${
          compact ? 'mx-0' : ''
        }`}
      >
        {t('crm.workspace.area.switcherLoading')}
      </div>
    );
  }

  const deleteModal =
    deleteTarget &&
    createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws-area-delete-title"
        className="fixed inset-0 z-[10080] flex items-center justify-center bg-neutral-900/20 p-4 backdrop-blur-sm"
        onClick={() => !deleteSaving && setDeleteTarget(null)}
      >
        <div
          className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div id="ws-area-delete-title" className="mb-2 text-sm font-semibold text-neutral-900">
            {t('crm.workspace.area.deleteArea')}
          </div>
          <p className="text-[13px] leading-snug text-neutral-600">
            {t('crm.workspace.area.deleteAreaConfirm', { name: deleteTarget.name })}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              disabled={deleteSaving}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[13px] text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              onClick={() => setDeleteTarget(null)}
            >
              {t('crm.common.cancel')}
            </button>
            <button
              type="button"
              disabled={deleteSaving}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              onClick={() => void confirmDeleteArea()}
            >
              {deleteSaving ? '…' : t('crm.workspace.area.deleteArea')}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <div ref={rootRef} className={`relative mb-2 w-full min-w-0 ${compact ? '' : ''}`}>
      {deleteModal}
      <div
        className={
          compact ? 'flex w-full min-w-0 flex-col items-stretch gap-1.5' : 'flex min-w-0 items-center gap-1.5'
        }
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={[
            'flex min-w-0 items-center gap-2 rounded-lg border border-neutral-200/90 bg-white text-left transition-colors hover:bg-neutral-100/90',
            compact ? 'h-10 w-full justify-center px-1.5' : 'min-h-10 flex-1 px-2.5 py-2',
            open ? 'border-neutral-300 bg-neutral-50/80' : '',
          ].join(' ')}
          title={current?.name}
        >
          <AreaOutlineIcon iconKey={current?.iconKey} emphasized={!!current} />
          {!compact && (
            <span className="min-w-0 flex-1 truncate text-[13px] font-normal text-neutral-800">
              {current?.name || t('crm.workspace.area.noArea')}
            </span>
          )}
          {!compact && (
            <svg className="h-4 w-4 shrink-0 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
          {compact && <span className="sr-only">{current?.name || t('crm.workspace.area.noArea')}</span>}
        </button>
        <button
          type="button"
          onClick={openAddFocusSearch}
          className={addButtonClass}
          title={t('crm.workspace.area.addArea')}
        >
          <NavIconPlus className="!h-4 !w-4 text-current" />
        </button>
      </div>

      {open && (
        <div
          className={`absolute top-full z-[80] mt-1.5 overflow-hidden rounded-xl border border-neutral-200/90 bg-white text-neutral-800 shadow-lg shadow-neutral-900/10 ${
            compact
              ? 'left-0 w-[min(17.5rem,calc(100vw-12px))]'
              : 'left-0 right-0 w-full'
          }`}
          style={{ maxHeight: compact ? 'min(70vh, 380px)' : 'min(70vh, 420px)' }}
        >
          <div className="border-b border-neutral-100 p-2">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('crm.workspace.area.searchAreas')}
                className="w-full rounded-lg border border-neutral-200/90 bg-white py-2 pl-9 pr-3 text-[13px] text-neutral-800 placeholder:text-neutral-400 outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-200/80"
              />
            </div>
          </div>
          <div className="max-h-[220px] overflow-y-auto px-2 py-1">
            <div className="px-0 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              {t('crm.workspace.area.myAreas')}
            </div>
            {filtered.map((a) => {
              const active = current?.id === a.id;
              const canDelete = a.slug !== 'main';
              return (
                <div
                  key={a.id}
                  className={[
                    'group flex items-center gap-0.5 rounded-lg px-1 py-0.5',
                    active ? 'bg-[#f0f0f0]' : 'hover:bg-neutral-100/90',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => selectArea(a)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[13px] text-neutral-800 transition"
                  >
                    <AreaOutlineIcon iconKey={a.iconKey} emphasized={active} />
                    <span className={`min-w-0 flex-1 truncate ${active ? 'font-medium' : 'font-normal'}`}>
                      {a.name}
                    </span>
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      className="shrink-0 rounded-md p-1.5 text-neutral-400 opacity-100 transition hover:bg-rose-50 hover:text-rose-600 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                      title={t('crm.workspace.area.deleteArea')}
                      aria-label={t('crm.workspace.area.deleteArea')}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteTarget(a);
                      }}
                    >
                      <IconTrashSmall />
                    </button>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-1 py-6 text-center text-xs text-neutral-500">{t('crm.workspace.area.emptySearch')}</div>
            )}
          </div>
          <div className="space-y-2 border-t border-neutral-100 p-2">
            <div className="flex items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('crm.workspace.area.newAreaPlaceholder')}
                className={`min-w-0 flex-1 rounded-lg border border-neutral-200/90 bg-white px-3 text-[13px] text-neutral-800 placeholder:text-neutral-400 outline-none focus:border-neutral-400 ${ROW_H}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreate();
                }}
              />
              <button
                type="button"
                disabled={creating || !newName.trim()}
                onClick={() => void handleCreate()}
                className={`inline-flex w-10 shrink-0 items-center justify-center rounded-lg border border-neutral-200/90 bg-white text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50 ${ROW_H}`}
              >
                {creating ? '…' : '+'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/integrations-hub?tab=catalog');
              }}
              className="w-full rounded-lg border border-neutral-200/90 bg-neutral-50/80 px-3 py-2 text-left text-[12px] text-neutral-700 hover:bg-neutral-100/90"
            >
              {t('crm.workspace.area.browseIntegrations')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
