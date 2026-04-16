/** Пресеты для главной: те же slug, что и id виджетов на страницах аналитики (ProjectsAnalyticsPage / V2). */
export type DashboardPresetSource = 'projects' | 'sales' | 'leads';

export type PresetKind = 'metric' | 'donut' | 'bar' | 'table';

export interface DashboardPresetDefinition {
  slug: string;
  kind: PresetKind;
  /** i18n key для названия (общий для проектов; для таба подставляется контекст) */
  titleKey: string;
}

/** Совпадает с defaultWidgets в ProjectsAnalyticsPage (не workspace) + metric-won */
export const PROJECTS_STYLE_PRESETS: DashboardPresetDefinition[] = [
  {
    slug: 'metric-total',
    kind: 'metric',
    titleKey: 'crm.projects.analytics.kpis.total',
  },
  {
    slug: 'metric-amount',
    kind: 'metric',
    titleKey: 'crm.projects.analytics.kpis.amount',
  },
  {
    slug: 'metric-owners',
    kind: 'metric',
    titleKey: 'crm.projects.analytics.kpis.owners',
  },
  {
    slug: 'metric-won',
    kind: 'metric',
    titleKey: 'crm.dashboard.presets.metricWonProjects',
  },
  {
    slug: 'chart-status',
    kind: 'donut',
    titleKey: 'crm.projects.analytics.statusChart.title',
  },
  {
    slug: 'chart-categories',
    kind: 'bar',
    titleKey: 'crm.projects.analytics.categoryChart.title',
  },
  {
    slug: 'table-projects',
    kind: 'table',
    titleKey: 'crm.projects.analytics.table.title',
  },
];

export const PRESETS_BY_TAB: Record<DashboardPresetSource, DashboardPresetDefinition[]> = {
  projects: PROJECTS_STYLE_PRESETS,
  sales: PROJECTS_STYLE_PRESETS,
  leads: PROJECTS_STYLE_PRESETS,
};

export function defaultHeightForPreset(kind: PresetKind, size: 'sm' | 'md' | 'lg'): number {
  if (kind === 'table') {
    return size === 'lg' ? 420 : size === 'md' ? 360 : 300;
  }
  if (kind === 'donut' || kind === 'bar') {
    return size === 'lg' ? 380 : size === 'md' ? 320 : 260;
  }
  return size === 'lg' ? 280 : size === 'md' ? 240 : 200;
}

export function getPresetDefinition(
  source: DashboardPresetSource,
  slug: string,
): DashboardPresetDefinition | undefined {
  return PRESETS_BY_TAB[source].find((p) => p.slug === slug);
}
