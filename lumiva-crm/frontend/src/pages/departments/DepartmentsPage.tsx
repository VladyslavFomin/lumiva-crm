// src/pages/departments/DepartmentsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { getStoredUser } from '../../auth/session';
import {
  fetchDepartmentsTree,
  fetchDepartments,
  fetchDepartmentsSummary,
  fetchDepartmentStats,
  updateDepartment,
  deleteDepartment,
  type Department,
  type DepartmentsSummary,
  type DepartmentStats,
} from '../../api/departments';
import { fetchStaff, updateStaffUser, type StaffUser, type StaffRole } from '../../api/staff';
import { Ic, DIC } from './DepartmentsIcons';
import './departments-design.css';

const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(' ');

type DeptNode = Omit<Department, 'children'> & {
  children: DeptNode[];
  directStaff: StaffUser[];
  totalStaffCount: number;
  level: number;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function annotate(nodes: Department[], staffByDept: Map<string, StaffUser[]>, level: number): DeptNode[] {
  return nodes.map((n) => {
    const children = annotate(n.children ?? [], staffByDept, level + 1);
    const directStaff = staffByDept.get(n.id) ?? [];
    const totalStaffCount = directStaff.length + children.reduce((s, c) => s + c.totalStaffCount, 0);
    return { ...n, children, directStaff, totalStaffCount, level };
  });
}

function flattenTree(nodes: DeptNode[], out: DeptNode[] = []): DeptNode[] {
  nodes.forEach((n) => {
    out.push(n);
    flattenTree(n.children, out);
  });
  return out;
}

function collectIds(nodes: DeptNode[], out: string[] = []): string[] {
  nodes.forEach((n) => {
    if (n.children.length) {
      out.push(n.id);
      collectIds(n.children, out);
    }
  });
  return out;
}

const Avas: React.FC<{ people: StaffUser[]; max?: number }> = ({ people, max = 4 }) => (
  <div className="dp-avas">
    {people.slice(0, max).map((p, i) => (
      <div key={p.id} className={cx('dp-ava', i === 0 && 'lead')} title={p.fullName}>
        {initials(p.fullName || p.email)}
      </div>
    ))}
    {people.length > max && <div className="dp-ava more">+{people.length - max}</div>}
  </div>
);

const TreeNode: React.FC<{
  d: DeptNode;
  sel: string | null;
  onSel: (id: string) => void;
  open: Set<string>;
  toggleOpen: (id: string) => void;
  t: (k: string, o?: any) => string;
}> = ({ d, sel, onSel, open, toggleOpen, t }) => {
  const isOpen = open.has(d.id);
  const hasKids = d.children.length > 0;
  const manager = d.directStaff.find((s) => s.id === d.managerId) || null;
  return (
    <div className="dp-node">
      <div className={cx('dp-row', sel === d.id && 'sel')} onClick={() => onSel(d.id)}>
        <button
          type="button"
          className={cx('dp-caret', !hasKids && 'hidden')}
          onClick={(e) => {
            e.stopPropagation();
            toggleOpen(d.id);
          }}
        >
          <Ic d={isOpen ? DIC.chev : DIC.chevR} size={13} />
        </button>
        <div className="dp-ic">
          <Ic d={d.level === 0 ? DIC.crown : DIC.dept} size={14} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="dp-n">
            {d.name}
            {d.code && <span className="dp-code">{d.code}</span>}
          </div>
          <div className="dp-m">
            {hasKids ? t('crm.departments.page.tree.subCount', { count: d.children.length }) + ' · ' : ''}
            {t('crm.departments.page.tree.staffCount', { count: d.totalStaffCount })}
          </div>
        </div>
        <div className={cx('dp-lead', !d.managerId && 'vacant')}>
          {manager ? (
            <>
              <span className="dp-ava lead">{initials(manager.fullName || manager.email)}</span>
              {manager.fullName || manager.email}
            </>
          ) : (
            <>
              <Ic d={DIC.flag} size={12} />
              {t('crm.departments.page.tree.noManager')}
            </>
          )}
        </div>
        <div>
          <Avas people={d.directStaff} />
        </div>
        <Ic d={DIC.chevR} size={14} />
      </div>
      {hasKids && isOpen && (
        <div className="dp-kids">
          {d.children.map((k) => (
            <TreeNode key={k.id} d={k} sel={sel} onSel={onSel} open={open} toggleOpen={toggleOpen} t={t} />
          ))}
        </div>
      )}
    </div>
  );
};

export const DepartmentsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlertModal();
  const isOwner = (getStoredUser()?.role || '') === 'owner';

  const [tab, setTab] = useState<'tree' | 'list' | 'unassigned'>('tree');
  const [tree, setTree] = useState<Department[]>([]);
  const [allStaff, setAllStaff] = useState<StaffUser[]>([]);
  const [summary, setSummary] = useState<DepartmentsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sel, setSel] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const [stats, setStats] = useState<DepartmentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editParentId, setEditParentId] = useState<string>('');
  const [editManagerId, setEditManagerId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  const loadAll = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchDepartmentsTree(), fetchStaff(), fetchDepartmentsSummary()])
      .then(([treeData, staffData, summaryData]) => {
        setTree(treeData);
        setAllStaff(staffData);
        setSummary(summaryData);
        setOpen((prev) => (prev.size ? prev : new Set(treeData.map((d) => d.id))));
      })
      .catch((e: any) => setError(e.message || t('crm.departments.errors.loadFailed')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const staffByDept = useMemo(() => {
    const m = new Map<string, StaffUser[]>();
    allStaff.forEach((s) => {
      if (!s.departmentId || !s.isActive) return;
      const arr = m.get(s.departmentId) ?? [];
      arr.push(s);
      m.set(s.departmentId, arr);
    });
    return m;
  }, [allStaff]);

  const annotatedTree = useMemo(() => annotate(tree, staffByDept, 0), [tree, staffByDept]);
  const flatDepts = useMemo(() => flattenTree(annotatedTree), [annotatedTree]);
  const flatById = useMemo(() => new Map(flatDepts.map((d) => [d.id, d])), [flatDepts]);
  const parentOf = useMemo(() => {
    const m = new Map<string, string>();
    flatDepts.forEach((d) => d.children.forEach((c) => m.set(c.id, d.id)));
    return m;
  }, [flatDepts]);

  useEffect(() => {
    if (!sel && flatDepts.length) setSel(flatDepts[0].id);
  }, [flatDepts, sel]);

  const selectedDept = sel ? flatById.get(sel) ?? null : null;

  useEffect(() => {
    if (!selectedDept) return;
    setEditName(selectedDept.name);
    setEditCode(selectedDept.code || '');
    setEditParentId(selectedDept.parentId || '');
    setEditManagerId(selectedDept.managerId || '');
    setSaved(false);
  }, [selectedDept?.id]);

  useEffect(() => {
    if (!sel) return;
    let alive = true;
    setStatsLoading(true);
    fetchDepartmentStats(sel)
      .then((res) => {
        if (alive) setStats(res);
      })
      .catch(() => {
        if (alive) setStats(null);
      })
      .finally(() => {
        if (alive) setStatsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [sel]);

  const toggleOpen = (id: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setOpen(new Set(collectIds(annotatedTree)));
  const collapseAll = () => setOpen(new Set());

  const unassigned = useMemo(() => allStaff.filter((s) => !s.departmentId && s.isActive), [allStaff]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.trim().toLowerCase();
    return flatDepts.filter((d) => (d.name + (d.code || '')).toLowerCase().includes(q));
  }, [search, flatDepts]);

  const handleSaveDept = async () => {
    if (!selectedDept) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateDepartment(selectedDept.id, {
        name: editName.trim(),
        code: editCode.trim() || null,
        parentId: editParentId || null,
        managerId: editManagerId || null,
      });
      setTree((prev) => replaceInTree(prev, updated));
      setSaved(true);
    } catch (e: any) {
      showAlert(e.message || t('crm.departments.errors.saveFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const replaceInTree = (nodes: Department[], updated: Department): Department[] =>
    nodes.map((n) =>
      n.id === updated.id
        ? { ...n, ...updated, children: n.children }
        : { ...n, children: n.children ? replaceInTree(n.children, updated) : n.children },
    );

  const handleDeleteDept = async () => {
    if (!selectedDept) return;
    const ok = await showConfirm(t('crm.departments.deleteConfirm'), {
      title: t('crm.departments.delete'),
      confirmLabel: t('crm.departments.delete'),
      cancelLabel: t('crm.departments.page.cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteDepartment(selectedDept.id);
      setSel(null);
      loadAll();
    } catch (e: any) {
      showAlert(e.message || t('crm.departments.errors.deleteFailed'), { variant: 'error' });
    }
  };

  const movePerson = async (staffId: string, departmentId: string | null) => {
    try {
      await updateStaffUser(staffId, { departmentId });
      loadAll();
    } catch (e: any) {
      showAlert(e.message || t('crm.departments.errors.saveFailed'), { variant: 'error' });
    }
  };

  const exportList = () => {
    const rows = [
      [
        t('crm.departments.page.list.headers.name'),
        t('crm.departments.page.list.headers.code'),
        t('crm.departments.page.list.headers.parent'),
        t('crm.departments.page.list.headers.manager'),
        t('crm.departments.page.list.headers.staff'),
      ],
      ...flatDepts.map((d) => {
        const parentId = parentOf.get(d.id);
        const manager = d.directStaff.find((s) => s.id === d.managerId);
        return [
          d.name,
          d.code || '',
          parentId ? flatById.get(parentId)?.name || '' : '',
          manager ? manager.fullName || manager.email : '',
          String(d.totalStaffCount),
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'departments.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const roleCounts = useMemo(() => {
    if (!selectedDept) return [];
    const m = new Map<string, number>();
    selectedDept.directStaff.forEach((s) => m.set(s.role, (m.get(s.role) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [selectedDept]);

  const fmtMoney = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);

  return (
    <MainLayout>
      <div className="px-scope">
        <div className="dp-hero">
          <div>
            <div className="kicker">
              <span className="dot" />
              {t('crm.departments.page.kicker')}
            </div>
            <h1>{t('crm.departments.title')}</h1>
            <p className="sub">{t('crm.departments.page.heroSub')}</p>
          </div>
          <div className="dp-hero-r">
            <button className="btn btn-sm btn-primary" onClick={() => navigate('/app/departments/new')}>
              <Ic d={DIC.plus} size={13} />
              {t('crm.departments.create')}
            </button>
          </div>
        </div>

        {error && (
          <div className="dp-alert" style={{ marginBottom: 14 }}>
            {error}
          </div>
        )}

        {summary && (
          <div className="dp-kpis">
            <div className="dp-kpi">
              <div className="l">{t('crm.departments.page.kpi.departments')}</div>
              <div className="v">{summary.departmentsCount}</div>
            </div>
            <div className="dp-kpi">
              <div className="l">{t('crm.departments.page.kpi.staffInDepts')}</div>
              <div className="v">{summary.staffInDepartments}</div>
              <div className="d">{t('crm.departments.page.kpi.staffInDeptsOf', { total: summary.totalActiveStaff })}</div>
            </div>
            <div className="dp-kpi">
              <div className="l">{t('crm.departments.page.kpi.noManager')}</div>
              <div className={cx('v')} style={summary.departmentsWithoutManager > 0 ? { color: '#a06a08' } : undefined}>
                {summary.departmentsWithoutManager}
              </div>
            </div>
            <div className="dp-kpi">
              <div className="l">{t('crm.departments.page.kpi.unassigned')}</div>
              <div className="v" style={summary.unassignedStaffCount > 0 ? { color: '#a06a08' } : undefined}>
                {summary.unassignedStaffCount}
              </div>
            </div>
          </div>
        )}

        <div className="dp-tabs">
          <div className={cx('dp-tab', tab === 'tree' && 'active')} onClick={() => setTab('tree')}>
            {t('crm.departments.page.tabs.tree')}
            <span className="n">{summary?.departmentsCount ?? flatDepts.length}</span>
          </div>
          <div className={cx('dp-tab', tab === 'list' && 'active')} onClick={() => setTab('list')}>
            {t('crm.departments.page.tabs.list')}
          </div>
          <div className={cx('dp-tab', tab === 'unassigned' && 'active')} onClick={() => setTab('unassigned')}>
            {t('crm.departments.page.tabs.unassigned')}
            <span className="n">{unassigned.length}</span>
          </div>
        </div>

        {loading ? (
          <div className="text-xs" style={{ color: 'var(--fg-3)' }}>
            {t('crm.departments.loading')}
          </div>
        ) : tab === 'tree' ? (
          <div className="dp-layout">
            <div className="dp-card">
              <div className="dp-toolbar">
                <div className="dp-search">
                  <Ic d={DIC.search} size={13} />
                  <input
                    placeholder={t('crm.departments.page.tree.searchPlaceholder') || ''}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button className="btn btn-sm" onClick={() => (open.size ? collapseAll() : expandAll())}>
                  {open.size ? t('crm.staff.permissions.collapseAll') : t('crm.staff.permissions.expandAll')}
                </button>
              </div>
              <div className="dp-tree">
                {searchResults
                  ? searchResults.map((d) => (
                      <TreeNode
                        key={d.id}
                        d={{ ...d, children: [] }}
                        sel={sel}
                        onSel={setSel}
                        open={new Set()}
                        toggleOpen={() => {}}
                        t={t}
                      />
                    ))
                  : annotatedTree.map((n) => (
                      <TreeNode key={n.id} d={n} sel={sel} onSel={setSel} open={open} toggleOpen={toggleOpen} t={t} />
                    ))}
                {searchResults && !searchResults.length && (
                  <div style={{ padding: 24, textAlign: 'center', fontSize: 12.5, color: 'var(--fg-3)' }}>
                    {t('crm.staff.permissions.noResults', { q: search })}
                  </div>
                )}
              </div>
              <div className="dp-card-foot">
                <span>
                  {t('crm.departments.page.tree.footnote', {
                    depts: flatDepts.length,
                    staff: summary?.staffInDepartments ?? 0,
                    unassigned: summary?.unassignedStaffCount ?? 0,
                  })}
                </span>
              </div>
            </div>

            {selectedDept && (
              <div>
                <div className="dp-card" style={{ marginBottom: 16 }}>
                  <div className="dp-card-head">
                    <div>
                      <h3>
                        <Ic d={DIC.dept} size={15} />
                        {selectedDept.name}
                      </h3>
                      <div className="sub">
                        {selectedDept.code ? `${t('crm.departments.page.inspector.code')} ${selectedDept.code} · ` : ''}
                        {t('crm.departments.page.inspector.createdOn', {
                          date: new Date(selectedDept.createdAt).toLocaleDateString(),
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="dp-card-body">
                    {!selectedDept.managerId && (
                      <div className="dp-alert" style={{ marginBottom: 13 }}>
                        <Ic d={DIC.flag} size={13} />
                        <div>{t('crm.departments.page.inspector.noManagerWarning')}</div>
                      </div>
                    )}
                    <div className="dp-field-row">
                      <div className="dp-field">
                        <span className="dp-label">{t('crm.departments.page.inspector.name')}</span>
                        <input className="dp-input" value={editName} disabled={!isOwner} onChange={(e) => setEditName(e.target.value)} />
                      </div>
                      <div className="dp-field">
                        <span className="dp-label">{t('crm.departments.page.inspector.code')}</span>
                        <input className="dp-input" value={editCode} disabled={!isOwner} onChange={(e) => setEditCode(e.target.value)} />
                      </div>
                    </div>
                    <div className="dp-field">
                      <span className="dp-label">{t('crm.departments.page.inspector.parent')}</span>
                      <select className="dp-select" value={editParentId} disabled={!isOwner} onChange={(e) => setEditParentId(e.target.value)}>
                        <option value="">{t('crm.departments.page.inspector.noParent')}</option>
                        {flatDepts
                          .filter((d) => d.id !== selectedDept.id)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {'— '.repeat(d.level)}
                              {d.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="dp-field" style={{ marginBottom: 0 }}>
                      <span className="dp-label">{t('crm.departments.page.inspector.manager')}</span>
                      <select className="dp-select" value={editManagerId} disabled={!isOwner} onChange={(e) => setEditManagerId(e.target.value)}>
                        <option value="">{t('crm.departments.page.inspector.noManagerOption')}</option>
                        {selectedDept.directStaff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.fullName || s.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="dp-card-foot">
                    <span>{saved ? t('crm.departments.page.inspector.saved') : t('crm.departments.page.inspector.saveHint')}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {isOwner && (
                        <button className="btn btn-sm" onClick={handleDeleteDept}>
                          {t('crm.departments.delete')}
                        </button>
                      )}
                      {isOwner && (
                        <button className="btn btn-sm btn-primary" disabled={saving} onClick={handleSaveDept}>
                          <Ic d={DIC.check} size={13} />
                          {saving ? t('crm.staff.permissions.saving') : t('crm.departments.page.inspector.save')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="dp-card" style={{ marginBottom: 16 }}>
                  <div className="dp-card-head">
                    <div>
                      <h3>
                        <Ic d={DIC.users} size={15} />
                        {t('crm.departments.page.inspector.composition', { count: selectedDept.directStaff.length })}
                      </h3>
                      <div className="sub">
                        {selectedDept.totalStaffCount > selectedDept.directStaff.length
                          ? t('crm.departments.page.inspector.plusInSubdepts', {
                              count: selectedDept.totalStaffCount - selectedDept.directStaff.length,
                            })
                          : t('crm.departments.page.inspector.noSubdepts')}
                      </div>
                    </div>
                  </div>
                  <div className="dp-card-body">
                    {selectedDept.directStaff.length === 0 ? (
                      <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{t('crm.departments.noStaff')}</div>
                    ) : (
                      selectedDept.directStaff.map((s) => (
                        <div key={s.id} className="dp-person">
                          <div className={cx('dp-ava', 'big', s.id === selectedDept.managerId && 'lead')}>
                            {initials(s.fullName || s.email)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="nm">{s.fullName || s.email}</div>
                            <div className="rl">{roleLabels[s.role]}</div>
                          </div>
                          <select
                            className="dp-select mv"
                            style={{ width: 'auto', maxWidth: 150 }}
                            value={selectedDept.id}
                            onChange={(e) => movePerson(s.id, e.target.value || null)}
                          >
                            <option value={selectedDept.id}>{t('crm.departments.page.inspector.keepHere')}</option>
                            <option value="">{t('crm.departments.page.inspector.removeFromDept')}</option>
                            {flatDepts
                              .filter((d) => d.id !== selectedDept.id)
                              .map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="dp-card" style={{ marginBottom: 16 }}>
                  <div className="dp-card-head">
                    <div>
                      <h3>
                        <Ic d={DIC.key} size={15} />
                        {t('crm.departments.page.inspector.access.title')}
                      </h3>
                      <div className="sub">{t('crm.departments.page.inspector.access.subtitle')}</div>
                    </div>
                  </div>
                  <div className="dp-card-body">
                    {roleCounts.length === 0 ? (
                      <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{t('crm.departments.noStaff')}</div>
                    ) : (
                      roleCounts.map(([role, count]) => (
                        <div key={role} className="dp-kv">
                          <span className="k">{roleLabels[role as StaffRole] || role}</span>
                          <span className="v mono">{count}</span>
                        </div>
                      ))
                    )}
                    <a className="btn btn-sm" href="/app/staff/permissions" style={{ marginTop: 12 }}>
                      <Ic d={DIC.key} size={12} />
                      {t('crm.departments.page.inspector.access.openLink')}
                    </a>
                  </div>
                </div>

                <div className="dp-card">
                  <div className="dp-card-head">
                    <div>
                      <h3>
                        <Ic d={DIC.chart} size={15} />
                        {t('crm.departments.page.inspector.stats.title')}
                      </h3>
                      <div className="sub">{t('crm.departments.page.inspector.stats.subtitle')}</div>
                    </div>
                  </div>
                  <div className="dp-card-body">
                    {statsLoading || !stats ? (
                      <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{t('crm.staff.permissions.rulesTab.simulate.loading')}</div>
                    ) : (
                      <>
                        <div className="dp-kv">
                          <span className="k">{t('crm.departments.page.inspector.stats.leadsInProgress')}</span>
                          <span className="v mono">{stats.leadsInProgress}</span>
                        </div>
                        <div className="dp-kv">
                          <span className="k">{t('crm.departments.page.inspector.stats.salesClosed')}</span>
                          <span className="v mono">
                            {stats.salesClosed30d} · {fmtMoney(stats.salesClosed30dAmount)}
                          </span>
                        </div>
                        <div className="dp-kv">
                          <span className="k">{t('crm.departments.page.inspector.stats.conversion')}</span>
                          <span className="v mono">{stats.conversionPct === null ? '—' : `${stats.conversionPct}%`}</span>
                        </div>
                        <div className="dp-kv">
                          <span className="k">{t('crm.departments.page.inspector.stats.staffTotal')}</span>
                          <span className="v mono">{stats.staffCountRecursive}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : tab === 'list' ? (
          <div className="dp-card">
            <div className="dp-card-head">
              <div>
                <h3>
                  <Ic d={DIC.table} size={15} />
                  {t('crm.departments.page.list.title')}
                </h3>
                <div className="sub">{t('crm.departments.page.list.subtitle')}</div>
              </div>
              <button className="btn btn-sm" onClick={exportList}>
                <Ic d={DIC.download} size={13} />
                {t('crm.departments.page.list.export')}
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="dp-table">
                <thead>
                  <tr>
                    <th>{t('crm.departments.page.list.headers.name')}</th>
                    <th>{t('crm.departments.page.list.headers.code')}</th>
                    <th>{t('crm.departments.page.list.headers.parent')}</th>
                    <th>{t('crm.departments.page.list.headers.manager')}</th>
                    <th>{t('crm.departments.page.list.headers.staff')}</th>
                  </tr>
                </thead>
                <tbody>
                  {flatDepts.map((d) => {
                    const parentId = parentOf.get(d.id);
                    const manager = d.directStaff.find((s) => s.id === d.managerId);
                    return (
                      <tr key={d.id} onClick={() => { setSel(d.id); setTab('tree'); }} style={{ cursor: 'pointer' }}>
                        <td className="nm">
                          <span className="dp-ind">{'— '.repeat(d.level)}</span>
                          {d.name}
                        </td>
                        <td className="mono">{d.code || '—'}</td>
                        <td>{parentId ? flatById.get(parentId)?.name || '—' : '—'}</td>
                        <td>
                          {manager ? (
                            manager.fullName || manager.email
                          ) : (
                            <span style={{ color: '#a06a08' }}>{t('crm.departments.page.tree.noManager')}</span>
                          )}
                        </td>
                        <td className="mono">{d.totalStaffCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="dp-card">
            <div className="dp-card-head">
              <div>
                <h3>
                  <Ic d={DIC.user} size={15} />
                  {t('crm.departments.page.unassigned.title', { count: unassigned.length })}
                </h3>
                <div className="sub">{t('crm.departments.page.unassigned.subtitle')}</div>
              </div>
            </div>
            <div className="dp-card-body tight">
              {unassigned.length === 0 ? (
                <div className="dp-card-body" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                  {t('crm.departments.page.unassigned.empty')}
                </div>
              ) : (
                unassigned.map((u) => (
                  <div key={u.id} className="dp-un">
                    <div>
                      <div className="nm">{u.fullName || u.email}</div>
                      <div className="em">{u.email}</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>{roleLabels[u.role]}</div>
                    <select
                      className="dp-select"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) movePerson(u.id, e.target.value);
                      }}
                    >
                      <option value="">{t('crm.departments.page.unassigned.pickDept')}</option>
                      {flatDepts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
