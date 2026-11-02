import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type InstagramAttachment = { type: string; url?: string };

/** Сообщение директа (kind=dm) или комментарий под постом (kind=comment). */
@Entity('instagram_messages')
export class InstagramMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  accountId: string;

  @Column({ type: 'uuid' })
  contactId: string;

  /** dm / comment */
  @Column({ type: 'varchar', length: 16, default: 'dm' })
  kind: string;

  /** mid сообщения или id комментария — защита от повторной доставки вебхука */
  @Column({ type: 'varchar', length: 255, nullable: true })
  externalId: string | null;

  /** incoming / outgoing */
  @Column({ type: 'varchar', length: 16 })
  direction: 'incoming' | 'outgoing';

  @Column({ type: 'text', nullable: true })
  text: string | null;

  @Column({ type: 'jsonb', nullable: true })
  attachments: InstagramAttachment[] | null;

  /** Пост, под которым оставлен комментарий */
  @Column({ type: 'varchar', length: 64, nullable: true })
  mediaId: string | null;

  @Column({ type: 'text', nullable: true })
  mediaPermalink: string | null;

  @Column({ type: 'timestamptz' })
  date: Date;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'jsonb', nullable: true })
  rawData: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
