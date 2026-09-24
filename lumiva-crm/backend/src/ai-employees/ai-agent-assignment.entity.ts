import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * ИИ-сотрудник как ответственный за запись (лид / проект / задача компании).
 * Отдельная таблица, а не id в assignedUserIds: у поля ответственных тысячи мест чтения,
 * которые ждут id сотрудника (staff_users) — ИИ-агент там ломал бы фильтры «мои лиды»,
 * уведомления и подписи.
 */
@Entity('ai_agent_assignments')
@Index('UQ_ai_assign_agent_entity', ['agentId', 'entityType', 'entityId'], { unique: true })
@Index('IDX_ai_assign_entity', ['tenantId', 'entityType', 'entityId'])
export class AiAgentAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 32 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ name: 'assigned_by', type: 'uuid', nullable: true })
  assignedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
