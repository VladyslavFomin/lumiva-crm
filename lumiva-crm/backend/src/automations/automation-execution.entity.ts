// src/automations/automation-execution.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Automation } from './automation.entity';

/**
 * История выполнения автоматизаций
 */
@Entity('automation_executions')
@Index(['tenantId', 'automationId', 'createdAt'])
@Index(['tenantId', 'status'])
export class AutomationExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==== MULTI-TENANT ====
  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // ==== СВЯЗЬ С АВТОМАТИЗАЦИЕЙ ====
  @Column({ type: 'uuid' })
  automationId: string;

  @ManyToOne(() => Automation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'automationId' })
  automation: Automation;

  // ==== КОНТЕКСТ ВЫПОЛНЕНИЯ ====
  @Column({ type: 'varchar', length: 100 })
  triggerEvent: string; // Событие, которое запустило автоматизацию

  @Column({ type: 'jsonb' })
  triggerData: any; // Данные события (entity, изменения, etc.)

  @Column({ type: 'varchar', length: 50, nullable: true })
  entityType: string | null; // Тип сущности (contact, lead, sale, etc.)

  @Column({ type: 'uuid', nullable: true })
  entityId: string | null; // ID сущности

  // ==== РЕЗУЛЬТАТ ====
  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: string; // 'pending', 'success', 'error', 'skipped'

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'jsonb', nullable: true })
  executionResult: any | null; // Результаты выполнения действий

  @Column({ type: 'integer', default: 0 })
  actionsExecuted: number; // Количество выполненных действий

  // ==== ПАУЗА / ВОЗОБНОВЛЕНИЕ (задержка перед шагом, ожидание подтверждения) ====
  // status также принимает 'paused_delay' | 'paused_approval' | 'rejected' в дополнение к
  // 'pending' | 'success' | 'error' — колонка свободная varchar, доп. значения не ломают старые.

  @Column({ type: 'integer', nullable: true })
  pausedAtStep: number | null; // Индекс действия, на котором остановились

  @Column({ type: 'timestamptz', nullable: true })
  resumeAt: Date | null; // Когда планировщик должен возобновить (для paused_delay)

  @Column({ type: 'jsonb', nullable: true })
  ctxSnapshot: any | null; // Снимок контекста выполнения на момент паузы

  @Column({ type: 'uuid', nullable: true })
  approvalDecidedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvalDecidedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  approvalNote: string | null;

  // ==== AUDIT ====
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}













