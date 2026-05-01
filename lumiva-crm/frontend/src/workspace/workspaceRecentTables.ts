const KEY = 'workspace_recent_tables_v1';

export function touchRecentWorkspaceTable(areaId: string, objectId: string, max = 24) {
  try {
    const raw = localStorage.getItem(KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    const cur = Array.isArray(map[areaId]) ? map[areaId].filter((id) => id !== objectId) : [];
    const next = [objectId, ...cur].slice(0, max);
    map[areaId] = next;
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function readRecentWorkspaceTables(areaId: string): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const map = JSON.parse(raw) as Record<string, string[]>;
    const cur = map[areaId];
    return Array.isArray(cur) ? cur : [];
  } catch {
    return [];
  }
}
