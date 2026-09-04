export type WorkspaceAreaRole = 'owner' | 'editor' | 'reader' | 'own_rows_only';

export const WORKSPACE_AREA_ROLE_RANK: Record<WorkspaceAreaRole, number> = {
  owner: 3,
  editor: 2,
  reader: 1,
  own_rows_only: 1,
};

export interface WorkspaceAreaMember {
  id: string;
  tenantId: string;
  workspaceAreaId: string;
  staffUserId: string;
  role: WorkspaceAreaRole;
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
