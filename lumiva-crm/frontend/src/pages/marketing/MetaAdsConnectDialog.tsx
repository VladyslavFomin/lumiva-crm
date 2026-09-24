// Подключение Meta Ads «одной кнопкой»: войти через Facebook → выбрать рекламные аккаунты → данные подтянутся сами.
// Ручной ввод access token остаётся запасным вариантом (ссылка внизу).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  connectMetaAdsAccounts,
  fetchMetaAdsAccounts,
  fetchMetaAdsOAuthStatus,
  startMetaAdsOAuth,
  type MetaAdsAccount,
  type MetaAdsOAuthStatus,
} from '../../api/marketing';
import { getLocale } from '../../i18n/utils';

const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-[#222] bg-[#222] px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40';
const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-[#e7e7e7] bg-white px-4 py-2.5 text-[13px] font-medium text-[#222] transition hover:border-[#222] disabled:cursor-not-allowed disabled:opacity-40';

type Result = { id: string; integrationId: string; rows: number; error?: string };

export const MetaAdsConnectDialog: React.FC<{
  onClose: () => void;
  /** Данные интеграций изменились — обновить список и счётчики. */
  onChanged: () => void;
  /** Запасной путь: ручной ввод access token. */
  onManual: () => void;
  /** Куда вернуть пользователя после входа в Facebook. */
  returnPath: string;
}> = ({ onClose, onChanged, onManual, returnPath }) => {
  const { t, i18n } = useTranslation();
  const locale = getLocale(i18n.language);
  const [status, setStatus] = useState<MetaAdsOAuthStatus | null>(null);
  const [accounts, setAccounts] = useState<MetaAdsAccount[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);

  const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const st = await fetchMetaAdsOAuthStatus();
      setStatus(st);
      if (st.connected && !st.expired) {
        const res = await fetchMetaAdsAccounts();
        setAccounts(res.accounts);
        // единственный ещё не подключённый аккаунт выбираем сразу
        const fresh = res.accounts.filter((a) => !a.connectedIntegrationId);
        setPicked(fresh.length === 1 ? new Set([fresh[0].id]) : new Set());
      }
    } catch (e) {
      setError(errMsg(e, t('crm.marketingIntegrations.metaOauth.loadError')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const startOAuth = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await startMetaAdsOAuth(returnPath);
      window.location.href = url;
    } catch (e) {
      setError(errMsg(e, t('crm.marketingIntegrations.metaOauth.startError')));
      setBusy(false);
    }
  };

  const connect = async () => {
    if (!accounts) return;
    const chosen = accounts.filter((a) => picked.has(a.id));
    if (!chosen.length) return;
    setBusy(true);
    setError(null);
    try {
      const res = await connectMetaAdsAccounts(chosen);
      setResults(res.results);
      onChanged();
    } catch (e) {
      setError(errMsg(e, t('crm.marketingIntegrations.metaOauth.connectError')));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const selectable = useMemo(() => (accounts || []).filter((a) => !a.connectedIntegrationId), [accounts]);
  const needsConnect = !!status && (!status.connected || status.expired);
  const nameOf = (id: string) => accounts?.find((a) => a.id === id)?.name || id;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });

  return createPortal(
    <div
      className="fixed inset-0 z-[8600] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex max-h-[calc(100vh-32px)] w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] border border-[#e7e7e7] bg-white shadow-[0_24px_64px_rgba(0,0,0,0.14)]">
        <div className="flex items-center gap-3 border-b border-[#f0f0f0] px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#0866FF] text-[15px] font-semibold text-white">M</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold leading-snug text-[#222]">{t('crm.marketingIntegrations.metaOauth.title')}</h2>
            <div className="truncate text-[11.5px] text-[#888]">{t('crm.marketingIntegrations.providers.meta_ads')}</div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-[#888] transition-colors hover:bg-[#f0f0f0] hover:text-[#222]" aria-label={t('crm.marketingIntegrations.metaOauth.close')}>
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && <div className="mb-3 rounded-[10px] border border-[#e8b4bb] bg-[#fbecef] px-3 py-2.5 text-[12.5px] leading-relaxed text-[#9a1f31]">{error}</div>}

          {loading && <div className="py-8 text-center text-[13px] text-[#888]">{t('crm.marketingIntegrations.metaOauth.loading')}</div>}

          {!loading && status && !status.configured && (
            <div className="rounded-[10px] bg-[#fafafa] px-3 py-3 text-[13px] leading-relaxed text-[#555]">{t('crm.marketingIntegrations.metaOauth.notConfigured')}</div>
          )}

          {/* шаг 1: войти через Facebook */}
          {!loading && status?.configured && needsConnect && !results && (
            <div>
              {status.expired && <div className="mb-3 rounded-[10px] border border-[#ecdcbd] bg-[#fdf8ef] px-3 py-2.5 text-[12.5px] text-[#7a5411]">{t('crm.marketingIntegrations.metaOauth.expired')}</div>}
              <p className="text-[13px] leading-relaxed text-[#444]">{t('crm.marketingIntegrations.metaOauth.intro')}</p>
              <ol className="mt-3 space-y-2 text-[12.5px] text-[#555]">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#e7e7e7] font-mono text-[10px] text-[#888]">{i + 1}</span>
                    <span>{t(`crm.marketingIntegrations.metaOauth.steps.${i}`)}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[11.5px] leading-relaxed text-[#888]">{t('crm.marketingIntegrations.metaOauth.permissionsNote')}</p>
            </div>
          )}

          {/* шаг 2: выбор рекламных аккаунтов */}
          {!loading && status?.configured && !needsConnect && accounts && !results && (
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[13.5px] font-semibold text-[#222]">{t('crm.marketingIntegrations.metaOauth.pickTitle')}</h3>
                {selectable.length > 1 && (
                  <button type="button" className="text-[12px] text-[#555] underline underline-offset-2 hover:text-[#222]" onClick={() => setPicked(picked.size === selectable.length ? new Set() : new Set(selectable.map((a) => a.id)))}>
                    {picked.size === selectable.length ? t('crm.marketingIntegrations.metaOauth.clearAll') : t('crm.marketingIntegrations.metaOauth.selectAll')}
                  </button>
                )}
              </div>
              <p className="mt-1 text-[12px] text-[#888]">{t('crm.marketingIntegrations.metaOauth.pickHint')}</p>
              {status?.expiresAt && <p className="mt-1 text-[11.5px] text-[#aaa]">{t('crm.marketingIntegrations.metaOauth.accessUntil', { date: fmtDate(status.expiresAt) })}</p>}

              {accounts.length === 0 ? (
                <div className="mt-3 rounded-[10px] bg-[#fafafa] px-3 py-3 text-[13px] leading-relaxed text-[#555]">{t('crm.marketingIntegrations.metaOauth.empty')}</div>
              ) : (
                <ul className="mt-3 divide-y divide-[#f0f0f0] rounded-[12px] border border-[#e7e7e7]">
                  {accounts.map((a) => {
                    const done = !!a.connectedIntegrationId;
                    return (
                      <li key={a.id}>
                        <label className={`flex items-center gap-3 px-3 py-2.5 ${done ? 'cursor-default' : 'cursor-pointer hover:bg-[#fafafa]'}`}>
                          <input type="checkbox" className="h-4 w-4 accent-[#222]" disabled={done || busy} checked={done || picked.has(a.id)} onChange={() => toggle(a.id)} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-[#222]">{a.name}</span>
                            <span className="block truncate font-mono text-[10.5px] text-[#888]">
                              act_{a.id}
                              {a.currency ? ` · ${a.currency}` : ''}
                              {a.business ? ` · ${a.business}` : ''}
                            </span>
                          </span>
                          {done && <span className="rounded-full border border-[#cfe6da] bg-[#f4faf6] px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-[#1e6b46]">{t('crm.marketingIntegrations.metaOauth.connectedTag')}</span>}
                          {!done && a.status !== null && a.status !== 1 && <span className="rounded-full border border-[#ecdcbd] bg-[#fdf8ef] px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-[#a06a08]">{t('crm.marketingIntegrations.metaOauth.inactiveTag')}</span>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* итог */}
          {results && (
            <div>
              <h3 className="text-[13.5px] font-semibold text-[#222]">{t('crm.marketingIntegrations.metaOauth.doneTitle')}</h3>
              <ul className="mt-3 space-y-2">
                {results.map((r) => (
                  <li key={r.id} className={`rounded-[10px] border px-3 py-2.5 text-[12.5px] leading-relaxed ${r.error ? 'border-[#e8b4bb] bg-[#fbecef] text-[#9a1f31]' : 'border-[#cfe6da] bg-[#f4faf6] text-[#17704b]'}`}>
                    <b className="font-semibold">{nameOf(r.id)}</b>
                    <div>{r.error ? t('crm.marketingIntegrations.metaOauth.doneError', { error: r.error }) : t('crm.marketingIntegrations.metaOauth.doneRows', { count: r.rows })}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f0f0f0] bg-[#fafafa] px-5 py-3">
          {!results ? (
            <button type="button" className="text-[12px] text-[#888] underline underline-offset-2 hover:text-[#222]" onClick={onManual} disabled={busy}>
              {t('crm.marketingIntegrations.metaOauth.manual')}
            </button>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-2">
            {results ? (
              <button type="button" className={btnPrimary} onClick={onClose}>
                {t('crm.marketingIntegrations.metaOauth.done')}
              </button>
            ) : (
              <>
                <button type="button" className={btnSecondary} onClick={onClose} disabled={busy}>
                  {t('crm.marketingIntegrations.metaOauth.close')}
                </button>
                {status?.configured && needsConnect && (
                  <button type="button" className={btnPrimary} onClick={() => void startOAuth()} disabled={busy}>
                    {t('crm.marketingIntegrations.metaOauth.connect')}
                  </button>
                )}
                {status?.configured && !needsConnect && accounts && (
                  <>
                    <button type="button" className={btnSecondary} onClick={() => void startOAuth()} disabled={busy}>
                      {t('crm.marketingIntegrations.metaOauth.reconnect')}
                    </button>
                    <button type="button" className={btnPrimary} onClick={() => void connect()} disabled={busy || picked.size === 0}>
                      {busy ? t('crm.marketingIntegrations.metaOauth.connecting') : t('crm.marketingIntegrations.metaOauth.connectN', { count: picked.size })}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/** Срок действия OAuth-доступа Meta на карточке интеграции: за 7 дней и после истечения подсвечивается. */
export const MetaTokenBadge: React.FC<{ expiresAt: string }> = ({ expiresAt }) => {
  const { t, i18n } = useTranslation();
  const locale = getLocale(i18n.language);
  const ms = new Date(expiresAt).getTime();
  if (Number.isNaN(ms)) return null;
  const days = Math.ceil((ms - Date.now()) / 864e5);
  const expired = ms <= Date.now();
  const soon = !expired && days <= 7;
  const date = new Date(ms).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  return (
    <div className="flex flex-col gap-[3px]">
      <span className="font-mono text-[8.5px] uppercase tracking-[0.06em] text-[#888] pl-0.5">{t('crm.marketingIntegrations.metaOauth.badge.label')}</span>
      <span
        className={`inline-flex h-[34px] items-center rounded-lg border px-2.5 text-[12px] ${
          expired
            ? 'border-[#e8b4bb] bg-[#fbecef] text-[#9a1f31]'
            : soon
              ? 'border-[#ecdcbd] bg-[#fdf8ef] text-[#7a5411]'
              : 'border-[#e7e7e7] bg-white text-[#555]'
        }`}
        title={t('crm.marketingIntegrations.metaOauth.badge.hint')}
      >
        {expired ? t('crm.marketingIntegrations.metaOauth.badge.expired', { date }) : soon ? t('crm.marketingIntegrations.metaOauth.badge.soon', { count: days, date }) : t('crm.marketingIntegrations.metaOauth.badge.until', { date })}
      </span>
    </div>
  );
};
