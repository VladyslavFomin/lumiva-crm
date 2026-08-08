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
  type PermissionGroup = {
    groupLabel: string;
    items: { key: PermissionKey; label: string; hint?: string }[];
  };

  const permissionGroups = useMemo(
    (): PermissionGroup[] => [
      {
        groupLabel: t('crm.staff.permissions.group.crm'),
        items: [
          { key: 'leads', label: t('crm.staff.permissions.leads') },
          {
            key: 'leads_view_roi',
            label: t('crm.staff.permissions.leads_view_roi'),
            hint: t('crm.staff.permissions.hint.leads_view_roi'),
          },
          { key: 'sales', label: t('crm.staff.permissions.sales') },
          {
            key: 'sales_manage_import',
            label: t('crm.staff.permissions.sales_manage_import'),
            hint: t('crm.staff.permissions.hint.sales_manage_import'),
          },
          { key: 'contacts', label: t('crm.staff.permissions.contacts') },
          {
            key: 'contacts_manage_bulk',
            label: t('crm.staff.permissions.contacts_manage_bulk'),
            hint: t('crm.staff.permissions.hint.contacts_manage_bulk'),
          },
          { key: 'notes', label: t('crm.staff.permissions.notes') },
          { key: 'companies', label: t('crm.staff.permissions.companies') },
          {
            key: 'companies_manage_tasks',
            label: t('crm.staff.permissions.companies_manage_tasks'),
            hint: t('crm.staff.permissions.hint.companies_manage_tasks'),
          },
          { key: 'products', label: t('crm.staff.permissions.products') },
          {
            key: 'products_manage_fields',
            label: t('crm.staff.permissions.products_manage_fields'),
            hint: t('crm.staff.permissions.hint.products_manage_fields'),
          },
          {
            key: 'products_manage_stock',
            label: t('crm.staff.permissions.products_manage_stock'),
            hint: t('crm.staff.permissions.hint.products_manage_stock'),
          },
          {
            key: 'products_publish',
            label: t('crm.staff.permissions.products_publish'),
            hint: t('crm.staff.permissions.hint.products_publish'),
          },
          { key: 'bookings', label: t('crm.staff.permissions.bookings') },
          {
            key: 'bookings_manage_settings',
            label: t('crm.staff.permissions.bookings_manage_settings'),
            hint: t('crm.staff.permissions.hint.bookings_manage_settings'),
          },
          { key: 'hotels', label: t('crm.staff.permissions.hotels') },
          {
            key: 'hotels_manage_pricing',
            label: t('crm.staff.permissions.hotels_manage_pricing'),
            hint: t('crm.staff.permissions.hint.hotels_manage_pricing'),
          },
          {
            key: 'hotels_manage_reservations',
            label: t('crm.staff.permissions.hotels_manage_reservations'),
            hint: t('crm.staff.permissions.hint.hotels_manage_reservations'),
          },
          { key: 'projects', label: t('crm.staff.permissions.projects') },
          {
            key: 'projects_manage_trash',
            label: t('crm.staff.permissions.projects_manage_trash'),
            hint: t('crm.staff.permissions.hint.projects_manage_trash'),
          },
          { key: 'analytics', label: t('crm.staff.permissions.analytics') },
          { key: 'finance', label: t('crm.staff.permissions.finance') },
        ],
      },
      {
        groupLabel: t('crm.staff.permissions.group.communication'),
        items: [
          { key: 'chat', label: t('crm.staff.permissions.chat') },
          { key: 'helpdesk', label: t('crm.staff.permissions.helpdesk') },
          { key: 'esign', label: t('crm.staff.permissions.esign') },
          { key: 'email', label: t('crm.staff.permissions.email') },
          { key: 'marketing', label: t('crm.staff.permissions.marketing') },
          { key: 'telegram', label: t('crm.staff.permissions.telegram') },
          { key: 'whatsapp', label: t('crm.staff.permissions.whatsapp') },
          { key: 'telephony', label: t('crm.staff.permissions.telephony') },
        ],
      },
      {
        groupLabel: t('crm.staff.permissions.group.tools'),
        items: [
          { key: 'tools_automation', label: t('crm.staff.permissions.tools_automation') },
          { key: 'custom_objects', label: t('crm.staff.permissions.custom_objects') },
        ],
      },
      {
        groupLabel: t('crm.staff.permissions.group.admin'),
        items: [
          {
            key: 'staff',
            label: t('crm.staff.permissions.staff'),
            hint: t('crm.staff.permissions.hint.staff'),
          },
          {
            key: 'settings',
            label: t('crm.staff.permissions.settings'),
            hint: t('crm.staff.permissions.hint.settings'),
          },
        ],
      },
    ],
    [t],
  );

  const permissions = useMemo(
    () => permissionGroups.flatMap((g) => g.items),
    [permissionGroups],
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
          <div className="text-xs text-status-error bg-status-error-bg border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {saved && !error && (
          <div className="text-xs text-status-success bg-status-success-bg border border-green-200 rounded-xl px-3 py-2">
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
                  <th className="text-left px-3 py-2 min-w-[180px]">{t('crm.staff.permissions.table.module')}</th>
                  {ROLES_UI.map((role) => (
                    <th key={role} className="px-3 py-2 text-center whitespace-nowrap">
                      {roleLabels[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionGroups.map((group) => (
                  <React.Fragment key={group.groupLabel}>
                    <tr>
                      <td
                        colSpan={ROLES_UI.length + 1}
                        className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400"
                      >
                        {group.groupLabel}
                      </td>
                    </tr>
                    {group.items.map((perm) => (
                      <tr key={perm.key} className="bg-white hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <span className="font-medium text-lumiva-accent">{perm.label}</span>
                          {perm.hint && (
                            <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{perm.hint}</div>
                          )}
                        </td>
                        {ROLES_UI.map((role) => (
                          <td key={role} className="px-3 py-2 text-center align-middle">
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
                  </React.Fragment>
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
                    <th className="text-left px-3 py-2 min-w-[200px]">{t('crm.staff.permissions.table.module')}</th>
                    <th className="text-left px-3 py-2">{t('crm.staff.permissions.user.access')}</th>
                  </tr>
                </thead>
                <tbody>
                  {permissionGroups.map((group) => (
                    <React.Fragment key={group.groupLabel}>
                      <tr>
                        <td
                          colSpan={2}
                          className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400"
                        >
                          {group.groupLabel}
                        </td>
                      </tr>
                      {group.items.map((perm) => {
                        const on = currentUserPerms.has(perm.key);
                        return (
                          <tr key={perm.key} className="bg-white hover:bg-slate-50">
                            <td className="px-3 py-2">
                              <span className="font-medium text-lumiva-accent">{perm.label}</span>
                              {perm.hint && (
                                <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{perm.hint}</div>
                              )}
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
                    </React.Fragment>
                  ))}
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
