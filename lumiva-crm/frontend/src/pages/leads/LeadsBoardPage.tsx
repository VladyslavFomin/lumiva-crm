// src/pages/leads/LeadsBoardPage.tsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { useKanbanSensors } from '../../components/kanban/useKanbanSensors';
import { kanbanCollisionDetection } from '../../components/kanban/kanbanCollisionDetection';
import { useHorizontalWheelScroll } from '../../components/kanban/useHorizontalWheelScroll';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Lead, LeadStatus, LeadTask } from '../../api/leads';
import { fetchLeads, updateLeadStatus, fetchLeadAccessGrants } from '../../api/leads';
import {
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
import { fetchCompanies, type Company } from '../../api/companies';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';
import { ViewNameModal } from '../../components/ViewNameModal';
import { useAlertModal } from '../../contexts/AlertModalContext';
import {
  createLeadsCustomView,
  deleteLeadsCustomView,
  loadLeadsCustomViews,
  type LeadsCustomView,
  updateLeadsCustomView,
} from './leadsViewsStore';
import '../projects/ProjectsListPage.css';

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

// ВАЖНО: здесь используем именно текстовые статусы,
// которые описаны в api/leads.ts (Новый клиент, В работе, ...)
const STATUSES: { id: LeadStatus; key: string }[] = [
  { id: 'Новый клиент', key: 'new' },
  { id: 'В работе', key: 'inProgress' },
  { id: 'Ожидает ответа', key: 'waiting' },
  { id: 'Закрыт (успех)', key: 'won' },
  { id: 'Закрыт (проигран)', key: 'lost' },
];

const STATUS_ACCENT: Record<string, string> = {
  'Новый клиент': '#3b82f6',
  'В работе': '#22c55e',
  'Ожидает ответа': '#f59e0b',
  'Закрыт (успех)': '#10b981',
  'Закрыт (проигран)': '#ef4444',
};

const OPEN_STATUSES: LeadStatus[] = ['Новый клиент', 'В работе', 'Ожидает ответа'];

function currencySymbol(currency: string): string {
  if (currency === 'TRY') return '₺';
  if (currency === 'USD') return '$';
  if (currency === 'RUB') return '₽';
  return '€';
}

function initialsFromName(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return `${first}${second}`.toUpperCase();
}

/** Ближайший незавершённый шаг по дедлайну — «следующий шаг» на карточке. */
function nextLeadTask(tasks: LeadTask[]): LeadTask | null {
  const open = tasks.filter((t) => !t.done && t.deadline);
  if (!open.length) return null;
  return open.slice().sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())[0];
}

function isTaskOverdue(task: LeadTask): boolean {
  if (!task.deadline) return false;
  const due = new Date(task.deadline);
  due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}

const DraggableLeadCard: React.FC<{
  id: string;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ id, className, onClick, disabled, children }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled });
  // Visual feedback while dragging comes from the floating DragOverlay, not an in-place
  // transform — a card that moves between columns changes DOM parent on drop, and an in-place
  // transform resetting to identity at that exact moment can visually read as "snapping back"
  // to the old column for a frame even though the status change already succeeded.
  const style: React.CSSProperties = { opacity: isDragging ? 0.35 : undefined };
  return (
    <div ref={setNodeRef} style={style} className={className} onClick={onClick} {...(disabled ? {} : listeners)} {...attributes}>
      {children}
    </div>
  );
};

