import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** «Нужна ваша помощь»: отделу не хватает данных, доступа или упала интеграция. */
@Entity('ai_office_issues')
@Index('IDX_ai_office_issues_open', ['tenantId', 'status'])
export class AiOfficeIssue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'department_id', type: 'uuid' })
  departmentId: string;

  @Column({ name: 'agent_id', type: 'uuid', nullable: true })
  agentId: string | null;

  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  taskId: string | null;

  /** error | data | access */
  @Column({ type: 'varchar', length: 16 })
  kind: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', default: '' })
  detail: string;

  /** upload | access | reconnect */
  @Column({ type: 'varchar', length: 16 })
  fix: string;

  /** папка «Мозга» (department id | 'common') или ключ коннектора */
  @Column({ type: 'varchar', length: 64, nullable: true })
  target: string | null;

  /** open | resolved */
  @Column({ type: 'varchar', length: 16, default: 'open' })
  status: string;

  @Column({ name: 'dedupe_key', type: 'varchar', length: 160, nullable: true })
  dedupeKey: string | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
