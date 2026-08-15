import { Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Entity } from 'typeorm';
import type { SalesInvitationLanguage } from './sales-invitation.entity';

/** Admin-editable per-language email template — seeded lazily from the code defaults
 * in sales-email-templates.ts the first time a language is read, then DB is authoritative. */
@Entity('sales_email_templates')
export class SalesEmailTemplate {
  @PrimaryColumn({ length: 8 })
  language: SalesInvitationLanguage;

  @Column({ type: 'text' })
  subject: string;

  @Column({ type: 'text' })
  bodyHtml: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
