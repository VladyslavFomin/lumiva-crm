export type ProjectsViewType = 'table' | 'kanban' | 'calendar';

export type ProjectsViewSettings = {
  kanbanCardFields?: Array<
    'owner' | 'amount' | 'progress' | 'created' | 'priority' | 'tags' | 'deadline'
  >;
  calendarImportantOnly?: boolean;
};

export type ProjectsCustomView = {
  id: string;
  type: ProjectsViewType;
  name: string;
  order: number;
  settings?: ProjectsViewSettings;
  /**
   * Для пользовательского вида: только эти проекты. Без поля — старые виды показывают все проекты.
   * Новые виды создаются с пустым списком; проекты добавляются при создании из этого вида (?view=).
   */
  projectIds?: string[];
};

export type ProjectsViewsState = {
  customViews: ProjectsCustomView[];
  tabOrder: string[];
};

const VIEWS_KEY = 'projects_custom_views_v1';
const TAB_ORDER_KEY = 'projects_views_tab_order_v1';

const BASE_TAB_IDS = ['base-table', 'base-kanban', 'base-calendar'];

const randomId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

export const defaultProjectsViewSettings = (
  type: ProjectsViewType,
): ProjectsViewSettings => {
  if (type === 'kanban') {
    return {
      kanbanCardFields: ['amount', 'created', 'progress', 'tags'],
    };
  }
  if (type === 'calendar') {
    return { calendarImportantOnly: false };
  }
  return {};
};

export const loadProjectsViewsState = (): ProjectsViewsState => {
  try {
    const rawViews = localStorage.getItem(VIEWS_KEY);
    const rawOrder = localStorage.getItem(TAB_ORDER_KEY);
    const parsedViews = rawViews ? JSON.parse(rawViews) : [];
    const customViews: ProjectsCustomView[] = Array.isArray(parsedViews)
      ? parsedViews
          .filter(
            (item) =>
              item &&
              typeof item.id === 'string' &&
              typeof item.name === 'string' &&
              (item.type === 'table' ||
                item.type === 'kanban' ||
                item.type === 'calendar'),
          )
          .map((item, idx) => ({
            id: item.id,
            type: item.type,
            name: item.name,
            order: typeof item.order === 'number' ? item.order : idx,
            settings: item.settings || defaultProjectsViewSettings(item.type),
            projectIds: Array.isArray(item.projectIds) ? item.projectIds : undefined,
          }))
      : [];
    const fallbackOrder = [
      ...BASE_TAB_IDS,
      ...customViews
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((view) => view.id),
    ];
    const tabOrder = Array.isArray(rawOrder ? JSON.parse(rawOrder) : null)
      ? (JSON.parse(rawOrder as string) as string[])
      : fallbackOrder;
    return { customViews, tabOrder };
  } catch {
    return { customViews: [], tabOrder: [...BASE_TAB_IDS] };
  }
};

export const saveProjectsViewsState = (state: ProjectsViewsState) => {
  try {
    localStorage.setItem(VIEWS_KEY, JSON.stringify(state.customViews));
    localStorage.setItem(TAB_ORDER_KEY, JSON.stringify(state.tabOrder));
  } catch {
    // ignore
  }
};

export const createProjectsCustomView = (
  prev: ProjectsViewsState,
  type: ProjectsViewType,
  name: string,
): ProjectsViewsState => {
  const view: ProjectsCustomView = {
    id: `pv_${randomId()}`,
    type,
    name: name.trim(),
    order: prev.customViews.length,
    settings: defaultProjectsViewSettings(type),
    projectIds: [],
  };
  const customViews = [...prev.customViews, view];
  const tabOrder = [...prev.tabOrder, view.id];
  return { customViews, tabOrder };
};

export const updateProjectsCustomView = (
  prev: ProjectsViewsState,
  id: string,
  patch: Partial<ProjectsCustomView>,
): ProjectsViewsState => {
  const customViews = prev.customViews.map((view) =>
    view.id === id ? { ...view, ...patch } : view,
  );
  return { ...prev, customViews };
};

export const deleteProjectsCustomView = (
  prev: ProjectsViewsState,
  id: string,
): ProjectsViewsState => {
  const customViews = prev.customViews.filter((view) => view.id !== id);
  const tabOrder = prev.tabOrder.filter((tabId) => tabId !== id);
  return { customViews, tabOrder };
};

export const copyProjectsCustomView = (
  prev: ProjectsViewsState,
  source: ProjectsCustomView,
): ProjectsViewsState => {
  const copy: ProjectsCustomView = {
    ...source,
    id: `pv_${randomId()}`,
    name: `${source.name} (copy)`,
    order: prev.customViews.length,
  };
  return {
    customViews: [...prev.customViews, copy],
    tabOrder: [...prev.tabOrder, copy.id],
  };
};

export const moveProjectsTab = (
  prev: ProjectsViewsState,
  tabId: string,
  direction: 'left' | 'right',
): ProjectsViewsState => {
  const current = [...prev.tabOrder];
  const index = current.indexOf(tabId);
  if (index === -1) return prev;
  const nextIndex = direction === 'left' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= current.length) return prev;
  const [item] = current.splice(index, 1);
  current.splice(nextIndex, 0, item);
  return { ...prev, tabOrder: current };
};

/** Фильтр проектов для пользовательского вида (undefined projectIds = все проекты). */
export function filterProjectsForCustomView<T extends { id: string }>(
  projects: T[],
  activeCustomView: ProjectsCustomView | null,
): T[] {
  if (!activeCustomView) return projects;
  const ids = activeCustomView.projectIds;
  if (ids === undefined) return projects;
  const set = new Set(ids);
  return projects.filter((p) => set.has(p.id));
}

/** Добавить проект в изолированный вид (виды без явного projectIds не трогаем). */
export function appendProjectToCustomView(viewId: string, projectId: string): void {
  const state = loadProjectsViewsState();
  let changed = false;
  const customViews = state.customViews.map((v) => {
    if (v.id !== viewId) return v;
    if (v.projectIds === undefined) return v;
    if (v.projectIds.includes(projectId)) return v;
    changed = true;
    return { ...v, projectIds: [...v.projectIds, projectId] };
  });
  if (changed) saveProjectsViewsState({ ...state, customViews });
}
