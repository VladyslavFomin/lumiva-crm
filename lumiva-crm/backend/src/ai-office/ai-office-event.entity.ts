import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Журнал офиса: всё, что отделы делают, в одной ленте — источник для «Журнала действий»,
 * реплик над столами на карте и «прогулок» (передача задачи между агентами).
 */
@Entity('ai_office_events')
@Index('IDX_ai_office_events_tenant_created', ['tenantId', 'createdAt'])
export class AiOfficeEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId: string | null;

  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  taskId: string | null;

  @Column({ name: 'agent_id', type: 'uuid', nullable: true })
  agentId: string | null;

  /** Агент, которому передали работу (для «прогулки» по комнате). */
  @Column({ name: 'to_agent_id', type: 'uuid', nullable: true })
  toAgentId: string | null;

  /** task_created | task_started | step | tool | approval_needed | approved | rejected | done | failed | handoff | issue | issue_resolved | brain_read | brain_write | paused | resumed | planned */
  @Column({ type: 'varchar', length: 32 })
  kind: string;

  /** Имя инструмента/действия (для строки журнала «fn()») */
  @Column({ type: 'varchar', length: 80, nullable: true })
  tool: string | null;

  @Column({ type: 'varchar', length: 500 })
  text: string;

  /** ok | warn | error */
  @Column({ type: 'varchar', length: 8, default: 'ok' })
  level: string;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
