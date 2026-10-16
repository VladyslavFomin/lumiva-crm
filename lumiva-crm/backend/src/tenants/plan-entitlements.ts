export type NormalizedTenantPlan =
  | 'free_locked'
  | 'standard'
  | 'professional'
  | 'enterprise'
  | 'ultimate';

export const MODULE_KEYS = [
  'chat',
  'telegram',
  'cf7',
  'marketing',
  'analytics',
  'woo',
  'reputation',
  'smm',
  'clientcabinet',
  'crm_connector',
  'crm_dashboard',
  'diagnostics',
  'email_branding',
  'polylang_ai',
  'site_checker',
  'crm_bridge',
  'crm',
] as const;

export const COMPONENT_KEYS = [
  'contacts',
  'companies',
  'notes',
  'leads',
  'leads_create',
  'leads_lost',
  'leads_archive',
  'leads_trash',
  'leads_analytics',
  'leads_roi',
  'projects',
  'projects_analytics',
  'projects_kanban',
  'projects_calendar',
  'sales',
  'sales_pipeline',
  'sales_analytics',
  'marketing',
  'marketing_traffic',
  'marketing_campaigns',
  'marketing_roi',
  'marketing_broadcasts',
  'marketing_utms',
  'marketing_utm_links',
  'marketing_segments',
  'marketing_channels',
  'marketing_seo',
  'marketing_smm',
  'marketing_integrations',
  'tools',
  'tools_integrations',
  'tools_automation',
  'tools_approvals',
  'tools_web_forms',
  'tools_web_forms_settings',
  'tools_telegram_inbox',
  'tools_settings',
  'custom_objects',
  'email',
  'telegram',
  'whatsapp',
  'chat',
  'client_accounts',
  'sms',
  'deduplication',
  'bookings',
  'hotels',
  'hotels_reservations',
  'hotels_frontdesk',
  'hotels_pricing',
  'hotels_calendar',
  'hotels_analytics',
  'hotels_reviews',
  'products',
  'team_calendar',
  'analytics',
  'helpdesk',
  'esign',
  'phone_system',
  'ai_office',
  'ai_employees',
  'aura',
  'team',
] as const;

const PLAN_RANK: Record<NormalizedTenantPlan, number> = {
  free_locked: 0,
  standard: 1,
  professional: 2,
  enterprise: 3,
  ultimate: 4,
};

const MODULE_MIN_PLAN: Record<string, NormalizedTenantPlan> = {
  crm: 'standard',
  crm_dashboard: 'standard',
  crm_connector: 'standard',
  crm_bridge: 'standard',
  diagnostics: 'standard',
  analytics: 'standard',
  marketing: 'standard',
  woo: 'standard',
  cf7: 'standard',
  clientcabinet: 'professional',
  chat: 'professional',
  reputation: 'professional',
  smm: 'professional',
  email_branding: 'professional',
  telegram: 'professional',
  polylang_ai: 'enterprise',
  site_checker: 'enterprise',
};

const COMPONENT_MIN_PLAN: Record<string, NormalizedTenantPlan> = {
  contacts: 'standard',
  companies: 'standard',
  notes: 'standard',
  leads: 'standard',
  leads_create: 'standard',
  leads_lost: 'standard',
  leads_archive: 'standard',
  leads_trash: 'standard',
  leads_analytics: 'standard',
  leads_roi: 'standard',
  projects: 'standard',
  projects_analytics: 'standard',
  projects_kanban: 'standard',
  projects_calendar: 'standard',
  sales: 'standard',
  sales_pipeline: 'standard',
  sales_analytics: 'standard',
  marketing: 'standard',
  marketing_traffic: 'standard',
  marketing_campaigns: 'standard',
  marketing_roi: 'standard',
  marketing_broadcasts: 'standard',
  marketing_utms: 'standard',
  marketing_utm_links: 'standard',
  marketing_segments: 'standard',
  marketing_channels: 'standard',
  marketing_seo: 'standard',
  marketing_smm: 'standard',
  marketing_integrations: 'standard',
  tools: 'standard',
  tools_settings: 'standard',
  tools_integrations: 'standard',
  tools_automation: 'standard',
  tools_approvals: 'standard',
  tools_web_forms: 'standard',
  tools_web_forms_settings: 'standard',
  tools_telegram_inbox: 'standard',
  email: 'standard',
  custom_objects: 'standard',
  telegram: 'professional',
  whatsapp: 'professional',
  chat: 'professional',
  client_accounts: 'enterprise',
  sms: 'standard',
  deduplication: 'standard',
  bookings: 'standard',
  hotels: 'standard',
  hotels_reservations: 'standard',
  hotels_frontdesk: 'standard',
  hotels_pricing: 'standard',
  hotels_calendar: 'standard',
  hotels_analytics: 'standard',
  hotels_reviews: 'standard',
  products: 'standard',
  team_calendar: 'standard',
  analytics: 'standard',
  helpdesk: 'standard',
  esign: 'standard',
  phone_system: 'standard',
  ai_office: 'standard',
  ai_employees: 'standard',
  aura: 'standard',
  team: 'standard',
};

