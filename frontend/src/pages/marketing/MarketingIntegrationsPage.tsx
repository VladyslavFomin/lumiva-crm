import React, { useEffect, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchMarketingIntegrations,
  createMarketingIntegration,
  updateMarketingIntegration,
  deleteMarketingIntegration,
  type MarketingIntegration,
} from '../../api/marketing';

const PROVIDER_LABEL: Record<string, string> = {
  google_analytics: 'Google Analytics 4',
  google_ads: 'Google Ads',
  yandex_metrika: 'Яндекс.Метрика',
  meta_ads: 'Meta Ads (Facebook/Instagram)',
  tiktok_ads: 'TikTok Ads',
};

export const MarketingIntegrationsPage: React.FC = () => {
  const [items, setItems] = useState<MarketingIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // форма добавления
  const [provider, setProvider] = useState('google_analytics');
  const [name, setName] = useState('Google Analytics 4');
  const [primaryId, setPrimaryId] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchMarketingIntegrations()
      .then(setItems)
      .catch((e: any) => {
        console.error(e);
        setError(e?.message || 'Не удалось загрузить интеграции');
      })
      .finally(() => setLoading(false));
  }, []);

  const onCreate = async () => {
    if (!name.trim()) {
      alert('Введите название интеграции');
      return;
    }

    setCreating(true);
    try {
      const created = await createMarketingIntegration({
        provider,
        name: name.trim(),
        primaryId: primaryId || undefined,
        kind: provider.endsWith('_ads') ? 'ads' : 'analytics',
        isActive: true,
      });
      setItems((prev) => [created, ...prev]);
      setPrimaryId('');
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Не удалось создать интеграцию');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (item: MarketingIntegration) => {
    const next = !item.isActive;
    try {
      const updated = await updateMarketingIntegration(item.id, {
        isActive: next,
      });
      setItems((prev) =>
        prev.map((it) => (it.id === updated.id ? updated : it)),
      );
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Не удалось обновить интеграцию');
    }
  };

  const remove = async (item: MarketingIntegration) => {
    if (!window.confirm(`Удалить интеграцию «${item.name}»?`)) return;
    try {
      await deleteMarketingIntegration(item.id);
      setItems((prev) => prev.filter((it) => it.id !== item.id));
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Не удалось удалить интеграцию');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        <section className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              Маркетинг · Интеграции
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              Интеграции маркетинга
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Здесь настраиваются аккаунты аналитики и рекламы (GA4, Метрика,
              Meta Ads, Google Ads и др.). Данные дальше используются в
              отчётах и n8n-сценариях.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)] md:gap-5">
          {/* Форма добавления */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 space-y-3 text-xs">
            <h2 className="text-sm font-semibold text-slate-50 mb-1">
              Добавить интеграцию
            </h2>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Провайдер
              </label>
              <select
                value={provider}
                onChange={(e) => {
                  const v = e.target.value;
                  setProvider(v);
                  setName(PROVIDER_LABEL[v] || v);
                }}
                className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
              >
                <option value="google_analytics">Google Analytics 4</option>
                <option value="yandex_metrika">Яндекс.Метрика</option>
                <option value="meta_ads">Meta Ads (Facebook/Instagram)</option>
                <option value="google_ads">Google Ads</option>
                <option value="tiktok_ads">TikTok Ads</option>
                <option value="other">Другое</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Название в CRM
              </label>
              <input
                className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Основной ID (property, counter, ad account и т.п.)
              </label>
              <input
                className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                value={primaryId}
                onChange={(e) => setPrimaryId(e.target.value)}
                placeholder="GA4 property ID / Counter ID / Ad Account ID"
              />
            </div>

            <button
              type="button"
              onClick={onCreate}
              disabled={creating}
              className="mt-2 w-full px-4 py-2 rounded-2xl bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {creating ? 'Создание…' : 'Создать интеграцию'}
            </button>

            <p className="mt-3 text-[10px] text-slate-500">
              Далее эти подключения можно будет использовать в n8n-флоу:
              вытягивать отчёты, синхронизировать аудитории и т.д.
            </p>
          </div>

          {/* Таблица интеграций */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 text-xs">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-50">
                  Текущие интеграции
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Включённые интеграции используются в маркетинговых отчётах.
                </p>
              </div>
              <span className="text-[11px] text-slate-500">
                Всего: {items.length}
              </span>
            </div>

            {loading && (
              <div className="text-[11px] text-slate-400">
                Загружаем интеграции…
              </div>
            )}

            {error && (
              <div className="text-[11px] text-red-400 mb-2">{error}</div>
            )}

            {!loading && !items.length && (
              <div className="text-[11px] text-slate-500">
                Интеграций пока нет. Добавьте хотя бы GA4 или Метрику.
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800/80 text-slate-400">
                    <th className="py-1.5 pr-3 text-left font-normal">
                      Название
                    </th>
                    <th className="py-1.5 px-3 text-left font-normal">
                      Провайдер
                    </th>
                    <th className="py-1.5 px-3 text-left font-normal">
                      Основной ID
                    </th>
                    <th className="py-1.5 px-3 text-center font-normal">
                      Статус
                    </th>
                    <th className="py-1.5 px-3 text-right font-normal">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr
                      key={it.id}
                      className="border-b border-slate-800/40 last:border-none hover:bg-slate-900/50 transition-colors"
                    >
                      <td className="py-1.5 pr-3 text-slate-100">
                        {it.name}
                      </td>
                      <td className="py-1.5 px-3 text-slate-300">
                        {PROVIDER_LABEL[it.provider] || it.provider}
                      </td>
                      <td className="py-1.5 px-3 text-slate-300">
                        {it.primaryId || '—'}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleActive(it)}
                          className={
                            'px-2 py-0.5 rounded-full text-[10px] border ' +
                            (it.isActive
                              ? 'border-emerald-500/60 text-emerald-300 bg-emerald-500/10'
                              : 'border-slate-600 text-slate-400 bg-slate-800')
                          }
                        >
                          {it.isActive ? 'Включена' : 'Выключена'}
                        </button>
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => remove(it)}
                          className="px-2 py-0.5 rounded-xl border border-rose-500/60 text-[10px] text-rose-300 hover:bg-rose-500/10"
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};