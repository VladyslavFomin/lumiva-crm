import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';

/** Тенантский справочник меток проектов — источник вариантов для мультиселекта в
 * карточке проекта. Значение — просто текст на самом проекте (Project.tags), поэтому
 * переименование/удаление метки здесь НЕ каскадируется на уже проставленные метки
 * существующих проектов (в отличие от статусов, метки не валидируются как enum). */
@Entity('project_tag_definitions')
@Index(['tenantId', 'value'], { unique: true })
export class ProjectTagDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 64 })
  value: string;

  @Column({ type: 'varchar', length: 16, default: '#777777' })
  color: string;

  @Column({ type: 'integer', default: 0 })
  order: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
