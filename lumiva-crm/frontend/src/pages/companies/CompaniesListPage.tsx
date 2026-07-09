// src/pages/companies/CompaniesListPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fetchCompanies,
  type Company,
  deleteCompany,
  bulkUpdateCompanies,
  type BulkUpdateCompaniesDto,
} from '../../api/companies';
import { fetchStaff, type StaffUser } from '../../api/staff';
import { useWorkspaceStyleColumnDrag } from '../../components/table/useWorkspaceStyleColumnDrag';
import '../projects/ProjectsListPage.css';
import {
  OwnerAvatarsRow,
  resolveCompanyAssigneeDisplay,
} from '../../components/crm/OwnerAvatarsRow';
import { useAlertModal } from '../../contexts/AlertModalContext';

const COMPANIES_TABLE_COLUMNS_KEY = 'companies_table_columns_v1';

type CompanyTableColId = 'name' | 'contacts' | 'assignee' | 'status' | 'industry' | 'actions';

export const CompaniesListPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState<boolean>(false);
  const [bulkSaving, setBulkSaving] = useState<boolean>(false);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [bulkAssignedUserId, setBulkAssignedUserId] = useState<string>('');
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [bulkTags, setBulkTags] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'board' | 'table'>('table');
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchCompanies({
        search: search || undefined,
        status: statusFilter || undefined,
        limit: 100,
      }),
      fetchStaff(),
    ])
      .then(([companiesData, staffData]) => {
        if (!alive) return;
        setCompanies(companiesData.items);
        setStaff(staffData);
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.companies.list.errors.loadFailed'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [search, statusFilter]);

  const handleCreate = () => navigate('/companies/new');
  const handleOpen = (id: string) => navigate(`/companies/${id}`);
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await showConfirm(t('crm.companies.list.deleteConfirm'), {
      title: t('crm.confirmModal.deleteTitle', { defaultValue: 'Удаление' }),
      confirmLabel: t('crm.confirmModal.deleteLabel', { defaultValue: 'Удалить' }),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteCompany(id);
      setCompanies(companies.filter((c) => c.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      showAlert(err.message || t('crm.companies.list.errors.deleteFailed'), {
        variant: 'error',
      });
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const visibleIds = filteredCompanies.map((company) => company.id);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return;

    setBulkSaving(true);
    try {
      const dto: BulkUpdateCompaniesDto = {
        companyIds: Array.from(selectedIds),
      };

      if (bulkAssignedUserId) {
        const staffMember = staff.find((s) => s.id === bulkAssignedUserId);
        dto.assignedUserId = bulkAssignedUserId;
        dto.assignedTo = staffMember?.fullName || staffMember?.email || null;
      }

      if (bulkStatus) {
        dto.status = bulkStatus;
      }

      if (bulkTags.trim()) {
        dto.tagsToAdd = bulkTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      }

      await bulkUpdateCompanies(dto);
      setBulkModalOpen(false);
      setSelectedIds(new Set());
      setBulkAssignedUserId('');
      setBulkStatus('');
      setBulkTags('');

      // Перезагружаем список
      const data = await fetchCompanies({
        search: search || undefined,
        status: statusFilter || undefined,
        limit: 100,
      });
      setCompanies(data.items);
    } catch (e: any) {
      console.error(e);
      showAlert(e.message || t('crm.companies.bulk.errors.updateFailed'), {
        variant: 'error',
      });
    } finally {
      setBulkSaving(false);
    }
  };
  const filteredCompanies = useMemo(() => {
    if (!statusFilter) return companies;
    return companies.filter((company) => (company.status || 'active') === statusFilter);
  }, [companies, statusFilter]);
  const formatCompanyStatus = (status?: string) => {
    if (status === 'inactive') return t('crm.companies.form.statuses.inactive');
    if (status === 'archived') return t('crm.companies.form.statuses.archived');
    if (status === 'active' || !status) return t('crm.companies.form.statuses.active');
    return status;
  };
  const companiesStats = useMemo(() => {
    const total = companies.length;
    const active = companies.filter((company) => (company.status || 'active') === 'active').length;
    const inactive = companies.filter((company) => company.status === 'inactive').length;
    const archived = companies.filter((company) => company.status === 'archived').length;
    return { total, active, inactive, archived };
  }, [companies]);

  const companyColumnDefs = useMemo((): { id: CompanyTableColId; label: string }[] => {
    return [
      { id: 'name', label: t('crm.companies.list.table.headers.company') },
      { id: 'contacts', label: t('crm.companies.list.table.headers.contacts') },
      { id: 'assignee', label: t('crm.companies.list.table.headers.assignee') },
      { id: 'status', label: t('crm.companies.list.table.headers.status') },
      { id: 'industry', label: t('crm.companies.list.table.headers.industry') },
      { id: 'actions', label: t('crm.companies.list.table.headers.actions') },
    ];
  }, [t]);

  const orderedCompanyColumns = useMemo(() => {
    if (!companyColumnDefs.length) return [];
    const map = new Map(companyColumnDefs.map((col) => [col.id, col]));
    const order =
      columnOrder.length > 0 ? columnOrder : companyColumnDefs.map((col) => col.id);
    const result: typeof companyColumnDefs = [];
    order.forEach((id) => {
      const col = map.get(id as CompanyTableColId);
      if (col) result.push(col);
    });
    companyColumnDefs.forEach((col) => {
      if (!result.find((r) => r.id === col.id)) result.push(col);
    });
    return result;
  }, [companyColumnDefs, columnOrder]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COMPANIES_TABLE_COLUMNS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.order)) setColumnOrder(parsed.order);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(COMPANIES_TABLE_COLUMNS_KEY, JSON.stringify({ order: columnOrder }));
    } catch {
      // ignore
    }
  }, [columnOrder]);

  useEffect(() => {
    if (!companyColumnDefs.length) return;
    setColumnOrder((prev) => {
      if (!prev.length) return companyColumnDefs.map((c) => c.id);
      const ids = companyColumnDefs.map((c) => c.id);
      const filtered = prev.filter((id) => ids.includes(id as CompanyTableColId));
      const missing = ids.filter((cid) => !filtered.includes(cid));
      return [...filtered, ...missing];
    });
  }, [companyColumnDefs]);

  const reorderColumns = useCallback((dragId: string, targetId: string) => {
    setColumnOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      return next;
    });
  }, []);

  const { getThProps, draggingColumnKey, columnDragOverKey } =
    useWorkspaceStyleColumnDrag(reorderColumns, 'light');

  const companyColClass = (colId: CompanyTableColId): string =>
    colId === 'name' ? 'lv-tcol-name' : colId === 'actions' ? 'lv-tcol-actions' : 'lv-tcol-center';

  const renderCompanyCellContent = (company: Company, colId: CompanyTableColId): React.ReactNode => {
    switch (colId) {
      case 'name':
        return (
          <>
            <div className="font-medium text-[var(--ink)]">{company.name}</div>
            {company.tags?.length ? (
              <div className="mt-1 flex flex-wrap gap-1 justify-start">
                {company.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="lv-cell-tag">
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
          </>
        );
      case 'contacts':
        return (
          <span className="text-[12.5px] text-[var(--ink)]">
            {[company.email, company.phone].filter(Boolean).join(' · ') || t('crm.companies.list.common.empty')}
          </span>
        );
      case 'assignee': {
        const items = resolveCompanyAssigneeDisplay(company, staff);
        return items.length ? (
          <OwnerAvatarsRow items={items} readOnly />
        ) : (
          <span className="text-[var(--fg-3)]">—</span>
        );
      }
      case 'status':
        return (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
            {formatCompanyStatus(company.status)}
          </span>
        );
      case 'industry':
        return (
          <span className="text-[12.5px] text-[var(--ink)]">
            {company.industry || t('crm.companies.list.common.empty')}
          </span>
        );
      case 'actions':
        return (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/companies/${company.id}/tasks`);
              }}
              className="lv-tb-btn"
              style={{ fontSize: 10, padding: '4px 8px' }}
            >
              {t('crm.companies.list.tasks')}
            </button>
            <button
              type="button"
              onClick={(e) => handleDelete(company.id, e)}
              className="lv-tb-btn"
              style={{ fontSize: 10, padding: '4px 8px', color: '#b91c1c', borderColor: '#fecaca' }}
            >
              {t('crm.companies.list.delete')}
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <MainLayout>
      <div
        className="lv-pt w-full pb-8 min-w-0"
        style={{
          marginLeft: -24,
          marginRight: -24,
          paddingLeft: 24,
          paddingRight: 24,
          width: 'calc(100% + 48px)',
        }}
      >
        <div className="lv-pt-head">
          <div>
            <h1>{t('crm.companies.list.title')}</h1>
            <div className="sub">
              {t('crm.companies.list.subtitle')}
              {selectedIds.size > 0 && (
                <span className="ml-2" style={{ color: 'var(--ink)' }}>
                  ({selectedIds.size} {t('crm.companies.list.selected')})
                </span>
              )}
            </div>
          </div>
          <div className="lv-pt-head-actions">
            {selectedIds.size > 0 && (
              <button type="button" className="lv-tb-btn" onClick={() => setBulkModalOpen(true)}>
                {t('crm.companies.list.bulkOperations')} ({selectedIds.size})
              </button>
            )}
            <button
              type="button"
              onClick={handleCreate}
              className="lv-tb-btn"
              style={{ background: '#222', color: '#fff', borderColor: '#222', borderRadius: 8 }}
            >
              + {t('crm.companies.list.create')}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-[var(--fg-3)] mb-[14px]">
          <span>
            <span className="font-semibold text-[var(--ink)]">{companiesStats.total}</span> —{' '}
            {t('crm.companies.list.stats.total')}
          </span>
          <span>
            <span className="font-semibold text-emerald-600">{companiesStats.active}</span> —{' '}
            {t('crm.companies.list.stats.active')}
          </span>
          <span>
            <span className="font-semibold text-amber-600">{companiesStats.inactive}</span> —{' '}
            {t('crm.companies.list.stats.inactive')}
          </span>
          <span>
            <span className="font-semibold text-[var(--ink)]">{companiesStats.archived}</span> —{' '}
            {t('crm.companies.list.stats.archived')}
          </span>
        </div>

        {error && (
          <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-[8px] px-3 py-2 mb-[14px]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-[12px] text-slate-400 mb-[14px]">{t('crm.companies.list.loading')}</div>
        ) : filteredCompanies.length === 0 ? (
          <div
            className="rounded-[10px] border p-8 text-center"
            style={{ borderColor: 'var(--line-2)', background: 'var(--surface)' }}
          >
            <div className="text-[12px] text-[var(--fg-3)]">
              {search ? t('crm.companies.list.notFound') : t('crm.companies.list.empty')}
            </div>
            {!search && (
              <button
                type="button"
                onClick={handleCreate}
                className="mt-4 lv-tb-btn"
                style={{ background: '#222', color: '#fff', borderColor: '#222', borderRadius: 8 }}
              >
                {t('crm.companies.list.createFirst')}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="lv-toolbar">
              <div className="lv-tb-search" style={{ flex: '1 1 180px', maxWidth: 320 }}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  style={{ color: 'var(--fg-4)', flexShrink: 0 }}
                  aria-hidden
                >
                  <circle cx="6.5" cy="6.5" r="5.5" />
                  <path d="M11 11l3.5 3.5" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('crm.companies.list.search')}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    style={{
                      background: 'none',
                      border: 0,
                      cursor: 'pointer',
                      color: 'var(--fg-3)',
                      fontSize: 14,
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="lv-toolbar-divider" />

              <label className="lv-tb-select">
                <span className="lbl">{t('crm.companies.form.fields.status')}:</span>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">{t('crm.companies.list.filters.allStatuses')}</option>
                  <option value="active">{t('crm.companies.form.statuses.active')}</option>
                  <option value="inactive">{t('crm.companies.form.statuses.inactive')}</option>
                  <option value="archived">{t('crm.companies.form.statuses.archived')}</option>
                </select>
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: 'var(--fg-3)', flexShrink: 0 }}
                  aria-hidden
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </label>

              <div className="lv-toolbar-spacer" />

              <button
                type="button"
                className={`lv-tb-btn${viewMode === 'table' ? ' active' : ''}`}
                onClick={() => setViewMode('table')}
              >
                {t('crm.companies.list.view.table')}
              </button>
              <button
                type="button"
                className={`lv-tb-btn${viewMode === 'board' ? ' active' : ''}`}
                onClick={() => setViewMode('board')}
              >
                {t('crm.companies.list.view.cards')}
              </button>
            </div>

            {viewMode === 'board' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredCompanies.map((company) => (
                <div
                  key={company.id}
                  className={`bg-white border rounded-3xl p-4 transition-colors ${
                    selectedIds.has(company.id)
                      ? 'border-[#222222] bg-slate-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-2 mb-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(company.id)}
                      onChange={() => handleToggleSelect(company.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 w-4 h-4 rounded border-border-default bg-white text-lumiva-accent focus:ring-lumiva-accent flex-shrink-0"
                    />
                    <div className="flex-1">
                      <h3
                        className="text-sm font-semibold text-slate-900 line-clamp-2 cursor-pointer hover:text-[#222222] transition-colors"
                        onClick={() => navigate(`/companies/${company.id}`)}
                      >
                        {company.name}
                      </h3>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/companies/${company.id}/tasks`);
                        }}
                        className="text-slate-500 hover:text-slate-700 text-[10px] px-2 py-1 hover:bg-slate-100 rounded-lg transition-colors"
                        title={t('crm.companies.list.tasks')}
                      >
                        📋
                      </button>
                      <button
                        onClick={(e) => handleDelete(company.id, e)}
                        className="text-red-400 hover:text-red-300 text-[10px] px-2 py-1 hover:bg-red-950/30 rounded-lg transition-colors"
                      >
                        {t('crm.companies.list.delete')}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {company.email && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="text-[10px]">📧</span>
                        <span className="truncate">{company.email}</span>
                      </div>
                    )}
                    {company.phone && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="text-[10px]">📞</span>
                        <span>{company.phone}</span>
                      </div>
                    )}
                    {company.website && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="text-[10px]">🌐</span>
                        <span className="truncate">{company.website}</span>
                      </div>
                    )}
                    {(company.country || company.city) && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="text-[10px]">📍</span>
                        <span>
                          {[company.city, company.country].filter(Boolean).join(', ') || t('crm.companies.list.common.empty')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]">
                      {formatCompanyStatus(company.status)}
                    </span>
                    {company.industry && (
                      <span className="text-[10px] text-slate-500">{company.industry}</span>
                    )}
                  </div>
                </div>
            ))}
            </div>
            ) : (
              <div className="lv-proj-wrap">
                <div className="lv-proj-scroll">
                  <table className="lv-proj-table lv-leads-table min-w-[820px]">
                    <thead>
                      <tr>
                        <th className="lv-col-check">
                          <button
                            type="button"
                            className={`lv-checkbox${
                              filteredCompanies.length > 0 &&
                              filteredCompanies.every((c) => selectedIds.has(c.id))
                                ? ' checked'
                                : selectedIds.size > 0
                                  ? ' indet'
                                  : ''
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectAll();
                            }}
                            role="checkbox"
                            aria-checked={
                              filteredCompanies.length > 0 &&
                              filteredCompanies.every((c) => selectedIds.has(c.id))
                            }
                          >
                            {selectedIds.size > 0 && (
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden
                              >
                                <path d="M5 12l4 4 10-10" />
                              </svg>
                            )}
                          </button>
                        </th>
                        {orderedCompanyColumns.map((col) => {
                          const isDragging = draggingColumnKey === col.id;
                          const isDropTarget = columnDragOverKey === col.id && !isDragging;
                          return (
                            <th
                              key={col.id}
                              {...(() => {
                                const props = getThProps(col.id, col.label, '');
                                const { className: _c, ...rest } = props as any;
                                return rest;
                              })()}
                              className={[
                                isDragging ? 'lv-col-dragging' : '',
                                isDropTarget ? 'lv-col-drop-target' : '',
                                companyColClass(col.id as CompanyTableColId),
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              <span className="lv-th-inner">
                                <span className="lv-th-grip">⋮⋮</span>
                                {col.label}
                              </span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCompanies.map((company) => (
                        <tr
                          key={company.id}
                          className={`lv-proj-row${selectedIds.has(company.id) ? ' selected' : ''}`}
                          onClick={() => handleOpen(company.id)}
                        >
                          <td className="lv-col-check" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className={`lv-checkbox${selectedIds.has(company.id) ? ' checked' : ''}`}
                              onClick={() => handleToggleSelect(company.id)}
                              role="checkbox"
                              aria-checked={selectedIds.has(company.id)}
                            >
                              {selectedIds.has(company.id) && (
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden
                                >
                                  <path d="M5 12l4 4 10-10" />
                                </svg>
                              )}
                            </button>
                          </td>
                          {orderedCompanyColumns.map((col) => (
                            <td
                              key={col.id}
                              className={[
                                col.id === 'assignee' ? 'lv-td-popover' : '',
                                companyColClass(col.id as CompanyTableColId),
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              onClick={(e) => {
                                if (col.id === 'assignee' || col.id === 'actions') {
                                  e.stopPropagation();
                                }
                              }}
                            >
                              {renderCompanyCellContent(company, col.id as CompanyTableColId)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="lv-proj-foot">
                  <div className="lv-proj-foot-stats">
                    <span>
                      <span className="lbl">{t('crm.leads.list.footerTotal')}:</span>
                      <strong>{filteredCompanies.length}</strong>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Модальное окно массовых операций */}
        {bulkModalOpen && (
          <div className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl modal-panel p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs font-semibold text-[#111827]">
                    {t('crm.companies.bulk.title')}
                  </div>
                  <div className="mt-1 text-[11px] text-text-tertiary">
                    {t('crm.companies.bulk.subtitle', { count: selectedIds.size })}
                  </div>
                </div>
                <button
                  onClick={() => setBulkModalOpen(false)}
                  className="text-text-tertiary hover:text-[#111827] text-xl leading-none"
                  type="button"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-text-tertiary mb-1.5">
                    {t('crm.companies.bulk.assignedTo')}
                  </label>
                  <select
                    value={bulkAssignedUserId}
                    onChange={(e) => setBulkAssignedUserId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500"
                  >
                    <option value="">{t('crm.companies.bulk.noChange')}</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName || s.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-text-tertiary mb-1.5">{t('crm.companies.bulk.status')}</label>
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500"
                  >
                    <option value="">{t('crm.companies.bulk.noChange')}</option>
                    <option value="active">{t('crm.companies.form.statuses.active')}</option>
                    <option value="inactive">{t('crm.companies.form.statuses.inactive')}</option>
                    <option value="archived">{t('crm.companies.form.statuses.archived')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-text-tertiary mb-1.5">
                    {t('crm.companies.bulk.tags')}
                  </label>
                  <input
                    type="text"
                    value={bulkTags}
                    onChange={(e) => setBulkTags(e.target.value)}
                    placeholder={t('crm.companies.bulk.tagsPlaceholder')}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(false)}
                  className="btn-secondary btn-secondary-sm"
                >
                  {t('crm.companies.bulk.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleBulkUpdate}
                  disabled={bulkSaving}
                  className="btn-primary btn-secondary-sm disabled:opacity-50"
                >
                  {bulkSaving ? t('crm.companies.bulk.saving') : t('crm.companies.bulk.apply')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
