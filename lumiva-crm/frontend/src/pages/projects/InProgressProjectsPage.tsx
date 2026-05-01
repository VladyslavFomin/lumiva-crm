// src/pages/projects/InProgressProjectsPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { fetchProjects } from '../../api/projects';
import { type Project } from './projectTypes';
import { useTranslation } from 'react-i18next';
import {
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';
import { useWorkspaceStyleColumnDrag } from '../../components/table/useWorkspaceStyleColumnDrag';
import { WorkspaceCrmEntityMultiField } from '../../components/workspace/WorkspaceCrmEntityMultiField';
import {
  fetchLeadsList,
  isLeadOmittedFromAnalytics,
  type Lead,
} from '../../api/leads';
import { fetchCompanies, type Company } from '../../api/companies';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { ProjectTableOwnerCell } from '../../components/projects/ProjectTableOwnerCell';
import './ProjectsListPage.css';

/** Как на /projects/closed: `rounded-full` + палитра workspace. */
const PROJECT_STATUS_PILL_CLASS: Record<string, string> = {
  Новый: 'bg-slate-100 text-slate-700 border border-slate-200',
  'В работе': 'bg-sky-100 text-sky-700 border border-sky-200',
  'На проверке': 'bg-violet-100 text-violet-700 border border-violet-200',
  Заморожен: 'bg-amber-100 text-amber-700 border border-amber-200',
  Выиграно: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  Проиграно: 'bg-rose-100 text-rose-700 border border-rose-200',
  Закрыт: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
};

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

export const InProgressProjectsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizing, setResizing] = useState<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [crmLeads, setCrmLeads] = useState<Lead[]>([]);
  const [crmCompanies, setCrmCompanies] = useState<Company[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const navigate = useNavigate();

  const reloadCrmLists = useCallback(() => {
    void fetchLeadsList()
      .then((list) =>
        setCrmLeads(list.filter((l) => !isLeadOmittedFromAnalytics(l))),
      )
      .catch(() => setCrmLeads([]));
    void fetchCompanies({ limit: 500 })
      .then((res) => setCrmCompanies(res.items ?? []))
      .catch(() => setCrmCompanies([]));
  }, []);

  const statusLabels = useMemo<Record<string, string>>(
    () => ({
      Новый: t('crm.projects.statuses.new'),
      'В работе': t('crm.projects.statuses.inProgress'),
      'На проверке': t('crm.projects.statuses.review'),
      Заморожен: t('crm.projects.statuses.paused'),
      Выиграно: t('crm.projects.statuses.won'),
      Проиграно: t('crm.projects.statuses.lost'),
    }),
    [t],
  );

  const categoryLabels = useMemo<Record<string, string>>(
    () => ({
      Аналитика: t('crm.projects.categories.analytics'),
      Разработка: t('crm.projects.categories.development'),
      Маркетинг: t('crm.projects.categories.marketing'),
      Реклама: t('crm.projects.categories.ads'),
      SEO: t('crm.projects.categories.seo'),
      SMM: t('crm.projects.categories.smm'),
    }),
    [t],
  );

  const currency = items[0]?.currency || 'EUR';
  const formatAmount = (amount: number) =>
    t('crm.projects.common.amountWithCurrency', {
      amount: new Intl.NumberFormat(locale).format(amount),
      currency,
    });

  const activeCustomFields = useMemo(
    () => customFields.filter((field) => field.isActive),
    [customFields],
  );

  const suggestedKeys = useMemo(() => {
    const keys = new Set<string>();
    items.forEach((p) => {
      Object.keys(p.customFields ?? {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys);
  }, [items]);

  const baseColumns = useMemo(
    () => [
      { id: 'name', label: t('crm.projects.inProgress.table.headers.project') },
      { id: 'category', label: t('crm.projects.inProgress.table.headers.category') },
      { id: 'status', label: t('crm.projects.inProgress.table.headers.status') },
      { id: 'owner', label: t('crm.projects.inProgress.table.headers.owner') },
      { id: 'lead', label: t('crm.projects.inProgress.table.headers.lead') },
      { id: 'company', label: t('crm.projects.inProgress.table.headers.company') },
      { id: 'amount', label: t('crm.projects.inProgress.table.headers.amount') },
      { id: 'created', label: t('crm.projects.inProgress.table.headers.created') },
    ],
    [t],
  );

  const columns = useMemo(() => {
    const customCols = activeCustomFields.map((field) => ({
      id: `cf:${field.id}`,
      label: field.label,
      field,
    }));
    return [...baseColumns, ...customCols];
  }, [activeCustomFields, baseColumns]);

  const orderedColumns = useMemo(() => {
    if (!columns.length) return [];
    const map = new Map(columns.map((col) => [col.id, col]));
    const order =
      columnOrder.length > 0 ? columnOrder : columns.map((col) => col.id);
    const result: typeof columns = [];
    order.forEach((id) => {
      const col = map.get(id);
      if (col) result.push(col);
    });
    columns.forEach((col) => {
      if (!result.find((r) => r.id === col.id)) result.push(col);
    });
    return result;
  }, [columns, columnOrder]);

  const getColumnWidth = (id: string, fallback: number) =>
    columnWidths[id] ?? fallback;

  useEffect(() => {
    reloadCrmLists();
  }, [reloadCrmLists]);

  useEffect(() => {
    let alive = true;
    fetchStaff()
      .then((list) => {
        if (alive) setStaff(list);
      })
      .catch(() => {
        if (alive) setStaff([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('projects_inprogress_columns');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.order)) setColumnOrder(parsed.order);
        if (parsed.widths && typeof parsed.widths === 'object')
          setColumnWidths(parsed.widths);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'projects_inprogress_columns',
        JSON.stringify({ order: columnOrder, widths: columnWidths }),
      );
    } catch {
      // ignore
    }
  }, [columnOrder, columnWidths]);

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

  const { getThProps, draggingColumnKey, columnDragOverKey } =
    useWorkspaceStyleColumnDrag(reorderColumns, 'light');

  const renderCustomFieldCell = (project: Project, field: CustomField) => {
    const value = project.customFields?.[field.key];
    const textMuted = 'text-[11px] text-slate-600 text-center';

    if (field.type === 'boolean') {
      return <span className={textMuted}>{value ? 'Да' : 'Нет'}</span>;
    }

    if (field.type === 'select') {
      const opt = (field.options || []).find((o) => o.value === value);
      const label = opt?.label ?? (value != null && value !== '' ? String(value) : null);
      return <span className={textMuted}>{label ?? '—'}</span>;
    }

    if (value === null || value === undefined || value === '') {
      return <span className={`${textMuted} text-slate-400`}>—</span>;
    }
    return <span className={textMuted}>{String(value)}</span>;
  };

  const renderCell = (
    project: Project,
    column: { id: string; label: string; field?: CustomField },
  ) => {
    switch (column.id) {
      case 'name':
        return (
          <span
            className="block text-xs font-medium text-slate-800 truncate"
            title={project.name}
          >
            {project.name || '—'}
          </span>
        );
      case 'category': {
        const raw = project.category?.trim();
        if (!raw) {
          return <span className="text-[11px] text-slate-400 text-center block">—</span>;
        }
        return (
          <span className="block text-[11px] text-slate-700 text-center">
            {categoryLabels[raw] ?? raw}
          </span>
        );
      }
      case 'status': {
        const st = project.status;
        const pill =
          PROJECT_STATUS_PILL_CLASS[st] ??
          'bg-slate-100 text-slate-700 border border-slate-200';
        return (
          <div className="flex justify-center">
            <span
              className={`inline-flex max-w-full items-center justify-center rounded-full px-2.5 py-1 text-center text-xs font-medium ${pill}`}
            >
              <span className="truncate">{statusLabels[st] ?? st}</span>
            </span>
          </div>
        );
      }
      case 'owner':
        return (
          <ProjectTableOwnerCell
            project={project}
            staff={staff}
            onUpdated={(up) =>
              setItems((prev) => prev.map((x) => (x.id === up.id ? up : x)))
            }
          />
        );
      case 'lead':
        return (
          <WorkspaceCrmEntityMultiField
            readOnly
            entity="lead"
            rawValue={project.leadId}
            leads={crmLeads}
            projects={[]}
            companies={[]}
            variant="table"
          />
        );
      case 'company':
        return (
          <WorkspaceCrmEntityMultiField
            readOnly
            entity="company"
            rawValue={project.companyId ?? ''}
            leads={[]}
            projects={[]}
            companies={crmCompanies}
            variant="table"
          />
        );
      case 'amount':
        return (
          <span className="block text-[11px] text-slate-800 text-center tabular-nums">
            {formatAmount(project.amount)}
          </span>
        );
      case 'created':
        return (
          <span className="block text-[11px] text-slate-600 tabular-nums leading-snug">
            {project.createdAt}
          </span>
        );
      default:
        if (column.field) return renderCustomFieldCell(project, column.field);
        return null;
    }
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchProjects({ status: 'В работе' })
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
      })
      .catch((e: any) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.projects.inProgress.errors.loadFailed'));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchCustomFields('project')
      .then((list) => {
        if (!alive) return;
        setCustomFields([...list].sort((a, b) => a.order - b.order));
      })
      .catch((e) => console.error('Ошибка загрузки кастомных полей:', e));
    return () => {
      alive = false;
    };
  }, []);

  const totalAmount = useMemo(
    () => items.reduce((sum, p) => sum + (p.amount || 0), 0),
    [items],
  );

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        <section className="flex flex-col gap-1">
          <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
            {t('crm.projects.inProgress.kicker')}
          </div>
          <h1 className="text-lg md:text-xl font-semibold text-lumiva-accent">
            {t('crm.projects.inProgress.title')}
          </h1>
          <p className="text-xs text-slate-600 max-w-2xl">
            {t('crm.projects.inProgress.subtitle')}
          </p>
        </section>

        {error && (
          <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-[11px] text-slate-500 uppercase tracking-[0.18em]">
              {t('crm.projects.inProgress.kpis.count')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-lumiva-accent">
              {items.length.toLocaleString(locale)}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-[11px] text-slate-500 uppercase tracking-[0.18em]">
              {t('crm.projects.inProgress.kpis.amount')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-lumiva-accent">
              {formatAmount(totalAmount)}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-[11px] text-slate-500 uppercase tracking-[0.18em]">
              {t('crm.projects.inProgress.kpis.categories')}
            </div>
            <div className="mt-1 text-xl font-semibold text-lumiva-accent">
              {new Set(items.map((p) => p.category || '')).size}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-5 md:py-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-lumiva-accent">
              {t('crm.projects.inProgress.table.title')}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500">
                {t('crm.projects.inProgress.table.total', { count: items.length })}
              </span>
              <button
                type="button"
                onClick={() => setCustomFieldsOpen(true)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                + Колонка
              </button>
            </div>
          </div>
          {loading ? (
            <div className="text-xs text-slate-500">
              {t('crm.projects.inProgress.loading')}
            </div>
          ) : (
            <div className="lv-proj-wrap">
              <div className="lv-proj-scroll">
                <table className="lv-proj-table lv-leads-table">
                  <thead>
                    <tr>
                      {orderedColumns.map((col) => {
                        const fallback =
                          col.id === 'name'
                            ? 220
                            : col.id === 'category'
                              ? 160
                              : col.id === 'status'
                                ? 160
                                : col.id === 'owner'
                                  ? 160
                                  : col.id === 'lead' || col.id === 'company'
                                    ? 200
                                    : col.id === 'amount'
                                      ? 140
                                      : col.id === 'created'
                                        ? 160
                                        : 180;
                        const width = getColumnWidth(col.id, fallback);
                        const isDragging = draggingColumnKey === col.id;
                        const isDropTarget = columnDragOverKey === col.id && !isDragging;
                        return (
                          <th
                            key={col.id}
                            {...(() => {
                              const props = getThProps(
                                col.id,
                                typeof col.label === 'string' ? col.label : String(col.label),
                                '',
                              );
                              const { className: _c, ...rest } = props as any;
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
                            <span
                              className="lv-th-resize"
                              onMouseDown={(e) => startResize(col.id, e)}
                            />
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && (
                      <tr>
                        <td
                          colSpan={orderedColumns.length}
                          className="py-3 text-center text-[var(--fg-3)]"
                        >
                          {t('crm.projects.inProgress.empty')}
                        </td>
                      </tr>
                    )}
                    {items.map((p) => (
                      <tr
                        key={p.id}
                        className="lv-proj-row"
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        {orderedColumns.map((col) => {
                          const fallback =
                            col.id === 'name'
                              ? 220
                              : col.id === 'category'
                                ? 160
                                : col.id === 'status'
                                  ? 160
                                  : col.id === 'owner'
                                    ? 160
                                    : col.id === 'lead' || col.id === 'company'
                                      ? 200
                                      : col.id === 'amount'
                                        ? 140
                                        : col.id === 'created'
                                          ? 160
                                          : 180;
                          const width = getColumnWidth(col.id, fallback);
                          return (
                            <td
                              key={col.id}
                              className={[
                                ['owner', 'lead', 'company'].includes(col.id)
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
                                verticalAlign: 'middle',
                                whiteSpace: 'nowrap',
                              }}
                              onClick={(e) => {
                                if (['owner', 'lead', 'company'].includes(col.id)) {
                                  e.stopPropagation();
                                }
                              }}
                            >
                              {renderCell(p, col)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
        {customFieldsOpen && (
          <CustomFieldsManager
            entityType="project"
            title="Кастомные поля проектов"
            suggestedKeys={suggestedKeys}
            onClose={() => setCustomFieldsOpen(false)}
            onUpdated={(list) =>
              setCustomFields([...list].sort((a, b) => a.order - b.order))
            }
          />
        )}
      </div>
    </MainLayout>
  );
};
