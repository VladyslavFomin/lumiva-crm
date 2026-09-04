import { IsIn } from 'class-validator';
import type { WorkspaceAreaRole } from '../workspace-area-role';

const ROLES: WorkspaceAreaRole[] = ['owner', 'editor', 'reader', 'own_rows_only'];

export class UpdateWorkspaceAreaMemberDto {
  @IsIn(ROLES)
  role: WorkspaceAreaRole;
}
