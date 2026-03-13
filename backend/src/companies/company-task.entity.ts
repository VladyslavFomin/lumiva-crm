// src/companies/company-task.entity.ts
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
import { Company } from './company.entity';

export type CompanyTaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';

@Entity('company_tasks')
@Index(['tenantId', 'companyId'])
@Index(['tenantId', 'status'])
export class CompanyTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==== MULTI-TENANT ====
  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // ==== СВЯЗЬ С КОМПАНИЕЙ ====
  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => Company, (company) => company.tasks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  // ==== ОСНОВНЫЕ ДАННЫЕ ====
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 32, default: 'todo' })
  status: CompanyTaskStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  priority: string | null; // low, medium, high, urgent

  // ==== СРОКИ ====
  @Column({ type: 'timestamptz', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  // ==== ОТВЕТСТВЕННЫЙ ====
  @Column({ type: 'uuid', nullable: true })
  assignedUserId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  assignedTo: string | null;

  // ==== ТЕГИ ====
  @Column({ type: 'text', array: true, default: [] })
  tags: string[];

  // ==== META ====
  @Column({ type: 'jsonb', nullable: true })
  meta: any | null;

  // ==== ПОРЯДОК (для сортировки в канбане) ====
  @Column({ type: 'integer', default: 0 })
  order: number;

  // ==== AUDIT ====
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}











