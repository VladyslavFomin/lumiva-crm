import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * «Упущенная работа»: события CRM и передачи задач, которые пришлись на роль, отсутствующую в
 * команде тенанта. Дневной счётчик на роль (без хранения каждой записи): byEvent — разбивка по
 * событиям/передачам, samples — несколько последних примеров для подсказки.
 */
@Entity('ai_missed_work_daily')
@Index(['tenantId', 'roleKey', 'day'], { unique: true })
export class AiMissedWorkDaily {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'role_key', type: 'varchar', length: 80 })
  roleKey: string;

  @Column({ type: 'date' })
  day: string;

  @Column({ type: 'int', default: 0 })
  count: number;

  @Column({ name: 'by_event', type: 'jsonb', default: () => "'{}'" })
  byEvent: Record<string, number>;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  samples: Array<{ event: string; entityType?: string | null; entityId?: string | null; text?: string | null; at: string }>;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
