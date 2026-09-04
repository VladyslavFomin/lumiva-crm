// src/marketing-broadcasts/marketing-broadcast-recipient.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { MarketingBroadcast } from './marketing-broadcast.entity';

export type BroadcastRecipientStatus = 'pending' | 'active' | 'completed' | 'failed' | 'unsubscribed';

@Entity('marketing_broadcast_recipients')
@Index(['tenantId', 'broadcastId', 'status'])
export class MarketingBroadcastRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  broadcastId: string;

  @ManyToOne(() => MarketingBroadcast, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'broadcastId' })
  broadcast: MarketingBroadcast;

  @Column({ type: 'uuid', nullable: true })
  leadId: string | null;

  // Snapshot at materialization time — a lead's email/phone changing mid-broadcast shouldn't
  // silently redirect an in-flight send.
  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phone: string | null;

  @Column({ type: 'int', default: -1 })
  lastStepSent: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastSentAt: Date | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: BroadcastRecipientStatus;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  // Раньше любая временная ошибка отправки (сбой у почтового/SMS-провайдера) сразу и навсегда
  // переводила получателя в 'failed' — без единой повторной попытки, и без ручного способа
  // повторить. Теперь ограниченное число повторов с бэкоффом (см. processStepsForBroadcast).
  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
