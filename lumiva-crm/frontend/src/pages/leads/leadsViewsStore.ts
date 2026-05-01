export type LeadsViewType = 'table' | 'kanban' | 'calendar';

export type LeadsViewSettings = {
  groupByStatus?: boolean;
  groupMode?: 'status' | 'company' | 'channel' | 'none' | 'custom';
  showArchived?: boolean;
};

export type LeadsCustomView = {
  id: string;
  name: string;
  type: LeadsViewType;
  settings?: LeadsViewSettings;
};

const STORAGE_KEY = 'leads_custom_views_v1';

const defaultSettingsByType = (type: LeadsViewType): LeadsViewSettings => {
  if (type === 'table') return { groupByStatus: true, groupMode: 'status', showArchived: false };
  if (type === 'kanban') return { showArchived: false };
  return {};
};

export const loadLeadsCustomViews = (): LeadsCustomView[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        (item.type === 'table' || item.type === 'kanban' || item.type === 'calendar'),
    ) as LeadsCustomView[];
  } catch {
    return [];
  }
};

export const saveLeadsCustomViews = (views: LeadsCustomView[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch {
    // ignore
  }
};

export const createLeadsCustomView = (
  current: LeadsCustomView[],
  type: LeadsViewType,
  name: string,
): LeadsCustomView[] => {
  const next: LeadsCustomView = {
    id: `view_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    name: name.trim(),
    settings: defaultSettingsByType(type),
  };
  const result = [...current, next];
  saveLeadsCustomViews(result);
  return result;
};

export const updateLeadsCustomView = (
  current: LeadsCustomView[],
  viewId: string,
  patch: Partial<LeadsCustomView>,
): LeadsCustomView[] => {
  const result = current.map((item) => (item.id === viewId ? { ...item, ...patch } : item));
  saveLeadsCustomViews(result);
  return result;
};

export const deleteLeadsCustomView = (current: LeadsCustomView[], viewId: string): LeadsCustomView[] => {
  const result = current.filter((item) => item.id !== viewId);
  saveLeadsCustomViews(result);
  return result;
};
