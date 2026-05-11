import type { TFunction } from 'i18next';
import { getActionLabel, getTriggerLabel } from './automationLabels';

export type AutomationLibItem = { id: string; label: string; icon: string; desc?: string };
export type AutomationLibGroup = { group: string; items: AutomationLibItem[] };

export function buildAutomationTriggerGroups(t: TFunction): AutomationLibGroup[] {
  return [
    {
      group: t('crm.automations.form.library.groups.leadsSales'),
      items: [
        { id: 'lead.created', label: getTriggerLabel('lead.created', t), icon: 'lead' },
        { id: 'lead.updated', label: getTriggerLabel('lead.updated', t), icon: 'lead' },
        { id: 'lead.status_changed', label: getTriggerLabel('lead.status_changed', t), icon: 'lead' },
        { id: 'lead.assigned', label: getTriggerLabel('lead.assigned', t), icon: 'user' },
        { id: 'sale.created', label: getTriggerLabel('sale.created', t), icon: 'sale' },
        { id: 'sale.updated', label: getTriggerLabel('sale.updated', t), icon: 'sale' },
        { id: 'sale.status_changed', label: getTriggerLabel('sale.status_changed', t), icon: 'sale' },
      ],
    },
    {
      group: t('crm.automations.form.library.groups.contactsCompanies'),
      items: [
        { id: 'contact.created', label: getTriggerLabel('contact.created', t), icon: 'contact' },
        { id: 'contact.updated', label: getTriggerLabel('contact.updated', t), icon: 'contact' },
        { id: 'company.created', label: getTriggerLabel('company.created', t), icon: 'globe' },
        { id: 'company.updated', label: getTriggerLabel('company.updated', t), icon: 'globe' },
      ],
    },
    {
      group: t('crm.automations.form.library.groups.projectsTasks'),
      items: [
        { id: 'project.created', label: getTriggerLabel('project.created', t), icon: 'custom' },
        { id: 'project.status_changed', label: getTriggerLabel('project.status_changed', t), icon: 'custom' },
        { id: 'task.created', label: getTriggerLabel('task.created', t), icon: 'task' },
        { id: 'task.updated', label: getTriggerLabel('task.updated', t), icon: 'task' },
        { id: 'task.status_changed', label: getTriggerLabel('task.status_changed', t), icon: 'task' },
      ],
    },
    {
      group: t('crm.automations.form.library.groups.messaging'),
      items: [
        { id: 'email.sent', label: getTriggerLabel('email.sent', t), icon: 'mail' },
        { id: 'email.received', label: getTriggerLabel('email.received', t), icon: 'mail' },
        { id: 'telegram.message_received', label: getTriggerLabel('telegram.message_received', t), icon: 'tg' },
        { id: 'note.created', label: getTriggerLabel('note.created', t), icon: 'note' },
      ],
    },
    {
      group: t('crm.automations.form.library.groups.timeApi'),
      items: [
        {
          id: 'scheduled',
          label: getTriggerLabel('scheduled', t),
          icon: 'clock',
          desc: t('crm.automations.form.library.triggerDesc.scheduled'),
        },
        { id: 'report.scheduled', label: getTriggerLabel('report.scheduled', t), icon: 'report' },
        {
          id: 'custom_object.record_created',
          label: getTriggerLabel('custom_object.record_created', t),
          icon: 'custom',
        },
        {
          id: 'custom_object.record_updated',
          label: getTriggerLabel('custom_object.record_updated', t),
          icon: 'custom',
        },
        {
          id: 'custom_object.status_changed',
          label: getTriggerLabel('custom_object.status_changed', t),
          icon: 'custom',
        },
      ],
    },
  ];
}

export function buildAutomationActionGroups(t: TFunction): AutomationLibGroup[] {
  return [
    {
      group: t('crm.automations.form.library.groups.notifications'),
      items: [
        {
          id: 'send_email',
          label: getActionLabel('send_email', t),
          icon: 'mail',
          desc: t('crm.automations.form.library.actionDesc.send_email'),
        },
        { id: 'send_telegram', label: getActionLabel('send_telegram', t), icon: 'tg' },
        { id: 'send_slack', label: getActionLabel('send_slack', t), icon: 'slack' },
        { id: 'send_teams', label: getActionLabel('send_teams', t), icon: 'teams' },
        { id: 'send_whatsapp', label: getActionLabel('send_whatsapp', t), icon: 'whatsapp' },
        { id: 'send_notification', label: getActionLabel('send_notification', t), icon: 'bell' },
      ],
    },
    {
      group: t('crm.automations.form.library.groups.crmObjects'),
      items: [
        { id: 'create_task', label: getActionLabel('create_task', t), icon: 'task' },
        { id: 'create_note', label: getActionLabel('create_note', t), icon: 'note' },
        { id: 'change_status', label: getActionLabel('change_status', t), icon: 'update' },
        { id: 'update_field', label: getActionLabel('update_field', t), icon: 'update' },
        { id: 'add_tag', label: getActionLabel('add_tag', t), icon: 'tag' },
        { id: 'remove_tag', label: getActionLabel('remove_tag', t), icon: 'tag' },
        { id: 'assign_user', label: getActionLabel('assign_user', t), icon: 'user' },
        { id: 'assign_task', label: getActionLabel('assign_task', t), icon: 'task' },
        {
          id: 'create_custom_object_record',
          label: getActionLabel('create_custom_object_record', t),
          icon: 'custom',
        },
      ],
    },
    {
      group: t('crm.automations.form.library.groups.reportsExport'),
      items: [
        { id: 'send_report', label: getActionLabel('send_report', t), icon: 'report' },
        { id: 'send_data_export', label: getActionLabel('send_data_export', t), icon: 'export' },
      ],
    },
    {
      group: t('crm.automations.form.library.groups.integrations'),
      items: [
        { id: 'trigger_webhook', label: getActionLabel('trigger_webhook', t), icon: 'webhook' },
        { id: 'send_mailchimp', label: getActionLabel('send_mailchimp', t), icon: 'mail' },
        { id: 'send_mailchimp_campaign', label: getActionLabel('send_mailchimp_campaign', t), icon: 'mail' },
        { id: 'send_zapier', label: getActionLabel('send_zapier', t), icon: 'zapier' },
        { id: 'send_bitrix', label: getActionLabel('send_bitrix', t), icon: 'api' },
        { id: 'send_amocrm', label: getActionLabel('send_amocrm', t), icon: 'api' },
        { id: 'send_hubspot', label: getActionLabel('send_hubspot', t), icon: 'api' },
        { id: 'send_google_ads', label: getActionLabel('send_google_ads', t), icon: 'globe' },
        { id: 'send_meta_ads', label: getActionLabel('send_meta_ads', t), icon: 'globe' },
        { id: 'send_google_calendar', label: getActionLabel('send_google_calendar', t), icon: 'calendar' },
        { id: 'send_outlook_calendar', label: getActionLabel('send_outlook_calendar', t), icon: 'calendar' },
      ],
    },
  ];
}
