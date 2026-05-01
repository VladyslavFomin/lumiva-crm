// src/pages/companies/CompanyDetailsPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchCompany, updateCompany, type Company } from '../../api/companies';
import { fetchContacts, type Contact } from '../../api/contacts';
import { fetchLeads, isLeadInTrash, type Lead } from '../../api/leads';
import { fetchProjects } from '../../api/projects';
import type { Project } from '../projects/projectTypes';
import {
  fetchCompanyTasks,
  type CompanyTask,
  type CompanyTaskStatus,
} from '../../api/companies';
import { fetchCompanyAnalytics, type CompanyAnalytics } from '../../api/companies';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { useTranslation } from 'react-i18next';
import '../projects/ProjectsListPage.css';
import {
  OwnerAvatarsRow,
  resolveCompanyOwnersDisplay,
  resolveContactManagerDisplay,
  resolveLeadAssigneesDisplay,
  resolveProjectOwnersWithContext,
} from '../../components/crm/OwnerAvatarsRow';

type TabId = 'main' | 'contacts' | 'leads' | 'projects' | 'tasks' | 'analytics';

function isInternalContactCustomFieldKey(key: string): boolean {
  const compact = key.replace(/[\s_-]/g, '');
  if (/^assignedtolist$/i.test(compact)) return true;
  if (/^assigneduserids?$/i.test(compact)) return true;
  return false;
}

function leadTabStatusCls(status?: string | null): string {
  switch (status || '') {
    case 'Новый клиент':
      return 'lv-st lv-st-new';
    case 'В работе':
      return 'lv-st lv-st-progress';
    case 'Ожидает ответа':
      return 'lv-st lv-st-review';
    case 'Закрыт (успех)':
      return 'lv-st lv-st-won';
    case 'Закрыт (проигран)':
      return 'lv-st lv-st-lost';
    default:
      return 'lv-st lv-st-closed';
  }
}

function projectTabStatusCls(status?: string | null): string {
  switch (status || '') {
    case 'Новый':
      return 'lv-st lv-st-new';
    case 'В работе':
      return 'lv-st lv-st-progress';
    case 'На проверке':
      return 'lv-st lv-st-review';
    case 'Заморожен':
      return 'lv-st lv-st-paused';
    case 'Закрыт':
      return 'lv-st lv-st-closed';
    case 'Выиграно':
      return 'lv-st lv-st-won';
    case 'Проиграно':
      return 'lv-st lv-st-lost';
    default:
      return 'lv-st lv-st-closed';
  }
}

function formatTabIsoDate(emptyLabel: string, iso: string | null | undefined): React.ReactNode {
  if (!iso) return <span className="lv-cell-date">{emptyLabel}</span>;
  const dateStr = String(iso);
  if (!dateStr.includes('T')) return <span className="lv-cell-date">{dateStr}</span>;
  const [datePart, timePart] = dateStr.split('T');
  return (
    <span className="lv-cell-date">
      {datePart}
      {timePart ? <span className="time"> {timePart.slice(0, 5)}</span> : null}
    </span>
  );
}

