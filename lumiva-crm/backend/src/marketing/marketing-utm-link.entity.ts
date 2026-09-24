import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Созданная ссылка с UTM-метками (хранилище «Ссылки с метками»; шаблоны — отдельная сущность). */
@Entity('marketing_utm_links')
@Index(['tenantId', 'createdAt'])
export class MarketingUtmLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 512 })
  baseUrl: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  channelType: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  utmSource: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  utmMedium: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  utmCampaign: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  utmContent: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  utmTerm: string | null;

  /** Кто создал (пользователь CRM) — для колонки «Создана». */
  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  createdByName: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
