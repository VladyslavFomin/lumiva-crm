// src/rbac/staff-role-permission.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { StaffRole } from '../staff/staff-user.entity';
import type { PermissionKey } from './permission.types';

@Entity('staff_role_permissions')
export class StaffRolePermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  // НЕ enum, а обычная строка — чтобы не упираться в миграции
  @Column({ type: 'varchar', length: 32, name: 'role' })
  role!: StaffRole;

  @Column({ type: 'varchar', length: 32, name: 'permission' })
  permission!: PermissionKey;

  @Column({ type: 'boolean', name: 'allowed', default: true })
  allowed!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}