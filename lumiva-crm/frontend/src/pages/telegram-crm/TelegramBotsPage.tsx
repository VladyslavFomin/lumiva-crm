// src/pages/telegram-crm/TelegramBotsPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchTelegramBots, deleteTelegramBot, type TelegramBot } from '../../api/telegram-crm';

export const TelegramBotsPage: React.FC = () => {
  const { t } = useTranslation();
  const [bots, setBots] = useState<TelegramBot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTelegramBots();
      setBots(data);
    } catch (e: any) {
      setError(e.message || t('crm.telegram.bots.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => navigate('/app/telegram/bots/new');
  const handleEdit = (id: string) => navigate(`/app/telegram/bots/${id}`);
  const handleDelete = async (id: string) => {
    if (!confirm(t('crm.telegram.bots.deleteConfirm'))) return;
    try {
      await deleteTelegramBot(id);
      setBots(bots.filter((b) => b.id !== id));
    } catch (err: any) {
      alert(err.message || t('crm.telegram.bots.errors.deleteFailed'));
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">{t('crm.telegram.bots.title')}</h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.telegram.bots.subtitle')}
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="px-3 py-1.5 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft transition-colors"
          >
            + {t('crm.telegram.bots.create')}
          </button>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Загрузка */}
        {loading && !error && (
          <div className="text-xs text-slate-400">{t('crm.telegram.bots.loading')}</div>
        )}

        {/* Пустое состояние */}
        {!loading && !error && bots.length === 0 && (
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-12 text-center">
            <div className="text-sm text-slate-400 mb-2">{t('crm.telegram.bots.empty')}</div>
            <div className="text-xs text-slate-500 mb-4">
              {t('crm.telegram.bots.emptyHint')}
            </div>
            <button
              onClick={handleCreate}
              className="px-4 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft transition-colors"
            >
              {t('crm.telegram.bots.createFirst')}
            </button>
          </div>
        )}

        {/* Список ботов */}
        {!loading && !error && bots.length > 0 && (
          <div className="grid gap-3">
            {bots.map((bot) => (
              <div
                key={bot.id}
                className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 hover:border-slate-700 hover:bg-slate-900/80 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Заголовок и статус */}
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-slate-50 truncate">
                        {bot.botName || bot.botUsername || 'Без имени'}
                      </h3>
                      {bot.botUsername && (
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          @{bot.botUsername}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-medium flex-shrink-0 ${
                          bot.status === 'active'
                            ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'
                            : 'bg-red-950/50 text-red-400 border border-red-800/50'
                        }`}
                      >
                        {bot.status === 'active' ? t('crm.telegram.form.statuses.active') : t('crm.telegram.form.statuses.inactive')}
                      </span>
                    </div>

                    {/* Информация */}
                    <div className="space-y-1 text-[11px] text-slate-400">
                      {bot.webhookUrl && (
                        <div>
                          <span className="text-slate-500">Webhook:</span>{' '}
                          <span className="text-slate-300">{bot.webhookUrl}</span>
                        </div>
                      )}
                      {bot.welcomeMessage && (
                        <div>
                          <span className="text-slate-500">Приветствие:</span>{' '}
                          <span className="text-slate-300">{bot.welcomeMessage}</span>
                        </div>
                      )}
                      {bot.lastError && (
                        <div className="text-red-400 text-[10px]">
                          Ошибка: {bot.lastError}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Действия */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(bot.id)}
                      className="px-2 py-1 text-[10px] bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      {t('crm.telegram.bots.edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(bot.id)}
                      className="px-2 py-1 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg transition-colors"
                    >
                      {t('crm.telegram.bots.delete')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};
