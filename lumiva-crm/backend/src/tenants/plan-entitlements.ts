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
  'projects',
  'projects_analytics',
  'projects_kanban',
  'projects_calendar',
  'sales',
  'sales_pipeline',
  'sales_analytics',
  'marketing',
  'marketing_campaigns',
  'marketing_analytics',
  'tools',
  'tools_integrations',
  'tools_automation',
  'tools_settings',
  'custom_objects',
  'email',
  'telegram',
  'chat',
  'client_accounts',
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
  projects: 'standard',
  projects_analytics: 'standard',
  projects_kanban: 'standard',
  projects_calendar: 'standard',
  sales: 'standard',
  sales_pipeline: 'standard',
  sales_analytics: 'standard',
  marketing: 'standard',
  marketing_campaigns: 'standard',
  marketing_analytics: 'standard',
  tools: 'standard',
  tools_settings: 'standard',
  custom_objects: 'professional',
  tools_integrations: 'professional',
  tools_automation: 'professional',
  email: 'professional',
  telegram: 'professional',
  chat: 'professional',
  client_accounts: 'enterprise',
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

function buildState(
  keys: readonly string[],
  current: Record<string, boolean> | null | undefined,
  isAllowed: (key: string) => boolean,
) {
  const next: Record<string, boolean> = {};
  for (const key of keys) {
    const allowed = isAllowed(key);
    if (!allowed) {
      next[key] = false;
      continue;
    }
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
