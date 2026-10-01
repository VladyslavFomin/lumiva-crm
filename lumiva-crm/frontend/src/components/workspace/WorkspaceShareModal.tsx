import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchWorkspaceShare,
  saveWorkspaceShare,
  workspaceShareUrl,
  type WorkspaceShareSettings,
} from '../../api/workspaceShare';

type ExpiryChoice = 'never' | '1d' | '7d' | '30d' | 'custom';

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

/** «Поделиться» аналитикой таблицы: публичная ссылка, пароль (необязательно), срок действия. */
export const WorkspaceShareModal: React.FC<{ objectId: string; onClose: () => void }> = ({ objectId, onClose }) => {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<WorkspaceShareSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usePassword, setUsePassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [expiry, setExpiry] = useState<ExpiryChoice>('never');
  const [customDate, setCustomDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchWorkspaceShare(objectId)
      .then((res) => {
        setSettings(res);
        setUsePassword(res.hasPassword);
        if (res.expiresAt) {
          setExpiry('custom');
          setCustomDate(toDateInput(res.expiresAt));
        }
      })
      .catch((e) => setLoadError(e?.message || 'Error'));
  }, [objectId]);

  const url = settings?.clientKey ? workspaceShareUrl(settings.clientKey, objectId) : '';
  const isActive = Boolean(settings?.enabled);
  const isExpired = Boolean(settings?.expiresAt && new Date(settings.expiresAt).getTime() < Date.now());

  const computeExpiresAt = (): string | null => {
    const now = Date.now();
    if (expiry === 'never') return null;
    if (expiry === '1d') return new Date(now + 86400000).toISOString();
    if (expiry === '7d') return new Date(now + 7 * 86400000).toISOString();
    if (expiry === '30d') return new Date(now + 30 * 86400000).toISOString();
    if (!customDate) return null;
    // До конца выбранного дня по местному времени.
    const [y, m, d] = customDate.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59).toISOString();
  };

  const passwordRequired = usePassword && (!settings?.hasPassword || changingPassword);

  const save = async (enabled: boolean) => {
    setError(null);
    if (enabled && passwordRequired && password.length < 4) {
      setError(t('crm.projects.analytics.share.passwordTooShort'));
      return;
    }
    if (enabled && expiry === 'custom' && !customDate) {
      setError(t('crm.projects.analytics.share.pickDate'));
      return;
    }
    setSaving(true);
    try {
      const body: { enabled: boolean; password?: string | null; expiresAt?: string | null } = { enabled };
      if (enabled) {
        body.expiresAt = computeExpiresAt();
        if (!usePassword) body.password = null;
        else if (passwordRequired) body.password = password;
      }
      const next = await saveWorkspaceShare(objectId, body);
      setSettings(next);
      setPassword('');
      setChangingPassword(false);
      setUsePassword(next.hasPassword);
      if (enabled && next.clientKey) {
        void navigator.clipboard?.writeText(workspaceShareUrl(next.clientKey, objectId)).then(
          () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          },
          () => {},
        );
      }
    } catch (e: any) {
      setError(e?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const copy = () => {
    if (!url) return;
    void navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => window.prompt(t('crm.projects.analytics.share.link'), url),
    );
  };

  const expiryOptions: Array<{ id: ExpiryChoice; label: string }> = [
    { id: 'never', label: t('crm.projects.analytics.share.expiryNever') },
    { id: '1d', label: t('crm.projects.analytics.share.expiry1d') },
    { id: '7d', label: t('crm.projects.analytics.share.expiry7d') },
    { id: '30d', label: t('crm.projects.analytics.share.expiry30d') },
    { id: 'custom', label: t('crm.projects.analytics.share.expiryCustom') },
  ];
  const labelCls = 'block text-xs font-medium uppercase tracking-[0.12em] text-neutral-400';
  const inputCls = 'w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400';

  return (
    <div className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 text-[#222] shadow-[0_30px_80px_rgba(0,0,0,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.02em]">{t('crm.projects.analytics.share.title')}</h3>
            <p className="mt-1 text-sm leading-6 text-neutral-500">{t('crm.projects.analytics.share.subtitle')}</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {loadError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</div>
        ) : !settings ? (
          <div className="mt-6 text-sm text-neutral-400">…</div>
        ) : (
          <>
            {isActive && (
              <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={labelCls}>{t('crm.projects.analytics.share.link')}</span>
                  <span
                    className={
                      isExpired
                        ? 'rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700'
                        : 'rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700'
                    }
                  >
                    {isExpired ? t('crm.projects.analytics.share.statusExpired') : t('crm.projects.analytics.share.statusActive')}
                  </span>
                </div>
                <div className="mt-2 flex gap-2">
                  <input readOnly value={url} className={`${inputCls} box-border min-w-0 bg-white font-mono text-xs`} onFocus={(e) => e.target.select()} />
                  <button type="button" className="btn-secondary shrink-0" onClick={copy}>
                    {copied ? t('crm.projects.analytics.share.copied') : t('crm.projects.analytics.share.copy')}
                  </button>
                </div>
                <div className="mt-2 text-xs text-neutral-500">
                  {settings.hasPassword ? t('crm.projects.analytics.share.withPassword') : t('crm.projects.analytics.share.withoutPassword')}
                  {' · '}
                  {settings.expiresAt
                    ? t('crm.projects.analytics.share.until', {
                        date: new Date(settings.expiresAt).toLocaleDateString(i18n.language),
                      })
                    : t('crm.projects.analytics.share.expiryNever')}
                </div>
              </div>
            )}

            <div className="mt-4 space-y-2">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="lv-checkbox-input"
                  checked={usePassword}
                  onChange={(event) => {
                    setUsePassword(event.target.checked);
                    setChangingPassword(false);
                    setPassword('');
                  }}
                />
                {t('crm.projects.analytics.share.protect')}
              </label>
              {usePassword &&
                (settings.hasPassword && !changingPassword ? (
                  <div className="flex items-center gap-2 pl-[26px] text-sm text-neutral-500">
                    {t('crm.projects.analytics.share.passwordSet')}
                    <button type="button" className="text-[#1769d1] hover:underline" onClick={() => setChangingPassword(true)}>
                      {t('crm.projects.analytics.share.changePassword')}
                    </button>
                  </div>
                ) : (
                  <div className="pl-[26px]">
                    <input
                      type="text"
                      autoComplete="new-password"
                      value={password}
                      maxLength={128}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={t('crm.projects.analytics.share.passwordPlaceholder')}
                      className={`${inputCls} box-border block min-w-0`}
                    />
                  </div>
                ))}
            </div>

            <div className="mt-4">
              <span className={labelCls}>{t('crm.projects.analytics.share.expiry')}</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {expiryOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setExpiry(option.id)}
                    className={
                      expiry === option.id
                        ? 'rounded-lg bg-[#222] px-3 py-1.5 text-xs text-white'
                        : 'rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:border-neutral-300'
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {expiry === 'custom' && (
                <input
                  type="date"
                  value={customDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setCustomDate(event.target.value)}
                  className={`${inputCls} box-border mt-2 block max-w-[200px]`}
                />
              )}
            </div>

            <p className="mt-4 text-xs leading-5 text-neutral-500">{t('crm.projects.analytics.share.viewerNote')}</p>

            {error && <div className="mt-3 text-sm text-rose-600">{error}</div>}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              {isActive ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => save(false)}
                  className="text-sm text-rose-600 hover:underline disabled:opacity-50"
                >
                  {t('crm.projects.analytics.share.disable')}
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="btn-secondary">
                  {t('crm.projects.analytics.tabs.cancel')}
                </button>
                <button type="button" disabled={saving} onClick={() => save(true)} className="btn-primary">
                  {saving
                    ? '…'
                    : isActive
                      ? t('crm.projects.analytics.share.update')
                      : t('crm.projects.analytics.share.submit')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
