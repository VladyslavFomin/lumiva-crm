// src/pages/staff/StaffDetailPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { fetchStaffById } from '../../api/staff';
import type { StaffUser, StaffRole } from '../../api/staff';

export const StaffDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<StaffUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
    if (!id) return;
    setLoading(true);
    setError(null);

    fetchStaffById(id)
      .then(setItem)
      .catch((e: any) => {
        console.error(e);
        setError(e.message || t('crm.staff.detail.errors.load'));
      })
      .finally(() => setLoading(false));
  }, [id]);

  const renderAvatar = () => {
    if (!item) return null;

    if (item.avatarUrl) {
      return (
        <img
          src={item.avatarUrl}
          alt={item.fullName || ''}
          className="h-16 w-16 rounded-full object-cover"
        />
      );
    }

    const initials = (item.fullName || '')
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return (
      <div className="h-16 w-16 rounded-full bg-lumiva-accent flex items-center justify-center text-sm text-white font-semibold">
        {initials || t('crm.staff.common.initialsFallback')}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-[11px] text-text-secondary hover:text-[#111827] transition-colors"
        >
          ← {t('crm.staff.detail.back')}
        </button>

        {error && (
          <div className="text-xs text-status-error bg-status-error-bg border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-xs text-text-tertiary">{t('crm.staff.detail.loading')}</div>
        )}

        {!loading && item && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-4">
              {renderAvatar()}
              <div>
                <div className="page-title">{item.fullName}</div>
                <div className="text-xs text-text-secondary">{item.email}</div>
                <div className="text-[10px] text-text-tertiary mt-1 break-all">
                  {t('crm.staff.detail.id', { id: item.id })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="text-text-secondary">{t('crm.staff.detail.role')}</div>
                <span className="badge bg-surface-subtle text-[#111827]">
                  {roleLabels[item.role]}
                </span>
              </div>

              <div className="space-y-2">
                <div className="text-text-secondary">{t('crm.staff.detail.department')}</div>
                <div className="text-[#111827]">
                  {item.department || t('crm.staff.common.notSpecified')}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-text-secondary">{t('crm.staff.detail.status')}</div>
                <span className={item.isActive ? 'badge-active' : 'badge-inactive'}>
                  {item.isActive ? t('crm.staff.status.active') : t('crm.staff.status.disabled')}
                </span>
              </div>

              <div className="space-y-2">
                <div className="text-text-secondary">{t('crm.staff.detail.external')}</div>
                <div className="text-[#111827]">
                  {item.externalId || t('crm.staff.common.empty')}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
