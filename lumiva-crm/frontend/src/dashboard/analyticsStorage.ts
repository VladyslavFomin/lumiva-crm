import type { DashboardPresetSource } from './presetCatalog';

/** Источники с ОДНИМ статическим localStorage-неймспейсом на всё приложение — то, что реально
 * умеет читать вкладка "Добавить блоки" (DashboardAddPresetsModal). 'workspace' и 'client-account'
 * сюда не входят: у них неймспейс на КАЖДУЮ таблицу/клиента отдельно (`workspace_analytics_${id}`,
 * `client_account_operations_analytics_v3_${id}`), так что единого ключа для них не существует —
 * тот сценарий целиком идёт через кнопку "На главную" на самой странице аналитики (см.
 * DashboardPresetWidget, которая грузит данные по instance.sourceRef), не через эту вкладку. */
export type CatalogStorageSource = Extract<DashboardPresetSource, 'projects' | 'sales' | 'leads'>;

/** Совпадает с `storageNamespace` в ProjectsAnalyticsPage */
export const ANALYTICS_STORAGE_NAMESPACE: Record<CatalogStorageSource, string> = {
  projects: 'projects_analytics',
  sales: 'sales_analytics',
  leads: 'leads_analytics_v2',
};

export type PivotMeasureConfig = {
  id: string;
  mode: 'count' | 'sum';
  valueField?: string;
  shortLabel?: string;
};

/** Снимок виджета из localStorage (тот же формат, что JSON в аналитике) */
export type ProjectsAnalyticsWidgetConfig = {
  id: string;
  type: 'metric' | 'donut' | 'bar' | 'line' | 'funnel' | 'leaderboard' | 'table' | 'heatmap' | 'note' | 'formula' | 'pivot';
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
  /** Несколько полей группировки для таблицы (workspace): строка = комбинация значений, сумма/кол-во по ней */
  tableDimensions?: string[];
  formulaFn?: string;
  formulaLeftType?: string;
  formulaLeftKey?: string;
  formulaRightType?: string;
  formulaRightKey?: string;
  formulaMode?: string;
  formulaFilters?: Array<{ scope: string; key?: string; keys?: string[] }>;
  /** Как показать сравнение левой/правой части формулы (кроме голого числа) — см. CompareDisplay
   * в ProjectsAnalyticsPage. */
  compareDisplay?: 'number' | 'bar' | 'line' | 'donut' | 'table';
  compareSides?: Array<{ id: string; label?: string; monthKeys: string[]; color?: string }>;
  pivotRowKey?: string;
  pivotColKey?: string;
  pivotMeasures?: PivotMeasureConfig[];
  [key: string]: unknown;
};

export function loadAnalyticsWidgetsFromStorage(
  source: CatalogStorageSource,
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
