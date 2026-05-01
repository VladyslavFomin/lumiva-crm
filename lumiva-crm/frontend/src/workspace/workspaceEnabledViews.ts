export type ExtraWorkspaceViewKey = 'kanban' | 'calendar' | 'analytics' | 'gantt';

export type EnabledViewsState = {
  table: boolean;
  kanban: boolean;
  calendar: boolean;
  analytics: boolean;
  gantt: boolean;
};

/** Таблица всегда доступна; остальные — только если явно в meta.enabledViews */
export function parseEnabledViews(
  meta: Record<string, any> | null | undefined,
): EnabledViewsState {
  const raw = meta?.enabledViews;
  if (!raw || !Array.isArray(raw)) {
    return { table: true, kanban: false, calendar: false, analytics: false, gantt: false };
  }
  const set = new Set(raw.map((x) => String(x)));
  return {
    table: true,
    kanban: set.has('kanban'),
    calendar: set.has('calendar'),
    analytics: set.has('analytics'),
    gantt: set.has('gantt'),
  };
}

export function addEnabledView(
  meta: Record<string, any> | null | undefined,
  key: ExtraWorkspaceViewKey,
): string[] {
  const cur = parseEnabledViews(meta);
  const next: string[] = ['table'];
  if (cur.kanban || key === 'kanban') next.push('kanban');
  if (cur.calendar || key === 'calendar') next.push('calendar');
  if (cur.analytics || key === 'analytics') next.push('analytics');
  if (cur.gantt || key === 'gantt') next.push('gantt');
  return [...new Set(next)];
}
