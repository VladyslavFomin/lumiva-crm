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

/** Тенантский список валют, доступных при создании/редактировании проекта — источник
 * вариантов для выпадающего списка вместо свободного ввода. Project.currency остаётся
 * обычным текстовым полем (не FK), так что удаление валюты из справочника не трогает
 * уже сохранённые проекты. */
@Entity('project_currency_definitions')
@Index(['tenantId', 'code'], { unique: true })
export class ProjectCurrencyDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 8 })
  code: string; // EUR / USD / TRY ...

  @Column({ type: 'varchar', length: 64, nullable: true })
  label: string | null;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'integer', default: 0 })
  order: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
