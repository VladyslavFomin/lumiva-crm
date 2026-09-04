// src/pages/staff/StaffPermissionsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { AccessDeniedPage } from '../AccessDeniedPage';
import { getStoredUser } from '../../auth/session';
import type { StaffRole, StaffUser } from '../../api/staff';
import { fetchStaff, updateStaffRole } from '../../api/staff';
import {
  fetchStaffPermissions,
  saveStaffPermissions,
  fetchUserPermissions,
  saveUserPermissions,
  type PermissionKey,
  type RolePermissionMatrix,
  type UserPermissionMatrix,
} from '../../api/rbac';
import { fetchAuditLog, type AuditLogEntry } from '../../api/auditLog';
import {
  fetchDataVisibilityRules,
  saveDataVisibilityRules,
  fetchIpAllowlist,
  addIpAllowlistEntry,
  removeIpAllowlistEntry,
  simulateDataVisibility,
  type DataVisibilityMatrix,
  type DataVisibilityRuleKey,
  type IpAllowlistEntry,
  type DataVisibilitySimulation,
} from '../../api/dataVisibility';
import { Ic, PMIC, MODULE_ICON } from './PermissionsIcons';
import './permissions-design.css';

const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(' ');

type MatrixState = Record<StaffRole, Set<PermissionKey>>;
type UserOverrideState = Partial<Record<PermissionKey, boolean>>;
type UserMatrixState = Record<string, UserOverrideState>;
type UserPermState = 'inherit' | 'allow' | 'deny';
type Filter = 'all' | 'granted' | 'changed';

function resolveUserState(overrides: UserOverrideState, key: PermissionKey): UserPermState {
  const v = overrides[key];
  return v === undefined ? 'inherit' : v ? 'allow' : 'deny';
}

function effectiveGranted(roleGranted: Set<PermissionKey>, overrides: UserOverrideState, key: PermissionKey): boolean {
  const state = resolveUserState(overrides, key);
  if (state === 'allow') return true;
  if (state === 'deny') return false;
  return roleGranted.has(key);
}

function symmetricDiffCountRecord(a: UserOverrideState, b: UserOverrideState): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<PermissionKey>;
  let n = 0;
  keys.forEach((k) => {
    if (a[k] !== b[k]) n += 1;
  });
  return n;
}

const ROLES: StaffRole[] = ['owner', 'manager', 'viewer', 'finance', 'sales', 'developer', 'support'];
const ROLES_UI = ROLES.filter((r) => r !== 'owner');
// Владелец всегда "privileged" на бэкенде (DataVisibilityService.PRIVILEGED_ROLES) — правила
// видимости данных к нему не применяются, поэтому ему нечего настраивать на этой вкладке.
// 'manager' раньше тоже был в этом списке исключений и убран (2026-09-01) — правила теперь
// реально работают и для роли "Менеджер", как для любой другой не-владельческой роли.
const DV_ROLES = ROLES_UI;
const DV_RULE_KEYS: DataVisibilityRuleKey[] = ['foreign_records', 'amounts_visibility', 'contact_masking', 'ip_mode'];
const DV_RULE_OPTIONS: Record<DataVisibilityRuleKey, string[]> = {
  foreign_records: ['hide', 'masked', 'full'],
  amounts_visibility: ['all', 'owner_manager', 'hidden'],
  contact_masking: ['show', 'mask_until_assigned', 'always_mask'],
  ip_mode: ['off', 'warn', 'block'],
};

type ModuleDef = { key: PermissionKey; children?: PermissionKey[] };
type GroupDef = { id: string; mods: ModuleDef[] };

// Модули сгруппированы так же, как реальные PermissionKey в backend/src/rbac/permission.types.ts —
// у каждого модуля есть "базовое" право (полный доступ к разделу) и, у части модулей,
// дополнительные granular-права (children), которые реально проверяются в RbacGuard отдельно.
const GROUPS: GroupDef[] = [
  {
    id: 'crm',
    mods: [
      { key: 'leads', children: ['leads_view_roi', 'leads_edit_amount', 'leads_create', 'leads_manage_import'] },
      { key: 'sales', children: ['sales_manage_import'] },
      { key: 'client_accounts' },
      { key: 'contacts', children: ['contacts_manage_bulk'] },
      { key: 'notes' },
      { key: 'companies', children: ['companies_manage_tasks'] },
      { key: 'products', children: ['products_manage_fields', 'products_manage_stock', 'products_publish'] },
      { key: 'bookings', children: ['bookings_manage_settings'] },
      { key: 'hotels', children: ['hotels_manage_pricing', 'hotels_manage_reservations'] },
      { key: 'projects', children: ['projects_manage', 'projects_manage_trash', 'projects_edit_amount', 'projects_edit_owner'] },
      { key: 'analytics' },
      { key: 'finance' },
    ],
  },
  {
    id: 'communication',
    mods: [
      { key: 'chat' },
      { key: 'helpdesk' },
      { key: 'esign' },
      { key: 'email' },
      { key: 'marketing' },
      { key: 'telegram' },
      { key: 'whatsapp' },
      { key: 'telephony' },
    ],
  },
  { id: 'tools', mods: [{ key: 'tools_automation' }, { key: 'custom_objects' }] },
  { id: 'admin', mods: [{ key: 'staff' }, { key: 'settings' }] },
];

const TOTAL_MODULES = GROUPS.reduce((n, g) => n + g.mods.length, 0);

function createEmptyMatrix(): MatrixState {
  const obj = {} as MatrixState;
  ROLES.forEach((r) => {
    obj[r] = new Set<PermissionKey>();
  });
  return obj;
}

function cloneMatrix(m: MatrixState): MatrixState {
  const out = {} as MatrixState;
  (Object.keys(m) as StaffRole[]).forEach((r) => {
    out[r] = new Set(m[r]);
  });
  return out;
}

