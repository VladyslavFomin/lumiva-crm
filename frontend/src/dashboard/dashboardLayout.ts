import {
  defaultHeightForPreset,
  getPresetDefinition,
  type DashboardPresetSource,
} from './presetCatalog';

export type { DashboardPresetSource };

/** Виджеты по умолчанию на главной */
export const DASHBOARD_CORE_WIDGET_IDS = [
  'kpi',
  'calendar',
  'leads-timeline',
  'projects',
  'channels-funnel',
  'recent-leads',
  'recent-tasks',
  'staff',
] as const;

/** Добавляются с других страниц («Добавить на главную») */
export const DASHBOARD_EXTRA_WIDGET_IDS = [
  'projects-analytics',
  'leads-analytics',
  'sales-analytics',
] as const;

export const ALL_DASHBOARD_WIDGET_IDS = [
  ...DASHBOARD_CORE_WIDGET_IDS,
  ...DASHBOARD_EXTRA_WIDGET_IDS,
] as const;

export type DashboardWidgetId = (typeof ALL_DASHBOARD_WIDGET_IDS)[number];

export type WidgetSize = 'sm' | 'md' | 'lg';

/** Сетка 12 колонок (xl): sm≈4, md≈6, lg=12 */
export function sizeToColSpan(size: WidgetSize): number {
  if (size === 'sm') return 4;
  if (size === 'md') return 6;
  return 12;
}

export function colSpanToSize(span: number): WidgetSize {
  if (span <= 5) return 'sm';
  if (span <= 9) return 'md';
  return 'lg';
}

export interface DashboardPresetInstance {
  source: DashboardPresetSource;
  slug: string;
  /** Полный JSON виджета с страницы аналитики — нужен для кастомных блоков */
  widgetConfig?: unknown;
}

const STORAGE_KEY_V4 = 'lumiva_dashboard_layout_v4';
const STORAGE_KEY_LEGACY = 'lumiva_dashboard_layout_v3';

function isCoreOrExtraWidgetId(id: string): id is DashboardWidgetId {
  return (ALL_DASHBOARD_WIDGET_IDS as readonly string[]).includes(id);
}

/** Экземпляры пресетов аналитики на главной */
export function isDashboardPresetInstanceId(id: string): boolean {
  return id.startsWith('pid_') && id.length >= 12;
}

export function newDashboardPresetInstanceId(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  const hex = Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  return `pid_${hex}`;
}

export interface DashboardLayoutState {
  order: string[];
  hidden: Set<string>;
  sizes: Record<string, WidgetSize>;
  /** Высота карточки в px (главная, как в аналитике — тянем за край) */
  heights: Record<string, number>;
  /** Конфиг пресетов pid_* */
  presetInstances: Record<string, DashboardPresetInstance>;
  /** Пользовательские названия блоков на главной (id виджета или pid_*) */
  titleOverrides: Record<string, string>;
}

function defaultLayout(): DashboardLayoutState {
  return {
    order: [...DASHBOARD_CORE_WIDGET_IDS, ...DASHBOARD_EXTRA_WIDGET_IDS],
    hidden: new Set<string>([...DASHBOARD_EXTRA_WIDGET_IDS]),
    sizes: {
      kpi: 'lg',
      calendar: 'md',
      'leads-timeline': 'md',
      projects: 'md',
      'channels-funnel': 'lg',
      'recent-leads': 'lg',
      'recent-tasks': 'md',
      staff: 'md',
      'projects-analytics': 'lg',
      'leads-analytics': 'lg',
      'sales-analytics': 'lg',
    },
    heights: {},
    presetInstances: {},
    titleOverrides: {},
  };
}

function defaultHeightForWidgetId(id: string): number {
  const map: Record<string, number> = {
    kpi: 200,
    calendar: 440,
    'leads-timeline': 280,
    projects: 320,
    'channels-funnel': 300,
    'recent-leads': 360,
    'recent-tasks': 320,
    staff: 300,
    'projects-analytics': 220,
    'leads-analytics': 220,
    'sales-analytics': 220,
  };
  return map[id] ?? 280;
}

function heightFromWidgetConfigJson(
  w: { type?: string; size?: WidgetSize; height?: number },
): number | null {
  if (typeof w.height === 'number' && Number.isFinite(w.height) && w.height >= 120) {
    return w.height;
  }
  const size = w.size || 'md';
  const t = w.type;
  if (t === 'metric') return defaultHeightForPreset('metric', size);
  if (t === 'donut') return defaultHeightForPreset('donut', size);
  if (t === 'bar') return defaultHeightForPreset('bar', size);
  if (t === 'table' || t === 'formula') return defaultHeightForPreset('table', size);
  return null;
}

/** При добавлении пресета на главную */
export function getInitialSizeAndHeightForPreset(preset: DashboardPresetInstance): {
  size: WidgetSize;
  height: number;
} {
  const wc = preset.widgetConfig as { type?: string; size?: WidgetSize } | undefined;
  if (wc?.type) {
    const size = (wc.size as WidgetSize) || 'md';
    const h = heightFromWidgetConfigJson(wc);
    return { size, height: h ?? defaultHeightForPreset('metric', size) };
  }
  const def = getPresetDefinition(preset.source, preset.slug);
  const size = 'md';
  if (def) return { size, height: defaultHeightForPreset(def.kind, size) };
  return { size, height: defaultHeightForPreset('metric', size) };
}

