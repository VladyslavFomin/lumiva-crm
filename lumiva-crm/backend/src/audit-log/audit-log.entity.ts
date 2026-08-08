// src/audit-log/audit-log.entity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type AuditLogAction = 'create' | 'update' | 'delete';

export type AuditLogEntityType =
  | 'lead'
  | 'contact'
  | 'company'
  | 'sale'
  | 'project'
  | 'reservation'
  | 'hotel_reservation'
  | 'product';

export interface AuditLogChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

/**
 * Единый журнал изменений по всем сущностям CRM — общая замена/надстройка над
 * разрозненными per-entity логами (LeadActivity, ProjectActivity, ReservationActivity,
 * ProductChangeLog), которые продолжают жить как есть для своих собственных "история по записи"
 * вкладок. Этот журнал существует отдельно для глобальной ленты активности across модулей.
 */
@Entity('audit_logs')
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'entityType', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 32 })
  entityType: AuditLogEntityType;

  @Column({ type: 'uuid' })
  entityId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  entityLabel: string | null;

  @Column({ type: 'varchar', length: 16 })
  action: AuditLogAction;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'jsonb', nullable: true })
  changes: AuditLogChange[] | null;

  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  actorName: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
