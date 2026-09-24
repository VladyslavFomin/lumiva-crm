import { pushDashboardServerLayout } from '../api/dashboard';
import {
  defaultHeightForPreset,
  getPresetDefinition,
  type DashboardPresetSource,
} from './presetCatalog';

export type { DashboardPresetSource };

/** Виджеты по умолчанию на главной */
export const DASHBOARD_CORE_WIDGET_IDS = [
  'kpi',
  'profile-completion',
  'quick-actions',
  'calendar',
  'activity-feed',
  'learn-inspire',
  'leads-timeline',
  'projects',
  'channels-funnel',
  'recent-leads',
  'recent-tasks',
  'staff',
  'funnel_today',
  'lead_sources_week',
  'recent_deals',
  'birthdays',
] as const;

/** Добавляются с других страниц («Добавить на главную») */
export const DASHBOARD_EXTRA_WIDGET_IDS = [
  'projects-analytics',
  'leads-analytics',
  'sales-analytics',
  'products-analytics',
  'bookings-analytics',
  'hotels-analytics',
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

/** Ширина блока в колонках: точное значение из spans, если оно ещё согласовано с sizes
 * (ИИ-ассистент/старые клиенты меняют только sizes — тогда spans устарел и не применяется). */
export function getWidgetColSpan(id: string, layout: Pick<DashboardLayoutState, 'sizes' | 'spans'>): number {
  const size = layout.sizes[id] || 'md';
  const exact = layout.spans?.[id];
  if (typeof exact === 'number' && exact >= 3 && exact <= 12 && colSpanToSize(exact) === size) return exact;
  return sizeToColSpan(size);
}

export interface DashboardPresetInstance {
  source: DashboardPresetSource;
  slug: string;
  /** Полный JSON виджета с страницы аналитики — нужен для кастомных блоков */
  widgetConfig?: unknown;
  /** Для source 'workspace' — id таблицы рабочей области; для 'client-account' — id клиента.
   * Без него DashboardPresetWidget не знает, какой набор записей подгрузить заново. */
  sourceRef?: string;
  /** Ограничение периода (YYYY-MM-DD) — фильтрация на клиенте по createdAt, до агрегации
   * metric/donut/bar/table в DashboardPresetWidget. Ставится вручную или ИИ-ассистентом
   * (crm_dashboard_configure). Без него виджет считает за весь период, как раньше. */
  filters?: { dateFrom?: string; dateTo?: string };
}

const STORAGE_KEY_V4 = 'lumiva_dashboard_layout_v4';
const STORAGE_KEY_LEGACY = 'lumiva_dashboard_layout_v3';
/** Таймстамп последнего layout, который реально применили (свой push ИЛИ серверный, включая
 * ИИ-правки) — чтобы GET /dashboard/layout на mount/focus не переигрывал уже применённое эхо. */
const STORAGE_KEY_APPLIED_AT = 'lumiva_dashboard_layout_applied_at';

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
  /** Точная ширина в колонках (3–12) — sizes хранит только 3 грубых шага */
  spans: Record<string, number>;
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
    hidden: new Set<string>([
      ...DASHBOARD_EXTRA_WIDGET_IDS,
      'funnel_today',
      'lead_sources_week',
      'recent_deals',
      'birthdays',
    ]),
    sizes: {
      kpi: 'lg',
      'profile-completion': 'md',
      'quick-actions': 'lg',
      calendar: 'md',
      'activity-feed': 'md',
      'learn-inspire': 'md',
      'leads-timeline': 'md',
      projects: 'md',
      'channels-funnel': 'lg',
      'recent-leads': 'lg',
      'recent-tasks': 'md',
      staff: 'md',
      'projects-analytics': 'lg',
      'leads-analytics': 'lg',
      'sales-analytics': 'lg',
      'products-analytics': 'lg',
      'bookings-analytics': 'lg',
      'hotels-analytics': 'lg',
      funnel_today: 'md',
      lead_sources_week: 'md',
      recent_deals: 'md',
      birthdays: 'md',
    },
    spans: {},
    heights: {},
    presetInstances: {},
    titleOverrides: {},
  };
}

