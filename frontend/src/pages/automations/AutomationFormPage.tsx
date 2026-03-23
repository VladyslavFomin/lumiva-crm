// src/pages/automations/AutomationFormPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
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
  const [dragActionIndex, setDragActionIndex] = useState<number | null>(null);
  const [expandedActionIndex, setExpandedActionIndex] = useState<number | null>(0);
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
        console.error('Failed to load email accounts:', e);
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
        console.error('Failed to load templates:', e);
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
          let actions: Array<{ type: string; config: Record<string, any> }> = [];
          if (Array.isArray(automation.actions)) {
            actions = automation.actions.map((action: any) => {
              const actionType = action.type || 'trigger_webhook';
              const actionConfig = action.config || {};
              return {
                type: actionType,
                config: actionConfig,
              };
            });
          } else if (automation.actions && typeof automation.actions === 'object') {
            const action = automation.actions as any;
            actions = [{
              type: action.type || 'trigger_webhook',
              config: action.config || {},
            }];
          }
          if (actions.length === 0) {
            actions = [{ type: 'trigger_webhook' as ActionType, config: {} }];
          }
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
      const submitData = {
        ...formData,
        actions: formData.actions.map((action) => {
          const cleanConfig: Record<string, any> = {};
          if (action.config) {
            Object.keys(action.config).forEach((key) => {
              const value = action.config[key];
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
      if (id) {
        await updateAutomation(id, submitData);
      } else {
        await createAutomation(submitData);
      }
      navigate('/app/automations');
    } catch (err: any) {
      console.error('Failed to save automation:', err);
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
    setExpandedActionIndex(formData.actions.length);
  };

  const addActionByType = (type: ActionType) => {
    setFormData((prev) => ({
      ...prev,
      actions: [...prev.actions, { type, config: {} }],
    }));
    setExpandedActionIndex(formData.actions.length);
  };

  const removeAction = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }));
    if (expandedActionIndex === index) {
      setExpandedActionIndex(null);
    }
  };

  const updateAction = (index: number, field: string, value: any) => {
    setFormData((prev) => {
      const newActions = [...prev.actions];
      if (field === 'type') {
        const currentConfig = newActions[index].config || {};
        newActions[index] = { 
          ...newActions[index], 
          type: value, 
          config: currentConfig,
        };
      } else {
        const currentConfig = newActions[index].config || {};
        newActions[index] = { 
          ...newActions[index], 
          config: { 
            ...currentConfig, 
            [field]: value 
          } 
        };
      }
      return { ...prev, actions: newActions };
    });
  };

  const moveAction = (from: number, to: number) => {
    setFormData((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.actions.length || to >= prev.actions.length) {
        return prev;
      }
      const next = [...prev.actions];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...prev, actions: next };
    });
  };

  const getActionTypeLabel = (type: ActionType) => {
    const key = `crm.automations.form.actionTypes.${type}`;
    const value = t(key);
    return value === key ? type : value;
  };

  const currentEntity: 'lead' | 'project' | 'sale' = formData.triggerEvent.startsWith('project.')
    ? 'project'
    : formData.triggerEvent.startsWith('sale.')
      ? 'sale'
      : 'lead';

  const applyEntityPreset = (entity: 'lead' | 'project' | 'sale') => {
    const preset: Record<'lead' | 'project' | 'sale', TriggerEvent> = {
      lead: 'lead.created',
      project: 'project.created',
      sale: 'sale.created',
    };
    handleChange('triggerEvent', preset[entity]);
  };

  const applyStarterFlow = (entity: 'lead' | 'project' | 'sale') => {
    const presets: Record<'lead' | 'project' | 'sale', { trigger: TriggerEvent; actions: Array<{ type: ActionType; config: Record<string, any> }> }> = {
      lead: {
        trigger: 'lead.created',
        actions: [
          { type: 'send_email', config: {} },
          { type: 'create_note', config: {} },
        ],
      },
      project: {
        trigger: 'project.created',
        actions: [
          { type: 'create_note', config: {} },
          { type: 'change_status', config: {} },
        ],
      },
      sale: {
        trigger: 'sale.created',
        actions: [
          { type: 'send_report', config: { reportType: 'sales', channel: 'email' } },
          { type: 'create_note', config: {} },
        ],
      },
    };
    const selected = presets[entity];
    setFormData((prev) => ({
      ...prev,
      triggerEvent: selected.trigger,
      actions: selected.actions,
    }));
    setExpandedActionIndex(0);
  };

  const getTriggerEventLabel = (event: string) => {
    const key = `crm.automations.form.triggers.${event.replace(/\./g, '_').toUpperCase()}`;
    const value = t(key);
    return value === key ? event : value;
  };

  const actionSummary = useMemo(() => {
    return formData.actions.map((action) => {
      if (action.type === 'trigger_webhook') return action.config.url || t('crm.automations.form.builder.noConfig');
      if (action.type === 'send_email') return action.config.to || action.config.templateId || t('crm.automations.form.builder.noConfig');
      if (action.type === 'send_telegram') return action.config.telegramUserId || t('crm.automations.form.builder.noConfig');
      if (action.type === 'create_note') return action.config.content || t('crm.automations.form.builder.noConfig');
      if (action.type === 'change_status') return action.config.status || t('crm.automations.form.builder.noConfig');
      if (action.type === 'send_report') return action.config.reportType || t('crm.automations.form.builder.noConfig');
      return t('crm.automations.form.builder.noConfig');
    });
  }, [formData.actions, t]);

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-xs text-slate-400">{t('crm.automations.list.loading')}</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-5 pb-6">
        {/* Заголовок */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {id ? t('crm.automations.form.titleEdit') : t('crm.automations.form.titleNew')}
            </h1>
            <div className="text-[12px] text-slate-500">
              {t('crm.automations.form.subtitle')}
            </div>
          </div>
          <button
            onClick={() => navigate('/app/automations')}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
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

        <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-8 space-y-4">
          {/* IF: Основная информация */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
            <h2 className="text-xs font-semibold text-slate-700 mb-3">{t('crm.automations.form.sections.basic')}</h2>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1.5">{t('crm.automations.form.fields.name')}</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                placeholder={t('crm.automations.form.fields.name')}
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1.5">{t('crm.automations.form.fields.description')}</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors resize-none"
                placeholder={t('crm.automations.form.fields.description')}
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1.5">{t('crm.automations.form.fields.trigger')}</label>
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
                <optgroup label="Custom objects">
                  <option value="custom_object.record_created">Record created</option>
                  <option value="custom_object.record_updated">Record updated</option>
                  <option value="custom_object.status_changed">Status changed</option>
                </optgroup>
              </select>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-slate-500">{t('crm.automations.form.builder.scope')}</span>
                <button
                  type="button"
                  onClick={() => applyEntityPreset('lead')}
                  className={`px-2.5 py-1 text-[10px] rounded-full border transition-colors ${
                    currentEntity === 'lead'
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {t('crm.automations.panel.titleLeads')}
                </button>
                <button
                  type="button"
                  onClick={() => applyEntityPreset('project')}
                  className={`px-2.5 py-1 text-[10px] rounded-full border transition-colors ${
                    currentEntity === 'project'
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {t('crm.automations.panel.titleProjects')}
                </button>
                <button
                  type="button"
                  onClick={() => applyEntityPreset('sale')}
                  className={`px-2.5 py-1 text-[10px] rounded-full border transition-colors ${
                    currentEntity === 'sale'
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {t('crm.automations.panel.titleSales')}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1.5">{t('crm.automations.form.fields.active')}</label>
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

          <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-sm">
            <div className="text-xs font-semibold text-slate-700">{t('crm.automations.form.builder.templatesTitle')}</div>
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => applyStarterFlow('lead')}
                className="rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 p-3 text-left transition-colors"
              >
                <div className="text-[11px] font-semibold text-slate-800">{t('crm.automations.panel.titleLeads')}</div>
                <div className="text-[10px] text-slate-500 mt-1">{t('crm.automations.form.builder.templates.leads')}</div>
              </button>
              <button
                type="button"
                onClick={() => applyStarterFlow('project')}
                className="rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 p-3 text-left transition-colors"
              >
                <div className="text-[11px] font-semibold text-slate-800">{t('crm.automations.panel.titleProjects')}</div>
                <div className="text-[10px] text-slate-500 mt-1">{t('crm.automations.form.builder.templates.projects')}</div>
              </button>
              <button
                type="button"
                onClick={() => applyStarterFlow('sale')}
                className="rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 p-3 text-left transition-colors"
              >
                <div className="text-[11px] font-semibold text-slate-800">{t('crm.automations.panel.titleSales')}</div>
                <div className="text-[10px] text-slate-500 mt-1">{t('crm.automations.form.builder.templates.sales')}</div>
              </button>
            </div>
          </div>

          {/* THEN: Действия */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-semibold text-slate-700">{t('crm.automations.form.builder.thenTitle')}</h2>
                <div className="text-[10px] text-slate-500 mt-0.5">{t('crm.automations.form.hints.actionsDesc')}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addAction}
                  className="px-3 py-1.5 text-[10px] rounded-xl bg-lumiva-accent text-slate-950 font-semibold hover:bg-lumiva-accent-soft transition-colors"
                >
                  + {t('crm.automations.form.actions.addAction')}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => addActionByType('send_email')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('send_email')}</button>
              <button type="button" onClick={() => addActionByType('trigger_webhook')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('trigger_webhook')}</button>
              <button type="button" onClick={() => addActionByType('change_status')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('change_status')}</button>
              <button type="button" onClick={() => addActionByType('create_note')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('create_note')}</button>
            </div>

            {formData.actions.map((action, index) => (
              <div
                key={index}
                draggable
                onDragStart={() => setDragActionIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragActionIndex !== null) moveAction(dragActionIndex, index);
                  setDragActionIndex(null);
                }}
                onDragEnd={() => setDragActionIndex(null)}
                className={`relative border rounded-2xl p-3 space-y-3 bg-slate-50/70 ${
                  dragActionIndex === index ? 'border-lumiva-accent' : 'border-slate-200'
                }`}
              >
                {index < formData.actions.length - 1 && (
                  <div className="absolute left-5 -bottom-4 h-4 w-px bg-slate-300" />
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-600 font-medium flex items-center gap-2">
                    <span className="cursor-grab">::</span>
                    {t('crm.automations.form.builder.step')} {index + 1}
                    <span className="text-slate-400">-</span>
                    <span>{getActionTypeLabel(action.type as ActionType)}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setExpandedActionIndex(expandedActionIndex === index ? null : index)}
                      className="px-2 py-1 text-[10px] rounded-lg border border-slate-300 text-slate-600 hover:bg-white"
                    >
                      {expandedActionIndex === index
                        ? t('crm.automations.form.builder.collapse')
                        : t('crm.automations.form.builder.expand')}
                    </button>
                    <button
                      type="button"
                      onClick={() => moveAction(index, Math.max(0, index - 1))}
                      disabled={index === 0}
                      className="px-2 py-1 text-[10px] rounded-lg border border-slate-300 text-slate-600 hover:bg-white disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveAction(index, Math.min(formData.actions.length - 1, index + 1))}
                      disabled={index === formData.actions.length - 1}
                      className="px-2 py-1 text-[10px] rounded-lg border border-slate-300 text-slate-600 hover:bg-white disabled:opacity-40"
                    >
                      ↓
                    </button>
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
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-600">
                  {actionSummary[index]}
                </div>

                {expandedActionIndex === index && (
                <>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1.5">{t('crm.automations.form.fields.actionType')}</label>
                  <select
                    value={action.type}
                    onChange={(e) => updateAction(index, 'type', e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                  >
                    <option value="trigger_webhook">{getActionTypeLabel('trigger_webhook')}</option>
                    <option value="send_email">{getActionTypeLabel('send_email')}</option>
                    <option value="send_telegram">{getActionTypeLabel('send_telegram')}</option>
                    <option value="send_report">{getActionTypeLabel('send_report')}</option>
                    <option value="create_note">{getActionTypeLabel('create_note')}</option>
                    <option value="update_field">{getActionTypeLabel('update_field')}</option>
                    <option value="add_tag">{getActionTypeLabel('add_tag')}</option>
                    <option value="change_status">{getActionTypeLabel('change_status')}</option>
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
                </>
                )}
              </div>
            ))}
          </div>

          {/* Кнопки действий */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => navigate('/app/automations')}
              className="px-4 py-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
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
          </div>

          <aside className="xl:col-span-4">
            <div className="xl:sticky xl:top-20 space-y-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-semibold text-slate-700 mb-2">
                  {t('crm.automations.form.builder.previewTitle')}
                </div>
                <div className="space-y-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <div className="text-[10px] text-emerald-700 font-semibold">{t('crm.automations.form.builder.ifTitle')}</div>
                    <div className="text-xs text-emerald-900 mt-0.5">{getTriggerEventLabel(formData.triggerEvent)}</div>
                  </div>
                  <div className="pl-3 text-slate-400 text-[10px]">↓</div>
                  {formData.actions.length === 0 && (
                    <div className="text-[11px] text-slate-500">{t('crm.automations.form.builder.noActions')}</div>
                  )}
                  {formData.actions.map((action, idx) => (
                    <div key={`preview-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[10px] text-slate-500">{t('crm.automations.form.builder.step')} {idx + 1}</div>
                      <div className="text-xs text-slate-800">{getActionTypeLabel(action.type as ActionType)}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{actionSummary[idx]}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-semibold text-slate-700">{t('crm.automations.form.fields.active')}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {formData.isActive
                    ? t('crm.automations.list.active')
                    : t('crm.automations.list.inactive')}
                </div>
              </div>
            </div>
          </aside>
        </form>
      </div>
    </MainLayout>
  );
};
