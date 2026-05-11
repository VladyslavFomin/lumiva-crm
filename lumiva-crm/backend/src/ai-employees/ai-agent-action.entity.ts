import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { AiAgentActionStatus } from './ai-employee-role-catalog';

@Entity('ai_agent_actions')
@Index(['tenantId', 'status', 'createdAt'])
@Index(['tenantId', 'agentId', 'createdAt'])
export class AiAgentAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId: string;

  @Column({ name: 'action_type', type: 'varchar', length: 80 })
  actionType: string;

  @Column({ name: 'target_type', type: 'varchar', length: 80, nullable: true })
  targetType: string | null;

  @Column({ name: 'target_id', type: 'varchar', length: 160, nullable: true })
  targetId: string | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: AiAgentActionStatus;

  @Column({ name: 'requires_approval', type: 'boolean', default: true })
  requiresApproval: boolean;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'executed_at', type: 'timestamptz', nullable: true })
  executedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
