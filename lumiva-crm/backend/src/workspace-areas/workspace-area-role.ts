export type WorkspaceAreaRole = 'owner' | 'editor' | 'reader' | 'own_rows_only';

/** Для проверок «роль не ниже X» — own_rows_only ранжируется как reader
 * (может читать всё, но писать только свои строки — уточняется на уровне сервиса). */
export const WORKSPACE_AREA_ROLE_RANK: Record<WorkspaceAreaRole, number> = {
  owner: 3,
  editor: 2,
  reader: 1,
  own_rows_only: 1,
};

export function workspaceAreaRoleAtLeast(
  role: WorkspaceAreaRole,
  required: WorkspaceAreaRole,
): boolean {
  return WORKSPACE_AREA_ROLE_RANK[role] >= WORKSPACE_AREA_ROLE_RANK[required];
}
