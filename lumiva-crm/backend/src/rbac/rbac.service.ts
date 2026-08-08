// src/rbac/rbac.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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

/**
 * Дефолтная матрица прав — применяется для тенантов,
 * у которых ещё нет настроенных прав в базе данных.
 */
// 'sales' (the module/resource) is added to every role below — the Sales controller had zero
// RBAC gating before this pass (any authenticated role, full access), so every role needs the
// base key by default to avoid narrowing access for tenants who never touch Staff Permissions.
const DEFAULT_ROLE_PERMISSIONS: Record<StaffRole, PermissionKey[]> = {
  owner: [
    'leads', 'leads_view_roi', 'projects', 'projects_manage_trash', 'staff', 'finance', 'analytics',
    'settings', 'chat', 'contacts', 'companies', 'sales', 'helpdesk', 'esign',
    'tools_automation', 'custom_objects', 'email', 'marketing', 'products',
    'products_manage_fields', 'products_manage_stock', 'products_publish',
    'bookings', 'bookings_manage_settings',
    'hotels', 'hotels_manage_pricing', 'hotels_manage_reservations',
  ],
  manager: [
    'leads', 'leads_view_roi', 'projects', 'analytics', 'chat', 'marketing',
    'contacts', 'companies', 'sales', 'helpdesk', 'esign', 'email', 'products',
    'products_manage_fields', 'products_manage_stock', 'products_publish',
    'bookings', 'bookings_manage_settings',
    'hotels', 'hotels_manage_pricing', 'hotels_manage_reservations',
  ],
  viewer: [
    'leads', 'projects', 'analytics', 'chat', 'contacts', 'companies', 'sales',
  ],
  finance: [
    'leads', 'leads_view_roi', 'projects', 'finance', 'analytics', 'chat', 'contacts', 'companies', 'sales', 'products',
    'products_manage_stock',
  ],
  sales: [
    'leads', 'projects', 'analytics', 'marketing', 'chat',
    'contacts', 'companies', 'sales', 'email', 'products',
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
  ) {}

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
  ): Promise<RoleMatrix> {
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

    return this.getRoleMatrixForTenant(tenantId);
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
    const rows = await this.userRepo.find({ where: { tenantId, allowed: true } });
    const result: UserPermissionMatrix = {};

    for (const row of rows) {
      if (!result[row.userId]) result[row.userId] = [];
      if (!result[row.userId].includes(row.permission)) {
        result[row.userId].push(row.permission);
      }
    }

    return result;
  }

  async saveUserPermissions(
    tenantId: string,
    matrix: UserPermissionMatrix,
  ): Promise<UserPermissionMatrix> {
    // очистить старые записи по tenant
    await this.userRepo.delete({ tenantId });

    const toSave: StaffUserPermission[] = [];
    Object.entries(matrix).forEach(([userId, perms]) => {
      (perms || []).forEach((perm) => {
        const row = this.userRepo.create({
          tenantId,
          userId,
          permission: perm as PermissionKey,
          allowed: true,
        });
        toSave.push(row);
      });
    });

    if (toSave.length) {
      await this.userRepo.save(toSave);
    }

    return this.getUserMatrixForTenant(tenantId);
  }
}
