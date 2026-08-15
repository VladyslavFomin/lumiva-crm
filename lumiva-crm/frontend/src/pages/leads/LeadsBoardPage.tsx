// src/pages/leads/LeadsBoardPage.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Lead, LeadStatus } from '../../api/leads';
import { fetchLeads, updateLeadStatus } from '../../api/leads';
import {
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
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

export const LeadsBoardPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showConfirm } = useAlertModal();
  const locale = resolveLocale(i18n.language);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
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
      <div className="mt-2 flex flex-wrap gap-1">
        {rows.map((row, idx) => (
          <span
            key={idx}
            className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 truncate max-w-full"
          >
            {row}
          </span>
        ))}
      </div>
    );
  };

  const formatLeadDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(locale);
    } catch {
      return iso;
    }
  };

  const handleDragStart = (leadId: string) => {
    setDragLeadId(leadId);
  };

  const handleDropTo = (status: LeadStatus) => {
    if (!dragLeadId) return;

    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === dragLeadId ? { ...lead, status } : lead,
      ),
    );

    updateLeadStatus(dragLeadId, status).catch((e) => {
      console.error('Ошибка смены статуса', e);
    });

    setDragLeadId(null);
  };

  const leadsByStatus = (status: LeadStatus) =>
    filteredLeads.filter((lead) => lead.status === status);

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
      <div
        className="lv-pt w-full pb-8 min-w-0 space-y-5"
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
          <div className="flex gap-3 overflow-x-auto pb-1">
            {STATUSES.map((col) => {
              const colLeads = leadsByStatus(col.id);
              const accent = STATUS_ACCENT[col.id] ?? '#3b82f6';
              return (
                <div
                  key={col.id}
                  className="flex-1 min-w-[260px] max-w-xs bg-white border border-slate-200 rounded-3xl p-3 flex flex-col"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropTo(col.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-slate-700 font-semibold">
                      {t(`crm.leads.statuses.${col.key}`)}
                    </div>
                    <div className="text-[10px] text-slate-500">{colLeads.length}</div>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto">
                    {colLeads.map((lead) => {
                      const leftLabel = lead.assignedTo?.trim() || lead.channel || '—';
                      return (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={() => handleDragStart(lead.id)}
                          onClick={() => handleOpenLead(lead.id)}
                          className="group relative cursor-move rounded-2xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                          style={{ borderLeftWidth: 4, borderLeftColor: accent }}
                        >
                          <div className="flex items-start justify-between mb-1 gap-2">
                            <div className="font-medium truncate min-w-0">{lead.name}</div>
                            <div className="text-[10px] text-slate-500 whitespace-nowrap font-mono">
                              #{lead.id.slice(0, 8)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] text-slate-600 truncate">{leftLabel}</span>
                            <span className="text-[10px] text-slate-500 shrink-0">
                              {formatLeadDate(lead.createdAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full w-0 rounded-full bg-rose-500" />
                            </div>
                            <span className="text-[10px] font-semibold text-rose-500">0%</span>
                          </div>
                          {renderCustomPreview(lead)}
                        </div>
                      );
                    })}

                    {colLeads.length === 0 && (
                      <div className="text-[11px] text-slate-500 italic px-1 py-2">
                        {t('crm.leads.board.empty')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
