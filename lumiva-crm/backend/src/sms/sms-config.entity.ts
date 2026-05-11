import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SmsProvider = 'twilio' | 'smsc' | 'smsru';

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  fromPhone: string;
}

export interface SmscCredentials {
  login: string;
  password: string;
  sender?: string;
}

export interface SmsruCredentials {
  apiId: string;
  from?: string;
}

@Entity('sms_configs')
@Index(['tenantId'], { unique: true })
export class SmsConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 32, default: 'twilio' })
  provider: SmsProvider;

  @Column({ type: 'jsonb', default: {} })
  credentials: TwilioCredentials | SmscCredentials | SmsruCredentials;

  @Column({ type: 'varchar', length: 64, nullable: true })
  senderName: string | null;

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
