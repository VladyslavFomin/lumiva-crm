import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/project.entity';
import { ProjectTable } from './project-table.entity';
import { ProjectTableMembersService } from './project-table-members.service';
import { TABLE_ROLE_META_KEY } from './require-table-role.decorator';
import type { ProjectTableRole } from './project-table-role';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Coarse, per-table gate for ProjectsController. Endpoints without a @RequireTableRole(...)
 * decorator are left unchanged (allowed) — opt-in per handler, same idiom as
 * RbacGuard/@RequirePermission and WorkspaceAreaAccessGuard/@RequireAreaRole.
 *
 * The DEFAULT table ("Таблица", slug 'main') keeps today's access behavior entirely —
 * tenant owner sees all, manager/sales see only their own via ownerUserIds, enforced in
 * ProjectsController.isProjectMine — this guard passes it straight through. It only gates
 * NON-default, user-created tables, which are private unless the caller has an explicit
 * ProjectTableMember row. Unlike WorkspaceAreaAccessGuard, tenant-global 'owner' does NOT
 * bypass this check: private tables must be explicitly shared.
 */
@Injectable()
export class ProjectTableAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly members: ProjectTableMembersService,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectTable)
    private readonly tableRepo: Repository<ProjectTable>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowedRoles = this.reflector.getAllAndOverride<ProjectTableRole[] | undefined>(
      TABLE_ROLE_META_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!allowedRoles || !allowedRoles.length) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as
      | { tenantId: string; role?: string; userId?: string; id?: string; sub?: string; email?: string }
      | undefined;
    if (!user?.tenantId) return false;

    let tableId: string | undefined =
      (req.query?.tableId as string | undefined) || (req.body?.tableId as string | undefined);

    if (!tableId && req.params?.id) {
      // Project-id routes (:id, :id/status, :id/archive, ...) — resolve the table via the project.
      // req.params.id is an unvalidated route param (guards run before pipes in Nest) — a
      // malformed value like the frontend's "new" placeholder must not reach a uuid column query.
      if (!UUID_RE.test(req.params.id)) return true; // not a real id — let the service 404/400
      const project = await this.projectRepo.findOne({
        where: { id: req.params.id, tenantId: user.tenantId },
        select: ['id', 'tableId'],
      });
      if (!project) return true; // not found — let the service 404, not this guard
      tableId = project.tableId ?? undefined;
    }

    if (!tableId || !UUID_RE.test(tableId)) return true; // no table targeted — unchanged (legacy/default) behavior

    const table = await this.tableRepo.findOne({ where: { id: tableId, tenantId: user.tenantId } });
    if (!table) return true; // not found — let the service 404

    if (table.slug === 'main') return true; // default table: existing ownership logic applies

    const staffUserId = await this.members.resolveStaffUserId(user.tenantId, {
      loginUserId: user.userId ?? user.id ?? user.sub,
      email: user.email,
    });
    if (!staffUserId) {
      throw new ForbiddenException('Нет доступа к этой таблице');
    }

    const effectiveRole = await this.members.resolveEffectiveRole(user.tenantId, tableId, staffUserId);
    if (!effectiveRole) {
      throw new ForbiddenException('Нет доступа к этой таблице');
    }
    if (!allowedRoles.includes(effectiveRole)) {
      throw new ForbiddenException('Недостаточно прав в этой таблице');
    }
    return true;
  }
}
