// src/pages/staff/StaffPermissionsPage.tsx
import React, { useEffect, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import type { StaffRole } from '../../api/staff';
import {
  fetchStaffPermissions,
  saveStaffPermissions,
  type PermissionKey,
} from '../../api/rbac';

type MatrixState = Record<StaffRole, Set<PermissionKey>>;

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

const ROLE_LABEL: Record<StaffRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  viewer: 'Viewer',
  finance: 'Finance',
  sales: 'Sales',
  developer: 'Developer',
  support: 'Support',
};

const PERMISSIONS: { key: PermissionKey; label: string }[] = [
  { key: 'leads',     label: 'Лиды' },
  { key: 'projects',  label: 'Проекты' },
  { key: 'staff',     label: 'Сотрудники' },
  { key: 'finance',   label: 'Финансы' },
  { key: 'analytics', label: 'Аналитика' },
  { key: 'settings',  label: 'Настройки CRM' },
  { key: 'chat',      label: 'Онлайн-чат' },
];

function createEmptyMatrix(): MatrixState {
  const obj = {} as MatrixState;
  ROLES.forEach((r) => {
    obj[r] = new Set<PermissionKey>();
  });
  return obj;
}

export const StaffPermissionsPage: React.FC = () => {
  const [matrix, setMatrix] = useState<MatrixState>(() => createEmptyMatrix());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
        setError(e.message || 'Ошибка загрузки прав доступа');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

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
      setError(e.message || 'Не удалось сохранить права');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-50">
            Права доступа
          </h1>
          <p className="text-[11px] text-slate-500">
            Управление правами ролей CRM (RBAC)
          </p>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {saved && !error && (
          <div className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/50 rounded-xl px-3 py-2">
            Права доступа сохранены.
          </div>
        )}

        <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 overflow-x-auto">
          {loading ? (
            <div className="text-xs text-slate-400">
              Загружаем текущие права…
            </div>
          ) : (
            <table className="min-w-full text-xs border-separate border-spacing-y-1">
              <thead className="text-slate-400">
                <tr>
                  <th className="text-left px-3 py-2">Модуль</th>
                  {ROLES.map((role) => (
                    <th key={role} className="px-3 py-2 text-center">
                      {ROLE_LABEL[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((perm) => (
                  <tr
                    key={perm.key}
                    className="bg-slate-950/70 hover:bg-slate-900/80"
                  >
                    <td className="px-3 py-2 text-slate-100">
                      {perm.label}
                    </td>
                    {ROLES.map((role) => (
                      <td
                        key={role}
                        className="px-3 py-2 text-center align-middle"
                      >
                        <button
                          type="button"
                          onClick={() => toggleCell(role, perm.key)}
                          className={
                            'h-4 w-4 rounded border transition-colors ' +
                            (isChecked(role, perm.key)
                              ? 'bg-lumiva-accent border-lumiva-accent'
                              : 'border-slate-600 bg-transparent hover:border-slate-300')
                          }
                        >
                          {/* пустой button, визуально как чекбокс */}
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
              className="px-4 py-2 rounded-xl bg-lumiva-accent text-slate-950 text-xs font-semibold hover:bg-lumiva-accent-soft disabled:opacity-60"
            >
              {saving ? 'Сохраняем…' : 'Сохранить изменения'}
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};