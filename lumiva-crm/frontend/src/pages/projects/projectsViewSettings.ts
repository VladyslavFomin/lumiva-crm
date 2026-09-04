export type ProjectsViewType = 'table' | 'kanban' | 'calendar';

export type ProjectsRowDensity = 'compact' | 'comfortable' | 'spacious';

export type ProjectsViewSettings = {
  kanbanCardFields?: Array<
    'owner' | 'amount' | 'progress' | 'created' | 'priority' | 'tags' | 'deadline'
  >;
  calendarImportantOnly?: boolean;
  density?: ProjectsRowDensity;
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
  return { density: 'comfortable' };
};

const SETTINGS_KEY = 'projects_table_view_settings_v1';

type StoredSettings = Record<string, ProjectsViewSettings>;

const loadAll = (): StoredSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const saveAll = (value: StoredSettings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
};

/** Косметические настройки отображения (поля карточки канбана, фильтр календаря) —
 * per-браузер, привязаны к конкретной таблице + типу вида. Не путать с данными проекта. */
export function loadTableViewSettings(
  tableId: string,
  type: ProjectsViewType,
): ProjectsViewSettings {
  const all = loadAll();
  return {
    ...defaultProjectsViewSettings(type),
    ...(all[`${tableId}:${type}`] || {}),
  };
}

export function saveTableViewSettings(
  tableId: string,
  type: ProjectsViewType,
  settings: ProjectsViewSettings,
): void {
  const all = loadAll();
  all[`${tableId}:${type}`] = settings;
  saveAll(all);
}
