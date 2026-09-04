import { IsEmail, IsIn, IsOptional, IsUUID } from 'class-validator';
import type { ProjectTableRole } from '../project-table-role';

const ROLES: ProjectTableRole[] = ['owner', 'editor', 'reader'];

export class CreateProjectTableMemberDto {
  /** Существующий сотрудник тенанта — если передан, поиск по e-mail не требуется. */
  @IsOptional()
  @IsUUID()
  staffUserId?: string;

  /** Если сотрудника с таким e-mail нет в тенанте — запрос будет отклонён. */
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsIn(ROLES)
  role: ProjectTableRole;
}
