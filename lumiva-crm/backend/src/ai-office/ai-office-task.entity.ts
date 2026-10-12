import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type OfficeTaskStatus = 'backlog' | 'progress' | 'waiting' | 'blocked' | 'done' | 'rejected' | 'failed';

/** Задача ИИ-отдела. Источник — человек, автоматизация, событие CRM, цель отдела или другой отдел. */
@Entity('ai_office_tasks')
@Index('IDX_ai_office_tasks_dept_status', ['tenantId', 'departmentId', 'status'])
export class AiOfficeTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'department_id', type: 'uuid' })
  departmentId: string;

  @Column({ name: 'agent_id', type: 'uuid', nullable: true })
  agentId: string | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', default: '' })
  details: string;

  /** manual | automation | event | proactive | handoff */
  @Column({ type: 'varchar', length: 24, default: 'manual' })
  source: string;

  @Column({ name: 'source_ref', type: 'varchar', length: 160, nullable: true })
  sourceRef: string | null;

  @Column({ name: 'entity_type', type: 'varchar', length: 40, nullable: true })
  entityType: string | null;

  @Column({ name: 'entity_id', type: 'varchar', length: 64, nullable: true })
  entityId: string | null;

  @Column({ type: 'varchar', length: 16, default: 'backlog' })
  status: OfficeTaskStatus;

  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ type: 'varchar', length: 24, default: 'queued' })
  step: string;

  /** 1 — срочно … 3 — обычная */
  @Column({ type: 'int', default: 2 })
  priority: number;

  /** ai_agent_actions, ждущие решения человека по этой задаче */
  @Column({ name: 'pending_action_ids', type: 'uuid', array: true, default: () => "'{}'" })
  pendingActionIds: string[];

  @Column({ name: 'result_summary', type: 'text', nullable: true })
  resultSummary: string | null;

  /** сам результат работы (анализ/план/текст), markdown */
  /** когда владельцу ушло письмо «ждут вашего решения» по этой задаче */
  @Column({ name: 'approval_mailed_at', type: 'timestamptz', nullable: true })
  approvalMailedAt: Date | null;

  @Column({ name: 'result_report', type: 'text', nullable: true })
  resultReport: string | null;

  /** какие данные отдел прочитал для задачи: [{ key, label, period }] */
  @Column({ name: 'data_used', type: 'jsonb', default: () => "'[]'" })
  dataUsed: Array<{ key: string; label: string; period?: string }>;

  /** [{ kind, title, actionType, status, entityType, entityId, url }] */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  artifacts: Array<Record<string, unknown>>;

  @Column({ name: 'issue_id', type: 'uuid', nullable: true })
  issueId: string | null;

  @Column({ name: 'parent_task_id', type: 'uuid', nullable: true })
  parentTaskId: string | null;

  @Column({ name: 'from_department_id', type: 'uuid', nullable: true })
  fromDepartmentId: string | null;

  /** Глубина цепочки передач между отделами — защита от зацикливания. */
  @Column({ name: 'handoff_depth', type: 'int', default: 0 })
  handoffDepth: number;

  @Column({ name: 'cost_cents', type: 'int', default: 0 })
  costCents: number;

  @Column({ type: 'int', default: 0 })
  tokens: number;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
