import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('seo_settings')
@Index(['tenantId'], { unique: true })
export class SeoSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'text', nullable: true })
  gscPropertyUrl: string | null;

  @Column({ type: 'text', nullable: true })
  gscRefreshToken: string | null;

  @Column({ type: 'text', nullable: true })
  pageSpeedApiKey: string | null;

  @Column({ type: 'text', nullable: true })
  pageSpeedUrl: string | null;

  @Column({ type: 'varchar', length: 16, default: 'mobile' })
  pageSpeedStrategy: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
