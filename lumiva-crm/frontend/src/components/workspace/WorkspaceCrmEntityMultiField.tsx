import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  isLeadOmittedFromAnalytics,
  searchLeadsQuick,
  type Lead,
} from '../../api/leads';
import type { Project } from '../../api/projects';
import type { Company } from '../../api/companies';
import type { WorkspaceEntityRefKind } from '../../workspace/workspaceEntityRef';
import {
  parseCrmEntityIdsFromCell,
  serializeCrmEntityIds,
} from '../../workspace/workspaceCrmEntityIds';
import { getFixedPopoverLayout, type FixedPopoverLayout } from '../../utils/tablePopoverFixedPosition';

export type WorkspaceCrmEntityMultiFieldProps = {
  entity: WorkspaceEntityRefKind;
  rawValue: unknown;
  leads: Lead[];
  projects: Project[];
  /** Для колонок со ссылкой на компанию CRM */
  companies?: Company[];
  /** В режиме только просмотра — только чипы и ссылки, без рамки и редактирования */
  readOnly?: boolean;
  /** Одна сущность (например компания у лида): без кнопки «+», выбор заменяет значение */
  hideAddButton?: boolean;
  onCommit?: (serialized: string) => void;
  variant?: 'table' | 'drawer';
  className?: string;
};

const UsersIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    className="h-3.5 w-3.5 shrink-0 text-slate-500"
    aria-hidden
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const FolderIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    className="h-3.5 w-3.5 shrink-0 text-slate-500"
    aria-hidden
  >
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 2H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </svg>
);

const BuildingIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    className="h-3.5 w-3.5 shrink-0 text-slate-500"
    aria-hidden
  >
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
    <path d="M6 12h12" />
    <path d="M6 16h12" />
    <path d="M10 6h4" />
    <path d="M10 10h4" />
    <path d="M10 22v-4h4v4" />
  </svg>
);

