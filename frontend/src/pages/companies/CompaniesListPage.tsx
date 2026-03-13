// src/pages/companies/CompaniesListPage.tsx
import React, { useState, useEffect } from 'react';
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
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchCompanies({ search: search || undefined, limit: 100 }),
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
  }, [search]);

  const handleCreate = () => navigate('/app/companies/new');
  const handleOpen = (id: string) => navigate(`/app/companies/${id}`);
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
    if (selectedIds.size === companies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(companies.map((c) => c.id)));
    }
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
      const data = await fetchCompanies({ search: search || undefined, limit: 100 });
      setCompanies(data.items);
    } catch (e: any) {
      console.error(e);
      alert(e.message || t('crm.companies.bulk.errors.updateFailed'));
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">{t('crm.companies.list.title')}</h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.companies.list.subtitle')}
              {selectedIds.size > 0 && (
                <span className="ml-2 text-lumiva-accent">
                  ({selectedIds.size} {t('crm.companies.list.selected')})
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={() => setBulkModalOpen(true)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-700 text-slate-300 hover:text-slate-50 hover:border-slate-600 transition-colors"
              >
                {t('crm.companies.list.bulkOperations')} ({selectedIds.size})
              </button>
            )}
            <button
              onClick={handleCreate}
              className="px-3 py-1.5 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft transition-colors"
            >
              + {t('crm.companies.list.create')}
            </button>
          </div>
        </div>

        {/* Поиск */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4">
          <input
            type="text"
            placeholder={t('crm.companies.list.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
          />
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
        ) : companies.length === 0 ? (
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-8 text-center">
            <div className="text-xs text-slate-400">
              {search ? t('crm.companies.list.notFound') : t('crm.companies.list.empty')}
            </div>
            {!search && (
              <button
                onClick={handleCreate}
                className="mt-4 px-4 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft transition-colors"
              >
                {t('crm.companies.list.createFirst')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Чекбокс "Выбрать все" */}
            {companies.length > 0 && (
              <div className="flex items-center gap-2 px-2">
                <input
                  type="checkbox"
                  checked={selectedIds.size === companies.length && companies.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-lumiva-accent focus:ring-lumiva-accent"
                />
                <span className="text-xs text-slate-400">
                  {t('crm.common.selectAll')} ({companies.length})
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {companies.map((company) => (
                <div
                  key={company.id}
                  className={`bg-slate-900/70 border rounded-3xl p-4 transition-colors ${
                    selectedIds.has(company.id)
                      ? 'border-lumiva-accent bg-slate-800/80'
                      : 'border-slate-800/80 hover:border-slate-700/80'
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
                        className="text-sm font-semibold text-slate-50 line-clamp-2 cursor-pointer hover:text-lumiva-accent transition-colors"
                        onClick={() => navigate(`/app/companies/${company.id}`)}
                      >
                        {company.name}
                      </h3>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/app/companies/${company.id}/tasks`);
                        }}
                        className="text-slate-400 hover:text-slate-300 text-[10px] px-2 py-1 hover:bg-slate-800/50 rounded-lg transition-colors"
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
                          {[company.city, company.country].filter(Boolean).join(', ') || '-'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-slate-800/50 text-slate-300 rounded text-[10px]">
                      {company.status || 'active'}
                    </span>
                    {company.industry && (
                      <span className="text-[10px] text-slate-500">{company.industry}</span>
                    )}
                  </div>
                </div>
            ))}
            </div>
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
