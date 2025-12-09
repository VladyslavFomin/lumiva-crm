// src/pages/staff/StaffListPage.tsx

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const ROLE_LABEL: Record<StaffRole, string> = {
  owner: 'Владелец',
  manager: 'Менеджер',
  viewer: 'Наблюдатель',
  finance: 'Финансы',
  sales: 'Продажи',
  developer: 'Разработчик',
  support: 'Поддержка',
};

type DialogKind = 'info' | 'confirm';

interface DialogState {
  kind: DialogKind;
  title: string;
  message: string;
  onConfirm?: () => void;
}

export const StaffListPage: React.FC = () => {
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
        setError(e.message || 'Ошибка загрузки сотрудников');
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
      setError(e.message || 'Ошибка создания сотрудника');
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
      setError(e.message || 'Ошибка отключения сотрудника');
    }
  };

  const handleDeactivate = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDialog({
      kind: 'confirm',
      title: 'Отключить сотрудника?',
      message:
        'Сотрудник потеряет доступ к CRM, но останется в списке.\n' +
        'Вы всегда сможете включить его обратно.',
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
      setError(e.message || 'Ошибка включения сотрудника');
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
      setError(e.message || 'Ошибка обновления роли');
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
      setError(e.message || 'Ошибка обновления отдела');
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
        title: 'Пароль сброшен',
        message:
          `Новый доступ для ${u.email}:\n\n` +
          `Логин: ${res.email}\nПароль: ${res.password}\n\n` +
          `Передайте данные сотруднику и попросите сменить пароль после первого входа.`,
      });
    } catch (err: any) {
      console.error(err);
      setDialog({
        kind: 'info',
        title: 'Ошибка',
        message: err.message || 'Ошибка при сбросе пароля',
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
      <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-[11px] text-slate-200">
        {initials || '??'}
      </div>
    );
  };

  // ---------- РЕНДЕР ----------
  return (
    <MainLayout>
      <div className="space-y-4">
        {/* HEADER */}
        <div>
          <h1 className="text-lg font-semibold text-slate-50">Сотрудники</h1>
          <div className="text-[11px] text-slate-500">
            Управление пользователями Lumiva CRM
          </div>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Форма добавления */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-3">
          <div className="text-xs text-slate-400 mb-1">Добавить сотрудника</div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              placeholder="ФИО"
              className="base-input"
            />
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="E-mail"
              className="base-input"
            />
            <input
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              placeholder="Отдел"
              className="base-input"
            />

            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as StaffRole)}
              className="base-input"
            >
              {Object.entries(ROLE_LABEL).map(([k, v]) => (
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
              {creating ? 'Создаём…' : 'Добавить'}
            </button>
          </div>
        </div>

        {/* Таблица */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
          {loading ? (
            <div className="text-xs text-slate-400">Загружаем…</div>
          ) : (
            <table className="w-full text-xs border-separate border-spacing-y-1">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-3 py-1 text-left">Сотрудник</th>
                  <th className="px-3 py-1 text-left">Email</th>
                  <th className="px-3 py-1 text-left">Отдел</th>
                  <th className="px-3 py-1 text-left">Роль</th>
                  <th className="px-3 py-1 text-left">Статус</th>
                  <th className="px-3 py-1 text-right">Действия</th>
                </tr>
              </thead>

              <tbody>
                {items.map((u) => (
                  <tr
                    key={u.id}
                    className="bg-slate-950/80 hover:bg-slate-900/80 cursor-pointer"
                    onClick={() => navigate(`/app/staff/${u.id}/profile`)}
                  >
                    {/* Сотрудник */}
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        {renderAvatar(u)}
                        <div>
                          <div className="text-[13px]">{u.fullName}</div>
                          <div className="text-[10px] text-slate-500">
                            ID: {u.id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-3 py-1.5 text-slate-300">{u.email}</td>

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
                          className="px-2 py-1 rounded bg-slate-800 text-slate-100 text-xs outline-none"
                        />
                      ) : (
                        <button
                          className="text-slate-300 hover:text-slate-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditDeptId(u.id);
                          }}
                        >
                          {u.department || '—'}
                        </button>
                      )}
                    </td>

                    {/* Роль (inline) */}
                    <td className="px-3 py-1.5 text-slate-200">
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
                          className="px-2 py-1 rounded bg-slate-800 text-slate-100 text-xs outline-none"
                        >
                          {Object.entries(ROLE_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          className="text-slate-300 hover:text-slate-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditRoleId(u.id);
                          }}
                        >
                          {ROLE_LABEL[u.role]}
                        </button>
                      )}
                    </td>

                    {/* Статус */}
                    <td className="px-3 py-1.5">
                      {u.isActive ? (
                        <span className="badge-active">Активен</span>
                      ) : (
                        <span className="badge-disabled">Отключён</span>
                      )}
                    </td>

                    {/* Действия */}
                    <td className="px-3 py-1.5 text-right space-x-3">
                      <button
                        className="text-[11px] text-emerald-400 hover:text-emerald-300"
                        onClick={(e) => handleResetPassword(u, e)}
                      >
                        Сбросить пароль
                      </button>

                      {u.isActive ? (
                        <button
                          className="text-[11px] text-rose-400 hover:text-rose-300"
                          onClick={(e) => handleDeactivate(u.id, e)}
                        >
                          Отключить
                        </button>
                      ) : (
                        <button
                          className="text-[11px] text-amber-300 hover:text-amber-200"
                          onClick={(e) => handleActivate(u.id, e)}
                        >
                          Включить
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
                      Сотрудников пока нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* POPUP-ДИАЛОГ */}
        {dialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-xl p-4">
              <div className="text-sm font-semibold text-slate-50 mb-1">
                {dialog.title}
              </div>
              <div className="text-xs text-slate-300 whitespace-pre-line mb-4">
                {dialog.message}
              </div>

              <div className="flex justify-end gap-2 text-xs">
                {dialog.kind === 'confirm' && (
                  <button
                    className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800"
                    onClick={() => setDialog(null)}
                  >
                    Отмена
                  </button>
                )}

                <button
                  className="px-3 py-1.5 rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft"
                  onClick={() => {
                    if (dialog.kind === 'confirm' && dialog.onConfirm) {
                      dialog.onConfirm();
                    }
                    setDialog(null);
                  }}
                >
                  ОК
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};