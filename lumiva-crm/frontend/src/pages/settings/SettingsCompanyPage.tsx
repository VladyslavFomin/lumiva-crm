// src/pages/settings/SettingsCompanyPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { BillingPage } from '../BillingPage';
import {
  fetchCompanySettings,
  normalizeLogoUrl,
  updateCompanySettings,
  uploadCompanyLogo,
  notifyTenantBrandingUpdated,
  type CompanySettings,
} from '../../api/settings';
import {
  fetchStaff,
  updateStaffUser,
  inviteStaffMember,
  resendStaffInvite,
  type StaffUser,
  type StaffRole,
} from '../../api/staff';
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
import { API_BASE } from '../../api/client';
import './settings-design.css';

type TabId = 'general' | 'billing' | 'sessions' | 'invites' | 'storage';

const D = {
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M8 7h2" /><path d="M14 7h2" /><path d="M8 11h2" /><path d="M14 11h2" /><path d="M8 15h2" /><path d="M14 15h2" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" /><path d="M7 15h4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3 3-5.5 6-5.5s6 2.5 6 5.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 14.5c2.5 0 5 1.5 5 4" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  disk: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </>
  ),
  upload: (
    <>
      <path d="M12 21V9" /><path d="M7 14l5-5 5 5" /><path d="M4 3h16" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="1.5" />
      <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="14" r="4" />
      <path d="M11 11l8-8" /><path d="M16 6l3 3" /><path d="M13 9l2 2" />
    </>
  ),
  check: <path d="M5 12l4 4 10-10" />,
  plus: (
    <>
      <path d="M12 5v14" /><path d="M5 12h14" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V8l-6-5z" />
      <path d="M14 3v5h5" />
    </>
  ),
  laptop: (
    <>
      <rect x="4" y="4" width="16" height="11" rx="1.5" />
      <path d="M2 19h20" />
    </>
  ),
};

const Icon: React.FC<{ d: React.ReactNode; size?: number }> = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

