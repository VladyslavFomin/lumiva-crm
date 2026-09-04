import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomObject } from '../custom-objects/custom-object.entity';
import { WorkspaceAreaMembersService } from './workspace-area-members.service';
import { AREA_ROLE_META_KEY } from './require-area-role.decorator';
import type { WorkspaceAreaRole } from './workspace-area-role';

/**
 * Coarse, per-object gate for CustomObjectsController. Endpoints without a
 * @RequireAreaRole(...) decorator are left unchanged (allowed) — this guard is opt-in
 * per handler, same idiom as the existing RbacGuard/@RequirePermission pair.
 *
 * Split responsibility: this guard only knows the object's workspaceAreaId, not which
 * record is being touched — so for record update/delete, `own_rows_only` is allowed
 * *through* the guard, and CustomObjectsService does the fine-grained
 * "is this actually my row" check using the record's createdByUserId.
 *
 * Orphan tables (workspaceAreaId === null) and requests with no resolvable objectId
 * (e.g. the plain tenant-wide list endpoint) are allowed through unchanged — this guard
 * only tightens access for objects that actually belong to an area.
 */
@Injectable()
export class WorkspaceAreaAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly members: WorkspaceAreaMembersService,
    @InjectRepository(CustomObject)
    private readonly objectRepo: Repository<CustomObject>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowedRoles = this.reflector.getAllAndOverride<WorkspaceAreaRole[] | undefined>(
      AREA_ROLE_META_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!allowedRoles || !allowedRoles.length) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as
      | { tenantId: string; role?: string; userId?: string; id?: string; sub?: string; email?: string }
      | undefined;
    if (!user?.tenantId) return false;

    // Tenant-global owner bypasses area membership entirely (avoids lockout).
    if (user.role === 'owner') return true;

    const objectId = req.params?.objectId as string | undefined;
    let workspaceAreaId: string | null | undefined;
    let objectRoleOverrides: Record<string, string> | undefined;

    if (objectId) {
      const obj = await this.objectRepo.findOne({
        where: { id: objectId, tenantId: user.tenantId },
        select: ['id', 'workspaceAreaId', 'meta'],
      });
      if (!obj) return true; // not found — let the service 404, not this guard
      workspaceAreaId = obj.workspaceAreaId;
      const raw = (obj.meta as Record<string, unknown> | null)?.roleOverrides;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        objectRoleOverrides = raw as Record<string, string>;
      }
    } else {
      // create-table endpoint: area comes from the request body, not a route param.
      workspaceAreaId = req.body?.workspaceAreaId;
    }

    if (!workspaceAreaId) return true; // orphan table / no area targeted — unchanged behavior

    const staffUserId = await this.members.resolveStaffUserId(user.tenantId, {
      loginUserId: user.userId ?? user.id ?? user.sub,
      email: user.email,
    });
    if (!staffUserId) {
      throw new ForbiddenException('Нет доступа к этой рабочей области');
    }

    // Per-table override (CustomObject.meta.roleOverrides) takes precedence over the
    // area-level role. A 'none' override explicitly blocks this table even for someone
    // who is otherwise a member of the area — it never blocks a tenant-global owner,
    // since that bypass already returned above.
    const override = objectRoleOverrides?.[staffUserId];
    let effectiveRole: WorkspaceAreaRole | null;
    if (override === 'none') {
      throw new ForbiddenException('Нет доступа к этой таблице');
    } else if (
      override === 'owner' ||
      override === 'editor' ||
      override === 'reader' ||
      override === 'own_rows_only'
    ) {
      effectiveRole = override;
    } else {
      effectiveRole = await this.members.resolveEffectiveRole(
        user.tenantId,
        workspaceAreaId,
        staffUserId,
        user.role,
      );
    }
    if (!effectiveRole) {
      throw new ForbiddenException('Нет доступа к этой рабочей области');
    }
    if (!allowedRoles.includes(effectiveRole)) {
      throw new ForbiddenException('Недостаточно прав в этой рабочей области');
    }
    return true;
  }
}
