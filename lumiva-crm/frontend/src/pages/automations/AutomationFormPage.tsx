// src/pages/automations/AutomationFormPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useLocation, useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  fetchAutomation,
  createAutomation,
  updateAutomation,
  fetchAutomationExecutions,
  type Action,
  type AutomationExecution,
  type Condition,
  type CreateAutomationDto,
  type TriggerEvent,
  type ActionType,
} from '../../api/automations';
import { fetchLeadById, type Lead } from '../../api/leads';
import { fetchEmailAccounts, type EmailAccount, fetchEmailTemplates, type EmailTemplate } from '../../api/email';
import { fetchIntegrations, type IntegrationConnectionDto } from '../../api/integrations';
import {
  fetchMarketingIntegrations,
  type MarketingIntegrationRow,
} from '../../api/marketing';
import {
  fetchTelegramBots,
  fetchTelegramBotRecipients,
  type TelegramBot,
  type TelegramStaffRecipient,
} from '../../api/telegram-crm';
import { StaffPicker } from '../../components/StaffPicker';
import { buildAutomationTemplatePresets } from './automationTemplatePresets';
import { buildAutomationTriggerGroups, buildAutomationActionGroups } from './automationBuilderGroups';
import { getActionLabel } from './automationLabels';
import './automations-builder.css';