export function getDefaultWidgetHeight(id: string, layout: DashboardLayoutState): number {
  if (layout.heights[id] != null) return layout.heights[id]!;
  const inst = layout.presetInstances[id];
  if (inst) {
    if (inst.widgetConfig && typeof inst.widgetConfig === 'object' && inst.widgetConfig !== null) {
      const h = heightFromWidgetConfigJson(inst.widgetConfig as { type?: string; size?: WidgetSize });
      if (h != null) return h;
    }
    const def = getPresetDefinition(inst.source, inst.slug);
    const size = layout.sizes[id] || 'md';
    if (def) return defaultHeightForPreset(def.kind, size);
  }
  return defaultHeightForWidgetId(id);
}

function isValidOrderId(id: string, presetInstances: Record<string, DashboardPresetInstance>): boolean {
  if (isCoreOrExtraWidgetId(id)) return true;
  if (isDashboardPresetInstanceId(id) && presetInstances[id]) return true;
  return false;
}

function serializeLayout(state: DashboardLayoutState) {
  return {
    order: state.order,
    hidden: [...state.hidden],
    sizes: state.sizes,
    heights: state.heights,
    presetInstances: state.presetInstances,
    titleOverrides: state.titleOverrides,
  };
}

export function loadDashboardLayout(): DashboardLayoutState {
  const base = defaultLayout();

  const parse = (raw: string | null): DashboardLayoutState | null => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as {
        order?: string[];
        hidden?: string[];
        sizes?: Record<string, WidgetSize>;
        heights?: Record<string, number>;
        presetInstances?: Record<string, DashboardPresetInstance>;
        titleOverrides?: Record<string, string>;
      };
      const presetInstances = { ...(parsed.presetInstances || {}) };
      const orderRaw = parsed.order?.length ? parsed.order : base.order;
      const order = orderRaw.filter((id) => isValidOrderId(id, presetInstances));
      const mergedOrder = [...new Set([...order, ...base.order])].filter((id) =>
        isValidOrderId(id, presetInstances),
      );
      return {
        order: mergedOrder,
        hidden: new Set(parsed.hidden || []),
        sizes: { ...base.sizes, ...(parsed.sizes || {}) },
        heights: { ...(parsed.heights || {}) },
        presetInstances,
        titleOverrides: { ...(parsed.titleOverrides || {}) },
      };
    } catch {
      return null;
    }
  };

  const v4 = parse(localStorage.getItem(STORAGE_KEY_V4));
  if (v4) return v4;

  const legacy = parse(localStorage.getItem(STORAGE_KEY_LEGACY));
  if (legacy) {
    try {
      localStorage.setItem(STORAGE_KEY_V4, JSON.stringify(serializeLayout(legacy)));
    } catch {
      /* ignore */
    }
    return legacy;
  }

  return defaultLayout();
}

export function saveDashboardLayout(state: DashboardLayoutState): void {
  try {
    localStorage.setItem(STORAGE_KEY_V4, JSON.stringify(serializeLayout(state)));
  } catch {
    /* ignore */
  }
}

/** Событие: добавить виджет на главную (с других страниц) */
export const DASHBOARD_ADD_WIDGET_EVENT = 'lumiva-dashboard-add-widget';

export type DashboardAddWidgetDetail =
  | { widgetId: string; preset?: undefined }
  | { preset: DashboardPresetInstance; widgetId?: undefined };

export function requestAddDashboardWidget(widgetId: string): void {
  window.dispatchEvent(
    new CustomEvent(DASHBOARD_ADD_WIDGET_EVENT, { detail: { widgetId } }),
  );
}

export function requestAddDashboardPreset(preset: DashboardPresetInstance): void {
  window.dispatchEvent(
    new CustomEvent(DASHBOARD_ADD_WIDGET_EVENT, { detail: { preset } }),
  );
}

/** После записи layout — главная подхватывает state (если открыта) */
export const DASHBOARD_LAYOUT_CHANGED_EVENT = 'lumiva-dashboard-layout-changed';

export type DashboardLayoutChangedDetail = { addedWidget?: boolean };

/**
 * Сохраняет виджет на главную в localStorage.
 * Вызывается из обработчика в MainLayout (слушатель всегда активен, в отличие от DashboardPage).
 */
export function applyDashboardAddWidgetDetail(d: DashboardAddWidgetDetail | undefined): boolean {
  if (!d) return false;
  if ('preset' in d && d.preset) {
    const preset = d.preset;
    const pid = newDashboardPresetInstanceId();
    const { size: initSize, height: initHeight } = getInitialSizeAndHeightForPreset(preset);
    const prev = loadDashboardLayout();
    const hidden = new Set(prev.hidden);
    hidden.delete(pid);
    const presetInstances = { ...prev.presetInstances, [pid]: preset };
    const order = prev.order.includes(pid) ? prev.order : [...prev.order, pid];
    const sizes = { ...prev.sizes, [pid]: initSize };
    const heights = { ...prev.heights, [pid]: initHeight };
    saveDashboardLayout({
      ...prev,
      hidden,
      order,
      presetInstances,
      sizes,
      heights,
    });
    return true;
  }
  const w = d as { widgetId?: string };
  if (!w?.widgetId) return false;
  const prev = loadDashboardLayout();
  const hidden = new Set(prev.hidden);
  hidden.delete(w.widgetId!);
  const order = prev.order.includes(w.widgetId!)
    ? prev.order
    : [...prev.order, w.widgetId!];
  saveDashboardLayout({ ...prev, hidden, order });
  return true;
}
