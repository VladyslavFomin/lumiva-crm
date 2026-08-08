// src/helpdesk/helpdesk-ticket-message.entity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type HelpdeskMessageDirection = 'incoming' | 'outgoing';

/** 'incoming' = from the customer (portal); 'outgoing' = from staff. */
@Entity('helpdesk_ticket_messages')
@Index(['tenantId', 'ticketId', 'createdAt'])
export class HelpdeskTicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  ticketId: string;

  @Column({ type: 'varchar', length: 16 })
  direction: HelpdeskMessageDirection;

  @Column({ type: 'varchar', length: 255, nullable: true })
  authorName: string | null;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
