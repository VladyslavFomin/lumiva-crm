// frontend/src/pages/settings/SettingsApiPage.tsx
import React, { useEffect, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchMarketingApiToken,
  regenerateMarketingApiToken,
} from '../../api/marketing';

export const SettingsApiPage: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetchMarketingApiToken()
      .then((t) => setToken(t))
      .catch((e: any) => {
        console.error(e);
        setError(
          e?.message || 'Не удалось загрузить API-токен для маркетинга',
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleRotate = async () => {
    if (!confirm('Пересоздать токен? Старый перестанет работать.')) return;

    setRotating(true);
    setError(null);
    try {
      const newToken = await regenerateMarketingApiToken();
      setToken(newToken);
    } catch (e: any) {
      console.error(e);
      setError(
        e?.message || 'Не удалось пересоздать API-токен для маркетинга',
      );
    } finally {
      setRotating(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-5 md:space-y-6 pb-10">
        <section>
          <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
            Настройки · API и интеграции
          </div>
          <h1 className="text-lg md:text-xl font-semibold text-slate-50">
            API для импорта маркетингового трафика
          </h1>
          <p className="mt-1 text-xs text-slate-400 max-w-2xl">
            Этот токен позволяет отправлять данные трафика и рекламы в CRM из
            n8n, Google Apps Script и других интеграций. У каждого предприятия
            свой токен, данные не пересекаются между компаниями.
          </p>
        </section>

        <section className="rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4 md:p-5 space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-50">
                Маркетинг: импорт трафика
              </h2>
              <p className="text-[11px] text-slate-500 max-w-xl">
                Используйте этот токен в заголовке{' '}
                <span className="font-mono text-slate-300">
                  X-Api-Token
                </span>{' '}
                при запросах на{' '}
                <span className="font-mono text-slate-300">
                  POST /v1/marketing/traffic/import
                </span>
                . Все строки трафика будут автоматически привязаны к вашей
                компании (tenant).
              </p>
            </div>

            <button
              type="button"
              onClick={handleRotate}
              disabled={rotating || loading}
              className={
                'inline-flex items-center justify-center rounded-xl border px-3 py-1.5 text-[11px] transition ' +
                (rotating
                  ? 'border-slate-700 text-slate-400 cursor-wait'
                  : 'border-rose-500/60 text-rose-200 hover:bg-rose-500/10')
              }
            >
              {rotating ? 'Пересоздание…' : 'Пересоздать токен'}
            </button>
          </div>

          {loading && (
            <div className="text-[11px] text-slate-500">
              Загружаем токен…
            </div>
          )}

          {error && (
            <div className="text-[11px] text-red-400">{error}</div>
          )}

          {!loading && !error && (
            <>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="marketing-token"
                  className="text-[11px] text-slate-400"
                >
                  Текущий токен
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-[11px] font-mono text-slate-100 break-all">
                    {token || '—'}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!token}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-700/80 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-900/70 disabled:opacity-50"
                  >
                    {copied ? 'Скопировано' : 'Копировать'}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950/80 border border-slate-800/80 px-3 py-3 text-[11px] text-slate-400 space-y-1.5">
                <div className="font-semibold text-slate-200">
                  Пример запроса из n8n / curl
                </div>
                <pre className="text-[10px] leading-snug text-slate-300 overflow-auto">
{`POST https://crm.lumiva.agency/v1/marketing/traffic/import
Headers:
  Content-Type: application/json
  X-Api-Token: ${token || '<ВАШ_ТОКЕН>'}

Body:
{
  "items": [
    {
      "date": "2025-11-01",
      "source": "google",
      "medium": "cpc",
      "campaign": "brand_search",
      "sessions": 120,
      "clicks": 95,
      "leads": 8,
      "cost": 57.3,
      "revenue": 1350,
      "currency": "EUR"
    }
  ]
}`}
                </pre>
              </div>
            </>
          )}
        </section>
      </div>
    </MainLayout>
  );
};