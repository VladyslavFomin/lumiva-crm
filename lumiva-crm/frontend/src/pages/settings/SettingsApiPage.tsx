// frontend/src/pages/settings/SettingsApiPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchMarketingApiTokenMasked,
  revealMarketingApiToken,
  regenerateMarketingApiToken,
  type MarketingApiTokenMasked,
} from '../../api/marketing';
import { fetchCompanySettings } from '../../api/settings';
import { API_BASE } from '../../api/client';
import '../projects/ProjectsListPage.css';

function resolvePublicApiBase(): string {
  const b = API_BASE.replace(/\/$/, '');
  if (typeof window === 'undefined') return b || '/v1';
  if (b.startsWith('http')) return b;
  return `${window.location.origin}${b.startsWith('/') ? '' : '/'}${b}`;
}

export const SettingsApiPage: React.FC = () => {
  const { t } = useTranslation();
  const [masked, setMasked] = useState<MarketingApiTokenMasked | null>(null);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [modalMode, setModalMode] = useState<'reveal' | 'rotate' | null>(null);
  const [password, setPassword] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalBusy, setModalBusy] = useState(false);

  const apiBaseUrl = useMemo(() => resolvePublicApiBase(), []);
  const [clientKey, setClientKey] = useState<string | null>(null);

  useEffect(() => {
    fetchCompanySettings()
      .then((s) => setClientKey(s.clientKey))
      .catch(() => {});
  }, []);

  const loadMasked = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchMarketingApiTokenMasked()
      .then((m) => setMasked(m))
      .catch((e: unknown) => {
        console.error(e);
        const msg =
          e && typeof e === 'object' && 'message' in e
            ? String((e as { message?: string }).message)
            : '';
        setError(msg || t('crm.settings.api.errors.load'));
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    loadMasked();
  }, [loadMasked]);

  const displayValue = revealedToken ?? masked?.preview ?? '—';
  const tokenForDocs = revealedToken ?? t('crm.settings.api.tokenPlaceholder');

  const handleCopy = async () => {
    if (!revealedToken) return;
    try {
      await navigator.clipboard.writeText(revealedToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const openModal = (mode: 'reveal' | 'rotate') => {
    setModalMode(mode);
    setPassword('');
    setModalError(null);
  };

  const closeModal = () => {
    if (modalBusy) return;
    setModalMode(null);
    setPassword('');
    setModalError(null);
  };

  const submitModal = async () => {
    if (!modalMode) return;
    const pwd = password.trim();
    if (!pwd) {
      setModalError(t('crm.settings.api.errors.passwordRequired'));
      return;
    }
    setModalBusy(true);
    setModalError(null);
    try {
      if (modalMode === 'reveal') {
        const full = await revealMarketingApiToken(pwd);
        setRevealedToken(full);
        closeModal();
      } else {
        const full = await regenerateMarketingApiToken(pwd);
        setRevealedToken(full);
        await loadMasked();
        closeModal();
      }
    } catch (e: unknown) {
      const status =
        e && typeof e === 'object' && 'status' in e ? Number((e as { status: number }).status) : 0;
      if (status === 403) {
        setModalError(t('crm.settings.api.errors.wrongPassword'));
      } else {
        const msg =
          e && typeof e === 'object' && 'message' in e
            ? String((e as { message?: string }).message)
            : '';
        setModalError(
          modalMode === 'rotate'
            ? msg || t('crm.settings.api.errors.rotate')
            : msg || t('crm.settings.api.errors.reveal'),
        );
      }
    } finally {
      setModalBusy(false);
    }
  };

  const curlExample = `curl -sS -X POST "${apiBaseUrl}/marketing/traffic/import" \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Token: ${tokenForDocs}" \\
  -d '{"items":[{"date":"2025-11-01","source":"google","medium":"cpc","campaign":"brand","sessions":120,"clicks":95,"leads":8,"cost":57.3,"revenue":1350,"currency":"EUR"}]}'`;

  const curlExampleProductsIngest = `curl -sS -X POST "${apiBaseUrl}/public/products/ingest" \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Token: ${tokenForDocs}" \\
  -H "X-Idempotency-Key: order-48213" \\
  -d '{"sku":"TSHIRT-001","name":"T-Shirt","price":29.9,"currency":"EUR","barcode":"4820000123456","tags":["summer","cotton"],"weight":0.2,"dimensions":{"length":30,"width":20,"height":2,"unit":"cm"},"variants":[{"sku":"TSHIRT-001-RED-M","quantity":12,"priceOverride":32.9}]}'`;

  const curlExampleProductsStock = `curl -sS -X PATCH "${apiBaseUrl}/public/products/stock" \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Token: ${tokenForDocs}" \\
  -d '{"variantSku":"TSHIRT-001-RED-M","delta":-1}'`;

  const publicCatalogClientKey = clientKey || t('crm.settings.api.tokenPlaceholder');
  const curlExamplePublicCatalog = `curl -sS "${apiBaseUrl}/public/catalog/${publicCatalogClientKey}/products"`;

  return (
    <MainLayout>
      <div
        className="lv-pt w-full pb-10 min-w-0"
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
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--fg-4)',
                marginBottom: 6,
              }}
            >
              {t('crm.settings.api.sectionLabel')}
            </div>
            <h1>{t('crm.settings.api.title')}</h1>
            <div className="sub max-w-2xl">{t('crm.settings.api.subtitle')}</div>
          </div>
        </div>

        {error ? (
          <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-[8px] px-3 py-2 mb-[14px]">
            {error}
          </div>
        ) : null}

        <section className="rounded-[10px] border border-[var(--line-2)] bg-white p-4 md:p-6 shadow-sm space-y-5 mb-[14px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--ink)]">
                {t('crm.settings.api.cardTitle')}
              </h2>
              <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-[var(--fg-3)]">
                {t('crm.settings.api.cardHint')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openModal('rotate')}
              disabled={loading}
              className="lv-tb-btn shrink-0 border-rose-200 text-rose-800 hover:border-rose-400 hover:bg-rose-50"
            >
              {t('crm.settings.api.rotate')}
            </button>
          </div>

          {loading ? (
            <div className="text-[12px] text-[var(--fg-3)]">{t('crm.settings.api.loading')}</div>
          ) : (
            <>
              <div className="space-y-2">
                <label htmlFor="tenant-api-token" className="text-[11px] font-medium text-[var(--fg-3)]">
                  {t('crm.settings.api.tokenLabel')}
                </label>
                <div className="flex flex-wrap items-stretch gap-2">
                  <div
                    id="tenant-api-token"
                    className="min-h-[40px] flex-1 min-w-0 rounded-lg border border-[var(--line-2)] bg-[var(--bg-muted)] px-3 py-2 font-mono text-[12px] leading-relaxed text-[var(--ink)] break-all"
                  >
                    {displayValue}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!revealedToken ? (
                      <button
                        type="button"
                        onClick={() => openModal('reveal')}
                        className="lv-tb-btn px-2.5"
                        title={t('crm.settings.api.showToken')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRevealedToken(null)}
                        className="lv-tb-btn px-2.5"
                        title={t('crm.settings.api.hideToken')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                          <path d="M1 1l22 22" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCopy}
                      disabled={!revealedToken}
                      title={
                        revealedToken ? t('crm.settings.api.copy') : t('crm.settings.api.copyDisabledHint')
                      }
                      className="lv-tb-btn px-2.5 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--fg-3)]">{t('crm.settings.api.tokenSecurityHint')}</p>
                {copied ? (
                  <div className="text-[11px] font-medium text-emerald-700">{t('crm.settings.api.copied')}</div>
                ) : null}
              </div>

              <div className="rounded-[10px] border border-[var(--line-2)] bg-[var(--bg-soft)] px-3 py-3 space-y-3">
                <div className="text-[12px] font-semibold text-[var(--ink)]">{t('crm.settings.api.usageTitle')}</div>
                <p className="text-[11px] leading-relaxed text-[var(--fg-3)]">{t('crm.settings.api.usageBody')}</p>
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-[var(--fg-2)]">
                  <li>{t('crm.settings.api.usageBulletTraffic')}</li>
                  <li>{t('crm.settings.api.usageBulletWp')}</li>
                  <li>{t('crm.settings.api.usageBulletProducts')}</li>
                  <li>{t('crm.settings.api.usageBulletOther')}</li>
                </ul>
              </div>

              <div className="rounded-[10px] border border-[var(--line-2)] bg-[var(--bg-muted)] px-3 py-3 space-y-2">
                <div className="text-[12px] font-semibold text-[var(--ink)]">{t('crm.settings.api.exampleTitle')}</div>
                <p className="text-[11px] leading-relaxed text-[var(--fg-3)]">
                  {t('crm.settings.api.exampleIntro', { baseUrl: apiBaseUrl })}
                </p>
                <pre className="text-[10px] leading-snug text-[var(--ink)] overflow-auto max-h-[280px] rounded-lg bg-white border border-[var(--line-2)] p-3 font-mono">
                  {curlExample}
                </pre>
              </div>

              <div className="rounded-[10px] border border-[var(--line-2)] bg-[var(--bg-muted)] px-3 py-3 space-y-2">
                <div className="text-[12px] font-semibold text-[var(--ink)]">{t('crm.settings.api.exampleTitleProducts')}</div>
                <p className="text-[11px] leading-relaxed text-[var(--fg-3)]">
                  {t('crm.settings.api.exampleIntroProducts')}
                </p>
                <pre className="text-[10px] leading-snug text-[var(--ink)] overflow-auto max-h-[280px] rounded-lg bg-white border border-[var(--line-2)] p-3 font-mono">
                  {curlExampleProductsIngest}
                </pre>
                <p className="text-[11px] leading-relaxed text-[var(--fg-3)]">
                  {t('crm.settings.api.exampleIntroProductsStock')}
                </p>
                <pre className="text-[10px] leading-snug text-[var(--ink)] overflow-auto max-h-[280px] rounded-lg bg-white border border-[var(--line-2)] p-3 font-mono">
                  {curlExampleProductsStock}
                </pre>
              </div>

              <div className="rounded-[10px] border border-[var(--line-2)] bg-[var(--bg-muted)] px-3 py-3 space-y-2">
                <div className="text-[12px] font-semibold text-[var(--ink)]">{t('crm.settings.api.exampleTitlePublicCatalog')}</div>
                <p className="text-[11px] leading-relaxed text-[var(--fg-3)]">
                  {t('crm.settings.api.exampleIntroPublicCatalog')}
                </p>
                <pre className="text-[10px] leading-snug text-[var(--ink)] overflow-auto max-h-[280px] rounded-lg bg-white border border-[var(--line-2)] p-3 font-mono">
                  {curlExamplePublicCatalog}
                </pre>
              </div>
            </>
          )}
        </section>
      </div>

      {modalMode ? (
        <div
          className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="api-token-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !modalBusy) closeModal();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--line-2)] bg-white p-5 shadow-xl">
            <h2 id="api-token-modal-title" className="text-[15px] font-semibold text-[var(--ink)]">
              {modalMode === 'reveal'
                ? t('crm.settings.api.modalRevealTitle')
                : t('crm.settings.api.modalRotateTitle')}
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--fg-3)]">
              {modalMode === 'reveal'
                ? t('crm.settings.api.modalRevealBody')
                : t('crm.settings.api.modalRotateBody')}
            </p>
            <label className="mt-4 block text-[11px] font-medium text-[var(--fg-3)]">
              {t('crm.settings.api.passwordLabel')}
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitModal();
              }}
              className="mt-1 w-full rounded-lg border border-[var(--line-2)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--ink)]"
            />
            {modalError ? (
              <div className="mt-2 text-[11px] text-rose-600">{modalError}</div>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="lv-tb-btn" onClick={closeModal} disabled={modalBusy}>
                {t('crm.settings.api.modalCancel')}
              </button>
              <button
                type="button"
                className="lv-tb-btn"
                style={{ background: '#222', color: '#fff', borderColor: '#222', borderRadius: 8 }}
                onClick={() => void submitModal()}
                disabled={modalBusy}
              >
                {modalBusy
                  ? t('crm.settings.api.modalSubmitting')
                  : t('crm.settings.api.modalConfirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </MainLayout>
  );
};