const INVITE_ROLES: Exclude<StaffRole, 'owner'>[] = [
  'manager',
  'viewer',
  'finance',
  'sales',
  'developer',
  'support',
];

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

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<StaffRole, 'owner'>>(
    'manager',
  );
  const [inviteSending, setInviteSending] = useState(false);
  const [resendBusyId, setResendBusyId] = useState<string | null>(null);
  const [clientKeyCopied, setClientKeyCopied] = useState(false);

  const copyClientKey = () => {
    if (!data?.clientKey) return;
    navigator.clipboard
      .writeText(data.clientKey)
      .then(() => {
        setClientKeyCopied(true);
        setTimeout(() => setClientKeyCopied(false), 1600);
      })
      .catch(() => {});
  };

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

  const inviteRoleOptions = useMemo(
    () =>
      INVITE_ROLES.map((r) => ({
        value: r,
        label: t(`crm.staff.roles.${r}`),
      })),
    [t],
  );

  const handleSendInvite = async () => {
    if (!isOwner) return;
    setInviteSending(true);
    setError(null);
    setSuccess(null);
    try {
      await inviteStaffMember({
        email: inviteEmail.trim(),
        fullName: inviteFullName.trim(),
        role: inviteRole,
      });
      setSuccess(t('crm.settings.company.invites.sent'));
      setInviteEmail('');
      setInviteFullName('');
      await loadStaff();
    } catch (e: any) {
      setError(
        e?.message || t('crm.settings.company.invites.errors.generic'),
      );
    } finally {
      setInviteSending(false);
    }
  };

  const handleResendInvite = async (id: string) => {
    if (!isOwner) return;
    setResendBusyId(id);
    setError(null);
    setSuccess(null);
    try {
      await resendStaffInvite(id);
      setSuccess(t('crm.settings.company.invites.resent'));
      await loadStaff();
    } catch (e: any) {
      setError(
        e?.message || t('crm.settings.company.invites.errors.resend'),
      );
    } finally {
      setResendBusyId(null);
    }
  };

  const tabs: { id: TabId; label: string; ic: React.ReactNode }[] = [
    { id: 'general', label: t('crm.settings.company.tabs.general'), ic: D.building },
    { id: 'billing', label: t('crm.settings.company.tabs.billing'), ic: D.card },
    { id: 'sessions', label: t('crm.settings.company.tabs.sessions'), ic: D.users },
    { id: 'invites', label: t('crm.settings.company.tabs.invites'), ic: D.mail },
    { id: 'storage', label: t('crm.settings.company.tabs.storage'), ic: D.disk },
  ];

  const used = data?.storageUsedBytes ?? 0;
  const quota = data?.storageQuotaBytes ?? null;
  const pct =
    quota === null || quota <= 0 ? 0 : Math.min(100, (used / quota) * 100);

  return (
    <MainLayout>
      <div className="st-scope">
        <div className="st-head">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.settings.company.sectionLabel')}</div>
            <h1>{t('crm.settings.company.title')}</h1>
            <p className="sub">{t('crm.settings.company.subtitle')}</p>
          </div>
        </div>

        {!isOwner && (
          <div className="st-owner-note"><Icon d={D.key} size={14} />{t('crm.settings.company.ownerOnly')}</div>
        )}

        {error && <div className="st-banner err">{error}</div>}
        {success && <div className="st-banner ok"><Icon d={D.check} size={14} />{success}</div>}

        {loading && (
          <div style={{ padding: '24px 0', color: 'var(--fg-3)', fontSize: 13 }}>{t('crm.settings.company.loading')}</div>
        )}

        {!loading && data && (
          <>
            <div className="st-tabs">
              {tabs.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  className={`st-tab${tab === x.id ? ' active' : ''}`}
                  onClick={() => setTab(x.id)}
                >
                  <span className="ic"><Icon d={x.ic} size={14} /></span>{x.label}
                </button>
              ))}
            </div>

            {tab === 'general' && (
              <form onSubmit={handleSubmit} className="st-grid">
                <div className="st-panel">
                  <div className="st-panel-head">
                    <div>
                      <div className="pt"><span className="ic"><Icon d={D.building} size={14} /></span>{t('crm.settings.company.tabs.general')}</div>
                    </div>
                  </div>
                  <div className="st-panel-body">
                    <div className="st-logo-row" style={{ marginBottom: 20 }}>
                      <div className="st-logo-box">
                        {logoUrl ? <img src={logoUrl} alt={t('crm.settings.company.fields.logoAlt') || ''} /> : <Icon d={D.building} size={26} />}
                      </div>
                      <div className="st-logo-actions">
                        {isOwner && (
                          <label className="aib ghost sm" style={{ cursor: 'pointer', width: 'fit-content' }}>
                            <Icon d={D.upload} size={13} />
                            {uploadingLogo ? t('crm.settings.company.logoUploading') : t('crm.settings.company.logoUpload')}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/gif"
                              style={{ display: 'none' }}
                              onChange={handleLogoFile}
                              disabled={uploadingLogo}
                            />
                          </label>
                        )}
                        <div className="hint">{t('crm.settings.company.fields.logoHint')}</div>
                      </div>
                    </div>

                    <div className="ai-field">
                      <label className="ai-label">{t('crm.settings.company.fields.name')}</label>
                      <input
                        className="ai-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={!isOwner}
                        placeholder={t('crm.settings.company.fields.namePlaceholder')}
                      />
                    </div>

                    <div className="ai-field-row" style={{ marginBottom: 14 }}>
                      <div className="ai-field" style={{ margin: 0 }}>
                        <label className="ai-label">{t('crm.settings.company.fields.language')}</label>
                        <select
                          className="ai-select"
                          value={uiLanguage}
                          onChange={(e) => setUiLanguage(e.target.value)}
                          disabled={!isOwner}
                        >
                          <option value="">{t('crm.settings.company.fields.languageEmpty')}</option>
                          {langOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <p className="ai-hint">{t('crm.settings.company.fields.languageHint')}</p>
                    </div>

                    <div className="ai-field" style={{ margin: 0 }}>
                      <label className="ai-label">{t('crm.settings.company.fields.aiWrapperTemplate')}</label>
                      <select
                        className="ai-select"
                        value={aiWrapperEmailTemplateId}
                        onChange={(e) =>
                          setAiWrapperEmailTemplateId(e.target.value)
                        }
                        disabled={!isOwner || emailTemplatesLoading}
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
                        <p className="ai-hint">{t('crm.settings.company.fields.aiWrapperTemplatesLoading')}</p>
                      )}
                      {emailTemplatesError && (
                        <p className="ai-hint" style={{ color: '#cc2f47' }}>{emailTemplatesError}</p>
                      )}
                    </div>
                    </div>

                    {isOwner && (
                      <button type="submit" disabled={saving} className="aib" style={{ marginTop: 18 }}>
                        <Icon d={D.check} size={15} />
                        {saving ? t('crm.settings.company.saving') : t('crm.settings.company.save')}
                      </button>
                    )}

                    <div className="st-meta-row">
                      <div>
                        <div className="k">{t('crm.settings.company.fields.created')}</div>
                        <div className="v">{new Date(data.createdAt).toLocaleString(locale)}</div>
                      </div>
                      <div>
                        <div className="k">{t('crm.settings.company.fields.updated')}</div>
                        <div className="v">{new Date(data.updatedAt).toLocaleString(locale)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="st-panel">
                  <div className="st-panel-head"><div className="pt"><span className="ic"><Icon d={D.key} size={14} /></span>{t('crm.settings.company.fields.clientKey')}</div></div>
                  <div className="st-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="ai-field" style={{ margin: 0 }}>
                      <label className="ai-label">{t('crm.settings.company.fields.clientKey')}</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input className="ai-input" style={{ fontFamily: 'var(--ff-mono)', fontSize: 12 }} value={data.clientKey} readOnly />
                        <button type="button" className="aib ghost sm" title={t('crm.common.copy') || 'Copy'} onClick={copyClientKey}>
                          <Icon d={clientKeyCopied ? D.check : D.copy} size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="ai-field" style={{ margin: 0 }}>
                      <label className="ai-label">API endpoint</label>
                      <input
                        className="ai-input"
                        style={{ fontFamily: 'var(--ff-mono)', fontSize: 11.5 }}
                        value={`${window.location.origin}${API_BASE}`}
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              </form>
            )}

            {tab === 'billing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="st-panel">
                  <div className="st-plan-row">
                    <div className="st-plan-cell">
                      <div className="l">{t('crm.settings.company.fields.plan')}</div>
                      <div className="v"><span className="pr-badge active">{data.plan}</span></div>
                    </div>
                    <div className="st-plan-cell">
                      <div className="l">{t('crm.settings.company.fields.status')}</div>
                      <div className="v"><span className={`pr-badge ${data.status === 'active' ? 'active' : 'hidden'}`}>{data.status}</span></div>
                    </div>
                    <div className="st-plan-cell">
                      <div className="l">{t('crm.settings.company.billing.activeUntil')}</div>
                      <div className="v">
                        {data.activeUntil
                          ? new Date(data.activeUntil).toLocaleString(locale)
                          : t('crm.settings.company.billing.unlimited')}
                      </div>
                    </div>
                    <div className="st-plan-cell">
                      <div className="l">{t('crm.settings.company.fields.clientKey')}</div>
                      <div className="v mono">{data.clientKey}</div>
                    </div>
                  </div>
                  <div className="st-billing-hint">{t('crm.settings.company.billing.hint')}</div>
                </div>

                <BillingPage embedded currentPlan={data.plan} />
              </div>
            )}

            {tab === 'sessions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="st-panel">
                  <div className="st-panel-head">
                    <div className="pt"><span className="ic"><Icon d={D.users} size={14} /></span>{t('crm.settings.company.tabs.sessions')}</div>
                    <div className="pd" style={{ margin: 0 }}>{t('crm.settings.company.sessions.hint')}</div>
                  </div>
                  <div className="st-table-wrap">
                    <table className="st-table">
                      <thead>
                        <tr>
                          <th>{t('crm.settings.company.sessions.colName')}</th>
                          <th>{t('crm.settings.company.sessions.colEmail')}</th>
                          <th>{t('crm.settings.company.sessions.colRole')}</th>
                          <th>{t('crm.settings.company.sessions.colLastLogin')}</th>
                          <th>{t('crm.settings.company.sessions.colActions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staff.map((s) => (
                          <tr key={s.id}>
                            <td style={{ fontWeight: 500 }}>{s.fullName}</td>
                            <td className="mono">{s.email}</td>
                            <td>{t(`crm.staff.roles.${s.role}`, { defaultValue: s.role })}</td>
                            <td className="mono">
                              {s.lastLoginAt
                                ? new Date(s.lastLoginAt).toLocaleString(locale)
                                : '—'}
                            </td>
                            <td>
                              {s.role !== 'owner' && isOwner ? (
                                <button
                                  type="button"
                                  onClick={() => toggleStaffActive(s)}
                                  className={`st-link-action${s.isActive ? ' danger' : ''}`}
                                >
                                  {s.isActive
                                    ? t('crm.settings.company.sessions.deactivate')
                                    : t('crm.settings.company.sessions.activate')}
                                </button>
                              ) : (
                                <span style={{ color: 'var(--fg-4)' }}>—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {isOwner && (
                <div className="st-panel">
                  <div className="st-panel-head">
                    <div className="pt"><span className="ic"><Icon d={D.laptop} size={14} /></span>{t('crm.settings.company.sessions.activeLoginsTitle')}</div>
                    <div className="pd" style={{ margin: 0 }}>{t('crm.settings.company.sessions.activeLoginsHint')}</div>
                  </div>
                  {sessionsLoading ? (
                    <div className="st-table-empty">{t('crm.settings.company.sessions.loading')}</div>
                  ) : orderedSessions.length === 0 ? (
                    <div className="st-table-empty">{t('crm.settings.company.sessions.noSessions')}</div>
                  ) : (
                    <div className="st-table-wrap">
                      <table className="st-table">
                        <thead>
                          <tr>
                            <th>{t('crm.settings.company.sessions.colName')}</th>
                            <th>{t('crm.settings.company.sessions.colEmail')}</th>
                            <th>{t('crm.settings.company.sessions.colIp')}</th>
                            <th>{t('crm.settings.company.sessions.colStarted')}</th>
                            <th>{t('crm.settings.company.sessions.colLastSeen')}</th>
                            <th>{t('crm.settings.company.sessions.colUserAgent')}</th>
                            <th>{t('crm.settings.company.sessions.colActions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderedSessions.map((row, idx) => {
                            const prev = orderedSessions[idx - 1];
                            const isFirstForUser = !prev || prev.userId !== row.userId;
                            const n = sessionCountByUser.get(row.userId) || 0;
                            const ua =
                              row.userAgent && row.userAgent.length > 60
                                ? `${row.userAgent.slice(0, 60)}…`
                                : row.userAgent || '—';
                            return (
                              <tr key={row.id}>
                                <td style={{ fontWeight: 500 }}>{row.userName || '—'}</td>
                                <td className="mono">{row.userEmail}</td>
                                <td className="mono">{row.ip || '—'}</td>
                                <td className="mono">{new Date(row.createdAt).toLocaleString(locale)}</td>
                                <td className="mono">{new Date(row.lastSeenAt).toLocaleString(locale)}</td>
                                <td style={{ fontSize: 11, color: 'var(--fg-3)' }} title={row.userAgent || ''}>{ua}</td>
                                <td>
                                  {isOwner ? (
                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                      <button type="button" onClick={() => void handleRevokeSession(row)} className="st-link-action danger">
                                        {t('crm.settings.company.sessions.revokeOne')}
                                      </button>
                                      {isFirstForUser && n > 1 && (
                                        <button type="button" onClick={() => void handleRevokeAllForUser(row.userId)} className="st-link-action danger">
                                          {t('crm.settings.company.sessions.revokeAll', { count: n })}
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <span style={{ color: 'var(--fg-4)' }}>—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                )}
              </div>
            )}

            {tab === 'invites' && (
              <div className="st-panel">
                <div className="st-panel-head"><div className="pt"><span className="ic"><Icon d={D.mail} size={14} /></span>{t('crm.settings.company.tabs.invites')}</div></div>
                <div className="st-panel-body">
                  <p style={{ fontSize: 12.5, color: 'var(--fg-2)', marginBottom: isOwner ? 16 : 0 }}>
                    {t('crm.settings.company.invites.hint')}
                  </p>

                  {isOwner && (
                    <div className="st-invite-form">
                      <div className="ft">{t('crm.settings.company.invites.formTitle')}</div>
                      <div className="fd">{t('crm.settings.company.invites.formSubtitle')}</div>
                      <div className="ai-field-row" style={{ marginBottom: 12 }}>
                        <div className="ai-field" style={{ margin: 0 }}>
                          <label className="ai-label">{t('crm.settings.company.invites.fieldEmail')}</label>
                          <input
                            className="ai-input"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            type="email"
                            autoComplete="off"
                          />
                        </div>
                        <div className="ai-field" style={{ margin: 0 }}>
                          <label className="ai-label">{t('crm.settings.company.invites.fieldName')}</label>
                          <input
                            className="ai-input"
                            value={inviteFullName}
                            onChange={(e) => setInviteFullName(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="ai-field" style={{ marginBottom: 14, maxWidth: 320 }}>
                        <label className="ai-label">{t('crm.settings.company.invites.fieldRole')}</label>
                        <select
                          className="ai-select"
                          value={inviteRole}
                          onChange={(e) =>
                            setInviteRole(
                              e.target.value as Exclude<StaffRole, 'owner'>,
                            )
                          }
                        >
                          {inviteRoleOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        disabled={inviteSending || !inviteEmail.trim()}
                        onClick={() => void handleSendInvite()}
                        className="aib"
                      >
                        <Icon d={D.plus} size={15} />
                        {inviteSending
                          ? t('crm.settings.company.invites.sending')
                          : t('crm.settings.company.invites.send')}
                      </button>
                    </div>
                  )}

                  {invited.length === 0 ? (
                    <div className="st-table-empty">{t('crm.settings.company.invites.empty')}</div>
                  ) : (
                    <div className="st-table-wrap">
                      <table className="st-table">
                        <thead>
                          <tr>
                            <th>{t('crm.settings.company.invites.colEmail')}</th>
                            <th>{t('crm.settings.company.invites.colRole')}</th>
                            <th>{t('crm.settings.company.invites.colStatus')}</th>
                            {isOwner && <th>{t('crm.settings.company.invites.colActions')}</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {invited.map((s) => (
                            <tr key={s.id}>
                              <td className="mono">{s.email}</td>
                              <td>{t(`crm.staff.roles.${s.role}`, { defaultValue: s.role })}</td>
                              <td><span className="pr-badge draft">{s.inviteStatus}</span></td>
                              {isOwner && (
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => void handleResendInvite(s.id)}
                                    disabled={resendBusyId === s.id}
                                    className="st-link-action"
                                  >
                                    {resendBusyId === s.id
                                      ? t('crm.settings.company.invites.resending')
                                      : t('crm.settings.company.invites.resend')}
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'storage' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="st-panel">
                  <div className="st-panel-head"><div className="pt"><span className="ic"><Icon d={D.disk} size={14} /></span>{t('crm.settings.company.storage.usageTitle')}</div></div>
                  <div className="st-usage">
                    <p style={{ fontSize: 12.5, color: 'var(--fg-2)', marginBottom: 10 }}>{t('crm.settings.company.storage.tiersHint')}</p>
                    <div className="st-usage-num">
                      <strong>{formatBytes(used)}</strong>
                      {quota !== null && (
                        <>
                          {' '}/ <strong>{formatBytes(quota)}</strong>
                        </>
                      )}
                      {quota === null && (
                        <span style={{ marginLeft: 8, color: 'var(--fg-3)' }}>
                          ({t('crm.settings.company.storage.unlimitedPlan')})
                        </span>
                      )}
                    </div>
                    {quota !== null && (
                      <div className="st-usage-bar"><div className="fill" style={{ width: `${pct}%` }} /></div>
                    )}
                    <div className="st-usage-hint">{t('crm.settings.company.storage.extraHint')}</div>
                    <div style={{ marginTop: 14 }}>
                      <button type="button" onClick={() => navigate('/billing')} className="aib sm">
                        <Icon d={D.card} size={14} />{t('crm.settings.company.storage.buyMore')}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="st-panel">
                  <div className="st-panel-head">
                    <div className="pt"><span className="ic"><Icon d={D.file} size={14} /></span>{t('crm.settings.company.storage.filesTitle')}</div>
                    <div className="pd" style={{ margin: 0 }}>{t('crm.settings.company.storage.filesHint')}</div>
                  </div>
                  {!data?.canDeleteTenantStorage && (
                    <p style={{ padding: '10px 18px 0', fontSize: 11, color: 'var(--fg-3)' }}>
                      {t('crm.settings.company.storage.deleteRolesHint')}
                    </p>
                  )}
                  {storageFilesLoading ? (
                    <div className="st-table-empty">{t('crm.settings.company.storage.loadingFiles')}</div>
                  ) : storageFiles.length === 0 ? (
                    <div className="st-table-empty">{t('crm.settings.company.storage.noFiles')}</div>
                  ) : (
                    <div className="st-table-wrap">
                      <table className="st-table">
                        <thead>
                          <tr>
                            <th>{t('crm.settings.company.storage.colSource')}</th>
                            <th>{t('crm.settings.company.storage.colFile')}</th>
                            <th>{t('crm.settings.company.storage.colSize')}</th>
                            <th>{t('crm.settings.company.storage.colUploadedBy')}</th>
                            <th>{t('crm.settings.company.storage.colDate')}</th>
                            <th>{t('crm.settings.company.storage.colActions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {storageFiles.map((f) => (
                            <tr key={f.id}>
                              <td>{t(`crm.settings.company.storage.source.${f.source}`)}</td>
                              <td style={{ fontWeight: 500 }}>
                                {f.relativePath ? (
                                  <a
                                    href={tenantStorageFileHref(f.relativePath)}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: 'var(--ink)', textDecoration: 'underline' }}
                                  >
                                    {f.originalName}
                                  </a>
                                ) : (
                                  f.originalName
                                )}
                              </td>
                              <td className="mono">
                                {f.sizeBytes !== null && f.sizeBytes !== undefined
                                  ? formatBytes(f.sizeBytes)
                                  : '—'}
                              </td>
                              <td className="mono">{f.uploadedByEmail || '—'}</td>
                              <td className="mono">{new Date(f.createdAt).toLocaleString(locale)}</td>
                              <td>
                                {data?.canDeleteTenantStorage ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleStorageDelete(f.id)}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#f0c8cf] bg-white px-3 py-1.5 text-[12px] font-medium text-[#9a1f31] hover:bg-[#fbecef] hover:border-[#e8b4bb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    {t('crm.settings.company.storage.delete')}
                                  </button>
                                ) : (
                                  <span style={{ color: 'var(--fg-4)' }}>—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
