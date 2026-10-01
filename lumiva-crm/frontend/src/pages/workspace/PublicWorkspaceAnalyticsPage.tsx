import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ProjectsAnalyticsPage } from '../projects/ProjectsAnalyticsPage';
import { mapWorkspaceRecordsToItems } from '../../dashboard/workspaceAnalyticsItems';
import type { CustomObjectField, CustomObjectRecord } from '../../api/customObjects';
import {
  PublicShareError,
  fetchPublicFxRates,
  fetchPublicShareData,
  fetchPublicShareInfo,
  geocodePublicShare,
  unlockPublicShare,
  type PublicShareData,
  type PublicShareInfo,
} from '../../api/workspaceShare';

/** /workspace/:clientKey/:objectId/analytics — публичная аналитика таблицы по ссылке.
 * Без авторизации и без меню CRM; зритель может смотреть, фильтровать и переключать вкладки,
 * но ничего не сохраняет и не меняет. */
export const PublicWorkspaceAnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const { clientKey = '', objectId = '' } = useParams();
  const tokenKey = `ws_share_token_${objectId}`;
  const [info, setInfo] = useState<PublicShareInfo | null>(null);
  const [data, setData] = useState<PublicShareData | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [needPassword, setNeedPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const loadData = useCallback(
    async (token: string | null) => {
      try {
        const next = await fetchPublicShareData(clientKey, objectId, token);
        setData(next);
        setNeedPassword(false);
      } catch (e) {
        const err = e as PublicShareError;
        if (err.status === 401) {
          try {
            sessionStorage.removeItem(tokenKey);
          } catch {
            // ignore
          }
          setNeedPassword(true);
          return;
        }
        setError({ status: err.status || 0, message: err.message });
      }
    },
    [clientKey, objectId, tokenKey],
  );

  useEffect(() => {
    let alive = true;
    fetchPublicShareInfo(clientKey, objectId)
      .then((res) => {
        if (!alive) return;
        setInfo(res);
        let token: string | null = null;
        try {
          token = sessionStorage.getItem(tokenKey);
        } catch {
          token = null;
        }
        if (res.requiresPassword && !token) {
          setNeedPassword(true);
          return;
        }
        void loadData(token);
      })
      .catch((e: PublicShareError) => {
        if (alive) setError({ status: e.status || 0, message: e.message });
      });
    return () => {
      alive = false;
    };
  }, [clientKey, objectId, tokenKey, loadData]);

  useEffect(() => {
    const title = data?.object.name || info?.name;
    if (title) document.title = `${title} · ${t('crm.projects.analytics.share.publicTitle')}`;
  }, [data, info, t]);

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) return;
    setUnlocking(true);
    setPasswordError(null);
    try {
      const { token } = await unlockPublicShare(clientKey, objectId, password);
      if (token) {
        try {
          sessionStorage.setItem(tokenKey, token);
        } catch {
          // ignore
        }
      }
      await loadData(token);
    } catch (e) {
      const err = e as PublicShareError;
      setPasswordError(
        err.status === 429
          ? t('crm.projects.analytics.share.tooManyAttempts')
          : err.status === 401
            ? t('crm.projects.analytics.share.wrongPassword')
            : err.message,
      );
    } finally {
      setUnlocking(false);
    }
  };

  const items = useMemo(
    () =>
      data
        ? mapWorkspaceRecordsToItems(
            data.records as unknown as CustomObjectRecord[],
            data.fields as unknown as CustomObjectField[],
          )
        : [],
    [data],
  );
  const analyticsFields = useMemo(
    () => (data?.fields || []).map((field) => ({ key: field.key, label: field.label, type: field.type })),
    [data],
  );
  const header = useMemo(
    () => ({
      kicker: t('crm.workspace.analytics.kicker'),
      title: t('crm.workspace.analytics.title', { name: data?.object.name || '' }),
      subtitle: data?.companyName || '',
    }),
    [data, t],
  );
  const publicView = useMemo(
    () =>
      data
        ? {
            layouts: data.layouts,
            primaryCurrency: data.primaryCurrency,
            companyName: data.companyName,
            fetchRates: fetchPublicFxRates,
            expiresAt: info?.expiresAt ?? null,
            geocode: (queries: string[], country?: string) => {
              let token: string | null = null;
              try {
                token = sessionStorage.getItem(tokenKey);
              } catch {
                token = null;
              }
              return geocodePublicShare(clientKey, objectId, token, queries, country);
            },
          }
        : undefined,
    [data, info, clientKey, objectId, tokenKey],
  );

  const centered = (children: React.ReactNode) => (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f7f9] px-4 text-[#222]">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_30px_80px_rgba(0,0,0,0.08)]">
        {children}
      </div>
    </div>
  );

  if (error) {
    return centered(
      <>
        <h1 className="text-lg font-semibold tracking-[-0.02em]">
          {error.status === 410
            ? t('crm.projects.analytics.share.expiredTitle')
            : t('crm.projects.analytics.share.unavailableTitle')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          {error.status === 410
            ? t('crm.projects.analytics.share.expiredText')
            : t('crm.projects.analytics.share.unavailableText')}
        </p>
      </>,
    );
  }

  if (needPassword) {
    return centered(
      <form onSubmit={submitPassword}>
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-400">{info?.companyName}</div>
        <h1 className="mt-1 text-lg font-semibold tracking-[-0.02em]">{info?.name}</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">{t('crm.projects.analytics.share.passwordPrompt')}</p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t('crm.projects.analytics.share.password')}
          className="mt-4 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
        />
        {passwordError && <div className="mt-2 text-xs text-rose-600">{passwordError}</div>}
        <button type="submit" disabled={!password || unlocking} className="btn-primary mt-4 w-full justify-center">
          {unlocking ? '…' : t('crm.projects.analytics.share.open')}
        </button>
      </form>,
    );
  }

  if (!data || !publicView) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f9] text-sm text-neutral-400">
        {t('crm.common.loading', { defaultValue: 'Загрузка…' })}
      </div>
    );
  }

  return (
    <ProjectsAnalyticsPage
      externalItems={items}
      analyticsFields={analyticsFields}
      storageNamespace={data.storageNamespace}
      header={header}
      workspaceObjectId={objectId}
      dashboardPresetSource="workspace"
      dashboardPresetRef={objectId}
      publicView={publicView}
    />
  );
};
