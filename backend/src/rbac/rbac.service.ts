// src/rbac/rbac.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffRolePermission } from './staff-role-permission.entity';
import type { PermissionKey, RoleMatrix } from './permission.types';
import type { StaffRole } from '../staff/staff-user.entity';

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(StaffRolePermission)
    private readonly repo: Repository<StaffRolePermission>,
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
    const row = await this.repo.findOne({
      where: { tenantId, role, permission },
    });
    return !!row?.allowed;
  }
}