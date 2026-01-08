// src/pages/staff/StaffProfilePage.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';

import {
  fetchStaffById,
  updateStaffRole,
  updateStaffDepartment,
  activateStaffUser,
  deactivateStaffUser,
  deleteStaffUser,
  type StaffUser,
  type StaffRole,
} from '../../api/staff';

import { fetchLeads, type Lead } from '../../api/leads';
import { fetchProjects } from '../../api/projects';
import type { Project, ProjectTask } from '../projects/projectTypes';
import { getStoredUser } from '../../auth/session';
import { adminProvisionUser } from '../../api/users';
import { getLocale } from '../../i18n/utils';

type TabId = 'overview' | 'leads' | 'projects' | 'tasks';

interface TaskWithProject extends ProjectTask {
  projectId: string;
  projectName: string;
}

export const StaffProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabId>('overview');

  const [staff, setStaff] = useState<StaffUser | null>(null);
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

        // 2) Параллельно грузим лиды и проекты
        const [allLeads, projRes] = await Promise.all([
          fetchLeads(), // Lead[]
          fetchProjects(), // { total, items } или массив
        ]);
        if (!alive) return;

        const projectsItems: Project[] =
          (projRes as any).items ?? (projRes as any);

        // Лиды: по assignedUserId или по assignedTo (ФИО)
        let myLeads: Lead[];

        if (isSelfView) {
          // Если сотрудник смотрит свой профиль — показываем ВСЕ его лиды,
          // которые backend уже отфильтровал и вернул в fetchLeads().
          myLeads = allLeads;
        } else {
          // Если владелец/менеджер смотрит профиль другого сотрудника — фильтруем вручную
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

        // Проекты: по ownerUserId или owner === fullName
        const myProjects = projectsItems.filter((p) => {
          if ((p as any).ownerUserId && (p as any).ownerUserId === user.id) {
            return true;
          }
          if (p.owner && user.fullName && p.owner === user.fullName) {
            return true;
          }
          return false;
        });

        // Задачи: по assignees содержит ФИО
        const myTasks: TaskWithProject[] = [];
        for (const p of myProjects) {
          const list = p.tasks || [];
          for (const t of list) {
            const hasAssignee = (t.assignees || []).some(
              (a) => a && user.fullName && a.trim() === user.fullName,
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
  }, [id]);

  const initials = useMemo(() => {
    if (!staff?.fullName) return '?';
    return staff.fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
  }, [staff]);

  const leadsCount = leads.length;
  const projectsCount = projects.length;
  const tasksCount = tasks.length;

  const handleBack = () => {
    navigate('/app/staff');
  };

  if (!id) {
    return (
      <MainLayout>
        <div className="p-4 text-slate-200 text-sm">
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

  // ====== Смена отдела ======
  const handleDeptBlur = async (value: string) => {
    if (!staff) return;
    const normalized = value.trim() || null;
    if (normalized === (staff.department ?? null)) return;

    setSavingDept(true);
    setError(null);
    try {
      const updated = await updateStaffDepartment(staff.id, normalized || '');
      setStaff(updated);
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
  if (!window.confirm(t('crm.staff.profile.deleteConfirm'))) {
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
      window.alert(t('crm.staff.profile.access.onlyOwner'));
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
      <div className="space-y-4">
        {/* Верхняя панель */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <button
                type="button"
                onClick={handleBack}
                className="text-[11px] text-slate-400 hover:text-slate-200 mb-1"
              >
                ← {t('crm.staff.profile.back')}
              </button>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center text-sm font-semibold text-slate-100">
                  {initials}
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">
                    {t('crm.staff.profile.title')}
                  </div>
                  <h1 className="text-lg font-semibold text-slate-50">
                    {staff?.fullName || staff?.email || t('crm.staff.profile.fallbackName')}
                  </h1>
                  {staff && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span>{roleLabels[staff.role]}</span>
                      <span className="opacity-40">·</span>
                      <span>{t('crm.staff.profile.idShort', { id: staff.id.slice(0, 8) })}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* справа — кнопка только если смотрим свой профиль */}
          {isSelf && (
            <button
              type="button"
              onClick={() => navigate('/app/profile')}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-700/80 text-slate-300 hover:bg-slate-900/70"
            >
              {t('crm.staff.profile.selfProfile')}
            </button>
          )}
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-xs text-slate-400">
            {t('crm.staff.profile.loading')}
          </div>
        )}

        {!loading && staff && (
          <>
            {/* KPI-строка */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-3xl bg-slate-900/80 border border-slate-800/80 px-4 py-3">
                <div className="text-[11px] text-slate-500 mb-1">
                  {t('crm.staff.profile.kpis.leadsTitle')}
                </div>
                <div className="text-2xl font-semibold text-slate-50">
                  {leadsCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {t('crm.staff.profile.kpis.leadsHint', {
                    name: staff.fullName || t('crm.staff.profile.kpis.managerFallback'),
                  })}
                </div>
              </div>

              <div className="rounded-3xl bg-slate-900/80 border border-slate-800/80 px-4 py-3">
                <div className="text-[11px] text-slate-500 mb-1">
                  {t('crm.staff.profile.kpis.projectsTitle')}
                </div>
                <div className="text-2xl font-semibold text-slate-50">
                  {projectsCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {t('crm.staff.profile.kpis.projectsHint')}
                </div>
              </div>

              <div className="rounded-3xl bg-slate-900/80 border border-slate-800/80 px-4 py-3">
                <div className="text-[11px] text-slate-500 mb-1">
                  {t('crm.staff.profile.kpis.tasksTitle')}
                </div>
                <div className="text-2xl font-semibold text-slate-50">
                  {tasksCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {t('crm.staff.profile.kpis.tasksHint')}
                </div>
              </div>
            </div>

            {/* Вкладки */}
            <div className="inline-flex bg-slate-900/70 border border-slate-800/80 rounded-2xl p-1 text-[13px]">
              <button
                type="button"
                onClick={() => setTab('overview')}
                className={
                  'px-4 py-1.5 rounded-xl ' +
                  (tab === 'overview'
                    ? 'bg-slate-800 text-slate-50'
                    : 'text-slate-400 hover:text-slate-100')
                }
              >
                {t('crm.staff.profile.tabs.overview')}
              </button>
              <button
                type="button"
                onClick={() => setTab('leads')}
                className={
                  'px-4 py-1.5 rounded-xl ' +
                  (tab === 'leads'
                    ? 'bg-slate-800 text-slate-50'
                    : 'text-slate-400 hover:text-slate-100')
                }
              >
                {t('crm.staff.profile.tabs.leads')}
              </button>
              <button
                type="button"
                onClick={() => setTab('projects')}
                className={
                  'px-4 py-1.5 rounded-xl ' +
                  (tab === 'projects'
                    ? 'bg-slate-800 text-slate-50'
                    : 'text-slate-400 hover:text-slate-100')
                }
              >
                {t('crm.staff.profile.tabs.projects')}
              </button>
              <button
                type="button"
                onClick={() => setTab('tasks')}
                className={
                  'px-4 py-1.5 rounded-xl ' +
                  (tab === 'tasks'
                    ? 'bg-slate-800 text-slate-50'
                    : 'text-slate-400 hover:text-slate-100')
                }
              >
                {t('crm.staff.profile.tabs.tasks')}
              </button>
            </div>

            {/* Контент вкладок */}
            {tab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Левая колонка — профиль и доступ */}
                <div className="lg:col-span-1 bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-3">
                  {/* Контакты */}
                  <div>
                    <div className="text-xs text-slate-400 mb-1">
                      {t('crm.staff.profile.contacts.title')}
                    </div>
                    <div className="text-sm text-slate-50">
                      {staff.email}
                    </div>
                    {staff.phone && (
                      <div className="text-sm text-slate-300 mt-1">
                        {staff.phone}
                      </div>
                    )}
                  </div>

                  {/* Роль и отдел */}
                  <div>
                    <div className="text-xs text-slate-400 mb-1">
                      {t('crm.staff.profile.roleAndDepartment')}
                    </div>

                    {/* Роль */}
                    <div className="mb-2">
                      {isOwner ? (
                        <select
                          value={staff.role}
                          disabled={savingRole}
                          onChange={(e) =>
                            handleChangeRole(e.target.value as StaffRole)
                          }
                          className="w-full px-2 py-1 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-50 outline-none"
                        >
                          {Object.entries(roleLabels).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-sm text-slate-50">
                          {roleLabels[staff.role]}
                        </div>
                      )}
                    </div>

                    {/* Отдел */}
                    <div className="text-xs text-slate-400 mb-1">
                      {t('crm.staff.profile.department')}
                    </div>
                    {isOwner ? (
                      <input
                        defaultValue={staff.department || ''}
                        disabled={savingDept}
                        onBlur={(e) => handleDeptBlur(e.target.value)}
                        className="w-full px-2 py-1 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-50 outline-none"
                        placeholder={t('crm.staff.profile.departmentPlaceholder')}
                      />
                    ) : (
                      <div className="text-sm text-slate-50">
                        {staff.department || t('crm.staff.profile.departmentPlaceholder')}
                      </div>
                    )}
                  </div>

                  {/* Статус сотрудника */}
                  <div>
                    <div className="text-xs text-slate-400 mb-1">
                      {t('crm.staff.profile.statusTitle')}
                    </div>
                    <div className="flex items-center gap-2">
                      {staff.isActive ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 text-[11px]">
                          {t('crm.staff.status.active')}
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[11px]">
                          {t('crm.staff.status.disabled')}
                        </span>
                      )}

                      {isOwner && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={statusLoading}
                            onClick={handleToggleActive}
                            className="px-2 py-1 text-[11px] rounded-xl border border-slate-700/80 text-slate-200 hover:bg-slate-900/70 disabled:opacity-60"
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
                            className="px-2 py-1 text-[11px] rounded-xl border border-rose-700/80 text-rose-300 hover:bg-rose-900/40"
                          >
                            {t('crm.staff.profile.delete')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Доступ в CRM — только для владельца */}
                  {isOwner && staff.email && (
                    <div className="pt-3 border-t border-slate-800/70">
                      <div className="text-xs text-slate-400 mb-1">
                        {t('crm.staff.profile.access.title')}
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerateLogin}
                        disabled={loginLoading}
                        className="px-3 py-1.5 text-[11px] rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
                      >
                        {loginLoading
                          ? t('crm.staff.profile.access.creating')
                          : t('crm.staff.profile.access.createReset')}
                      </button>

                      {loginInfo && (
                        <div className="mt-2 text-[11px] text-emerald-300 whitespace-pre-line">
                          {loginInfo}
                        </div>
                      )}

                      {loginError && (
                        <div className="mt-2 text-[11px] text-rose-300">
                          {loginError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Активность */}
                  <div>
                    <div className="text-xs text-slate-400 mb-1">
                      {t('crm.staff.profile.activity.title')}
                    </div>
                      <div className="text-sm text-slate-50">
                        {staff.lastActiveAt
                          ? t('crm.staff.profile.activity.last', {
                              date: new Date(staff.lastActiveAt).toLocaleString(locale),
                            })
                          : t('crm.staff.profile.activity.never')}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {t('crm.staff.profile.activity.since', {
                          date: new Date(staff.createdAt).toLocaleDateString(locale),
                        })}
                      </div>
                  </div>
                </div>

                {/* Правая — мини-таблицы */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Последние лиды */}
                  <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-slate-400">
                        {t('crm.staff.profile.leads.recentTitle', { count: leadsCount })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setTab('leads')}
                        className="text-[11px] text-lumiva-accent hover:text-lumiva-accent-soft"
                      >
                        {t('crm.staff.profile.leads.all')}
                      </button>
                    </div>

                    <div className="space-y-1">
                      {leads.slice(0, 5).map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => navigate(`/app/leads/${l.id}`)}
                          className="w-full text-left px-2 py-1.5 rounded-xl hover:bg-slate-950/70 text-xs"
                        >
                          <div className="text-slate-50">
                            {l.name || t('crm.staff.profile.leads.fallbackName')}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {l.email || l.phone || t('crm.staff.profile.leads.fallbackContact')} ·{' '}
                            {l.status}
                          </div>
                        </button>
                      ))}

                      {leadsCount === 0 && (
                        <div className="text-[11px] text-slate-500 italic">
                          {t('crm.staff.profile.leads.empty')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Последние проекты */}
                  <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-slate-400">
                        {t('crm.staff.profile.projects.recentTitle', { count: projectsCount })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setTab('projects')}
                        className="text-[11px] text-lumiva-accent hover:text-lumiva-accent-soft"
                      >
                        {t('crm.staff.profile.projects.all')}
                      </button>
                    </div>

                    <div className="space-y-1">
                      {projects.slice(0, 5).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => navigate(`/app/projects/${p.id}`)}
                          className="w-full text-left px-2 py-1.5 rounded-xl hover:bg-slate-950/70 text-xs"
                        >
                          <div className="text-slate-50">{p.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {p.status} · {p.amount.toLocaleString(locale)}{' '}
                            {p.currency}
                          </div>
                        </button>
                      ))}

                      {projectsCount === 0 && (
                        <div className="text-[11px] text-slate-500 italic">
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
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
                <div className="text-xs text-slate-400 mb-2">
                  {t('crm.staff.profile.leads.title', {
                    name: staff.fullName || staff.email,
                  })}
                </div>

                <table className="w-full text-xs border-separate border-spacing-y-1">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="text-left px-2 py-1">
                        {t('crm.staff.profile.leads.table.headers.name')}
                      </th>
                      <th className="text-left px-2 py-1">
                        {t('crm.staff.profile.leads.table.headers.contacts')}
                      </th>
                      <th className="text-left px-2 py-1">
                        {t('crm.staff.profile.leads.table.headers.status')}
                      </th>
                      <th className="text-left px-2 py-1">
                        {t('crm.staff.profile.leads.table.headers.channel')}
                      </th>
                      <th className="text-left px-2 py-1">
                        {t('crm.staff.profile.leads.table.headers.created')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l) => (
                      <tr
                        key={l.id}
                        className="bg-slate-950/80 hover:bg-slate-900/80 cursor-pointer"
                        onClick={() => navigate(`/app/leads/${l.id}`)}
                      >
                        <td className="px-2 py-1.5 text-slate-100">
                          {l.name || t('crm.staff.profile.leads.fallbackName')}
                        </td>
                        <td className="px-2 py-1.5 text-slate-400">
                          {l.email || l.phone || t('crm.staff.profile.common.empty')}
                        </td>
                        <td className="px-2 py-1.5 text-slate-400">
                          {l.status}
                        </td>
                        <td className="px-2 py-1.5 text-slate-400">
                          {l.channel}
                        </td>
                        <td className="px-2 py-1.5 text-slate-500">
                          {new Date(l.createdAt).toLocaleString(locale)}
                        </td>
                      </tr>
                    ))}

                    {leads.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-2 py-3 text-center text-[11px] text-slate-500 italic"
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
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
                <div className="text-xs text-slate-400 mb-2">
                  {t('crm.staff.profile.projects.title')}
                </div>

                <table className="w-full text-xs border-separate border-spacing-y-1">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="text-left px-2 py-1">
                        {t('crm.staff.profile.projects.table.headers.project')}
                      </th>
                      <th className="text-left px-2 py-1">
                        {t('crm.staff.profile.projects.table.headers.status')}
                      </th>
                      <th className="text-left px-2 py-1">
                        {t('crm.staff.profile.projects.table.headers.amount')}
                      </th>
                      <th className="text-left px-2 py-1">
                        {t('crm.staff.profile.projects.table.headers.lead')}
                      </th>
                      <th className="text-left px-2 py-1">
                        {t('crm.staff.profile.projects.table.headers.created')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => (
                      <tr
                        key={p.id}
                        className="bg-slate-950/80 hover:bg-slate-900/80 cursor-pointer"
                        onClick={() => navigate(`/app/projects/${p.id}`)}
                      >
                        <td className="px-2 py-1.5 text-slate-100">
                          {p.name}
                        </td>
                        <td className="px-2 py-1.5 text-slate-400">
                          {p.status}
                        </td>
                        <td className="px-2 py-1.5 text-slate-400">
                          {p.amount.toLocaleString(locale)} {p.currency}
                        </td>
                        <td className="px-2 py-1.5 text-slate-400">
                          {p.leadName || t('crm.staff.profile.common.empty')}
                        </td>
                        <td className="px-2 py-1.5 text-slate-500">
                          {new Date(p.createdAt).toLocaleString(locale)}
                        </td>
                      </tr>
                    ))}

                    {projects.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-2 py-3 text-center text-[11px] text-slate-500 italic"
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
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
                <div className="text-xs text-slate-400 mb-2">
                  {t('crm.staff.profile.tasks.title')}
                </div>

                <table className="w-full text-xs border-separate border-spacing-y-1">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="text-left px-2 py-1">
                        {t('crm.staff.profile.tasks.table.headers.task')}
                      </th>
                      <th className="text-left px-2 py-1">
                        {t('crm.staff.profile.tasks.table.headers.project')}
                      </th>
                      <th className="text-left px-2 py-1">
                        {t('crm.staff.profile.tasks.table.headers.status')}
                      </th>
                      <th className="text-left px-2 py-1">
                        {t('crm.staff.profile.tasks.table.headers.priority')}
                      </th>
                      <th className="text-left px-2 py-1">
                        {t('crm.staff.profile.tasks.table.headers.deadline')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => (
                      <tr
                        key={t.id + t.projectId}
                        className="bg-slate-950/80 hover:bg-slate-900/80 cursor-pointer"
                        onClick={() =>
                          navigate(`/app/projects/${t.projectId}`)
                        }
                      >
                        <td className="px-2 py-1.5 text-slate-100">
                          {t.title || t('crm.staff.profile.tasks.fallbackTitle')}
                        </td>
                        <td className="px-2 py-1.5 text-slate-400">
                          {t.projectName}
                        </td>
                        <td className="px-2 py-1.5 text-slate-400">
                          {t.status}
                        </td>
                        <td className="px-2 py-1.5 text-slate-400">
                          {t.priority}
                        </td>
                        <td className="px-2 py-1.5 text-slate-500">
                          {t.deadline || t('crm.staff.profile.common.empty')}
                        </td>
                      </tr>
                    ))}

                    {tasks.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-2 py-3 text-center text-[11px] text-slate-500 italic"
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
