// src/pages/automations/AutomationFormPage.tsx
import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchAutomation, createAutomation, updateAutomation, type CreateAutomationDto, type TriggerEvent, type ActionType } from '../../api/automations';
import { fetchEmailAccounts, type EmailAccount, fetchEmailTemplates, type EmailTemplate } from '../../api/email';

export const AutomationFormPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(false);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState<boolean>(false);
  const reportCurrencies = ['EUR', 'USD', 'RUB'];

  const [formData, setFormData] = useState<CreateAutomationDto>({
    name: '',
    description: '',
    triggerEvent: 'contact.created' as TriggerEvent,
    conditions: [],
    actions: [{ type: 'trigger_webhook' as ActionType, config: {} }],
    isActive: true,
  });

  useEffect(() => {
    if (id) return;
    const params = new URLSearchParams(location.search);
    const entity = params.get('entity');
    const defaults: Record<string, TriggerEvent> = {
      lead: 'lead.created',
      project: 'project.created',
      sale: 'sale.created',
    };
    if (entity && defaults[entity]) {
      setFormData((prev) => ({ ...prev, triggerEvent: defaults[entity] }));
    }
  }, [id, location.search]);

  // Загружаем email аккаунты и шаблоны
  useEffect(() => {
    setLoadingAccounts(true);
    fetchEmailAccounts()
      .then((accounts) => {
        setEmailAccounts(accounts);
      })
      .catch((e) => {
        console.error('Ошибка загрузки email аккаунтов:', e);
      })
      .finally(() => {
        setLoadingAccounts(false);
      });

    setLoadingTemplates(true);
    fetchEmailTemplates(true) // Только активные шаблоны
      .then((templates) => {
        setEmailTemplates(templates);
      })
      .catch((e) => {
        console.error('Ошибка загрузки шаблонов:', e);
      })
      .finally(() => {
        setLoadingTemplates(false);
      });
  }, []);

  useEffect(() => {
    if (id) {
      setLoading(true);
      fetchAutomation(id)
        .then((automation) => {
          console.log('Загружена автоматизация:', automation);
          console.log('Actions (raw):', automation.actions);
          console.log('Actions type:', typeof automation.actions);
          
          // Убеждаемся, что actions - это массив и правильно десериализован
          let actions: Array<{ type: string; config: Record<string, any> }> = [];
          
          if (Array.isArray(automation.actions)) {
            actions = automation.actions.map((action: any) => {
              console.log('Processing action:', action);
              // Убеждаемся, что type и config правильно извлечены
              const actionType = action.type || 'trigger_webhook';
              const actionConfig = action.config || {};
              
              console.log(`Action type: ${actionType}, config keys:`, Object.keys(actionConfig));
              
              return {
                type: actionType,
                config: actionConfig,
              };
            });
          } else if (automation.actions && typeof automation.actions === 'object') {
            // Если actions это объект, преобразуем в массив
            console.log('Actions is object, converting to array');
            const action = automation.actions as any;
            actions = [{
              type: action.type || 'trigger_webhook',
              config: action.config || {},
            }];
          } else {
            console.warn('Actions is not array or object:', automation.actions);
          }
          
          // Если actions пустой, создаем дефолтное действие
          if (actions.length === 0) {
            console.warn('Actions is empty, creating default action');
            actions = [{ type: 'trigger_webhook' as ActionType, config: {} }];
          }
          
          console.log('Actions (processed):', JSON.stringify(actions, null, 2));
          
          setFormData({
            name: automation.name,
            description: automation.description || '',
            triggerEvent: automation.triggerEvent,
            conditions: automation.conditions || [],
            actions: actions,
            isActive: automation.isActive,
            maxExecutions: automation.maxExecutions || undefined,
            cooldownSeconds: automation.cooldownSeconds || undefined,
          });
        })
        .catch((e) => {
          setError(e.message || t('crm.automations.form.errors.loadFailed'));
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
      // Убеждаемся, что actions правильно сформированы
      const submitData = {
        ...formData,
        actions: formData.actions.map((action) => {
          // Очищаем пустые значения из config, но сохраняем все заполненные поля
          const cleanConfig: Record<string, any> = {};
          if (action.config) {
            Object.keys(action.config).forEach((key) => {
              const value = action.config[key];
              // Сохраняем все значения, включая пустые строки для некоторых полей
              if (value !== null && value !== undefined) {
                cleanConfig[key] = value;
              }
            });
          }
          
          return {
            type: action.type,
            config: cleanConfig,
          };
        }),
      };
      console.log('Отправка данных автоматизации:', JSON.stringify(submitData, null, 2));
      console.log('Actions для отправки:', JSON.stringify(submitData.actions, null, 2));
      console.log('Количество actions:', submitData.actions.length);
      submitData.actions.forEach((action, idx) => {
        console.log(`Action ${idx}:`, {
          type: action.type,
          configKeys: Object.keys(action.config),
          config: action.config,
        });
      });
      
      if (id) {
        await updateAutomation(id, submitData);
      } else {
        await createAutomation(submitData);
      }
      navigate('/app/automations');
    } catch (err: any) {
      console.error('Ошибка сохранения автоматизации:', err);
      setError(err.message || t('crm.automations.form.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof CreateAutomationDto, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addAction = () => {
    setFormData((prev) => ({
      ...prev,
      actions: [...prev.actions, { type: 'trigger_webhook' as ActionType, config: {} }],
    }));
  };

  const removeAction = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }));
  };

  const updateAction = (index: number, field: string, value: any) => {
    setFormData((prev) => {
      const newActions = [...prev.actions];
      if (field === 'type') {
        // При смене типа действия сохраняем существующий config полностью
        // Пользователь может вернуться к предыдущему типу
        const currentConfig = newActions[index].config || {};
        newActions[index] = { 
          ...newActions[index], 
          type: value, 
          config: currentConfig, // Сохраняем весь config
        };
        console.log(`Изменен тип действия ${index} на ${value}, config сохранен:`, currentConfig);
      } else {
        // Обновляем поле в config
        const currentConfig = newActions[index].config || {};
        newActions[index] = { 
          ...newActions[index], 
          config: { 
            ...currentConfig, 
            [field]: value 
          } 
        };
        console.log(`Обновлено поле ${field} в действии ${index}:`, value);
      }
      console.log('Обновленные actions:', newActions);
      return { ...prev, actions: newActions };
    });
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-xs text-slate-400">{t('crm.automations.list.loading')}</div>
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
              {id ? t('crm.automations.form.titleEdit') : t('crm.automations.form.titleNew')}
            </h1>
            <div className="text-[11px] text-slate-500">
              {t('crm.automations.form.subtitle')}
            </div>
          </div>
          <button
            onClick={() => navigate('/app/automations')}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-50 transition-colors"
          >
            {t('crm.automations.form.actions.cancel')}
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
            <h2 className="text-xs font-semibold text-slate-300 mb-3">{t('crm.automations.form.sections.basic')}</h2>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.fields.name')}</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                placeholder="Например: Приветствие нового контакта"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.fields.description')}</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors resize-none"
                placeholder="Описание автоматизации (необязательно)"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.fields.trigger')}</label>
              <select
                required
                value={formData.triggerEvent}
                onChange={(e) => handleChange('triggerEvent', e.target.value as TriggerEvent)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
              >
                <optgroup label={t('crm.automations.form.triggerGroups.contacts')}>
                  <option value="contact.created">{t('crm.automations.form.triggers.CONTACT_CREATED')}</option>
                  <option value="contact.updated">{t('crm.automations.form.triggers.CONTACT_UPDATED')}</option>
                </optgroup>
                <optgroup label={t('crm.automations.form.triggerGroups.companies')}>
                  <option value="company.created">{t('crm.automations.form.triggers.COMPANY_CREATED')}</option>
                  <option value="company.updated">{t('crm.automations.form.triggers.COMPANY_UPDATED')}</option>
                </optgroup>
                <optgroup label={t('crm.automations.form.triggerGroups.leads')}>
                  <option value="lead.created">{t('crm.automations.form.triggers.LEAD_CREATED')}</option>
                  <option value="lead.updated">{t('crm.automations.form.triggers.LEAD_UPDATED')}</option>
                  <option value="lead.status_changed">{t('crm.automations.form.triggers.LEAD_STATUS_CHANGED')}</option>
                </optgroup>
                <optgroup label={t('crm.automations.form.triggerGroups.sales')}>
                  <option value="sale.created">{t('crm.automations.form.triggers.SALE_CREATED')}</option>
                  <option value="sale.updated">{t('crm.automations.form.triggers.SALE_UPDATED')}</option>
                  <option value="sale.status_changed">{t('crm.automations.form.triggers.SALE_STATUS_CHANGED')}</option>
                </optgroup>
                <optgroup label={t('crm.automations.form.triggerGroups.projects')}>
                  <option value="project.created">{t('crm.automations.form.triggers.PROJECT_CREATED')}</option>
                  <option value="project.status_changed">{t('crm.automations.form.triggers.PROJECT_STATUS_CHANGED')}</option>
                </optgroup>
                <optgroup label={t('crm.automations.form.triggerGroups.tasks')}>
                  <option value="task.created">{t('crm.automations.form.triggers.TASK_CREATED')}</option>
                  <option value="task.updated">{t('crm.automations.form.triggers.TASK_UPDATED')}</option>
                  <option value="task.status_changed">{t('crm.automations.form.triggers.TASK_STATUS_CHANGED')}</option>
                </optgroup>
                <optgroup label={t('crm.automations.form.triggerGroups.reports')}>
                  <option value="report.scheduled">{t('crm.automations.form.triggers.REPORT_SCHEDULED')}</option>
                </optgroup>
                <optgroup label={t('crm.automations.form.triggerGroups.email')}>
                  <option value="email.sent">{t('crm.automations.form.triggers.EMAIL_SENT')}</option>
                  <option value="email.received">{t('crm.automations.form.triggers.EMAIL_RECEIVED')}</option>
                </optgroup>
                <optgroup label={t('crm.automations.form.triggerGroups.telegram')}>
                  <option value="telegram.message_received">{t('crm.automations.form.triggers.TELEGRAM_MESSAGE_RECEIVED')}</option>
                </optgroup>
                <optgroup label={t('crm.automations.form.triggerGroups.notes')}>
                  <option value="note.created">{t('crm.automations.form.triggers.NOTE_CREATED')}</option>
                </optgroup>
              </select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.fields.active')}</label>
                <div className="text-[10px] text-slate-500">{t('crm.automations.form.hints.activeOnly')}</div>
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

          {/* Действия */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-semibold text-slate-300">{t('crm.automations.form.sections.actions')}</h2>
                <div className="text-[10px] text-slate-500 mt-0.5">{t('crm.automations.form.hints.actionsDesc')}</div>
              </div>
              <button
                type="button"
                onClick={addAction}
                className="px-3 py-1.5 text-[10px] rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft transition-colors"
              >
                + {t('crm.automations.form.actions.addAction')}
              </button>
            </div>

            {formData.actions.map((action, index) => (
              <div key={index} className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">{t('crm.automations.form.actions.action')} {index + 1}</span>
                  {formData.actions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAction(index)}
                      className="px-2 py-1 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg transition-colors"
                    >
                      {t('crm.automations.form.actions.removeAction')}
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.fields.actionType')}</label>
                  <select
                    value={action.type}
                    onChange={(e) => updateAction(index, 'type', e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                  >
                    <option value="trigger_webhook">Вызвать Webhook</option>
                    <option value="send_email">Отправить Email</option>
                    <option value="send_telegram">Отправить Telegram</option>
                    <option value="send_report">Отправить отчёт</option>
                    <option value="create_note">Создать заметку</option>
                    <option value="update_field">Обновить поле</option>
                    <option value="add_tag">Добавить тег</option>
                    <option value="change_status">Изменить статус</option>
                  </select>
                </div>

                {/* Webhook */}
                {action.type === 'trigger_webhook' && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.webhookAction.url')}</label>
                    <input
                      type="url"
                      value={action.config.url || ''}
                      onChange={(e) => updateAction(index, 'url', e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                      placeholder="https://example.com/webhook"
                    />
                  </div>
                )}

                {/* Email */}
                {action.type === 'send_email' && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.emailAction.account')}
                        {emailAccounts.length === 0 && !loadingAccounts && (
                          <span className="ml-2 text-red-400 text-[10px]">
                            ({t('crm.automations.form.emailAction.noAccounts')}. <a href="/app/email" className="underline hover:text-red-300">{t('crm.automations.form.emailAction.add')}</a>)
                          </span>
                        )}
                      </label>
                      {loadingAccounts ? (
                        <div className="text-xs text-slate-400 py-2">{t('crm.automations.form.emailAction.loadingAccounts')}</div>
                      ) : emailAccounts.length === 0 ? (
                        <div className="px-3 py-2 text-xs bg-slate-100 border border-slate-300 rounded-xl text-slate-600">
                          {t('crm.automations.form.emailAction.noAccounts')}. <a href="/app/email" className="text-blue-600 hover:underline">{t('crm.automations.form.emailAction.addAccount')}</a>
                        </div>
                      ) : (
                        <select
                          value={action.config.accountId || ''}
                          onChange={(e) => updateAction(index, 'accountId', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                          required
                        >
                          <option value="">{t('crm.automations.form.emailAction.selectAccount')}</option>
                          {emailAccounts
                            .filter((acc) => acc.status === 'active')
                            .map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.email} {account.name ? `(${account.name})` : ''}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.emailAction.to')}</label>
                      <input
                        type="email"
                        value={Array.isArray(action.config.to) ? action.config.to[0] : (action.config.to || '')}
                        onChange={(e) => {
                          const emailValue = e.target.value;
                          // Сохраняем как строку, бэкенд сам преобразует в массив если нужно
                          updateAction(index, 'to', emailValue);
                        }}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                        placeholder={t('crm.automations.form.emailAction.toPlaceholder')}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.emailAction.template')}
                        {emailTemplates.length === 0 && !loadingTemplates && (
                          <span className="ml-2 text-slate-500 text-[10px]">
                            ({t('crm.automations.form.emailAction.noTemplates')}. <a href="/app/marketing/email-templates" className="underline hover:text-slate-300">{t('crm.automations.form.emailAction.create')}</a>)
                          </span>
                        )}
                      </label>
                      {loadingTemplates ? (
                        <div className="text-xs text-slate-400 py-2">{t('crm.automations.form.emailAction.loadingTemplates')}</div>
                      ) : (
                        <select
                          value={action.config.templateId || ''}
                          onChange={(e) => {
                            const templateId = e.target.value;
                            updateAction(index, 'templateId', templateId || undefined);
                            // Если шаблон выбран, очищаем subject/textBody/htmlBody
                            if (templateId) {
                              updateAction(index, 'subject', undefined);
                              updateAction(index, 'textBody', undefined);
                              updateAction(index, 'htmlBody', undefined);
                            }
                          }}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                        >
                          <option value="">{t('crm.automations.form.emailAction.noTemplate')}</option>
                          {emailTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="text-[10px] text-slate-500 mt-1">
                        {t('crm.automations.form.emailAction.templateHint')}
                      </div>
                    </div>
                    {!action.config.templateId && (
                      <>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.emailAction.subject')}</label>
                          <input
                            type="text"
                            value={action.config.subject || ''}
                            onChange={(e) => updateAction(index, 'subject', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                            placeholder="Тема письма"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.emailAction.body')}</label>
                          <textarea
                            value={action.config.textBody || ''}
                            onChange={(e) => updateAction(index, 'textBody', e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors resize-none"
                            placeholder={t('crm.automations.form.emailAction.bodyPlaceholder')}
                          />
                        </div>
                      </>
                    )}
                    {action.config.templateId && (
                      <div className="px-3 py-2 text-[10px] text-slate-500 bg-slate-100 border border-slate-300 rounded-xl">
                        {t('crm.automations.form.emailAction.templateUsed')} "{emailTemplates.find(t => t.id === action.config.templateId)?.name || '...'}". 
                        {t('crm.automations.form.emailAction.templateUsedHint')}
                      </div>
                    )}
                  </div>
                )}

                {/* Telegram */}
                {action.type === 'send_telegram' && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.telegramAction.botId')}</label>
                      <input
                        type="text"
                        value={action.config.botId || ''}
                        onChange={(e) => updateAction(index, 'botId', e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                        placeholder="UUID бота"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.telegramAction.userId')}</label>
                      <input
                        type="text"
                        value={action.config.telegramUserId || ''}
                        onChange={(e) => updateAction(index, 'telegramUserId', e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                        placeholder="123456789"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.telegramAction.text')}</label>
                      <textarea
                        value={action.config.text || ''}
                        onChange={(e) => updateAction(index, 'text', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors resize-none"
                        placeholder="Текст сообщения"
                      />
                    </div>
                  </div>
                )}

                {/* Report */}
                {action.type === 'send_report' && (
                  <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.report.type')}</label>
                        <select
                          value={action.config.reportType || 'sales'}
                          onChange={(e) => updateAction(index, 'reportType', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                        >
                          <option value="sales">{t('crm.automations.form.report.types.sales')}</option>
                          <option value="leads">{t('crm.automations.form.report.types.leads')}</option>
                          <option value="projects">{t('crm.automations.form.report.types.projects')}</option>
                          <option value="tasks">{t('crm.automations.form.report.types.tasks')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.report.channel')}</label>
                        <select
                          value={action.config.channel || 'email'}
                          onChange={(e) => updateAction(index, 'channel', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                        >
                          <option value="email">{t('crm.automations.form.report.channels.email')}</option>
                          <option value="telegram">{t('crm.automations.form.report.channels.telegram')}</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.report.frequency')}</label>
                        <select
                          value={action.config.scheduleFrequency || 'weekly'}
                          onChange={(e) => updateAction(index, 'scheduleFrequency', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                        >
                          <option value="weekly">{t('crm.automations.form.report.frequencies.weekly')}</option>
                          <option value="monthly">{t('crm.automations.form.report.frequencies.monthly')}</option>
                          <option value="quarterly">{t('crm.automations.form.report.frequencies.quarterly')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.report.time')}</label>
                        <input
                          type="time"
                          value={action.config.scheduleTime || '09:00'}
                          onChange={(e) => updateAction(index, 'scheduleTime', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                        />
                      </div>
                    </div>

                    {(action.config.scheduleFrequency || 'weekly') === 'weekly' && (
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.report.dayOfWeek')}</label>
                        <select
                          value={action.config.scheduleDayOfWeek || 1}
                          onChange={(e) => updateAction(index, 'scheduleDayOfWeek', Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                        >
                          <option value={1}>{t('crm.automations.form.report.weekdays.mon')}</option>
                          <option value={2}>{t('crm.automations.form.report.weekdays.tue')}</option>
                          <option value={3}>{t('crm.automations.form.report.weekdays.wed')}</option>
                          <option value={4}>{t('crm.automations.form.report.weekdays.thu')}</option>
                          <option value={5}>{t('crm.automations.form.report.weekdays.fri')}</option>
                          <option value={6}>{t('crm.automations.form.report.weekdays.sat')}</option>
                          <option value={7}>{t('crm.automations.form.report.weekdays.sun')}</option>
                        </select>
                      </div>
                    )}

                    {(action.config.scheduleFrequency || 'weekly') !== 'weekly' && (
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.report.dayOfMonth')}</label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={action.config.scheduleDayOfMonth || 1}
                          onChange={(e) => updateAction(index, 'scheduleDayOfMonth', Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.report.timezone')}</label>
                      <input
                        type="text"
                        value={action.config.scheduleTimezone || 'UTC'}
                        onChange={(e) => updateAction(index, 'scheduleTimezone', e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                        placeholder="Europe/Moscow"
                      />
                    </div>

                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(action.config.formatPdf)}
                          onChange={(e) => updateAction(index, 'formatPdf', e.target.checked)}
                        />
                        PDF
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(action.config.formatXls)}
                          onChange={(e) => updateAction(index, 'formatXls', e.target.checked)}
                        />
                        XLSX
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(action.config.formatCsv)}
                          onChange={(e) => updateAction(index, 'formatCsv', e.target.checked)}
                        />
                        CSV
                      </label>
                    </div>

                    {action.config.channel !== 'telegram' && (
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.emailAction.account')}</label>
                          <select
                            value={action.config.accountId || ''}
                            onChange={(e) => updateAction(index, 'accountId', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                          >
                            <option value="">{t('crm.automations.form.emailAction.selectAccount')}</option>
                            {emailAccounts
                              .filter((acc) => acc.status === 'active')
                              .map((account) => (
                                <option key={account.id} value={account.id}>
                                  {account.email} {account.name ? `(${account.name})` : ''}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.report.emails')}</label>
                          <input
                            type="text"
                            value={action.config.to || ''}
                            onChange={(e) => updateAction(index, 'to', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                            placeholder="email1@example.com, email2@example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.report.subject')}</label>
                          <input
                            type="text"
                            value={action.config.subject || ''}
                            onChange={(e) => updateAction(index, 'subject', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                          />
                        </div>
                      </div>
                    )}

                    {action.config.channel === 'telegram' && (
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.telegramAction.botId')}</label>
                          <input
                            type="text"
                            value={action.config.botId || ''}
                            onChange={(e) => updateAction(index, 'botId', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.telegramAction.userId')}</label>
                          <input
                            type="text"
                            value={action.config.telegramUserId || ''}
                            onChange={(e) => updateAction(index, 'telegramUserId', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                          />
                        </div>
                      </div>
                    )}

                    {(action.config.reportType || 'sales') === 'sales' && (
                      <div className="space-y-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.report.currencyMode')}</label>
                            <select
                              value={action.config.currencyMode || 'converted'}
                              onChange={(e) => updateAction(index, 'currencyMode', e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                            >
                              <option value="native">{t('crm.automations.form.report.currencyNative')}</option>
                              <option value="converted">{t('crm.automations.form.report.currencyConverted')}</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.report.displayCurrency')}</label>
                            <select
                              value={action.config.displayCurrency || 'EUR'}
                              onChange={(e) => updateAction(index, 'displayCurrency', e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                            >
                              {reportCurrencies.map((cur) => (
                                <option key={cur} value={cur}>
                                  {cur}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.report.dateField')}</label>
                          <select
                            value={action.config.dateField || 'saleDate'}
                            onChange={(e) => updateAction(index, 'dateField', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                          >
                            <option value="saleDate">{t('crm.automations.form.report.dateSale')}</option>
                            <option value="createdAt">{t('crm.automations.form.report.dateCreated')}</option>
                          </select>
                        </div>
                        {action.config.currencyMode !== 'native' && (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {reportCurrencies.map((cur) => {
                              const rateMap =
                                action.config.rates && typeof action.config.rates === 'object'
                                  ? action.config.rates
                                  : {};
                              return (
                              <div key={cur} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <span className="text-[11px] text-slate-600">
                                  {t('crm.automations.form.report.rateFor', { currency: cur })}
                                </span>
                                <input
                                  type="number"
                                  step="0.0001"
                                  value={rateMap[cur] ?? ''}
                                  onChange={(e) => {
                                    const currentRates =
                                      action.config.rates && typeof action.config.rates === 'object'
                                        ? action.config.rates
                                        : {};
                                    updateAction(index, 'rates', {
                                      ...currentRates,
                                      [cur]: Number(e.target.value),
                                    });
                                  }}
                                  className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs"
                                />
                              </div>
                            );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Заметка */}
                {action.type === 'create_note' && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.noteAction.content')}</label>
                    <textarea
                      value={action.config.content || ''}
                      onChange={(e) => updateAction(index, 'content', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors resize-none"
                      placeholder="Текст заметки"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Кнопки действий */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate('/app/automations')}
              className="px-4 py-2 text-xs text-slate-400 hover:text-slate-50 transition-colors"
            >
              {t('crm.automations.form.actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? t('crm.automations.form.actions.saving') : id ? t('crm.automations.form.actions.save') : t('crm.automations.form.actions.create')}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};
