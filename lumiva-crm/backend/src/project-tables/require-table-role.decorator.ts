import { SetMetadata } from '@nestjs/common';
import type { ProjectTableRole } from './project-table-role';

export const TABLE_ROLE_META_KEY = 'project_table_role';

/** Any of the given roles satisfies the check. Handlers without this decorator are left
 * unguarded by ProjectTableAccessGuard (opt-in per handler, same idiom as
 * @RequireAreaRole/WorkspaceAreaAccessGuard). */
export const RequireTableRole = (...roles: ProjectTableRole[]) =>
  SetMetadata(TABLE_ROLE_META_KEY, roles);
