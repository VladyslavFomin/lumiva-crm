import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { AiAgentReportStatus } from './ai-employee-role-catalog';

@Entity('ai_agent_reports')
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'agentId', 'createdAt'])
export class AiAgentReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId: string;

  @Column({ name: 'report_type', type: 'varchar', length: 80, default: 'daily' })
  reportType: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'content_md', type: 'text' })
  contentMd: string;

  @Column({ name: 'content_json', type: 'jsonb', nullable: true })
  contentJson: Record<string, unknown> | null;

  @Column({ name: 'period_start', type: 'timestamptz', nullable: true })
  periodStart: Date | null;

  @Column({ name: 'period_end', type: 'timestamptz', nullable: true })
  periodEnd: Date | null;

  @Column({ name: 'sent_to', type: 'jsonb', nullable: true })
  sentTo: string[] | null;

  @Column({ type: 'varchar', length: 32, default: 'generated' })
  status: AiAgentReportStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