const DroppableLeadColumn: React.FC<{ id: string; className?: string; children: React.ReactNode }> = ({ id, className, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className || ''}${isOver ? ' over' : ''}`}>
      {children}
    </div>
  );
};

export const LeadsBoardPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showConfirm, showAlert } = useAlertModal();
  const locale = resolveLocale(i18n.language);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [canManageAccess, setCanManageAccess] = useState(false);
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [companiesMap, setCompaniesMap] = useState<Record<string, Company>>({});
  const [boardSearch, setBoardSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [density, setDensity] = useState<'comfort' | 'compact'>('comfort');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [customViews, setCustomViews] = useState<LeadsCustomView[]>(() => loadLeadsCustomViews());
  const [viewsMenuOpen, setViewsMenuOpen] = useState(false);
  const viewsMenuRef = React.useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const activeViewId = searchParams.get('view');
  const activeCustomView = customViews.find((view) => view.id === activeViewId) || null;
  const calendarLabel = t('crm.leads.board.viewCalendar');
  const menuCreateTable = t('crm.leads.board.menu.createTable');
  const menuCreateKanban = t('crm.leads.board.menu.createKanban');
  const menuCreateCalendar = t('crm.leads.board.menu.createCalendar');
  const menuRename = t('crm.leads.board.menu.renameView');
  const menuDelete = t('crm.leads.board.menu.deleteView');

  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameModalMode, setNameModalMode] = useState<'create' | 'rename'>('create');
  const [nameModalCreateType, setNameModalCreateType] = useState<'table' | 'kanban' | 'calendar'>('kanban');

  const path = location.pathname;
  const isListTab = path === '/leads' || path === '/leads/list';
  const isKanbanTab = path === '/leads/board';
  const isCalendarTab = path === '/leads/calendar';

  // загрузка лидов с бэка
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchLeads()
      .then((data) => {
        if (!alive) return;
        setLeads(data);
      })
      .catch((e) => {
        if (!alive) return;
        console.error(e);
        setError(e.message || t('crm.leads.board.errors.loadFailed'));
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
    fetchLeadAccessGrants()
      .then(() => {
        if (alive) setCanManageAccess(true);
      })
      .catch(() => {
        if (alive) setCanManageAccess(false);
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
      .catch((e) => console.error('Ошибка загрузки кастомных полей:', e));
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
        /* non-blocking */
      });
    return () => {
      alive = false;
    };
  }, []);

  const activeCustomFields = customFields.filter((field) => field.isActive);
  const isArchivedLead = (lead: Lead) => Boolean(lead.meta?.archived);
  const isDeletedLead = (lead: Lead) => Boolean(lead.meta?.deleted);
  const filteredLeads = useMemo(
    () => leads.filter((lead) => !isDeletedLead(lead) && !isArchivedLead(lead)),
    [leads],
  );

  const suggestedKeys = React.useMemo(() => {
    const keys = new Set<string>();
    filteredLeads.forEach((lead) => {
      Object.keys(lead.customFields ?? {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [filteredLeads]);

  const ownerOptions = useMemo(() => {
    const names = new Set<string>();
    filteredLeads.forEach((lead) => {
      if (lead.assignedTo) names.add(lead.assignedTo);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, locale));
  }, [filteredLeads, locale]);

  const boardLeads = useMemo(() => {
    const q = boardSearch.trim().toLowerCase();
    return filteredLeads.filter((lead) => {
      if (ownerFilter !== 'all' && lead.assignedTo !== ownerFilter) return false;
      if (!q) return true;
      const org = (lead.companyId && companiesMap[lead.companyId]?.name) || '';
      return (
        lead.name.toLowerCase().includes(q) ||
        org.toLowerCase().includes(q) ||
        lead.id.includes(q)
      );
    });
  }, [filteredLeads, boardSearch, ownerFilter, companiesMap]);

  const summary = useMemo(() => {
    const now = new Date();
    const openLeads = filteredLeads.filter((l) => OPEN_STATUSES.includes(l.status));
    const openSum = openLeads.reduce((s, l) => s + l.amount, 0);
    const wonThisMonth = filteredLeads.filter(
      (l) =>
        l.status === 'Закрыт (успех)' &&
        new Date(l.updatedAt).getMonth() === now.getMonth() &&
        new Date(l.updatedAt).getFullYear() === now.getFullYear(),
    );
    const wonSum = wonThisMonth.reduce((s, l) => s + l.amount, 0);
    const wonTotal = filteredLeads.filter((l) => l.status === 'Закрыт (успех)').length;
    const lostTotal = filteredLeads.filter((l) => l.status === 'Закрыт (проигран)').length;
    const conversion = wonTotal + lostTotal > 0 ? Math.round((wonTotal / (wonTotal + lostTotal)) * 100) : 0;
    const overdue = filteredLeads.filter((l) => (l.tasks ?? []).some((task) => !task.done && isTaskOverdue(task))).length;
    return { openSum, wonSum, wonCount: wonThisMonth.length, conversion, overdue };
  }, [filteredLeads]);

  const renderCustomPreview = (lead: Lead) => {
    if (!activeCustomFields.length) return null;
    const rows = activeCustomFields
      .map((field) => {
        const raw = lead.customFields?.[field.key];
        if (raw === null || raw === undefined || raw === '') return null;
        const display = Array.isArray(raw)
          ? raw.join(', ')
          : typeof raw === 'boolean'
            ? raw
              ? t('crm.leads.board.boolean.yes')
              : t('crm.leads.board.boolean.no')
            : String(raw);
        return `${field.label}: ${display}`;
      })
      .filter(Boolean)
      .slice(0, 2);
    if (!rows.length) return null;
    return (
      <div className="kb-chips">
        {rows.map((row, idx) => (
          <span key={idx} className="kb-chip">
            {row}
          </span>
        ))}
      </div>
    );
  };

  const money = (n: number) => new Intl.NumberFormat(locale).format(Math.round(n));

  const leadAgeDays = (iso: string) => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return Math.max(0, days);
  };

  const suppressCardClickRef = useRef(false);
  const kanbanSensors = useKanbanSensors();
  const { ref: boardScrollRef } = useHorizontalWheelScroll<HTMLDivElement>();
  const activeDragLead = useMemo(() => leads.find((l) => l.id === dragLeadId) ?? null, [leads, dragLeadId]);

  const handleDropTo = (leadId: string, status: LeadStatus) => {
    const lead = leads.find((l) => l.id === leadId);
    if (lead && lead.canEdit === false) {
      showAlert(t('crm.leads.access.forbiddenEdit'));
      return;
    }

    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId ? { ...lead, status } : lead,
      ),
    );

    updateLeadStatus(leadId, status).catch((e) => {
      console.error('Ошибка смены статуса', e);
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId && lead ? { ...l, status: lead.status } : l)),
      );
    });
  };

  const handleDragStart = (leadId: string) => {
    setDragLeadId(leadId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event;
    setDragLeadId(null);
    if (delta.x !== 0 || delta.y !== 0) suppressCardClickRef.current = true;
    if (!over) return;
    handleDropTo(String(active.id), over.id as LeadStatus);
  };

  const leadsByStatus = (status: LeadStatus) =>
    boardLeads.filter((lead) => lead.status === status);

  const handleCreateLead = () => navigate('/leads/new');
  const handleOpenLead = (id: string) => navigate(`/leads/${id}`);
  const goList = () => navigate('/leads');
  const goBoard = () => navigate('/leads/board');
  const goCalendar = () => navigate('/leads/calendar');

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

  return (
    <MainLayout>
      <PageHelpButton topic="leads" />
      <div
        className="lv-pt lv-kb w-full pb-8 min-w-0 space-y-5"
        style={{ marginLeft: -24, marginRight: -24, paddingLeft: 24, paddingRight: 24, width: 'calc(100% + 48px)' }}
      >
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

        <div className="lv-pt-head">
          <div>
            <h1>{t('crm.leads.board.title')}</h1>
            <div className="sub">{t('crm.leads.board.subtitle')}</div>
          </div>
          <div className="lv-pt-head-actions">
            <button type="button" className="lv-tb-btn" onClick={() => setCustomFieldsOpen(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              {t('crm.leads.board.actions.customizeFields')}
            </button>
            <button
              type="button"
              onClick={handleCreateLead}
              className="lv-tb-btn"
              style={{ background: '#222', color: '#fff', borderColor: '#222', borderRadius: 8 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t('crm.leads.board.create')}
            </button>
          </div>
        </div>

        <div className="lv-view-tabs">
          <button type="button" className={`lv-view-tab${isListTab ? ' active' : ''}`} onClick={goList}>
            {t('crm.leads.list.viewList')}
            <span className="badge">{filteredLeads.length}</span>
          </button>
          <button type="button" className={`lv-view-tab${isKanbanTab ? ' active' : ''}`} onClick={goBoard}>
            {t('crm.leads.list.viewKanban')}
          </button>
          <button type="button" className={`lv-view-tab${isCalendarTab ? ' active' : ''}`} onClick={goCalendar}>
            {calendarLabel}
          </button>
          {canManageAccess && (
            <button type="button" className="lv-view-tab" onClick={() => navigate('/leads/access')}>
              {t('crm.leads.access.tabLabel')}
            </button>
          )}
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
                        navigate('/leads/board');
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
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}
        {loading && !error && (
          <div className="text-[12px] text-slate-400">{t('crm.leads.board.loading')}</div>
        )}

        {!loading && !error && (
          <div className="kb-strip">
            <div className="cell">
              <div className="k">{t('crm.leads.board.summary.open')}</div>
              <div className="v">
                {money(summary.openSum)}
                <span className="cur">₺</span>
              </div>
              <div className="d">
                {t('crm.leads.board.summary.openHint', { count: boardLeads.filter((l) => OPEN_STATUSES.includes(l.status)).length })}
              </div>
            </div>
            <div className="cell">
              <div className="k">{t('crm.leads.board.summary.wonThisMonth')}</div>
              <div className="v">
                {money(summary.wonSum)}
                <span className="cur">₺</span>
              </div>
              <div className="d">{t('crm.leads.board.summary.wonThisMonthHint', { count: summary.wonCount })}</div>
            </div>
            <div className="cell">
              <div className="k">{t('crm.leads.board.summary.conversion')}</div>
              <div className="v">
                {summary.conversion}
                <span className="cur">%</span>
              </div>
              <div className="d">{t('crm.leads.board.summary.conversionHint')}</div>
            </div>
            <div className="cell">
              <div className="k">{t('crm.leads.board.summary.overdue')}</div>
              <div className="v">{summary.overdue}</div>
              <div className="d">{t('crm.leads.board.summary.overdueHint')}</div>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="lv-toolbar">
            <div className="lv-tb-search">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.5-4.5" />
              </svg>
              <input
                value={boardSearch}
                onChange={(e) => setBoardSearch(e.target.value)}
                placeholder={t('crm.leads.board.searchPlaceholder')}
              />
            </div>
            <div className="lv-toolbar-divider" />
            <label className="lv-tb-select">
              <span className="lbl">{t('crm.leads.board.ownerFilterLabel')}</span>
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                style={{ border: 0, background: 'transparent', font: 'inherit', color: 'var(--ink)', outline: 'none', appearance: 'none', WebkitAppearance: 'none' }}
              >
                <option value="all">{t('crm.leads.board.ownerFilterAll')}</option>
                {ownerOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={`lv-tb-btn${density === 'compact' ? ' active' : ''}`}
              onClick={() => setDensity((d) => (d === 'compact' ? 'comfort' : 'compact'))}
            >
              {t('crm.leads.board.densityToggle')}
            </button>
            <div className="lv-toolbar-spacer" />
          </div>
        )}

        {!loading && !error && (
          <DndContext sensors={kanbanSensors} collisionDetection={kanbanCollisionDetection} onDragStart={(e) => handleDragStart(String(e.active.id))} onDragEnd={handleDragEnd}>
            <div className={`kb-board${density === 'compact' ? ' compact' : ''}`} ref={boardScrollRef}>
            {(() => {
              const maxColCount = Math.max(1, ...STATUSES.map((c) => leadsByStatus(c.id).length));
              return STATUSES.map((col) => {
                const colLeads = leadsByStatus(col.id);
                const accent = STATUS_ACCENT[col.id] ?? '#3b82f6';
                const sum = colLeads.reduce((s, l) => s + l.amount, 0);
                return (
                  <DroppableLeadColumn key={col.id} id={col.id} className="kb-col">
                    <div className="kb-col-head">
                      <div className="kb-col-titlerow">
                        <span className="kb-dot" style={{ background: accent }} />
                        <span className="kb-col-title">{t(`crm.leads.statuses.${col.key}`)}</span>
                        <span className="kb-count">{colLeads.length}</span>
                      </div>
                      <div className="kb-col-meta">
                        <span>
                          <b>{money(sum)}</b> ₺
                        </span>
                        {colLeads.length > 0 && <span>· ~{money(sum / colLeads.length)} ₺</span>}
                      </div>
                      <div className="kb-meter">
                        <i style={{ width: `${Math.round((colLeads.length / maxColCount) * 100)}%`, background: accent }} />
                      </div>
                    </div>

                    <div className="kb-list">
                      {colLeads.length === 0 && (
                        <div className="kb-empty">{t('crm.leads.board.empty')}</div>
                      )}
                      {colLeads.map((lead) => {
                        const org = (lead.companyId && companiesMap[lead.companyId]?.name) || '';
                        const ownerLabel = lead.assignedTo?.trim() || '';
                        const nextStep = nextLeadTask(lead.tasks);
                        const overdue = Boolean(nextStep && isTaskOverdue(nextStep));
                        const doneCount = lead.tasks.filter((tsk) => tsk.done).length;
                        return (
                          <DraggableLeadCard
                            key={lead.id}
                            id={lead.id}
                            disabled={lead.canEdit === false}
                            onClick={() => {
                              if (suppressCardClickRef.current) { suppressCardClickRef.current = false; return; }
                              handleOpenLead(lead.id);
                            }}
                            className={`kb-card${dragLeadId === lead.id ? ' dragging' : ''}`}
                          >
                            <div className="kb-card-top">
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="kb-name">{lead.name}</div>
                                {org && <div className="kb-sub">{org}</div>}
                              </div>
                              <span className="kb-id">#{lead.id.slice(0, 6)}</span>
                            </div>

                            {(lead.channel || activeCustomFields.length > 0) && (
                              <div className="kb-chips">
                                {lead.channel && <span className="kb-chip src">{lead.channel}</span>}
                              </div>
                            )}
                            {renderCustomPreview(lead)}

                            <div className="kb-val">
                              {lead.amount > 0 ? (
                                <>
                                  <span className="n">{money(lead.amount)}</span>
                                  <span className="c">{currencySymbol(lead.currency)}</span>
                                </>
                              ) : (
                                <span className="c">{t('crm.leads.board.amountNotSet')}</span>
                              )}
                              <span className="age">
                                {leadAgeDays(lead.createdAt) === 0
                                  ? t('crm.leads.board.ageToday')
                                  : t('crm.leads.board.ageDays', { count: leadAgeDays(lead.createdAt) })}
                              </span>
                            </div>

                            {nextStep && (
                              <div className={`kb-next${overdue ? ' over' : ''}`}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <rect x="3" y="5" width="18" height="16" rx="2" />
                                  <path d="M3 10h18" />
                                  <path d="M8 3v4" />
                                  <path d="M16 3v4" />
                                </svg>
                                <span className="t">{nextStep.title}</span>
                                <span className="d">
                                  {overdue
                                    ? t('crm.leads.board.overdue')
                                    : new Date(nextStep.deadline!).toLocaleDateString(locale)}
                                </span>
                              </div>
                            )}

                            <div className="kb-foot">
                              {ownerLabel && (
                                <span className="kb-ava" title={ownerLabel}>
                                  {initialsFromName(ownerLabel)}
                                </span>
                              )}
                              {lead.tasks.length > 0 && (
                                <span className="kb-prog" title={`${doneCount}/${lead.tasks.length}`}>
                                  {lead.tasks.map((tsk, i) => (
                                    <i key={i} className={tsk.done ? 'on' : ''} />
                                  ))}
                                </span>
                              )}
                              <span className="sp" />
                              {lead.commentsCount > 0 && (
                                <span className="kb-mini on">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                    <path d="M21 12a8 8 0 11-3-6.2L21 5l-1 4" />
                                    <path d="M21 12a8 8 0 01-12 7l-5 1 1-4" />
                                  </svg>
                                  {lead.commentsCount}
                                </span>
                              )}
                            </div>
                          </DraggableLeadCard>
                        );
                      })}
                    </div>
                  </DroppableLeadColumn>
                );
              });
            })()}
            </div>
            <DragOverlay>
              {/* DragOverlay portals to document.body, outside the .lv-kb scope its CSS classes rely on — re-establish it here (a real DOM ancestor, not just a class on the same node). */}
              {activeDragLead ? (
                <div className="lv-kb">
                  <div className="kb-card" style={{ cursor: 'grabbing', width: 268, boxShadow: '0 12px 28px rgba(16,24,40,.18)' }}>
                    <div className="kb-card-top">
                      <div className="kb-name">{activeDragLead.name}</div>
                    </div>
                    <div className="kb-val">
                      {activeDragLead.amount > 0 ? (
                        <>
                          <span className="n">{money(activeDragLead.amount)}</span>
                          <span className="c">{currencySymbol(activeDragLead.currency)}</span>
                        </>
                      ) : (
                        <span className="c">{t('crm.leads.board.amountNotSet')}</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
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
      </div>
    </MainLayout>
  );
};
