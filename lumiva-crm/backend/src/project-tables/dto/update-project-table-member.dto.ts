import { IsIn } from 'class-validator';
import type { ProjectTableRole } from '../project-table-role';

const ROLES: ProjectTableRole[] = ['owner', 'editor', 'reader'];

export class UpdateProjectTableMemberDto {
  @IsIn(ROLES)
  role: ProjectTableRole;
}
