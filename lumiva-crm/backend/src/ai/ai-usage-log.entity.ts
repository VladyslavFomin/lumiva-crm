import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('ai_usage_logs')
@Index(['tenantId', 'createdAt'])
export class AiUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 32 })
  kind: 'chat' | 'image' | 'embedding';

  @Column({ type: 'varchar', length: 128, nullable: true })
  model: string | null;

  @Column({ type: 'int', default: 0 })
  promptTokens: number;

  @Column({ type: 'int', default: 0 })
  completionTokens: number;

  /** Списано с квоты (центы) */
  @Column({ type: 'int', default: 0 })
  costCents: number;

  @Column({ type: 'text', nullable: true })
  sessionId: string | null;

  /** ИИ-офис: расход отдела / задачи (колонки — ai-office-schema.service.ts) */
  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId: string | null;

  @Column({ name: 'office_task_id', type: 'uuid', nullable: true })
  officeTaskId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