export const AutomationFormPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const leadIdFromQuery = searchParams.get('leadId');
  const templateParam = searchParams.get('template');
  const leadWeeklyPresetAppliedRef = useRef(false);
  const [leadFromQuery, setLeadFromQuery] = useState<Lead | null>(null);
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
  const [selectedStep, setSelectedStep] = useState<'trigger' | number>('trigger');
  const [libSearch, setLibSearch] = useState('');
  const [libTab, setLibTab] = useState<'trigger' | 'action'>('trigger');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerInsertAt, setPickerInsertAt] = useState<number>(0);
  const [pickerPos, setPickerPos] = useState<{x: number; y: number} | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerTab, setPickerTab] = useState<'action' | 'trigger'>('action');
  const [cfgTab, setCfgTab] = useState<'params' | 'conditions' | 'logs'>('params');
  const [testVisible, setTestVisible] = useState(false);
  const [testResult, setTestResult] = useState<{errors: string[]; warnings: string[]} | null>(null);
  const [execLogs, setExecLogs] = useState<AutomationExecution[]>([]);
  const [execLogsLoading, setExecLogsLoading] = useState(false);
  const [telegramBots, setTelegramBots] = useState<TelegramBot[]>([]);
  const [botRecipients, setBotRecipients] = useState<Record<string, TelegramStaffRecipient[]>>({});

  // design tokens for builder
  const INK = '#222';
  const FG2 = '#555';
  const FG3 = '#888';
  const FG4 = '#b5b5b5';
  const LINE2 = '#e7e7e7';
  const LINE3 = '#f0f0f0';
  const BG_MUTED = '#fafafa';
  const BG_SOFT = '#f5f5f5';
  const FFD = 'inherit';
  const FFM = 'inherit';

  const cfgInput: React.CSSProperties = {
    fontFamily: FFD, fontSize: 12, width: '100%', padding: '8px 11px',
    border: `1px solid ${LINE2}`, borderRadius: 7, color: INK, background: '#fff',
    outline: 'none', boxSizing: 'border-box',
  };
  const cfgSelect: React.CSSProperties = { ...cfgInput, cursor: 'pointer', appearance: 'auto' as any };
  const cfgLabel: React.CSSProperties = { fontFamily: FFD, fontSize: 11, color: FG2, fontWeight: 500, display: 'block', marginBottom: 5 };
  const reportCurrencies = ['EUR', 'USD', 'RUB'];

  const [formData, setFormData] = useState<CreateAutomationDto>({
    name: '',
    description: '',
    triggerEvent: 'contact.created' as TriggerEvent,
    conditions: [],
    actions: [{ type: 'trigger_webhook' as ActionType, config: {} }],
    isActive: true,
  });

  const templatePresets = useMemo(() => buildAutomationTemplatePresets(t), [t]);
  const triggerGroups = useMemo(() => buildAutomationTriggerGroups(t), [t]);
  const actionGroups = useMemo(() => buildAutomationActionGroups(t), [t]);

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
    if (leadIdFromQuery) return;
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
    const action = params.get('action');
    if (action) {
      setFormData((prev) => ({
        ...prev,
        triggerEvent: 'lead.created',
        actions: [{ type: action as ActionType, config: {} }],
      }));
      setTimeout(() => { setSelectedStep(0); }, 50);
    }
  }, [id, location.search, leadIdFromQuery]);

  /** From lead card: weekly schedule + email to this lead; server honors meta.contextLeadId for cron. */
  useEffect(() => {
    if (id || !leadIdFromQuery || leadWeeklyPresetAppliedRef.current) return;
    leadWeeklyPresetAppliedRef.current = true;
    fetchLeadById(leadIdFromQuery)
      .then((lead) => {
        setLeadFromQuery(lead);
        setFormData((prev) => ({
          ...prev,
          name:
            prev.name?.trim() ||
            t('crm.automations.form.leadContext.defaultName', {
              name: lead.name?.trim() || lead.email?.trim() || leadIdFromQuery,
            }),
          description:
            prev.description?.trim() ||
            t('crm.automations.form.leadContext.defaultDescription'),
          triggerEvent: 'scheduled',
          meta: {
            contextLeadId: lead.id,
            schedule: {
              scheduleFrequency: 'weekly',
              scheduleTime: '09:00',
              scheduleTimezone: 'Europe/Moscow',
              scheduleDayOfWeek: 1,
              scheduleDayOfMonth: 1,
            },
          },
          actions: [{ type: 'send_email', config: { to: lead.email || '' } }],
        }));
        setExpandedActionIndex(0);
      })
      .catch(() => {
        leadWeeklyPresetAppliedRef.current = false;
        setError(t('crm.automations.form.leadContext.loadFailed'));
      });
  }, [id, leadIdFromQuery, t]);

  useEffect(() => {
    if (id || !templateParam) return;
    const preset = templatePresets[templateParam];
    if (!preset) return;
    setFormData(prev => ({
      ...prev,
      name: prev.name || preset.name,
      triggerEvent: preset.triggerEvent,
      actions: preset.actions as Action[],
    }));
  }, [id, templateParam, templatePresets]);

  useEffect(() => { setCfgTab('params'); }, [selectedStep]);

  // Load email accounts and templates
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
    fetchEmailTemplates(true) // Active templates only
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

    fetchTelegramBots().then((bots) => setTelegramBots(bots)).catch(() => {});
  }, []);

  const loadBotRecipients = (botId: string) => {
    if (botRecipients[botId]) return;
    fetchTelegramBotRecipients(botId).then((rows) =>
      setBotRecipients((prev) => ({ ...prev, [botId]: rows })),
    );
  };

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

  const jiraConnections = useMemo(
    () =>
      crmIntegrations.filter(
        (c) => c.kind === 'third_party_link' && c.linkCatalogId === 'jira',
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
          ...(typeof prev.meta === 'object' && prev.meta && !Array.isArray(prev.meta)
            ? (prev.meta as Record<string, unknown>)
            : {}),
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

  const duplicateAction = (index: number) => {
    setFormData((prev) => {
      const src = prev.actions[index];
      const copy: Action = { type: src.type, config: { ...src.config } };
      const next = [...prev.actions];
      next.splice(index + 1, 0, copy);
      setTimeout(() => setSelectedStep(index + 1), 0);
      return { ...prev, actions: next };
    });
  };

  const runValidation = (): { errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const stepLabel = (n: number) => t('crm.automations.form.validation.stepLabel', { n });
    if (!formData.name.trim()) errors.push(t('crm.automations.form.validation.nameRequired'));
    if (formData.actions.length === 0) errors.push(t('crm.automations.form.validation.noActions'));
    formData.actions.forEach((action, i) => {
      const label = stepLabel(i + 2);
      if (action.type === 'trigger_webhook' && !action.config.url)
        errors.push(`${label}: ${t('crm.automations.form.validation.webhookUrlMissing')}`);
      if (action.type === 'send_email') {
        if (!action.config.accountId) errors.push(`${label}: ${t('crm.automations.form.validation.emailAccountMissing')}`);
        if (!action.config.to && !action.config.templateId)
          warnings.push(`${label}: ${t('crm.automations.form.validation.emailRecipientOrTemplateWarning')}`);
      }
      if (action.type === 'send_telegram') {
        const legacy = !!action.config.telegramUserId;
        const modern =
          !!action.config.botId &&
          Array.isArray(action.config.recipientIds) &&
          action.config.recipientIds.length > 0;
        if (!legacy && !modern)
          errors.push(`${label}: ${t('crm.automations.form.validation.telegramRecipientMissing')}`);
      }
      if (action.type === 'send_slack' && !action.config.integrationConnectionId && !action.config.webhookUrl)
        errors.push(`${label}: ${t('crm.automations.form.validation.slackConnectionMissing')}`);
      if (action.type === 'send_teams' && !action.config.integrationConnectionId && !action.config.webhookUrl)
        errors.push(`${label}: ${t('crm.automations.form.validation.teamsConnectionMissing')}`);
      if (action.type === 'create_task' && !action.config.title)
        warnings.push(`${label}: ${t('crm.automations.form.validation.taskTitleWarning')}`);
      if (action.type === 'create_note' && !action.config.content)
        warnings.push(`${label}: ${t('crm.automations.form.validation.noteContentWarning')}`);
      if (action.type === 'send_report' && !action.config.reportType)
        errors.push(`${label}: ${t('crm.automations.form.validation.reportTypeMissing')}`);
      if (action.type === 'create_jira_issue' && !action.config.integrationConnectionId)
        errors.push(`${label}: Выберите подключение Jira`);
    });
    return { errors, warnings };
  };

  const loadExecLogs = () => {
    if (!id) return;
    setExecLogsLoading(true);
    fetchAutomationExecutions(id, 20)
      .then((rows) => setExecLogs(rows))
      .catch(() => {})
      .finally(() => setExecLogsLoading(false));
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
      if (action.type === 'create_custom_object_record')
        return (
          action.config.targetObjectId ||
          t('crm.automations.form.builder.noConfig')
        );
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


  // ─── module-level helpers referenced inside return ──────────────────────
  const Ic = ({ d, s = 16 }: { d: React.ReactNode; s?: number }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0 }}>
      {d}
    </svg>
  );

  const IC: Record<string, React.ReactNode> = {
    back:     <path d="M15 6l-6 6 6 6"/>,
    plus:     <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    trash:    <><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"/></>,
    copy:     <><rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/></>,
    bolt:     <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>,
    gear:     <><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></>,
    search:   <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></>,
    mail:     <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></>,
    tg:       <path d="M21 4L3 11l6 2 2 6 3-4 5 5 2-16z"/>,
    task:     <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12l3 3 5-5"/></>,
    clock:    <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    contact:  <><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3 3-5.5 6-5.5s6 2.5 6 5.5"/></>,
    lead:     <><path d="M3 12c0-5 4-9 9-9s9 4 9 9-4 9-9 9"/><path d="M3 12l4-4m-4 4 4 4"/></>,
    sale:     <><path d="M4 7h16"/><path d="M6 7v11a2 2 0 002 2h8a2 2 0 002-2V7"/><path d="M9 7V5a3 3 0 016 0v2"/></>,
    webhook:  <><circle cx="6" cy="14" r="3"/><circle cx="18" cy="14" r="3"/><circle cx="12" cy="6" r="3"/><path d="M12 9l-3 5m6 0H9"/></>,
    code:     <><path d="M8 8l-5 4 5 4"/><path d="M16 8l5 4-5 4"/><path d="M14 4l-4 16"/></>,
    flask:    <><path d="M9 3v6L4 19a2 2 0 002 2h12a2 2 0 002-2L15 9V3"/><path d="M9 3h6"/></>,
    note:     <><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 7h8M8 12h8M8 17h5"/></>,
    report:   <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
    tag:      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>,
    user:     <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-7 7-7s7 3 7 7"/></>,
    bell:     <><path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21a2 2 0 004 0"/></>,
    slack:    <><rect x="9" y="3" width="3" height="9" rx="1.5"/><rect x="12" y="12" width="3" height="9" rx="1.5"/><rect x="3" y="9" width="9" height="3" rx="1.5"/><rect x="12" y="3" width="9" height="3" rx="1.5"/></>,
    teams:    <><rect x="3" y="6" width="13" height="12" rx="1.5"/><path d="M16 9h4v6h-4"/><path d="M9 10v4M7 12h4"/></>,
    whatsapp: <><path d="M21 12a9 9 0 11-3.5-7.1L21 4l-1 4.1A9 9 0 0121 12z"/><path d="M8 11c0 4 3 6 6.5 6"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></>,
    export:   <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
    globe:    <><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a13 13 0 010 18M12 3a13 13 0 000 18"/></>,
    api:      <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/></>,
    update:   <><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></>,
    x:        <><path d="M18 6L6 18M6 6l12 12"/></>,
    custom:   <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8M12 8v8"/></>,
    zapier:   <><circle cx="12" cy="12" r="9"/><path d="M9 6l6 6-6 6"/></>,
  };

  const getActionIcon = (type: string): React.ReactNode => {
    const map: Record<string, string> = {
      send_email: 'mail', send_telegram: 'tg', send_slack: 'slack', send_teams: 'teams',
      send_whatsapp: 'whatsapp', send_notification: 'bell', create_task: 'task',
      create_note: 'note', change_status: 'update', update_field: 'update',
      add_tag: 'tag', remove_tag: 'tag', assign_user: 'user', assign_task: 'task',
      create_custom_object_record: 'custom', send_report: 'report', send_data_export: 'export',
      trigger_webhook: 'webhook', send_mailchimp: 'mail', send_mailchimp_campaign: 'mail',
      send_zapier: 'zapier', send_bitrix: 'api', send_amocrm: 'api', send_hubspot: 'api',
      send_google_ads: 'globe', send_meta_ads: 'globe',
      send_google_calendar: 'calendar', send_outlook_calendar: 'calendar',
    };
    return IC[map[type] || 'bolt'] ?? IC.bolt;
  };

  const selIdx = typeof selectedStep === 'number' ? selectedStep : null;
  const selAction = selIdx !== null && selIdx < formData.actions.length
    ? formData.actions[selIdx] : null;

  const handleLibTrigger = (event: TriggerEvent) => {
    onTriggerEventChange(event);
    setSelectedStep('trigger');
  };

  const handleLibAction = (type: ActionType) => {
    const idx = formData.actions.length;
    addActionByType(type);
    setSelectedStep(idx);
  };

  const ua = (field: string, val: any) => updateAction(selIdx!, field, val);

  return (
    <MainLayout>
      <div className="ab-root ab-wrap">

        {/* ── Error banner ── */}
        {error && (
          <div className="ab-banner-error">{error}</div>
        )}

        {/* ── Lead context banner ── */}
        {leadFromQuery && (
          <div className="ab-banner-lead">
            <span>
              <strong>{t('crm.automations.form.leadContext.bannerTitle', { name: leadFromQuery.name?.trim() || leadFromQuery.email || leadFromQuery.id })}</strong>
              {' · '}{t('crm.automations.form.leadContext.bannerBody')}
              {!leadFromQuery.email?.trim() && (
                <span style={{ marginLeft: 8, color: '#b45309', fontWeight: 500 }}>
                  ⚠ {t('crm.automations.form.leadContext.noEmailWarning')}
                </span>
              )}
            </span>
            <Link to={`/app/leads/${leadFromQuery.id}`} className="ab-banner-lead a">
              ← {t('crm.automations.form.leadContext.backToLead')}
            </Link>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TOP STRIP
        ══════════════════════════════════════════ */}
        <div className="auto-strip">
          <button type="button" className="auto-strip-back" onClick={() => navigate('/app/automations')} title={t('crm.automations.form.builderUi.stripBackTitle')}>
            <Ic d={IC.back} s={16} />
          </button>

          <div className="auto-strip-name">
            <input
              className="name-input"
              value={formData.name}
              onChange={e => handleChange('name', e.target.value)}
              placeholder={t('crm.automations.form.fields.name')}
            />
            <div className="auto-strip-meta">
              <span className={`dot${formData.isActive ? ' live' : ''}`} />
              <span>{formData.isActive ? t('crm.automations.form.builderUi.stripActive') : t('crm.automations.form.builderUi.stripDraft')}</span>
            </div>
          </div>

          <div className="auto-strip-actions">
            <div className="auto-mode">
              <button type="button" className="active"><Ic d={IC.bolt} s={11} />{t('crm.automations.form.builderUi.stripBuilderTab')}</button>
              <button type="button"><Ic d={IC.code} s={11} />{t('crm.automations.form.builderUi.stripJsonTab')}</button>
            </div>
            <button
              type="button"
              className={`auto-toggle${formData.isActive ? ' on' : ''}`}
              onClick={() => handleChange('isActive', !formData.isActive)}
            >
              <span className="sw" />
              {formData.isActive ? t('crm.automations.form.builderUi.stripEnabled') : t('crm.automations.form.builderUi.stripDisabled')}
            </button>
            <button type="button" className="ab-btn ab-btn-sm" onClick={() => { setTestResult(runValidation()); setTestVisible(true); }}><Ic d={IC.flask} s={12} />{t('crm.automations.form.builderUi.stripTest')}</button>
            <button
              type="button"
              className="ab-btn ab-btn-primary ab-btn-sm"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? t('crm.automations.form.actions.saving') : id ? t('crm.automations.form.actions.save') : t('crm.automations.form.actions.create')}
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            3-COLUMN BUILDER
        ══════════════════════════════════════════ */}
        <div className="auto-builder">

          {/* ── LEFT: Library ── */}
          <aside className="auto-lib">
            <div className="auto-lib-head">
              <h3>{t('crm.automations.form.builderUi.libraryTitle')}</h3>
              <p>{t('crm.automations.form.builderUi.librarySubtitle')}</p>
            </div>
            <div className="auto-lib-search">
              <Ic d={IC.search} s={13} />
              <input
                placeholder={t('crm.automations.form.builderUi.librarySearchPlaceholder')}
                value={libSearch}
                onChange={e => setLibSearch(e.target.value)}
              />
            </div>
            <div className="auto-lib-tabs">
              <button className={libTab === 'trigger' ? 'active' : ''} onClick={() => setLibTab('trigger')}>
                <Ic d={IC.lead} s={11} />{t('crm.automations.form.builderUi.tabTriggers')}
              </button>
              <button className={libTab === 'action' ? 'active' : ''} onClick={() => setLibTab('action')}>
                <Ic d={IC.bolt} s={11} />{t('crm.automations.form.builderUi.tabActions')}
              </button>
            </div>

            {(libTab === 'trigger' ? triggerGroups : actionGroups).map(group => {
              const items = libSearch.trim()
                ? group.items.filter((it: any) => it.label.toLowerCase().includes(libSearch.toLowerCase()))
                : group.items;
              if (!items.length) return null;
              return (
                <div key={group.group} className="auto-lib-section">
                  <div className="auto-lib-section-title">{group.group}</div>
                  {items.map((it: any) => (
                    <div
                      key={it.id}
                      className={`auto-lib-item${libTab === 'action' ? ' action' : ''}`}
                      onClick={() => libTab === 'trigger'
                        ? handleLibTrigger(it.id as TriggerEvent)
                        : handleLibAction(it.id as ActionType)
                      }
                    >
                      <div className="lib-ic"><Ic d={IC[it.icon] ?? IC.bolt} s={13} /></div>
                      <div className="lib-body">
                        <div className="lib-name">{it.label}</div>
                        {it.desc && <div className="lib-desc">{it.desc}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </aside>

          {/* ── CENTER: Flow canvas ── */}
          <main className="auto-flow" onClick={() => setSelectedStep('trigger')}>
            <div className="flow-step-wrap">

              {/* Trigger card */}
              <div
                className={`flow-step trigger${selectedStep === 'trigger' ? ' selected' : ''}`}
                onClick={e => { e.stopPropagation(); setSelectedStep('trigger'); }}
              >
                <div className="flow-step-head">
                  <div className="flow-step-ic"><Ic d={IC.bolt} s={16} /></div>
                  <div className="flow-step-body">
                    <div className="flow-step-kind"><span className="num">1</span>{t('crm.automations.form.builderUi.flowTrigger')}</div>
                    <div className="flow-step-name">{getTriggerEventLabel(formData.triggerEvent)}</div>
                    <div className="flow-step-meta">
                      <span className="chip">{formData.triggerEvent}</span>
                      {formData.triggerEvent === 'scheduled' && (
                        <span className="chip">{scheduledCfg.scheduleFrequency || 'weekly'} · {scheduledCfg.scheduleTime || '09:00'}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action cards */}
              {formData.actions.map((action, i) => (
                <React.Fragment key={i}>
                  <div className="flow-connector">
                    <button
                      type="button"
                      className="flow-add"
                      title={t('crm.automations.form.builderUi.insertStepTitle')}
                      onClick={e => {
                        e.stopPropagation();
                        const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        setPickerPos({ x: Math.min(r.right + 8, window.innerWidth - 500), y: r.top });
                        setPickerInsertAt(i);
                        setPickerSearch('');
                        setPickerTab('action');
                        setShowPicker(true);
                      }}
                    >
                      <Ic d={IC.plus} s={12} />
                    </button>
                  </div>
                  <div
                    className={`flow-step action${selectedStep === i ? ' selected' : ''}`}
                    onClick={e => { e.stopPropagation(); setSelectedStep(i); setExpandedActionIndex(i); }}
                  >
                    <div className="flow-step-head">
                      <div className="flow-step-ic"><Ic d={getActionIcon(action.type)} s={16} /></div>
                      <div className="flow-step-body">
                        <div className="flow-step-kind"><span className="num">{i + 2}</span>{t('crm.automations.form.builderUi.flowAction')}</div>
                        <div className="flow-step-name">{getActionTypeLabel(action.type as ActionType)}</div>
                        <div className="flow-step-meta">
                          <span className="chip">{actionSummary[i] || t('crm.automations.form.builder.notConfigured')}</span>
                        </div>
                      </div>
                      <div className="flow-step-actions" onClick={e => e.stopPropagation()}>
                        {i > 0 && (
                          <button title={t('crm.automations.form.builderUi.titleMoveUp')} onClick={() => moveAction(i, i - 1)}>
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
                          </button>
                        )}
                        {i < formData.actions.length - 1 && (
                          <button title={t('crm.automations.form.builderUi.titleMoveDown')} onClick={() => moveAction(i, i + 1)}>
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                          </button>
                        )}
                        <button title={t('crm.automations.form.builderUi.titleDuplicate')} onClick={() => duplicateAction(i)}>
                          <Ic d={IC.copy} s={12} />
                        </button>
                        <button className="danger" title={t('crm.automations.form.builderUi.titleDelete')} onClick={() => { removeAction(i); setSelectedStep('trigger'); }}>
                          <Ic d={IC.trash} s={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              ))}

              {/* Add action connector */}
              <div className="flow-connector">
                <button
                  type="button"
                  className="flow-add"
                  title={t('crm.automations.form.builderUi.titleAddAction')}
                  onClick={e => {
                    e.stopPropagation();
                    const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                    setPickerPos({ x: Math.min(r.right + 8, window.innerWidth - 500), y: r.top });
                    setPickerInsertAt(formData.actions.length);
                    setPickerSearch('');
                    setPickerTab('action');
                    setShowPicker(true);
                  }}
                >
                  <Ic d={IC.plus} s={12} />
                </button>
              </div>

              <div className="flow-end">{t('crm.automations.form.builderUi.flowEnd')}</div>
            </div>
          </main>

          {/* ── RIGHT: Config panel ── */}
          <aside className="auto-cfg">

            {/* Empty state */}
            {selectedStep === null && (
              <div className="auto-cfg-empty">
                <div className="cfg-empty-ic"><Ic d={IC.gear} s={20} /></div>
                <div className="cfg-empty-title">{t('crm.automations.form.builderUi.cfgEmptyTitle')}</div>
                {t('crm.automations.form.builderUi.cfgEmptyHint')}
              </div>
            )}

            {/* ── TRIGGER config ── */}
            {selectedStep === 'trigger' && (
              <>
                <div className="auto-cfg-head">
                  <div className="ic trigger"><Ic d={IC.bolt} s={16} /></div>
                  <div className="body">
                    <div className="kind">{t('crm.automations.form.builderUi.triggerStepCaption', { total: formData.actions.length + 1 })}</div>
                    <div className="ttl">{getTriggerEventLabel(formData.triggerEvent)}</div>
                  </div>
                </div>
                <div className="auto-cfg-tabs">
                  <button className={cfgTab === 'params' ? 'active' : ''} onClick={() => setCfgTab('params')}>{t('crm.automations.form.builderUi.cfgTabParams')}</button>
                  <button className={cfgTab === 'conditions' ? 'active' : ''} onClick={() => setCfgTab('conditions')}>{t('crm.automations.form.builderUi.cfgTabConditions')}</button>
                  <button className={cfgTab === 'logs' ? 'active' : ''} onClick={() => { setCfgTab('logs'); loadExecLogs(); }}>{t('crm.automations.form.builderUi.cfgTabLogs')}</button>
                </div>
                <div className="auto-cfg-body">
                  {cfgTab === 'params' && <>
                  <div className="cfg-field">
                    <label className="cfg-field-label">{t('crm.automations.form.builderUi.triggerFieldLabel')} <span className="req">*</span></label>
                    <select className="cfg-select" value={formData.triggerEvent} onChange={e => onTriggerEventChange(e.target.value as TriggerEvent)}>
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
                        <option value="custom_object.record_created">{t('crm.automations.form.triggers.CUSTOM_OBJECT_RECORD_CREATED')}</option>
                        <option value="custom_object.record_updated">{t('crm.automations.form.triggers.CUSTOM_OBJECT_RECORD_UPDATED')}</option>
                        <option value="custom_object.status_changed">{t('crm.automations.form.triggers.CUSTOM_OBJECT_STATUS_CHANGED')}</option>
                      </optgroup>
                    </select>
                  </div>

                  {/* Scheduled settings */}
                  {formData.triggerEvent === 'scheduled' && (
                    <>
                      <div className="cfg-section-title">{t('crm.automations.form.builderUi.scheduleSection')}</div>
                      {(formData.meta as any)?.contextLeadId && (
                        <p className="cfg-field-help">{t('crm.automations.form.leadContext.scheduledLinkedLeadHint')}</p>
                      )}
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.report.frequency')}</label>
                        <select className="cfg-select" value={schedFreq} onChange={e => patchScheduleField('scheduleFrequency', e.target.value)}>
                          <option value="daily">{t('crm.automations.form.report.frequencies.daily')}</option>
                          <option value="weekly">{t('crm.automations.form.report.frequencies.weekly')}</option>
                          <option value="monthly">{t('crm.automations.form.report.frequencies.monthly')}</option>
                          <option value="quarterly">{t('crm.automations.form.report.frequencies.quarterly')}</option>
                        </select>
                      </div>
                      <div className="cfg-row">
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.report.time')}</label>
                          <input type="time" className="cfg-input" value={scheduledCfg.scheduleTime || '09:00'} onChange={e => patchScheduleField('scheduleTime', e.target.value)} />
                        </div>
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.report.timezone')}</label>
                          <input className="cfg-input" value={scheduledCfg.scheduleTimezone || 'UTC'} onChange={e => patchScheduleField('scheduleTimezone', e.target.value)} placeholder="Europe/Moscow" />
                        </div>
                      </div>
                      {schedFreq === 'weekly' && (
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.report.dayOfWeek')}</label>
                          <select className="cfg-select" value={scheduledCfg.scheduleDayOfWeek ?? 1} onChange={e => patchScheduleField('scheduleDayOfWeek', Number(e.target.value))}>
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
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.report.dayOfMonth')}</label>
                          <input type="number" className="cfg-input" min={1} max={31} value={scheduledCfg.scheduleDayOfMonth ?? 1} onChange={e => patchScheduleField('scheduleDayOfMonth', Number(e.target.value))} />
                        </div>
                      )}
                    </>
                  )}

                  {/* Automation meta */}
                  <div className="cfg-section-title">{t('crm.automations.form.builderUi.generalSection')}</div>
                  <div className="cfg-field">
                    <label className="cfg-field-label">{t('crm.automations.form.fields.description')}</label>
                    <textarea className="cfg-input ta" value={formData.description || ''} onChange={e => handleChange('description', e.target.value)} placeholder={t('crm.automations.form.builderUi.automationDescriptionPlaceholder')} rows={2} />
                  </div>
                  <div className="cfg-row">
                    <div className="cfg-field">
                      <label className="cfg-field-label">{t('crm.automations.form.builderUi.maxExecutionsLabel')}</label>
                      <input type="number" className="cfg-input" value={formData.maxExecutions ?? ''} onChange={e => handleChange('maxExecutions', e.target.value ? Number(e.target.value) : undefined)} placeholder="∞" min={1} />
                    </div>
                    <div className="cfg-field">
                      <label className="cfg-field-label">{t('crm.automations.form.builderUi.cooldownLabel')}</label>
                      <input type="number" className="cfg-input" value={formData.cooldownSeconds ?? ''} onChange={e => handleChange('cooldownSeconds', e.target.value ? Number(e.target.value) : undefined)} placeholder="0" min={0} />
                    </div>
                  </div>
                  </>}

                  {/* ── Conditions tab ── */}
                  {cfgTab === 'conditions' && <>
                    <p className="cfg-field-help">{t('crm.automations.form.builderUi.conditionsIntro')}</p>
                    {((formData.conditions || []) as Condition[]).map((cond, ci) => (
                      <div key={ci} className="cond-row">
                        <input className="cfg-input" placeholder={t('crm.automations.form.builderUi.conditionFieldPlaceholder')} value={cond.field} onChange={e => { const n=[...(formData.conditions||[])]; n[ci]={...n[ci],field:e.target.value}; handleChange('conditions',n); }} />
                        <select className="cfg-select" value={cond.operator} onChange={e => { const n=[...(formData.conditions||[])]; n[ci]={...n[ci],operator:e.target.value as Condition['operator']}; handleChange('conditions',n); }}>
                          <option value="equals">{t('crm.automations.form.builderUi.conditionOp.equals')}</option>
                          <option value="not_equals">{t('crm.automations.form.builderUi.conditionOp.not_equals')}</option>
                          <option value="contains">{t('crm.automations.form.builderUi.conditionOp.contains')}</option>
                          <option value="not_contains">{t('crm.automations.form.builderUi.conditionOp.not_contains')}</option>
                          <option value="greater_than">{t('crm.automations.form.builderUi.conditionOp.greater_than')}</option>
                          <option value="less_than">{t('crm.automations.form.builderUi.conditionOp.less_than')}</option>
                          <option value="greater_or_equal">{t('crm.automations.form.builderUi.conditionOp.greater_or_equal')}</option>
                          <option value="less_or_equal">{t('crm.automations.form.builderUi.conditionOp.less_or_equal')}</option>
                          <option value="is_empty">{t('crm.automations.form.builderUi.conditionOp.is_empty')}</option>
                          <option value="is_not_empty">{t('crm.automations.form.builderUi.conditionOp.is_not_empty')}</option>
                          <option value="starts_with">{t('crm.automations.form.builderUi.conditionOp.starts_with')}</option>
                          <option value="ends_with">{t('crm.automations.form.builderUi.conditionOp.ends_with')}</option>
                        </select>
                        <input className="cfg-input" placeholder={t('crm.automations.form.builderUi.conditionValuePlaceholder')} value={cond.value ?? ''} onChange={e => { const n=[...(formData.conditions||[])]; n[ci]={...n[ci],value:e.target.value}; handleChange('conditions',n); }} />
                        <button type="button" style={{background:'none',border:0,cursor:'pointer',color:'var(--fg-3)',width:28,height:28,borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center'}}
                          onClick={() => handleChange('conditions',(formData.conditions||[]).filter((_,ii)=>ii!==ci))}>
                          <Ic d={IC.x} s={13}/>
                        </button>
                      </div>
                    ))}
                    <button type="button" className="cond-add-btn" onClick={() => handleChange('conditions',[...(formData.conditions||[]),{field:'',operator:'equals' as Condition['operator'],value:''}])}>
                      <Ic d={IC.plus} s={12}/>{t('crm.automations.form.builderUi.addCondition')}
                    </button>
                  </>}

                  {/* ── Logs tab ── */}
                  {cfgTab === 'logs' && <>
                    {!id && <p className="cfg-field-help" style={{marginTop:4}}>{t('crm.automations.form.builderUi.logsAfterSave')}</p>}
                    {id && execLogsLoading && <p className="cfg-field-help" style={{marginTop:4}}>{t('crm.automations.form.builderUi.logsLoading')}</p>}
                    {id && !execLogsLoading && execLogs.length === 0 && <p className="cfg-field-help" style={{marginTop:4}}>{t('crm.automations.form.builderUi.logsEmpty')}</p>}
                    {id && !execLogsLoading && execLogs.map(log => (
                      <div key={log.id} className="log-row">
                        <span className={`log-status ${log.status}`}>{log.status}</span>
                        <div className="log-meta">
                          <div className="log-time">{new Date(log.createdAt).toLocaleString()}</div>
                          <div className="log-trigger">{log.triggerEvent}{log.actionsExecuted > 0 ? ` · ${t('crm.automations.form.builderUi.logActionsExecuted', { count: log.actionsExecuted })}` : ''}</div>
                          {log.errorMessage && <div className="log-err">{log.errorMessage}</div>}
                        </div>
                      </div>
                    ))}
                  </>}
                </div>
                <div className="auto-cfg-foot">
                  <button type="button" className="ab-btn ab-btn-sm" onClick={() => { setTestResult(runValidation()); setTestVisible(true); }}><Ic d={IC.flask} s={12} />{t('crm.automations.form.builderUi.stripTest')}</button>
                  <button type="button" className="ab-btn ab-btn-primary ab-btn-sm" onClick={handleSubmit} disabled={saving}>
                    {saving ? t('crm.automations.form.actions.saving') : id ? t('crm.automations.form.actions.save') : t('crm.automations.form.actions.create')}
                  </button>
                </div>
              </>
            )}

            {/* ── ACTION config ── */}
            {typeof selectedStep === 'number' && selAction && (
              <>
                <div className="auto-cfg-head">
                  <div className="ic"><Ic d={getActionIcon(selAction.type)} s={16} /></div>
                  <div className="body">
                    <div className="kind">{t('crm.automations.form.builderUi.actionStepCaption', { n: selIdx! + 2, total: formData.actions.length + 1 })}</div>
                    <div className="ttl">{getActionTypeLabel(selAction.type as ActionType)}</div>
                  </div>
                  <button type="button" onClick={() => { removeAction(selIdx!); setSelectedStep('trigger'); }}
                    style={{ background: 'none', border: 0, color: 'var(--fg-3)', cursor: 'pointer', padding: 4, borderRadius: 5 }} title={t('crm.automations.form.builderUi.deleteStepTitle')}>
                    <Ic d={IC.trash} s={14} />
                  </button>
                </div>
                <div className="auto-cfg-tabs">
                  <button className={cfgTab === 'params' ? 'active' : ''} onClick={() => setCfgTab('params')}>{t('crm.automations.form.builderUi.cfgTabParams')}</button>
                  <button className={cfgTab === 'conditions' ? 'active' : ''} onClick={() => setCfgTab('conditions')}>{t('crm.automations.form.builderUi.cfgTabConditions')}</button>
                  <button className={cfgTab === 'logs' ? 'active' : ''} onClick={() => { setCfgTab('logs'); loadExecLogs(); }}>{t('crm.automations.form.builderUi.cfgTabLogs')}</button>
                </div>
                <div className="auto-cfg-body">
                  {cfgTab === 'params' && <>

                  {/* Action type selector */}
                  <div className="cfg-field">
                    <label className="cfg-field-label">{t('crm.automations.form.fields.actionType')}</label>
                    <select className="cfg-select" value={selAction.type} onChange={e => updateAction(selIdx!, 'type', e.target.value)}>
                      {actionGroups.map((grp) => (
                        <optgroup key={grp.group} label={grp.group}>
                          {grp.items.map((it) => (
                            <option key={it.id} value={it.id}>{it.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {/* ── trigger_webhook ── */}
                  {selAction.type === 'trigger_webhook' && (
                    <div className="cfg-field">
                      <label className="cfg-field-label">{t('crm.automations.form.webhookAction.url')} <span className="req">*</span></label>
                      <input className="cfg-input code" value={selAction.config.url || ''} onChange={e => ua('url', e.target.value)} placeholder="https://your-webhook.com/hook" />
                      <p className="cfg-field-help">{t('crm.automations.form.builderUi.webhookPostHint')}</p>
                    </div>
                  )}

                  {/* ── send_email ── */}
                  {selAction.type === 'send_email' && (
                    <>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.emailAction.account')}</label>
                        <select className="cfg-select" value={selAction.config.accountId || ''} onChange={e => ua('accountId', e.target.value)}>
                          <option value="">{t('crm.automations.form.builderUi.pickEmailAccount')}</option>
                          {emailAccounts.map(a => <option key={a.id} value={a.id}>{a.email}</option>)}
                        </select>
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.emailAction.to')}</label>
                        <input className="cfg-input" value={selAction.config.to || ''} onChange={e => ua('to', e.target.value)} placeholder="{{lead.email}}" />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                          <span>{t('crm.automations.form.emailAction.template')}</span>
                          <a href="/marketing/email-templates/new" target="_blank" rel="noreferrer" style={{fontSize:'11px',color:'var(--ink)',opacity:0.6,textDecoration:'underline',fontWeight:400}}>+ {t('crm.automations.form.builderUi.createEmailTemplate')}</a>
                        </label>
                        <select className="cfg-select" value={selAction.config.templateId || ''} onChange={e => ua('templateId', e.target.value)}>
                          <option value="">{t('crm.automations.form.builderUi.pickEmailTemplate')}</option>
                          {emailTemplates.map(tpl => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
                        </select>
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.emailAction.subject')}</label>
                        <input className="cfg-input" value={selAction.config.subject || ''} onChange={e => ua('subject', e.target.value)} placeholder={t('crm.automations.form.builderUi.subjectPlaceholder')} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.emailAction.body')}</label>
                        <textarea className="cfg-input ta" value={selAction.config.textBody || ''} onChange={e => ua('textBody', e.target.value)} placeholder={t('crm.automations.form.builderUi.emailBodyPlaceholder')} />
                      </div>
                    </>
                  )}

                  {/* ── send_telegram ── */}
                  {selAction.type === 'send_telegram' && (
                    <>
                      {/* Bot selector */}
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.telegramBotLabel')}</label>
                        {telegramBots.length === 0 ? (
                          <p className="cfg-field-help">
                            {t('crm.automations.form.builderUi.telegramNoBots')}{' '}
                            <a href="/app/telegram" target="_blank" rel="noreferrer" style={{color:'var(--ink)',textDecoration:'underline'}}>{t('crm.automations.form.builderUi.telegramAddBotsLink')}</a>
                          </p>
                        ) : (
                          <select
                            className="cfg-select"
                            value={selAction.config.botId || ''}
                            onChange={e => {
                              ua('botId', e.target.value);
                              ua('recipientIds', []);
                              if (e.target.value) loadBotRecipients(e.target.value);
                            }}
                          >
                            <option value="">{t('crm.automations.form.builderUi.telegramPickBot')}</option>
                            {telegramBots.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.botName || b.botUsername || b.id}
                                {b.status !== 'active' ? t('crm.automations.form.builderUi.telegramInactiveSuffix') : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Recipient picker */}
                      {selAction.config.botId && (() => {
                        const recs = botRecipients[selAction.config.botId] || [];
                        const selectedIds: string[] = selAction.config.recipientIds || [];
                        return (
                          <div className="cfg-field">
                            <label className="cfg-field-label">{t('crm.automations.form.builderUi.telegramRecipientsLabel')}</label>
                            {recs.length === 0 ? (
                              <p className="cfg-field-help">
                                {t('crm.automations.form.builderUi.telegramNoRecipients')}{' '}
                                <a href={`/app/telegram/bots/${selAction.config.botId}`} target="_blank" rel="noreferrer" style={{color:'var(--ink)',textDecoration:'underline'}}>{t('crm.automations.form.builderUi.telegramAddRecipientsLink')}</a>
                              </p>
                            ) : (
                              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                                {recs.map(r => {
                                  const checked = selectedIds.includes(r.id);
                                  return (
                                    <label key={r.id} className="cfg-check" style={{padding:'6px 8px',background:checked?'var(--bg-muted)':'transparent',borderRadius:6,border:'1px solid var(--line-3)'}}>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={e => {
                                          const next = e.target.checked
                                            ? [...selectedIds, r.id]
                                            : selectedIds.filter(x => x !== r.id);
                                          ua('recipientIds', next);
                                        }}
                                      />
                                      <div style={{flex:1,minWidth:0}}>
                                        <div style={{fontSize:12.5,fontWeight:500,color:'var(--ink)'}}>{r.staffUserName}</div>
                                        <div style={{fontSize:10.5,color:'var(--fg-3)',}}>
                                          {r.telegramUsername ? `@${r.telegramUsername}` : `chat_id: ${r.telegramChatId}`}
                                        </div>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Message template */}
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.telegramMessageLabel')}</label>
                        <textarea className="cfg-input ta" value={selAction.config.text || ''} onChange={e => ua('text', e.target.value)} placeholder={t('crm.automations.form.builderUi.telegramMessagePlaceholder')} rows={3}/>
                        <p className="cfg-field-help">{t('crm.automations.form.builderUi.telegramVarsHint')}</p>
                      </div>
                    </>
                  )}

                  {/* ── send_slack ── */}
                  {selAction.type === 'send_slack' && (
                    <>
                      {slackConnections.length > 0 && (
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.connectionSlack')}</label>
                          <select className="cfg-select" value={selAction.config.integrationConnectionId || ''} onChange={e => ua('integrationConnectionId', e.target.value)}>
                            <option value="">{t('crm.automations.form.builderUi.pickPlaceholder')}</option>
                            {slackConnections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.webhookUrlShortLabel')}</label>
                        <input className="cfg-input code" value={selAction.config.webhookUrl || ''} onChange={e => ua('webhookUrl', e.target.value)} placeholder="https://hooks.slack.com/services/…" />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.textLabel')}</label>
                        <textarea className="cfg-input ta" value={selAction.config.text || ''} onChange={e => ua('text', e.target.value)} placeholder={t('crm.automations.form.builderUi.slackMessagePlaceholder')} />
                      </div>
                    </>
                  )}

                  {/* ── send_teams ── */}
                  {selAction.type === 'send_teams' && (
                    <>
                      {teamsConnections.length > 0 && (
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.connectionTeams')}</label>
                          <select className="cfg-select" value={selAction.config.integrationConnectionId || ''} onChange={e => ua('integrationConnectionId', e.target.value)}>
                            <option value="">{t('crm.automations.form.builderUi.pickPlaceholder')}</option>
                            {teamsConnections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.webhookUrlShortLabel')}</label>
                        <input className="cfg-input code" value={selAction.config.webhookUrl || ''} onChange={e => ua('webhookUrl', e.target.value)} placeholder="https://…webhook.office.com/…" />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.titleLabel')}</label>
                        <input className="cfg-input" value={selAction.config.title || ''} onChange={e => ua('title', e.target.value)} placeholder={t('crm.automations.form.builderUi.teamsTitlePlaceholder')} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.textLabel')}</label>
                        <textarea className="cfg-input ta" value={selAction.config.text || ''} onChange={e => ua('text', e.target.value)} placeholder={t('crm.automations.form.builderUi.teamsTextPlaceholder')} />
                      </div>
                    </>
                  )}

                  {/* ── send_whatsapp ── */}
                  {selAction.type === 'send_whatsapp' && (
                    <>
                      {whatsappConnections.length > 0 && (
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.connectionWhatsApp')}</label>
                          <select className="cfg-select" value={selAction.config.integrationConnectionId || ''} onChange={e => ua('integrationConnectionId', e.target.value)}>
                            <option value="">{t('crm.automations.form.builderUi.pickPlaceholder')}</option>
                            {whatsappConnections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="cfg-field">
                        <label className="cfg-field-label">Phone Number ID</label>
                        <input className="cfg-input code" value={selAction.config.phoneNumberId || ''} onChange={e => ua('phoneNumberId', e.target.value)} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">Access Token</label>
                        <input className="cfg-input code" value={selAction.config.accessToken || ''} onChange={e => ua('accessToken', e.target.value)} placeholder="Bearer …" />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.phoneToLabel')}</label>
                        <input className="cfg-input" value={selAction.config.to || ''} onChange={e => ua('to', e.target.value)} placeholder="{{lead.phone}}" />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.textLabel')}</label>
                        <textarea className="cfg-input ta" value={selAction.config.text || ''} onChange={e => ua('text', e.target.value)} placeholder={t('crm.automations.form.builderUi.whatsappMessagePlaceholder')} />
                      </div>
                    </>
                  )}

                  {/* ── send_notification ── */}
                  {selAction.type === 'send_notification' && (
                    <>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.notificationRecipientsLabel')}</label>
                        <StaffPicker
                          value={selAction.config.userIds || []}
                          onChange={ids => ua('userIds', ids)}
                          placeholder={t('crm.automations.form.builderUi.notificationRecipientsPlaceholder')}
                        />
                        <p className="cfg-field-help">{t('crm.automations.form.builderUi.notificationRecipientsHelp')}</p>
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.titleLabel')}</label>
                        <input className="cfg-input" value={selAction.config.title || ''} onChange={e => ua('title', e.target.value)} placeholder={t('crm.automations.form.builderUi.notificationTitlePlaceholder')} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.textLabel')}</label>
                        <textarea className="cfg-input ta" value={selAction.config.body || ''} onChange={e => ua('body', e.target.value)} placeholder={t('crm.automations.form.builderUi.notificationBodyPlaceholder')} />
                      </div>
                    </>
                  )}

                  {/* ── send_mailchimp ── */}
                  {selAction.type === 'send_mailchimp' && (
                    <>
                      {mailchimpConnections.length > 0 && (
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.connectionMailchimp')}</label>
                          <select className="cfg-select" value={selAction.config.integrationConnectionId || ''} onChange={e => ua('integrationConnectionId', e.target.value)}>
                            <option value="">{t('crm.automations.form.builderUi.pickPlaceholder')}</option>
                            {mailchimpConnections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="cfg-field">
                        <label className="cfg-field-label">List / Audience ID</label>
                        <input className="cfg-input code" value={selAction.config.listId || ''} onChange={e => ua('listId', e.target.value)} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.subscriberEmailLabel')}</label>
                        <input className="cfg-input" value={selAction.config.email || ''} onChange={e => ua('email', e.target.value)} placeholder="{{lead.email}}" />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.mailchimpMergeFieldsLabel')}</label>
                        <textarea className="cfg-input ta code" value={selAction.config.mergeFieldsJson || ''} onChange={e => ua('mergeFieldsJson', e.target.value)} placeholder='{"FNAME":"{{lead.name}}"}' />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.subscriptionStatusLabel')}</label>
                        <select className="cfg-select" value={selAction.config.subscriptionStatus || 'subscribed'} onChange={e => ua('subscriptionStatus', e.target.value)}>
                          <option value="subscribed">subscribed</option>
                          <option value="pending">pending</option>
                          <option value="unsubscribed">unsubscribed</option>
                        </select>
                      </div>
                    </>
                  )}

                  {/* ── send_mailchimp_campaign ── */}
                  {selAction.type === 'send_mailchimp_campaign' && (
                    <>
                      {mailchimpConnections.length > 0 && (
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.connectionMailchimp')}</label>
                          <select className="cfg-select" value={selAction.config.integrationConnectionId || ''} onChange={e => ua('integrationConnectionId', e.target.value)}>
                            <option value="">{t('crm.automations.form.builderUi.pickPlaceholder')}</option>
                            {mailchimpConnections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="cfg-field">
                        <label className="cfg-field-label">List / Audience ID</label>
                        <input className="cfg-input code" value={selAction.config.listId || ''} onChange={e => ua('listId', e.target.value)} />
                      </div>
                      <div className="cfg-row">
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.subjectCampaignLabel')}</label>
                          <input className="cfg-input" value={selAction.config.subject || ''} onChange={e => ua('subject', e.target.value)} />
                        </div>
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.fromNameLabel')}</label>
                          <input className="cfg-input" value={selAction.config.fromName || ''} onChange={e => ua('fromName', e.target.value)} />
                        </div>
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.replyToLabel')}</label>
                        <input className="cfg-input" value={selAction.config.replyTo || ''} onChange={e => ua('replyTo', e.target.value)} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.htmlBodyLabel')}</label>
                        <textarea className="cfg-input ta code" value={selAction.config.htmlBody || ''} onChange={e => ua('htmlBody', e.target.value)} placeholder="<p>Hello {{lead.name}}</p>" />
                      </div>
                    </>
                  )}

                  {/* ── send_zapier ── */}
                  {selAction.type === 'send_zapier' && (
                    <>
                      {zapierConnections.length > 0 && (
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.connectionZapier')}</label>
                          <select className="cfg-select" value={selAction.config.integrationConnectionId || ''} onChange={e => ua('integrationConnectionId', e.target.value)}>
                            <option value="">{t('crm.automations.form.builderUi.pickPlaceholder')}</option>
                            {zapierConnections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.webhookUrlShortLabel')}</label>
                        <input className="cfg-input code" value={selAction.config.webhookUrl || ''} onChange={e => ua('webhookUrl', e.target.value)} placeholder="https://hooks.zapier.com/…" />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.jsonPayloadLabel')}</label>
                        <textarea className="cfg-input ta code" value={selAction.config.jsonPayload || ''} onChange={e => ua('jsonPayload', e.target.value)} placeholder='{"lead_id":"{{lead.id}}"}' />
                      </div>
                    </>
                  )}

                  {/* ── send_bitrix ── */}
                  {selAction.type === 'send_bitrix' && (
                    <>
                      {bitrixConnections.length > 0 && (
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.bitrixConnectionLabel')}</label>
                          <select className="cfg-select" value={selAction.config.integrationConnectionId || ''} onChange={e => ua('integrationConnectionId', e.target.value)}>
                            <option value="">{t('crm.automations.form.builderUi.pickPlaceholder')}</option>
                            {bitrixConnections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.webhookUrlShortLabel')}</label>
                        <input className="cfg-input code" value={selAction.config.webhookUrl || ''} onChange={e => ua('webhookUrl', e.target.value)} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.apiMethodLabel')}</label>
                        <input className="cfg-input code" value={selAction.config.method || ''} onChange={e => ua('method', e.target.value)} placeholder="crm.lead.add" />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.paramsJsonLabel')}</label>
                        <textarea className="cfg-input ta code" value={selAction.config.paramsJson || ''} onChange={e => ua('paramsJson', e.target.value)} placeholder='{"fields":{"TITLE":"{{lead.name}}"}}' />
                      </div>
                    </>
                  )}

                  {/* ── send_amocrm ── */}
                  {selAction.type === 'send_amocrm' && (
                    <>
                      {amocrmConnections.length > 0 && (
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.amocrmConnectionLabel')}</label>
                          <select className="cfg-select" value={selAction.config.integrationConnectionId || ''} onChange={e => ua('integrationConnectionId', e.target.value)}>
                            <option value="">{t('crm.automations.form.builderUi.pickPlaceholder')}</option>
                            {amocrmConnections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="cfg-field">
                        <label className="cfg-field-label">Access Token</label>
                        <input className="cfg-input code" value={selAction.config.accessToken || ''} onChange={e => ua('accessToken', e.target.value)} />
                      </div>
                      <div className="cfg-row">
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.httpMethodLabel')}</label>
                          <select className="cfg-select" value={selAction.config.httpMethod || 'POST'} onChange={e => ua('httpMethod', e.target.value)}>
                            <option>POST</option><option>GET</option><option>PATCH</option>
                          </select>
                        </div>
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.apiPathLabel')}</label>
                          <input className="cfg-input code" value={selAction.config.apiPath || ''} onChange={e => ua('apiPath', e.target.value)} placeholder="/api/v4/leads" />
                        </div>
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.paramsJsonLabel')}</label>
                        <textarea className="cfg-input ta code" value={selAction.config.paramsJson || ''} onChange={e => ua('paramsJson', e.target.value)} placeholder='[{"name":"{{lead.name}}"}]' />
                      </div>
                    </>
                  )}

                  {/* ── send_hubspot ── */}
                  {selAction.type === 'send_hubspot' && (
                    <>
                      {hubspotConnections.length > 0 && (
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.hubspotConnectionLabel')}</label>
                          <select className="cfg-select" value={selAction.config.integrationConnectionId || ''} onChange={e => ua('integrationConnectionId', e.target.value)}>
                            <option value="">{t('crm.automations.form.builderUi.pickPlaceholder')}</option>
                            {hubspotConnections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="cfg-field">
                        <label className="cfg-field-label">Access Token</label>
                        <input className="cfg-input code" value={selAction.config.accessToken || ''} onChange={e => ua('accessToken', e.target.value)} />
                      </div>
                      <div className="cfg-row">
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.httpMethodLabel')}</label>
                          <select className="cfg-select" value={selAction.config.httpMethod || 'POST'} onChange={e => ua('httpMethod', e.target.value)}>
                            <option>POST</option><option>GET</option><option>PATCH</option>
                          </select>
                        </div>
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.apiPathLabel')}</label>
                          <input className="cfg-input code" value={selAction.config.apiPath || ''} onChange={e => ua('apiPath', e.target.value)} placeholder="/crm/v3/objects/contacts" />
                        </div>
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.paramsJsonLabel')}</label>
                        <textarea className="cfg-input ta code" value={selAction.config.paramsJson || ''} onChange={e => ua('paramsJson', e.target.value)} placeholder='{"properties":{"email":"{{lead.email}}"}}' />
                      </div>
                    </>
                  )}

                  {/* ── send_google_ads ── */}
                  {selAction.type === 'send_google_ads' && (
                    <>
                      {marketingGoogleAdsIntegrations.length > 0 && (
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.marketingIntegrationGoogleAds')}</label>
                          <select className="cfg-select" value={selAction.config.marketingIntegrationId || ''} onChange={e => ua('marketingIntegrationId', e.target.value)}>
                            <option value="">{t('crm.automations.form.builderUi.pickPlaceholder')}</option>
                            {marketingGoogleAdsIntegrations.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </div>
                      )}
                      {googleAdsConnections.length > 0 && (
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.connectionGoogleAds')}</label>
                          <select className="cfg-select" value={selAction.config.integrationConnectionId || ''} onChange={e => ua('integrationConnectionId', e.target.value)}>
                            <option value="">{t('crm.automations.form.builderUi.pickPlaceholder')}</option>
                            {googleAdsConnections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.developerTokenLabel')}</label>
                        <input className="cfg-input code" value={selAction.config.developerToken || ''} onChange={e => ua('developerToken', e.target.value)} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">Access Token</label>
                        <input className="cfg-input code" value={selAction.config.accessToken || ''} onChange={e => ua('accessToken', e.target.value)} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.customerIdLabel')}</label>
                        <input className="cfg-input code" value={selAction.config.customerId || ''} onChange={e => ua('customerId', e.target.value)} placeholder="123-456-7890" />
                      </div>
                      <div className="cfg-row">
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.httpMethodLabel')}</label>
                          <select className="cfg-select" value={selAction.config.httpMethod || 'POST'} onChange={e => ua('httpMethod', e.target.value)}>
                            <option>POST</option><option>GET</option>
                          </select>
                        </div>
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.apiPathLabel')}</label>
                          <input className="cfg-input code" value={selAction.config.apiPath || ''} onChange={e => ua('apiPath', e.target.value)} />
                        </div>
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.paramsJsonLabel')}</label>
                        <textarea className="cfg-input ta code" value={selAction.config.paramsJson || ''} onChange={e => ua('paramsJson', e.target.value)} />
                      </div>
                    </>
                  )}

                  {/* ── send_meta_ads ── */}
                  {selAction.type === 'send_meta_ads' && (
                    <>
                      {marketingMetaAdsIntegrations.length > 0 && (
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.marketingIntegrationMetaAds')}</label>
                          <select className="cfg-select" value={selAction.config.marketingIntegrationId || ''} onChange={e => ua('marketingIntegrationId', e.target.value)}>
                            <option value="">{t('crm.automations.form.builderUi.pickPlaceholder')}</option>
                            {marketingMetaAdsIntegrations.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </div>
                      )}
                      {metaAdsConnections.length > 0 && (
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.connectionMetaAds')}</label>
                          <select className="cfg-select" value={selAction.config.integrationConnectionId || ''} onChange={e => ua('integrationConnectionId', e.target.value)}>
                            <option value="">{t('crm.automations.form.builderUi.pickPlaceholder')}</option>
                            {metaAdsConnections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="cfg-field">
                        <label className="cfg-field-label">Access Token</label>
                        <input className="cfg-input code" value={selAction.config.accessToken || ''} onChange={e => ua('accessToken', e.target.value)} />
                      </div>
                      <div className="cfg-row">
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.httpMethodLabel')}</label>
                          <select className="cfg-select" value={selAction.config.httpMethod || 'POST'} onChange={e => ua('httpMethod', e.target.value)}>
                            <option>POST</option><option>GET</option>
                          </select>
                        </div>
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.apiPathLabel')}</label>
                          <input className="cfg-input code" value={selAction.config.apiPath || ''} onChange={e => ua('apiPath', e.target.value)} />
                        </div>
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.paramsJsonLabel')}</label>
                        <textarea className="cfg-input ta code" value={selAction.config.paramsJson || ''} onChange={e => ua('paramsJson', e.target.value)} />
                      </div>
                    </>
                  )}

                  {/* ── send_google_calendar ── */}
                  {selAction.type === 'send_google_calendar' && (
                    <>
                      {googleCalendarConnections.length > 0 && (
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.connectionGoogleCalendar')}</label>
                          <select className="cfg-select" value={selAction.config.integrationConnectionId || ''} onChange={e => ua('integrationConnectionId', e.target.value)}>
                            <option value="">{t('crm.automations.form.builderUi.pickPlaceholder')}</option>
                            {googleCalendarConnections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="cfg-field">
                        <label className="cfg-field-label">Access Token</label>
                        <input className="cfg-input code" value={selAction.config.accessToken || ''} onChange={e => ua('accessToken', e.target.value)} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.calendarIdLabel')}</label>
                        <input className="cfg-input code" value={selAction.config.calendarId || 'primary'} onChange={e => ua('calendarId', e.target.value)} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.eventTitleLabel')}</label>
                        <input className="cfg-input" value={selAction.config.summary || ''} onChange={e => ua('summary', e.target.value)} placeholder={t('crm.automations.form.builderUi.eventTitlePlaceholder')} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.eventDescriptionLabel')}</label>
                        <textarea className="cfg-input ta" value={selAction.config.description || ''} onChange={e => ua('description', e.target.value)} />
                      </div>
                      <div className="cfg-row">
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.durationMinutesLabel')}</label>
                          <input type="number" className="cfg-input" value={selAction.config.durationMinutes ?? 60} onChange={e => ua('durationMinutes', Number(e.target.value))} min={1} />
                        </div>
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.startOffsetMinutesLabel')}</label>
                          <input type="number" className="cfg-input" value={selAction.config.startOffsetMinutes ?? 0} onChange={e => ua('startOffsetMinutes', Number(e.target.value))} />
                        </div>
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.timeZoneLabel')}</label>
                        <input className="cfg-input" value={selAction.config.timeZone || 'UTC'} onChange={e => ua('timeZone', e.target.value)} placeholder="Europe/Moscow" />
                      </div>
                    </>
                  )}

                  {/* ── send_outlook_calendar ── */}
                  {selAction.type === 'send_outlook_calendar' && (
                    <>
                      {outlookCalendarConnections.length > 0 && (
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.connectionOutlook')}</label>
                          <select className="cfg-select" value={selAction.config.integrationConnectionId || ''} onChange={e => ua('integrationConnectionId', e.target.value)}>
                            <option value="">{t('crm.automations.form.builderUi.pickPlaceholder')}</option>
                            {outlookCalendarConnections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="cfg-field">
                        <label className="cfg-field-label">Access Token</label>
                        <input className="cfg-input code" value={selAction.config.accessToken || ''} onChange={e => ua('accessToken', e.target.value)} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.eventTitleLabel')}</label>
                        <input className="cfg-input" value={selAction.config.summary || ''} onChange={e => ua('summary', e.target.value)} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.eventDescriptionLabel')}</label>
                        <textarea className="cfg-input ta" value={selAction.config.description || ''} onChange={e => ua('description', e.target.value)} />
                      </div>
                      <div className="cfg-row">
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.durationMinutesLabel')}</label>
                          <input type="number" className="cfg-input" value={selAction.config.durationMinutes ?? 60} onChange={e => ua('durationMinutes', Number(e.target.value))} min={1} />
                        </div>
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.startOffsetMinutesLabel')}</label>
                          <input type="number" className="cfg-input" value={selAction.config.startOffsetMinutes ?? 0} onChange={e => ua('startOffsetMinutes', Number(e.target.value))} />
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── send_report ── */}
                  {selAction.type === 'send_report' && (
                    <>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.report.type')}</label>
                        <select className="cfg-select" value={selAction.config.reportType || 'sales'} onChange={e => ua('reportType', e.target.value)}>
                          <option value="sales">{t('crm.automations.form.report.types.sales')}</option>
                          <option value="leads">{t('crm.automations.form.report.types.leads')}</option>
                          <option value="tasks">{t('crm.automations.form.report.types.tasks')}</option>
                          <option value="projects">{t('crm.automations.form.report.types.projects')}</option>
                          <option value="bookings">{t('crm.automations.form.report.types.bookings')}</option>
                          <option value="hotels">{t('crm.automations.form.report.types.hotels')}</option>
                        </select>
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.report.channel')}</label>
                        <select className="cfg-select" value={selAction.config.channel || 'email'} onChange={e => ua('channel', e.target.value)}>
                          <option value="email">{t('crm.automations.form.report.channels.email')}</option>
                          <option value="telegram">{t('crm.automations.form.report.channels.telegram')}</option>
                        </select>
                      </div>
                      {selAction.config.channel !== 'telegram' && (
                        <>
                          <div className="cfg-field">
                            <label className="cfg-field-label">{t('crm.automations.form.builderUi.emailAccountShortLabel')}</label>
                            <select className="cfg-select" value={selAction.config.accountId || ''} onChange={e => ua('accountId', e.target.value)}>
                              <option value="">{t('crm.automations.form.builderUi.pickPlaceholder')}</option>
                              {emailAccounts.map(a => <option key={a.id} value={a.id}>{a.email}</option>)}
                            </select>
                          </div>
                          <div className="cfg-field">
                            <label className="cfg-field-label">{t('crm.automations.form.builderUi.recipientLabel')}</label>
                            <input className="cfg-input" value={selAction.config.to || ''} onChange={e => ua('to', e.target.value)} placeholder="email@example.com" />
                          </div>
                        </>
                      )}
                      {selAction.config.channel === 'telegram' && (
                        <>
                          <div className="cfg-field">
                            <label className="cfg-field-label">{t('crm.automations.form.builderUi.botIdLabel')}</label>
                            <input className="cfg-input code" value={selAction.config.botId || ''} onChange={e => ua('botId', e.target.value)} />
                          </div>
                          <div className="cfg-field">
                            <label className="cfg-field-label">{t('crm.automations.form.builderUi.telegramUserIdLabel')}</label>
                            <input className="cfg-input code" value={selAction.config.telegramUserId || ''} onChange={e => ua('telegramUserId', e.target.value)} />
                          </div>
                        </>
                      )}
                      <div className="cfg-row">
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.report.frequency')}</label>
                          <select className="cfg-select" value={selAction.config.scheduleFrequency || 'weekly'} onChange={e => ua('scheduleFrequency', e.target.value)}>
                            <option value="daily">{t('crm.automations.form.report.frequencies.daily')}</option>
                            <option value="weekly">{t('crm.automations.form.report.frequencies.weekly')}</option>
                            <option value="monthly">{t('crm.automations.form.report.frequencies.monthly')}</option>
                          </select>
                        </div>
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.report.time')}</label>
                          <input type="time" className="cfg-input" value={selAction.config.scheduleTime || '09:00'} onChange={e => ua('scheduleTime', e.target.value)} />
                        </div>
                      </div>
                      <div className="cfg-section-title">{t('crm.automations.form.builderUi.reportFormatSection')}</div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <label className="cfg-check"><input type="checkbox" checked={!!selAction.config.formatPdf} onChange={e => ua('formatPdf', e.target.checked)} />PDF</label>
                        <label className="cfg-check"><input type="checkbox" checked={!!selAction.config.formatXls} onChange={e => ua('formatXls', e.target.checked)} />Excel</label>
                        <label className="cfg-check"><input type="checkbox" checked={!!selAction.config.formatCsv} onChange={e => ua('formatCsv', e.target.checked)} />CSV</label>
                      </div>
                    </>
                  )}

                  {/* ── send_data_export ── */}
                  {selAction.type === 'send_data_export' && (
                    <>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.dataExport.channel')}</label>
                        <select className="cfg-select" value={selAction.config.channel || 'email'} onChange={e => ua('channel', e.target.value)}>
                          <option value="email">{t('crm.automations.form.dataExport.channelEmail')}</option>
                          <option value="telegram">{t('crm.automations.form.dataExport.channelTelegram')}</option>
                        </select>
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.dataExport.fromPath')}</label>
                        <input className="cfg-input code" value={selAction.config.fromPath || ''} onChange={e => ua('fromPath', e.target.value)} placeholder="/api/leads" />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-check">
                          <input type="checkbox" checked={!!selAction.config.unwrapData} onChange={e => ua('unwrapData', e.target.checked)} />
                          {t('crm.automations.form.dataExport.unwrap')}
                        </label>
                      </div>
                      {selAction.config.channel !== 'telegram' && (
                        <>
                          <div className="cfg-field">
                            <label className="cfg-field-label">{t('crm.automations.form.builderUi.emailAccountShortLabel')}</label>
                            <select className="cfg-select" value={selAction.config.accountId || ''} onChange={e => ua('accountId', e.target.value)}>
                              <option value="">{t('crm.automations.form.builderUi.pickPlaceholder')}</option>
                              {emailAccounts.map(a => <option key={a.id} value={a.id}>{a.email}</option>)}
                            </select>
                          </div>
                          <div className="cfg-field">
                            <label className="cfg-field-label">{t('crm.automations.form.builderUi.recipientLabel')}</label>
                            <input className="cfg-input" value={selAction.config.to || ''} onChange={e => ua('to', e.target.value)} />
                          </div>
                          <div className="cfg-field">
                            <label className="cfg-field-label">{t('crm.automations.form.dataExport.subject')}</label>
                            <input className="cfg-input" value={selAction.config.subject || ''} onChange={e => ua('subject', e.target.value)} />
                          </div>
                        </>
                      )}
                      {selAction.config.channel === 'telegram' && (
                        <>
                          <div className="cfg-field">
                            <label className="cfg-field-label">{t('crm.automations.form.builderUi.botIdLabel')}</label>
                            <input className="cfg-input code" value={selAction.config.botId || ''} onChange={e => ua('botId', e.target.value)} />
                          </div>
                          <div className="cfg-field">
                            <label className="cfg-field-label">{t('crm.automations.form.builderUi.telegramUserIdLabel')}</label>
                            <input className="cfg-input code" value={selAction.config.telegramUserId || ''} onChange={e => ua('telegramUserId', e.target.value)} />
                          </div>
                        </>
                      )}
                      <div className="cfg-section-title">{t('crm.automations.form.dataExport.formats')}</div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <label className="cfg-check"><input type="checkbox" checked={!!selAction.config.formatJson} onChange={e => ua('formatJson', e.target.checked)} />{t('crm.automations.form.dataExport.formatJson')}</label>
                        <label className="cfg-check"><input type="checkbox" checked={!!selAction.config.formatXlsx} onChange={e => ua('formatXlsx', e.target.checked)} />{t('crm.automations.form.dataExport.formatXlsx')}</label>
                        <label className="cfg-check"><input type="checkbox" checked={!!selAction.config.formatPdf} onChange={e => ua('formatPdf', e.target.checked)} />{t('crm.automations.form.dataExport.formatPdf')}</label>
                      </div>
                    </>
                  )}

                  {/* ── create_note ── */}
                  {selAction.type === 'create_note' && (
                    <div className="cfg-field">
                      <label className="cfg-field-label">{t('crm.automations.form.builderUi.noteContentLabel')}</label>
                      <textarea className="cfg-input ta" value={selAction.config.content || ''} onChange={e => ua('content', e.target.value)} placeholder={t('crm.automations.form.builderUi.notePlaceholder')} />
                    </div>
                  )}

                  {/* ── change_status ── */}
                  {selAction.type === 'change_status' && (
                    <div className="cfg-field">
                      <label className="cfg-field-label">{t('crm.automations.form.builderUi.newStatusLabel')}</label>
                      <input className="cfg-input" value={selAction.config.status || ''} onChange={e => ua('status', e.target.value)} placeholder={t('crm.automations.form.builderUi.newStatusPlaceholder')} />
                    </div>
                  )}

                  {/* ── update_field ── */}
                  {selAction.type === 'update_field' && (
                    <>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.fieldLabel')}</label>
                        <input className="cfg-input code" value={selAction.config.field || ''} onChange={e => ua('field', e.target.value)} placeholder="lead.amount" />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.valueLabel')}</label>
                        <input className="cfg-input" value={selAction.config.value ?? ''} onChange={e => ua('value', e.target.value)} placeholder="{{trigger.value}}" />
                      </div>
                    </>
                  )}

                  {/* ── add_tag / remove_tag ── */}
                  {(selAction.type === 'add_tag' || selAction.type === 'remove_tag') && (
                    <div className="cfg-field">
                      <label className="cfg-field-label">{t('crm.automations.form.builderUi.tagLabel')}</label>
                      <input className="cfg-input" value={selAction.config.tag || ''} onChange={e => ua('tag', e.target.value)} placeholder={t('crm.automations.form.builderUi.tagPlaceholder')} />
                    </div>
                  )}

                  {/* ── assign_user ── */}
                  {selAction.type === 'assign_user' && (
                    <div className="cfg-field">
                      <label className="cfg-field-label">{t('crm.automations.form.builderUi.staffLabel')}</label>
                      <StaffPicker
                        value={selAction.config.userIds || (selAction.config.userId ? [selAction.config.userId] : [])}
                        onChange={ids => { ua('userIds', ids); ua('userId', ids[0] || ''); }}
                        placeholder={t('crm.automations.form.builderUi.assignStaffPlaceholder')}
                      />
                      <p className="cfg-field-help">{t('crm.automations.form.builderUi.assignStaffHelp')}</p>
                    </div>
                  )}

                  {/* ── assign_task ── */}
                  {selAction.type === 'assign_task' && (
                    <>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.taskIdLabel')}</label>
                        <input className="cfg-input code" value={selAction.config.taskId || ''} onChange={e => ua('taskId', e.target.value)} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.assignTaskStaffLabel')}</label>
                        <StaffPicker
                          single
                          value={selAction.config.userId ? [selAction.config.userId] : []}
                          onChange={ids => ua('userId', ids[0] || '')}
                          placeholder={t('crm.automations.form.builderUi.assignStaffPlaceholder')}
                        />
                      </div>
                    </>
                  )}

                  {/* ── create_task ── */}
                  {selAction.type === 'create_task' && (
                    <>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.taskTitleLabel')}</label>
                        <input className="cfg-input" value={selAction.config.title || ''} onChange={e => ua('title', e.target.value)} placeholder={t('crm.automations.form.builderUi.taskTitlePlaceholder')} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.eventDescriptionLabel')}</label>
                        <textarea className="cfg-input ta" value={selAction.config.description || ''} onChange={e => ua('description', e.target.value)} />
                      </div>
                      <div className="cfg-row">
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.taskStatusLabel')}</label>
                          <select className="cfg-select" value={selAction.config.status || 'open'} onChange={e => ua('status', e.target.value)}>
                            <option value="open">open</option>
                            <option value="in_progress">in_progress</option>
                            <option value="done">done</option>
                          </select>
                        </div>
                        <div className="cfg-field">
                          <label className="cfg-field-label">{t('crm.automations.form.builderUi.taskPriorityLabel')}</label>
                          <select className="cfg-select" value={selAction.config.priority || 'normal'} onChange={e => ua('priority', e.target.value)}>
                            <option value="low">{t('crm.automations.form.builderUi.priorityLow')}</option>
                            <option value="normal">{t('crm.automations.form.builderUi.priorityNormal')}</option>
                            <option value="high">{t('crm.automations.form.builderUi.priorityHigh')}</option>
                          </select>
                        </div>
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.taskDueDaysLabel')}</label>
                        <input type="number" className="cfg-input" value={selAction.config.dueDate ?? ''} onChange={e => ua('dueDate', e.target.value)} placeholder="+1 day" min={0} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.taskAssigneeLabel')}</label>
                        <StaffPicker
                          single
                          value={selAction.config.assignedUserId ? [selAction.config.assignedUserId] : []}
                          onChange={ids => ua('assignedUserId', ids[0] || '')}
                          placeholder={t('crm.automations.form.builderUi.taskAssigneePlaceholder')}
                        />
                      </div>
                    </>
                  )}

                  {/* ── create_jira_issue ── */}
                  {selAction.type === 'create_jira_issue' && (
                    <>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.jiraConnectionLabel', 'Jira Connection')}</label>
                        <select className="cfg-select" value={selAction.config.integrationConnectionId || ''} onChange={e => ua('integrationConnectionId', e.target.value)}>
                          <option value="">{t('crm.automations.form.builderUi.selectConnection', '— выберите подключение —')}</option>
                          {jiraConnections.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.jiraTitleLabel', 'Заголовок задачи')}</label>
                        <input className="cfg-input" placeholder="Задача из Lumiva CRM · {{lead.name}}" value={selAction.config.title || ''} onChange={e => ua('title', e.target.value)} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.jiraDescriptionLabel', 'Описание')}</label>
                        <textarea className="cfg-input" rows={3} placeholder="{{lead.name}} — {{lead.status}}" value={selAction.config.description || ''} onChange={e => ua('description', e.target.value)} style={{resize:'vertical'}} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.jiraProjectKeyLabel', 'Project Key (опционально)')}</label>
                        <input className="cfg-input code" placeholder="CRM" value={selAction.config.projectKey || ''} onChange={e => ua('projectKey', e.target.value)} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.jiraIssueTypeLabel', 'Тип задачи')}</label>
                        <select className="cfg-select" value={selAction.config.issueType || 'Task'} onChange={e => ua('issueType', e.target.value)}>
                          <option value="Task">Task</option>
                          <option value="Bug">Bug</option>
                          <option value="Story">Story</option>
                        </select>
                      </div>
                    </>
                  )}

                  {/* ── create_custom_object_record ── */}
                  {selAction.type === 'create_custom_object_record' && (
                    <>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.customObjectIdLabel')}</label>
                        <input className="cfg-input code" value={selAction.config.targetObjectId || ''} onChange={e => ua('targetObjectId', e.target.value)} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-field-label">{t('crm.automations.form.builderUi.duplicateKeyTargetFieldLabel')}</label>
                        <input className="cfg-input code" value={selAction.config.duplicateKeyTargetField || ''} onChange={e => ua('duplicateKeyTargetField', e.target.value)} />
                      </div>
                      <div className="cfg-field">
                        <label className="cfg-check">
                          <input type="checkbox" checked={!!selAction.config.skipDuplicates} onChange={e => ua('skipDuplicates', e.target.checked)} />
                          {t('crm.automations.form.builderUi.skipDuplicatesCheckbox')}
                        </label>
                      </div>
                    </>
                  )}

                  </>}

                  {/* ── Conditions tab (per-action) ── */}
                  {cfgTab === 'conditions' && <>
                    <p className="cfg-field-help">{t('crm.automations.form.builderUi.stepConditionsIntro')}</p>
                    {((selAction.config._conditions || []) as Condition[]).map((cond: Condition, ci: number) => (
                      <div key={ci} className="cond-row">
                        <input className="cfg-input" placeholder={t('crm.automations.form.builderUi.conditionFieldPlaceholder')} value={cond.field} onChange={e => { const n=[...(selAction.config._conditions||[])]; n[ci]={...n[ci],field:e.target.value}; ua('_conditions',n); }} />
                        <select className="cfg-select" value={cond.operator} onChange={e => { const n=[...(selAction.config._conditions||[])]; n[ci]={...n[ci],operator:e.target.value as Condition['operator']}; ua('_conditions',n); }}>
                          <option value="equals">{t('crm.automations.form.builderUi.conditionOp.equals')}</option>
                          <option value="not_equals">{t('crm.automations.form.builderUi.conditionOp.not_equals')}</option>
                          <option value="contains">{t('crm.automations.form.builderUi.conditionOp.contains')}</option>
                          <option value="not_contains">{t('crm.automations.form.builderUi.conditionOp.not_contains')}</option>
                          <option value="greater_than">{t('crm.automations.form.builderUi.conditionOp.greater_than')}</option>
                          <option value="less_than">{t('crm.automations.form.builderUi.conditionOp.less_than')}</option>
                          <option value="greater_or_equal">{t('crm.automations.form.builderUi.conditionOp.greater_or_equal')}</option>
                          <option value="less_or_equal">{t('crm.automations.form.builderUi.conditionOp.less_or_equal')}</option>
                          <option value="is_empty">{t('crm.automations.form.builderUi.conditionOp.is_empty')}</option>
                          <option value="is_not_empty">{t('crm.automations.form.builderUi.conditionOp.is_not_empty')}</option>
                          <option value="starts_with">{t('crm.automations.form.builderUi.conditionOp.starts_with')}</option>
                          <option value="ends_with">{t('crm.automations.form.builderUi.conditionOp.ends_with')}</option>
                        </select>
                        <input className="cfg-input" placeholder={t('crm.automations.form.builderUi.conditionValuePlaceholder')} value={cond.value ?? ''} onChange={e => { const n=[...(selAction.config._conditions||[])]; n[ci]={...n[ci],value:e.target.value}; ua('_conditions',n); }} />
                        <button type="button" style={{background:'none',border:0,cursor:'pointer',color:'var(--fg-3)',width:28,height:28,borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center'}}
                          onClick={() => ua('_conditions',(selAction.config._conditions||[]).filter((_:any,ii:number)=>ii!==ci))}>
                          <Ic d={IC.x} s={13}/>
                        </button>
                      </div>
                    ))}
                    <button type="button" className="cond-add-btn" onClick={() => ua('_conditions',[...(selAction.config._conditions||[]),{field:'',operator:'equals' as Condition['operator'],value:''}])}>
                      <Ic d={IC.plus} s={12}/>{t('crm.automations.form.builderUi.addCondition')}
                    </button>
                  </>}

                  {/* ── Logs tab ── */}
                  {cfgTab === 'logs' && <>
                    {!id && <p className="cfg-field-help" style={{marginTop:4}}>{t('crm.automations.form.builderUi.logsAfterSave')}</p>}
                    {id && execLogsLoading && <p className="cfg-field-help" style={{marginTop:4}}>{t('crm.automations.form.builderUi.logsLoading')}</p>}
                    {id && !execLogsLoading && execLogs.length === 0 && <p className="cfg-field-help" style={{marginTop:4}}>{t('crm.automations.form.builderUi.logsEmpty')}</p>}
                    {id && !execLogsLoading && execLogs.map(log => (
                      <div key={log.id} className="log-row">
                        <span className={`log-status ${log.status}`}>{log.status}</span>
                        <div className="log-meta">
                          <div className="log-time">{new Date(log.createdAt).toLocaleString()}</div>
                          <div className="log-trigger">{log.triggerEvent}{log.actionsExecuted > 0 ? ` · ${t('crm.automations.form.builderUi.logActionsExecuted', { count: log.actionsExecuted })}` : ''}</div>
                          {log.errorMessage && <div className="log-err">{log.errorMessage}</div>}
                        </div>
                      </div>
                    ))}
                  </>}
                </div>
                <div className="auto-cfg-foot">
                  <button type="button" className="ab-btn ab-btn-sm ab-btn-danger" onClick={() => { removeAction(selIdx!); setSelectedStep('trigger'); }}>
                    <Ic d={IC.trash} s={12} />{t('crm.automations.form.actions.removeAction')}
                  </button>
                  <button type="button" className="ab-btn ab-btn-primary ab-btn-sm" onClick={handleSubmit} disabled={saving}>
                    {saving ? t('crm.automations.form.actions.saving') : id ? t('crm.automations.form.actions.save') : t('crm.automations.form.actions.create')}
                  </button>
                </div>
              </>
            )}

          </aside>
        </div>

        {/* ══════════════════════════════════════════
            FLOW PICKER POPOVER
        ══════════════════════════════════════════ */}
        {showPicker && pickerPos && (
          <>
            {/* backdrop */}
            <div style={{position:'fixed',inset:0,zIndex:199}} onClick={() => setShowPicker(false)} />
            <div
              className="flow-picker"
              style={{ left: pickerPos.x, top: Math.min(pickerPos.y, window.innerHeight - 540) }}
            >
              <div className="flow-picker-search">
                <Ic d={IC.search} s={14} />
                <input
                  autoFocus
                  placeholder={t('crm.automations.form.builderUi.pickerSearchPlaceholder')}
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setShowPicker(false); }}
                />
              </div>
              <div className="flow-picker-tabs">
                <button className={pickerTab === 'action' ? 'active' : ''} onClick={() => setPickerTab('action')}>
                  <Ic d={IC.bolt} s={11} />{t('crm.automations.form.builderUi.tabActions')}
                </button>
                <button className={pickerTab === 'trigger' ? 'active' : ''} onClick={() => setPickerTab('trigger')}>
                  <Ic d={IC.lead} s={11} />{t('crm.automations.form.builderUi.pickerTabTriggerSingular')}
                </button>
              </div>
              <div className="flow-picker-list">
                {(pickerTab === 'action' ? actionGroups : triggerGroups).map(grp => {
                  const items = pickerSearch.trim()
                    ? grp.items.filter((it: any) => it.label.toLowerCase().includes(pickerSearch.toLowerCase()))
                    : grp.items;
                  if (!items.length) return null;
                  return (
                    <div key={grp.group}>
                      <div className="flow-picker-group-title">{grp.group}</div>
                      {items.map((it: any) => (
                        <div
                          key={it.id}
                          className={`flow-picker-item${pickerTab === 'action' ? ' action' : ''}`}
                          onClick={() => {
                            if (pickerTab === 'trigger') {
                              onTriggerEventChange(it.id as TriggerEvent);
                              setSelectedStep('trigger');
                            } else {
                              setFormData(prev => {
                                const next = [...prev.actions];
                                next.splice(pickerInsertAt, 0, { type: it.id as ActionType, config: {} });
                                return { ...prev, actions: next };
                              });
                              setSelectedStep(pickerInsertAt);
                            }
                            setShowPicker(false);
                          }}
                        >
                          <div className="pic-ic"><Ic d={IC[it.icon] ?? IC.bolt} s={14} /></div>
                          <div className="pic-body">
                            <div className="pic-name">{it.label}</div>
                            {it.desc && <div className="pic-desc">{it.desc}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              <div className="flow-picker-foot">
                <span className="flow-picker-kbd"><kbd>↑↓</kbd> {t('crm.automations.form.builderUi.pickerKbdNavigate')}</span>
                <span className="flow-picker-kbd"><kbd>Esc</kbd> {t('crm.automations.form.builderUi.pickerKbdClose')}</span>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════
            TEST VALIDATION PANEL
        ══════════════════════════════════════════ */}
        {testVisible && testResult && (
          <div className="auto-test-overlay" onClick={() => setTestVisible(false)}>
            <div className="auto-test-panel" onClick={e => e.stopPropagation()}>
              <div className="auto-test-head">
                <h3><Ic d={IC.flask} s={15} /> {t('crm.automations.form.builderUi.testModalTitle')}</h3>
                <button type="button" style={{background:'none',border:0,cursor:'pointer',color:'var(--fg-3)',padding:4}} onClick={() => setTestVisible(false)}>
                  <Ic d={IC.x} s={16} />
                </button>
              </div>
              <div className="auto-test-body">
                {testResult.errors.length === 0 && testResult.warnings.length === 0 && (
                  <div className="test-ok">
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {t('crm.automations.form.builderUi.testModalSuccessBody')}
                  </div>
                )}
                {testResult.errors.map((msg, i) => (
                  <div key={i} className="test-issue error">
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:1}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {msg}
                  </div>
                ))}
                {testResult.warnings.map((msg, i) => (
                  <div key={i} className="test-issue warning">
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:1}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    {msg}
                  </div>
                ))}
              </div>
              <div className="auto-test-foot">
                <button type="button" className="ab-btn ab-btn-sm" onClick={() => setTestVisible(false)}>{t('crm.automations.form.builderUi.testModalClose')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