export function normalizeTenantPlan(plan?: string | null): NormalizedTenantPlan {
  const raw = (plan || '').trim().toLowerCase();
  if (raw === 'free_locked' || raw === 'locked' || raw === 'free') return 'free_locked';
  if (raw === 'basic' || raw === 'starter' || raw === 'standard') return 'standard';
  if (raw === 'pro' || raw === 'professional') return 'professional';
  if (raw === 'enterprise') return 'enterprise';
  if (raw === 'ultimate') return 'ultimate';
  return 'standard';
}

function isPlanAllowed(current: NormalizedTenantPlan, minPlan: NormalizedTenantPlan) {
  return PLAN_RANK[current] >= PLAN_RANK[minPlan];
}

/** Telephony is a paid add-on on top of any plan (see Tenant.telephonyAddonEnabled) — except
 * Ultimate, where it's included for free. Not part of COMPONENT_KEYS/COMPONENT_MIN_PLAN on
 * purpose (that mechanism can't express "off by default for everyone except one specific tier"). */
export function isTelephonyIncludedInPlan(plan?: string | null): boolean {
  return normalizeTenantPlan(plan) === 'ultimate';
}

/** Custom domain (white-label URL) is an Ultimate-only perk, configured by us on request — not
 * self-service. Same shape as isTelephonyIncludedInPlan: not part of COMPONENT_KEYS/MIN_PLAN
 * since that table expresses "min plan and above," not "only this exact tier." */
export function isCustomDomainIncludedInPlan(plan?: string | null): boolean {
  return normalizeTenantPlan(plan) === 'ultimate';
}

export function isModuleAllowedByPlan(moduleKey: string, plan?: string | null) {
  const normalizedPlan = normalizeTenantPlan(plan);
  const minPlan = MODULE_MIN_PLAN[moduleKey] || 'standard';
  if (normalizedPlan === 'free_locked') return false;
  return isPlanAllowed(normalizedPlan, minPlan);
}

/** CF7 (WordPress) и флаг crm_connector — один смысл для Lumiva Wizard / публичного API. */
export function isTenantModuleEnabled(
  moduleKey: string,
  enabledModules?: Record<string, boolean> | null,
): boolean {
  const em = enabledModules || {};
  if (moduleKey === 'cf7' || moduleKey === 'crm_connector') {
    return em.cf7 === true || em.crm_connector === true;
  }
  return em[moduleKey] === true;
}

export function applyTenantModuleToggle(
  moduleKey: string,
  enabled: boolean,
  enabledModules: Record<string, boolean>,
): void {
  if (moduleKey === 'cf7' || moduleKey === 'crm_connector') {
    enabledModules.cf7 = enabled;
    enabledModules.crm_connector = enabled;
  } else {
    enabledModules[moduleKey] = enabled;
  }
}

/** Пер-сайтовые переопределения: для cf7/crm_connector учитываем оба ключа. */
export function pickSiteModuleOverride(
  moduleKey: string,
  siteOverrides?: Record<string, boolean> | null,
): boolean | undefined {
  if (!siteOverrides) return undefined;
  if (moduleKey === 'cf7' || moduleKey === 'crm_connector') {
    if (typeof siteOverrides.cf7 === 'boolean') return siteOverrides.cf7;
    if (typeof siteOverrides.crm_connector === 'boolean') return siteOverrides.crm_connector;
    return undefined;
  }
  const v = siteOverrides[moduleKey];
  return typeof v === 'boolean' ? v : undefined;
}

export function isComponentAllowedByPlan(componentKey: string, plan?: string | null) {
  const normalizedPlan = normalizeTenantPlan(plan);
  const minPlan = COMPONENT_MIN_PLAN[componentKey] || 'standard';
  if (normalizedPlan === 'free_locked') return false;
  return isPlanAllowed(normalizedPlan, minPlan);
}

/**
 * Ключи, недоступные текущему тарифу, сознательно НЕ попадают в `next` (а не пишутся как
 * `false`) — иначе это "false" застревает в БД как будто админ выключил их вручную, и при
 * следующем повышении тарифа компонент/модуль так и остаётся выключенным, хотя тариф уже его
 * разрешает. Отсутствие ключа при чтении (getTenantComponents/getTenantModules,
 * isComponentAllowedByPlan/isModuleAllowedByPlan) трактуется как "не разрешено" ровно так же,
 * как явный false — поведение для потребителей не меняется, меняется только то, что переживает
 * следующий пересчёт при смене тарифа.
 */
function buildState(
  keys: readonly string[],
  current: Record<string, boolean> | null | undefined,
  isAllowed: (key: string) => boolean,
) {
  const next: Record<string, boolean> = {};
  for (const key of keys) {
    if (!isAllowed(key)) continue;
    if (typeof current?.[key] === 'boolean') {
      next[key] = current[key];
    } else {
      next[key] = true;
    }
  }
  return next;
}

export function buildPlanEntitlements(input: {
  plan?: string | null;
  enabledModules?: Record<string, boolean> | null;
  enabledComponents?: Record<string, boolean> | null;
}) {
  const normalizedPlan = normalizeTenantPlan(input.plan);
  return {
    normalizedPlan,
    enabledModules: buildState(MODULE_KEYS, input.enabledModules, (key) =>
      isModuleAllowedByPlan(key, normalizedPlan),
    ),
    enabledComponents: buildState(COMPONENT_KEYS, input.enabledComponents, (key) =>
      isComponentAllowedByPlan(key, normalizedPlan),
    ),
  };
}
