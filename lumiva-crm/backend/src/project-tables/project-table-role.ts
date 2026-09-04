export type ProjectTableRole = 'owner' | 'editor' | 'reader';

export const PROJECT_TABLE_ROLE_RANK: Record<ProjectTableRole, number> = {
  owner: 3,
  editor: 2,
  reader: 1,
};

export function projectTableRoleAtLeast(
  role: ProjectTableRole,
  required: ProjectTableRole,
): boolean {
  return PROJECT_TABLE_ROLE_RANK[role] >= PROJECT_TABLE_ROLE_RANK[required];
}