function defaultHeightForWidgetId(id: string): number {
  const map: Record<string, number> = {
    kpi: 200,
    'profile-completion': 420,
    'quick-actions': 120,
    calendar: 520,
    'activity-feed': 420,
    'learn-inspire': 360,
    'leads-timeline': 280,
    projects: 320,
    'channels-funnel': 300,
    'recent-leads': 360,
    'recent-tasks': 320,
    staff: 300,
    'projects-analytics': 220,
    'leads-analytics': 220,
    'sales-analytics': 220,
    'products-analytics': 240,
    'bookings-analytics': 240,
    'hotels-analytics': 240,
    funnel_today: 280,
    lead_sources_week: 260,
    recent_deals: 320,
    birthdays: 280,
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
  if (t === 'bar' || t === 'line' || t === 'funnel' || t === 'leaderboard' || t === 'heatmap') {
    return defaultHeightForPreset('bar', size);
  }
  if (t === 'note') return defaultHeightForPreset('metric', size);
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

export function serializeLayout(state: DashboardLayoutState) {
  return {
    order: state.order,
    hidden: [...state.hidden],
    sizes: state.sizes,
    spans: state.spans,
    heights: state.heights,
    presetInstances: state.presetInstances,
    titleOverrides: state.titleOverrides,
  };
}

/** Разбирает JSON (из localStorage ИЛИ с сервера — тот же формат serializeLayout) в
 * DashboardLayoutState, домешивая дефолтные core/extra id, которых не было при сохранении
 * (новые виджеты, добавленные в код после того, как пользователь сохранил свой layout). */
export function normalizeDashboardLayoutState(parsed: {
  order?: string[];
  hidden?: string[];
  sizes?: Record<string, WidgetSize>;
  spans?: Record<string, number>;
  heights?: Record<string, number>;
  presetInstances?: Record<string, DashboardPresetInstance>;
  titleOverrides?: Record<string, string>;
} | null | undefined): DashboardLayoutState | null {
  if (!parsed) return null;
  const base = defaultLayout();
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
    spans: { ...(parsed.spans || {}) },
    heights: { ...(parsed.heights || {}) },
    presetInstances,
    titleOverrides: { ...(parsed.titleOverrides || {}) },
  };
}

function parseStoredLayout(raw: string | null): DashboardLayoutState | null {
  if (!raw) return null;
  try {
    return normalizeDashboardLayoutState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function loadDashboardLayout(): DashboardLayoutState {
  const v4 = parseStoredLayout(localStorage.getItem(STORAGE_KEY_V4));
  if (v4) return v4;

  const legacy = parseStoredLayout(localStorage.getItem(STORAGE_KEY_LEGACY));
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

/** Таймстамп последнего применённого layout (свой push или серверный) — null если ни разу. */
export function getAppliedDashboardLayoutAt(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_APPLIED_AT);
  } catch {
    return null;
  }
}

function markDashboardLayoutAppliedAt(updatedAt: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_APPLIED_AT, updatedAt);
  } catch {
    /* ignore */
  }
}

/** true если серверная версия (напр. только что применённая ИИ-ассистентом через
 * crm_dashboard_configure) новее того, что уже применено в этом браузере. */
export function isServerDashboardLayoutNewer(serverUpdatedAt: string | null | undefined): boolean {
  if (!serverUpdatedAt) return false;
  const applied = getAppliedDashboardLayoutAt();
  if (!applied) return true;
  return new Date(serverUpdatedAt).getTime() > new Date(applied).getTime();
}

/** Накатывает серверный layout поверх localStorage и возвращает новый state — вызывается
 * из DashboardPage при обнаружении isServerDashboardLayoutNewer(). */
export function applyServerDashboardLayout(
  rawLayout: unknown,
  updatedAt: string,
): DashboardLayoutState {
  const next = normalizeDashboardLayoutState(rawLayout as any) || defaultLayout();
  saveDashboardLayout(next);
  markDashboardLayoutAppliedAt(updatedAt);
  return next;
}

/** Помечает таймстамп только что запушенного на сервер layout как «применённый» — чтобы
 * следующая проверка isServerDashboardLayoutNewer() не переиграла собственное же изменение. */
export function markOwnDashboardLayoutPush(updatedAt: string): void {
  markDashboardLayoutAppliedAt(updatedAt);
}

/** Зеркалит текущий layout на сервер (User.preferences.dashboardLayout) — для ИИ-инструмента
 * crm_dashboard_configure и синхронизации между устройствами. Fire-and-forget: при ошибке сети
 * localStorage остаётся источником, синхронизация просто отложится до следующего изменения. */
export function mirrorDashboardLayoutToServer(state: DashboardLayoutState): void {
  const updatedAt = new Date().toISOString();
  markDashboardLayoutAppliedAt(updatedAt);
  pushDashboardServerLayout(serializeLayout(state), updatedAt).catch(() => {});
}

export function saveDashboardLayout(state: DashboardLayoutState): void {
  try {
    localStorage.setItem(STORAGE_KEY_V4, JSON.stringify(serializeLayout(state)));
  } catch {
    /* ignore */
  }
}

/** Сбросить расстановку блоков главной к значениям по умолчанию */
export function resetDashboardLayout(): DashboardLayoutState {
  const fresh = defaultLayout();
  saveDashboardLayout(fresh);
  return fresh;
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
    const nextState = {
      ...prev,
      hidden,
      order,
      presetInstances,
      sizes,
      heights,
    };
    saveDashboardLayout(nextState);
    mirrorDashboardLayoutToServer(nextState);
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
  const nextState = { ...prev, hidden, order };
  saveDashboardLayout(nextState);
  mirrorDashboardLayoutToServer(nextState);
  return true;
}
