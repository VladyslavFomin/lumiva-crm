/**
 * Роль пользовательской таблицы в рабочей области:
 * - `board` — основная «Таблица» (вокруг неё строится работа; позже — UX уровня Monday).
 * - `data` — «Таблица данных»: импорт Excel, интеграции, сырьевые строки.
 */
export type WorkspaceTableKind = 'board' | 'data';

export const WORKSPACE_TABLE_KIND_KEY = 'workspaceTableKind';

export function getWorkspaceTableKind(meta: Record<string, unknown> | null | undefined): WorkspaceTableKind {
  const k = meta?.[WORKSPACE_TABLE_KIND_KEY];
  if (k === 'board') return 'board';
  return 'data';
}

export function isWorkspaceBoardTable(meta: Record<string, unknown> | null | undefined): boolean {
  return getWorkspaceTableKind(meta) === 'board';
}
