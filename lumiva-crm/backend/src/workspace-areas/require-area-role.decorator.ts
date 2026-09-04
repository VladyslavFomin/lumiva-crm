import { SetMetadata } from '@nestjs/common';
import type { WorkspaceAreaRole } from './workspace-area-role';

export const AREA_ROLE_META_KEY = 'workspace_area_role';

/** Any of the given roles satisfies the check (rank isn't used here — reader and
 * own_rows_only both mean "not editor", but only own_rows_only may write its own
 * records, so endpoints list the exact roles allowed rather than a single floor). */
export const RequireAreaRole = (...roles: WorkspaceAreaRole[]) =>
  SetMetadata(AREA_ROLE_META_KEY, roles);
