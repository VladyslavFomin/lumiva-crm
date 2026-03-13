// src/pages/projects/ClosedProjectsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { fetchProjects, updateProject } from '../../api/projects';
import type { Project } from './projectTypes';
import { useTranslation } from 'react-i18next';
import {
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

export const ClosedProjectsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [dragColumnId, setDragColumnId] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const navigate = useNavigate();
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
      { id: 'name', label: t('crm.projects.closed.table.headers.project') },
      { id: 'category', label: t('crm.projects.closed.table.headers.category') },
      { id: 'status', label: t('crm.projects.closed.table.headers.status') },
      { id: 'owner', label: t('crm.projects.closed.table.headers.owner') },
      { id: 'amount', label: t('crm.projects.closed.table.headers.amount') },
      { id: 'created', label: t('crm.projects.closed.table.headers.created') },
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

  const statusOptions: Project['status'][] = [
    'Новый',
    'В работе',
    'На проверке',
    'Заморожен',
    'Выиграно',
    'Проиграно',
  ];

  const updateProjectInline = async (
    id: string,
    patch: Partial<Project>,
  ) => {
    setItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
    const target = items.find((p) => p.id === id);
    if (!target) return;
    try {
      const updated = await updateProject({ ...target, ...patch });
      setItems((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.projects.closed.errors.loadFailed'));
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('projects_closed_columns');
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
        'projects_closed_columns',
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

  const renderCustomFieldCell = (project: Project, field: CustomField) => {
    const value = project.customFields?.[field.key];
    const commonClass =
      'w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700 outline-none focus:border-slate-400';

    if (field.type === 'boolean') {
      return (
        <label className="inline-flex items-center gap-2 text-[11px] text-slate-600">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => {
              const next = {
                ...(project.customFields ?? {}),
                [field.key]: e.target.checked,
              };
              updateProjectInline(project.id, { customFields: next });
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
              ...(project.customFields ?? {}),
              [field.key]: e.target.value || null,
            };
            updateProjectInline(project.id, { customFields: next });
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

    return (
      <input
        className={commonClass}
        value={value ?? ''}
        onChange={(e) =>
          setItems((prev) =>
            prev.map((p) =>
              p.id === project.id
                ? {
                    ...p,
                    customFields: {
                      ...(p.customFields ?? {}),
                      [field.key]: e.target.value,
                    },
                  }
                : p,
            ),
          )
        }
        onBlur={(e) => {
          const next = {
            ...(project.customFields ?? {}),
            [field.key]: e.target.value,
          };
          updateProjectInline(project.id, { customFields: next });
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  };

  const renderCell = (project: Project, column: any) => {
    switch (column.id) {
      case 'name':
        return (
          <input
            value={project.name}
            onChange={(e) =>
              setItems((prev) =>
                prev.map((p) =>
                  p.id === project.id ? { ...p, name: e.target.value } : p,
                ),
              )
            }
            onBlur={(e) => updateProjectInline(project.id, { name: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700 outline-none focus:border-slate-400"
          />
        );
      case 'category':
        return (
          <input
            value={project.category ?? ''}
            onChange={(e) =>
              setItems((prev) =>
                prev.map((p) =>
                  p.id === project.id
                    ? { ...p, category: e.target.value || null }
                    : p,
                ),
              )
            }
            onBlur={(e) =>
              updateProjectInline(project.id, {
                category: e.target.value || null,
              })
            }
            onClick={(e) => e.stopPropagation()}
            className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700 outline-none focus:border-slate-400"
          />
        );
      case 'status':
        return (
          <select
            value={project.status}
            onChange={(e) =>
              updateProjectInline(project.id, {
                status: e.target.value as Project['status'],
              })
            }
            onClick={(e) => e.stopPropagation()}
            className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700"
          >
            {statusOptions.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        );
      case 'owner':
        return (
          <input
            value={project.owner ?? ''}
            onChange={(e) =>
              setItems((prev) =>
                prev.map((p) =>
                  p.id === project.id
                    ? { ...p, owner: e.target.value }
                    : p,
                ),
              )
            }
            onBlur={(e) =>
              updateProjectInline(project.id, { owner: e.target.value || null })
            }
            onClick={(e) => e.stopPropagation()}
            className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700 outline-none focus:border-slate-400"
          />
        );
      case 'amount':
        return (
          <input
            type="number"
            value={project.amount}
            onChange={(e) =>
              setItems((prev) =>
                prev.map((p) =>
                  p.id === project.id
                    ? { ...p, amount: Number(e.target.value || 0) }
                    : p,
                ),
              )
            }
            onBlur={(e) =>
              updateProjectInline(project.id, {
                amount: Number(e.target.value || 0),
              })
            }
            onClick={(e) => e.stopPropagation()}
            className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700 outline-none focus:border-slate-400"
          />
        );
      case 'created':
        return project.createdAt;
      default:
        if (column.field) return renderCustomFieldCell(project, column.field);
        return null;
    }
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchProjects({ status: 'Выиграно' }),
      fetchProjects({ status: 'Проиграно' }),
      fetchProjects({ status: 'Закрыт' }),
    ])
      .then(([wonRes, lostRes, closedRes]) => {
        if (!alive) return;
        setItems([...wonRes.items, ...lostRes.items, ...closedRes.items]);
      })
      .catch((e: any) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.projects.closed.errors.loadFailed'));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchCustomFields('project')
      .then((items) => {
        if (!alive) return;
        setCustomFields([...items].sort((a, b) => a.order - b.order));
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

  // table is rendered inline for drag/resize columns

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        <section className="flex flex-col gap-1">
          <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
            {t('crm.projects.closed.kicker')}
          </div>
          <h1 className="text-lg md:text-xl font-semibold text-lumiva-accent">
            {t('crm.projects.closed.title')}
          </h1>
          <p className="text-xs text-slate-600 max-w-2xl">
            {t('crm.projects.closed.subtitle')}
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
              {t('crm.projects.closed.kpis.count')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-lumiva-accent">
              {items.length.toLocaleString(locale)}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-[11px] text-slate-500 uppercase tracking-[0.18em]">
              {t('crm.projects.closed.kpis.amount')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-lumiva-accent">
              {formatAmount(totalAmount)}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-[11px] text-slate-500 uppercase tracking-[0.18em]">
              {t('crm.projects.closed.kpis.categories')}
            </div>
            <div className="mt-1 text-xl font-semibold text-lumiva-accent">
              {new Set(items.map((p) => p.category || '')).size}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-5 md:py-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-lumiva-accent">
              {t('crm.projects.closed.table.title')}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500">
                {t('crm.projects.closed.table.total', { count: items.length })}
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
              {t('crm.projects.closed.loading')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[11px] table-fixed">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
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
                                : col.id === 'amount'
                                  ? 140
                                  : col.id === 'created'
                                    ? 160
                                    : 180;
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
                          className="py-1.5 px-2 text-left font-normal relative group"
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
                  {items.length === 0 && (
                    <tr>
                      <td
                        colSpan={orderedColumns.length}
                        className="py-3 text-center text-slate-500"
                      >
                        {t('crm.projects.closed.empty')}
                      </td>
                    </tr>
                  )}
                  {items.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/app/projects/${p.id}`)}
                      className="border-b border-slate-100 last:border-none hover:bg-slate-50 transition-colors cursor-pointer"
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
                                  : col.id === 'amount'
                                    ? 140
                                    : col.id === 'created'
                                      ? 160
                                      : 180;
                        const width = getColumnWidth(col.id, fallback);
                        return (
                          <td
                            key={col.id}
                            className="py-1.5 px-2 text-slate-600"
                            style={{ width, minWidth: width }}
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
