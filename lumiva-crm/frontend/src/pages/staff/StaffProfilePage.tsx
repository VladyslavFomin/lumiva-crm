// src/pages/staff/StaffProfilePage.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';

import {
  fetchStaffById,
  updateStaffRole,
  updateStaffUser,
  activateStaffUser,
  deactivateStaffUser,
  deleteStaffUser,
  type StaffUser,
  type StaffRole,
} from '../../api/staff';

import { fetchLeads, type Lead, isLeadOmittedFromAnalytics } from '../../api/leads';
import { fetchProjects } from '../../api/projects';
import { fetchDepartments, type Department } from '../../api/departments';
import type { Project, ProjectTask } from '../projects/projectTypes';
import { getStoredUser } from '../../auth/session';
import { adminProvisionUser } from '../../api/users';
import { getLocale } from '../../i18n/utils';
import { useAlertModal } from '../../contexts/AlertModalContext';

type TabId = 'overview' | 'leads' | 'projects' | 'tasks';

interface TaskWithProject extends ProjectTask {
  projectId: string;
  projectName: string;
}

export const StaffProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabId>('overview');

  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Блок для доступа/пароля
  const [loginInfo, setLoginInfo] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Локальные флаги сохранения
  const [savingRole, setSavingRole] = useState(false);
  const [savingDept, setSavingDept] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  /** Черновик отдела до явного сохранения (избегает рассинхрона с ответом API). */
  const [departmentDraft, setDepartmentDraft] = useState('');

  const currentUser = getStoredUser();
  const isOwner = currentUser?.role === 'owner';
  const locale = getLocale();
  const roleLabels = useMemo(
    () => ({
      owner: t('crm.staff.roles.owner'),
      manager: t('crm.staff.roles.manager'),
      viewer: t('crm.staff.roles.viewer'),
      finance: t('crm.staff.roles.finance'),
      sales: t('crm.staff.roles.sales'),
      developer: t('crm.staff.roles.developer'),
      support: t('crm.staff.roles.support'),
    }),
    [t],
  );

  useEffect(() => {
    if (!id) return;

    let alive = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // 1) Грузим самого сотрудника
        const user = await fetchStaffById(id);
        if (!alive) return;

        setStaff(user);
        const isSelfView =
        !!(currentUser && currentUser.email && currentUser.email === user.email);

        // 2) Параллельно: лиды, проекты, справочник отделов
        const [allLeads, projRes, deptList] = await Promise.all([
          fetchLeads(),
          fetchProjects(),
          fetchDepartments(),
        ]);
        if (!alive) return;

        setDepartments(deptList);

        const projectsItems: Project[] =
          (projRes as any).items ?? (projRes as any);

        // Лиды: по assignedUserId или по assignedTo (ФИО)
        let myLeads: Lead[];

        if (isSelfView) {
          myLeads = allLeads;
        } else {
          myLeads = allLeads.filter((l) => {
            if ((l as any).assignedUserId && (l as any).assignedUserId === user.id) {
              return true;
            }
            if (l.assignedTo && user.fullName && l.assignedTo === user.fullName) {
              return true;
            }
            return false;
          });
        }

        // Только актуальные (не корзина / не архив для аналитики)
        myLeads = myLeads.filter((l) => !isLeadOmittedFromAnalytics(l));

        // Проекты: по ownerUserId или owner === fullName; без удалённых и архивных
        const myProjects = projectsItems
          .filter((p) => {
            if ((p as any).ownerUserId && (p as any).ownerUserId === user.id) {
              return true;
            }
            if (p.owner && user.fullName && p.owner === user.fullName) {
              return true;
            }
            return false;
          })
          .filter((p) => !p.isDeleted && !p.isArchived);

        // Задачи: по assignees содержит ФИО
        const myTasks: TaskWithProject[] = [];
        for (const p of myProjects) {
          const list = p.tasks || [];
          for (const t of list) {
            const hasAssignee = (t.assignees || []).some(
              (a) =>
                !!a &&
                !!user.id &&
                (a.trim() === user.id ||
                  (!!user.fullName && a.trim() === user.fullName)),
            );
            if (hasAssignee) {
              myTasks.push({
                ...t,
                projectId: p.id,
                projectName: p.name,
              });
            }
          }
        }

        setLeads(myLeads);
        setProjects(myProjects);
        setTasks(myTasks);
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.staff.profile.errors.load'));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id, currentUser?.email]);

  useEffect(() => {
    if (staff) {
      setDepartmentDraft(staff.departmentId ?? '');
    }
  }, [staff?.id, staff?.departmentId]);

  const initials = useMemo(() => {
    if (!staff?.fullName) return '?';
    return staff.fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
  }, [staff]);

  const departmentLabel = useMemo(() => {
    if (!staff) return '';
    const d = departments.find((x) => x.id === staff.departmentId);
    return (d?.name || staff.department || '').trim();
  }, [staff, departments]);

  const leadsCount = leads.length;
  const projectsCount = projects.length;
  const tasksCount = tasks.length;

  const handleBack = () => {
    navigate('/app/staff');
  };

  if (!id) {
    return (
      <MainLayout>
        <div className="p-4 text-sm text-neutral-600">
          {t('crm.staff.profile.invalidId')}
        </div>
      </MainLayout>
    );
  }

  const isSelf =
    !!(currentUser && staff && currentUser.email === staff.email);

  // ====== Смена роли ======
  const handleChangeRole = async (newRole: StaffRole) => {
    if (!staff || staff.role === newRole) return;
    setSavingRole(true);
    setError(null);
    try {
      const updated = await updateStaffRole(staff.id, newRole);
      setStaff(updated);
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.staff.profile.errors.role'));
    } finally {
      setSavingRole(false);
    }
  };

  // ====== Сохранение отдела (справочник /departments + departmentId) ======
  const departmentDirty =
    !!staff && (departmentDraft || '') !== (staff.departmentId || '');

  const handleSaveDepartment = async () => {
    if (!staff) return;
    const nextId = departmentDraft.trim() || null;
    if (nextId === (staff.departmentId ?? null)) return;

    const dept = nextId ? departments.find((d) => d.id === nextId) : null;
    setSavingDept(true);
    setError(null);
    try {
      const updated = await updateStaffUser(staff.id, {
        departmentId: nextId,
        department: dept?.name ?? null,
      });
      setStaff(updated);
      setDepartmentDraft(updated.departmentId ?? '');
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.staff.profile.errors.department'));
    } finally {
      setSavingDept(false);
    }
  };

  // ====== Активировать/деактивировать ======
  const handleToggleActive = async () => {
    if (!staff) return;
    setStatusLoading(true);
    setError(null);

    try {
      if (staff.isActive) {
        await deactivateStaffUser(staff.id);
        setStaff({ ...staff, isActive: false });
      } else {
        await activateStaffUser(staff.id);
        setStaff({ ...staff, isActive: true });
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.staff.profile.errors.status'));
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDeleteStaff = async () => {
  if (!staff || !isOwner) return;
  const ok = await showConfirm(t('crm.staff.profile.deleteConfirm'), {
    title: 'Удаление',
    confirmLabel: 'Удалить',
    cancelLabel: 'Отмена',
    danger: true,
  });
  if (!ok) {
    return;
  }

  try {
    await deleteStaffUser(staff.id);
    navigate('/app/staff');
  } catch (e: any) {
    console.error(e);
    setError(e.message || t('crm.staff.profile.errors.delete'));
  }
  };

  // ====== Создать / сбросить логин/пароль ======
  const handleGenerateLogin = async () => {
    if (!staff?.email) return;

    if (!isOwner) {
      showAlert(t('crm.staff.profile.access.onlyOwner'), { variant: 'info' });
      return;
    }

    setLoginLoading(true);
    setLoginError(null);
    setLoginInfo(null);

    try {
      const res: any = await adminProvisionUser({
        email: staff.email,
        name: staff.fullName,
        role: staff.role,
      });

      const payload = (res && (res as any).data) || res;
      const { email, password } = payload;

      setLoginInfo(
        t('crm.staff.profile.access.message', { email, password }),
      );
    } catch (e: any) {
      console.error(e);
      setLoginError(e.message || t('crm.staff.profile.access.error'));
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 text-neutral-800">
        {/* Верхняя панель */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <button
                type="button"
                onClick={handleBack}
                className="mb-1 text-[11px] text-neutral-500 transition-colors hover:text-neutral-900"
              >
                ← {t('crm.staff.profile.back')}
              </button>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-neutral-200/90 text-sm font-semibold text-neutral-700 ring-1 ring-neutral-200/80">
                  {initials}
                </div>
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500">
                    {t('crm.staff.profile.title')}
                  </div>
                  <h1 className="text-lg font-semibold tracking-tight text-neutral-900">
                    {staff?.fullName || staff?.email || t('crm.staff.profile.fallbackName')}
                  </h1>
                  {staff && (
                    <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                      <span>{roleLabels[staff.role]}</span>
                      <span className="text-neutral-300">·</span>
                      <span>{t('crm.staff.profile.idShort', { id: staff.id.slice(0, 8) })}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {isSelf && (
            <button
              type="button"
              onClick={() => navigate('/app/profile/overview')}
              className="btn-secondary btn-secondary-sm"
            >
              {t('crm.staff.profile.selfProfile')}
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-xs text-neutral-500">
            {t('crm.staff.profile.loading')}
          </div>
        )}

        {!loading && staff && (
          <>
            {/* KPI */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="card px-4 py-3">
                <div className="mb-1 text-[11px] font-medium text-text-secondary">
                  {t('crm.staff.profile.kpis.leadsTitle')}
                </div>
                <div className="text-2xl font-semibold tabular-nums text-[#111827]">
                  {leadsCount}
                </div>
                <div className="mt-1 text-[11px] text-text-secondary">
                  {t('crm.staff.profile.kpis.leadsHint', {
                    name: staff.fullName || t('crm.staff.profile.kpis.managerFallback'),
                  })}
                </div>
              </div>

              <div className="card px-4 py-3">
                <div className="mb-1 text-[11px] font-medium text-text-secondary">
                  {t('crm.staff.profile.kpis.projectsTitle')}
                </div>
                <div className="text-2xl font-semibold tabular-nums text-[#111827]">
                  {projectsCount}
                </div>
                <div className="mt-1 text-[11px] text-text-secondary">
                  {t('crm.staff.profile.kpis.projectsHint')}
                </div>
              </div>

              <div className="card px-4 py-3">
                <div className="mb-1 text-[11px] font-medium text-text-secondary">
                  {t('crm.staff.profile.kpis.tasksTitle')}
                </div>
                <div className="text-2xl font-semibold tabular-nums text-[#111827]">
                  {tasksCount}
                </div>
                <div className="mt-1 text-[11px] text-text-secondary">
                  {t('crm.staff.profile.kpis.tasksHint')}
                </div>
              </div>
            </div>

            {/* Вкладки */}
            <div className="inline-flex rounded-2xl border border-border-default bg-surface-subtle p-0.5 text-[13px]">
              <button
                type="button"
                onClick={() => setTab('overview')}
                className={
                  'rounded-xl px-3 py-1.5 font-medium transition-colors ' +
                  (tab === 'overview'
                    ? 'bg-white text-[#111827] shadow-sm'
                    : 'text-text-secondary hover:text-[#111827]')
                }
              >
                {t('crm.staff.profile.tabs.overview')}
              </button>
              <button
                type="button"
                onClick={() => setTab('leads')}
                className={
                  'rounded-xl px-3 py-1.5 font-medium transition-colors ' +
                  (tab === 'leads'
                    ? 'bg-white text-[#111827] shadow-sm'
                    : 'text-text-secondary hover:text-[#111827]')
                }
              >
                {t('crm.staff.profile.tabs.leads')}
              </button>
              <button
                type="button"
                onClick={() => setTab('projects')}
                className={
                  'rounded-xl px-3 py-1.5 font-medium transition-colors ' +
                  (tab === 'projects'
                    ? 'bg-white text-[#111827] shadow-sm'
                    : 'text-text-secondary hover:text-[#111827]')
                }
              >
                {t('crm.staff.profile.tabs.projects')}
              </button>
              <button
                type="button"
                onClick={() => setTab('tasks')}
                className={
                  'rounded-xl px-3 py-1.5 font-medium transition-colors ' +
                  (tab === 'tasks'
                    ? 'bg-white text-[#111827] shadow-sm'
                    : 'text-text-secondary hover:text-[#111827]')
                }
              >
                {t('crm.staff.profile.tabs.tasks')}
              </button>
            </div>

            {/* Контент вкладок */}
            {tab === 'overview' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="space-y-4 card p-4 lg:col-span-1">
                  <div>
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-500">
                      {t('crm.staff.profile.contacts.title')}
                    </div>
                    <div className="text-sm text-neutral-900">{staff.email}</div>
                    {staff.phone && (
                      <div className="mt-1 text-sm text-neutral-600">{staff.phone}</div>
                    )}
                  </div>

                  <div>
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-500">
                      {t('crm.staff.profile.roleAndDepartment')}
                    </div>
                    <div className="mb-3">
                      {isOwner ? (
                        <select
                          value={staff.role}
                          disabled={savingRole}
                          onChange={(e) => handleChangeRole(e.target.value as StaffRole)}
                          className="base-select text-xs py-1.5"
                        >
                          {Object.entries(roleLabels).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-sm text-neutral-900">{roleLabels[staff.role]}</div>
                      )}
                    </div>

                    <div className="mb-1 text-[11px] font-medium text-neutral-600">
                      {t('crm.staff.profile.department')}
                    </div>
                    {isOwner ? (
                      <div className="space-y-2">
                        <select
                          value={departmentDraft}
                          disabled={savingDept}
                          onChange={(e) => setDepartmentDraft(e.target.value)}
                          className="base-select text-xs py-1.5"
                        >
                          <option value="">{t('crm.staff.profile.departmentPlaceholder')}</option>
                          {departments
                            .filter(
                              (d) =>
                                d.isActive ||
                                d.id === staff.departmentId ||
                                d.id === departmentDraft,
                            )
                            .map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                                {!d.isActive ? ` (${t('crm.common.statusOptions.inactive')})` : ''}
                              </option>
                            ))}
                        </select>
                        {departmentDirty && (
                          <p className="text-[10px] text-amber-800">
                            {t('crm.staff.profile.departmentUnsaved')}
                          </p>
                        )}
                        <button
                          type="button"
                          disabled={savingDept || !departmentDirty}
                          onClick={() => void handleSaveDepartment()}
                          className="btn-secondary btn-secondary-sm"
                        >
                          {savingDept ? t('crm.common.saving') : t('crm.staff.profile.saveDepartment')}
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm text-neutral-900">
                        {departmentLabel || t('crm.staff.profile.departmentPlaceholder')}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-500">
                      {t('crm.staff.profile.statusTitle')}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {staff.isActive ? (
                        <span className="badge-active">
                          {t('crm.staff.status.active')}
                        </span>
                      ) : (
                        <span className="badge-inactive">
                          {t('crm.staff.status.disabled')}
                        </span>
                      )}

                      {isOwner && (
                        <>
                          <button
                            type="button"
                            disabled={statusLoading}
                            onClick={handleToggleActive}
                            className="btn-secondary btn-secondary-sm"
                          >
                            {statusLoading
                              ? t('crm.staff.profile.statusChanging')
                              : staff.isActive
                                ? t('crm.staff.profile.statusDisable')
                                : t('crm.staff.profile.statusEnable')}
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteStaff}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#f0c8cf] bg-white px-3 py-1.5 text-[12px] font-medium text-[#9a1f31] hover:bg-[#fbecef] hover:border-[#e8b4bb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {t('crm.staff.profile.delete')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isOwner && staff.email && (
                    <div className="border-t border-neutral-200/90 pt-3">
                      <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-500">
                        {t('crm.staff.profile.access.title')}
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerateLogin}
                        disabled={loginLoading}
                        className="btn-primary btn-primary-sm"
                      >
                        {loginLoading
                          ? t('crm.staff.profile.access.creating')
                          : t('crm.staff.profile.access.createReset')}
                      </button>
                      {loginInfo && (
                        <div className="mt-2 whitespace-pre-line text-[11px] text-emerald-700">
                          {loginInfo}
                        </div>
                      )}
                      {loginError && (
                        <div className="mt-2 text-[11px] text-red-600">{loginError}</div>
                      )}
                    </div>
                  )}

                  <div>
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-500">
                      {t('crm.staff.profile.activity.title')}
                    </div>
                    <div className="text-sm text-neutral-900">
                      {staff.lastActiveAt
                        ? t('crm.staff.profile.activity.last', {
                            date: new Date(staff.lastActiveAt).toLocaleString(locale),
                          })
                        : t('crm.staff.profile.activity.never')}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {t('crm.staff.profile.activity.since', {
                        date: new Date(staff.createdAt).toLocaleDateString(locale),
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 lg:col-span-2">
                  <div className="card p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-text-secondary">
                        {t('crm.staff.profile.leads.recentTitle', { count: leadsCount })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setTab('leads')}
                        className="text-[11px] font-medium text-text-secondary underline-offset-2 hover:underline"
                      >
                        {t('crm.staff.profile.leads.all')}
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      {leads.slice(0, 5).map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => navigate(`/app/leads/${l.id}`)}
                          className="w-full rounded-xl px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-hover"
                        >
                          <div className="font-medium text-neutral-900">
                            {l.name || t('crm.staff.profile.leads.fallbackName')}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {l.email || l.phone || t('crm.staff.profile.leads.fallbackContact')} ·{' '}
                            {l.status}
                          </div>
                        </button>
                      ))}
                      {leadsCount === 0 && (
                        <div className="text-[11px] italic text-neutral-500">
                          {t('crm.staff.profile.leads.empty')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-text-secondary">
                        {t('crm.staff.profile.projects.recentTitle', { count: projectsCount })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setTab('projects')}
                        className="text-[11px] font-medium text-text-secondary underline-offset-2 hover:underline"
                      >
                        {t('crm.staff.profile.projects.all')}
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      {projects.slice(0, 5).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => navigate(`/projects/${p.id}`)}
                          className="w-full rounded-xl px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-hover"
                        >
                          <div className="font-medium text-neutral-900">{p.name}</div>
                          <div className="text-[11px] text-neutral-500">
                            {p.status} · {p.amount.toLocaleString(locale)} {p.currency}
                          </div>
                        </button>
                      ))}
                      {projectsCount === 0 && (
                        <div className="text-[11px] italic text-neutral-500">
                          {t('crm.staff.profile.projects.empty')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Вкладка Лиды */}
            {tab === 'leads' && (
              <div className="rounded-lg border border-neutral-200/90 bg-white p-4 shadow-sm">
                <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-500">
                  {t('crm.staff.profile.leads.title', {
                    name: staff.fullName || staff.email,
                  })}
                </div>

                <table className="w-full border-separate border-spacing-y-0 text-xs">
                  <thead className="text-neutral-500">
                    <tr>
                      <th className="border-b border-neutral-200/90 px-2 py-2 text-left font-medium">
                        {t('crm.staff.profile.leads.table.headers.name')}
                      </th>
                      <th className="border-b border-neutral-200/90 px-2 py-2 text-left font-medium">
                        {t('crm.staff.profile.leads.table.headers.contacts')}
                      </th>
                      <th className="border-b border-neutral-200/90 px-2 py-2 text-left font-medium">
                        {t('crm.staff.profile.leads.table.headers.status')}
                      </th>
                      <th className="border-b border-neutral-200/90 px-2 py-2 text-left font-medium">
                        {t('crm.staff.profile.leads.table.headers.channel')}
                      </th>
                      <th className="border-b border-neutral-200/90 px-2 py-2 text-left font-medium">
                        {t('crm.staff.profile.leads.table.headers.created')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l) => (
                      <tr
                        key={l.id}
                        className="cursor-pointer border-b border-neutral-100 transition-colors hover:bg-neutral-50/90"
                        onClick={() => navigate(`/app/leads/${l.id}`)}
                      >
                        <td className="px-2 py-2 text-neutral-900">
                          {l.name || t('crm.staff.profile.leads.fallbackName')}
                        </td>
                        <td className="px-2 py-2 text-neutral-600">
                          {l.email || l.phone || t('crm.staff.profile.common.empty')}
                        </td>
                        <td className="px-2 py-2 text-neutral-600">{l.status}</td>
                        <td className="px-2 py-2 text-neutral-600">{l.channel}</td>
                        <td className="px-2 py-2 text-neutral-500">
                          {new Date(l.createdAt).toLocaleString(locale)}
                        </td>
                      </tr>
                    ))}

                    {leads.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-2 py-6 text-center text-[11px] italic text-neutral-500"
                        >
                          {t('crm.staff.profile.leads.table.empty')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Вкладка Проекты */}
            {tab === 'projects' && (
              <div className="rounded-lg border border-neutral-200/90 bg-white p-4 shadow-sm">
                <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-500">
                  {t('crm.staff.profile.projects.title')}
                </div>

                <table className="w-full border-separate border-spacing-y-0 text-xs">
                  <thead className="text-neutral-500">
                    <tr>
                      <th className="border-b border-neutral-200/90 px-2 py-2 text-left font-medium">
                        {t('crm.staff.profile.projects.table.headers.project')}
                      </th>
                      <th className="border-b border-neutral-200/90 px-2 py-2 text-left font-medium">
                        {t('crm.staff.profile.projects.table.headers.status')}
                      </th>
                      <th className="border-b border-neutral-200/90 px-2 py-2 text-left font-medium">
                        {t('crm.staff.profile.projects.table.headers.amount')}
                      </th>
                      <th className="border-b border-neutral-200/90 px-2 py-2 text-left font-medium">
                        {t('crm.staff.profile.projects.table.headers.lead')}
                      </th>
                      <th className="border-b border-neutral-200/90 px-2 py-2 text-left font-medium">
                        {t('crm.staff.profile.projects.table.headers.created')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => (
                      <tr
                        key={p.id}
                        className="cursor-pointer border-b border-neutral-100 transition-colors hover:bg-neutral-50/90"
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        <td className="px-2 py-2 text-neutral-900">{p.name}</td>
                        <td className="px-2 py-2 text-neutral-600">{p.status}</td>
                        <td className="px-2 py-2 text-neutral-600">
                          {p.amount.toLocaleString(locale)} {p.currency}
                        </td>
                        <td className="px-2 py-2 text-neutral-600">
                          {p.leadName || t('crm.staff.profile.common.empty')}
                        </td>
                        <td className="px-2 py-2 text-neutral-500">
                          {new Date(p.createdAt).toLocaleString(locale)}
                        </td>
                      </tr>
                    ))}

                    {projects.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-2 py-6 text-center text-[11px] italic text-neutral-500"
                        >
                          {t('crm.staff.profile.projects.table.empty')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Вкладка Задачи */}
            {tab === 'tasks' && (
              <div className="rounded-lg border border-neutral-200/90 bg-white p-4 shadow-sm">
                <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-500">
                  {t('crm.staff.profile.tasks.title')}
                </div>

                <table className="w-full border-separate border-spacing-y-0 text-xs">
                  <thead className="text-neutral-500">
                    <tr>
                      <th className="border-b border-neutral-200/90 px-2 py-2 text-left font-medium">
                        {t('crm.staff.profile.tasks.table.headers.task')}
                      </th>
                      <th className="border-b border-neutral-200/90 px-2 py-2 text-left font-medium">
                        {t('crm.staff.profile.tasks.table.headers.project')}
                      </th>
                      <th className="border-b border-neutral-200/90 px-2 py-2 text-left font-medium">
                        {t('crm.staff.profile.tasks.table.headers.status')}
                      </th>
                      <th className="border-b border-neutral-200/90 px-2 py-2 text-left font-medium">
                        {t('crm.staff.profile.tasks.table.headers.priority')}
                      </th>
                      <th className="border-b border-neutral-200/90 px-2 py-2 text-left font-medium">
                        {t('crm.staff.profile.tasks.table.headers.deadline')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr
                        key={task.id + task.projectId}
                        className="cursor-pointer border-b border-neutral-100 transition-colors hover:bg-neutral-50/90"
                        onClick={() => navigate(`/projects/${task.projectId}`)}
                      >
                        <td className="px-2 py-2 text-neutral-900">
                          {task.title || t('crm.staff.profile.tasks.fallbackTitle')}
                        </td>
                        <td className="px-2 py-2 text-neutral-600">{task.projectName}</td>
                        <td className="px-2 py-2 text-neutral-600">{task.status}</td>
                        <td className="px-2 py-2 text-neutral-600">{task.priority}</td>
                        <td className="px-2 py-2 text-neutral-500">
                          {task.deadline || t('crm.staff.profile.common.empty')}
                        </td>
                      </tr>
                    ))}

                    {tasks.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-2 py-6 text-center text-[11px] italic text-neutral-500"
                        >
                          {t('crm.staff.profile.tasks.table.empty')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
};
