import { IsEmail, IsIn, IsOptional, IsUUID } from 'class-validator';
import type { WorkspaceAreaRole } from '../workspace-area-role';

const ROLES: WorkspaceAreaRole[] = ['owner', 'editor', 'reader', 'own_rows_only'];

export class CreateWorkspaceAreaMemberDto {
  /** Существующий сотрудник тенанта — если передан, приглашение по e-mail не требуется. */
  @IsOptional()
  @IsUUID()
  staffUserId?: string;

  /** Если сотрудника с таким e-mail ещё нет в тенанте — уходит приглашение. */
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsIn(ROLES)
  role: WorkspaceAreaRole;
}
