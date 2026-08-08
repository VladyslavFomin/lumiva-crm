// src/telephony/telephony-config.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('telephony_configs')
export class TelephonyConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  tenantId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  accountSid: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  authToken: string | null;

  /** Twilio Voice-capable number the tenant calls from / receives calls on, E.164 */
  @Column({ type: 'varchar', length: 32, nullable: true })
  voiceNumber: string | null;

  /** Staff phone numbers to ring for inbound calls / the "connect leg" of an outbound click-to-call */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  forwardToNumbers: string[];

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
