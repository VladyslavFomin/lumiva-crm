// src/projects/project-status.entity.ts
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

/**
 * Настраиваемые статусы проектов (колонки канбана / бейджи в таблице).
 * 7 базовых статусов (isBuiltIn=true) сидируются миграцией для каждого тенанта —
 * их значение (value) нельзя переименовать/удалить, т.к. на него завязана бизнес-логика
 * (win-rate в BI, автоматизации won/lost, AI-инструменты). Можно менять только цвет и порядок.
 * Новые статусы тенант добавляет свободно — value/цвет/порядок/удаление без ограничений.
 */
@Entity('project_status_definitions')
@Index(['tenantId', 'value'], { unique: true })
export class ProjectStatusDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 64 })
  value: string; // Отображаемое имя == значение, хранимое в projects.status

  @Column({ type: 'varchar', length: 16, default: '#777777' })
  color: string; // hex

  @Column({ type: 'integer', default: 0 })
  order: number;

  @Column({ type: 'boolean', default: false })
  isBuiltIn: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
