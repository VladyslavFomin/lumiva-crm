import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('ai_agent_logs')
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'agentId', 'createdAt'])
export class AiAgentLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'agent_id', type: 'uuid', nullable: true })
  agentId: string | null;

  @Column({ name: 'action_id', type: 'uuid', nullable: true })
  actionId: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 80 })
  eventType: string;

  @Column({ name: 'target_type', type: 'varchar', length: 80, nullable: true })
  targetType: string | null;

  @Column({ name: 'target_id', type: 'varchar', length: 160, nullable: true })
  targetId: string | null;

  @Column({ name: 'input_summary', type: 'text', nullable: true })
  inputSummary: string | null;

  @Column({ name: 'output_summary', type: 'text', nullable: true })
  outputSummary: string | null;

  @Column({ type: 'varchar', length: 32, default: 'success' })
  status: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  model: string | null;

  @Column({ name: 'tokens_used', type: 'int', default: 0 })
  tokensUsed: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
