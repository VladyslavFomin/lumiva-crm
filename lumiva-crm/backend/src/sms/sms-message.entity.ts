import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SmsDirection = 'outbound' | 'inbound';
export type SmsStatus = 'pending' | 'sent' | 'delivered' | 'failed';
export type SmsEntityType = 'contact' | 'lead' | 'company';

@Entity('sms_messages')
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'entityType', 'entityId'])
@Index(['provider', 'externalId'])
export class SmsMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 16, default: 'outbound' })
  direction: SmsDirection;

  @Column({ type: 'varchar', length: 64, nullable: true })
  fromPhone: string | null;

  @Column({ type: 'varchar', length: 64 })
  toPhone: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: SmsStatus;

  @Column({ type: 'varchar', length: 32, nullable: true })
  provider: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  entityType: SmsEntityType | null;

  @Column({ type: 'uuid', nullable: true })
  entityId: string | null;

  @Column({ type: 'uuid', nullable: true })
  sentByUserId: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 6, nullable: true })
  cost: number | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  costUnit: string | null;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
