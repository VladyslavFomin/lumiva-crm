// src/pages/telegram-crm/TelegramBotsPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchTelegramBots, deleteTelegramBot, type TelegramBot } from '../../api/telegram-crm';
import { useAlertModal } from '../../contexts/AlertModalContext';

export const TelegramBotsPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
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
      showAlert(err.message || t('crm.telegram.bots.errors.deleteFailed'), {
        variant: 'error',
      });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="page-header mb-0">
          <div>
            <h1 className="page-title">{t('crm.telegram.bots.title')}</h1>
            <p className="page-subtitle">{t('crm.telegram.bots.subtitle')}</p>
          </div>
          <button onClick={handleCreate} className="btn-primary">
            + {t('crm.telegram.bots.create')}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="text-xs text-status-error bg-status-error-bg border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && !error && (
          <div className="text-sm text-text-secondary py-6 text-center">{t('crm.telegram.bots.loading')}</div>
        )}

        {/* Empty state */}
        {!loading && !error && bots.length === 0 && (
          <div className="card p-12 text-center">
            <div className="text-sm font-medium text-[#111827] mb-1">{t('crm.telegram.bots.empty')}</div>
            <div className="text-xs text-text-secondary mb-5">
              {t('crm.telegram.bots.emptyHint')}
            </div>
            <button onClick={handleCreate} className="btn-primary">
              {t('crm.telegram.bots.createFirst')}
            </button>
          </div>
        )}

        {/* Bot list */}
        {!loading && !error && bots.length > 0 && (
          <div className="grid gap-3">
            {bots.map((bot) => (
              <div key={bot.id} className="card p-4 hover:shadow-card-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Title and status */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-[#111827] truncate">
                        {bot.botName || bot.botUsername || 'Без имени'}
                      </h3>
                      {bot.botUsername && (
                        <span className="text-xs text-text-secondary flex-shrink-0">
                          @{bot.botUsername}
                        </span>
                      )}
                      <span
                        className={`flex-shrink-0 ${
                          bot.status === 'active' ? 'badge-active' : 'badge-error'
                        }`}
                      >
                        {bot.status === 'active'
                          ? t('crm.telegram.form.statuses.active')
                          : t('crm.telegram.form.statuses.inactive')}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="space-y-0.5 text-[11px] text-text-secondary">
                      {bot.webhookUrl && (
                        <div>
                          <span className="text-text-tertiary">Webhook:</span>{' '}
                          <span className="text-text-secondary">{bot.webhookUrl}</span>
                        </div>
                      )}
                      {bot.welcomeMessage && (
                        <div>
                          <span className="text-text-tertiary">Приветствие:</span>{' '}
                          <span className="text-text-secondary">{bot.welcomeMessage}</span>
                        </div>
                      )}
                      {bot.lastError && (
                        <div className="text-status-error text-[10px] mt-1">
                          Ошибка: {bot.lastError}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => handleEdit(bot.id)} className="btn-secondary-sm">
                      {t('crm.telegram.bots.edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(bot.id)}
                      className="btn-icon-danger"
                      title={t('crm.telegram.bots.delete')}
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"/>
                      </svg>
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
