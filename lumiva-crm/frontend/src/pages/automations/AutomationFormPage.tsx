// src/pages/automations/AutomationFormPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fetchAutomation,
  createAutomation,
  updateAutomation,
  type Action,
  type CreateAutomationDto,
  type TriggerEvent,
  type ActionType,
} from '../../api/automations';
import { fetchEmailAccounts, type EmailAccount, fetchEmailTemplates, type EmailTemplate } from '../../api/email';
import { fetchIntegrations, type IntegrationConnectionDto } from '../../api/integrations';
import {
  fetchMarketingIntegrations,
  type MarketingIntegrationRow,
} from '../../api/marketing';

/** Preset when adding / switching to the simple «send CRM report» step (no API paths or JSON). */
const QUICK_SEND_REPORT_ACTION_CONFIG: Record<string, unknown> = {
  reportType: 'sales',
  channel: 'email',
  scheduleFrequency: 'weekly',
  scheduleTime: '09:00',
  scheduleTimezone: 'Europe/Moscow',
  scheduleDayOfWeek: 1,
  formatPdf: true,
  formatXls: true,
};

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
  const [crmIntegrations, setCrmIntegrations] = useState<IntegrationConnectionDto[]>([]);
  const [marketingIntegrations, setMarketingIntegrations] = useState<MarketingIntegrationRow[]>([]);
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
    if (formData.triggerEvent !== 'scheduled') return;
    setFormData((prev) => {
      const sch = (prev.meta as Record<string, any> | undefined)?.schedule;
      if (sch && typeof sch === 'object' && Object.keys(sch).length > 0) {
        return prev;
      }
      return {
        ...prev,
        meta: {
          ...(typeof prev.meta === 'object' && prev.meta && !Array.isArray(prev.meta)
            ? (prev.meta as Record<string, unknown>)
            : {}),
          schedule: {
            scheduleFrequency: 'weekly',
            scheduleTime: '09:00',
            scheduleTimezone: 'Europe/Moscow',
            scheduleDayOfWeek: 1,
            scheduleDayOfMonth: 1,
          },
        },
      };
    });
  }, [formData.triggerEvent]);

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

    Promise.all([
      fetchIntegrations().catch(() => [] as IntegrationConnectionDto[]),
      fetchMarketingIntegrations().catch(() => [] as MarketingIntegrationRow[]),
    ]).then(([crm, mkt]) => {
      setCrmIntegrations(Array.isArray(crm) ? crm : []);
      setMarketingIntegrations(Array.isArray(mkt) ? mkt : []);
    });
  }, []);

  const slackConnections = useMemo(
    () =>
      crmIntegrations.filter(
        (c) => c.kind === 'third_party_link' && c.linkCatalogId === 'slack',
      ),
    [crmIntegrations],
  );

  const teamsConnections = useMemo(
    () =>
      crmIntegrations.filter(
        (c) => c.kind === 'third_party_link' && c.linkCatalogId === 'ms_teams',
      ),
    [crmIntegrations],
  );

  const mailchimpConnections = useMemo(
    () =>
      crmIntegrations.filter(
        (c) => c.kind === 'third_party_link' && c.linkCatalogId === 'mailchimp',
      ),
    [crmIntegrations],
  );

  const zapierConnections = useMemo(
    () =>
      crmIntegrations.filter(
        (c) => c.kind === 'third_party_link' && c.linkCatalogId === 'zapier',
      ),
    [crmIntegrations],
  );

  const whatsappConnections = useMemo(
    () =>
      crmIntegrations.filter(
        (c) => c.kind === 'third_party_link' && c.linkCatalogId === 'whatsapp',
      ),
    [crmIntegrations],
  );

  const googleCalendarConnections = useMemo(
    () =>
      crmIntegrations.filter(
        (c) => c.kind === 'third_party_link' && c.linkCatalogId === 'google_calendar',
      ),
    [crmIntegrations],
  );

  const outlookCalendarConnections = useMemo(
    () =>
      crmIntegrations.filter(
        (c) => c.kind === 'third_party_link' && c.linkCatalogId === 'outlook',
      ),
    [crmIntegrations],
  );

  const bitrixConnections = useMemo(
    () =>
      crmIntegrations.filter(
        (c) => c.kind === 'third_party_link' && c.linkCatalogId === 'bitrix',
      ),
    [crmIntegrations],
  );

  const amocrmConnections = useMemo(
    () =>
      crmIntegrations.filter(
        (c) => c.kind === 'third_party_link' && c.linkCatalogId === 'amocrm',
      ),
    [crmIntegrations],
  );

  const hubspotConnections = useMemo(
    () =>
      crmIntegrations.filter(
        (c) => c.kind === 'third_party_link' && c.linkCatalogId === 'hubspot',
      ),
    [crmIntegrations],
  );

  const googleAdsConnections = useMemo(
    () =>
      crmIntegrations.filter(
        (c) => c.kind === 'third_party_link' && c.linkCatalogId === 'google_ads',
      ),
    [crmIntegrations],
  );

  const metaAdsConnections = useMemo(
    () =>
      crmIntegrations.filter(
        (c) => c.kind === 'third_party_link' && c.linkCatalogId === 'meta_ads',
      ),
    [crmIntegrations],
  );

  const marketingGoogleAdsIntegrations = useMemo(
    () => marketingIntegrations.filter((r) => r.provider === 'google_ads' && r.isActive),
    [marketingIntegrations],
  );

  const marketingMetaAdsIntegrations = useMemo(
    () => marketingIntegrations.filter((r) => r.provider === 'meta_ads' && r.isActive),
    [marketingIntegrations],
  );

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
            actions: actions as Action[],
            isActive: automation.isActive,
            maxExecutions: automation.maxExecutions || undefined,
            cooldownSeconds: automation.cooldownSeconds || undefined,
            meta: automation.meta ?? undefined,
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

  const onTriggerEventChange = (v: TriggerEvent) => {
    if (v === 'scheduled') {
      setFormData((prev) => ({
        ...prev,
        triggerEvent: v,
        meta: {
          schedule: {
            scheduleFrequency: 'weekly',
            scheduleTime: '09:00',
            scheduleTimezone: 'Europe/Moscow',
            scheduleDayOfWeek: 1,
            scheduleDayOfMonth: 1,
            ...((prev.meta as Record<string, any> | undefined)?.schedule || {}),
          },
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        triggerEvent: v,
        meta: undefined,
      }));
    }
  };

  const patchScheduleField = (field: string, value: unknown) => {
    setFormData((prev) => {
      const prevSched =
        prev.meta &&
        typeof prev.meta === 'object' &&
        !Array.isArray(prev.meta) &&
        (prev.meta as Record<string, any>).schedule &&
        typeof (prev.meta as Record<string, any>).schedule === 'object'
          ? { ...(prev.meta as Record<string, any>).schedule }
          : {
              scheduleFrequency: 'weekly',
              scheduleTime: '09:00',
              scheduleTimezone: 'Europe/Moscow',
              scheduleDayOfWeek: 1,
              scheduleDayOfMonth: 1,
            };
      return {
        ...prev,
        meta: {
          ...(typeof prev.meta === 'object' && prev.meta && !Array.isArray(prev.meta)
            ? (prev.meta as Record<string, unknown>)
            : {}),
          schedule: { ...prevSched, [field]: value },
        },
      };
    });
  };

  const addAction = () => {
    setFormData((prev) => {
      const actions = [...prev.actions, { type: 'trigger_webhook' as ActionType, config: {} }];
      setExpandedActionIndex(actions.length - 1);
      return { ...prev, actions };
    });
  };

  const addActionByType = (type: ActionType, presetConfig?: Record<string, unknown>) => {
    setFormData((prev) => {
      const actions = [
        ...prev.actions,
        { type, config: presetConfig ? { ...presetConfig } : {} },
      ];
      setExpandedActionIndex(actions.length - 1);
      return { ...prev, actions };
    });
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

  const replaceActionAt = (idx: number, type: ActionType, config: Record<string, unknown>) => {
    setFormData((prev) => {
      const newActions = [...prev.actions];
      newActions[idx] = { type, config: { ...config } };
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

  const scheduledCfg = useMemo(() => {
    const m = formData.meta as Record<string, any> | undefined;
    if (m && typeof m.schedule === 'object' && m.schedule) {
      return m.schedule as Record<string, any>;
    }
    return {
      scheduleFrequency: 'weekly',
      scheduleTime: '09:00',
      scheduleTimezone: 'Europe/Moscow',
      scheduleDayOfWeek: 1,
      scheduleDayOfMonth: 1,
    };
  }, [formData.meta]);

  const schedFreq = (scheduledCfg.scheduleFrequency as string) || 'weekly';

  const actionSummary = useMemo(() => {
    return formData.actions.map((action) => {
      if (action.type === 'trigger_webhook') return action.config.url || t('crm.automations.form.builder.noConfig');
      if (action.type === 'send_email') return action.config.to || action.config.templateId || t('crm.automations.form.builder.noConfig');
      if (action.type === 'send_telegram') return action.config.telegramUserId || t('crm.automations.form.builder.noConfig');
      if (action.type === 'send_slack') {
        if (action.config.integrationConnectionId) {
          const found = slackConnections.find((c) => c.id === action.config.integrationConnectionId);
          return found?.name || action.config.integrationConnectionId;
        }
        return action.config.webhookUrl || t('crm.automations.form.builder.noConfig');
      }
      if (action.type === 'send_teams') {
        if (action.config.integrationConnectionId) {
          const found = teamsConnections.find((c) => c.id === action.config.integrationConnectionId);
          return found?.name || action.config.integrationConnectionId;
        }
        return action.config.webhookUrl || t('crm.automations.form.builder.noConfig');
      }
      if (action.type === 'send_mailchimp') {
        if (action.config.integrationConnectionId) {
          const found = mailchimpConnections.find(
            (c) => c.id === action.config.integrationConnectionId,
          );
          return (
            [found?.name, action.config.listId].filter(Boolean).join(' · ') ||
            t('crm.automations.form.builder.noConfig')
          );
        }
        return action.config.listId || t('crm.automations.form.builder.noConfig');
      }
      if (action.type === 'send_mailchimp_campaign') {
        if (action.config.integrationConnectionId) {
          const found = mailchimpConnections.find(
            (c) => c.id === action.config.integrationConnectionId,
          );
          const sub = (action.config.subject as string) || '';
          return (
            [found?.name, action.config.listId, sub].filter(Boolean).join(' · ') ||
            t('crm.automations.form.builder.noConfig')
          );
        }
        return (
          [action.config.listId, action.config.subject].filter(Boolean).join(' · ') ||
          t('crm.automations.form.builder.noConfig')
        );
      }
      if (action.type === 'send_zapier') {
        if (action.config.integrationConnectionId) {
          const found = zapierConnections.find((c) => c.id === action.config.integrationConnectionId);
          return found?.name || action.config.integrationConnectionId;
        }
        return action.config.webhookUrl || t('crm.automations.form.builder.noConfig');
      }
      if (action.type === 'send_bitrix') {
        if (action.config.integrationConnectionId) {
          const found = bitrixConnections.find((c) => c.id === action.config.integrationConnectionId);
          return (
            found?.name ||
            action.config.method ||
            t('crm.automations.form.builder.noConfig')
          );
        }
        return action.config.method || action.config.webhookUrl || t('crm.automations.form.builder.noConfig');
      }
      if (action.type === 'send_amocrm') {
        if (action.config.integrationConnectionId) {
          const found = amocrmConnections.find((c) => c.id === action.config.integrationConnectionId);
          return (
            found?.name ||
            action.config.apiPath ||
            t('crm.automations.form.builder.noConfig')
          );
        }
        return (
          action.config.apiPath ||
          action.config.webhookUrl ||
          t('crm.automations.form.builder.noConfig')
        );
      }
      if (action.type === 'send_hubspot') {
        if (action.config.integrationConnectionId) {
          const found = hubspotConnections.find((c) => c.id === action.config.integrationConnectionId);
          return (
            found?.name ||
            action.config.apiPath ||
            t('crm.automations.form.builder.noConfig')
          );
        }
        return (
          action.config.apiPath ||
          action.config.webhookUrl ||
          t('crm.automations.form.builder.noConfig')
        );
      }
      if (action.type === 'send_google_ads') {
        if (action.config.marketingIntegrationId) {
          const m = marketingGoogleAdsIntegrations.find(
            (r) => r.id === action.config.marketingIntegrationId,
          );
          return (
            m?.name ||
            action.config.apiPath ||
            t('crm.automations.form.builder.noConfig')
          );
        }
        if (action.config.integrationConnectionId) {
          const found = googleAdsConnections.find((c) => c.id === action.config.integrationConnectionId);
          return (
            found?.name ||
            action.config.apiPath ||
            t('crm.automations.form.builder.noConfig')
          );
        }
        return action.config.apiPath || t('crm.automations.form.builder.noConfig');
      }
      if (action.type === 'send_meta_ads') {
        if (action.config.marketingIntegrationId) {
          const m = marketingMetaAdsIntegrations.find(
            (r) => r.id === action.config.marketingIntegrationId,
          );
          return (
            m?.name ||
            action.config.apiPath ||
            t('crm.automations.form.builder.noConfig')
          );
        }
        if (action.config.integrationConnectionId) {
          const found = metaAdsConnections.find((c) => c.id === action.config.integrationConnectionId);
          return (
            found?.name ||
            action.config.apiPath ||
            t('crm.automations.form.builder.noConfig')
          );
        }
        return action.config.apiPath || t('crm.automations.form.builder.noConfig');
      }
      if (action.type === 'send_whatsapp') {
        if (action.config.integrationConnectionId) {
          const found = whatsappConnections.find((c) => c.id === action.config.integrationConnectionId);
          return found?.name || action.config.to || t('crm.automations.form.builder.noConfig');
        }
        return action.config.to || action.config.phoneNumberId || t('crm.automations.form.builder.noConfig');
      }
      if (action.type === 'send_google_calendar') {
        if (action.config.integrationConnectionId) {
          const found = googleCalendarConnections.find(
            (c) => c.id === action.config.integrationConnectionId,
          );
          return found?.name || action.config.summary || t('crm.automations.form.builder.noConfig');
        }
        return action.config.summary || t('crm.automations.form.builder.noConfig');
      }
      if (action.type === 'send_outlook_calendar') {
        if (action.config.integrationConnectionId) {
          const found = outlookCalendarConnections.find(
            (c) => c.id === action.config.integrationConnectionId,
          );
          return found?.name || action.config.summary || t('crm.automations.form.builder.noConfig');
        }
        return action.config.summary || t('crm.automations.form.builder.noConfig');
      }
      if (action.type === 'create_note') return action.config.content || t('crm.automations.form.builder.noConfig');
      if (action.type === 'change_status') return action.config.status || t('crm.automations.form.builder.noConfig');
      if (action.type === 'send_report') {
        const rt = (action.config.reportType as string) || 'sales';
        const labelKey = `crm.automations.form.report.types.${rt}`;
        const translated = t(labelKey);
        return translated !== labelKey ? translated : rt;
      }
      if (action.type === 'send_data_export') {
        const parts = [
          action.config.channel === 'telegram'
            ? t('crm.automations.form.dataExport.channelTelegram')
            : t('crm.automations.form.dataExport.channelEmail'),
        ];
        if (action.config.formatJson) parts.push('JSON');
        if (action.config.formatXlsx) parts.push('XLSX');
        if (action.config.formatPdf) parts.push('PDF');
        return parts.join(' · ');
      }
      if (action.type === 'create_task')
        return action.config.title || action.config.companyId || t('crm.automations.form.builder.noConfig');
      if (action.type === 'update_field')
        return action.config.field
          ? `${action.config.field} → ${action.config.value ?? ''}`
          : t('crm.automations.form.builder.noConfig');
      if (action.type === 'add_tag') return action.config.tag || t('crm.automations.form.builder.noConfig');
      return t('crm.automations.form.builder.noConfig');
    });
  }, [
    formData.actions,
    t,
    slackConnections,
    teamsConnections,
    mailchimpConnections,
    zapierConnections,
    whatsappConnections,
    googleCalendarConnections,
    outlookCalendarConnections,
    bitrixConnections,
    amocrmConnections,
    hubspotConnections,
    googleAdsConnections,
    metaAdsConnections,
    marketingGoogleAdsIntegrations,
    marketingMetaAdsIntegrations,
  ]);

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
                onChange={(e) => onTriggerEventChange(e.target.value as TriggerEvent)}
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
                  <option value="lead.assigned">{t('crm.automations.form.triggers.LEAD_ASSIGNED')}</option>
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
                  <option value="scheduled">{t('crm.automations.form.triggers.SCHEDULED')}</option>
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
                <optgroup label={t('crm.automations.form.triggerGroups.customObjects')}>
                  <option value="custom_object.record_created">
                    {t('crm.automations.form.triggers.CUSTOM_OBJECT_RECORD_CREATED')}
                  </option>
                  <option value="custom_object.record_updated">
                    {t('crm.automations.form.triggers.CUSTOM_OBJECT_RECORD_UPDATED')}
                  </option>
                  <option value="custom_object.status_changed">
                    {t('crm.automations.form.triggers.CUSTOM_OBJECT_STATUS_CHANGED')}
                  </option>
                </optgroup>
              </select>
              {formData.triggerEvent === 'scheduled' && (
                <div className="mt-3 space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
                  <div className="text-[10px] font-semibold text-indigo-900">
                    {t('crm.automations.form.triggers.SCHEDULED')}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-600">
                        {t('crm.automations.form.report.frequency')}
                      </label>
                      <select
                        value={schedFreq}
                        onChange={(e) =>
                          patchScheduleField('scheduleFrequency', e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                      >
                        <option value="daily">
                          {t('crm.automations.form.report.frequencies.daily')}
                        </option>
                        <option value="weekly">
                          {t('crm.automations.form.report.frequencies.weekly')}
                        </option>
                        <option value="monthly">
                          {t('crm.automations.form.report.frequencies.monthly')}
                        </option>
                        <option value="quarterly">
                          {t('crm.automations.form.report.frequencies.quarterly')}
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-600">
                        {t('crm.automations.form.report.time')}
                      </label>
                      <input
                        type="time"
                        value={scheduledCfg.scheduleTime || '09:00'}
                        onChange={(e) =>
                          patchScheduleField('scheduleTime', e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                      />
                    </div>
                  </div>
                  {schedFreq === 'weekly' && (
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-600">
                        {t('crm.automations.form.report.dayOfWeek')}
                      </label>
                      <select
                        value={scheduledCfg.scheduleDayOfWeek ?? 1}
                        onChange={(e) =>
                          patchScheduleField(
                            'scheduleDayOfWeek',
                            Number(e.target.value),
                          )
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
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
                  {(schedFreq === 'monthly' || schedFreq === 'quarterly') && (
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-600">
                        {t('crm.automations.form.report.dayOfMonth')}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={scheduledCfg.scheduleDayOfMonth ?? 1}
                        onChange={(e) =>
                          patchScheduleField(
                            'scheduleDayOfMonth',
                            Number(e.target.value),
                          )
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                      />
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-600">
                      {t('crm.automations.form.report.timezone')}
                    </label>
                    <input
                      type="text"
                      value={scheduledCfg.scheduleTimezone || 'UTC'}
                      onChange={(e) =>
                        patchScheduleField('scheduleTimezone', e.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                      placeholder="Europe/Moscow"
                    />
                  </div>
                  <p className="text-[10px] leading-relaxed text-slate-600">
                    {t('crm.automations.form.triggers.SCHEDULED_ACTIONS_HINT')}
                  </p>
                </div>
              )}
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
              <button type="button" onClick={() => addActionByType('send_telegram')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('send_telegram')}</button>
              <button type="button" onClick={() => addActionByType('send_slack')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('send_slack')}</button>
              <button type="button" onClick={() => addActionByType('send_teams')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('send_teams')}</button>
              <button type="button" onClick={() => addActionByType('send_mailchimp')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('send_mailchimp')}</button>
              <button type="button" onClick={() => addActionByType('send_mailchimp_campaign')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('send_mailchimp_campaign')}</button>
              <button type="button" onClick={() => addActionByType('send_zapier')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('send_zapier')}</button>
              <button type="button" onClick={() => addActionByType('send_bitrix')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('send_bitrix')}</button>
              <button type="button" onClick={() => addActionByType('send_amocrm')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('send_amocrm')}</button>
              <button type="button" onClick={() => addActionByType('send_hubspot')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('send_hubspot')}</button>
              <button
                type="button"
                onClick={() => addActionByType('send_report', { ...QUICK_SEND_REPORT_ACTION_CONFIG })}
                className="px-2.5 py-1 text-[10px] rounded-full border border-lumiva-accent/40 bg-lumiva-accent/15 text-slate-800 font-medium hover:bg-lumiva-accent/25"
              >
                {getActionTypeLabel('send_report')}
              </button>
              <button type="button" onClick={() => addActionByType('send_google_ads')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('send_google_ads')}</button>
              <button type="button" onClick={() => addActionByType('send_meta_ads')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('send_meta_ads')}</button>
              <button type="button" onClick={() => addActionByType('send_whatsapp')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('send_whatsapp')}</button>
              <button type="button" onClick={() => addActionByType('send_google_calendar')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('send_google_calendar')}</button>
              <button type="button" onClick={() => addActionByType('send_outlook_calendar')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('send_outlook_calendar')}</button>
              <button
                type="button"
                onClick={() =>
                  addActionByType('send_data_export', {
                    channel: 'email',
                    formatJson: true,
                    formatXlsx: true,
                    formatPdf: false,
                    unwrapData: true,
                  })
                }
                className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
              >
                {getActionTypeLabel('send_data_export')}
              </button>
              <button type="button" onClick={() => addActionByType('trigger_webhook')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('trigger_webhook')}</button>
              <button type="button" onClick={() => addActionByType('change_status')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('change_status')}</button>
              <button type="button" onClick={() => addActionByType('create_task')} className="px-2.5 py-1 text-[10px] rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100">{getActionTypeLabel('create_task')}</button>
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
                    <option value="send_slack">{getActionTypeLabel('send_slack')}</option>
                    <option value="send_teams">{getActionTypeLabel('send_teams')}</option>
                    <option value="send_mailchimp">{getActionTypeLabel('send_mailchimp')}</option>
                    <option value="send_mailchimp_campaign">{getActionTypeLabel('send_mailchimp_campaign')}</option>
                    <option value="send_zapier">{getActionTypeLabel('send_zapier')}</option>
                    <option value="send_bitrix">{getActionTypeLabel('send_bitrix')}</option>
                    <option value="send_amocrm">{getActionTypeLabel('send_amocrm')}</option>
                    <option value="send_hubspot">{getActionTypeLabel('send_hubspot')}</option>
                    <option value="send_google_ads">{getActionTypeLabel('send_google_ads')}</option>
                    <option value="send_meta_ads">{getActionTypeLabel('send_meta_ads')}</option>
                    <option value="send_whatsapp">{getActionTypeLabel('send_whatsapp')}</option>
                    <option value="send_google_calendar">{getActionTypeLabel('send_google_calendar')}</option>
                    <option value="send_outlook_calendar">{getActionTypeLabel('send_outlook_calendar')}</option>
                    <option value="send_report">{getActionTypeLabel('send_report')}</option>
                    <option value="send_data_export">{getActionTypeLabel('send_data_export')}</option>
                    <option value="create_note">{getActionTypeLabel('create_note')}</option>
                    <option value="update_field">{getActionTypeLabel('update_field')}</option>
                    <option value="add_tag">{getActionTypeLabel('add_tag')}</option>
                    <option value="change_status">{getActionTypeLabel('change_status')}</option>
                    <option value="create_task">{getActionTypeLabel('create_task')}</option>
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
                {action.type === 'send_mailchimp' && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {t('crm.automations.form.mailchimpAction.intro')}
                    </p>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.mailchimpAction.connection')}
                      </label>
                      {mailchimpConnections.length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
                          {t('crm.automations.form.mailchimpAction.noConnections')}{' '}
                          <a href="/app/integrations-hub" className="font-semibold underline">
                            {t('crm.automations.form.slackAction.openIntegrations')}
                          </a>
                        </div>
                      ) : (
                        <select
                          value={action.config.integrationConnectionId || ''}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'integrationConnectionId',
                              e.target.value || undefined,
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="">{t('crm.automations.form.mailchimpAction.pickConnection')}</option>
                          {mailchimpConnections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.mailchimpAction.listId')}
                      </label>
                      <input
                        type="text"
                        value={action.config.listId || ''}
                        onChange={(e) => updateAction(index, 'listId', e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 font-mono"
                        placeholder="xxxxxxxxxx"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.mailchimpAction.listIdHint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.mailchimpAction.email')}
                      </label>
                      <input
                        type="text"
                        value={action.config.email || ''}
                        onChange={(e) => updateAction(index, 'email', e.target.value || undefined)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        placeholder="{{lead.email}}"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.mailchimpAction.emailHint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.mailchimpAction.mergeFields')}
                      </label>
                      <textarea
                        value={action.config.mergeFieldsJson || ''}
                        onChange={(e) =>
                          updateAction(index, 'mergeFieldsJson', e.target.value || undefined)
                        }
                        rows={2}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 font-mono resize-none"
                        placeholder='{"FNAME": "{{lead.name}}"}'
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.mailchimpAction.mergeFieldsHint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.mailchimpAction.subscriptionStatus')}
                      </label>
                      <select
                        value={action.config.subscriptionStatus || 'subscribed'}
                        onChange={(e) =>
                          updateAction(
                            index,
                            'subscriptionStatus',
                            e.target.value === 'pending' ? 'pending' : 'subscribed',
                          )
                        }
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                      >
                        <option value="subscribed">
                          {t('crm.automations.form.mailchimpAction.subscriptionSubscribed')}
                        </option>
                        <option value="pending">
                          {t('crm.automations.form.mailchimpAction.subscriptionPending')}
                        </option>
                      </select>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.mailchimpAction.subscriptionStatusHint')}
                      </p>
                    </div>
                  </div>
                )}

                {action.type === 'send_mailchimp_campaign' && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {t('crm.automations.form.mailchimpCampaignAction.intro')}
                    </p>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.mailchimpCampaignAction.connection')}
                      </label>
                      {mailchimpConnections.length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
                          {t('crm.automations.form.mailchimpCampaignAction.noConnections')}{' '}
                          <a href="/app/integrations-hub" className="font-semibold underline">
                            {t('crm.automations.form.slackAction.openIntegrations')}
                          </a>
                        </div>
                      ) : (
                        <select
                          value={action.config.integrationConnectionId || ''}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'integrationConnectionId',
                              e.target.value || undefined,
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="">{t('crm.automations.form.mailchimpCampaignAction.pickConnection')}</option>
                          {mailchimpConnections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.mailchimpCampaignAction.listId')}
                      </label>
                      <input
                        type="text"
                        value={action.config.listId || ''}
                        onChange={(e) => updateAction(index, 'listId', e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 font-mono"
                        placeholder="xxxxxxxxxx"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.mailchimpCampaignAction.listIdHint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.mailchimpCampaignAction.subject')}
                      </label>
                      <input
                        type="text"
                        value={action.config.subject || ''}
                        onChange={(e) => updateAction(index, 'subject', e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        placeholder="{{lead.name}} — новости"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.mailchimpCampaignAction.subjectHint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.mailchimpCampaignAction.fromName')}
                      </label>
                      <input
                        type="text"
                        value={action.config.fromName || ''}
                        onChange={(e) => updateAction(index, 'fromName', e.target.value || undefined)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        placeholder="Ваша компания"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.mailchimpCampaignAction.fromNameHint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.mailchimpCampaignAction.replyTo')}
                      </label>
                      <input
                        type="email"
                        value={action.config.replyTo || ''}
                        onChange={(e) => updateAction(index, 'replyTo', e.target.value || undefined)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        placeholder="news@your-verified-domain.com"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.mailchimpCampaignAction.replyToHint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.mailchimpCampaignAction.campaignTitle')}
                      </label>
                      <input
                        type="text"
                        value={action.config.campaignTitle || ''}
                        onChange={(e) => updateAction(index, 'campaignTitle', e.target.value || undefined)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        placeholder=""
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.mailchimpCampaignAction.campaignTitleHint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.mailchimpCampaignAction.htmlBody')}
                      </label>
                      <textarea
                        value={action.config.htmlBody || ''}
                        onChange={(e) => updateAction(index, 'htmlBody', e.target.value || undefined)}
                        rows={8}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 font-mono resize-y min-h-[120px]"
                        placeholder="<html>...</html>"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.mailchimpCampaignAction.htmlBodyHint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.mailchimpCampaignAction.textBody')}
                      </label>
                      <textarea
                        value={action.config.textBody || ''}
                        onChange={(e) => updateAction(index, 'textBody', e.target.value || undefined)}
                        rows={4}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 resize-none"
                        placeholder=""
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.mailchimpCampaignAction.textBodyHint')}
                      </p>
                    </div>
                  </div>
                )}

                {action.type === 'send_teams' && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {t('crm.automations.form.teamsAction.intro')}
                    </p>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.teamsAction.connection')}
                      </label>
                      {teamsConnections.length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
                          {t('crm.automations.form.teamsAction.noConnections')}{' '}
                          <a href="/app/integrations-hub" className="font-semibold underline">
                            {t('crm.automations.form.slackAction.openIntegrations')}
                          </a>
                        </div>
                      ) : (
                        <select
                          value={action.config.integrationConnectionId || ''}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'integrationConnectionId',
                              e.target.value || undefined,
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="">{t('crm.automations.form.teamsAction.pickConnection')}</option>
                          {teamsConnections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.teamsAction.webhookOverride')}
                      </label>
                      <input
                        type="url"
                        value={action.config.webhookUrl || ''}
                        onChange={(e) => updateAction(index, 'webhookUrl', e.target.value || undefined)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 font-mono"
                        placeholder="https://…webhook.office.com…"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.teamsAction.title')}
                      </label>
                      <input
                        type="text"
                        value={action.config.title || ''}
                        onChange={(e) => updateAction(index, 'title', e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        placeholder="Lumiva CRM"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.teamsAction.text')}
                      </label>
                      <textarea
                        value={action.config.text || ''}
                        onChange={(e) => updateAction(index, 'text', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 resize-none"
                      />
                    </div>
                  </div>
                )}

                {action.type === 'send_zapier' && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {t('crm.automations.form.zapierAction.intro')}
                    </p>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.zapierAction.connection')}
                      </label>
                      {zapierConnections.length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
                          {t('crm.automations.form.zapierAction.noConnections')}{' '}
                          <a href="/app/integrations-hub" className="font-semibold underline">
                            {t('crm.automations.form.slackAction.openIntegrations')}
                          </a>
                        </div>
                      ) : (
                        <select
                          value={action.config.integrationConnectionId || ''}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'integrationConnectionId',
                              e.target.value || undefined,
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="">{t('crm.automations.form.zapierAction.pickConnection')}</option>
                          {zapierConnections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.zapierAction.hookOverride')}
                      </label>
                      <input
                        type="url"
                        value={action.config.webhookUrl || ''}
                        onChange={(e) => updateAction(index, 'webhookUrl', e.target.value || undefined)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono"
                        placeholder="https://hooks.zapier.com/hooks/catch/…"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.zapierAction.text')}
                      </label>
                      <textarea
                        value={action.config.text || ''}
                        onChange={(e) => updateAction(index, 'text', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl resize-none"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.zapierAction.textHint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.zapierAction.jsonPayload')}
                      </label>
                      <textarea
                        value={action.config.jsonPayload || ''}
                        onChange={(e) => updateAction(index, 'jsonPayload', e.target.value || undefined)}
                        rows={4}
                        className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl resize-none"
                        placeholder={'{\n  "lead": "{{lead.name}}"\n}'}
                      />
                    </div>
                  </div>
                )}

                {action.type === 'send_bitrix' && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {t('crm.automations.form.bitrixAction.intro')}
                    </p>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.bitrixAction.connection')}
                      </label>
                      {bitrixConnections.length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
                          {t('crm.automations.form.bitrixAction.noConnections')}{' '}
                          <a href="/app/integrations-hub" className="font-semibold underline">
                            {t('crm.automations.form.slackAction.openIntegrations')}
                          </a>
                        </div>
                      ) : (
                        <select
                          value={action.config.integrationConnectionId || ''}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'integrationConnectionId',
                              e.target.value || undefined,
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="">{t('crm.automations.form.bitrixAction.pickConnection')}</option>
                          {bitrixConnections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.bitrixAction.webhookOverride')}
                      </label>
                      <input
                        type="url"
                        value={action.config.webhookUrl || ''}
                        onChange={(e) => updateAction(index, 'webhookUrl', e.target.value || undefined)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono"
                        placeholder="https://…bitrix24…/rest/1/…/"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.bitrixAction.webhookOverrideHint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.bitrixAction.method')}
                      </label>
                      <input
                        value={action.config.method || ''}
                        onChange={(e) => updateAction(index, 'method', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                        placeholder={t('crm.automations.form.bitrixAction.methodPlaceholder')}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.bitrixAction.paramsJson')}
                      </label>
                      <textarea
                        value={action.config.paramsJson || ''}
                        onChange={(e) =>
                          updateAction(index, 'paramsJson', e.target.value || undefined)
                        }
                        rows={5}
                        className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl resize-none"
                        placeholder={'{\n  "fields": {\n    "TITLE": "{{lead.name}}"\n  }\n}'}
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.bitrixAction.paramsJsonHint')}
                      </p>
                    </div>
                  </div>
                )}

                {action.type === 'send_amocrm' && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {t('crm.automations.form.amocrmAction.intro')}
                    </p>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.amocrmAction.connection')}
                      </label>
                      {amocrmConnections.length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
                          {t('crm.automations.form.amocrmAction.noConnections')}{' '}
                          <a href="/app/integrations-hub" className="font-semibold underline">
                            {t('crm.automations.form.slackAction.openIntegrations')}
                          </a>
                        </div>
                      ) : (
                        <select
                          value={action.config.integrationConnectionId || ''}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'integrationConnectionId',
                              e.target.value || undefined,
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="">{t('crm.automations.form.amocrmAction.pickConnection')}</option>
                          {amocrmConnections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.amocrmAction.baseUrlOverride')}
                      </label>
                      <input
                        type="url"
                        value={action.config.webhookUrl || ''}
                        onChange={(e) => updateAction(index, 'webhookUrl', e.target.value || undefined)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono"
                        placeholder="https://…amocrm.ru"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.amocrmAction.baseUrlOverrideHint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.amocrmAction.accessToken')}
                      </label>
                      <input
                        type="password"
                        value={action.config.accessToken || ''}
                        onChange={(e) =>
                          updateAction(index, 'accessToken', e.target.value || undefined)
                        }
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.amocrmAction.httpMethod')}
                        </label>
                        <select
                          value={action.config.httpMethod || 'POST'}
                          onChange={(e) => updateAction(index, 'httpMethod', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PATCH">PATCH</option>
                          <option value="PUT">PUT</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.amocrmAction.apiPath')}
                        </label>
                        <input
                          value={action.config.apiPath || ''}
                          onChange={(e) => updateAction(index, 'apiPath', e.target.value)}
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                          placeholder={t('crm.automations.form.amocrmAction.apiPathPlaceholder')}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.amocrmAction.paramsJson')}
                      </label>
                      <textarea
                        value={action.config.paramsJson || ''}
                        onChange={(e) =>
                          updateAction(index, 'paramsJson', e.target.value || undefined)
                        }
                        rows={5}
                        className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl resize-none"
                        placeholder={'[\n  {\n    "name": "{{lead.name}}"\n  }\n]'}
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.amocrmAction.paramsJsonHint')}
                      </p>
                    </div>
                  </div>
                )}

                {action.type === 'send_hubspot' && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {t('crm.automations.form.hubspotAction.intro')}
                    </p>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.hubspotAction.connection')}
                      </label>
                      {hubspotConnections.length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
                          {t('crm.automations.form.hubspotAction.noConnections')}{' '}
                          <a href="/app/integrations-hub" className="font-semibold underline">
                            {t('crm.automations.form.slackAction.openIntegrations')}
                          </a>
                        </div>
                      ) : (
                        <select
                          value={action.config.integrationConnectionId || ''}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'integrationConnectionId',
                              e.target.value || undefined,
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="">{t('crm.automations.form.hubspotAction.pickConnection')}</option>
                          {hubspotConnections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.hubspotAction.apiHostOverride')}
                      </label>
                      <input
                        type="url"
                        value={action.config.webhookUrl || ''}
                        onChange={(e) => updateAction(index, 'webhookUrl', e.target.value || undefined)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono"
                        placeholder="https://api.hubapi.com"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.hubspotAction.apiHostOverrideHint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.hubspotAction.accessToken')}
                      </label>
                      <input
                        type="password"
                        value={action.config.accessToken || ''}
                        onChange={(e) =>
                          updateAction(index, 'accessToken', e.target.value || undefined)
                        }
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.hubspotAction.httpMethod')}
                        </label>
                        <select
                          value={action.config.httpMethod || 'POST'}
                          onChange={(e) => updateAction(index, 'httpMethod', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PATCH">PATCH</option>
                          <option value="PUT">PUT</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.hubspotAction.apiPath')}
                        </label>
                        <input
                          value={action.config.apiPath || ''}
                          onChange={(e) => updateAction(index, 'apiPath', e.target.value)}
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                          placeholder={t('crm.automations.form.hubspotAction.apiPathPlaceholder')}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.hubspotAction.paramsJson')}
                      </label>
                      <textarea
                        value={action.config.paramsJson || ''}
                        onChange={(e) =>
                          updateAction(index, 'paramsJson', e.target.value || undefined)
                        }
                        rows={5}
                        className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl resize-none"
                        placeholder={'{\n  "properties": {\n    "email": "{{lead.email}}"\n  }\n}'}
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.hubspotAction.paramsJsonHint')}
                      </p>
                    </div>
                  </div>
                )}

                {action.type === 'send_google_ads' && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {t('crm.automations.form.googleAdsAction.intro')}
                    </p>
                    <div className="rounded-xl border border-sky-200 bg-sky-50/90 px-3 py-2.5 text-[11px] text-sky-950 leading-snug space-y-2">
                      <p className="font-medium">{t('crm.automations.form.googleAdsAction.forClientTitle')}</p>
                      <p className="text-sky-900/90">{t('crm.automations.form.googleAdsAction.forClientBody')}</p>
                      <button
                        type="button"
                        onClick={() =>
                          replaceActionAt(index, 'send_report', { ...QUICK_SEND_REPORT_ACTION_CONFIG })
                        }
                        className="text-left w-full sm:w-auto px-3 py-1.5 rounded-lg bg-white border border-sky-300 text-[10px] font-semibold text-sky-950 hover:bg-sky-100/80 transition-colors"
                      >
                        {t('crm.automations.form.googleAdsAction.switchToSendReport')}
                      </button>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.googleAdsAction.marketingIntegration')}
                      </label>
                      {marketingGoogleAdsIntegrations.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-700">
                          {t('crm.automations.form.googleAdsAction.noMarketingIntegrations')}{' '}
                          <a href="/app/integrations-hub?tab=marketing" className="font-semibold underline">
                            {t('crm.automations.form.openMarketingIntegrationsPage')}
                          </a>
                        </div>
                      ) : (
                        <select
                          value={action.config.marketingIntegrationId || ''}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'marketingIntegrationId',
                              e.target.value || undefined,
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="">
                            {t('crm.automations.form.googleAdsAction.pickMarketingIntegration')}
                          </option>
                          {marketingGoogleAdsIntegrations.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.googleAdsAction.marketingIntegrationHint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.googleAdsAction.connection')}
                      </label>
                      {action.config.marketingIntegrationId ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-[11px] text-emerald-950 leading-snug mb-2">
                          {t('crm.automations.form.googleAdsAction.usingMarketingCredentials')}
                        </div>
                      ) : null}
                      {googleAdsConnections.length === 0 ? (
                        action.config.marketingIntegrationId ? (
                          <p className="text-[10px] text-slate-500 leading-snug px-0.5">
                            {t('crm.automations.form.googleAdsAction.crmConnectionOptionalAbsent')}
                          </p>
                        ) : (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
                            {t('crm.automations.form.googleAdsAction.noConnections')}{' '}
                            <a href="/app/integrations-hub" className="font-semibold underline">
                              {t('crm.automations.form.slackAction.openIntegrations')}
                            </a>
                          </div>
                        )
                      ) : (
                        <select
                          value={action.config.integrationConnectionId || ''}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'integrationConnectionId',
                              e.target.value || undefined,
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="">{t('crm.automations.form.googleAdsAction.pickConnection')}</option>
                          {googleAdsConnections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.googleAdsAction.developerToken')}
                      </label>
                      <input
                        type="password"
                        value={action.config.developerToken || ''}
                        onChange={(e) =>
                          updateAction(index, 'developerToken', e.target.value || undefined)
                        }
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.googleAdsAction.developerTokenHint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.googleAdsAction.accessToken')}
                      </label>
                      <input
                        type="password"
                        value={action.config.accessToken || ''}
                        onChange={(e) =>
                          updateAction(index, 'accessToken', e.target.value || undefined)
                        }
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.googleAdsAction.customerId')}
                      </label>
                      <input
                        value={action.config.customerId || ''}
                        onChange={(e) =>
                          updateAction(index, 'customerId', e.target.value || undefined)
                        }
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                        placeholder="1234567890"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.googleAdsAction.customerIdHint')}
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.googleAdsAction.httpMethod')}
                        </label>
                        <select
                          value={action.config.httpMethod || 'POST'}
                          onChange={(e) => updateAction(index, 'httpMethod', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PATCH">PATCH</option>
                          <option value="PUT">PUT</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.googleAdsAction.apiPath')}
                        </label>
                        <input
                          value={action.config.apiPath || ''}
                          onChange={(e) => updateAction(index, 'apiPath', e.target.value)}
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                          placeholder={t('crm.automations.form.googleAdsAction.apiPathPlaceholder')}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.googleAdsAction.paramsJson')}
                      </label>
                      <textarea
                        value={action.config.paramsJson || ''}
                        onChange={(e) =>
                          updateAction(index, 'paramsJson', e.target.value || undefined)
                        }
                        rows={5}
                        className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl resize-none"
                        placeholder={'{\n  "query": "SELECT campaign.id FROM campaign"\n}'}
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.googleAdsAction.paramsJsonHint')}
                      </p>
                    </div>
                  </div>
                )}

                {action.type === 'send_meta_ads' && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {t('crm.automations.form.metaAdsAction.intro')}
                    </p>
                    <div className="rounded-xl border border-sky-200 bg-sky-50/90 px-3 py-2.5 text-[11px] text-sky-950 leading-snug space-y-2">
                      <p className="font-medium">{t('crm.automations.form.metaAdsAction.forClientTitle')}</p>
                      <p className="text-sky-900/90">{t('crm.automations.form.metaAdsAction.forClientBody')}</p>
                      <button
                        type="button"
                        onClick={() =>
                          replaceActionAt(index, 'send_report', { ...QUICK_SEND_REPORT_ACTION_CONFIG })
                        }
                        className="text-left w-full sm:w-auto px-3 py-1.5 rounded-lg bg-white border border-sky-300 text-[10px] font-semibold text-sky-950 hover:bg-sky-100/80 transition-colors"
                      >
                        {t('crm.automations.form.metaAdsAction.switchToSendReport')}
                      </button>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.metaAdsAction.marketingIntegration')}
                      </label>
                      {marketingMetaAdsIntegrations.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-700">
                          {t('crm.automations.form.metaAdsAction.noMarketingIntegrations')}{' '}
                          <a href="/app/integrations-hub?tab=marketing" className="font-semibold underline">
                            {t('crm.automations.form.openMarketingIntegrationsPage')}
                          </a>
                        </div>
                      ) : (
                        <select
                          value={action.config.marketingIntegrationId || ''}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'marketingIntegrationId',
                              e.target.value || undefined,
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="">
                            {t('crm.automations.form.metaAdsAction.pickMarketingIntegration')}
                          </option>
                          {marketingMetaAdsIntegrations.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.metaAdsAction.marketingIntegrationHint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.metaAdsAction.connection')}
                      </label>
                      {action.config.marketingIntegrationId ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-[11px] text-emerald-950 leading-snug mb-2">
                          {t('crm.automations.form.metaAdsAction.usingMarketingCredentials')}
                        </div>
                      ) : null}
                      {metaAdsConnections.length === 0 ? (
                        action.config.marketingIntegrationId ? (
                          <p className="text-[10px] text-slate-500 leading-snug px-0.5">
                            {t('crm.automations.form.metaAdsAction.crmConnectionOptionalAbsent')}
                          </p>
                        ) : (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
                            {t('crm.automations.form.metaAdsAction.noConnections')}{' '}
                            <a href="/app/integrations-hub" className="font-semibold underline">
                              {t('crm.automations.form.slackAction.openIntegrations')}
                            </a>
                          </div>
                        )
                      ) : (
                        <select
                          value={action.config.integrationConnectionId || ''}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'integrationConnectionId',
                              e.target.value || undefined,
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="">{t('crm.automations.form.metaAdsAction.pickConnection')}</option>
                          {metaAdsConnections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.metaAdsAction.accessToken')}
                      </label>
                      <input
                        type="password"
                        value={action.config.accessToken || ''}
                        onChange={(e) =>
                          updateAction(index, 'accessToken', e.target.value || undefined)
                        }
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.metaAdsAction.httpMethod')}
                        </label>
                        <select
                          value={action.config.httpMethod || 'GET'}
                          onChange={(e) => updateAction(index, 'httpMethod', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PATCH">PATCH</option>
                          <option value="PUT">PUT</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.metaAdsAction.apiPath')}
                        </label>
                        <input
                          value={action.config.apiPath || ''}
                          onChange={(e) => updateAction(index, 'apiPath', e.target.value)}
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                          placeholder={t('crm.automations.form.metaAdsAction.apiPathPlaceholder')}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.metaAdsAction.paramsJson')}
                      </label>
                      <textarea
                        value={action.config.paramsJson || ''}
                        onChange={(e) =>
                          updateAction(index, 'paramsJson', e.target.value || undefined)
                        }
                        rows={5}
                        className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl resize-none"
                        placeholder={'{\n  "name": "Кампания {{lead.name}}"\n}'}
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.metaAdsAction.paramsJsonHint')}
                      </p>
                    </div>
                  </div>
                )}

                {action.type === 'send_whatsapp' && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {t('crm.automations.form.whatsappAction.intro')}
                    </p>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.whatsappAction.connection')}
                      </label>
                      {whatsappConnections.length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
                          {t('crm.automations.form.whatsappAction.noConnections')}{' '}
                          <a href="/app/integrations-hub" className="font-semibold underline">
                            {t('crm.automations.form.slackAction.openIntegrations')}
                          </a>
                        </div>
                      ) : (
                        <select
                          value={action.config.integrationConnectionId || ''}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'integrationConnectionId',
                              e.target.value || undefined,
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="">{t('crm.automations.form.whatsappAction.pickConnection')}</option>
                          {whatsappConnections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.whatsappAction.phoneNumberId')}
                        </label>
                        <input
                          value={action.config.phoneNumberId || ''}
                          onChange={(e) =>
                            updateAction(index, 'phoneNumberId', e.target.value || undefined)
                          }
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                          placeholder="ID из Meta"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.whatsappAction.accessToken')}
                        </label>
                        <input
                          type="password"
                          value={action.config.accessToken || ''}
                          onChange={(e) =>
                            updateAction(index, 'accessToken', e.target.value || undefined)
                          }
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.whatsappAction.to')}
                      </label>
                      <input
                        value={action.config.to || ''}
                        onChange={(e) => updateAction(index, 'to', e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                        placeholder="+79990001122 или 79990001122"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.whatsappAction.toHint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.whatsappAction.text')}
                      </label>
                      <textarea
                        value={action.config.text || ''}
                        onChange={(e) => updateAction(index, 'text', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl resize-none"
                      />
                    </div>
                  </div>
                )}

                {action.type === 'send_google_calendar' && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {t('crm.automations.form.googleCalendarAction.intro')}
                    </p>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.googleCalendarAction.connection')}
                      </label>
                      {googleCalendarConnections.length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
                          {t('crm.automations.form.googleCalendarAction.noConnections')}{' '}
                          <a href="/app/integrations-hub" className="font-semibold underline">
                            {t('crm.automations.form.slackAction.openIntegrations')}
                          </a>
                        </div>
                      ) : (
                        <select
                          value={action.config.integrationConnectionId || ''}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'integrationConnectionId',
                              e.target.value || undefined,
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="">
                            {t('crm.automations.form.googleCalendarAction.pickConnection')}
                          </option>
                          {googleCalendarConnections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.googleCalendarAction.accessToken')}
                        </label>
                        <input
                          type="password"
                          value={action.config.accessToken || ''}
                          onChange={(e) =>
                            updateAction(index, 'accessToken', e.target.value || undefined)
                          }
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.googleCalendarAction.calendarId')}
                        </label>
                        <input
                          value={action.config.calendarId || ''}
                          onChange={(e) =>
                            updateAction(index, 'calendarId', e.target.value || undefined)
                          }
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                          placeholder="primary"
                        />
                        <p className="mt-1 text-[10px] text-slate-500">
                          {t('crm.automations.form.googleCalendarAction.calendarIdHint')}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.googleCalendarAction.summary')}
                      </label>
                      <input
                        value={action.config.summary || ''}
                        onChange={(e) => updateAction(index, 'summary', e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                        placeholder={t('crm.automations.form.googleCalendarAction.summaryPlaceholder')}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.googleCalendarAction.description')}
                      </label>
                      <textarea
                        value={action.config.description || ''}
                        onChange={(e) =>
                          updateAction(index, 'description', e.target.value || undefined)
                        }
                        rows={2}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl resize-none"
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.googleCalendarAction.durationMinutes')}
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={action.config.durationMinutes ?? 60}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'durationMinutes',
                              e.target.value === '' ? undefined : Number(e.target.value),
                            )
                          }
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.googleCalendarAction.startOffsetMinutes')}
                        </label>
                        <input
                          type="number"
                          value={action.config.startOffsetMinutes ?? 0}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'startOffsetMinutes',
                              e.target.value === '' ? undefined : Number(e.target.value),
                            )
                          }
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.googleCalendarAction.timeZone')}
                        </label>
                        <input
                          value={action.config.timeZone || ''}
                          onChange={(e) =>
                            updateAction(index, 'timeZone', e.target.value || undefined)
                          }
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                          placeholder="UTC"
                        />
                        <p className="mt-1 text-[10px] text-slate-500">
                          {t('crm.automations.form.googleCalendarAction.timeZoneHint')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {action.type === 'send_outlook_calendar' && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {t('crm.automations.form.outlookCalendarAction.intro')}
                    </p>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.outlookCalendarAction.connection')}
                      </label>
                      {outlookCalendarConnections.length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
                          {t('crm.automations.form.outlookCalendarAction.noConnections')}{' '}
                          <a href="/app/integrations-hub" className="font-semibold underline">
                            {t('crm.automations.form.slackAction.openIntegrations')}
                          </a>
                        </div>
                      ) : (
                        <select
                          value={action.config.integrationConnectionId || ''}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'integrationConnectionId',
                              e.target.value || undefined,
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="">
                            {t('crm.automations.form.outlookCalendarAction.pickConnection')}
                          </option>
                          {outlookCalendarConnections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.outlookCalendarAction.accessToken')}
                        </label>
                        <input
                          type="password"
                          value={action.config.accessToken || ''}
                          onChange={(e) =>
                            updateAction(index, 'accessToken', e.target.value || undefined)
                          }
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.outlookCalendarAction.calendarId')}
                        </label>
                        <input
                          value={action.config.calendarId || ''}
                          onChange={(e) =>
                            updateAction(index, 'calendarId', e.target.value || undefined)
                          }
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                        />
                        <p className="mt-1 text-[10px] text-slate-500">
                          {t('crm.automations.form.outlookCalendarAction.calendarIdHint')}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.outlookCalendarAction.summary')}
                      </label>
                      <input
                        value={action.config.summary || ''}
                        onChange={(e) => updateAction(index, 'summary', e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                        placeholder={t(
                          'crm.automations.form.outlookCalendarAction.summaryPlaceholder',
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.outlookCalendarAction.description')}
                      </label>
                      <textarea
                        value={action.config.description || ''}
                        onChange={(e) =>
                          updateAction(index, 'description', e.target.value || undefined)
                        }
                        rows={2}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl resize-none"
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.outlookCalendarAction.durationMinutes')}
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={action.config.durationMinutes ?? 60}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'durationMinutes',
                              e.target.value === '' ? undefined : Number(e.target.value),
                            )
                          }
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.outlookCalendarAction.startOffsetMinutes')}
                        </label>
                        <input
                          type="number"
                          value={action.config.startOffsetMinutes ?? 0}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'startOffsetMinutes',
                              e.target.value === '' ? undefined : Number(e.target.value),
                            )
                          }
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {t('crm.automations.form.outlookCalendarAction.timeZoneHint')}
                    </p>
                  </div>
                )}

                {action.type === 'send_slack' && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {t('crm.automations.form.slackAction.intro')}
                    </p>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.slackAction.connection')}
                      </label>
                      {slackConnections.length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900">
                          {t('crm.automations.form.slackAction.noConnections')}{' '}
                          <a href="/app/integrations-hub" className="font-semibold underline">
                            {t('crm.automations.form.slackAction.openIntegrations')}
                          </a>
                        </div>
                      ) : (
                        <select
                          value={action.config.integrationConnectionId || ''}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'integrationConnectionId',
                              e.target.value || undefined,
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="">{t('crm.automations.form.slackAction.pickConnection')}</option>
                          {slackConnections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.slackAction.webhookOverride')}
                      </label>
                      <input
                        type="url"
                        value={action.config.webhookUrl || ''}
                        onChange={(e) => updateAction(index, 'webhookUrl', e.target.value || undefined)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 font-mono placeholder-slate-400"
                        placeholder="https://hooks.slack.com/services/…"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        {t('crm.automations.form.slackAction.webhookOverrideHint')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.slackAction.text')}
                      </label>
                      <textarea
                        value={action.config.text || ''}
                        onChange={(e) => updateAction(index, 'text', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 resize-none"
                        placeholder={t('crm.automations.form.slackAction.textPlaceholder')}
                      />
                    </div>
                  </div>
                )}

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
                          <option value="marketing">{t('crm.automations.form.report.types.marketing')}</option>
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

                    {(action.config.reportType || 'sales') === 'marketing' && (
                      <p className="text-[10px] text-slate-500 leading-snug rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                        {t('crm.automations.form.report.marketingHint')}
                      </p>
                    )}

                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 space-y-2">
                      <div className="text-[11px] font-medium text-slate-700">
                        {t('crm.automations.form.report.dataRangeTitle')}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-snug">
                        {t('crm.automations.form.report.dataRangeHint')}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            {t('crm.automations.form.report.dataRangeFrom')}
                          </label>
                          <input
                            type="date"
                            value={(action.config.reportDateFrom as string) || ''}
                            onChange={(e) =>
                              updateAction(
                                index,
                                'reportDateFrom',
                                e.target.value ? e.target.value : undefined,
                              )
                            }
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            {t('crm.automations.form.report.dataRangeTo')}
                          </label>
                          <input
                            type="date"
                            value={(action.config.reportDateTo as string) || ''}
                            onChange={(e) =>
                              updateAction(
                                index,
                                'reportDateTo',
                                e.target.value ? e.target.value : undefined,
                              )
                            }
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                          />
                        </div>
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
                          <option value="daily">{t('crm.automations.form.report.frequencies.daily')}</option>
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

                    {((action.config.scheduleFrequency || 'weekly') === 'monthly' ||
                      (action.config.scheduleFrequency || 'weekly') === 'quarterly') && (
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

                {action.type === 'send_data_export' && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {t('crm.automations.form.dataExport.intro')}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.dataExport.channel')}
                        </label>
                        <select
                          value={action.config.channel || 'email'}
                          onChange={(e) => updateAction(index, 'channel', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                        >
                          <option value="email">{t('crm.automations.form.dataExport.channelEmail')}</option>
                          <option value="telegram">{t('crm.automations.form.dataExport.channelTelegram')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.dataExport.subject')}
                        </label>
                        <input
                          type="text"
                          value={action.config.subject || ''}
                          onChange={(e) => updateAction(index, 'subject', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                          placeholder="Google Ads · выгрузка"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.dataExport.fromPath')}
                      </label>
                      <input
                        type="text"
                        value={action.config.fromPath || ''}
                        onChange={(e) => updateAction(index, 'fromPath', e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono text-slate-900"
                        placeholder="lastActionResult.data"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">{t('crm.automations.form.dataExport.fromPathHint')}</p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        checked={action.config.unwrapData !== false}
                        onChange={(e) => updateAction(index, 'unwrapData', e.target.checked)}
                      />
                      {t('crm.automations.form.dataExport.unwrap')}
                    </label>
                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(action.config.formatJson)}
                          onChange={(e) => updateAction(index, 'formatJson', e.target.checked)}
                        />
                        {t('crm.automations.form.dataExport.formatJson')}
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(action.config.formatXlsx)}
                          onChange={(e) => updateAction(index, 'formatXlsx', e.target.checked)}
                        />
                        {t('crm.automations.form.dataExport.formatXlsx')}
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(action.config.formatPdf)}
                          onChange={(e) => updateAction(index, 'formatPdf', e.target.checked)}
                        />
                        {t('crm.automations.form.dataExport.formatPdf')}
                      </label>
                    </div>
                    {action.config.channel !== 'telegram' && (
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1.5">
                            {t('crm.automations.form.emailAction.account')}
                          </label>
                          <select
                            value={action.config.accountId || ''}
                            onChange={(e) => updateAction(index, 'accountId', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
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
                          <label className="block text-[11px] text-slate-400 mb-1.5">
                            {t('crm.automations.form.dataExport.to')}
                          </label>
                          <input
                            type="text"
                            value={action.config.to || ''}
                            onChange={(e) => updateAction(index, 'to', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                            placeholder="ops@company.com"
                          />
                        </div>
                      </div>
                    )}
                    {action.config.channel === 'telegram' && (
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1.5">
                            {t('crm.automations.form.dataExport.botId')}
                          </label>
                          <input
                            type="text"
                            value={action.config.botId || ''}
                            onChange={(e) => updateAction(index, 'botId', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1.5">
                            {t('crm.automations.form.dataExport.telegramUserId')}
                          </label>
                          <input
                            type="text"
                            value={action.config.telegramUserId || ''}
                            onChange={(e) => updateAction(index, 'telegramUserId', e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono"
                          />
                        </div>
                        <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                          {t('crm.automations.form.dataExport.telegramFilesHint')}
                        </p>
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

                {action.type === 'change_status' && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1.5">
                      {t('crm.automations.form.statusAction.status')}
                    </label>
                    <input
                      type="text"
                      value={action.config.status || ''}
                      onChange={(e) => updateAction(index, 'status', e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                      placeholder="new / qualified / …"
                    />
                  </div>
                )}

                {action.type === 'update_field' && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.fieldAction.field')}
                      </label>
                      <input
                        type="text"
                        value={action.config.field || ''}
                        onChange={(e) => updateAction(index, 'field', e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.fieldAction.value')}
                      </label>
                      <input
                        type="text"
                        value={
                          action.config.value !== undefined && action.config.value !== null
                            ? String(action.config.value)
                            : ''
                        }
                        onChange={(e) => updateAction(index, 'value', e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                      />
                    </div>
                  </div>
                )}

                {action.type === 'add_tag' && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1.5">{t('crm.automations.form.tagAction.tag')}</label>
                    <input
                      type="text"
                      value={action.config.tag || ''}
                      onChange={(e) => updateAction(index, 'tag', e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                    />
                  </div>
                )}

                {action.type === 'create_task' && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500">{t('crm.automations.form.taskAction.hint')}</p>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.taskAction.companyId')}
                      </label>
                      <input
                        type="text"
                        value={action.config.companyId || ''}
                        onChange={(e) => updateAction(index, 'companyId', e.target.value || undefined)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors font-mono"
                        placeholder="UUID компании"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.taskAction.title')}
                      </label>
                      <input
                        type="text"
                        value={action.config.title || ''}
                        onChange={(e) => updateAction(index, 'title', e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        {t('crm.automations.form.taskAction.description')}
                      </label>
                      <textarea
                        value={action.config.description || ''}
                        onChange={(e) => updateAction(index, 'description', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 transition-colors resize-none"
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.taskAction.status')}
                        </label>
                        <select
                          value={action.config.status || 'todo'}
                          onChange={(e) => updateAction(index, 'status', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        >
                          <option value="todo">todo</option>
                          <option value="in_progress">in_progress</option>
                          <option value="done">done</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.taskAction.priority')}
                        </label>
                        <input
                          type="number"
                          value={action.config.priority ?? ''}
                          onChange={(e) =>
                            updateAction(
                              index,
                              'priority',
                              e.target.value === '' ? undefined : Number(e.target.value),
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.taskAction.dueDate')}
                        </label>
                        <input
                          type="datetime-local"
                          value={action.config.dueDate || ''}
                          onChange={(e) => updateAction(index, 'dueDate', e.target.value || undefined)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1.5">
                          {t('crm.automations.form.taskAction.assignee')}
                        </label>
                        <input
                          type="text"
                          value={action.config.assignedUserId || ''}
                          onChange={(e) =>
                            updateAction(index, 'assignedUserId', e.target.value || undefined)
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 font-mono"
                        />
                      </div>
                    </div>
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
