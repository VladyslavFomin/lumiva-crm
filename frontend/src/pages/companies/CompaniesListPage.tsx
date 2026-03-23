// src/pages/companies/CompaniesListPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
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

export const CompaniesListPage: React.FC = () => {
  const { t } = useTranslation();
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
    if (!confirm(t('crm.companies.list.deleteConfirm'))) return;
    try {
      await deleteCompany(id);
      setCompanies(companies.filter((c) => c.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      alert(err.message || t('crm.companies.list.errors.deleteFailed'));
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
      alert(e.message || t('crm.companies.bulk.errors.updateFailed'));
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

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{t('crm.companies.list.title')}</h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.companies.list.subtitle')}
              {selectedIds.size > 0 && (
                <span className="ml-2 text-[#222222]">
                  ({selectedIds.size} {t('crm.companies.list.selected')})
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={() => setBulkModalOpen(true)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
              >
                {t('crm.companies.list.bulkOperations')} ({selectedIds.size})
              </button>
            )}
            <button
              onClick={handleCreate}
              className="px-3 py-1.5 text-xs rounded-xl bg-[#222222] text-white font-semibold hover:bg-black transition-colors"
            >
              + {t('crm.companies.list.create')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="text-[10px] text-slate-500">{t('crm.companies.list.stats.total')}</div>
            <div className="text-lg font-semibold text-slate-900">{companiesStats.total}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="text-[10px] text-slate-500">{t('crm.companies.list.stats.active')}</div>
            <div className="text-lg font-semibold text-emerald-600">{companiesStats.active}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="text-[10px] text-slate-500">{t('crm.companies.list.stats.inactive')}</div>
            <div className="text-lg font-semibold text-amber-600">{companiesStats.inactive}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="text-[10px] text-slate-500">{t('crm.companies.list.stats.archived')}</div>
            <div className="text-lg font-semibold text-slate-600">{companiesStats.archived}</div>
          </div>
        </div>

        {/* Поиск + фильтры */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input
              type="text"
              placeholder={t('crm.companies.list.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:col-span-2 w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-500"
            >
              <option value="">{t('crm.companies.list.filters.allStatuses')}</option>
              <option value="active">{t('crm.companies.form.statuses.active')}</option>
              <option value="inactive">{t('crm.companies.form.statuses.inactive')}</option>
              <option value="archived">{t('crm.companies.form.statuses.archived')}</option>
            </select>
            <div className="inline-flex rounded-xl border border-slate-300 p-1 bg-slate-50">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex-1 px-3 py-1.5 text-xs rounded-lg ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                {t('crm.companies.list.view.table')}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('board')}
                className={`flex-1 px-3 py-1.5 text-xs rounded-lg ${viewMode === 'board' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                {t('crm.companies.list.view.cards')}
              </button>
            </div>
          </div>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Загрузка */}
        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400">{t('crm.companies.list.loading')}</div>
        ) : filteredCompanies.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center">
            <div className="text-xs text-slate-400">
              {search ? t('crm.companies.list.notFound') : t('crm.companies.list.empty')}
            </div>
            {!search && (
              <button
                onClick={handleCreate}
                className="mt-4 px-4 py-2 text-xs rounded-xl bg-[#222222] text-white font-semibold hover:bg-black transition-colors"
              >
                {t('crm.companies.list.createFirst')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Чекбокс "Выбрать все" */}
            {filteredCompanies.length > 0 && (
              <div className="flex items-center gap-2 px-2">
                <input
                  type="checkbox"
                  checked={filteredCompanies.length > 0 && filteredCompanies.every((company) => selectedIds.has(company.id))}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-lumiva-accent focus:ring-lumiva-accent"
                />
                <span className="text-xs text-slate-400">
                  {t('crm.common.selectAll')} ({filteredCompanies.length})
                </span>
              </div>
            )}
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
                      className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-lumiva-accent focus:ring-lumiva-accent flex-shrink-0"
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
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="min-w-[820px] w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left w-10" />
                      <th className="px-3 py-2 text-left">{t('crm.companies.list.table.headers.company')}</th>
                      <th className="px-3 py-2 text-left">{t('crm.companies.list.table.headers.contacts')}</th>
                      <th className="px-3 py-2 text-left">{t('crm.companies.list.table.headers.assignee')}</th>
                      <th className="px-3 py-2 text-left">{t('crm.companies.list.table.headers.status')}</th>
                      <th className="px-3 py-2 text-left">{t('crm.companies.list.table.headers.industry')}</th>
                      <th className="px-3 py-2 text-left">{t('crm.companies.list.table.headers.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.map((company) => (
                      <tr
                        key={company.id}
                        className="border-t border-slate-200 hover:bg-slate-50 cursor-pointer"
                        onClick={() => handleOpen(company.id)}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(company.id)}
                            onChange={() => handleToggleSelect(company.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">{company.name}</div>
                          {company.tags?.length ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {company.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {[company.email, company.phone].filter(Boolean).join(' · ') || t('crm.companies.list.common.empty')}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{company.assignedTo || t('crm.companies.list.common.empty')}</td>
                        <td className="px-3 py-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                            {formatCompanyStatus(company.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{company.industry || t('crm.companies.list.common.empty')}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/companies/${company.id}/tasks`);
                              }}
                              className="rounded-lg border border-slate-300 px-2 py-1 text-[10px] text-slate-700 hover:bg-slate-100"
                            >
                              {t('crm.companies.list.tasks')}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDelete(company.id, e)}
                              className="rounded-lg border border-rose-300 px-2 py-1 text-[10px] text-rose-600 hover:bg-rose-50"
                            >
                              {t('crm.companies.list.delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Модальное окно массовых операций */}
        {bulkModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs font-semibold text-slate-50">
                    {t('crm.companies.bulk.title')}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {t('crm.companies.bulk.subtitle', { count: selectedIds.size })}
                  </div>
                </div>
                <button
                  onClick={() => setBulkModalOpen(false)}
                  className="text-slate-400 hover:text-white text-xl leading-none"
                  type="button"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1.5">
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
                  <label className="block text-[10px] text-slate-500 mb-1.5">{t('crm.companies.bulk.status')}</label>
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
                  <label className="block text-[10px] text-slate-500 mb-1.5">
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
                  className="px-4 py-2 text-xs text-slate-400 hover:text-slate-50 transition-colors"
                >
                  {t('crm.companies.bulk.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleBulkUpdate}
                  disabled={bulkSaving}
                  className="px-4 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
