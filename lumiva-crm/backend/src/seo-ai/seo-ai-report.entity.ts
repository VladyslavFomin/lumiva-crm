import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type SeoAiReportStatus = 'running' | 'done' | 'failed';

/** Один прогон ассистента: собранные факты (facts) + разбор и рекомендации ИИ (report). */
@Entity('seo_ai_reports')
@Index(['tenantId', 'siteHost', 'createdAt'])
export class SeoAiReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'text' })
  siteUrl: string;

  @Column({ type: 'varchar', length: 255 })
  siteHost: string;

  /** manual | schedule */
  @Column({ type: 'varchar', length: 16, default: 'manual' })
  trigger: string;

  @Column({ type: 'varchar', length: 16, default: 'running' })
  status: SeoAiReportStatus;

  /** Текущий шаг сбора — для прогресса в интерфейсе. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  stage: string | null;

  @Column({ type: 'int', nullable: true })
  score: number | null;

  @Column({ type: 'jsonb', nullable: true })
  facts: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  report: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  emailedTo: string[];

  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
