import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './ProjectsListPage.css';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { AutomationPanel } from '../../components/AutomationPanel';
import { fetchProject, fetchProjects } from '../../api/projects';
import type { Project, ProjectTask } from './projectTypes';
import { useTranslation } from 'react-i18next';
import { fetchLeadsList } from '../../api/leads';
import { fetchCompanies } from '../../api/companies';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { fetchCustomFields, type CustomField } from '../../api/custom-fields';
import { assigneeEntryDisplayLabel } from './taskAssignees';
import { ProjectsViewsBar } from './ProjectsViewsBar';
import type { ProjectsViewSettings } from './projectsViewSettings';
import type { ProjectTable } from '../../api/projectTables';
import { toLocalDateKey, dayKeysFromStartEndStrings } from '../../utils/calendarLocalDates';

const toDateKey = (value: string | Date) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : toLocalDateKey(value);
  }
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return toLocalDateKey(parsed);
};

const formatDeadlineCell = (item: { deadlineKey: string; endDeadlineKey?: string }, locale: string) => {
  const fmt = (key: string) => {
    const d = new Date(`${key}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? key
      : d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  };
  return item.endDeadlineKey ? `${fmt(item.deadlineKey)} – ${fmt(item.endDeadlineKey)}` : fmt(item.deadlineKey);
};

const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const monthEnd = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const weekStart = (date: Date) => {
  const day = (date.getDay() + 6) % 7;
  return addDays(date, -day);
};
const weekEnd = (date: Date) => addDays(weekStart(date), 6);

type CalendarItem = {
  projectId: string;
  projectName: string;
  companyName: string;
  amount: number;
  currency: string;
  kind: 'task' | 'field';
  itemId: string;
  title: string;
  taskStatus: ProjectTask['status'] | null;
  priority: ProjectTask['priority'] | null;
  assignees: string[];
  deadlineKey: string;
  /** Только для kind:'field' с диапазоном дат — последний день диапазона (включительно). */
  endDeadlineKey?: string;
};

const DATE_FIELD_TYPES = ['date', 'datetime', 'daterange'];

export const ProjectsCalendarPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [cursor, setCursor] = useState(() => monthStart(new Date()));
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [projectCompanyMap, setProjectCompanyMap] = useState<Record<string, string>>({});
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [dateCustomFields, setDateCustomFields] = useState<CustomField[]>([]);
  const [activeViewSettings, setActiveViewSettings] = useState<ProjectsViewSettings>({});
  const [automationOpen, setAutomationOpen] = useState(false);
  const [resolvedTables, setResolvedTables] = useState<ProjectTable[]>([]);

  const tableIdParam = searchParams.get('table');
  const defaultTable = useMemo(
    () => resolvedTables.find((tbl) => tbl.slug === 'main') || null,
    [resolvedTables],
  );
  const activeTableId = tableIdParam || defaultTable?.id || '';

  // Данные каждой таблицы уже изолированы на бэкенде (?tableId=), клиентской фильтрации не нужно.
  const visibleProjects = projects;

  const openType = (type: 'table' | 'kanban' | 'calendar') => {
    const basePath =
      type === 'table'
        ? '/projects'
        : type === 'kanban'
          ? '/projects/board'
          : '/projects/calendar';
    navigate(activeTableId ? `${basePath}?table=${activeTableId}` : basePath);
  };
  const changeTable = (tableId: string) => {
    navigate(`/projects/calendar?table=${tableId}`);
  };

  const handleCreate = () => {
    const q = activeTableId ? `?table=${encodeURIComponent(activeTableId)}` : '';
    navigate(`/projects/new${q}`);
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchProjects({ tableId: tableIdParam ?? undefined }),
      fetchLeadsList(),
      fetchCompanies({ limit: 500 }),
      fetchStaff(),
      fetchCustomFields('project').catch(() => []),
    ])
      .then(async ([res, leads, companies, staffList, customFields]) => {
        if (!alive) return;
        setStaff(staffList);
        setDateCustomFields(
          customFields.filter((f) => f.isActive && DATE_FIELD_TYPES.includes(f.type)),
        );
        if (!alive) return;
        const activeLeads = leads.filter((lead) => !Boolean(lead.meta?.deleted));
        const leadToCompanyId: Record<string, string> = {};
        activeLeads.forEach((lead) => {
          if (lead.id && lead.companyId) leadToCompanyId[lead.id] = lead.companyId;
        });
        const companyNameById: Record<string, string> = {};
        companies.items.forEach((company) => {
          companyNameById[company.id] = company.name;
        });

        const detailed = await Promise.all(
          res.items.map((p) => fetchProject(p.id).catch(() => p)),
        );
        if (!alive) return;
        const map: Record<string, string> = {};
        detailed.forEach((project) => {
          const companyId = project.leadId ? leadToCompanyId[project.leadId] : '';
          map[project.id] = companyId
            ? companyNameById[companyId] || t('crm.projects.calendar.noCompany')
            : t('crm.projects.calendar.noCompany');
        });
        setProjectCompanyMap(map);
        setProjects(detailed);
      })
      .catch((e: any) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.projects.errors.loadFailed'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [t, tableIdParam]);

  const locale = i18n.language.startsWith('tr')
    ? 'tr-TR'
    : i18n.language.startsWith('en')
      ? 'en-US'
      : 'ru-RU';

  const monthLabel = cursor.toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
  const weekLabel = `${weekStart(cursor).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
  })} - ${weekEnd(cursor).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}`;

  const calendarItems = useMemo<CalendarItem[]>(() => {
    const out: CalendarItem[] = [];
    visibleProjects.forEach((project) => {
      const companyName = projectCompanyMap[project.id] || t('crm.projects.calendar.noCompany');
      const amount = Number(project.amount) || 0;
      const currency = project.currency || 'EUR';
      const ownerAssignees = project.ownerUserIds?.length
        ? project.ownerUserIds
        : project.ownerUserId
          ? [project.ownerUserId]
          : project.owner
            ? project.owner.split(/[,;/]+/).map((name) => name.trim()).filter(Boolean)
            : [];
      (project.tasks || []).forEach((task) => {
        const deadlineKey = toDateKey(task.deadline || '');
        if (!deadlineKey) return;
        out.push({
          projectId: project.id,
          projectName: project.name,
          companyName,
          amount,
          currency,
          kind: 'task',
          itemId: task.id,
          title: task.title,
          taskStatus: task.status,
          priority: task.priority,
          assignees: task.assignees || [],
          deadlineKey,
        });
      });
      dateCustomFields.forEach((field) => {
        const raw = project.customFields?.[field.key];
        if (!raw) return;
        const startValue = field.type === 'daterange' ? raw?.start : raw;
        if (!startValue) return;
        const deadlineKey = toDateKey(startValue);
        if (!deadlineKey) return;
        const endValue = field.type === 'daterange' ? raw?.end : null;
        const endDeadlineKey = endValue ? toDateKey(endValue) : undefined;
        out.push({
          projectId: project.id,
          projectName: project.name,
          companyName,
          amount,
          currency,
          kind: 'field',
          itemId: `field:${field.id}`,
          title: field.label,
          taskStatus: null,
          priority: null,
          assignees: ownerAssignees,
          deadlineKey,
          endDeadlineKey: endDeadlineKey && endDeadlineKey > deadlineKey ? endDeadlineKey : undefined,
        });
      });
    });
    return out;
  }, [visibleProjects, projectCompanyMap, dateCustomFields, t]);

  const allAssignees = useMemo(() => {
    const set = new Set<string>();
    calendarItems.forEach((item) => item.assignees.forEach((name) => set.add(name)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, locale));
  }, [calendarItems, locale]);

  const allStatuses = useMemo(() => {
    const set = new Set<string>();
    calendarItems.forEach((item) => {
      if (item.taskStatus) set.add(item.taskStatus);
    });
    return Array.from(set);
  }, [calendarItems]);

  const allCompanies = useMemo(() => {
    const set = new Set<string>();
    calendarItems.forEach((item) =>
      set.add(item.companyName || t('crm.projects.calendar.noCompany')),
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b, locale));
  }, [calendarItems, locale, t]);

  const rangeStart = viewMode === 'month' ? monthStart(cursor) : weekStart(cursor);
  const rangeEnd = viewMode === 'month' ? monthEnd(cursor) : weekEnd(cursor);
  const rangeStartKey = toDateKey(rangeStart);
  const rangeEndKey = toDateKey(rangeEnd);

  const filteredItems = useMemo(() => {
    return calendarItems.filter((item) => {
      if (activeViewSettings.calendarImportantOnly && item.priority !== 'Высокий')
        return false;
      if (assigneeFilter && !item.assignees.includes(assigneeFilter)) return false;
      if (statusFilter && item.taskStatus !== statusFilter) return false;
      if (companyFilter && item.companyName !== companyFilter) return false;
      const effectiveEnd = item.endDeadlineKey || item.deadlineKey;
      if (effectiveEnd < rangeStartKey || item.deadlineKey > rangeEndKey) return false;
      return true;
    });
  }, [
    calendarItems,
    assigneeFilter,
    statusFilter,
    companyFilter,
    rangeStartKey,
    rangeEndKey,
    activeViewSettings.calendarImportantOnly,
  ]);

  const monthGridDays = useMemo(() => {
    const start = monthStart(cursor);
    const end = monthEnd(cursor);
    const firstWeekday = (start.getDay() + 6) % 7;
    const daysInMonth = end.getDate();
    const cells: Array<{ key: string; date: Date | null }> = [];
    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push({ key: `empty-start-${i}`, date: null });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
      cells.push({ key: toDateKey(date), date });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ key: `empty-end-${cells.length}`, date: null });
    }
    return cells;
  }, [cursor]);

  const weekGridDays = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, idx) => {
        const date = addDays(weekStart(cursor), idx);
        return { key: toDateKey(date), date };
      }),
    [cursor],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    filteredItems.forEach((item) => {
      const keys = item.endDeadlineKey
        ? dayKeysFromStartEndStrings(item.deadlineKey, item.endDeadlineKey).slice(0, 366)
        : [item.deadlineKey];
      keys.forEach((key) => {
        const list = map.get(key) || [];
        list.push(item);
        map.set(key, list);
      });
    });
    return map;
  }, [filteredItems]);

  const upcoming = useMemo(() => {
    const todayKey = toDateKey(new Date());
    return [...filteredItems]
      .filter((item) => (item.endDeadlineKey || item.deadlineKey) >= todayKey)
      .sort((a, b) => a.deadlineKey.localeCompare(b.deadlineKey))
      .slice(0, 12);
  }, [filteredItems]);

  return (
    <MainLayout>
      <PageHelpButton topic="projects" />
      <div
        className="lv-pt w-full pb-8 min-w-0 space-y-5"
        style={{ marginLeft: -24, marginRight: -24, paddingLeft: 24, paddingRight: 24, width: 'calc(100% + 48px)' }}
      >
        <div className="lv-pt-head">
          <div>
            <h1>{t('crm.projects.calendar.title')}</h1>
            <div className="sub">{t('crm.projects.calendar.subtitle')}</div>
          </div>
          <div className="lv-pt-head-actions">
            <button type="button" className="lv-tb-btn" onClick={() => setAutomationOpen(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
              </svg>
              {t('crm.automations.panel.button')}
            </button>
            <button
              type="button"
              onClick={handleCreate}
              className="lv-tb-btn"
              style={{ background: '#222', color: '#fff', borderColor: '#222', borderRadius: 8 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t('crm.projects.actions.newProject')}
            </button>
          </div>
        </div>

        <ProjectsViewsBar
          currentType="calendar"
          activeTableId={activeTableId}
          onOpenType={openType}
          onTableChange={changeTable}
          onSettingsChange={setActiveViewSettings}
          onTablesChange={setResolvedTables}
          projectCount={visibleProjects.length}
        />

        {error && (
          <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-2xl px-3 py-2">
            {error}
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`flex-1 px-3 py-1.5 text-xs rounded-lg ${
                  viewMode === 'month' ? 'bg-white text-slate-900' : 'text-slate-600'
                }`}
              >
                {t('crm.projects.calendar.view.month')}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className={`flex-1 px-3 py-1.5 text-xs rounded-lg ${
                  viewMode === 'week' ? 'bg-white text-slate-900' : 'text-slate-600'
                }`}
              >
                {t('crm.projects.calendar.view.week')}
              </button>
            </div>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-700"
            >
              <option value="">{t('crm.projects.calendar.filters.allAssignees')}</option>
              {allAssignees.map((id) => (
                <option key={id} value={id}>
                  {assigneeEntryDisplayLabel(staff, id)}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-700"
            >
              <option value="">{t('crm.projects.calendar.filters.allTaskStatuses')}</option>
              {allStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-700"
            >
              <option value="">{t('crm.projects.calendar.filters.allCompanies')}</option>
              {allCompanies.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setAssigneeFilter('');
                setStatusFilter('');
                setCompanyFilter('');
              }}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              {t('crm.projects.calendar.filters.reset')}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setCursor((prev) =>
                  viewMode === 'month'
                    ? new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                    : addDays(prev, -7),
                )
              }
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              ←
            </button>
            <div className="text-sm font-semibold text-slate-900">
              {viewMode === 'month' ? monthLabel : weekLabel}
            </div>
            <button
              type="button"
              onClick={() =>
                setCursor((prev) =>
                  viewMode === 'month'
                    ? new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    : addDays(prev, 7),
                )
              }
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              →
            </button>
          </div>

          {loading ? (
            <div className="text-xs text-slate-500">{t('crm.projects.loading')}</div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-2 text-[11px] text-slate-500 mb-2">
                {(t('crm.projects.calendar.weekdays', {
                  returnObjects: true,
                }) as unknown as string[]).map((day: string) => (
                  <div key={day} className="px-2 py-1">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {(viewMode === 'month' ? monthGridDays : weekGridDays).map((cell) => {
                  if (!cell.date) {
                    return <div key={cell.key} className="min-h-[120px] rounded-2xl bg-slate-50" />;
                  }
                  const key = toDateKey(cell.date.toISOString());
                  const tasks = byDay.get(key) || [];
                  const isToday = key === toDateKey(new Date().toISOString());
                  return (
                    <div
                      key={cell.key}
                      className={`min-h-[120px] rounded-2xl border p-2 ${
                        isToday ? 'border-[#222222] bg-slate-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="text-[11px] font-semibold text-slate-700 mb-1">
                        {cell.date.toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
                      </div>
                      <div className="space-y-1">
                        {tasks.slice(0, 3).map((item) => (
                          <button
                            key={`${item.kind}-${item.itemId}`}
                            type="button"
                            onClick={() => navigate(`/projects/${item.projectId}`)}
                            className="w-full text-left rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 hover:bg-slate-100"
                          >
                            <div className="text-[10px] font-semibold text-slate-800 truncate">{item.projectName}</div>
                            <div className="text-[10px] text-slate-600 truncate">{item.title}</div>
                          </button>
                        ))}
                        {tasks.length > 3 && (
                          <div className="text-[10px] text-slate-500">
                            {t('crm.projects.calendar.moreTasks', { count: tasks.length - 3 })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">
            {t('crm.projects.calendar.upcoming.title')}
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left px-2 py-1">{t('crm.projects.calendar.upcoming.headers.date')}</th>
                  <th className="text-left px-2 py-1">{t('crm.projects.calendar.upcoming.headers.project')}</th>
                  <th className="text-left px-2 py-1">{t('crm.projects.calendar.upcoming.headers.task')}</th>
                  <th className="text-left px-2 py-1">{t('crm.projects.calendar.upcoming.headers.company')}</th>
                  <th className="text-left px-2 py-1">{t('crm.projects.calendar.upcoming.headers.assignee')}</th>
                  <th className="text-left px-2 py-1">{t('crm.projects.calendar.upcoming.headers.projectAmount')}</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((item) => (
                  <tr key={`${item.projectId}-${item.kind}-${item.itemId}`} className="border-t border-slate-200">
                    <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap">
                      {formatDeadlineCell(item, locale)}
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/projects/${item.projectId}`)}
                        className="text-sky-600 hover:text-sky-700 hover:underline"
                      >
                        {item.projectName}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-slate-700">{item.title}</td>
                    <td className="px-2 py-1.5 text-slate-600">
                      {item.companyName || t('crm.projects.calendar.noCompany')}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600">
                      {item.assignees.length
                        ? item.assignees
                            .map((id) => assigneeEntryDisplayLabel(staff, id))
                            .join(', ')
                        : t('crm.projects.common.emptyValue')}
                    </td>
                    <td className="px-2 py-1.5 text-slate-700">
                      {new Intl.NumberFormat(locale).format(item.amount)} {item.currency}
                    </td>
                  </tr>
                ))}
                {!upcoming.length && !loading && (
                  <tr>
                    <td colSpan={6} className="px-2 py-3 text-center text-slate-500">
                      {t('crm.projects.calendar.upcoming.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <AutomationPanel open={automationOpen} onClose={() => setAutomationOpen(false)} entityType="project" />
      </div>
    </MainLayout>
  );
};



