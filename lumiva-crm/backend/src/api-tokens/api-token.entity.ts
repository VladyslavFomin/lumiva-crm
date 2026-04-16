// src/api-tokens/api-token.entity.ts
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

@Entity('api_tokens')
export class ApiToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Связь с тенантом
   */
  @ManyToOne(() => Tenant, (tenant) => tenant.apiTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  /**
   * Сам токен (секретная строка).
   * Делаем nullable, чтобы не падать на старых строках с NULL.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  token!: string | null;

  /**
   * Человеческое имя токена, например: "Marketing token"
   * Тоже nullable для совместимости со старыми записями.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  name!: string | null;

  /**
   * Описание токена (для интерфейса)
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  /**
   * Активен ли токен
   */
  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  /**
   * Срок действия (если есть)
   */
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}