// src/pages/staff/StaffListPage.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';

import {
  fetchStaff,
  createStaffUser,
  deactivateStaffUser,
  activateStaffUser,
  updateStaffRole,
  updateStaffDepartment,
  type StaffUser,
  type StaffRole,
} from '../../api/staff';

import { adminProvisionUser } from '../../api/users';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // создание нового пользователя
  const [creating, setCreating] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDept, setNewDept] = useState('');
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

    fetchStaff()
      .then((data) => {
        if (!alive) return;
        setItems(data);
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

  // ---------- СОЗДАНИЕ ----------
  const handleCreate = async () => {
    if (!newFullName.trim() || !newEmail.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const u = await createStaffUser({
        fullName: newFullName.trim(),
        email: newEmail.trim(),
        department: newDept.trim() || undefined,
        role: newRole,
      });

      setItems((prev) => [...prev, u]);

      setNewFullName('');
      setNewEmail('');
      setNewDept('');
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

  // ---------- ОТДЕЛ ----------
  const handleSaveDept = async (id: string, department: string) => {
    try {
      await updateStaffDepartment(id, department);
      setItems((prev) =>
        prev.map((u) => (u.id === id ? { ...u, department } : u)),
      );
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
              className="base-input"
            />
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t('crm.staff.create.email')}
              className="base-input"
            />
            <input
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              placeholder={t('crm.staff.create.department')}
              className="base-input"
            />

            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as StaffRole)}
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
              disabled={creating}
              className="btn-primary"
            >
              {creating ? t('crm.staff.create.creating') : t('crm.staff.create.submit')}
            </button>
          </div>
        </div>

        {/* Таблица */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
          {loading ? (
            <div className="text-xs text-slate-400">{t('crm.staff.loading')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[820px] w-full text-xs border-separate border-spacing-y-1">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-3 py-1 text-left">{t('crm.staff.table.headers.name')}</th>
                  <th className="px-3 py-1 text-left">{t('crm.staff.table.headers.email')}</th>
                  <th className="px-3 py-1 text-left">{t('crm.staff.table.headers.department')}</th>
                  <th className="px-3 py-1 text-left">{t('crm.staff.table.headers.role')}</th>
                  <th className="px-3 py-1 text-left">{t('crm.staff.table.headers.status')}</th>
                  <th className="px-3 py-1 text-right">{t('crm.staff.table.headers.actions')}</th>
                </tr>
              </thead>

              <tbody>
                {items.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/app/staff/${u.id}/profile`)}
                  >
                    {/* Сотрудник */}
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        {renderAvatar(u)}
                        <div>
                          <div className="text-[13px]">{u.fullName}</div>
                          <div className="text-[10px] text-slate-500">
                            {t('crm.staff.table.id', { id: u.id.slice(0, 8) })}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-3 py-1.5 text-slate-700">{u.email}</td>

                    {/* Отдел (inline) */}
                    <td className="px-3 py-1.5 text-slate-300">
                      {editDeptId === u.id ? (
                        <input
                          defaultValue={u.department || ''}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={(e) =>
                            handleSaveDept(u.id, e.target.value.trim())
                          }
                          autoFocus
                          className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-800 text-xs outline-none"
                        />
                      ) : (
                        <button
                          className="text-slate-600 hover:text-slate-900"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditDeptId(u.id);
                          }}
                        >
                          {u.department || t('crm.staff.common.empty')}
                        </button>
                      )}
                    </td>

                    {/* Роль (inline) */}
                    <td className="px-3 py-1.5 text-slate-700">
                      {editRoleId === u.id ? (
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
                      ) : (
                        <button
                          className="text-slate-600 hover:text-slate-900"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditRoleId(u.id);
                          }}
                        >
                          {roleLabels[u.role]}
                        </button>
                      )}
                    </td>

                    {/* Статус */}
                    <td className="px-3 py-1.5">
                      {u.isActive ? (
                        <span className="badge-active">{t('crm.staff.status.active')}</span>
                      ) : (
                        <span className="badge-disabled">{t('crm.staff.status.disabled')}</span>
                      )}
                    </td>

                    {/* Действия */}
                    <td className="px-3 py-1.5 text-right space-x-3">
                      <button
                        className="text-[11px] text-emerald-600 hover:text-emerald-700"
                        onClick={(e) => handleResetPassword(u, e)}
                      >
                        {t('crm.staff.actions.resetPassword')}
                      </button>

                      {u.isActive ? (
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
                    <td
                      colSpan={6}
                      className="px-3 py-3 text-center text-[12px] text-slate-500"
                    >
                      {t('crm.staff.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          )}
        </div>

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
