import {
  DASHBOARD_EXTRA_WIDGET_IDS,
  type DashboardLayoutState,
  isDashboardPresetInstanceId,
} from './dashboardLayout';

export type DashboardLayoutTemplateId = 'sales' | 'marketing' | 'operations';

const HIDE_ANALYTICS_EXTRAS = new Set<string>([...DASHBOARD_EXTRA_WIDGET_IDS]);

const TEMPLATES: Record<DashboardLayoutTemplateId, string[]> = {
  sales: [
    'kpi',
    'quick-actions',
    'channels-funnel',
    'recent-leads',
    'activity-feed',
    'projects',
    'calendar',
    'leads-timeline',
    'recent-tasks',
    'profile-completion',
    'learn-inspire',
    'staff',
  ],
  marketing: [
    'kpi',
    'leads-timeline',
    'channels-funnel',
    'activity-feed',
    'recent-leads',
    'calendar',
    'quick-actions',
    'projects',
    'recent-tasks',
    'profile-completion',
    'learn-inspire',
    'staff',
  ],
  operations: [
    'kpi',
    'projects',
    'recent-tasks',
    'calendar',
    'activity-feed',
    'channels-funnel',
    'leads-timeline',
    'recent-leads',
    'quick-actions',
    'profile-completion',
    'learn-inspire',
    'staff',
  ],
};

/**
 * Применяет готовую расстановку стандартных виджетов. Пользовательские pid_* в конце order сохраняются.
 */
export function applyDashboardLayoutTemplate(
  id: DashboardLayoutTemplateId,
  prev: DashboardLayoutState,
): DashboardLayoutState {
  const core = TEMPLATES[id];
  const tail = prev.order.filter(
    (x) => isDashboardPresetInstanceId(x) && prev.presetInstances[x],
  );
  const order = [...core, ...tail.filter((p) => !core.includes(p))];
  return {
    ...prev,
    order,
    hidden: new Set(HIDE_ANALYTICS_EXTRAS),
  };
}
