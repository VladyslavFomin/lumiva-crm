// src/pages/staff/StaffListPage.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';

import {
  fetchStaff,
  inviteStaffMember,
  deactivateStaffUser,
  activateStaffUser,
  updateStaffRole,
  updateStaffUser,
  type StaffUser,
  type StaffRole,
} from '../../api/staff';
import { fetchDepartments, type Department } from '../../api/departments';

import { adminProvisionUser } from '../../api/users';
import { getStoredUser } from '../../auth/session';
import { LottieIcon } from '../../components/LottieIcon';
import '../projects/ProjectsListPage.css';
import './staff-list-design.css';

type DialogKind = 'info' | 'confirm';

interface DialogState {
  kind: DialogKind;
  title: string;
  message: string;
  onConfirm?: () => void;
}

export const StaffListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [items, setItems] = useState<StaffUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwner = (getStoredUser()?.role || '').toLowerCase() === 'owner';

  // создание нового пользователя
  const [creating, setCreating] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDepartmentId, setNewDepartmentId] = useState('');
  const [newRole, setNewRole] = useState<StaffRole>('manager');

  // inline-редактирование
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [editDeptId, setEditDeptId] = useState<string | null>(null);

  // наш popup-диалог
  const [dialog, setDialog] = useState<DialogState | null>(null);
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
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([fetchStaff(), fetchDepartments()])
      .then(([staffRows, deptRows]) => {
        if (!alive) return;
        setItems(staffRows);
        setDepartments(deptRows);
      })
      .catch((e: any) => {
        if (!alive) return;
        console.error(e);
        setError(e.message || t('crm.staff.errors.load'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  // ---------- СОЗДАНИЕ (реальное приглашение по email) ----------
  const handleCreate = async () => {
    if (!newFullName.trim() || !newEmail.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const u = await inviteStaffMember({
        fullName: newFullName.trim(),
        email: newEmail.trim(),
        role: newRole,
        departmentId: newDepartmentId || null,
      });

      setItems((prev) => [...prev, u]);

      setDialog({
        kind: 'info',
        title: t('crm.staff.dialogs.inviteSent.title'),
        message: t('crm.staff.dialogs.inviteSent.message', { email: u.email }),
      });

      setNewFullName('');
      setNewEmail('');
      setNewDepartmentId('');
      setNewRole('manager');
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.staff.errors.create'));
    } finally {
      setCreating(false);
    }
  };

  // ---------- ДЕАКТИВАЦИЯ ----------
  const doDeactivate = async (id: string) => {
    try {
      await deactivateStaffUser(id);
      setItems((prev) =>
        prev.map((u) => (u.id === id ? { ...u, isActive: false } : u)),
      );
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.staff.errors.deactivate'));
    }
  };

  const handleDeactivate = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDialog({
      kind: 'confirm',
      title: t('crm.staff.dialogs.deactivate.title'),
      message: t('crm.staff.dialogs.deactivate.message'),
      onConfirm: () => doDeactivate(id),
    });
  };

  // ---------- АКТИВАЦИЯ ----------
  const doActivate = async (id: string) => {
    try {
      await activateStaffUser(id);
      setItems((prev) =>
        prev.map((u) => (u.id === id ? { ...u, isActive: true } : u)),
      );
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.staff.errors.activate'));
    }
  };

  const handleActivate = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    doActivate(id);
  };

  // ---------- РОЛЬ ----------
  const handleSaveRole = async (id: string, role: StaffRole) => {
    try {
      await updateStaffRole(id, role);
      setItems((prev) =>
        prev.map((u) => (u.id === id ? { ...u, role } : u)),
      );
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.staff.errors.role'));
    } finally {
      setEditRoleId(null);
    }
  };

  // ---------- ОТДЕЛ (из справочника /departments) ----------
  const handleSaveDept = async (id: string, departmentId: string) => {
    try {
      const nextId = departmentId || null;
      const dept = nextId ? departments.find((d) => d.id === nextId) : null;
      const updated = await updateStaffUser(id, {
        departmentId: nextId,
        department: dept?.name ?? null,
      });
      setItems((prev) => prev.map((u) => (u.id === id ? updated : u)));
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.staff.errors.department'));
    } finally {
      setEditDeptId(null);
    }
  };

  // ---------- СБРОС ПАРОЛЯ ----------
  const handleResetPassword = async (u: StaffUser, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    try {
      const res = await adminProvisionUser({
        email: u.email,
        name: u.fullName,
        role: u.role,
      });

      setDialog({
        kind: 'info',
        title: t('crm.staff.dialogs.resetPassword.title'),
        message: t('crm.staff.dialogs.resetPassword.message', {
          email: u.email,
          login: res.email,
          password: res.password,
        }),
      });
    } catch (err: any) {
      console.error(err);
      setDialog({
        kind: 'info',
        title: t('crm.staff.dialogs.error.title'),
        message: err.message || t('crm.staff.dialogs.error.message'),
      });
    }
  };

  // ---------- АВАТАР ----------
  const renderAvatar = (u: StaffUser) => {
    const initials = u.fullName
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return (
      <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px] text-slate-700">
        {initials || t('crm.staff.common.initialsFallback')}
      </div>
    );
  };

  // ---------- РЕНДЕР ----------
  return (
    <MainLayout>
      <div className="space-y-4">
        {/* HEADER */}
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{t('crm.staff.title')}</h1>
          <div className="text-[11px] text-slate-500">
            {t('crm.staff.subtitle')}
          </div>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Форма добавления */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4 space-y-3 shadow-sm">
          <div className="text-xs text-slate-500 mb-1">{t('crm.staff.create.title')}</div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              placeholder={t('crm.staff.create.fullName')}
              disabled={!isOwner}
              className="base-input"
            />
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t('crm.staff.create.email')}
              disabled={!isOwner}
              className="base-input"
            />
            <select
              value={newDepartmentId}
              onChange={(e) => setNewDepartmentId(e.target.value)}
              disabled={!isOwner}
              className="base-input"
            >
              <option value="">{t('crm.staff.create.departmentPlaceholder')}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as StaffRole)}
              disabled={!isOwner}
              className="base-input"
            >
              {Object.entries(roleLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !isOwner}
              className="btn-primary"
            >
              {creating ? t('crm.staff.create.creating') : t('crm.staff.create.submit')}
            </button>
          </div>

          {!isOwner && (
            <div className="text-[11px] text-slate-400">
              {t('crm.staff.create.ownerOnly')}
            </div>
          )}
        </div>

        {/* Таблица */}
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
            <div className="text-xs text-slate-400">{t('crm.staff.loading')}</div>
          </div>
        ) : (
          <div className="lv-proj-wrap">
            <div className="lv-proj-scroll">
              <table className="lv-proj-table lv-staff-table min-w-[820px]">
              <thead>
                <tr>
                  <th><span className="lv-th-inner">{t('crm.staff.table.headers.name')}</span></th>
                  <th><span className="lv-th-inner">{t('crm.staff.table.headers.email')}</span></th>
                  <th><span className="lv-th-inner">{t('crm.staff.table.headers.department')}</span></th>
                  <th><span className="lv-th-inner">{t('crm.staff.table.headers.role')}</span></th>
                  <th><span className="lv-th-inner">{t('crm.staff.table.headers.status')}</span></th>
                  <th className="text-right"><span className="lv-th-inner justify-end">{t('crm.staff.table.headers.actions')}</span></th>
                </tr>
              </thead>

              <tbody>
                {items.map((u) => (
                  <tr
                    key={u.id}
                    className="lv-proj-row"
                    onClick={() => navigate(`/app/staff/${u.id}/profile`)}
                  >
                    {/* Сотрудник */}
                    <td>
                      <div className="lv-cell-name">
                        {renderAvatar(u)}
                        <div className="min-w-0">
                          <div className="lv-name-text">{u.fullName}</div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="text-slate-700">{u.email}</td>

                    {/* Отдел (inline, из справочника /departments, только владелец) */}
                    <td className="text-slate-300">
                      {isOwner && editDeptId === u.id ? (
                        <select
                          defaultValue={u.departmentId || ''}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={(e) => handleSaveDept(u.id, e.target.value)}
                          autoFocus
                          className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-800 text-xs outline-none"
                        >
                          <option value="">{t('crm.staff.create.departmentPlaceholder')}</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      ) : isOwner ? (
                        <button
                          className="text-slate-600 hover:text-slate-900"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditDeptId(u.id);
                          }}
                        >
                          {departments.find((d) => d.id === u.departmentId)?.name ||
                            u.department ||
                            t('crm.staff.common.empty')}
                        </button>
                      ) : (
                        departments.find((d) => d.id === u.departmentId)?.name ||
                        u.department ||
                        t('crm.staff.common.empty')
                      )}
                    </td>

                    {/* Роль (inline, только владелец компании — см. staff-users.controller.ts) */}
                    <td className="text-slate-700">
                      {isOwner && editRoleId === u.id ? (
                        <select
                          defaultValue={u.role}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={(e) =>
                            handleSaveRole(
                              u.id,
                              e.target.value as StaffRole,
                            )
                          }
                          autoFocus
                          className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-800 text-xs outline-none"
                        >
                          {Object.entries(roleLabels).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      ) : isOwner ? (
                        <button
                          className="text-slate-600 hover:text-slate-900"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditRoleId(u.id);
                          }}
                        >
                          {roleLabels[u.role]}
                        </button>
                      ) : (
                        roleLabels[u.role]
                      )}
                    </td>

                    {/* Статус */}
                    <td>
                      {u.isActive ? (
                        <span className="badge-active">{t('crm.staff.status.active')}</span>
                      ) : (
                        <span className="badge-disabled">{t('crm.staff.status.disabled')}</span>
                      )}
                    </td>

                    {/* Действия */}
                    <td className="text-right space-x-3">
                      <button
                        className="text-[11px] text-emerald-600 hover:text-emerald-700"
                        onClick={(e) => handleResetPassword(u, e)}
                      >
                        {t('crm.staff.actions.resetPassword')}
                      </button>

                      {!isOwner ? null : u.isActive ? (
                        <button
                          className="text-[11px] text-rose-600 hover:text-rose-700"
                          onClick={(e) => handleDeactivate(u.id, e)}
                        >
                          {t('crm.staff.actions.deactivate')}
                        </button>
                      ) : (
                        <button
                          className="text-[11px] text-emerald-600 hover:text-emerald-700"
                          onClick={(e) => handleActivate(u.id, e)}
                        >
                          {t('crm.staff.actions.activate')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {!items.length && (
                  <tr>
                    <td colSpan={6} className="text-center text-[12px] text-slate-500">
                      <div className="flex flex-col items-center gap-1 py-6">
                        <LottieIcon name="team-connect" size={72} />
                        <span>{t('crm.staff.empty')}</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              </table>
            </div>
            <div className="lv-proj-foot">
              <div className="lv-proj-foot-stats">
                <span>
                  <span className="lbl">{t('crm.staff.table.footerTotal')}:</span>{' '}
                  <strong>{items.length}</strong>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* POPUP-ДИАЛОГ */}
        {dialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-xl p-4">
              <div className="text-sm font-semibold text-slate-900 mb-1">
                {dialog.title}
              </div>
              <div className="text-xs text-slate-600 whitespace-pre-line mb-4">
                {dialog.message}
              </div>

              <div className="flex justify-end gap-2 text-xs">
                {dialog.kind === 'confirm' && (
                  <button
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-800 bg-white hover:bg-slate-50"
                    onClick={() => setDialog(null)}
                  >
                    {t('crm.staff.dialogs.cancel')}
                  </button>
                )}

                <button
                  className="px-3 py-1.5 rounded-xl bg-lumiva-accent text-white font-semibold shadow-sm hover:-translate-y-[1px] transition"
                  onClick={() => {
                    if (dialog.kind === 'confirm' && dialog.onConfirm) {
                      dialog.onConfirm();
                    }
                    setDialog(null);
                  }}
                >
                  {t('crm.staff.dialogs.ok')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
