export type ProjectTableRole = 'owner' | 'editor' | 'reader';

export const PROJECT_TABLE_ROLE_RANK: Record<ProjectTableRole, number> = {
  owner: 3,
  editor: 2,
  reader: 1,
};

export interface ProjectTableMember {
  id: string;
  tenantId: string;
  projectTableId: string;
  staffUserId: string;
  role: ProjectTableRole;
  invitedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  staffUser?: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
}
