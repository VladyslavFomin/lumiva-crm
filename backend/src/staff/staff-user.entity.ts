// src/staff/staff-user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Department } from '../departments/department.entity';

export type StaffRole =
  | 'owner'
  | 'manager'
  | 'viewer'
  | 'finance'
  | 'sales'
  | 'developer'
  | 'support';

@Entity('staff_users')
export class StaffUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Tenant, (t) => t.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 190 })
  email!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 190 })
  fullName!: string;

  // ВАЖНО: Чёткий строковый тип, НЕ Object (для обратной совместимости)
  @Column({ type: 'varchar', length: 120, nullable: true })
  department!: string | null;

  // Связь с отделом через entity
  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  departmentEntity!: Department | null;

  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId!: string | null;

  @Column({ type: 'varchar', length: 32 })
  role!: StaffRole;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phone!: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 255, nullable: true })
  avatarUrl!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'invite_status', type: 'varchar', length: 32, default: 'active' })
  inviteStatus!: string;

  @Column({ name: 'external_id', type: 'varchar', length: 64, nullable: true })
  externalId!: string | null;

  /**
   * Токен для инвайта/сброса пароля владельца / сотрудника
   */
  @Column({
    name: 'password_reset_token',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  passwordResetToken!: string | null;

  /**
   * Срок действия токена
   */
  @Column({
    name: 'password_reset_token_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  passwordResetTokenExpiresAt!: Date | null;


  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}