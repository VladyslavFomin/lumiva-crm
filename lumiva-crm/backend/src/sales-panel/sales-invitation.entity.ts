import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SalesInvitationLanguage = 'en' | 'ru' | 'tr';
export type SalesInvitationStatus = 'sent' | 'failed' | 'replied';
export type SalesReplyMatchedBy = 'header' | 'subject-token' | 'manual';

@Entity('sales_invitations')
export class SalesInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  prospectId: string | null;

  @Column({ length: 8 })
  language: SalesInvitationLanguage;

  @Column({ type: 'text' })
  subject: string;

  @Column({ type: 'text' })
  bodyHtml: string;

  @Column({ length: 255 })
  toEmail: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments: Array<{ filename: string }> | null;

  @Column({ type: 'uuid', nullable: true })
  sentByAdminId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sentByAdminEmail: string | null;

  @Column({ length: 64, unique: true })
  trackingToken: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  outboundMessageId: string | null;

  @Column({ length: 24, default: 'sent' })
  status: SalesInvitationStatus;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'text', nullable: true })
  failedReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  repliedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  replySnippet: string | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  replyMatchedBy: SalesReplyMatchedBy | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
