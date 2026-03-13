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

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(StaffRolePermission)
    private readonly repo: Repository<StaffRolePermission>,

    @InjectRepository(StaffUserPermission)
    private readonly userRepo: Repository<StaffUserPermission>,
  ) {}

  /**
   * Матрица прав по всем ролям для конкретного tenant
   */
  async getRoleMatrixForTenant(tenantId: string): Promise<RoleMatrix> {
    const empty: RoleMatrix = {
      owner: [],
      manager: [],
      viewer: [],
      finance: [],
      sales: [],
      developer: [],
      support: [],
    };

    const rows = await this.repo.find({
      where: { tenantId, allowed: true },
    });

    for (const row of rows) {
      const role = row.role as StaffRole;
      const perm = row.permission as PermissionKey;
      if (!empty[role]) {
        empty[role] = [];
      }
      if (!empty[role].includes(perm)) {
        empty[role].push(perm);
      }
    }

    return empty;
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
   * Проверка права: используется в RbacGuard
   */
  async can(
    tenantId: string,
    role: StaffRole,
    permission: PermissionKey,
  ): Promise<boolean> {
    // Owner всегда имеет доступ
    if (role === 'owner') {
      return true;
    }
    
    const row = await this.repo.findOne({
      where: { tenantId, role, permission },
    });
    
    // Если права не найдены в базе, возвращаем false
    // (RbacGuard сам решит, разрешать ли доступ для новых модулей)
    if (!row) {
      return false;
    }
    
    return !!row.allowed;
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
