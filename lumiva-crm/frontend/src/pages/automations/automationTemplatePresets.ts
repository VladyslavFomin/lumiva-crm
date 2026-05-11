import type { TFunction } from 'i18next';
import type { ActionType, TriggerEvent } from '../../api/automations';

/** Default config for the simple CRM «send report» step (matches AutomationFormPage). */
export const QUICK_SEND_REPORT_ACTION_CONFIG: Record<string, unknown> = {
  reportType: 'sales',
  channel: 'email',
  scheduleFrequency: 'weekly',
  scheduleTime: '09:00',
  scheduleTimezone: 'Europe/Moscow',
  scheduleDayOfWeek: 1,
  formatPdf: true,
  formatXls: true,
};

export type AutomationTemplatePreset = {
  name: string;
  triggerEvent: TriggerEvent;
  actions: Array<{ type: ActionType; config: Record<string, unknown> }>;
};

/**
 * URL template presets (`?template=t1` … `t6`).
 * Action bodies keep English `{{lead.name}}`-style placeholders so the engine and docs stay consistent.
 */
export function buildAutomationTemplatePresets(t: TFunction): Record<string, AutomationTemplatePreset> {
  return {
    t1: {
      name: t('crm.automations.form.templatePresets.t1.name'),
      triggerEvent: 'lead.created',
      actions: [
        { type: 'send_telegram', config: { text: '🔥 New lead: {{lead.name}} ({{lead.email}})' } },
        { type: 'create_task', config: { title: 'Call {{lead.name}}', priority: 'high', status: 'open' } },
      ],
    },
    t2: {
      name: t('crm.automations.form.templatePresets.t2.name'),
      triggerEvent: 'scheduled',
      actions: [
        {
          type: 'send_email',
          config: {
            subject: 'We are waiting for your reply',
            textBody:
              'Hello {{lead.name}}!\n\nWe noticed we have not heard from you in a while...',
          },
        },
        { type: 'send_notification', config: { message: 'No reply from lead: {{lead.name}}' } },
      ],
    },
    t3: {
      name: t('crm.automations.form.templatePresets.t3.name'),
      triggerEvent: 'sale.status_changed',
      actions: [
        {
          type: 'create_note',
          config: { content: 'Deal {{sale.name}} won! Client: {{sale.clientName}}' },
        },
        { type: 'send_notification', config: { message: '🎉 Deal won: {{sale.name}}' } },
      ],
    },
    t4: {
      name: t('crm.automations.form.templatePresets.t4.name'),
      triggerEvent: 'contact.created',
      actions: [
        { type: 'send_notification', config: { message: 'New contact from form: {{contact.name}}' } },
        { type: 'assign_user', config: {} },
      ],
    },
    t5: {
      name: t('crm.automations.form.templatePresets.t5.name'),
      triggerEvent: 'scheduled',
      actions: [{ type: 'send_report', config: { ...QUICK_SEND_REPORT_ACTION_CONFIG } }],
    },
    t6: {
      name: t('crm.automations.form.templatePresets.t6.name'),
      triggerEvent: 'contact.created',
      actions: [
        {
          type: 'create_note',
          config: { content: 'Site contact: {{contact.name}} — {{contact.email}}' },
        },
        { type: 'send_slack', config: { text: '📬 New inquiry: {{contact.name}}' } },
      ],
    },
  };
}
