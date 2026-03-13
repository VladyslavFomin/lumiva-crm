// src/pages/leads/LeadsListPage.tsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Lead, LeadStatus } from '../../api/leads';
import { fetchLeads, updateLead, deleteLead } from '../../api/leads';
import {
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';
import { AutomationPanel } from '../../components/AutomationPanel';

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

export const LeadsListPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [dragColumnId, setDragColumnId] = useState<string | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [groupByStatus, setGroupByStatus] = useState(true);
  const [collapsedStatuses, setCollapsedStatuses] = useState<LeadStatus[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<LeadStatus | ''>('');
  const [showArchived, setShowArchived] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [resizing, setResizing] = useState<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);

  const navigate = useNavigate();

  const handleCreateLead = () => navigate('/app/leads/new');
  const handleOpenLead = (id: string) => navigate(`/app/leads/${id}`);
  const goBoard = () => navigate('/app/leads/board');
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
  const statusStyles = useMemo(
    () => ({
      'Новый клиент': 'bg-rose-500/15 text-rose-600 border-rose-500/30',
      'В работе': 'bg-sky-500/15 text-sky-600 border-sky-500/30',
      'Ожидает ответа': 'bg-amber-400/30 text-amber-900 border-amber-400/40',
      'Закрыт (успех)': 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
      'Закрыт (проигран)': 'bg-rose-500/15 text-rose-600 border-rose-500/30',
    }),
    [],
  );
  const isArchivedLead = (lead: Lead) => Boolean(lead.meta?.archived);
  const isDeletedLead = (lead: Lead) => Boolean(lead.meta?.deleted);
  const toggleCollapsed = (status: LeadStatus) => {
    setCollapsedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
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
  const formatUtm = (lead: Lead) => {
    const parts = [lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(
      (v) => v && String(v).trim().length > 0,
    );
    return parts.length ? parts.join(' / ') : t('crm.leads.list.emptyValue');
  };
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

  const baseColumns = useMemo(
    () => [
      { id: 'name', label: t('crm.leads.list.columns.name') },
      { id: 'channel', label: t('crm.leads.list.columns.channel') },
      { id: 'utm', label: t('crm.leads.list.columns.utm') },
      { id: 'utmSource', label: 'UTM Source' },
      { id: 'utmMedium', label: 'UTM Medium' },
      { id: 'utmCampaign', label: 'UTM Campaign' },
      { id: 'utmTerm', label: 'UTM Term' },
      { id: 'utmContent', label: 'UTM Content' },
      { id: 'status', label: t('crm.leads.list.columns.status') },
      { id: 'created', label: t('crm.leads.list.columns.created') },
    ],
    [t],
  );
  const coreColumnIds = useMemo(
    () => new Set(['name', 'status', 'created']),
    [],
  );

  const columns = useMemo(() => {
    const customCols = activeCustomFields.map((field) => ({
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
    if (id === 'name') return 220;
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

  const startResize = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      id,
      startX: e.clientX,
      startWidth: columnWidths[id] ?? 160,
    });
  };

  const handleColumnDrop = (targetId: string) => {
    if (!dragColumnId || dragColumnId === targetId) return;
    setColumnOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragColumnId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragColumnId);
      return next;
    });
    setDragColumnId(null);
  };

  const showColumn = (id: string) => {
    setHiddenColumns((prev) => prev.filter((colId) => colId !== id));
  };
  const hideColumn = (id: string) => {
    if (coreColumnIds.has(id)) return;
    setHiddenColumns((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const filteredLeads = useMemo(() => {
    const withoutDeleted = leads.filter((l) => !isDeletedLead(l));
    return showArchived
      ? withoutDeleted
      : withoutDeleted.filter((l) => !isArchivedLead(l));
  }, [leads, showArchived]);

  const groupedLeads = useMemo(() => {
    return statusOptions.map((status) => ({
      status,
      items: filteredLeads.filter((lead) => lead.status === status),
    }));
  }, [filteredLeads, statusOptions]);

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
      'w-full px-2 py-1 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-200 outline-none focus:border-lumiva-accent-soft';

    if (field.type === 'boolean') {
      return (
        <label className="inline-flex items-center gap-2 text-[11px] text-slate-300">
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
          />
          {Boolean(value) ? 'Да' : 'Нет'}
        </label>
      );
    }

    if (field.type === 'select') {
      return (
        <select
          className={commonClass}
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

  const renderCell = (lead: Lead, column: any) => {
    switch (column.id) {
      case 'name':
        return (
          <input
            value={lead.name}
            onChange={(e) =>
              setLeads((prev) =>
                prev.map((l) =>
                  l.id === lead.id ? { ...l, name: e.target.value } : l,
                ),
              )
            }
            onBlur={(e) =>
              updateLeadInline(lead.id, { name: e.target.value }, { name: e.target.value })
            }
            className="w-full px-2 py-1 rounded-lg bg-transparent border border-transparent text-slate-100 text-xs focus:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          />
        );
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
            className="w-full px-2 py-1 rounded-lg bg-transparent border border-transparent text-slate-300 text-xs focus:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          />
        );
      case 'utm':
        return <span>{formatUtm(lead)}</span>;
      case 'utmSource':
        return <span>{lead.utmSource || t('crm.leads.list.emptyValue')}</span>;
      case 'utmMedium':
        return <span>{lead.utmMedium || t('crm.leads.list.emptyValue')}</span>;
      case 'utmCampaign':
        return <span>{lead.utmCampaign || t('crm.leads.list.emptyValue')}</span>;
      case 'utmTerm':
        return <span>{lead.utmTerm || t('crm.leads.list.emptyValue')}</span>;
      case 'utmContent':
        return <span>{lead.utmContent || t('crm.leads.list.emptyValue')}</span>;
      case 'status':
        return (
          <select
            value={lead.status}
            onChange={(e) =>
              updateLeadInline(
                lead.id,
                { status: e.target.value as LeadStatus },
                { status: e.target.value as LeadStatus },
              )
            }
            className={`w-full px-2 py-1 rounded-full border text-[11px] font-semibold appearance-none ${statusStyles[lead.status] ?? 'bg-slate-900 text-slate-200 border-slate-800'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        );
      case 'created':
        return <span>{new Date(lead.createdAt).toLocaleString(locale)}</span>;
      default:
        if (column.field) return renderCustomFieldCell(lead, column.field);
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

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">
              {t('crm.leads.list.title')}
            </h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.leads.list.subtitle')}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {/* Переключатель вида */}
            <div className="inline-flex rounded-xl bg-slate-900/80 border border-slate-700/80 text-[11px] overflow-hidden">
              <button
                className="px-3 py-1.5 text-slate-300 hover:bg-lumiva-accent/10 hover:text-slate-100 transition-colors"
                type="button"
                onClick={goBoard}
              >
                {t('crm.leads.list.viewKanban')}
              </button>
              <button
                className="px-3 py-1.5 bg-slate-800 text-slate-50"
                type="button"
              >
                {t('crm.leads.list.viewList')}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setAutomationOpen(true)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-700/80 text-slate-200 hover:bg-slate-900/80 inline-flex items-center gap-2"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 2v4" />
                <path d="M12 18v4" />
                <path d="M4 12h4" />
                <path d="M16 12h4" />
                <path d="M7.8 7.8l2.8 2.8" />
                <path d="M13.4 13.4l2.8 2.8" />
                <path d="M16.2 7.8l-2.8 2.8" />
                <path d="M10.6 13.4l-2.8 2.8" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
              {t('crm.automations.panel.button')}
            </button>

            <button
              type="button"
              onClick={() => setGroupByStatus((prev) => !prev)}
              className={`px-3 py-1.5 text-xs rounded-xl border ${
                groupByStatus
                  ? 'border-slate-500 text-slate-100 bg-slate-900/80'
                  : 'border-slate-700/80 text-slate-200 hover:bg-slate-900/80'
              }`}
            >
              {t('crm.leads.list.groupByStatus')}
            </button>

            <button
              type="button"
              onClick={() => setShowArchived((prev) => !prev)}
              className={`px-3 py-1.5 text-xs rounded-xl border ${
                showArchived
                  ? 'border-slate-500 text-slate-100 bg-slate-900/80'
                  : 'border-slate-700/80 text-slate-200 hover:bg-slate-900/80'
              }`}
            >
              {t('crm.leads.list.showArchived')}
            </button>

            <div className="relative" ref={columnsMenuRef}>
              <button
                type="button"
                onClick={() => setColumnsOpen((prev) => !prev)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-700/80 text-slate-200 hover:bg-slate-900/80"
              >
                {t('crm.leads.list.columns.label')}
              </button>
              {columnsOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-800 bg-slate-950 shadow-xl p-2 z-10">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 px-2 py-1">
                    {t('crm.leads.list.columns.label')}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {columns.map((col) => {
                      const checked = !hiddenColumns.includes(col.id);
                      const isCore = coreColumnIds.has(col.id);
                      const keyLabel =
                        col.field?.key ? `(${col.field.key})` : undefined;
                      return (
                        <label
                          key={col.id}
                          className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[11px] ${
                            isCore
                              ? 'text-slate-500'
                              : 'text-slate-200 hover:bg-slate-900/80'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span>{col.label}</span>
                            {keyLabel && (
                              <span className="text-[10px] text-slate-500">
                                {keyLabel}
                              </span>
                            )}
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isCore}
                            onChange={(e) => {
                              if (e.target.checked) showColumn(col.id);
                              else hideColumn(col.id);
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-2 border-t border-slate-800 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setColumnsOpen(false);
                        setCustomFieldsOpen(true);
                      }}
                      className="w-full px-2 py-1.5 text-[11px] rounded-lg bg-slate-900 text-slate-200 hover:bg-slate-800"
                    >
                      {t('crm.leads.list.columns.add')}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleCreateLead}
              className="px-3 py-1.5 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft"
            >
              {t('crm.leads.list.create')}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Таблица */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
          {loading ? (
            <div className="text-xs text-slate-400">
              {t('crm.leads.list.loading')}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="min-w-[720px] w-full text-xs border-separate border-spacing-y-1 table-fixed">
                <thead className="text-slate-500">
                  <tr>
                    <th className="px-2 py-1 w-10">
                      <input
                        type="checkbox"
                        checked={
                          filteredLeads.length > 0 &&
                          filteredLeads.every((lead) =>
                            selectedLeadIds.includes(lead.id),
                          )
                        }
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleAllSelected(filteredLeads);
                        }}
                      />
                    </th>
                    {orderedColumns.map((col) => {
                      const fallback = getFallbackColumnWidth(col.id);
                      const width = getColumnWidth(col.id, fallback);
                      return (
                        <th
                          key={col.id}
                          draggable
                          onDragStart={(e) => {
                            setDragColumnId(col.id);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', col.id);
                          }}
                          onDragEnd={() => setDragColumnId(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleColumnDrop(col.id)}
                          className="text-left px-2 py-1 relative group"
                          style={{ width, minWidth: width }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="cursor-move">⋮⋮</span>
                            <span>{col.label}</span>
                          </div>
                          <div
                            className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100"
                            onMouseDown={(e) => startResize(col.id, e)}
                          />
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {groupByStatus
                    ? groupedLeads.map((group) => {
                        const isCollapsed = collapsedStatuses.includes(group.status);
                        if (!group.items.length) return null;
                        return (
                          <React.Fragment key={group.status}>
                            <tr className="bg-slate-900/70">
                              <td
                                colSpan={orderedColumns.length + 1}
                                className="px-3 py-2 text-slate-200"
                              >
                                <button
                                  type="button"
                                  className="flex items-center gap-2 text-[12px]"
                                  onClick={() => toggleCollapsed(group.status)}
                                >
                                  <span className="text-[10px]">
                                    {isCollapsed ? '▶' : '▼'}
                                  </span>
                                  <span>{group.status}</span>
                                  <span className="text-slate-400">
                                    {group.items.length}
                                  </span>
                                </button>
                              </td>
                            </tr>
                            {!isCollapsed &&
                              group.items.map((lead) => (
                                <tr
                                  key={lead.id}
                                  className="bg-slate-950/80 hover:bg-slate-900/80 cursor-pointer"
                                  onClick={() => handleOpenLead(lead.id)}
                                >
                                  <td className="px-2 py-1.5">
                                    <input
                                      type="checkbox"
                                      checked={selectedLeadIds.includes(lead.id)}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        toggleSelected(lead.id);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </td>
                                  {orderedColumns.map((col) => {
                                    const fallback = getFallbackColumnWidth(col.id);
                                    const width = getColumnWidth(col.id, fallback);
                                    return (
                                      <td
                                        key={col.id}
                                        className="px-2 py-1.5 text-slate-400"
                                        style={{ width, minWidth: width }}
                                      >
                                        {renderCell(lead, col)}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                          </React.Fragment>
                        );
                      })
                    : filteredLeads.map((lead) => (
                        <tr
                          key={lead.id}
                          className="bg-slate-950/80 hover:bg-slate-900/80 cursor-pointer"
                          onClick={() => handleOpenLead(lead.id)}
                        >
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={selectedLeadIds.includes(lead.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleSelected(lead.id);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          {orderedColumns.map((col) => {
                            const fallback = getFallbackColumnWidth(col.id);
                            const width = getColumnWidth(col.id, fallback);
                            return (
                              <td
                                key={col.id}
                                className="px-2 py-1.5 text-slate-400"
                                style={{ width, minWidth: width }}
                              >
                                {renderCell(lead, col)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                  {filteredLeads.length === 0 && !loading && (
                    <tr>
                      <td
                        colSpan={orderedColumns.length + 1}
                        className="px-2 py-2 text-[11px] text-slate-500 italic"
                      >
                        {t('crm.leads.list.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td
                      colSpan={orderedColumns.length + 1}
                      className="px-3 py-2 text-[11px] text-slate-500"
                    >
                      {t('crm.leads.list.summary', {
                        count: filteredLeads.length,
                      })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
      {selectedLeadIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-2rem)] sm:w-auto">
          <div className="flex flex-wrap items-center gap-3 rounded-full border border-[#222222] bg-white px-4 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
            <span className="text-[11px] text-[#222222]/70">
              {t('crm.leads.list.bulk.selected', { count: selectedLeadIds.length })}
            </span>
            <div className="flex items-center gap-2">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as LeadStatus | '')}
                className="px-3 py-1.5 rounded-full bg-white text-[#222222] text-[12px] border border-[#222222]/40"
              >
                <option value="">{t('crm.leads.list.bulk.status')}</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!bulkStatus) return;
                  applyBulkStatus(bulkStatus);
                  setBulkStatus('');
                }}
                className="px-3 py-1.5 text-[12px] rounded-full bg-[#222222] text-white border border-[#222222] hover:bg-black"
              >
                {t('crm.leads.list.bulk.apply')}
              </button>
            </div>
            <button
              type="button"
              onClick={archiveSelected}
              className="px-3 py-1.5 text-[12px] rounded-full border border-[#222222]/50 text-[#222222] hover:bg-[#222222]/5 flex items-center gap-2"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="4" rx="1" />
                <rect x="3" y="10" width="18" height="10" rx="1" />
                <path d="M8 14h8" />
              </svg>
              {t('crm.leads.list.bulk.archive')}
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              className="px-3 py-1.5 text-[12px] rounded-full border border-rose-500 text-rose-600 hover:bg-rose-50 flex items-center gap-2"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <rect x="6" y="6" width="12" height="14" rx="1" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
              {t('crm.leads.list.bulk.delete')}
            </button>
            <button
              type="button"
              onClick={() => setSelectedLeadIds([])}
              className="px-3 py-1.5 text-[12px] rounded-full border border-[#222222]/40 text-[#222222] hover:bg-[#222222]/5"
            >
              {t('crm.leads.list.bulk.clear')}
            </button>
          </div>
        </div>
      )}
      {customFieldsOpen && (
        <CustomFieldsManager
          entityType="lead"
          title="Кастомные поля лидов"
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
    </MainLayout>
  );
};
