// src/pages/telegram-crm/TelegramBotFormPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fetchTelegramBot,
  createTelegramBot,
  updateTelegramBot,
  fetchTelegramBotRecipients,
  createTelegramBotRecipient,
  deleteTelegramBotRecipient,
  type TelegramStaffRecipient,
} from '../../api/telegram-crm';
import { fetchStaff, type StaffUser } from '../../api/staff';

export const TelegramBotFormPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedToken, setLoadedToken] = useState<string>('');
  const [tokenVisible, setTokenVisible] = useState(false);

  // Recipients state
  const [recipients, setRecipients] = useState<TelegramStaffRecipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [addingRecipient, setAddingRecipient] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newChatId, setNewChatId] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [recipientSaving, setRecipientSaving] = useState(false);

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
      setRecipientsLoading(true);
      fetchTelegramBotRecipients(id)
        .then((r) => setRecipients(r))
        .finally(() => setRecipientsLoading(false));
      fetchStaff()
        .then((list) => setStaffUsers(list.filter((u) => u.isActive !== false)))
        .catch(() => {});
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      setLoading(true);
      fetchTelegramBot(id)
        .then((bot) => {
          setLoadedToken(bot.botToken || '');
          setFormData({
            botToken: '',
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
        const updateData: any = {};
        if (formData.botToken) updateData.botToken = formData.botToken;
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

  const handleAddRecipient = async () => {
    if (!id || !newUserId || !newChatId.trim()) return;
    const staffUser = staffUsers.find((u) => u.id === newUserId);
    setRecipientSaving(true);
    try {
      const created = await createTelegramBotRecipient(id, {
        staffUserId: newUserId,
        staffUserName: staffUser?.fullName || staffUser?.email || newUserId,
        telegramChatId: newChatId.trim(),
        telegramUsername: newUsername.trim() || undefined,
      });
      setRecipients((prev) => [...prev, created]);
      setNewUserId('');
      setNewChatId('');
      setNewUsername('');
      setAddingRecipient(false);
    } catch (e: any) {
      setError(e.message || 'Ошибка при добавлении получателя');
    } finally {
      setRecipientSaving(false);
    }
  };

  const handleDeleteRecipient = async (recipientId: string) => {
    if (!id) return;
    try {
      await deleteTelegramBotRecipient(id, recipientId);
      setRecipients((prev) => prev.filter((r) => r.id !== recipientId));
    } catch (e: any) {
      setError(e.message || 'Ошибка при удалении получателя');
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-sm text-text-secondary">{t('crm.telegram.bots.loading')}</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-5 max-w-2xl">
        {/* Header */}
        <div className="page-header mb-0">
          <div>
            <h1 className="page-title">
              {id ? t('crm.telegram.form.titleEdit') : t('crm.telegram.form.titleNew')}
            </h1>
            <p className="page-subtitle">{t('crm.telegram.form.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/telegram')}
            className="btn-ghost"
          >
            {t('crm.telegram.form.actions.cancel')}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="text-xs text-status-error bg-status-error-bg border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Main info card */}
          <div className="card p-5 space-y-4">
            <p className="section-label">{t('crm.telegram.form.sections.basic')}</p>

            {/* Bot Token */}
            <div className="form-group">
              <label className="form-label">
                {t('crm.telegram.form.fields.botToken')}
                {!id && (
                  <span className="ml-1.5 text-text-tertiary font-normal">
                    ({t('crm.telegram.form.hints.getFromBotFather')})
                  </span>
                )}
              </label>

              {/* Masked token display (edit mode) */}
              {id && loadedToken && (
                <div className="flex items-center gap-2 px-3 py-2 mb-1 bg-surface-subtle border border-border-default rounded-xl">
                  <span className="flex-1 text-xs font-mono text-[#111827] tracking-widest select-all">
                    {tokenVisible
                      ? loadedToken
                      : `${'•'.repeat(Math.max(0, loadedToken.length - 5))}${loadedToken.slice(-5)}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTokenVisible((v) => !v)}
                    className="btn-icon"
                    title={tokenVisible ? 'Скрыть' : 'Показать токен'}
                  >
                    {tokenVisible ? (
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><path d="M1 1l22 22"/>
                      </svg>
                    ) : (
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              )}

              <input
                type="text"
                required={!id}
                value={formData.botToken}
                onChange={(e) => handleChange('botToken', e.target.value)}
                className="base-input"
                placeholder={id ? t('crm.telegram.form.hints.tokenLeaveEmpty') : t('crm.telegram.form.hints.tokenPlaceholder')}
              />
              {id && (
                <p className="form-hint">{t('crm.telegram.form.hints.tokenLeaveEmpty')}</p>
              )}
            </div>

            {/* Bot Name */}
            <div className="form-group">
              <label className="form-label">{t('crm.telegram.form.fields.name')}</label>
              <input
                type="text"
                value={formData.botName}
                onChange={(e) => handleChange('botName', e.target.value)}
                className="base-input"
                placeholder="Мой CRM бот"
              />
            </div>

            {/* Bot Username */}
            <div className="form-group">
              <label className="form-label">{t('crm.telegram.form.fields.botUsername')}</label>
              <input
                type="text"
                value={formData.botUsername}
                onChange={(e) => handleChange('botUsername', e.target.value)}
                className="base-input"
                placeholder="my_crm_bot"
              />
            </div>

            {/* Webhook URL */}
            <div className="form-group">
              <label className="form-label">{t('crm.telegram.form.fields.webhookUrl')}</label>
              <input
                type="url"
                value={formData.webhookUrl}
                onChange={(e) => handleChange('webhookUrl', e.target.value)}
                className="base-input"
                placeholder="https://crm.example.com/v1/telegram-crm/webhook/<bot-token>"
              />
              <p className="form-hint">{t('crm.telegram.form.hints.webhookAuto')}</p>
            </div>

            {/* Welcome Message */}
            <div className="form-group">
              <label className="form-label">{t('crm.telegram.form.fields.welcomeMessage')}</label>
              <textarea
                value={formData.welcomeMessage}
                onChange={(e) => handleChange('welcomeMessage', e.target.value)}
                rows={3}
                className="base-textarea"
                placeholder="Добро пожаловать! Я помогу вам с вопросами по CRM."
              />
            </div>

            {/* Status toggle */}
            <div className="flex items-center justify-between pt-1 border-t border-border-default">
              <div>
                <div className="form-label">{t('crm.telegram.form.fields.status')}</div>
                <p className="form-hint">{t('crm.telegram.form.hints.activeOnly')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => handleChange('isActive', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:bg-lumiva-accent transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
              </label>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate('/app/telegram')}
              className="btn-ghost"
            >
              {t('crm.telegram.form.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              {saving
                ? t('crm.telegram.form.actions.saving')
                : id
                  ? t('crm.telegram.form.actions.save')
                  : t('crm.telegram.form.actions.create')}
            </button>
          </div>
        </form>

        {/* Recipients section (edit mode only) */}
        {id && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-label mb-0.5">Получатели уведомлений</p>
                <p className="form-hint">
                  Сотрудники, которым бот будет отправлять сообщения из автоматизаций
                </p>
              </div>
              {!addingRecipient && (
                <button
                  type="button"
                  onClick={() => setAddingRecipient(true)}
                  className="btn-secondary-sm"
                >
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14"/><path d="M5 12h14"/>
                  </svg>
                  Добавить
                </button>
              )}
            </div>

            {recipientsLoading && (
              <p className="text-sm text-text-secondary">Загрузка…</p>
            )}

            {/* Recipient rows */}
            {!recipientsLoading && recipients.length > 0 && (
              <div className="space-y-1.5">
                {recipients.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 px-3 py-2.5 bg-surface-subtle border border-border-default rounded-xl"
                  >
                    <div className="w-7 h-7 rounded-full bg-neutral-200 border border-border-default flex items-center justify-center text-[11px] font-semibold text-text-secondary flex-shrink-0">
                      {(r.staffUserName || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-[#111827] truncate">{r.staffUserName}</div>
                      <div className="text-[10px] text-text-secondary flex items-center gap-2 mt-0.5">
                        <span className="font-mono">chat_id: {r.telegramChatId}</span>
                        {r.telegramUsername && <span>@{r.telegramUsername}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteRecipient(r.id)}
                      className="btn-icon-danger"
                      title="Удалить получателя"
                    >
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!recipientsLoading && recipients.length === 0 && !addingRecipient && (
              <p className="text-sm text-text-secondary text-center py-3">
                Получатели не настроены. Сотрудник должен написать боту /start, чтобы получить chat ID.
              </p>
            )}

            {/* Add recipient form */}
            {addingRecipient && (
              <div className="border border-border-default rounded-xl p-4 space-y-3 bg-surface-subtle">
                <p className="section-label mb-0">Новый получатель</p>

                <div className="form-group">
                  <label className="form-label">Сотрудник</label>
                  <select
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    className="base-select"
                  >
                    <option value="">— выберите сотрудника —</option>
                    {staffUsers
                      .filter((u) => !recipients.some((r) => r.staffUserId === u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName || u.email}{u.department ? ` · ${u.department}` : ''}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Telegram Chat ID <span className="text-status-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={newChatId}
                    onChange={(e) => setNewChatId(e.target.value)}
                    placeholder="123456789"
                    className="base-input font-mono"
                  />
                  <p className="form-hint">
                    Пусть сотрудник напишет боту /start — бот ответит его chat_id. Или используйте @userinfobot.
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">@username (необязательно)</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="username"
                    className="base-input"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAddingRecipient(false);
                      setNewUserId('');
                      setNewChatId('');
                      setNewUsername('');
                    }}
                    className="btn-ghost"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleAddRecipient}
                    disabled={!newUserId || !newChatId.trim() || recipientSaving}
                    className="btn-primary"
                  >
                    {recipientSaving ? 'Сохранение…' : 'Добавить'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};
