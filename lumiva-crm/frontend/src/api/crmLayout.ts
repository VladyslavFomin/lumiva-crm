import { api } from './client';

/** Структура CRM (Настройки → «Структура CRM»). Ключ без значения = включено. */
export const LEAD_BLOCKS = [
  'contact', 'amount', 'company', 'contacts', 'projects', 'deals', 'sales', 'bookings',
  'customFields', 'utm', 'notes', 'chat', 'calls', 'comments', 'history', 'ai', 'tasks', 'meetings',
] as const;
export const PROJECT_BLOCKS = [
  'budget', 'progress', 'links', 'tags', 'customFields', 'notes', 'files', 'tasks', 'comments', 'history', 'watchers',
] as const;
export const DEAL_BLOCKS = [
  'progress', 'links', 'tags', 'customFields', 'notes', 'files', 'tasks', 'comments', 'history', 'watchers',
] as const;

export type LeadBlock = (typeof LEAD_BLOCKS)[number];
export type ProjectBlock = (typeof PROJECT_BLOCKS)[number];
export type DealBlock = (typeof DEAL_BLOCKS)[number];

export type CrmLayout = {
  lead: Record<LeadBlock, boolean>;
  project: Record<ProjectBlock, boolean>;
  deal: Record<DealBlock, boolean>;
};

const all = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, true])) as Record<K, boolean>;
export const DEFAULT_CRM_LAYOUT: CrmLayout = { lead: all(LEAD_BLOCKS), project: all(PROJECT_BLOCKS), deal: all(DEAL_BLOCKS) };

export const fetchCrmLayout = () => api.get<CrmLayout>('/tenants/crm-layout');
export const saveCrmLayout = (patch: Partial<{ lead: Partial<CrmLayout['lead']>; project: Partial<CrmLayout['project']>; deal: Partial<CrmLayout['deal']> }>) =>
  api.put<CrmLayout>('/tenants/crm-layout', patch);
