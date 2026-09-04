export type WorkspaceAreaActivityKind =
  | 'sync'
  | 'import'
  | 'push'
  | 'mapping_change'
  | 'table_created'
  | 'error';

export interface WorkspaceAreaActivityLogEntry {
  id: string;
  tenantId: string;
  workspaceAreaId: string;
  kind: WorkspaceAreaActivityKind;
  title: string;
  detail: string | null;
  relatedObjectId: string | null;
  actorUserId: string | null;
  createdAt: string;
}
