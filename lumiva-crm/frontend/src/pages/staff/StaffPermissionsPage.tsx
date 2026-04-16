// src/pages/staff/StaffPermissionsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import type { StaffRole, StaffUser } from '../../api/staff';
import {
  fetchStaffPermissions,
  saveStaffPermissions,
  type PermissionKey,
  fetchUserPermissions,
  saveUserPermissions,
  type UserPermissionMatrix,
} from '../../api/rbac';
import { fetchStaff } from '../../api/staff';

type MatrixState = Record<StaffRole, Set<PermissionKey>>;
type UserMatrixState = Record<string, Set<PermissionKey>>;

// Пэйлоад, который отправляем в saveStaffPermissions
type StaffRolePermissionsPayload = Record<StaffRole, PermissionKey[]>;

const ROLES: StaffRole[] = [
  'owner',
  'manager',
  'viewer',
  'finance',
  'sales',
  'developer',
  'support',
];
const ROLES_UI = ROLES.filter((r) => r !== 'owner');

function createEmptyMatrix(): MatrixState {
  const obj = {} as MatrixState;
  ROLES.forEach((r) => {
    obj[r] = new Set<PermissionKey>();
  });
  return obj;
}

function createEmptyUserMatrix(): UserMatrixState {
  return {};
}

export const StaffPermissionsPage: React.FC = () => {
  const { t } = useTranslation();
  const [matrix, setMatrix] = useState<MatrixState>(() => createEmptyMatrix());
  const [userMatrix, setUserMatrix] = useState<UserMatrixState>(() => createEmptyUserMatrix());
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [savingUserPerms, setSavingUserPerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savedUser, setSavedUser] = useState(false);
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
  const permissions = useMemo(
    (): { key: PermissionKey; label: string }[] => [
      { key: 'leads', label: t('crm.staff.permissions.leads') },
      { key: 'projects', label: t('crm.staff.permissions.projects') },
      { key: 'staff', label: t('crm.staff.permissions.staff') },
      { key: 'finance', label: t('crm.staff.permissions.finance') },
      { key: 'analytics', label: t('crm.staff.permissions.analytics') },
      { key: 'settings', label: t('crm.staff.permissions.settings') },
      { key: 'chat', label: t('crm.staff.permissions.chat') },
    ],
    [t],
  );

  // --- загрузка из API ---
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setSaved(false);

    fetchStaffPermissions()
      .then((data: Record<StaffRole, PermissionKey[]>) => {
        if (!alive) return;

        const next = createEmptyMatrix();

        (Object.keys(data) as StaffRole[]).forEach((role) => {
          const perms = data[role] || [];
          perms.forEach((p) => {
            next[role].add(p);
          });
        });

        setMatrix(next);
      })
      .catch((e: any) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.staff.permissions.errors.load'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  // загрузка сотрудников + пользовательских прав
  useEffect(() => {
    let alive = true;
    setLoadingUsers(true);
    setSavedUser(false);
    Promise.all([fetchStaff(), fetchUserPermissions()])
      .then(([staffList, userPerms]) => {
        if (!alive) return;
        const nonOwners = staffList.filter((u) => u.role !== 'owner');
        setStaff(nonOwners);
        const next: UserMatrixState = {};
        Object.entries(userPerms || {}).forEach(([userId, perms]) => {
          next[userId] = new Set(perms);
        });
        setUserMatrix(next);
        if (nonOwners.length && !selectedUser) {
          setSelectedUser(nonOwners[0].id);
        }
      })
      .catch((e: any) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.staff.permissions.errors.loadUsers'));
      })
      .finally(() => {
        if (!alive) return;
        setLoadingUsers(false);
      });

    return () => {
      alive = false;
    };
  }, [selectedUser]);

  const isChecked = (role: StaffRole, perm: PermissionKey) =>
    matrix[role]?.has(perm) ?? false;

  const toggleCell = (role: StaffRole, perm: PermissionKey) => {
    setMatrix((prev: MatrixState) => {
      const copy: MatrixState = { ...prev };
      const set = new Set(copy[role] ?? []);
      if (set.has(perm)) {
        set.delete(perm);
      } else {
        set.add(perm);
      }
      copy[role] = set;
      return copy;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const payload: StaffRolePermissionsPayload = {} as StaffRolePermissionsPayload;

      ROLES.forEach((role) => {
        payload[role] = Array.from(matrix[role] ?? []);
      });

      await saveStaffPermissions(payload);
      setSaved(true);
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.staff.permissions.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  // ---------- user-level perms ----------
  const currentUserPerms = useMemo(() => {
    if (!selectedUser) return new Set<PermissionKey>();
    return userMatrix[selectedUser] ?? new Set<PermissionKey>();
  }, [selectedUser, userMatrix]);

  const toggleUserPerm = (perm: PermissionKey) => {
    if (!selectedUser) return;
    setUserMatrix((prev) => {
      const copy: UserMatrixState = { ...prev };
      const set = new Set(copy[selectedUser] ?? []);
      if (set.has(perm)) set.delete(perm);
      else set.add(perm);
      copy[selectedUser] = set;
      return copy;
    });
    setSavedUser(false);
  };

  const handleSaveUserPerms = async () => {
    if (!selectedUser) return;
    setSavingUserPerms(true);
    setError(null);
    setSavedUser(false);
    try {
      const payload: UserPermissionMatrix = {};
      Object.entries(userMatrix).forEach(([userId, perms]) => {
        payload[userId] = Array.from(perms);
      });
      await saveUserPermissions(payload);
      setSavedUser(true);
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.staff.permissions.errors.saveUser'));
    } finally {
      setSavingUserPerms(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-lumiva-accent">
            {t('crm.staff.permissions.title')}
          </h1>
          <p className="text-[11px] text-slate-600">
            {t('crm.staff.permissions.subtitle')}
          </p>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {saved && !error && (
          <div className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/50 rounded-xl px-3 py-2">
            {t('crm.staff.permissions.saved')}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-3xl p-4 overflow-x-auto shadow-sm">
          {loading ? (
            <div className="text-xs text-slate-500">
              {t('crm.staff.permissions.loading')}
            </div>
          ) : (
            <table className="min-w-full text-xs border-separate border-spacing-y-1">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2">{t('crm.staff.permissions.table.module')}</th>
                  {ROLES_UI.map((role) => (
                    <th key={role} className="px-3 py-2 text-center">
                      {roleLabels[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                    {permissions.map((perm) => (
                      <tr
                        key={perm.key}
                        className="bg-white hover:bg-slate-50"
                      >
                    <td className="px-3 py-2 text-lumiva-accent font-medium">
                      {perm.label}
                    </td>
                    {ROLES_UI.map((role) => (
                      <td
                        key={role}
                        className="px-3 py-2 text-center align-middle"
                      >
                            <button
                              type="button"
                              onClick={() => toggleCell(role, perm.key)}
                              className={
                                'relative inline-flex h-5 w-9 items-center rounded-full transition ' +
                                (isChecked(role, perm.key)
                                  ? 'bg-emerald-500'
                                  : 'bg-slate-300 hover:bg-slate-400')
                              }
                            >
                              <span
                                className={
                                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition ' +
                                  (isChecked(role, perm.key) ? 'translate-x-4' : 'translate-x-1')
                                }
                              />
                            </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="mt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="px-4 py-2 rounded-xl bg-lumiva-accent text-white text-xs font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
            >
              {saving ? t('crm.staff.permissions.saving') : t('crm.staff.permissions.save')}
            </button>
          </div>
        </div>

        {/* Индивидуальные права */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-lumiva-accent">
              {t('crm.staff.permissions.user.title')}
            </h2>
            <p className="text-[11px] text-slate-600">
              {t('crm.staff.permissions.user.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500">{t('crm.staff.permissions.user.employee')}</span>
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-sky-400"
              value={selectedUser ?? ''}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName || u.email} · {roleLabels[u.role]}
                </option>
              ))}
            </select>
          </div>

          {loadingUsers ? (
            <div className="text-xs text-slate-500">
              {t('crm.staff.permissions.user.loading')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border-separate border-spacing-y-1">
                <thead className="text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2">{t('crm.staff.permissions.table.module')}</th>
                    <th className="text-left px-3 py-2">{t('crm.staff.permissions.user.access')}</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((perm) => {
                    const on = currentUserPerms.has(perm.key);
                    return (
                      <tr key={perm.key} className="bg-white hover:bg-slate-50">
                        <td className="px-3 py-2 text-lumiva-accent font-medium">
                          {perm.label}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleUserPerm(perm.key)}
                            className={
                              'relative inline-flex h-5 w-9 items-center rounded-full transition ' +
                              (on ? 'bg-emerald-500' : 'bg-slate-300 hover:bg-slate-400')
                            }
                          >
                            <span
                              className={
                                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition ' +
                                (on ? 'translate-x-4' : 'translate-x-1')
                              }
                            />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-2">
            <button
              type="button"
              onClick={handleSaveUserPerms}
              disabled={savingUserPerms || loadingUsers || !selectedUser}
              className="px-4 py-2 rounded-xl bg-lumiva-accent text-white text-xs font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
            >
              {savingUserPerms
                ? t('crm.staff.permissions.user.saving')
                : t('crm.staff.permissions.user.save')}
            </button>
            {savedUser && !error && (
              <span className="ml-3 text-[11px] text-emerald-600">
                {t('crm.staff.permissions.user.saved')}
              </span>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
