// backend/src/marketing/marketing-segment.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('marketing_segments')
export class MarketingSegment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // статусы лидов: new / in_progress / waiting / won / lost...
  @Column({ type: 'text', array: true, nullable: true })
  leadStatuses: string[] | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  source: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  country: string | null;

  // менеджер = Lead.assignedTo
  @Column({ type: 'varchar', length: 255, nullable: true })
  manager: string | null;

  // фильтр по дате создания лида (YYYY-MM-DD)
  @Column({ type: 'date', nullable: true })
  createdFrom: string | null;

  @Column({ type: 'date', nullable: true })
  createdTo: string | null;

  /**
   * Кампании из marketing_traffic (Google / Meta после синка).
   * Сегмент = лиды, у которых utm_* совпадают с выбранными строками (см. runSegment).
   */
  @Column({ type: 'jsonb', nullable: true })
  trafficPresets:
    | Array<{
        dataSource: string;
        source: string | null;
        medium: string | null;
        campaign: string | null;
      }>
    | null;

  // служебные поля
  @Column({ type: 'int', default: 0 })
  lastMatchedCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastRunAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}