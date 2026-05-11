import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  AiAgentAutonomyMode,
  AiAgentStatus,
  AiEmployeeRoleKey,
} from './ai-employee-role-catalog';

@Entity('ai_agents')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'role'])
export class AiAgent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 80 })
  role: AiEmployeeRoleKey;

  @Column({ type: 'varchar', length: 190 })
  name: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 512, nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  department: string | null;

  @Column({ name: 'job_title', type: 'varchar', length: 160, nullable: true })
  jobTitle: string | null;

  @Column({ type: 'varchar', length: 64, default: 'English' })
  language: string;

  @Column({ type: 'varchar', length: 255, default: 'Professional, warm, concise' })
  tone: string;

  @Column({ type: 'varchar', length: 32, default: 'setup_required' })
  status: AiAgentStatus;

  @Column({ name: 'autonomy_mode', type: 'varchar', length: 32, default: 'suggest' })
  autonomyMode: AiAgentAutonomyMode;

  @Column({ type: 'varchar', length: 80, default: 'openai_compatible' })
  provider: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  model: string | null;

  @Column({ name: 'daily_report_time', type: 'varchar', length: 8, default: '18:00' })
  dailyReportTime: string;

  @Column({ name: 'schedule_mode', type: 'varchar', length: 40, default: 'manual' })
  scheduleMode: 'always' | 'business_hours' | 'custom' | 'manual';

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
