// src/helpdesk/helpdesk-ticket.entity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type HelpdeskTicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type HelpdeskTicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type HelpdeskChannel = 'portal' | 'email' | 'telegram' | 'whatsapp' | 'sms' | 'internal';

@Entity('helpdesk_tickets')
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'contactId'])
export class HelpdeskTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid', nullable: true })
  contactId: string | null;

  /** Set when this ticket was raised internally by a staff member (any department) rather than
   * by an external client — e.g. via the "Создать заявку" button in the notifications panel.
   * Mutually exclusive with contactId in practice (an internal request has no client).
   *
   * requesterUserId is the reliable identity (always available from the JWT) — used to notify
   * the requester when support replies. requesterStaffId is best-effort (not every User has a
   * StaffUser row); requesterName/requesterDepartment are snapshots captured at creation time
   * (same convention as HelpdeskTicketMessage.authorName) so display never needs a live join. */
  @Column({ type: 'uuid', nullable: true })
  requesterUserId: string | null;

  @Column({ type: 'uuid', nullable: true })
  requesterStaffId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  requesterName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  requesterDepartment: string | null;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'varchar', length: 16, default: 'open' })
  status: HelpdeskTicketStatus;

  @Column({ type: 'varchar', length: 16, default: 'medium' })
  priority: HelpdeskTicketPriority;

  /** Which channel this ticket's conversation lives on. Staff replies dispatch through this
   * channel's real send API (Email/Telegram/WhatsApp/SMS) instead of only the in-app portal. */
  @Column({ type: 'varchar', length: 16, default: 'portal' })
  channel: HelpdeskChannel;

  @Column({ type: 'varchar', length: 64, nullable: true })
  category: string | null;

  /** Optional link to a CRM record — 'lead' | 'company' | 'project'. Same convention as EsignDocument. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  entityType: string | null;

  @Column({ type: 'uuid', nullable: true })
  entityId: string | null;

  @Column({ type: 'uuid', nullable: true })
  assignedUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
