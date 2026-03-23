// src/pages/leads/LeadsBoardPage.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Lead, LeadStatus } from '../../api/leads';
import { fetchLeads, updateLeadStatus } from '../../api/leads';
import {
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';
import {
  createLeadsCustomView,
  deleteLeadsCustomView,
  loadLeadsCustomViews,
  type LeadsCustomView,
  updateLeadsCustomView,
} from './leadsViewsStore';

// ВАЖНО: здесь используем именно текстовые статусы,
// которые описаны в api/leads.ts (Новый клиент, В работе, ...)
const STATUSES: { id: LeadStatus; key: string }[] = [
  { id: 'Новый клиент', key: 'new' },
  { id: 'В работе', key: 'inProgress' },
  { id: 'Ожидает ответа', key: 'waiting' },
  { id: 'Закрыт (успех)', key: 'won' },
  { id: 'Закрыт (проигран)', key: 'lost' },
];

export const LeadsBoardPage: React.FC = () => {
  const { t } = useTranslation();
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
      <div className="mt-2 space-y-0.5">
        {rows.map((row, idx) => (
          <div key={idx} className="text-[10px] text-slate-500 truncate">
            {row}
          </div>
        ))}
      </div>
    );
  };

  const handleDragStart = (leadId: string) => {
    setDragLeadId(leadId);
  };

  const handleDropTo = (status: LeadStatus) => {
    if (!dragLeadId) return;

    // оптимистично меняем на фронте
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === dragLeadId ? { ...lead, status } : lead,
      ),
    );

    // и отправляем PATCH на бэкенд
    updateLeadStatus(dragLeadId, status).catch((e) => {
      console.error('Ошибка смены статуса', e);
      // при желании можно сделать откат или перезагрузку
    });

    setDragLeadId(null);
  };

  const leadsByStatus = (status: LeadStatus) =>
    filteredLeads.filter((lead) => lead.status === status);

  const handleCreateLead = () => navigate('/app/leads/new');
  const handleOpenLead = (id: string) => navigate(`/app/leads/${id}`);
  const goList = () => navigate('/app/leads');
  const goCalendar = () => navigate('/app/leads/calendar');
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
        ? '/app/leads'
        : type === 'kanban'
          ? '/app/leads/board'
          : '/app/leads/calendar';
    navigate(viewId ? `${basePath}?view=${viewId}` : basePath);
  };

  const handleCreateView = (type: 'table' | 'kanban' | 'calendar') => {
    const name = window.prompt(t('crm.leads.board.menu.viewNamePrompt'));
    if (!name || !name.trim()) return;
    setCustomViews((prev) => {
      const next = createLeadsCustomView(prev, type, name);
      const created = next[next.length - 1];
      if (created) openView(type, created.id);
      return next;
    });
    setViewsMenuOpen(false);
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="space-y-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">
              {t('crm.leads.board.pageTitle')}
            </h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.leads.board.subtitle')}
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-end gap-1 border-b border-slate-700/70 overflow-x-auto">
              <button
                className="px-3 py-2 text-sm text-slate-50 border-b-2 border-lumiva-accent"
                type="button"
              >
                {t('crm.leads.board.viewKanban')}
              </button>
              <button
                className="px-3 py-2 text-sm text-slate-300 hover:text-slate-100"
                type="button"
                onClick={goList}
              >
                {t('crm.leads.board.viewList')}
              </button>
              <button
                className="px-3 py-2 text-sm text-slate-300 hover:text-slate-100"
                type="button"
                onClick={goCalendar}
              >
                {t('crm.leads.board.viewCalendar')}
              </button>
              {customViews.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => openView(view.type, view.id)}
                  className={`whitespace-nowrap px-3 py-2 text-sm ${
                    activeCustomView?.id === view.id
                      ? 'text-slate-50 border-b-2 border-lumiva-accent'
                      : 'text-slate-300 hover:text-slate-100'
                  }`}
                >
                  {view.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
            <div className="relative" ref={viewsMenuRef}>
              <button
                type="button"
                onClick={() => setViewsMenuOpen((prev) => !prev)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-700/80 text-slate-200 hover:bg-slate-900/80"
              >
                ...
              </button>
              {viewsMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-800 bg-slate-950 shadow-xl p-2 z-20">
                  <button type="button" onClick={() => handleCreateView('table')} className="w-full text-left px-2 py-1.5 text-[11px] rounded-lg text-slate-200 hover:bg-slate-900/80">{t('crm.leads.board.menu.createTable')}</button>
                  <button type="button" onClick={() => handleCreateView('kanban')} className="w-full text-left px-2 py-1.5 text-[11px] rounded-lg text-slate-200 hover:bg-slate-900/80">{t('crm.leads.board.menu.createKanban')}</button>
                  <button type="button" onClick={() => handleCreateView('calendar')} className="w-full text-left px-2 py-1.5 text-[11px] rounded-lg text-slate-200 hover:bg-slate-900/80">{t('crm.leads.board.menu.createCalendar')}</button>
                  {activeCustomView ? (
                    <>
                      <div className="my-1 border-t border-slate-800" />
                      <button
                        type="button"
                        onClick={() => {
                          const nextName = window.prompt(
                            t('crm.leads.board.menu.viewNamePrompt'),
                            activeCustomView.name,
                          );
                          if (!nextName || !nextName.trim()) return;
                          setCustomViews((prev) =>
                            updateLeadsCustomView(prev, activeCustomView.id, { name: nextName.trim() }),
                          );
                          setViewsMenuOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 text-[11px] rounded-lg text-slate-200 hover:bg-slate-900/80"
                      >
                        {t('crm.leads.board.menu.renameView')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomViews((prev) => deleteLeadsCustomView(prev, activeCustomView.id));
                          setViewsMenuOpen(false);
                          navigate('/app/leads/board');
                        }}
                        className="w-full text-left px-2 py-1.5 text-[11px] rounded-lg text-rose-300 hover:bg-rose-950/30"
                      >
                        {t('crm.leads.board.menu.deleteView')}
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </div>
            <button
              onClick={() => setCustomFieldsOpen(true)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-700/80 text-slate-200 hover:bg-slate-900/80"
            >
              {t('crm.leads.board.actions.customizeFields')}
            </button>
            <button
              onClick={handleCreateLead}
              className="px-3 py-1.5 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft"
            >
              {t('crm.leads.board.create')}
            </button>
            </div>
          </div>
        </div>

        {/* Ошибка / загрузка */}
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}
        {loading && !error && (
          <div className="text-xs text-slate-400">{t('crm.leads.board.loading')}</div>
        )}

        {/* Канбан доска */}
        {!loading && !error && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {STATUSES.map((col) => {
              const colLeads = leadsByStatus(col.id);
              return (
                <div
                  key={col.id}
                  className="flex-1 min-w-[230px] max-w-xs bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3 flex flex-col shadow-[0_10px_24px_rgba(15,23,42,0.10)] overflow-hidden"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropTo(col.id)}
                >
                  {/* Шапка колонки */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-slate-300 font-medium">
                      {t(`crm.leads.statuses.${col.key}`)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {colLeads.length}
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto">
                    {colLeads.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => handleDragStart(lead.id)}
                        onClick={() => handleOpenLead(lead.id)}
                        className="cursor-move rounded-xl bg-slate-900/90 border border-slate-800/80 px-3 py-2 text-xs text-slate-100 shadow-[0_6px_14px_rgba(15,23,42,0.10)] overflow-hidden hover:border-lumiva-accent-soft hover:bg-slate-900 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium truncate">
                            {lead.name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            #{lead.id.slice(0, 6)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">
                            {lead.channel}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {lead.createdAt}
                          </span>
                        </div>
                        {renderCustomPreview(lead)}
                      </div>
                    ))}

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
