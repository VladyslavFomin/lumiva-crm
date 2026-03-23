import type { DashboardPresetSource } from './presetCatalog';

/** Совпадает с `storageNamespace` в ProjectsAnalyticsPage */
export const ANALYTICS_STORAGE_NAMESPACE: Record<DashboardPresetSource, string> = {
  projects: 'projects_analytics',
  sales: 'sales_analytics',
  leads: 'leads_analytics',
};

/** Снимок виджета из localStorage (тот же формат, что JSON в аналитике) */
export type ProjectsAnalyticsWidgetConfig = {
  id: string;
  type: 'metric' | 'donut' | 'bar' | 'table' | 'formula';
  title: string;
  size: 'sm' | 'md' | 'lg';
  height?: number;
  themeKey?: string;
  showLabels?: boolean;
  metricKey?: string;
  chartKey?: string;
  chartValueMode?: 'count' | 'sum';
  chartValueField?: string;
  tableKey?: string;
  formulaFn?: string;
  formulaLeftType?: string;
  formulaLeftKey?: string;
  formulaRightType?: string;
  formulaRightKey?: string;
  formulaMode?: string;
  formulaFilters?: Array<{ scope: string; key: string }>;
  [key: string]: unknown;
};

export function loadAnalyticsWidgetsFromStorage(
  source: DashboardPresetSource,
): ProjectsAnalyticsWidgetConfig[] {
  const ns = ANALYTICS_STORAGE_NAMESPACE[source];
  try {
    const raw = localStorage.getItem(`${ns}_widgets`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((x) => x && typeof x === 'object' && 'id' in x && 'type' in x) as ProjectsAnalyticsWidgetConfig[];
    }
  } catch {
    /* ignore */
  }
  return [];
}

export const ANALYTICS_WIDGETS_CHANGED_EVENT = 'lumiva-analytics-widgets-changed';

export function notifyAnalyticsWidgetsChanged(namespace: string): void {
  window.dispatchEvent(
    new CustomEvent(ANALYTICS_WIDGETS_CHANGED_EVENT, { detail: { namespace } }),
  );
}
