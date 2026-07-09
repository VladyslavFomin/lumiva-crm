// src/rbac/rbac.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffRolePermission } from './staff-role-permission.entity';
import { StaffUserPermission } from './staff-user-permission.entity';
import type {
  PermissionKey,
  RoleMatrix,
  UserPermissionMatrix,
} from './permission.types';
import type { StaffRole } from '../staff/staff-user.entity';

/**
 * Дефолтная матрица прав — применяется для тенантов,
 * у которых ещё нет настроенных прав в базе данных.
 */
const DEFAULT_ROLE_PERMISSIONS: Record<StaffRole, PermissionKey[]> = {
  owner: [
    'leads', 'projects', 'staff', 'finance', 'analytics',
    'settings', 'chat', 'contacts', 'companies',
    'tools_automation', 'custom_objects', 'email', 'marketing', 'products',
  ],
  manager: [
    'leads', 'projects', 'analytics', 'chat', 'marketing',
    'contacts', 'companies', 'email', 'products',
  ],
  viewer: [
    'leads', 'projects', 'analytics', 'chat', 'contacts', 'companies',
  ],
  finance: [
    'leads', 'projects', 'finance', 'analytics', 'chat', 'contacts', 'companies', 'products',
  ],
  sales: [
    'leads', 'projects', 'analytics', 'marketing', 'chat',
    'contacts', 'companies', 'email', 'products',
  ],
  developer: [
    'projects', 'analytics', 'chat', 'settings',
    'tools_automation', 'custom_objects',
  ],
  support: [
    'leads', 'projects', 'analytics', 'chat', 'contacts', 'companies', 'email',
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
