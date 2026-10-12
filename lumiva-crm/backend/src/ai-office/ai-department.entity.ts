import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { OfficeLevel, OfficePermCategory } from './ai-office-catalog';

/** ИИ-отдел: комната в ИИ-офисе со своей целью, промтом, правами, коннекторами и бюджетом. */
@Entity('ai_departments')
@Index('IDX_ai_departments_tenant', ['tenantId', 'sort'])
export class AiDepartment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 16 })
  color: string;

  @Column({ name: 'slot_x', type: 'int', default: 0 })
  slotX: number;

  @Column({ name: 'slot_y', type: 'int', default: 0 })
  slotY: number;

  @Column({ name: 'template_key', type: 'varchar', length: 40, nullable: true })
  templateKey: string | null;

  @Column({ type: 'text', default: '' })
  mission: string;

  @Column({ name: 'system_prompt', type: 'text', default: '' })
  systemPrompt: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  rules: string[];

  @Column({ type: 'jsonb', default: () => "'{}'" })
  permissions: Record<OfficePermCategory, OfficeLevel>;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  connectors: string[];

  /** { mode: 'platform' } | { mode: 'byok', connectionId } */
  @Column({ type: 'jsonb', default: () => `'{"mode":"platform"}'` })
  engine: { mode: 'platform' | 'byok'; connectionId?: string | null };

  @Column({ name: 'monthly_budget_cents', type: 'int', default: 15000 })
  monthlyBudgetCents: number;

  @Column({ name: 'parallel_limit', type: 'int', default: 3 })
  parallelLimit: number;

  @Column({ name: 'work_hours', type: 'varchar', length: 16, default: '24/7' })
  workHours: string;

  @Column({ type: 'varchar', length: 64, default: 'UTC' })
  timezone: string;

  /** Язык работы отдела (ru/en/tr): задачи, итоги, журнал, письма агентов. */
  @Column({ type: 'varchar', length: 2, nullable: true })
  language: string | null;

  /** active | paused */
  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: string;

  /** manual | budget | daily_budget | plan | null */
  @Column({ name: 'paused_reason', type: 'varchar', length: 24, nullable: true })
  pausedReason: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  kpis: string[];

  @Column({ name: 'proactive_every_hours', type: 'int', default: 6 })
  proactiveEveryHours: number;

  @Column({ name: 'last_planned_at', type: 'timestamptz', nullable: true })
  lastPlannedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  sort: number;

  /** Готовые сценарии шаблона уже установлены (повторно не ставим, даже если их удалили). */
  /** защита клиентов: дневной лимит отправок отдела, частота на клиента (часы), стоп-лист адресов/доменов */
  @Column({ type: 'jsonb', default: () => `'{"dailySends":50,"minHoursPerClient":48,"stopList":[]}'` })
  safety: { dailySends: number; minHoursPerClient: number; stopList: string[]; allowAdChanges?: boolean; autoPurchaseOrders?: boolean; autoKbReplies?: boolean; autoBookingMessages?: boolean; autoPosting?: boolean };

  /** встроенные программы (дожим, реанимация) — null = по умолчанию для шаблона отдела */
  @Column({ type: 'jsonb', nullable: true })
  programs: Record<string, any> | null;

  /** куратор отдела — ИИ-сотрудник (ai_agents без department_id), решает по действиям агентов вместо владельца */
  @Column({ name: 'curator_agent_id', type: 'uuid', nullable: true })
  curatorAgentId: string | null;

  @Column({ name: 'playbooks_installed', type: 'boolean', default: false })
  playbooksInstalled: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
