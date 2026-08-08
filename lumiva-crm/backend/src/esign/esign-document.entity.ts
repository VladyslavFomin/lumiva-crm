// src/esign/esign-document.entity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type EsignDocumentStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'declined' | 'expired';

@Entity('esign_documents')
@Index(['tenantId', 'createdAt'])
export class EsignDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid', nullable: true })
  contactId: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  /** Free-form document type shown as a badge (Договор/Счёт/NDA/Акт/Доверенность/…). */
  @Column({ type: 'varchar', length: 64, default: 'Договор' })
  kind: string;

  /** Rendered body (placeholders already substituted) — plain text, laid out into the PDF as-is. */
  @Column({ type: 'text' })
  bodyText: string;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: EsignDocumentStatus;

  /** Optional link to a CRM record — 'lead' | 'company' | 'project'. Mirrors Note's entityType/entityId pattern. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  entityType: string | null;

  @Column({ type: 'uuid', nullable: true })
  entityId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  viewedAt: Date | null;

  @Column({ type: 'int', default: 1 })
  pageCount: number;

  @Column({ type: 'varchar', length: 512, nullable: true })
  draftPdfUrl: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  signedPdfUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  signerName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  signerEmail: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  signatureIp: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  signatureUserAgent: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  signedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  declinedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
