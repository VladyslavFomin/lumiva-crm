/** Ссылка на строку в таблице данных (meta записи в board) */
export const WORKSPACE_DATA_LINK_META_KEY = 'workspaceDataLink';

export type WorkspaceDataLinkMeta = {
  sourceObjectId: string;
  sourceRecordId: string;
  pushedAt: string;
};

/** ID таблиц данных, закреплённых за основной таблицей (meta объекта board) */
export const WORKSPACE_LINKED_DATA_OBJECT_IDS_KEY = 'workspaceLinkedDataObjectIds';

export function getWorkspaceDataLink(
  meta: Record<string, unknown> | null | undefined,
): WorkspaceDataLinkMeta | null {
  const raw = meta?.[WORKSPACE_DATA_LINK_META_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const sourceObjectId = typeof o.sourceObjectId === 'string' ? o.sourceObjectId : '';
  const sourceRecordId = typeof o.sourceRecordId === 'string' ? o.sourceRecordId : '';
  const pushedAt = typeof o.pushedAt === 'string' ? o.pushedAt : '';
  if (!sourceObjectId || !sourceRecordId) return null;
  return { sourceObjectId, sourceRecordId, pushedAt };
}
