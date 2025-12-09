import React, { useEffect, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchMarketingAutomations,
  createMarketingAutomation,
  updateMarketingAutomation,
  deleteMarketingAutomation,
  type MarketingAutomation,
} from '../../api/marketing';

export const AutomationsPage: React.FC = () => {
  const [items, setItems] = useState<MarketingAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchMarketingAutomations()
      .then(setItems)
      .catch((e: any) => {
        console.error(e);
        setError(e?.message || 'Не удалось загрузить автоматизации');
      })
      .finally(() => setLoading(false));
  }, []);

  const onCreate = async () => {
    if (!name.trim()) {
      alert('Введите название сценария');
      return;
    }
    setCreating(true);
    try {
      const created = await createMarketingAutomation({
        name: name.trim(),
        type: 'n8n_webhook',
        webhookUrl: webhookUrl || undefined,
        isActive: true,
      });
      setItems((prev) => [created, ...prev]);
      setName('');
      setWebhookUrl('');
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Не удалось создать автоматизацию');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (item: MarketingAutomation) => {
    const next = !item.isActive;
    try {
      const updated = await updateMarketingAutomation(item.id, {
        isActive: next,
      });
      setItems((prev) =>
        prev.map((it) => (it.id === updated.id ? updated : it)),
      );
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Не удалось обновить автоматизацию');
    }
  };

  const remove = async (item: MarketingAutomation) => {
    if (!window.confirm(`Удалить сценарий «${item.name}»?`)) return;
    try {
      await deleteMarketingAutomation(item.id);
      setItems((prev) => prev.filter((it) => it.id !== item.id));
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Не удалось удалить автоматизацию');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        <section className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              Маркетинг · Автоматизации
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              Автоматизации маркетинга (n8n)
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Здесь можно зафиксировать все n8n-сценарии, которые связаны с
              маркетингом: импорты трафика, рассылки, синхронизацию аудиторий.
              Позже можно будет подтягивать статусы прямо из n8n API.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)] md:gap-5">
          {/* Форма добавления */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 space-y-3 text-xs">
            <h2 className="text-sm font-semibold text-slate-50 mb-1">
              Новый сценарий
            </h2>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Название сценария
              </label>
              <input
                className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Импорт GA4 → CRM (ежедневно)"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Webhook URL (из n8n)
              </label>
              <input
                className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://n8n.lumiva.agency/webhook/..."
              />
            </div>

            <button
              type="button"
              onClick={onCreate}
              disabled={creating}
              className="mt-2 w-full px-4 py-2 rounded-2xl bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {creating ? 'Создание…' : 'Создать сценарий'}
            </button>

            <p className="mt-3 text-[10px] text-slate-500">
              Для каждого сценария можно будет привязать токены (например,
              токен импорта трафика), расписание и статусы запусков.
            </p>
          </div>

          {/* Список сценариев */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 text-xs">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-50">
                  Текущие автоматизации
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Пока без связи с n8n API, но уже можно хранить описания и
                  вебхуки по каждому тенанту.
                </p>
              </div>
              <span className="text-[11px] text-slate-500">
                Всего: {items.length}
              </span>
            </div>

            {loading && (
              <div className="text-[11px] text-slate-400">
                Загружаем автоматизации…
              </div>
            )}

            {error && (
              <div className="text-[11px] text-red-400 mb-2">{error}</div>
            )}

            {!loading && !items.length && (
              <div className="text-[11px] text-slate-500">
                Пока нет ни одного сценария. Добавьте хотя бы импорт
                маркетингового трафика из n8n.
              </div>
            )}

            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="rounded-2xl border border-slate-800/90 bg-slate-900/70 px-3 py-2.5 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-slate-50">
                        {it.name}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {it.type} ·{' '}
                        {it.lastStatus ? `Последний статус: ${it.lastStatus}` : 'Статус пока неизвестен'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
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
                        {it.isActive ? 'Включен' : 'Выключен'}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(it)}
                        className="px-2 py-0.5 rounded-xl border border-rose-500/60 text-[10px] text-rose-300 hover:bg-rose-500/10"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                  {it.webhookUrl && (
                    <div className="text-[10px] text-slate-400 truncate">
                      {it.webhookUrl}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};