// src/marketing-broadcasts/marketing-broadcast.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type BroadcastChannel = 'email' | 'sms';
export type BroadcastStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'cancelled';

export interface BroadcastStep {
  order: number;
  /** Days after the *previous* step (0 for the first step = send immediately on activation). */
  delayDays: number;
  subject?: string; // email only
  body: string;
}

@Entity('marketing_broadcasts')
@Index(['tenantId', 'status'])
export class MarketingBroadcast {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 16 })
  channel: BroadcastChannel;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: BroadcastStatus;

  /** Reuses the existing marketing_segments audience filter — null means "all leads with contact
   * info for this channel". */
  @Column({ type: 'uuid', nullable: true })
  segmentId: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  steps: BroadcastStep[];

  @Column({ type: 'uuid', nullable: true })
  fromEmailAccountId: string | null;

  @Column({ type: 'boolean', default: false })
  trackOpens: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
