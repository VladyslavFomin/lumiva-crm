// src/users/user.entity.ts
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

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ------------ MULTI-TENANT ------------
  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.users, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // ------------ ОСНОВНЫЕ ПОЛЯ ------------
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'boolean', default: false })
  emailVerificationRequired: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  emailVerificationCodeHash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerificationExpiresAt: Date | null;

  // ------------ РОЛЬ + СТАТУС ------------
  @Column({ type: 'varchar', length: 32, default: 'user' })
  role: string; // owner / manager / viewer / ...

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: string; // active / disabled

  // ------------ АКТИВНОСТЬ ------------
  @Column({ type: 'timestamptz', nullable: true })
  lastActiveAt: Date | null;

  // ------------ AUDIT ------------
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}