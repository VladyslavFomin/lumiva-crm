// src/pages/settings/SettingsCompanyPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchCompanySettings,
  normalizeLogoUrl,
  updateCompanySettings,
  uploadCompanyLogo,
  notifyTenantBrandingUpdated,
  type CompanySettings,
} from '../../api/settings';
import { fetchStaff, updateStaffUser, type StaffUser } from '../../api/staff';
import {
  fetchTenantSessions,
  revokeAllSessionsForUser,
  revokeTenantSession,
  type TenantSessionRow,
} from '../../api/tenant-sessions';
import {
  clearSession,
  getStoredUser,
  updateStoredTenantName,
} from '../../auth/session';
import {
  deleteTenantCompanyFile,
  fetchTenantCompanyFiles,
  tenantStorageFileHref,
  type TenantCompanyFileRow,
} from '../../api/tenant-storage-files';
import {
  fetchEmailTemplates,
  type EmailTemplate,
} from '../../api/email';

type TabId = 'general' | 'billing' | 'sessions' | 'invites' | 'storage';

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0 B';
  if (n >= 1024 * 1024 * 1024)
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${Math.round(n)} B`;
}

export const SettingsCompanyPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = getStoredUser();
  const isOwner = (user?.role || '').toLowerCase() === 'owner';

  const [tab, setTab] = useState<TabId>('general');
  const [data, setData] = useState<CompanySettings | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [tenantSessions, setTenantSessions] = useState<TenantSessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [storageFiles, setStorageFiles] = useState<TenantCompanyFileRow[]>([]);
  const [storageFilesLoading, setStorageFilesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [uiLanguage, setUiLanguage] = useState<string | ''>('');
  const [aiWrapperEmailTemplateId, setAiWrapperEmailTemplateId] =
    useState<string>('');
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [emailTemplatesLoading, setEmailTemplatesLoading] = useState(false);
  const [emailTemplatesError, setEmailTemplatesError] = useState<string | null>(
    null,
  );

  const locale = useMemo(() => {
    if (i18n.language === 'tr') return 'tr-TR';
    if (i18n.language === 'en') return 'en-US';
    return 'ru-RU';
  }, [i18n.language]);

  const langOptions = useMemo(
    () => [
      { value: 'ru', label: t('lang.ru') },
      { value: 'en', label: t('lang.en') },
      { value: 'tr', label: t('lang.tr') },
    ],
    [t],
  );

  const loadSettings = useCallback(() => {
    return fetchCompanySettings()
      .then((settings) => {
        setData(settings);
        setName(settings.name || '');
        setLogoUrl(
          normalizeLogoUrl(settings.logoUrl) ?? settings.logoUrl ?? '',
        );
        setUiLanguage(settings.uiLanguage || '');
        setAiWrapperEmailTemplateId(settings.aiWrapperEmailTemplateId ?? '');
        if (settings.name?.trim()) {
          updateStoredTenantName(settings.name.trim());
        }
        notifyTenantBrandingUpdated();
        return settings;
      })
      .catch((e: any) => {
        console.error(e);
        setError(e.message || t('crm.settings.company.errors.load'));
        throw e;
      });
  }, [t]);

  const loadStaff = useCallback(() => {
    return fetchStaff()
      .then(setStaff)
      .catch((e) => console.error(e));
  }, []);

  const loadTenantSessions = useCallback(() => {
    if (!isOwner) return Promise.resolve();
    setSessionsLoading(true);
    return fetchTenantSessions()
      .then(setTenantSessions)
      .catch((e) => {
        console.error(e);
        setTenantSessions([]);
      })
      .finally(() => setSessionsLoading(false));
  }, [isOwner]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([loadSettings(), loadStaff()])
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadSettings, loadStaff]);

  useEffect(() => {
    if (!isOwner || tab !== 'sessions') return;
    void loadTenantSessions();
  }, [isOwner, tab, loadTenantSessions]);

  const loadStorageFiles = useCallback(() => {
    setStorageFilesLoading(true);
    return fetchTenantCompanyFiles()
      .then(setStorageFiles)
      .catch((e) => {
        console.error(e);
        setStorageFiles([]);
      })
      .finally(() => setStorageFilesLoading(false));
  }, []);

  useEffect(() => {
    if (tab !== 'storage') return;
    void loadStorageFiles();
  }, [tab, loadStorageFiles]);

  useEffect(() => {
    if (tab !== 'general' || !data) return;
    let alive = true;
    setEmailTemplatesLoading(true);
    setEmailTemplatesError(null);
    fetchEmailTemplates()
      .then((list) => {
        if (alive) setEmailTemplates(list);
      })
      .catch((e: any) => {
        console.error(e);
        if (alive) {
          setEmailTemplates([]);
          setEmailTemplatesError(
            e.message || t('crm.settings.company.fields.aiWrapperTemplatesError'),
          );
        }
      })
      .finally(() => {
        if (alive) setEmailTemplatesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tab, data, t]);

  const orderedSessions = useMemo(() => {
    return [...tenantSessions].sort((a, b) => {
      const byEmail = a.userEmail.localeCompare(b.userEmail);
      if (byEmail !== 0) return byEmail;
      return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
    });
  }, [tenantSessions]);

  const sessionCountByUser = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of tenantSessions) {
      m.set(s.userId, (m.get(s.userId) || 0) + 1);
    }
    return m;
  }, [tenantSessions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !isOwner) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updateCompanySettings({
        name: name.trim() || data.name,
        logoUrl: logoUrl.trim() || null,
        uiLanguage: uiLanguage || null,
        aiWrapperEmailTemplateId: aiWrapperEmailTemplateId.trim()
          ? aiWrapperEmailTemplateId.trim()
          : null,
      });
      setData(updated);
      setAiWrapperEmailTemplateId(updated.aiWrapperEmailTemplateId ?? '');
      setLogoUrl(
        normalizeLogoUrl(updated.logoUrl) ?? updated.logoUrl ?? '',
      );
      if (updated.name?.trim()) {
        updateStoredTenantName(updated.name.trim());
      }
      setSuccess(t('crm.settings.company.success'));
      notifyTenantBrandingUpdated();
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.settings.company.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isOwner) return;
    setUploadingLogo(true);
    setError(null);
    try {
      const updated = await uploadCompanyLogo(file);
      setData(updated);
      setLogoUrl(
        normalizeLogoUrl(updated.logoUrl) ?? updated.logoUrl ?? '',
      );
      setSuccess(t('crm.settings.company.logoUploadSuccess'));
      notifyTenantBrandingUpdated();
    } catch (err: any) {
      console.error(err);
      setError(err.message || t('crm.settings.company.errors.upload'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const toggleStaffActive = async (s: StaffUser) => {
    if (!isOwner || s.role === 'owner') return;
    try {
      const next = await updateStaffUser(s.id, { isActive: !s.isActive });
      setStaff((prev) => prev.map((x) => (x.id === next.id ? next : x)));
      setSuccess(
        next.isActive
          ? t('crm.settings.company.sessions.activated')
          : t('crm.settings.company.sessions.deactivated'),
      );
      void loadTenantSessions();
    } catch (e: any) {
      setError(e.message || t('crm.settings.company.errors.save'));
    }
  };

  const handleRevokeSession = async (row: TenantSessionRow) => {
    if (!isOwner) return;
    setError(null);
    try {
      await revokeTenantSession(row.id);
      setSuccess(t('crm.settings.company.sessions.revokeSuccess'));
      await loadTenantSessions();
      const me = getStoredUser();
      if (me?.id && row.userId === me.id) {
        clearSession();
        window.location.href = '/login';
      }
    } catch (e: any) {
      setError(e.message || t('crm.settings.company.errors.save'));
    }
  };

  const handleStorageDelete = async (id: string) => {
    if (!data?.canDeleteTenantStorage) return;
    setError(null);
    try {
      await deleteTenantCompanyFile(id);
      await loadStorageFiles();
      await loadSettings();
      setSuccess(t('crm.settings.company.storage.deleteSuccess'));
    } catch (err: any) {
      setError(err.message || t('crm.settings.company.errors.save'));
    }
  };

  const handleRevokeAllForUser = async (userId: string) => {
    if (!isOwner) return;
    setError(null);
    try {
      await revokeAllSessionsForUser(userId);
      setSuccess(t('crm.settings.company.sessions.revokeAllSuccess'));
      await loadTenantSessions();
      const me = getStoredUser();
      if (me?.id && userId === me.id) {
        clearSession();
        window.location.href = '/login';
      }
    } catch (e: any) {
      setError(e.message || t('crm.settings.company.errors.save'));
    }
  };

  const invited = useMemo(
    () => staff.filter((s) => (s.inviteStatus || '').toLowerCase() === 'invited'),
    [staff],
  );

  const cardClass =
    'rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)]';

  const tabs: { id: TabId; label: string }[] = [
    { id: 'general', label: t('crm.settings.company.tabs.general') },
    { id: 'billing', label: t('crm.settings.company.tabs.billing') },
    { id: 'sessions', label: t('crm.settings.company.tabs.sessions') },
    { id: 'invites', label: t('crm.settings.company.tabs.invites') },
    { id: 'storage', label: t('crm.settings.company.tabs.storage') },
  ];

  const used = data?.storageUsedBytes ?? 0;
  const quota = data?.storageQuotaBytes ?? null;
  const pct =
    quota === null || quota <= 0 ? 0 : Math.min(100, (used / quota) * 100);

  return (
    <MainLayout>
      <div className="min-h-[60vh] space-y-5">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
            {t('crm.settings.company.sectionLabel')}
          </div>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {t('crm.settings.company.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('crm.settings.company.subtitle')}
          </p>
        </div>

        {!isOwner && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t('crm.settings.company.ownerOnly')}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {success}
          </div>
        )}

        {loading && (
          <div className="text-sm text-slate-500">{t('crm.settings.company.loading')}</div>
        )}

        {!loading && data && (
          <>
            <div className="flex flex-wrap gap-2">
              {tabs.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setTab(x.id)}
                  className={
                    'rounded-xl border px-4 py-2 text-sm font-medium transition-colors ' +
                    (tab === x.id
                      ? 'border-[#222222] bg-[#222222] text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300')
                  }
                >
                  {x.label}
                </button>
              ))}
            </div>

            {tab === 'general' && (
              <form onSubmit={handleSubmit} className={`${cardClass} space-y-5`}>
                <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        {t('crm.settings.company.fields.name')}
                      </label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={!isOwner}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:opacity-60"
                        placeholder={t('crm.settings.company.fields.namePlaceholder')}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        {t('crm.settings.company.fields.language')}
                      </label>
                      <select
                        value={uiLanguage}
                        onChange={(e) => setUiLanguage(e.target.value)}
                        disabled={!isOwner}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:opacity-60"
                      >
                        <option value="">{t('crm.settings.company.fields.languageEmpty')}</option>
                        {langOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {t('crm.settings.company.fields.languageHint')}
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        {t('crm.settings.company.fields.aiWrapperTemplate')}
                      </label>
                      <select
                        value={aiWrapperEmailTemplateId}
                        onChange={(e) =>
                          setAiWrapperEmailTemplateId(e.target.value)
                        }
                        disabled={!isOwner || emailTemplatesLoading}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:opacity-60"
                      >
                        <option value="">
                          {t('crm.settings.company.fields.aiWrapperTemplateEmpty')}
                        </option>
                        {emailTemplates.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name}
                            {!tpl.isActive
                              ? t(
                                  'crm.settings.company.fields.templateInactiveSuffix',
                                )
                              : ''}
                          </option>
                        ))}
                      </select>
                      {emailTemplatesLoading && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          {t(
                            'crm.settings.company.fields.aiWrapperTemplatesLoading',
                          )}
                        </p>
                      )}
                      {emailTemplatesError && (
                        <p className="mt-1 text-[11px] text-red-600">
                          {emailTemplatesError}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-slate-500">
                        {t('crm.settings.company.fields.aiWrapperTemplateHint')}
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        {t('crm.settings.company.fields.logo')}
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        {isOwner && (
                          <label className="cursor-pointer rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100">
                            {uploadingLogo
                              ? t('crm.settings.company.logoUploading')
                              : t('crm.settings.company.logoUpload')}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/gif"
                              className="hidden"
                              onChange={handleLogoFile}
                              disabled={uploadingLogo}
                            />
                          </label>
                        )}
                        <input
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                          disabled={!isOwner}
                          className="min-w-[200px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:opacity-60"
                          placeholder="https://…"
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {t('crm.settings.company.fields.logoHint')}
                      </p>
                    </div>

                    {isOwner && (
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-xl bg-lumiva-accent px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-lumiva-accent-soft disabled:opacity-60"
                      >
                        {saving ? t('crm.settings.company.saving') : t('crm.settings.company.save')}
                      </button>
                    )}

                    <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                      <div>
                        <div className="text-xs font-medium text-slate-500">
                          {t('crm.settings.company.fields.created')}
                        </div>
                        <div className="mt-1 text-sm text-slate-900">
                          {new Date(data.createdAt).toLocaleString(locale)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-500">
                          {t('crm.settings.company.fields.updated')}
                        </div>
                        <div className="mt-1 text-sm text-slate-900">
                          {new Date(data.updatedAt).toLocaleString(locale)}
                        </div>
                      </div>
                    </div>
                </div>
              </form>
            )}

            {tab === 'billing' && (
              <div className={`${cardClass} space-y-4`}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      {t('crm.settings.company.fields.plan')}
                    </div>
                    <div className="mt-1 inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-900">
                      {data.plan}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      {t('crm.settings.company.billing.activeUntil')}
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {data.activeUntil
                        ? new Date(data.activeUntil).toLocaleString(locale)
                        : t('crm.settings.company.billing.unlimited')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      {t('crm.settings.company.fields.status')}
                    </div>
                    <div
                      className={
                        'mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ' +
                        (data.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700')
                      }
                    >
                      {data.status}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      {t('crm.settings.company.fields.clientKey')}
                    </div>
                    <div className="mt-1 break-all font-mono text-xs text-slate-700">{data.clientKey}</div>
                  </div>
                </div>
                <p className="text-sm text-slate-600">{t('crm.settings.company.billing.hint')}</p>
                <button
                  type="button"
                  onClick={() => navigate('/billing')}
                        className="rounded-xl border border-[#222222] bg-[#222222] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#333333]"
                >
                  {t('crm.settings.company.billing.manage')}
                </button>
              </div>
            )}

            {tab === 'sessions' && (
              <div className="space-y-5">
                <div className={`${cardClass} overflow-x-auto`}>
                  <p className="mb-4 text-sm text-slate-600">{t('crm.settings.company.sessions.hint')}</p>
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="pb-2 pr-3">{t('crm.settings.company.sessions.colName')}</th>
                        <th className="pb-2 pr-3">{t('crm.settings.company.sessions.colEmail')}</th>
                        <th className="pb-2 pr-3">{t('crm.settings.company.sessions.colRole')}</th>
                        <th className="pb-2 pr-3">{t('crm.settings.company.sessions.colLastLogin')}</th>
                        <th className="pb-2">{t('crm.settings.company.sessions.colActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.map((s) => (
                        <tr key={s.id} className="border-b border-slate-100">
                          <td className="py-2 pr-3 font-medium text-slate-900">{s.fullName}</td>
                          <td className="py-2 pr-3 text-slate-700">{s.email}</td>
                          <td className="py-2 pr-3 text-slate-600">{s.role}</td>
                          <td className="py-2 pr-3 text-slate-600">
                            {s.lastLoginAt
                              ? new Date(s.lastLoginAt).toLocaleString(locale)
                              : '—'}
                          </td>
                          <td className="py-2">
                            {s.role !== 'owner' && isOwner ? (
                              <button
                                type="button"
                                onClick={() => toggleStaffActive(s)}
                                className={
                                  'text-xs font-semibold underline ' +
                                  (s.isActive ? 'text-rose-600' : 'text-emerald-700')
                                }
                              >
                                {s.isActive
                                  ? t('crm.settings.company.sessions.deactivate')
                                  : t('crm.settings.company.sessions.activate')}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {isOwner && (
                <div className={`${cardClass} overflow-x-auto`}>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t('crm.settings.company.sessions.activeLoginsTitle')}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {t('crm.settings.company.sessions.activeLoginsHint')}
                  </p>
                  {sessionsLoading ? (
                    <p className="mt-4 text-sm text-slate-500">{t('crm.settings.company.sessions.loading')}</p>
                  ) : orderedSessions.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">{t('crm.settings.company.sessions.noSessions')}</p>
                  ) : (
                    <table className="mt-4 w-full min-w-[720px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs text-slate-500">
                          <th className="pb-2 pr-3">{t('crm.settings.company.sessions.colName')}</th>
                          <th className="pb-2 pr-3">{t('crm.settings.company.sessions.colEmail')}</th>
                          <th className="pb-2 pr-3">{t('crm.settings.company.sessions.colIp')}</th>
                          <th className="pb-2 pr-3">{t('crm.settings.company.sessions.colStarted')}</th>
                          <th className="pb-2 pr-3">{t('crm.settings.company.sessions.colLastSeen')}</th>
                          <th className="pb-2 pr-3">{t('crm.settings.company.sessions.colUserAgent')}</th>
                          <th className="pb-2">{t('crm.settings.company.sessions.colActions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderedSessions.map((row, idx) => {
                          const prev = orderedSessions[idx - 1];
                          const isFirstForUser = !prev || prev.userId !== row.userId;
                          const n = sessionCountByUser.get(row.userId) || 0;
                          const ua =
                            row.userAgent && row.userAgent.length > 80
                              ? `${row.userAgent.slice(0, 80)}…`
                              : row.userAgent || '—';
                          return (
                            <tr key={row.id} className="border-b border-slate-100">
                              <td className="py-2 pr-3 font-medium text-slate-900">
                                {row.userName || '—'}
                              </td>
                              <td className="py-2 pr-3 text-slate-700">{row.userEmail}</td>
                              <td className="py-2 pr-3 font-mono text-xs text-slate-700">
                                {row.ip || '—'}
                              </td>
                              <td className="py-2 pr-3 text-slate-600">
                                {new Date(row.createdAt).toLocaleString(locale)}
                              </td>
                              <td className="py-2 pr-3 text-slate-600">
                                {new Date(row.lastSeenAt).toLocaleString(locale)}
                              </td>
                              <td className="max-w-[200px] py-2 pr-3 text-xs text-slate-500" title={row.userAgent || ''}>
                                {ua}
                              </td>
                              <td className="py-2">
                                {isOwner ? (
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void handleRevokeSession(row)}
                                      className="text-xs font-semibold text-rose-600 underline"
                                    >
                                      {t('crm.settings.company.sessions.revokeOne')}
                                    </button>
                                    {isFirstForUser && n > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => void handleRevokeAllForUser(row.userId)}
                                        className="text-xs font-semibold text-rose-700 underline"
                                      >
                                        {t('crm.settings.company.sessions.revokeAll', { count: n })}
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
                )}
              </div>
            )}

            {tab === 'invites' && (
              <div className={`${cardClass} overflow-x-auto`}>
                <p className="mb-4 text-sm text-slate-600">{t('crm.settings.company.invites.hint')}</p>
                {invited.length === 0 ? (
                  <p className="text-sm text-slate-500">{t('crm.settings.company.invites.empty')}</p>
                ) : (
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="pb-2 pr-3">{t('crm.settings.company.invites.colEmail')}</th>
                        <th className="pb-2 pr-3">{t('crm.settings.company.invites.colRole')}</th>
                        <th className="pb-2">{t('crm.settings.company.invites.colStatus')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invited.map((s) => (
                        <tr key={s.id} className="border-b border-slate-100">
                          <td className="py-2 pr-3">{s.email}</td>
                          <td className="py-2 pr-3">{s.role}</td>
                          <td className="py-2">{s.inviteStatus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === 'storage' && (
              <div className="space-y-4">
                <div className={cardClass}>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t('crm.settings.company.storage.usageTitle')}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">{t('crm.settings.company.storage.tiersHint')}</p>
                  <div className="mt-4 text-sm text-slate-800">
                    <span className="font-semibold">{formatBytes(used)}</span>
                    {quota !== null && (
                      <>
                        {' '}
                        / <span className="font-semibold">{formatBytes(quota)}</span>
                      </>
                    )}
                    {quota === null && (
                      <span className="ml-2 text-slate-500">
                        ({t('crm.settings.company.storage.unlimitedPlan')})
                      </span>
                    )}
                  </div>
                  {quota !== null && (
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-lumiva-accent transition-[width]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                  <p className="mt-3 text-[11px] text-slate-500">{t('crm.settings.company.storage.extraHint')}</p>
                  <button
                    type="button"
                    onClick={() => navigate('/billing')}
                    className="mt-4 rounded-xl bg-[#222222] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#333333]"
                  >
                    {t('crm.settings.company.storage.buyMore')}
                  </button>
                </div>

                <div className={`${cardClass} overflow-x-auto`}>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t('crm.settings.company.storage.filesTitle')}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">{t('crm.settings.company.storage.filesHint')}</p>
                  {!data?.canDeleteTenantStorage && (
                    <p className="mt-2 text-[11px] text-slate-500">
                      {t('crm.settings.company.storage.deleteRolesHint')}
                    </p>
                  )}
                  {storageFilesLoading ? (
                    <p className="mt-4 text-sm text-slate-500">{t('crm.settings.company.storage.loadingFiles')}</p>
                  ) : storageFiles.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">{t('crm.settings.company.storage.noFiles')}</p>
                  ) : (
                    <table className="mt-4 w-full min-w-[760px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs text-slate-500">
                          <th className="pb-2 pr-3">{t('crm.settings.company.storage.colSource')}</th>
                          <th className="pb-2 pr-3">{t('crm.settings.company.storage.colFile')}</th>
                          <th className="pb-2 pr-3">{t('crm.settings.company.storage.colSize')}</th>
                          <th className="pb-2 pr-3">{t('crm.settings.company.storage.colUploadedBy')}</th>
                          <th className="pb-2 pr-3">{t('crm.settings.company.storage.colDate')}</th>
                          <th className="pb-2">{t('crm.settings.company.storage.colActions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {storageFiles.map((f) => (
                          <tr key={f.id} className="border-b border-slate-100">
                            <td className="py-2 pr-3 text-slate-600">
                              {t(`crm.settings.company.storage.source.${f.source}`)}
                            </td>
                            <td className="py-2 pr-3 font-medium text-slate-900">
                              {f.relativePath ? (
                                <a
                                  href={tenantStorageFileHref(f.relativePath)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-slate-900 underline hover:text-slate-700"
                                >
                                  {f.originalName}
                                </a>
                              ) : (
                                f.originalName
                              )}
                            </td>
                            <td className="py-2 pr-3 text-slate-600">
                              {f.sizeBytes !== null && f.sizeBytes !== undefined
                                ? formatBytes(f.sizeBytes)
                                : '—'}
                            </td>
                            <td className="py-2 pr-3 text-slate-600">
                              {f.uploadedByEmail || '—'}
                            </td>
                            <td className="py-2 pr-3 text-slate-600">
                              {new Date(f.createdAt).toLocaleString(locale)}
                            </td>
                            <td className="py-2">
                              {data?.canDeleteTenantStorage ? (
                                <button
                                  type="button"
                                  onClick={() => void handleStorageDelete(f.id)}
                                  className="text-xs font-semibold text-rose-600 underline"
                                >
                                  {t('crm.settings.company.storage.delete')}
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </MainLayout>
  );
};
