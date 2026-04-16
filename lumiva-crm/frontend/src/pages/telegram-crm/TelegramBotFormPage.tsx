// src/pages/telegram-crm/TelegramBotFormPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchTelegramBot, createTelegramBot, updateTelegramBot } from '../../api/telegram-crm';

export const TelegramBotFormPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    botToken: string;
    botName?: string;
    botUsername?: string;
    webhookUrl?: string;
    welcomeMessage?: string;
    isActive?: boolean;
  }>({
    botToken: '',
    botName: '',
    botUsername: '',
    webhookUrl: '',
    welcomeMessage: '',
    isActive: true,
  });

  useEffect(() => {
    if (id) {
      setLoading(true);
      fetchTelegramBot(id)
        .then((bot) => {
          setFormData({
            botToken: '', // Не показываем токен при редактировании
            botName: bot.botName || '',
            botUsername: bot.botUsername || '',
            webhookUrl: bot.webhookUrl || '',
            welcomeMessage: bot.welcomeMessage || '',
            isActive: bot.status === 'active',
          });
        })
        .catch((e) => {
          setError(e.message || t('crm.telegram.form.errors.loadFailed'));
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (id) {
        // При обновлении отправляем только измененные поля
        const updateData: any = {};
        if (formData.botToken) {
          updateData.botToken = formData.botToken;
        }
        if (formData.botName !== undefined) updateData.botName = formData.botName;
        if (formData.botUsername !== undefined) updateData.botUsername = formData.botUsername;
        if (formData.webhookUrl !== undefined) updateData.webhookUrl = formData.webhookUrl;
        if (formData.welcomeMessage !== undefined) updateData.welcomeMessage = formData.welcomeMessage;
        if (formData.isActive !== undefined) updateData.isActive = formData.isActive;
        await updateTelegramBot(id, updateData);
      } else {
        await createTelegramBot(formData);
      }
      navigate('/app/telegram');
    } catch (err: any) {
      setError(err.message || t('crm.telegram.form.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-xs text-slate-400">{t('crm.telegram.bots.loading')}</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-50">
              {id ? t('crm.telegram.form.titleEdit') : t('crm.telegram.form.titleNew')}
            </h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.telegram.form.subtitle')}
            </div>
          </div>
          <button
            onClick={() => navigate('/app/telegram')}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-50 transition-colors"
          >
            {t('crm.telegram.form.actions.cancel')}
          </button>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Основная информация */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-4">
            <h2 className="text-xs font-semibold text-slate-300 mb-3">{t('crm.telegram.form.sections.basic')}</h2>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">
                {t('crm.telegram.form.fields.botToken')}
                {!id && (
                  <span className="ml-2 text-slate-500 text-[10px]">
                    ({t('crm.telegram.form.hints.getFromBotFather')})
                  </span>
                )}
              </label>
              <input
                type="text"
                required={!id}
                value={formData.botToken}
                onChange={(e) => handleChange('botToken', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                placeholder={id ? t('crm.telegram.form.hints.tokenLeaveEmpty') : t('crm.telegram.form.hints.tokenPlaceholder')}
              />
              {id && (
                <div className="text-[10px] text-slate-500 mt-1">{t('crm.telegram.form.hints.tokenLeaveEmpty')}</div>
              )}
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.telegram.form.fields.name')}</label>
              <input
                type="text"
                value={formData.botName}
                onChange={(e) => handleChange('botName', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                placeholder="Мой CRM бот"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.telegram.form.fields.botUsername')}</label>
              <input
                type="text"
                value={formData.botUsername}
                onChange={(e) => handleChange('botUsername', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                placeholder="my_crm_bot"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.telegram.form.fields.webhookUrl')}</label>
              <input
                type="url"
                value={formData.webhookUrl}
                onChange={(e) => handleChange('webhookUrl', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                placeholder="https://crm.example.com/v1/telegram-crm/webhook/<bot-token>"
              />
              <div className="text-[10px] text-slate-500 mt-1">
                {t('crm.telegram.form.hints.webhookAuto')}
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.telegram.form.fields.welcomeMessage')}</label>
              <textarea
                value={formData.welcomeMessage}
                onChange={(e) => handleChange('welcomeMessage', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors resize-none"
                placeholder="Добро пожаловать! Я помогу вам с вопросами по CRM."
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.telegram.form.fields.status')}</label>
                <div className="text-[10px] text-slate-500">{t('crm.telegram.form.hints.activeOnly')}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => handleChange('isActive', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
              </label>
            </div>
          </div>

          {/* Кнопки действий */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate('/app/telegram')}
              className="px-4 py-2 text-xs text-slate-400 hover:text-slate-50 transition-colors"
            >
              {t('crm.telegram.form.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? t('crm.telegram.form.actions.saving') : id ? t('crm.telegram.form.actions.save') : t('crm.telegram.form.actions.create')}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};