export const CompanyDetailsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('main');
  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<CompanyTask[]>([]);
  const [analytics, setAnalytics] = useState<CompanyAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [assignedSaving, setAssignedSaving] = useState(false);
  const locale = i18n.language?.startsWith('en')
    ? 'en-US'
    : i18n.language?.startsWith('tr')
      ? 'tr-TR'
      : 'ru-RU';

  useEffect(() => {
    if (!id) {
      setError(t('crm.companies.details.page.errors.idMissing'));
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    // Загружаем основную информацию компании
    fetchCompany(id)
      .then((data) => {
        if (!alive) return;
        setCompany(data);
        const fromCustom = Array.isArray(data.customFields?.assignedUserIds)
          ? data.customFields?.assignedUserIds
          : [];
        const normalized = fromCustom.filter((value: unknown): value is string =>
          typeof value === 'string' && value.trim().length > 0,
        );
        setAssignedUserIds(
          normalized.length
            ? normalized
            : data.assignedUserId
              ? [data.assignedUserId]
              : [],
        );
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.companies.form.errors.loadFailed'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    fetchCompanyAnalytics(id)
      .then((data) => {
        if (!alive) return;
        setAnalytics(data);
      })
      .catch((e) => console.error('Failed to load company analytics:', e));
    fetchStaff()
      .then((items) => {
        if (!alive) return;
        setStaff(items);
      })
      .catch((e) => console.error('Failed to load staff list:', e));
  }, [id, t]);

  // Базовые связанные данные компании (контакты/лиды/проекты)
  useEffect(() => {
    if (!id || loading) return;

    let alive = true;
    fetchContacts({ companyId: id, limit: 100 })
      .then((data) => {
        if (!alive) return;
        setContacts(data.items);
      })
      .catch((e) => console.error('Failed to load contacts:', e));

    Promise.all([fetchContacts({ companyId: id, limit: 100 }), fetchLeads(), fetchProjects()])
      .then(([contactsData, leadsData, projectsData]) => {
        if (!alive) return;
        const companyContactIds = new Set(contactsData.items.map((contact) => contact.id));
        const companyLeads = leadsData.filter(
          (lead) =>
            !isLeadInTrash(lead) &&
            (lead.companyId === id ||
              (lead.contactId ? companyContactIds.has(lead.contactId) : false)),
        );
        const leadIds = new Set(companyLeads.map((lead) => lead.id));
        setContacts(contactsData.items);
        setLeads(companyLeads);
        setProjects(
          projectsData.items.filter(
            (project) =>
              (project.companyId != null && project.companyId === id) ||
              (project.leadId != null && leadIds.has(project.leadId)),
          ),
        );
      })
      .catch((e) => console.error('Failed to load company relations:', e));

    return () => {
      alive = false;
    };
  }, [id, loading]);

  // Догружаем тяжёлые вкладки отдельно
  useEffect(() => {
    if (!id || loading) return;
    let alive = true;
    if (tab === 'tasks') {
      fetchCompanyTasks(id)
        .then((data) => {
          if (!alive) return;
          setTasks(data);
        })
        .catch((e) => console.error('Failed to load tasks:', e));
    }
    if (tab === 'analytics') {
      fetchCompanyAnalytics(id)
        .then((data) => {
          if (!alive) return;
          setAnalytics(data);
        })
        .catch((e) => console.error('Failed to load analytics:', e));
    }
    return () => {
      alive = false;
    };
  }, [id, tab, loading]);

  const companyOwnersFallback = useMemo(
    () => (company ? resolveCompanyOwnersDisplay(company, staff) : []),
    [company, staff],
  );

  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  const contactCustomFieldKeys = useMemo(() => {
    const keys = new Set<string>();
    contacts.forEach((contact) => {
      Object.keys(contact.customFields || {}).forEach((key) => {
        if (!isInternalContactCustomFieldKey(key)) keys.add(key);
      });
    });
    return Array.from(keys).slice(0, 8);
  }, [contacts]);
  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((project) => map.set(project.id, project.name));
    return map;
  }, [projects]);
  const tasksGroupedByProject = useMemo(() => {
    return tasks.reduce<Record<string, CompanyTask[]>>((acc, task) => {
      const meta = task.meta || {};
      const projectId = typeof meta.projectId === 'string' ? meta.projectId : '';
      const projectName =
        (typeof meta.projectName === 'string' && meta.projectName) ||
        (typeof meta.project === 'object' && typeof meta.project?.name === 'string'
          ? meta.project.name
          : '') ||
        (projectId ? projectNameById.get(projectId) : '') ||
        t('crm.companies.details.page.noProject');
      if (!acc[projectName]) acc[projectName] = [];
      acc[projectName].push(task);
      return acc;
    }, {});
  }, [tasks, projectNameById]);
  const ownerAssignableStaff = useMemo(
    () =>
      staff
        .filter((u) => u.isActive)
        .sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email)),
    [staff],
  );
  const ownerDepartmentGroups = useMemo(() => {
    const groups = new Map<string, StaffUser[]>();
    ownerAssignableStaff.forEach((user) => {
      const department = (user.department || '').trim() || t('crm.companies.details.page.noDepartment');
      const list = groups.get(department) || [];
      list.push(user);
      groups.set(department, list);
    });
    return Array.from(groups.entries())
      .map(([department, users]) => ({
        department,
        users: users.slice().sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email)),
      }))
      .sort((a, b) => {
        const noDepartment = t('crm.companies.details.page.noDepartment');
        if (a.department === noDepartment) return 1;
        if (b.department === noDepartment) return -1;
        return a.department.localeCompare(b.department, locale);
      });
  }, [ownerAssignableStaff, t, locale]);
  const assignedNames = useMemo(
    () =>
      ownerAssignableStaff
        .filter((user) => assignedUserIds.includes(user.id))
        .map((user) => user.fullName || user.email),
    [assignedUserIds, ownerAssignableStaff],
  );

  const saveAssignedManager = async () => {
    if (!company || assignedSaving) return;
    setAssignedSaving(true);
    try {
      const updated = await updateCompany(company.id, {
        assignedUserId: assignedUserIds[0] || undefined,
        assignedTo: assignedNames.length ? assignedNames.join(', ') : undefined,
        customFields: {
          ...(company.customFields || {}),
          assignedUserIds,
          assignedToList: assignedNames,
        },
      });
      setCompany(updated);
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.companies.details.page.errors.assignFailed'));
    } finally {
      setAssignedSaving(false);
    }
  };
  const toggleOwnerUser = (userId: string, checked: boolean) => {
    setAssignedUserIds((prev) =>
      checked ? Array.from(new Set([...prev, userId])) : prev.filter((id) => id !== userId),
    );
  };
  const toggleOwnerDepartment = (department: string, checked: boolean) => {
    const group = ownerDepartmentGroups.find((item) => item.department === department);
    if (!group) return;
    const groupIds = group.users.map((user) => user.id);
    setAssignedUserIds((prev) =>
      checked
        ? Array.from(new Set([...prev, ...groupIds]))
        : prev.filter((id) => !groupIds.includes(id)),
    );
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-xs text-slate-400">
          {t('crm.common.loading')}
        </div>
      </MainLayout>
    );
  }

  if (error || !company) {
    return (
      <MainLayout>
        <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
          {error || t('crm.companies.details.page.errors.notFound')}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <div>
            <button
              onClick={() => navigate('/companies')}
              className="text-[11px] text-slate-500 hover:text-slate-700 mb-1"
            >
              {t('crm.companies.analytics.backToList')}
            </button>
            <h1 className="text-lg font-semibold text-slate-900">{company.name}</h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.companies.details.page.subtitle')}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/contacts/new')}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {t('crm.companies.details.page.actions.addContact')}
            </button>
            <button
              onClick={() => navigate('/leads/new')}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {t('crm.companies.details.page.actions.addLead')}
            </button>
            <button
              onClick={() => navigate('/projects/new')}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {t('crm.companies.details.page.actions.addProject')}
            </button>
            <button
              onClick={() => navigate(`/companies/${id}/tasks`)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {t('crm.companies.details.tabs.tasks')}
            </button>
            <button
              onClick={() => navigate(`/companies/${id}/edit`)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {t('crm.companies.form.titleEdit')}
            </button>
          </div>
        </div>

        {/* Вкладки */}
        <div className="inline-flex bg-white border border-slate-200 rounded-2xl p-1 text-[13px]">
          {[
            { id: 'main', label: t('crm.companies.details.tabs.main') },
            { id: 'contacts', label: t('crm.companies.details.tabs.contacts') },
            { id: 'leads', label: t('crm.companies.details.tabs.leads') },
            { id: 'projects', label: t('crm.companies.details.tabs.projects') },
            { id: 'tasks', label: t('crm.companies.details.tabs.tasks') },
            { id: 'analytics', label: t('crm.companies.details.tabs.analytics') },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as TabId)}
              className={
                'px-4 py-1.5 rounded-xl transition-colors ' +
                (tab === t.id
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:text-slate-800')
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Контент вкладок */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4">
          {tab === 'main' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[10px] text-slate-500 mb-1">
                    {t('crm.companies.details.analytics.metrics.contacts')}
                  </div>
                  <div className="text-lg font-semibold text-slate-900">
                    {analytics?.contacts.total ?? contacts.length}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[10px] text-slate-500 mb-1">
                    {t('crm.companies.details.analytics.metrics.leads')}
                  </div>
                  <div className="text-lg font-semibold text-slate-900">
                    {analytics?.leads.total ?? leads.length}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[10px] text-slate-500 mb-1">
                    {t('crm.companies.details.analytics.metrics.projects')}
                  </div>
                  <div className="text-lg font-semibold text-slate-900">
                    {analytics?.projects.total ?? projects.length}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-emerald-50 p-3">
                  <div className="text-[10px] text-slate-500 mb-1">
                    {t('crm.companies.analytics.summary.potentialRevenue')}
                  </div>
                  <div className="text-lg font-semibold text-emerald-400">
                    {new Intl.NumberFormat(locale, {
                      style: 'currency',
                      currency: 'EUR',
                      minimumFractionDigits: 0,
                    }).format(analytics?.metrics.potentialRevenue ?? 0)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {company.email && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">Email</div>
                    <div className="text-xs text-slate-700">{company.email}</div>
                  </div>
                )}
                {company.phone && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">
                      {t('crm.companies.form.fields.phone')}
                    </div>
                    <div className="text-xs text-slate-700">{company.phone}</div>
                  </div>
                )}
                {company.website && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">
                      {t('crm.companies.form.fields.website')}
                    </div>
                    <div className="text-xs text-slate-700">
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-500"
                      >
                        {company.website}
                      </a>
                    </div>
                  </div>
                )}
                {(company.city || company.country) && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">
                      {t('crm.companies.form.fields.address')}
                    </div>
                    <div className="text-xs text-slate-700">
                      {[company.city, company.country].filter(Boolean).join(', ') || '-'}
                    </div>
                  </div>
                )}
                {company.industry && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">
                      {t('crm.companies.form.fields.industry')}
                    </div>
                    <div className="text-xs text-slate-700">{company.industry}</div>
                  </div>
                )}
                {company.size && (
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">
                      {t('crm.companies.form.fields.size')}
                    </div>
                    <div className="text-xs text-slate-700">{company.size}</div>
                  </div>
                )}
                <div>
                  <div className="text-[10px] text-slate-500 mb-1">
                    {t('crm.companies.bulk.assignedTo')}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[11px] text-slate-600">
                        {t('crm.companies.details.page.assigneesByDepartment')}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {t('crm.companies.details.page.selectedCount', {
                          count: assignedUserIds.length,
                        })}
                      </div>
                    </div>
                    <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                      {ownerDepartmentGroups.map((group) => {
                        const ids = group.users.map((user) => user.id);
                        const selectedInGroup = ids.filter((id) =>
                          assignedUserIds.includes(id),
                        ).length;
                        const allChecked = selectedInGroup > 0 && selectedInGroup === ids.length;
                        return (
                          <div
                            key={group.department}
                            className="rounded-lg border border-slate-200 bg-white p-2"
                          >
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                              <div className="truncate text-[11px] font-semibold text-slate-700">
                                {group.department}
                              </div>
                              <label className="flex items-center gap-1 text-[10px] text-slate-500">
                                <input
                                  type="checkbox"
                                  checked={allChecked}
                                  onChange={(e) =>
                                    toggleOwnerDepartment(group.department, e.target.checked)
                                  }
                                />
                                {t('crm.companies.details.page.selectDepartment')}
                              </label>
                            </div>
                            <div className="space-y-1">
                              {group.users.map((user) => {
                                const checked = assignedUserIds.includes(user.id);
                                return (
                                  <label
                                    key={user.id}
                                    className="flex items-center gap-2 text-[11px] text-slate-700"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => toggleOwnerUser(user.id, e.target.checked)}
                                    />
                                    <span className="truncate">
                                      {user.fullName || user.email}
                                      {user.email ? ` · ${user.email}` : ''}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {assignedNames.length > 0 && (
                      <div className="mt-2 text-[11px] text-slate-600">
                        {assignedNames.join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={saveAssignedManager}
                      disabled={assignedSaving}
                      className="px-2.5 py-1.5 text-[11px] rounded-lg bg-[#222222] text-white hover:bg-black disabled:opacity-60"
                    >
                      {assignedSaving
                        ? t('crm.companies.details.page.actions.saving')
                        : t('crm.common.save')}
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 mb-1">
                    {t('crm.companies.form.fields.status')}
                  </div>
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                    {company.status || 'active'}
                  </span>
                </div>
              </div>
              {company.description && (
                <div>
                  <div className="text-[10px] text-slate-500 mb-1">
                    {t('crm.companies.form.fields.description')}
                  </div>
                  <div className="text-xs text-slate-700">{company.description}</div>
                </div>
              )}
              {company.tags?.length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-500 mb-1">
                    {t('crm.projects.detail.fields.tags')}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {company.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'contacts' && (
            <div className="space-y-3">
              {contacts.length === 0 ? (
                <div
                  className="rounded-[10px] border py-10 text-center text-[12px] text-[var(--fg-3)]"
                  style={{ borderColor: 'var(--line-2)', background: 'var(--surface)' }}
                >
                  {t('crm.companies.details.contacts.empty')}
                </div>
              ) : (
                <div className="lv-proj-wrap">
                  <div className="lv-proj-scroll">
                    <table className="lv-proj-table lv-leads-table min-w-[860px]">
                      <thead>
                        <tr>
                          <th className="lv-tcol-name">
                            <span className="lv-th-inner">{t('crm.contacts.form.fields.firstName')}</span>
                          </th>
                          <th className="lv-tcol-center">
                            <span className="lv-th-inner">{t('crm.contacts.form.fields.position')}</span>
                          </th>
                          <th className="lv-tcol-center">
                            <span className="lv-th-inner">Email</span>
                          </th>
                          <th className="lv-tcol-center">
                            <span className="lv-th-inner">{t('crm.contacts.form.fields.phone')}</span>
                          </th>
                          <th className="lv-tcol-center">
                            <span className="lv-th-inner">{t('crm.contacts.list.table.manager')}</span>
                          </th>
                          {contactCustomFieldKeys.map((key) => (
                            <th key={key} className="lv-tcol-center">
                              <span className="lv-th-inner">{key}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {contacts.map((contact) => {
                          const fullName =
                            contact.fullName ||
                            `${contact.firstName || ''} ${contact.lastName || ''}`.trim() ||
                            contact.email ||
                            contact.phone ||
                            `${t('crm.contacts.list.title')} ${contact.id.slice(0, 6)}`;
                          const managerItems = resolveContactManagerDisplay(contact, staff);
                          const managerShown =
                            managerItems.length > 0 ? managerItems : companyOwnersFallback;
                          return (
                            <tr
                              key={contact.id}
                              onClick={() => navigate(`/contacts/${contact.id}`)}
                              className="lv-proj-row"
                            >
                              <td className="lv-tcol-name">
                                <span className="text-[12.5px] font-medium text-[var(--ink)]">{fullName}</span>
                              </td>
                              <td className="lv-tcol-center">
                                <span className="text-[12.5px] text-[var(--ink)]">
                                  {contact.position || t('crm.projects.common.emptyValue')}
                                </span>
                              </td>
                              <td className="lv-tcol-center">
                                <span className="text-[12.5px] text-[var(--ink)]">
                                  {contact.email || t('crm.projects.common.emptyValue')}
                                </span>
                              </td>
                              <td className="lv-tcol-center">
                                <span className="text-[12.5px] text-[var(--ink)]">
                                  {contact.phone || t('crm.projects.common.emptyValue')}
                                </span>
                              </td>
                              <td
                                className="lv-tcol-center lv-td-popover"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {managerShown.length ? (
                                  <OwnerAvatarsRow items={managerShown} readOnly />
                                ) : (
                                  <span className="text-[var(--fg-3)]">—</span>
                                )}
                              </td>
                              {contactCustomFieldKeys.map((key) => (
                                <td key={key} className="lv-tcol-center">
                                  <span className="text-[12.5px] text-[var(--ink)]">
                                    {contact.customFields?.[key] != null
                                      ? String(contact.customFields?.[key])
                                      : t('crm.projects.common.emptyValue')}
                                  </span>
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="lv-proj-foot">
                    <div className="lv-proj-foot-stats">
                      <span>
                        <span className="lbl">{t('crm.leads.list.footerTotal')}:</span>
                        <strong>{contacts.length}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'leads' && (
            <div className="space-y-2">
              {leads.length === 0 ? (
                <div
                  className="rounded-[10px] border py-10 text-center text-[12px] text-[var(--fg-3)]"
                  style={{ borderColor: 'var(--line-2)', background: 'var(--surface)' }}
                >
                  {t('crm.companies.details.leads.empty')}
                </div>
              ) : (
                <div className="lv-proj-wrap">
                  <div className="lv-proj-scroll">
                    <table className="lv-proj-table lv-leads-table min-w-[820px]">
                      <thead>
                        <tr>
                          <th className="lv-tcol-name">
                            <span className="lv-th-inner">{t('crm.companies.details.page.tables.leads.lead')}</span>
                          </th>
                          <th className="lv-tcol-center">
                            <span className="lv-th-inner">Email</span>
                          </th>
                          <th className="lv-tcol-center">
                            <span className="lv-th-inner">{t('crm.contacts.form.fields.phone')}</span>
                          </th>
                          <th className="lv-tcol-center">
                            <span className="lv-th-inner">{t('crm.contacts.form.fields.status')}</span>
                          </th>
                          <th className="lv-tcol-center">
                            <span className="lv-th-inner">{t('crm.companies.details.page.tables.leads.owner')}</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map((lead) => {
                          const leadOwners = resolveLeadAssigneesDisplay(lead, staff);
                          const leadOwnersShown =
                            leadOwners.length > 0 ? leadOwners : companyOwnersFallback;
                          const leadTitle =
                            lead.name ||
                            lead.email ||
                            lead.phone ||
                            `${t('crm.companies.details.page.tables.leads.lead')} ${lead.id.slice(0, 6)}`;
                          return (
                            <tr
                              key={lead.id}
                              onClick={() => navigate(`/leads/${lead.id}`)}
                              className="lv-proj-row"
                            >
                              <td className="lv-tcol-name">
                                <span className="text-[12.5px] font-medium text-[var(--ink)]">{leadTitle}</span>
                              </td>
                              <td className="lv-tcol-center">
                                <span className="text-[12.5px] text-[var(--ink)]">
                                  {lead.email || t('crm.projects.common.emptyValue')}
                                </span>
                              </td>
                              <td className="lv-tcol-center">
                                <span className="text-[12.5px] text-[var(--ink)]">
                                  {lead.phone || t('crm.projects.common.emptyValue')}
                                </span>
                              </td>
                              <td className="lv-tcol-center">
                                <span
                                  className={leadTabStatusCls(lead.status)}
                                  style={{ cursor: 'default', pointerEvents: 'none' }}
                                >
                                  <span className="dot" />
                                  {lead.status || t('crm.projects.common.emptyValue')}
                                </span>
                              </td>
                              <td
                                className="lv-tcol-center lv-td-popover"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {leadOwnersShown.length ? (
                                  <OwnerAvatarsRow items={leadOwnersShown} readOnly />
                                ) : (
                                  <span className="text-[var(--fg-3)]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="lv-proj-foot">
                    <div className="lv-proj-foot-stats">
                      <span>
                        <span className="lbl">{t('crm.leads.list.footerTotal')}:</span>
                        <strong>{leads.length}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'projects' && (
            <div className="space-y-2">
              {projects.length === 0 ? (
                <div
                  className="rounded-[10px] border py-10 text-center text-[12px] text-[var(--fg-3)]"
                  style={{ borderColor: 'var(--line-2)', background: 'var(--surface)' }}
                >
                  {t('crm.companies.details.projects.empty')}
                </div>
              ) : (
                <div className="lv-proj-wrap">
                  <div className="lv-proj-scroll">
                    <table className="lv-proj-table lv-leads-table min-w-[820px]">
                      <thead>
                        <tr>
                          <th className="lv-tcol-name">
                            <span className="lv-th-inner">{t('crm.companies.details.page.tables.projects.project')}</span>
                          </th>
                          <th className="lv-tcol-center">
                            <span className="lv-th-inner">{t('crm.contacts.form.fields.status')}</span>
                          </th>
                          <th className="lv-tcol-center">
                            <span className="lv-th-inner">{t('crm.companies.details.page.tables.projects.owner')}</span>
                          </th>
                          <th className="lv-tcol-center">
                            <span className="lv-th-inner">{t('crm.companies.details.page.tables.projects.budget')}</span>
                          </th>
                          <th className="lv-tcol-center">
                            <span className="lv-th-inner">{t('crm.companies.details.page.tables.projects.updated')}</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map((project) => {
                          const projOwnersShown = resolveProjectOwnersWithContext(project, staff, {
                            lead: project.leadId ? leadById.get(project.leadId) : undefined,
                            companyOwners: companyOwnersFallback,
                          });
                          const budgetStr = new Intl.NumberFormat(locale, {
                            style: 'currency',
                            currency: project.currency || 'EUR',
                            minimumFractionDigits: 0,
                          }).format(Number(project.amount || 0));
                          return (
                            <tr
                              key={project.id}
                              onClick={() => navigate(`/projects/${project.id}`)}
                              className="lv-proj-row"
                            >
                              <td className="lv-tcol-name">
                                <span className="text-[12.5px] font-medium text-[var(--ink)]">{project.name}</span>
                              </td>
                              <td className="lv-tcol-center">
                                <span
                                  className={projectTabStatusCls(project.status)}
                                  style={{ cursor: 'default', pointerEvents: 'none' }}
                                >
                                  <span className="dot" />
                                  {project.status || t('crm.projects.common.emptyValue')}
                                </span>
                              </td>
                              <td
                                className="lv-tcol-center lv-td-popover"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {projOwnersShown.length ? (
                                  <OwnerAvatarsRow items={projOwnersShown} readOnly />
                                ) : (
                                  <span className="text-[var(--fg-3)]">—</span>
                                )}
                              </td>
                              <td className="lv-tcol-center">
                                <span className="lv-cell-amount">{budgetStr}</span>
                              </td>
                              <td className="lv-tcol-center">
                                {formatTabIsoDate(t('crm.projects.common.emptyValue'), project.updatedAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="lv-proj-foot">
                    <div className="lv-proj-foot-stats">
                      <span>
                        <span className="lbl">{t('crm.leads.list.footerTotal')}:</span>
                        <strong>{projects.length}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'tasks' && (
            <div className="space-y-4">
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  {t('crm.companies.details.tasks.empty')}
                </div>
              ) : (
                Object.entries(tasksGroupedByProject).map(([projectName, groupedTasks]) => (
                  <div key={projectName} className="space-y-2">
                    <div className="text-xs font-semibold text-slate-700">{projectName}</div>
                    <div className="lv-proj-wrap">
                      <div className="lv-proj-scroll">
                        <table className="lv-proj-table lv-leads-table">
                          <thead>
                            <tr>
                              <th className="lv-tcol-name">
                                <span className="lv-th-inner">{t('crm.companies.tasks.fields.title')}</span>
                              </th>
                              <th className="lv-tcol-center">
                                <span className="lv-th-inner">{t('crm.companies.tasks.fields.status')}</span>
                              </th>
                              <th className="lv-tcol-center">
                                <span className="lv-th-inner">{t('crm.companies.tasks.fields.priority')}</span>
                              </th>
                              <th className="lv-tcol-center">
                                <span className="lv-th-inner">{t('crm.companies.tasks.fields.assignedTo')}</span>
                              </th>
                              <th className="lv-tcol-center">
                                <span className="lv-th-inner">{t('crm.companies.tasks.fields.dueDate')}</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupedTasks.map((task) => (
                              <tr key={task.id} className="lv-proj-row">
                                <td className="lv-tcol-name">{task.title}</td>
                                <td className="lv-tcol-center">
                                  <span
                                    className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                                    style={{
                                      backgroundColor: STATUS_COLORS[task.status] + '20',
                                      color: STATUS_COLORS[task.status],
                                    }}
                                  >
                                    {t(`crm.companies.tasks.statuses.${task.status}`)}
                                  </span>
                                </td>
                                <td className="lv-tcol-center">
                                  {task.priority || t('crm.projects.common.emptyValue')}
                                </td>
                                <td className="lv-tcol-center lv-td-popover">
                                  {resolveContactManagerDisplay(
                                    {
                                      assignedUserId: task.assignedUserId,
                                      assignedTo: task.assignedTo,
                                    },
                                    staff,
                                  ).length ? (
                                    <OwnerAvatarsRow
                                      items={resolveContactManagerDisplay(
                                        {
                                          assignedUserId: task.assignedUserId,
                                          assignedTo: task.assignedTo,
                                        },
                                        staff,
                                      )}
                                      readOnly
                                    />
                                  ) : (
                                    <span className="text-[var(--fg-3)]">—</span>
                                  )}
                                </td>
                                <td className="lv-tcol-center">
                                  {task.dueDate
                                    ? new Date(task.dueDate).toLocaleDateString(locale)
                                    : t('crm.projects.common.emptyValue')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <button
                onClick={() => navigate(`/companies/${id}/tasks`)}
                className="w-full mt-2 px-4 py-2 text-xs rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors"
              >
                {t('crm.companies.details.tasks.viewBoard')}
              </button>
            </div>
          )}

          {tab === 'analytics' && analytics && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
                  <div className="text-[10px] text-slate-500 mb-1">
                    {t('crm.companies.details.analytics.metrics.contacts')}
                  </div>
                  <div className="text-xl font-semibold text-slate-900">
                    {analytics.contacts.total}
                  </div>
                </div>
                <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
                  <div className="text-[10px] text-slate-500 mb-1">
                    {t('crm.companies.details.analytics.metrics.leads')}
                  </div>
                  <div className="text-xl font-semibold text-slate-900">
                    {analytics.leads.total}
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <div className="text-[10px] text-slate-500 mb-1">
                    {t('crm.companies.details.analytics.metrics.projects')}
                  </div>
                  <div className="text-xl font-semibold text-slate-900">
                    {analytics.projects.total}
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <div className="text-[10px] text-slate-500 mb-1">
                    {t('crm.companies.details.analytics.metrics.revenue')}
                  </div>
                  <div className="text-xl font-semibold text-emerald-700">
                    {new Intl.NumberFormat(locale, {
                      style: 'currency',
                      currency: 'EUR',
                      minimumFractionDigits: 0,
                    }).format(analytics.metrics.totalRevenue)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                  <div className="text-[10px] text-slate-500 mb-2">
                    {t('crm.companies.details.analytics.metrics.conversion')}
                  </div>
                  <div className="text-lg font-semibold text-indigo-700">
                    {analytics.metrics.conversionRate.toFixed(2)}%
                  </div>
                </div>
                <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-3">
                  <div className="text-[10px] text-slate-500 mb-2">
                    {t('crm.companies.details.analytics.metrics.avgProjectValue')}
                  </div>
                  <div className="text-lg font-semibold text-cyan-700">
                    {new Intl.NumberFormat(locale, {
                      style: 'currency',
                      currency: 'EUR',
                      minimumFractionDigits: 0,
                    }).format(analytics.metrics.avgProjectValue)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

const STATUS_COLORS: Record<CompanyTaskStatus, string> = {
  todo: '#64748b',
  in_progress: '#8b5cf6',
  review: '#facc15',
  done: '#22c55e',
  cancelled: '#ef4444',
};

