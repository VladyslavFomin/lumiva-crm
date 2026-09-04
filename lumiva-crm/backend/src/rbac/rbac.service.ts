// src/rbac/rbac.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ModuleRef } from '@nestjs/core';
import { Repository } from 'typeorm';
import { StaffRolePermission } from './staff-role-permission.entity';
import { StaffUserPermission } from './staff-user-permission.entity';
import {
  GRANULAR_FALLBACK_TO_BASE,
  type PermissionKey,
  type RoleMatrix,
  type UserPermissionMatrix,
} from './permission.types';
import type { StaffRole } from '../staff/staff-user.entity';

type AuditLogService = import('../audit-log/audit-log.service').AuditLogService;

export interface RbacChangeActor {
  actorUserId?: string | null;
  actorName?: string | null;
}

/**
 * Дефолтная матрица прав — применяется для тенантов,
 * у которых ещё нет настроенных прав в базе данных.
 */
// 'sales' (the module/resource) is added to every role below — the Sales controller had zero
// RBAC gating before this pass (any authenticated role, full access), so every role needs the
// base key by default to avoid narrowing access for tenants who never touch Staff Permissions.
// leads_create/leads_manage_import/projects_manage added to owner/manager/sales only (2026-09-01):
// these replace hardcoded `['owner','manager','sales']` role-array checks that used to live
// directly in LeadsController/ProjectsController (create lead, import leads, create/edit/
// change-status/archive a project) — real prior restrictions narrower than the base 'leads'/
// 'projects' key (viewer/finance/developer/support keep base read-ish access but never could
// create/import/edit), so they get explicit entries here rather than a GRANULAR_FALLBACK_TO_BASE
// inheritance, matching the leads_view_roi/projects_manage_trash precedent.
const DEFAULT_ROLE_PERMISSIONS: Record<StaffRole, PermissionKey[]> = {
  owner: [
    'leads', 'leads_view_roi', 'leads_create', 'leads_manage_import',
    'projects', 'projects_manage_trash', 'projects_manage', 'staff', 'finance', 'analytics',
    'settings', 'chat', 'contacts', 'companies', 'sales', 'client_accounts', 'helpdesk', 'esign',
    'tools_automation', 'custom_objects', 'email', 'marketing', 'products',
    'products_manage_fields', 'products_manage_stock', 'products_publish',
    'bookings', 'bookings_manage_settings',
    'hotels', 'hotels_manage_pricing', 'hotels_manage_reservations',
  ],
  manager: [
    'leads', 'leads_view_roi', 'leads_create', 'leads_manage_import',
    'projects', 'projects_manage', 'analytics', 'chat', 'marketing',
    'contacts', 'companies', 'sales', 'client_accounts', 'helpdesk', 'esign', 'email', 'products',
    'products_manage_fields', 'products_manage_stock', 'products_publish',
    'bookings', 'bookings_manage_settings',
    'hotels', 'hotels_manage_pricing', 'hotels_manage_reservations',
  ],
  viewer: [
    'leads', 'projects', 'analytics', 'chat', 'contacts', 'companies', 'sales',
  ],
  finance: [
    'leads', 'leads_view_roi', 'projects', 'finance', 'analytics', 'chat', 'contacts', 'companies', 'sales', 'client_accounts', 'products',
    'products_manage_stock',
  ],
  sales: [
    'leads', 'leads_create', 'leads_manage_import',
    'projects', 'projects_manage', 'analytics', 'marketing', 'chat',
    'contacts', 'companies', 'sales', 'client_accounts', 'email', 'products',
    'products_manage_stock', 'bookings', 'hotels', 'hotels_manage_reservations',
  ],
  developer: [
    'projects', 'analytics', 'chat', 'settings', 'sales',
    'tools_automation', 'custom_objects',
  ],
  support: [
    'leads', 'projects', 'analytics', 'chat', 'contacts', 'companies', 'sales', 'helpdesk', 'email',
    'bookings', 'hotels', 'hotels_manage_reservations',
  ],
};

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(StaffRolePermission)
    private readonly repo: Repository<StaffRolePermission>,

    @InjectRepository(StaffUserPermission)
    private readonly userRepo: Repository<StaffUserPermission>,

    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Lazy global lookup instead of a constructor dependency — AuditLogModule already imports
   * RbacModule (for its own RbacGuard), so a normal RbacModule → AuditLogModule import would be
   * circular. Same `moduleRef.get(..., { strict: false })` pattern as
   * telegram-crm.service.ts's ai()/oai()/polling() helpers. Returns null if audit-log isn't
   * resolvable (e.g. isolated unit tests) — logging is best-effort, never blocks a save.
   */
  private auditLog(): AuditLogService | null {
    try {
      return this.moduleRef.get(
        require('../audit-log/audit-log.service').AuditLogService,
        { strict: false },
      );
    } catch {
      return null;
    }
  }

  private async logRoleChanges(
    tenantId: string,
    before: RoleMatrix,
    after: RoleMatrix,
    actor?: RbacChangeActor,
  ): Promise<void> {
    const auditLog = this.auditLog();
    if (!auditLog) return;

    const roles = new Set<StaffRole>([
      ...(Object.keys(before) as StaffRole[]),
      ...(Object.keys(after) as StaffRole[]),
    ]);

    for (const role of roles) {
      const beforeSet = new Set(before[role] ?? []);
      const afterSet = new Set(after[role] ?? []);
      const added = [...afterSet].filter((p) => !beforeSet.has(p));
      const removed = [...beforeSet].filter((p) => !afterSet.has(p));
      if (!added.length && !removed.length) continue;

      await auditLog.log({
        tenantId,
        entityType: 'rbac_role',
        entityId: role,
        entityLabel: role,
        action: 'update',
        summary: `Роль «${role}»: добавлено прав — ${added.length}, убрано — ${removed.length}`,
        changes: [
          ...added.map((p) => ({ field: p, oldValue: null, newValue: 'allowed' })),
          ...removed.map((p) => ({ field: p, oldValue: 'allowed', newValue: null })),
        ],
        actorUserId: actor?.actorUserId ?? null,
        actorName: actor?.actorName ?? null,
      });
    }
  }

  private async logUserChanges(
    tenantId: string,
    before: UserPermissionMatrix,
    after: UserPermissionMatrix,
    actor?: RbacChangeActor,
  ): Promise<void> {
    const auditLog = this.auditLog();
    if (!auditLog) return;

    const userIds = new Set([...Object.keys(before), ...Object.keys(after)]);
    const label = (v: boolean | undefined) => (v === undefined ? 'inherit' : v ? 'allowed' : 'denied');

    for (const userId of userIds) {
      const beforePerms = before[userId] ?? {};
      const afterPerms = after[userId] ?? {};
      const keys = new Set([
        ...(Object.keys(beforePerms) as PermissionKey[]),
        ...(Object.keys(afterPerms) as PermissionKey[]),
      ]);
      const changes: Array<{ field: string; oldValue: string; newValue: string }> = [];
      for (const key of keys) {
        const b = beforePerms[key];
        const a = afterPerms[key];
        if (b === a) continue;
        changes.push({ field: key, oldValue: label(b), newValue: label(a) });
      }
      if (!changes.length) continue;

      await auditLog.log({
        tenantId,
        entityType: 'rbac_user',
        entityId: userId,
        action: 'update',
        summary: `Индивидуальные права сотрудника: изменено — ${changes.length}`,
        changes,
        actorUserId: actor?.actorUserId ?? null,
        actorName: actor?.actorName ?? null,
      });
    }
  }

  /**
   * Матрица прав по всем ролям для конкретного tenant.
   * Если записей нет — возвращает дефолтную матрицу.
   */
  async getRoleMatrixForTenant(tenantId: string): Promise<RoleMatrix> {
    const rows = await this.repo.find({
      where: { tenantId, allowed: true },
    });

    if (rows.length === 0) {
      return { ...DEFAULT_ROLE_PERMISSIONS } as RoleMatrix;
    }

    const result: RoleMatrix = {
      owner: [],
      manager: [],
      viewer: [],
      finance: [],
      sales: [],
      developer: [],
      support: [],
    };

    for (const row of rows) {
      const role = row.role as StaffRole;
      const perm = row.permission as PermissionKey;
      if (!result[role]) result[role] = [];
      if (!result[role].includes(perm)) result[role].push(perm);
    }

    return result;
  }

  /**
   * Сохранение матрицы прав
   */
  async saveRolePermissions(
    tenantId: string,
    matrix: RoleMatrix,
    actor?: RbacChangeActor,
  ): Promise<RoleMatrix> {
    const before = await this.getRoleMatrixForTenant(tenantId);

    // очищаем старые записи
    await this.repo.delete({ tenantId });

    const toSave: StaffRolePermission[] = [];

    (Object.keys(matrix) as StaffRole[]).forEach((role) => {
      const perms = matrix[role] || [];
      for (const perm of perms) {
        const row = this.repo.create({
          tenantId,
          role,
          permission: perm,
          allowed: true,
        });
        toSave.push(row);
      }
    });

    if (toSave.length > 0) {
      await this.repo.save(toSave);
    }

    const after = await this.getRoleMatrixForTenant(tenantId);
    await this.logRoleChanges(tenantId, before, after, actor);
    return after;
  }

  /**
   * Проверка права: используется в RbacGuard.
   * Если для тенанта нет ни одной записи в базе — применяем дефолтную матрицу.
   */
  async can(
    tenantId: string,
    role: StaffRole,
    permission: PermissionKey,
  ): Promise<boolean> {
    if (role === 'owner') return true;

    const row = await this.repo.findOne({
      where: { tenantId, role, permission },
    });

    if (row) return !!row.allowed;

    // No explicit row for this exact key. If it's one of the newly-added granular keys, defer to
    // its base key's own resolution (still respecting that base key's explicit-row/default split)
    // instead of falling straight to "deny" — see GRANULAR_FALLBACK_TO_BASE's doc comment.
    const baseKey = GRANULAR_FALLBACK_TO_BASE[permission];
    if (baseKey) {
      return this.can(tenantId, role, baseKey);
    }

    // Проверяем: есть ли вообще какие-то записи для этого тенанта
    const anyRow = await this.repo.findOne({ where: { tenantId } });
    if (!anyRow) {
      // Тенант ещё не настраивал права — используем дефолтную матрицу
      return (DEFAULT_ROLE_PERMISSIONS[role] ?? []).includes(permission);
    }

    return false;
  }

  /* ========= USER-LEVEL OVERRIDES ========= */

  async getUserMatrixForTenant(
    tenantId: string,
  ): Promise<UserPermissionMatrix> {
    // No `allowed: true` filter — explicit deny rows (allowed: false) are just as real an
    // override as grant rows now, both must round-trip to the UI.
    const rows = await this.userRepo.find({ where: { tenantId } });
    const result: UserPermissionMatrix = {};

    for (const row of rows) {
      if (!result[row.userId]) result[row.userId] = {};
      result[row.userId][row.permission] = row.allowed;
    }

    return result;
  }

  /**
   * Explicit per-user override for one permission, or `null` if the user has no override row
   * for it (i.e. inherits from their role). Used by RbacGuard ahead of the role-level check.
   */
  async getUserOverride(
    tenantId: string,
    userId: string,
    permission: PermissionKey,
  ): Promise<boolean | null> {
    if (!userId) return null;
    const row = await this.userRepo.findOne({ where: { tenantId, userId, permission } });
    return row ? !!row.allowed : null;
  }

  /**
   * Real per-user-aware permission check, used by RbacGuard. An explicit override (grant or
   * deny) always wins over the role's own resolution — that's the whole point of "individual
   * permissions": revoking something the role would otherwise allow, or granting something it
   * wouldn't, for one specific person. Owner bypasses everything, same as `can()`.
   */
  async canForUser(
    tenantId: string,
    userId: string,
    role: StaffRole,
    permission: PermissionKey,
  ): Promise<boolean> {
    if (role === 'owner') return true;

    const override = await this.getUserOverride(tenantId, userId, permission);
    if (override !== null) return override;

    return this.can(tenantId, role, permission);
  }

  async saveUserPermissions(
    tenantId: string,
    matrix: UserPermissionMatrix,
    actor?: RbacChangeActor,
  ): Promise<UserPermissionMatrix> {
    const before = await this.getUserMatrixForTenant(tenantId);

    // очистить старые записи по tenant
    await this.userRepo.delete({ tenantId });

    const toSave: StaffUserPermission[] = [];
    Object.entries(matrix).forEach(([userId, perms]) => {
      Object.entries(perms || {}).forEach(([perm, allowed]) => {
        if (allowed === undefined) return; // inherit — no row
        toSave.push(
          this.userRepo.create({
            tenantId,
            userId,
            permission: perm as PermissionKey,
            allowed,
          }),
        );
      });
    });

    if (toSave.length) {
      await this.userRepo.save(toSave);
    }

    const after = await this.getUserMatrixForTenant(tenantId);
    await this.logUserChanges(tenantId, before, after, actor);
    return after;
  }
}