export const WorkspaceCrmEntityMultiField: React.FC<WorkspaceCrmEntityMultiFieldProps> = ({
  entity,
  rawValue,
  leads,
  projects,
  companies = [],
  readOnly = false,
  hideAddButton = false,
  onCommit,
  variant = 'table',
  className = '',
}) => {
  const { t } = useTranslation();
  const ids = useMemo(() => parseCrmEntityIdsFromCell(rawValue), [rawValue]);
  const rootRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFixedLayout, setPickerFixedLayout] = useState<FixedPopoverLayout | null>(null);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [leadSearchHits, setLeadSearchHits] = useState<Lead[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const tmr = window.setTimeout(() => setDebouncedQ(q.trim()), 220);
    return () => window.clearTimeout(tmr);
  }, [q]);

  useEffect(() => {
    if (entity !== 'lead' || !pickerOpen) {
      setLeadSearchHits([]);
      return;
    }
    if (debouncedQ.length < 1) {
      setLeadSearchHits([]);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    searchLeadsQuick(debouncedQ, 30)
      .then((list) => {
        if (!cancelled) {
          setLeadSearchHits(list.filter((l) => !isLeadOmittedFromAnalytics(l)));
        }
      })
      .catch(() => {
        if (!cancelled) setLeadSearchHits([]);
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entity, pickerOpen, debouncedQ]);

  const activeProjects = useMemo(
    () => projects.filter((p) => !p.isDeleted),
    [projects],
  );

  const projectSearchResults = useMemo(() => {
    if (entity !== 'project' || !pickerOpen) return [];
    const term = debouncedQ.toLowerCase();
    if (!term) return activeProjects.slice(0, 25);
    return activeProjects
      .filter((p) => (p.name || '').toLowerCase().includes(term))
      .slice(0, 30);
  }, [entity, pickerOpen, debouncedQ, activeProjects]);

  const companySearchResults = useMemo(() => {
    if (entity !== 'company' || !pickerOpen) return [];
    const term = debouncedQ.toLowerCase();
    if (!term) return companies.slice(0, 25);
    return companies
      .filter((c) => (c.name || '').toLowerCase().includes(term))
      .slice(0, 30);
  }, [entity, pickerOpen, debouncedQ, companies]);

  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    leads.forEach((l) => {
      m.set(
        l.id,
        l.name?.trim() || l.email?.trim() || `${l.id.slice(0, 8)}…`,
      );
    });
    activeProjects.forEach((p) => {
      m.set(p.id, p.name?.trim() || `${p.id.slice(0, 8)}…`);
    });
    companies.forEach((c) => {
      m.set(c.id, c.name?.trim() || `${c.id.slice(0, 8)}…`);
    });
    leadSearchHits.forEach((l) => {
      m.set(
        l.id,
        l.name?.trim() || l.email?.trim() || `${l.id.slice(0, 8)}…`,
      );
    });
    return m;
  }, [leads, activeProjects, companies, leadSearchHits]);

  const commitIds = useCallback(
    (next: string[]) => {
      if (readOnly) return;
      onCommit?.(serializeCrmEntityIds(next));
    },
    [readOnly, onCommit],
  );

  const removeId = useCallback(
    (id: string) => {
      commitIds(ids.filter((x) => x !== id));
    },
    [ids, commitIds],
  );

  const addId = useCallback(
    (id: string) => {
      if (hideAddButton) {
        commitIds([id]);
        setQ('');
        setPickerOpen(false);
        setFocused(false);
        return;
      }
      if (ids.includes(id)) return;
      commitIds([...ids, id]);
      setQ('');
      setPickerOpen(false);
    },
    [ids, commitIds, hideAddButton],
  );

  useLayoutEffect(() => {
    if (!pickerOpen || !focused || variant !== 'table') {
      setPickerFixedLayout(null);
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const apply = () =>
      setPickerFixedLayout(
        getFixedPopoverLayout(el.getBoundingClientRect(), { popoverWidth: 320, maxScroll: 280 }),
      );
    apply();
    window.addEventListener('scroll', apply, true);
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('scroll', apply, true);
      window.removeEventListener('resize', apply);
    };
  }, [pickerOpen, focused, variant, debouncedQ, ids.length]);

  useEffect(() => {
    if (readOnly || (!focused && !pickerOpen)) return;
    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      const el = e.target;
      if (!(el instanceof Node)) return;
      if (rootRef.current?.contains(el)) return;
      // The picker panel is portaled to document.body — also check it
      if (pickerRef.current?.contains(el)) return;
      setFocused(false);
      setPickerOpen(false);
      setQ('');
    };
    window.addEventListener('mousedown', onPointerDown, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('mousedown', onPointerDown, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [readOnly, focused, pickerOpen]);

  const textSm = variant === 'drawer' ? 'text-sm' : 'text-xs';
  const pad = variant === 'drawer' ? 'px-3 py-2' : 'px-2 py-1.5';

  const hrefFor = (id: string) =>
    entity === 'lead'
      ? `/leads/${id}`
      : entity === 'company'
        ? `/companies/${id}`
        : `/projects/${id}`;

  const unknownLabel =
    entity === 'lead'
      ? t('crm.workspace.table.crmLeadUnknown')
      : entity === 'company'
        ? t('crm.workspace.table.crmCompanyUnknown')
        : t('crm.workspace.table.crmProjectUnknown');

  const searchPlaceholder =
    entity === 'lead'
      ? t('crm.workspace.table.crmMultiSearchLeadPlaceholder')
      : entity === 'company'
        ? t('crm.workspace.table.crmMultiSearchCompanyPlaceholder')
        : t('crm.workspace.table.crmMultiSearchProjectPlaceholder');

  const EntityIcon =
    entity === 'lead' ? UsersIcon : entity === 'company' ? BuildingIcon : FolderIcon;

  const openPicker = useCallback(() => {
    if (readOnly) return;
    setFocused(true);
    setPickerOpen(true);
  }, [readOnly]);

  const renderPill = (id: string, showRemove: boolean) => {
    const label = labelById.get(id) ?? unknownLabel;
    return (
      <span
        key={id}
        className="group/pill inline-flex max-w-full items-center gap-1 rounded-full bg-sky-50/90 pl-1.5 pr-1 text-slate-800 ring-1 ring-sky-100"
      >
        <EntityIcon />
        <span className="inline-flex min-w-0 max-w-[min(100%,14rem)] items-center gap-0.5">
          <Link
            to={hrefFor(id)}
            target="_blank"
            rel="noreferrer"
            className={`min-w-0 truncate font-medium text-lumiva-accent hover:underline ${textSm}`}
            title={t('crm.workspace.table.crmEntityOpen')}
            onClick={(e) => e.stopPropagation()}
          >
            {label}
          </Link>
          {showRemove && (
            <button
              type="button"
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-500 opacity-0 transition-opacity hover:bg-sky-100 hover:text-slate-800 group-hover/pill:opacity-100 hover:opacity-100 focus:opacity-100"
              aria-label={t('crm.workspace.table.crmMultiRemove')}
              onClick={(e) => {
                e.stopPropagation();
                removeId(id);
              }}
            >
              ×
            </button>
          )}
        </span>
      </span>
    );
  };

  const addButton = (
    <button
      type="button"
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50"
      title={t('crm.workspace.table.crmMultiAdd')}
      onClick={(e) => {
        e.stopPropagation();
        openPicker();
      }}
    >
      +
    </button>
  );

  if (readOnly) {
    return (
      <div
        ref={rootRef}
        className={`relative mx-auto min-w-0 max-w-full ${className}`}
        data-workspace-inline-popover
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-center">
          {ids.length === 0 ? (
            <span className={`text-slate-400 ${textSm}`}>—</span>
          ) : (
            ids.map((id) => renderPill(id, false))
          )}
        </div>
      </div>
    );
  }

  /** Как на /projects/closed: при заполненной ячейке — только чипы и «+», без большой рамки, пока не открыт выбор */
  const useFramedChrome = ids.length === 0 || focused || pickerOpen;

  return (
    <div
      ref={rootRef}
      className={`relative mx-auto min-w-0 max-w-full ${className}`}
      data-workspace-inline-popover
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {useFramedChrome ? (
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            setFocused(true);
            // Open picker immediately when cell is empty or hideAddButton is set
            if (ids.length === 0 || hideAddButton) setPickerOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setFocused(true);
              if (ids.length === 0 || hideAddButton) setPickerOpen(true);
            }
          }}
          className={`flex min-h-[32px] w-full flex-wrap content-center items-center justify-center gap-1.5 rounded-lg border bg-white text-center transition-colors ${
            focused ? 'border-lumiva-accent ring-1 ring-lumiva-accent/25' : 'border-slate-200'
          } ${pad}`}
        >
          {focused && !hideAddButton && (
            <button
              type="button"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50"
              title={t('crm.workspace.table.crmMultiAdd')}
              onClick={(e) => {
                e.stopPropagation();
                setFocused(true);
                setPickerOpen((v) => !v);
              }}
            >
              +
            </button>
          )}
          {ids.length === 0 && !focused && (
            <span className={`mx-auto text-slate-400 ${textSm}`}>
              {t('crm.workspace.table.crmEntityPlaceholder')}
            </span>
          )}
          {ids.map((id) => renderPill(id, true))}
        </div>
      ) : (
        <div
          className={`flex w-full flex-wrap items-center justify-center gap-1.5 text-center${hideAddButton ? ' cursor-pointer' : ''}`}
          role={hideAddButton ? 'button' : undefined}
          tabIndex={hideAddButton ? 0 : undefined}
          onKeyDown={
            hideAddButton
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    setFocused(true);
                    setPickerOpen(true);
                  }
                }
              : undefined
          }
          onClick={
            hideAddButton
              ? (e) => {
                  e.stopPropagation();
                  setFocused(true);
                  setPickerOpen(true);
                }
              : undefined
          }
        >
          {ids.map((id) => renderPill(id, true))}
          {!hideAddButton && addButton}
        </div>
      )}

      {(() => {
        if (!pickerOpen || !focused || (variant === 'table' && !pickerFixedLayout)) return null;

        const isTableFixed = variant === 'table' && pickerFixedLayout;
        const pickerStyle = isTableFixed
          ? { ...pickerFixedLayout!.style, position: 'fixed' as const, zIndex: 99999 }
          : undefined;
        const scrollMaxHeight = isTableFixed
          ? pickerFixedLayout!.scrollMaxHeight
          : undefined;

        const panel = (
          <div
            ref={pickerRef}
            className={`rounded-xl border border-slate-200 bg-white p-2 text-left shadow-2xl ring-1 ring-slate-100 ${
              isTableFixed
                ? 'text-xs'
                : variant === 'drawer'
                  ? 'absolute left-0 mt-1 z-[220] text-sm'
                  : 'absolute left-1/2 mt-1 -translate-x-1/2 z-[220] text-xs'
            }`}
            style={pickerStyle}
          >
            <div className="relative mb-2">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3-3" />
                </svg>
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2 outline-none focus:border-slate-300 focus:bg-white"
                autoFocus
              />
            </div>
            <div
              className="space-y-0.5 overflow-y-auto"
              style={{ maxHeight: scrollMaxHeight ?? '14rem' }}
            >
              {entity === 'lead' && debouncedQ.length < 1 && (
                <p className="px-2 py-2 text-slate-500">{t('crm.workspace.table.crmMultiTypeToSearch')}</p>
              )}
              {entity === 'lead' && debouncedQ.length >= 1 && searchLoading && (
                <p className="px-2 py-2 text-slate-500">{t('crm.workspace.table.crmMultiSearching')}</p>
              )}
              {entity === 'lead' &&
                debouncedQ.length >= 1 &&
                !searchLoading &&
                leadSearchHits.length === 0 && (
                  <p className="px-2 py-2 text-slate-500">{t('crm.workspace.table.crmMultiNoResults')}</p>
                )}
              {entity === 'project' && projectSearchResults.length === 0 && debouncedQ.length >= 1 && (
                <p className="px-2 py-2 text-slate-500">{t('crm.workspace.table.crmMultiNoResults')}</p>
              )}
              {entity === 'company' && companySearchResults.length === 0 && debouncedQ.length >= 1 && (
                <p className="px-2 py-2 text-slate-500">{t('crm.workspace.table.crmMultiNoResults')}</p>
              )}
              {entity === 'lead' &&
                leadSearchHits.map((item) => {
                  const label =
                    item.name?.trim() || item.email?.trim() || `${item.id.slice(0, 8)}…`;
                  const taken = ids.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={taken}
                      onClick={() => addId(item.id)}
                      className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left ${
                        taken ? 'cursor-not-allowed opacity-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <UsersIcon />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-900">{label}</span>
                        {(item.email || item.phone) && (
                          <span className="block truncate text-[11px] text-slate-500">
                            {[item.email, item.phone].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              {entity === 'project' &&
                projectSearchResults.map((item) => {
                  const label = item.name?.trim() || `${item.id.slice(0, 8)}…`;
                  const taken = ids.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={taken}
                      onClick={() => addId(item.id)}
                      className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left ${
                        taken ? 'cursor-not-allowed opacity-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <FolderIcon />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-900">{label}</span>
                        {item.status && (
                          <span className="block truncate text-[11px] text-slate-500">{item.status}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              {entity === 'company' &&
                companySearchResults.map((item) => {
                  const label = item.name?.trim() || `${item.id.slice(0, 8)}…`;
                  const taken = ids.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={taken}
                      onClick={() => addId(item.id)}
                      className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left ${
                        taken ? 'cursor-not-allowed opacity-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <BuildingIcon />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-900">{label}</span>
                        {(item.email || item.city) && (
                          <span className="block truncate text-[11px] text-slate-500">
                            {[item.email, item.city].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        );

        return isTableFixed ? createPortal(panel, document.body) : panel;
      })()}
    </div>
  );
};
