import type { TFunction } from 'i18next';

const TRIGGER_EVENT_TO_FORM: Record<string, string> = {
  'contact.created': 'CONTACT_CREATED',
  'contact.updated': 'CONTACT_UPDATED',
  'company.created': 'COMPANY_CREATED',
  'company.updated': 'COMPANY_UPDATED',
  'lead.created': 'LEAD_CREATED',
  'lead.updated': 'LEAD_UPDATED',
  'lead.status_changed': 'LEAD_STATUS_CHANGED',
  'lead.assigned': 'LEAD_ASSIGNED',
  'sale.created': 'SALE_CREATED',
  'sale.updated': 'SALE_UPDATED',
  'sale.status_changed': 'SALE_STATUS_CHANGED',
  'project.created': 'PROJECT_CREATED',
  'project.status_changed': 'PROJECT_STATUS_CHANGED',
  'task.created': 'TASK_CREATED',
  'task.updated': 'TASK_UPDATED',
  'task.status_changed': 'TASK_STATUS_CHANGED',
  'report.scheduled': 'REPORT_SCHEDULED',
  'email.sent': 'EMAIL_SENT',
  'email.received': 'EMAIL_RECEIVED',
  'telegram.message_received': 'TELEGRAM_MESSAGE_RECEIVED',
  'note.created': 'NOTE_CREATED',
  scheduled: 'SCHEDULED',
  'custom_object.record_created': 'CUSTOM_OBJECT_RECORD_CREATED',
  'custom_object.record_updated': 'CUSTOM_OBJECT_RECORD_UPDATED',
  'custom_object.status_changed': 'CUSTOM_OBJECT_STATUS_CHANGED',
  'shopify.payment_received': 'SHOPIFY_PAYMENT_RECEIVED',
};

export const getTriggerLabel = (event: string, t: TFunction): string => {
  const formKey = TRIGGER_EVENT_TO_FORM[event];
  if (formKey) {
    const k = `crm.automations.form.triggers.${formKey}`;
    const label = t(k);
    if (label && label !== k) return label;
  }
  return event;
};

export const getActionLabel = (type: string, t: TFunction): string => {
  const k = `crm.automations.form.actionTypes.${type}`;
  const fromForm = t(k);
  if (fromForm && fromForm !== k) return fromForm;
  const legacy = `crm.automations.labels.actions.${type}`;
  const fromLegacy = t(legacy);
  if (fromLegacy && fromLegacy !== legacy) return fromLegacy;
  return type;
};
