/** Согласовано с фронтом `workspaceTableKind.ts` */
export const WORKSPACE_TABLE_KIND_KEY = 'workspaceTableKind';
export const WORKSPACE_DATA_LINK_META_KEY = 'workspaceDataLink';
export const WORKSPACE_LINKED_DATA_OBJECT_IDS_KEY = 'workspaceLinkedDataObjectIds';

export type WorkspaceTableKind = 'board' | 'data';

export function getWorkspaceTableKind(meta: Record<string, any> | null | undefined): WorkspaceTableKind {
  const k = meta?.[WORKSPACE_TABLE_KIND_KEY];
  if (k === 'board') return 'board';
  return 'data';
}