function symmetricDiffCount(a: Set<PermissionKey>, b: Set<PermissionKey>): number {
  let n = 0;
  a.forEach((k) => {
    if (!b.has(k)) n += 1;
  });
  b.forEach((k) => {
    if (!a.has(k)) n += 1;
  });
  return n;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Общий рендер списка модулей — используется и для матрицы ролей, и для индивидуальных прав. */
const PermissionModuleList: React.FC<{
  granted: Set<PermissionKey>;
  baseline: Set<PermissionKey>;
  onToggle: (key: PermissionKey) => void;
  search: string;
  filter: Filter;
  expanded: Record<string, boolean>;
  onToggleExpand: (key: string) => void;
}> = ({ granted, baseline, onToggle, search, filter, expanded, onToggleExpand }) => {
  const { t } = useTranslation();
  const q = search.trim().toLowerCase();

  const isModGranted = (m: ModuleDef) => granted.has(m.key) || (m.children ?? []).some((c) => granted.has(c));
  const isModChanged = (m: ModuleDef) =>
    granted.has(m.key) !== baseline.has(m.key) || (m.children ?? []).some((c) => granted.has(c) !== baseline.has(c));

  const groups = GROUPS.map((g) => ({
    ...g,
    mods: g.mods.filter((m) => {
      if (q) {
        const label = t(`crm.staff.permissions.${m.key}`);
        const desc = t(`crm.staff.permissions.desc.${m.key}`, { defaultValue: '' });
        if (!(label + ' ' + desc).toLowerCase().includes(q)) return false;
      }
      if (filter === 'granted' && !isModGranted(m)) return false;
      if (filter === 'changed' && !isModChanged(m)) return false;
      return true;
    }),
  })).filter((g) => g.mods.length);

  if (!groups.length) {
    return (
      <div className="px-4 py-9 text-center text-[12.5px]" style={{ color: 'var(--fg-3)' }}>
        {t('crm.staff.permissions.noResults', { q: search })}
      </div>
    );
  }

  return (
    <>
      {groups.map((g) => {
        const grantedCount = g.mods.filter((m) => granted.has(m.key)).length;
        return (
          <div key={g.id} className="pm-group">
            <div className="pm-group-head">
              <span className="pm-group-t">{t(`crm.staff.permissions.group.${g.id}`)}</span>
              <span className="pm-group-sum">
                {grantedCount} / {g.mods.length}
              </span>
            </div>
            {g.mods.map((m) => {
              const isOn = granted.has(m.key);
              const changed = isModChanged(m);
              const hasChildren = !!m.children?.length;
              const isOpen = hasChildren && !!expanded[m.key];
              const childOn = (m.children ?? []).filter((c) => granted.has(c)).length;
              const desc = t(`crm.staff.permissions.desc.${m.key}`, { defaultValue: '' });
              return (
                <div key={m.key} className={cx('pm-mod', isOpen && 'open')}>
                  <div
                    className={cx('pm-mod-row', !hasChildren && 'leaf')}
                    onClick={hasChildren ? () => onToggleExpand(m.key) : undefined}
                  >
                    <div className="pm-mod-l">
                      <div className="pm-mod-ic">
                        <Ic d={PMIC[MODULE_ICON[m.key] || 'shield']} size={14} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="pm-mod-n">
                          {t(`crm.staff.permissions.${m.key}`)}
                          {changed && <span className="pm-changed" title="changed" />}
                        </div>
                        {desc && <div className="pm-mod-d">{desc}</div>}
                        {hasChildren && (
                          <div className="pm-mod-d">
                            {childOn} / {m.children!.length}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="pm-level" onClick={(e) => e.stopPropagation()}>
                      <button className={cx(!isOn && 'on none')} onClick={() => onToggle(m.key)}>
                        {t('crm.staff.permissions.off')}
                      </button>
                      <button className={cx(isOn && 'on')} onClick={() => onToggle(m.key)}>
                        {t('crm.staff.permissions.on')}
                      </button>
                    </div>
                    {hasChildren ? (
                      <button
                        type="button"
                        className="pm-mod-chev"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleExpand(m.key);
                        }}
                      >
                        <Ic d={isOpen ? PMIC.chev : PMIC.chevR} size={13} />
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                  {isOpen && (
                    <div className="pm-actions">
                      <div className="pm-act-grid">
                        {m.children!.map((childKey) => {
                          const on = granted.has(childKey);
                          return (
                            <div key={childKey} className={cx('pm-act', on && 'on')} onClick={() => onToggle(childKey)}>
                              <div className="pm-box">
                                <Ic d={PMIC.check} size={11} sw={2.4} />
                              </div>
                              <div>
                                <div className="t">{t(`crm.staff.permissions.${childKey}`)}</div>
                                <span className="k">{t(`crm.staff.permissions.hint.${childKey}`, { defaultValue: '' })}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
};

/**
 * Индивидуальные права одного сотрудника — три состояния на каждый модуль (наследовать роль /
 * разрешить / запретить), а не бинарный чекбокс: «запретить» реально перекрывает то, что роль бы
 * разрешила, и наоборот — см. RbacGuard.canForUser на бэкенде.
 */
const UserPermissionModuleList: React.FC<{
  overrides: UserOverrideState;
  baselineOverrides: UserOverrideState;
  roleGranted: Set<PermissionKey>;
  onSetState: (key: PermissionKey, state: UserPermState) => void;
  search: string;
  filter: Filter;
  expanded: Record<string, boolean>;
  onToggleExpand: (key: string) => void;
}> = ({ overrides, baselineOverrides, roleGranted, onSetState, search, filter, expanded, onToggleExpand }) => {
  const { t } = useTranslation();
  const q = search.trim().toLowerCase();

  const isModGrantedEff = (m: ModuleDef) =>
    effectiveGranted(roleGranted, overrides, m.key) ||
    (m.children ?? []).some((c) => effectiveGranted(roleGranted, overrides, c));
  const isModChanged = (m: ModuleDef) =>
    resolveUserState(overrides, m.key) !== resolveUserState(baselineOverrides, m.key) ||
    (m.children ?? []).some((c) => resolveUserState(overrides, c) !== resolveUserState(baselineOverrides, c));

  const groups = GROUPS.map((g) => ({
    ...g,
    mods: g.mods.filter((m) => {
      if (q) {
        const label = t(`crm.staff.permissions.${m.key}`);
        const desc = t(`crm.staff.permissions.desc.${m.key}`, { defaultValue: '' });
        if (!(label + ' ' + desc).toLowerCase().includes(q)) return false;
      }
      if (filter === 'granted' && !isModGrantedEff(m)) return false;
      if (filter === 'changed' && !isModChanged(m)) return false;
      return true;
    }),
  })).filter((g) => g.mods.length);

  if (!groups.length) {
    return (
      <div className="px-4 py-9 text-center text-[12.5px]" style={{ color: 'var(--fg-3)' }}>
        {t('crm.staff.permissions.noResults', { q: search })}
      </div>
    );
  }

  const StateButtons: React.FC<{ permKey: PermissionKey }> = ({ permKey }) => {
    const state = resolveUserState(overrides, permKey);
    return (
      <div className="pm-level" onClick={(e) => e.stopPropagation()}>
        <button className={cx(state === 'deny' && 'on deny')} onClick={() => onSetState(permKey, 'deny')}>
          {t('crm.staff.permissions.peopleTab.stateDeny')}
        </button>
        <button className={cx(state === 'inherit' && 'on none')} onClick={() => onSetState(permKey, 'inherit')}>
          {t('crm.staff.permissions.peopleTab.stateInherit')}
        </button>
        <button className={cx(state === 'allow' && 'on')} onClick={() => onSetState(permKey, 'allow')}>
          {t('crm.staff.permissions.peopleTab.stateAllow')}
        </button>
      </div>
    );
  };

  return (
    <>
      {groups.map((g) => {
        const grantedCount = g.mods.filter((m) => effectiveGranted(roleGranted, overrides, m.key)).length;
        return (
          <div key={g.id} className="pm-group">
            <div className="pm-group-head">
              <span className="pm-group-t">{t(`crm.staff.permissions.group.${g.id}`)}</span>
              <span className="pm-group-sum">
                {grantedCount} / {g.mods.length}
              </span>
            </div>
            {g.mods.map((m) => {
              const state = resolveUserState(overrides, m.key);
              const eff = effectiveGranted(roleGranted, overrides, m.key);
              const changed = isModChanged(m);
              const hasChildren = !!m.children?.length;
              const isOpen = hasChildren && !!expanded[m.key];
              const childOverriddenCount = (m.children ?? []).filter(
                (c) => resolveUserState(overrides, c) !== 'inherit',
              ).length;
              const desc = t(`crm.staff.permissions.desc.${m.key}`, { defaultValue: '' });
              return (
                <div key={m.key} className={cx('pm-mod', isOpen && 'open')}>
                  <div
                    className={cx('pm-mod-row-tri', !hasChildren && 'leaf')}
                    onClick={hasChildren ? () => onToggleExpand(m.key) : undefined}
                  >
                    <div className="pm-mod-l">
                      <div className="pm-mod-ic">
                        <Ic d={PMIC[MODULE_ICON[m.key] || 'shield']} size={14} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="pm-mod-n">
                          {t(`crm.staff.permissions.${m.key}`)}
                          {changed && <span className="pm-changed" title="changed" />}
                        </div>
                        {desc ? (
                          <div className="pm-mod-d">{desc}</div>
                        ) : (
                          <div className="pm-mod-d">
                            {eff
                              ? t('crm.staff.permissions.peopleTab.byRoleOn')
                              : t('crm.staff.permissions.peopleTab.byRoleOff')}
                          </div>
                        )}
                        {hasChildren && childOverriddenCount > 0 && (
                          <div className="pm-mod-d">
                            {t('crm.staff.permissions.peopleTab.exceptions', { count: childOverriddenCount })}
                          </div>
                        )}
                      </div>
                    </div>
                    <StateButtons permKey={m.key} />
                    {hasChildren ? (
                      <button
                        type="button"
                        className="pm-mod-chev"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleExpand(m.key);
                        }}
                      >
                        <Ic d={isOpen ? PMIC.chev : PMIC.chevR} size={13} />
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                  {isOpen && (
                    <div className="pm-actions">
                      <div className="pm-act-grid-tri">
                        {m.children!.map((childKey) => (
                          <div key={childKey} className="pm-act-tri">
                            <div>
                              <div className="t">{t(`crm.staff.permissions.${childKey}`)}</div>
                              <span className="k">{t(`crm.staff.permissions.hint.${childKey}`, { defaultValue: '' })}</span>
                            </div>
                            <StateButtons permKey={childKey} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
};

export const StaffPermissionsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isOwner = (getStoredUser()?.role || '') === 'owner';
  const dateLocale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';

  const [tab, setTab] = useState<'roles' | 'compare' | 'rules' | 'people'>('roles');

  const [matrix, setMatrix] = useState<MatrixState>(() => createEmptyMatrix());
  const [baseline, setBaseline] = useState<MatrixState>(() => createEmptyMatrix());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [selectedRole, setSelectedRole] = useState<StaffRole>('manager');
  const [roleSearch, setRoleSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [roleHistory, setRoleHistory] = useState<AuditLogEntry[]>([]);
  const [roleHistoryLoading, setRoleHistoryLoading] = useState(false);

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userMatrix, setUserMatrix] = useState<UserMatrixState>({});
  const [roleChangingId, setRoleChangingId] = useState<string | null>(null);

  const handleQuickRoleChange = async (userId: string, role: StaffRole) => {
    setRoleChangingId(userId);
    setError(null);
    try {
      await updateStaffRole(userId, role);
      setStaff((prev) => prev.map((s) => (s.id === userId ? { ...s, role } : s)));
    } catch (e: any) {
      setError(e.message || t('crm.staff.permissions.errors.saveUser'));
    } finally {
      setRoleChangingId(null);
    }
  };
  const [userBaseline, setUserBaseline] = useState<UserMatrixState>({});
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userExpanded, setUserExpanded] = useState<Record<string, boolean>>({});
  const [savingUserPerms, setSavingUserPerms] = useState(false);
  const [savedUser, setSavedUser] = useState(false);
  const [userHistory, setUserHistory] = useState<AuditLogEntry[]>([]);

  const [peopleSearch, setPeopleSearch] = useState('');
  const [peopleFilter, setPeopleFilter] = useState<'all' | 'exceptions'>('all');

  const [dvMatrix, setDvMatrix] = useState<DataVisibilityMatrix | null>(null);
  const [dvBaseline, setDvBaseline] = useState<DataVisibilityMatrix | null>(null);
  const [dvRole, setDvRole] = useState<StaffRole>('sales');
  const [dvLoading, setDvLoading] = useState(true);
  const [dvSaving, setDvSaving] = useState(false);
  const [dvSaved, setDvSaved] = useState(false);

  const [ipList, setIpList] = useState<IpAllowlistEntry[]>([]);
  const [ipCidr, setIpCidr] = useState('');
  const [ipLabel, setIpLabel] = useState('');
  const [ipAdding, setIpAdding] = useState(false);
  const [ipError, setIpError] = useState<string | null>(null);

  const [simUserId, setSimUserId] = useState<string | null>(null);
  const [simData, setSimData] = useState<DataVisibilitySimulation | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const roleLabels: Record<StaffRole, string> = useMemo(
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
    if (!isOwner) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fetchStaffPermissions()
      .then((data: RolePermissionMatrix) => {
        if (!alive) return;
        const next = createEmptyMatrix();
        (Object.keys(data) as StaffRole[]).forEach((role) => {
          (data[role] || []).forEach((p) => next[role]?.add(p));
        });
        setMatrix(next);
        setBaseline(cloneMatrix(next));
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e.message || t('crm.staff.permissions.errors.load'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isOwner]);

  useEffect(() => {
    if (!isOwner) return;
    let alive = true;
    setLoadingUsers(true);
    Promise.all([fetchStaff(), fetchUserPermissions()])
      .then(([staffList, userPerms]) => {
        if (!alive) return;
        const nonOwners = staffList.filter((u) => u.role !== 'owner');
        setStaff(nonOwners);
        const nextU: UserMatrixState = {};
        Object.entries(userPerms || {}).forEach(([userId, perms]) => {
          nextU[userId] = { ...(perms as UserOverrideState) };
        });
        setUserMatrix(nextU);
        setUserBaseline(Object.fromEntries(Object.entries(nextU).map(([k, v]) => [k, { ...v }])));
        if (nonOwners.length) setSelectedUser((prev) => prev ?? nonOwners[0].id);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e.message || t('crm.staff.permissions.errors.loadUsers'));
      })
      .finally(() => {
        if (alive) setLoadingUsers(false);
      });
    return () => {
      alive = false;
    };
  }, [isOwner]);

  // История изменений выбранной роли
  useEffect(() => {
    if (!isOwner || tab !== 'roles' || selectedRole === 'owner') {
      setRoleHistory([]);
      return;
    }
    let alive = true;
    setRoleHistoryLoading(true);
    fetchAuditLog({ entityType: 'rbac_role', entityId: selectedRole, limit: 5 })
      .then((res) => {
        if (alive) setRoleHistory(res.items);
      })
      .catch(() => {
        if (alive) setRoleHistory([]);
      })
      .finally(() => {
        if (alive) setRoleHistoryLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isOwner, tab, selectedRole]);

  // История изменений индивидуальных прав выбранного сотрудника
  useEffect(() => {
    if (!isOwner || tab !== 'people' || !selectedUser) {
      setUserHistory([]);
      return;
    }
    let alive = true;
    fetchAuditLog({ entityType: 'rbac_user', entityId: selectedUser, limit: 5 })
      .then((res) => {
        if (alive) setUserHistory(res.items);
      })
      .catch(() => {
        if (alive) setUserHistory([]);
      });
    return () => {
      alive = false;
    };
  }, [isOwner, tab, selectedUser]);

  // Правила видимости данных + рабочие IP — грузим один раз при первом открытии вкладки
  useEffect(() => {
    if (!isOwner || tab !== 'rules' || dvMatrix) return;
    let alive = true;
    setDvLoading(true);
    Promise.all([fetchDataVisibilityRules(), fetchIpAllowlist()])
      .then(([rules, ips]) => {
        if (!alive) return;
        setDvMatrix(rules);
        setDvBaseline(rules);
        setIpList(ips);
      })
      .catch((e: any) => {
        if (alive) setError(e.message || t('crm.staff.permissions.errors.load'));
      })
      .finally(() => {
        if (alive) setDvLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isOwner, tab, dvMatrix]);

  // Дефолт для "Проверка на сотруднике" — первый загруженный сотрудник
  useEffect(() => {
    if (staff.length && !simUserId) setSimUserId(staff[0].id);
  }, [staff, simUserId]);

  useEffect(() => {
    if (!isOwner || tab !== 'rules' || !simUserId) return;
    let alive = true;
    setSimLoading(true);
    simulateDataVisibility(simUserId)
      .then((res) => {
        if (alive) setSimData(res);
      })
      .catch(() => {
        if (alive) setSimData(null);
      })
      .finally(() => {
        if (alive) setSimLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isOwner, tab, simUserId]);

  const staffCountByRole = useMemo(() => {
    const m: Partial<Record<StaffRole, number>> = {};
    staff.forEach((u) => {
      m[u.role] = (m[u.role] ?? 0) + 1;
    });
    return m;
  }, [staff]);

  const roleChangedCount = (role: StaffRole) => symmetricDiffCount(matrix[role] ?? new Set(), baseline[role] ?? new Set());

  const toggleCell = (role: StaffRole, perm: PermissionKey) => {
    setMatrix((prev) => {
      const copy = { ...prev };
      const set = new Set(copy[role] ?? []);
      if (set.has(perm)) set.delete(perm);
      else set.add(perm);
      copy[role] = set;
      return copy;
    });
    setSaved(false);
  };

  const resetRole = (role: StaffRole) => {
    setMatrix((prev) => ({ ...prev, [role]: new Set(baseline[role] ?? []) }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload = {} as RolePermissionMatrix;
      ROLES.forEach((role) => {
        payload[role] = Array.from(matrix[role] ?? []);
      });
      await saveStaffPermissions(payload);
      setBaseline(cloneMatrix(matrix));
      setSaved(true);
      if (tab === 'roles') {
        fetchAuditLog({ entityType: 'rbac_role', entityId: selectedRole, limit: 5 })
          .then((res) => setRoleHistory(res.items))
          .catch(() => {});
      }
    } catch (e: any) {
      setError(e.message || t('crm.staff.permissions.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const setUserPermState = (userId: string, perm: PermissionKey, state: UserPermState) => {
    setUserMatrix((prev) => {
      const copy = { ...prev };
      const entry: UserOverrideState = { ...(copy[userId] ?? {}) };
      if (state === 'inherit') delete entry[perm];
      else entry[perm] = state === 'allow';
      copy[userId] = entry;
      return copy;
    });
    setSavedUser(false);
  };

  const resetUser = (userId: string) => {
    setUserMatrix((prev) => ({ ...prev, [userId]: { ...(userBaseline[userId] ?? {}) } }));
  };

  const handleSaveUserPerms = async () => {
    setSavingUserPerms(true);
    setError(null);
    setSavedUser(false);
    try {
      const payload: UserPermissionMatrix = {};
      Object.entries(userMatrix).forEach(([userId, perms]) => {
        payload[userId] = { ...perms };
      });
      await saveUserPermissions(payload);
      setUserBaseline(Object.fromEntries(Object.entries(userMatrix).map(([k, v]) => [k, { ...v }])));
      setSavedUser(true);
      if (selectedUser) {
        fetchAuditLog({ entityType: 'rbac_user', entityId: selectedUser, limit: 5 })
          .then((res) => setUserHistory(res.items))
          .catch(() => {});
      }
    } catch (e: any) {
      setError(e.message || t('crm.staff.permissions.errors.saveUser'));
    } finally {
      setSavingUserPerms(false);
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(dateLocale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const setDvRuleValue = (role: StaffRole, ruleKey: DataVisibilityRuleKey, value: string) => {
    setDvMatrix((prev) => {
      if (!prev) return prev;
      return { ...prev, [role]: { ...prev[role], [ruleKey]: value } };
    });
    setDvSaved(false);
  };

  const dvChangedCount = useMemo(() => {
    if (!dvMatrix || !dvBaseline) return 0;
    let n = 0;
    for (const role of DV_ROLES) {
      for (const key of DV_RULE_KEYS) {
        if (dvMatrix[role]?.[key] !== dvBaseline[role]?.[key]) n += 1;
      }
    }
    return n;
  }, [dvMatrix, dvBaseline]);

  const handleSaveDvRules = async () => {
    if (!dvMatrix) return;
    setDvSaving(true);
    setError(null);
    setDvSaved(false);
    try {
      const saved = await saveDataVisibilityRules(dvMatrix);
      setDvMatrix(saved);
      setDvBaseline(saved);
      setDvSaved(true);
      fetchAuditLog({ entityType: 'rbac_role', entityId: dvRole, limit: 5 })
        .then((res) => setRoleHistory(res.items))
        .catch(() => {});
    } catch (e: any) {
      setError(e.message || t('crm.staff.permissions.errors.save'));
    } finally {
      setDvSaving(false);
    }
  };

  const handleResetDvRules = () => {
    if (dvBaseline) setDvMatrix(dvBaseline);
  };

  const handleAddIp = async () => {
    const cidr = ipCidr.trim();
    if (!cidr || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/.test(cidr)) {
      setIpError(t('crm.staff.permissions.rulesTab.ipList.invalidCidr'));
      return;
    }
    setIpError(null);
    setIpAdding(true);
    try {
      const entry = await addIpAllowlistEntry(cidr, ipLabel.trim() || undefined);
      setIpList((prev) => [entry, ...prev]);
      setIpCidr('');
      setIpLabel('');
    } catch (e: any) {
      setIpError(e.message || t('crm.staff.permissions.errors.save'));
    } finally {
      setIpAdding(false);
    }
  };

  const handleRemoveIp = async (id: string) => {
    setIpList((prev) => prev.filter((e) => e.id !== id));
    try {
      await removeIpAllowlistEntry(id);
    } catch (e: any) {
      setError(e.message || t('crm.staff.permissions.errors.save'));
    }
  };

  if (!isOwner) {
    return <AccessDeniedPage />;
  }

  const employeesForRole = staff.filter((u) => u.role === selectedRole);
  const selectedRoleChanged = roleChangedCount(selectedRole);
  const selectedRoleGrantedCount = GROUPS.reduce(
    (n, g) => n + g.mods.filter((m) => matrix[selectedRole]?.has(m.key)).length,
    0,
  );

  const selectedEmployee = staff.find((u) => u.id === selectedUser) || null;
  const exceptionCount = (userId: string) => Object.keys(userMatrix[userId] ?? {}).length;
  const selectedUserExceptions = selectedUser ? exceptionCount(selectedUser) : 0;

  const peopleFiltered = staff.filter((u) => {
    const q = peopleSearch.trim().toLowerCase();
    if (q && !(u.fullName + ' ' + u.email).toLowerCase().includes(q)) return false;
    if (peopleFilter === 'exceptions' && exceptionCount(u.id) === 0) return false;
    return true;
  });
  const peopleWithExceptions = staff.filter((u) => exceptionCount(u.id) > 0).length;

  return (
    <MainLayout>
      <div className="px-scope">
        <div className="pm-hero">
          <div>
            <div className="kicker">
              <span className="dot" />
              {t('crm.staff.permissions.group.admin')}
            </div>
            <h1>{t('crm.staff.permissions.title')}</h1>
            <p className="sub">{t('crm.staff.permissions.subtitle')}</p>
          </div>
        </div>

        {error && (
          <div className="pm-alert err" style={{ marginBottom: 14 }}>
            {error}
          </div>
        )}
        {(saved || savedUser) && !error && (
          <div className="pm-alert ok" style={{ marginBottom: 14 }}>
            {saved ? t('crm.staff.permissions.saved') : t('crm.staff.permissions.user.saved')}
          </div>
        )}

        <div className="pm-tabs">
          <div className={cx('pm-tab', tab === 'roles' && 'active')} onClick={() => setTab('roles')}>
            {t('crm.staff.permissions.tabs.roles')}
          </div>
          <div className={cx('pm-tab', tab === 'compare' && 'active')} onClick={() => setTab('compare')}>
            {t('crm.staff.permissions.tabs.compare')}
          </div>
          <div className={cx('pm-tab', tab === 'rules' && 'active')} onClick={() => setTab('rules')}>
            {t('crm.staff.permissions.rulesTab.title')}
          </div>
          <div className={cx('pm-tab', tab === 'people' && 'active')} onClick={() => setTab('people')}>
            {t('crm.staff.permissions.tabs.people')}
            <span className="n">{staff.length}</span>
          </div>
        </div>

        {loading ? (
          <div className="text-xs" style={{ color: 'var(--fg-3)' }}>
            {t('crm.staff.permissions.loading')}
          </div>
        ) : tab === 'roles' ? (
          <div className="pm-layout">
            {/* Role rail */}
            <div className="pm-card">
              <div className="pm-card-head">
                <div>
                  <h3>
                    <Ic d={PMIC.key} size={15} />
                    {t('crm.staff.permissions.rolesRail.title')}
                  </h3>
                </div>
              </div>
              <div className="pm-card-body tight">
                {ROLES.map((role) => (
                  <button key={role} type="button" className={cx('pm-role', role === selectedRole && 'sel')} onClick={() => setSelectedRole(role)}>
                    <div className="pm-role-ic">
                      <Ic d={role === 'owner' ? PMIC.crown : PMIC.shield} size={14} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="pm-role-n">
                        {roleLabels[role]}
                        {role === 'owner' && <Ic d={PMIC.lock} size={11} className="pm-lock" />}
                        {roleChangedCount(role) > 0 && <span className="pm-changed" />}
                      </div>
                      <div className="pm-role-m">
                        {role === 'owner'
                          ? t('crm.staff.permissions.ownerLocked')
                          : t('crm.staff.permissions.rolesRail.employees', { count: staffCountByRole[role] ?? 0 })}
                      </div>
                    </div>
                    <Ic d={PMIC.chevR} size={13} />
                  </button>
                ))}
              </div>
            </div>

            {/* Role editor */}
            {selectedRole === 'owner' ? (
              <div className="pm-card">
                <div className="pm-rolehead">
                  <div className="big">
                    <Ic d={PMIC.crown} size={19} />
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <h2>{roleLabels.owner}</h2>
                    <div className="d">{t('crm.staff.permissions.ownerDesc')}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="pm-card">
                <div className="pm-rolehead">
                  <div className="big">
                    <Ic d={PMIC.shield} size={19} />
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <h2>{roleLabels[selectedRole]}</h2>
                    <div className="d">{t(`crm.staff.roleDesc.${selectedRole}`, { defaultValue: '' })}</div>
                  </div>
                  <div className="pm-avas">
                    {employeesForRole.slice(0, 4).map((u) => (
                      <div key={u.id} className="pm-ava" title={u.fullName}>
                        {initials(u.fullName || u.email)}
                      </div>
                    ))}
                    {employeesForRole.length > 4 && <div className="pm-ava more">+{employeesForRole.length - 4}</div>}
                  </div>
                </div>

                <div className="pm-toolbar">
                  <div className="pm-search">
                    <Ic d={PMIC.search} size={13} />
                    <input
                      placeholder={t('crm.staff.permissions.search.placeholder') || ''}
                      value={roleSearch}
                      onChange={(e) => setRoleSearch(e.target.value)}
                    />
                  </div>
                  <div className="pm-seg">
                    <button className={cx(roleFilter === 'all' && 'on')} onClick={() => setRoleFilter('all')}>
                      {t('crm.staff.permissions.filter.all')}
                    </button>
                    <button className={cx(roleFilter === 'granted' && 'on')} onClick={() => setRoleFilter('granted')}>
                      {t('crm.staff.permissions.filter.granted')} · {selectedRoleGrantedCount}
                    </button>
                    <button className={cx(roleFilter === 'changed' && 'on')} onClick={() => setRoleFilter('changed')}>
                      {t('crm.staff.permissions.filter.changed')} · {selectedRoleChanged}
                    </button>
                  </div>
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      const anyOpen = Object.values(expanded).some(Boolean);
                      const next: Record<string, boolean> = {};
                      if (!anyOpen) {
                        GROUPS.forEach((g) => g.mods.forEach((m) => {
                          if (m.children?.length) next[m.key] = true;
                        }));
                      }
                      setExpanded(next);
                    }}
                  >
                    {Object.values(expanded).some(Boolean)
                      ? t('crm.staff.permissions.collapseAll')
                      : t('crm.staff.permissions.expandAll')}
                  </button>
                </div>

                <div className="pm-card-body tight">
                  <PermissionModuleList
                    granted={matrix[selectedRole] ?? new Set()}
                    baseline={baseline[selectedRole] ?? new Set()}
                    onToggle={(key) => toggleCell(selectedRole, key)}
                    search={roleSearch}
                    filter={roleFilter}
                    expanded={expanded}
                    onToggleExpand={(key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))}
                  />
                </div>

                {selectedRoleChanged > 0 ? (
                  <div className="pm-savebar">
                    <Ic d={PMIC.shield} size={16} />
                    <div>
                      <div className="t">{t('crm.staff.permissions.changedBar.title', { count: selectedRoleChanged })}</div>
                      <div className="d">
                        {t('crm.staff.permissions.changedBar.impact', { count: staffCountByRole[selectedRole] ?? 0 })}
                      </div>
                    </div>
                    <div className="sp" />
                    <button className="btn btn-sm ghost" onClick={() => resetRole(selectedRole)}>
                      {t('crm.staff.permissions.changedBar.reset')}
                    </button>
                    <button className="btn btn-sm" disabled={saving} onClick={handleSave}>
                      <Ic d={PMIC.check} size={13} />
                      {saving ? t('crm.staff.permissions.saving') : t('crm.staff.permissions.changedBar.save')}
                    </button>
                  </div>
                ) : (
                  <div className="pm-card-foot">
                    <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                      {t('crm.staff.permissions.summary.grantedOf', { granted: selectedRoleGrantedCount, total: TOTAL_MODULES })} ·{' '}
                      {t('crm.staff.permissions.summary.noChanges')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Right rail */}
            {selectedRole !== 'owner' && (
              <div>
                <div className="pm-card" style={{ marginBottom: 16 }}>
                  <div className="pm-card-head">
                    <div>
                      <h3>
                        <Ic d={PMIC.users} size={15} />
                        {t('crm.staff.permissions.employeesInRole.title')}
                      </h3>
                    </div>
                  </div>
                  <div className="pm-card-body tight">
                    {employeesForRole.length === 0 ? (
                      <div className="pm-card-body" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                        {t('crm.staff.permissions.employeesInRole.empty')}
                      </div>
                    ) : (
                      employeesForRole.slice(0, 6).map((u) => (
                        <div
                          key={u.id}
                          className="pm-card-body"
                          style={{ padding: '9px 16px', borderBottom: '1px solid var(--line-3)', cursor: 'pointer' }}
                          onClick={() => {
                            setSelectedUser(u.id);
                            setTab('people');
                          }}
                        >
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{u.fullName || u.email}</div>
                          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 1 }}>{u.email}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pm-card">
                  <div className="pm-card-head">
                    <div>
                      <h3>
                        <Ic d={PMIC.clock} size={15} />
                        {t('crm.staff.permissions.history.title')}
                      </h3>
                    </div>
                  </div>
                  <div className="pm-card-body">
                    {roleHistoryLoading ? (
                      <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{t('crm.staff.permissions.history.loading')}</div>
                    ) : roleHistory.length === 0 ? (
                      <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{t('crm.staff.permissions.history.empty')}</div>
                    ) : (
                      roleHistory.map((l) => (
                        <div key={l.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--line-3)' }}>
                          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10.5, color: 'var(--fg-3)' }}>
                            {fmtDate(l.createdAt)} {l.actorName ? `· ${l.actorName}` : ''}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 3, lineHeight: 1.5 }}>{l.summary}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : tab === 'compare' ? (
          <div className="pm-card">
            <div className="pm-card-head">
              <div>
                <h3>
                  <Ic d={PMIC.key} size={15} />
                  {t('crm.staff.permissions.compareTab.title')}
                </h3>
                <div className="sub">{t('crm.staff.permissions.compareTab.subtitle')}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pm-cell full">{t('crm.staff.permissions.compareTab.legendFull')}</span>
                <span className="pm-cell none">{t('crm.staff.permissions.compareTab.legendNone')}</span>
              </div>
            </div>
            <div className="pm-matrix">
              <table>
                <thead>
                  <tr>
                    <th>{t('crm.staff.permissions.table.module')}</th>
                    {ROLES_UI.map((r) => (
                      <th key={r}>{roleLabels[r]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {GROUPS.map((g) => (
                    <React.Fragment key={g.id}>
                      <tr className="grp">
                        <td colSpan={ROLES_UI.length + 1}>{t(`crm.staff.permissions.group.${g.id}`)}</td>
                      </tr>
                      {g.mods.map((m) => (
                        <tr key={m.key}>
                          <td>{t(`crm.staff.permissions.${m.key}`)}</td>
                          {ROLES_UI.map((r) => {
                            const on = matrix[r]?.has(m.key);
                            const childOn = (m.children ?? []).filter((c) => matrix[r]?.has(c)).length;
                            return (
                              <td key={r}>
                                <span className={cx('pm-cell', on ? 'full' : 'none')}>
                                  {on ? t('crm.staff.permissions.compareTab.legendFull') : '—'}
                                  {on && m.children?.length ? (
                                    <span className="sub">
                                      {childOn}/{m.children.length}
                                    </span>
                                  ) : null}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pm-card-foot">
              <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                {t('crm.staff.permissions.compareTab.footnote', { roles: ROLES_UI.length, modules: TOTAL_MODULES })}
              </span>
            </div>
          </div>
        ) : tab === 'rules' ? (
          <div className="pm-layout" style={{ gridTemplateColumns: 'minmax(0,1fr) 320px' }}>
            <div>
              <div className="pm-card" style={{ marginBottom: 16 }}>
                <div className="pm-card-head">
                  <div>
                    <h3>
                      <Ic d={PMIC.eye} size={15} />
                      {t('crm.staff.permissions.rulesTab.title')}
                    </h3>
                    <div className="sub">{t('crm.staff.permissions.rulesTab.subtitle')}</div>
                  </div>
                  <select className="pm-select" value={dvRole} onChange={(e) => setDvRole(e.target.value as StaffRole)}>
                    {DV_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t('crm.staff.permissions.rulesTab.roleSelect')}: {roleLabels[r]}
                      </option>
                    ))}
                  </select>
                </div>
                {dvLoading || !dvMatrix ? (
                  <div className="pm-card-body" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                    {t('crm.staff.permissions.rulesTab.loading')}
                  </div>
                ) : (
                  <div className="pm-card-body">
                    {DV_RULE_KEYS.map((key) => (
                      <div key={key} className="pm-rule">
                        <div>
                          <div className="t">{t(`crm.staff.permissions.rulesTab.rules.${key}.title`)}</div>
                          <div className="d">{t(`crm.staff.permissions.rulesTab.rules.${key}.desc`)}</div>
                        </div>
                        <select
                          className="pm-select"
                          value={dvMatrix[dvRole]?.[key] ?? DV_RULE_OPTIONS[key][0]}
                          onChange={(e) => setDvRuleValue(dvRole, key, e.target.value)}
                        >
                          {DV_RULE_OPTIONS[key].map((opt) => (
                            <option key={opt} value={opt}>
                              {t(`crm.staff.permissions.rulesTab.rules.${key}.options.${opt}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
                {dvChangedCount > 0 ? (
                  <div className="pm-savebar">
                    <Ic d={PMIC.shield} size={16} />
                    <div className="t">{t('crm.staff.permissions.changedBar.title', { count: dvChangedCount })}</div>
                    <div className="sp" />
                    <button className="btn btn-sm ghost" onClick={handleResetDvRules}>
                      {t('crm.staff.permissions.changedBar.reset')}
                    </button>
                    <button className="btn btn-sm" disabled={dvSaving} onClick={handleSaveDvRules}>
                      <Ic d={PMIC.check} size={13} />
                      {dvSaving ? t('crm.staff.permissions.saving') : t('crm.staff.permissions.rulesTab.save')}
                    </button>
                  </div>
                ) : (
                  <div className="pm-card-foot">
                    <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{t('crm.staff.permissions.rulesTab.notApplicable')}</span>
                  </div>
                )}
              </div>

              <div className="pm-card">
                <div className="pm-card-head">
                  <div>
                    <h3>
                      <Ic d={PMIC.key} size={15} />
                      {t('crm.staff.permissions.rulesTab.ipList.title')}
                    </h3>
                  </div>
                </div>
                <div className="pm-card-body">
                  {ipList.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{t('crm.staff.permissions.rulesTab.ipList.empty')}</div>
                  ) : (
                    ipList.map((entry) => (
                      <div key={entry.id} className="pm-ip-row">
                        <span className="cidr">{entry.cidr}</span>
                        <span className="label">{entry.label || ''}</span>
                        <button type="button" className="x" onClick={() => handleRemoveIp(entry.id)} title="Удалить">
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                  {ipError && (
                    <div className="pm-alert err" style={{ marginTop: 10 }}>
                      {ipError}
                    </div>
                  )}
                  <div className="pm-ip-add">
                    <input
                      className="cidr"
                      placeholder={t('crm.staff.permissions.rulesTab.ipList.cidrPlaceholder') || ''}
                      value={ipCidr}
                      onChange={(e) => setIpCidr(e.target.value)}
                    />
                    <input
                      className="label"
                      placeholder={t('crm.staff.permissions.rulesTab.ipList.labelPlaceholder') || ''}
                      value={ipLabel}
                      onChange={(e) => setIpLabel(e.target.value)}
                    />
                    <button className="btn btn-sm" disabled={ipAdding} onClick={handleAddIp}>
                      <Ic d={PMIC.plus} size={13} />
                      {t('crm.staff.permissions.rulesTab.ipList.add')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pm-card">
              <div className="pm-card-head">
                <div>
                  <h3>
                    <Ic d={PMIC.shield} size={15} />
                    {t('crm.staff.permissions.rulesTab.simulate.title')}
                  </h3>
                  <div className="sub">{t('crm.staff.permissions.rulesTab.simulate.subtitle')}</div>
                </div>
              </div>
              <div className="pm-card-body">
                <select
                  className="pm-select"
                  style={{ width: '100%', marginBottom: 12 }}
                  value={simUserId ?? ''}
                  onChange={(e) => setSimUserId(e.target.value)}
                >
                  {staff.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName || u.email} · {roleLabels[u.role]}
                    </option>
                  ))}
                </select>
                {simLoading || !simData ? (
                  <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{t('crm.staff.permissions.rulesTab.simulate.loading')}</div>
                ) : simData.privileged ? (
                  <div className="pm-alert ok">{t('crm.staff.permissions.rulesTab.simulate.privileged')}</div>
                ) : (
                  <>
                    <div className="pm-kv">
                      <span className="k">{t('crm.staff.permissions.rulesTab.simulate.contactsVisible')}</span>
                      <span className="v mono">
                        {t('crm.staff.permissions.rulesTab.simulate.of', {
                          visible: simData.contacts.visible,
                          total: simData.contacts.total,
                        })}
                      </span>
                    </div>
                    <div className="pm-kv">
                      <span className="k">{t('crm.staff.permissions.rulesTab.simulate.companiesVisible')}</span>
                      <span className="v mono">
                        {t('crm.staff.permissions.rulesTab.simulate.of', {
                          visible: simData.companies.visible,
                          total: simData.companies.total,
                        })}
                      </span>
                    </div>
                    <div className="pm-kv">
                      <span className="k">{t('crm.staff.permissions.rulesTab.simulate.salesVisible')}</span>
                      <span className="v mono">
                        {t('crm.staff.permissions.rulesTab.simulate.of', {
                          visible: simData.sales.visible,
                          total: simData.sales.total,
                        })}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="pm-layout" style={{ gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
            <div className="pm-card">
              <div className="pm-card-head">
                <div>
                  <h3>
                    <Ic d={PMIC.users} size={15} />
                    {t('crm.staff.permissions.peopleTab.title')}
                  </h3>
                  <div className="sub">{t('crm.staff.permissions.peopleTab.subtitle')}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div className="pm-search" style={{ minWidth: 200 }}>
                    <Ic d={PMIC.search} size={13} />
                    <input
                      placeholder={t('crm.staff.permissions.peopleTab.searchPlaceholder') || ''}
                      value={peopleSearch}
                      onChange={(e) => setPeopleSearch(e.target.value)}
                    />
                  </div>
                  <div className="pm-seg">
                    <button className={cx(peopleFilter === 'all' && 'on')} onClick={() => setPeopleFilter('all')}>
                      {t('crm.staff.permissions.peopleTab.filterAll')}
                    </button>
                    <button className={cx(peopleFilter === 'exceptions' && 'on')} onClick={() => setPeopleFilter('exceptions')}>
                      {t('crm.staff.permissions.peopleTab.filterExceptions')}
                    </button>
                  </div>
                </div>
              </div>
              {loadingUsers ? (
                <div className="pm-card-body" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                  {t('crm.staff.permissions.user.loading')}
                </div>
              ) : (
                <div className="pm-card-body tight">
                  {peopleFiltered.length === 0 ? (
                    <div className="pm-card-body" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                      {t('crm.staff.permissions.peopleTab.empty')}
                    </div>
                  ) : (
                    peopleFiltered.map((u) => {
                      const exceptions = exceptionCount(u.id);
                      return (
                        <div
                          key={u.id}
                          className={cx('pm-emp', u.id === selectedUser && 'sel')}
                          onClick={() => setSelectedUser(u.id)}
                        >
                          <div>
                            <div className="nm">{u.fullName || u.email}</div>
                            <div className="em">{u.email}</div>
                          </div>
                          <div className="cell" onClick={(e) => e.stopPropagation()}>
                            <select
                              className="pm-select"
                              value={u.role}
                              disabled={roleChangingId === u.id}
                              onChange={(e) => handleQuickRoleChange(u.id, e.target.value as StaffRole)}
                            >
                              {ROLES.filter((r) => r !== 'owner').map((r) => (
                                <option key={r} value={r}>
                                  {roleLabels[r]}
                                </option>
                              ))}
                            </select>
                            {u.department || ''}
                          </div>
                          <div className="cell">
                            {exceptions > 0 ? (
                              <span className="bk-badge pending">
                                {t('crm.staff.permissions.peopleTab.exceptions', { count: exceptions })}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--fg-3)', fontSize: 11.5 }}>{t('crm.staff.permissions.peopleTab.byRole')}</span>
                            )}
                          </div>
                          <div className="cell" style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
                            {u.lastLoginAt ? fmtDate(u.lastLoginAt) : t('crm.staff.permissions.peopleTab.never')}
                          </div>
                          <Ic d={PMIC.chevR} size={14} />
                        </div>
                      );
                    })
                  )}
                </div>
              )}
              <div className="pm-card-foot">
                <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                  {t('crm.staff.permissions.peopleTab.footnote', { total: staff.length, withExceptions: peopleWithExceptions })}
                </span>
              </div>
            </div>

            <div>
              {selectedEmployee ? (
                <div className="pm-card">
                  <div className="pm-card-head">
                    <div>
                      <h3>{t('crm.staff.permissions.peopleTab.detailTitle', { name: selectedEmployee.fullName || selectedEmployee.email })}</h3>
                      <div className="sub">
                        {t('crm.staff.permissions.peopleTab.detailHint', { role: roleLabels[selectedEmployee.role] })}
                      </div>
                    </div>
                  </div>
                  <div className="pm-toolbar">
                    <div className="pm-search">
                      <Ic d={PMIC.search} size={13} />
                      <input
                        placeholder={t('crm.staff.permissions.search.placeholder') || ''}
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="pm-card-body tight" style={{ maxHeight: 480, overflowY: 'auto' }}>
                    <UserPermissionModuleList
                      overrides={userMatrix[selectedEmployee.id] ?? {}}
                      baselineOverrides={userBaseline[selectedEmployee.id] ?? {}}
                      roleGranted={baseline[selectedEmployee.role] ?? new Set()}
                      onSetState={(key, state) => setUserPermState(selectedEmployee.id, key, state)}
                      search={userSearch}
                      filter="all"
                      expanded={userExpanded}
                      onToggleExpand={(key) => setUserExpanded((prev) => ({ ...prev, [key]: !prev[key] }))}
                    />
                  </div>
                  {symmetricDiffCountRecord(userMatrix[selectedEmployee.id] ?? {}, userBaseline[selectedEmployee.id] ?? {}) > 0 ? (
                    <div className="pm-savebar">
                      <Ic d={PMIC.key} size={16} />
                      <div className="t">
                        {t('crm.staff.permissions.changedBar.title', {
                          count: symmetricDiffCountRecord(userMatrix[selectedEmployee.id] ?? {}, userBaseline[selectedEmployee.id] ?? {}),
                        })}
                      </div>
                      <div className="sp" />
                      <button className="btn btn-sm ghost" onClick={() => resetUser(selectedEmployee.id)}>
                        {t('crm.staff.permissions.changedBar.reset')}
                      </button>
                      <button className="btn btn-sm" disabled={savingUserPerms} onClick={handleSaveUserPerms}>
                        <Ic d={PMIC.check} size={13} />
                        {savingUserPerms ? t('crm.staff.permissions.user.saving') : t('crm.staff.permissions.user.save')}
                      </button>
                    </div>
                  ) : (
                    <div className="pm-card-foot">
                      <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                        {t('crm.staff.permissions.peopleTab.exceptions', { count: selectedUserExceptions })}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="pm-card">
                  <div className="pm-card-body" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                    {t('crm.staff.permissions.peopleTab.empty')}
                  </div>
                </div>
              )}

              {selectedEmployee && (
                <div className="pm-card" style={{ marginTop: 16 }}>
                  <div className="pm-card-head">
                    <div>
                      <h3>
                        <Ic d={PMIC.clock} size={15} />
                        {t('crm.staff.permissions.history.userTitle')}
                      </h3>
                    </div>
                  </div>
                  <div className="pm-card-body">
                    {userHistory.length === 0 ? (
                      <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{t('crm.staff.permissions.history.empty')}</div>
                    ) : (
                      userHistory.map((l) => (
                        <div key={l.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--line-3)' }}>
                          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10.5, color: 'var(--fg-3)' }}>
                            {fmtDate(l.createdAt)} {l.actorName ? `· ${l.actorName}` : ''}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 3, lineHeight: 1.5 }}>{l.summary}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
