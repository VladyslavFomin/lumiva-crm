// src/esign/esign-document.entity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { EsignDocumentItem } from './esign-items';

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

  /** Source template this document was issued from — lets "Дублировать" re-run the wizard
   * with fresh {TODAY}/etc. rather than copying static text. Null for legacy documents. */
  @Column({ type: 'uuid', nullable: true })
  templateId: string | null;

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

  /** Contract amount, shown as "Сумма договора" in the documents list. Parsed from the
   * {AMOUNT} manual field at issue time — free text there doesn't always parse, so this
   * stays nullable rather than forcing a number into a template author's field. */
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  amount: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  currency: string | null;

  /** The manually entered {KEY}: value map from the issue wizard's "Данные договора" step
   * (contract number, service, terms, ...) — kept so a document can be duplicated or its
   * numbers audited later without re-deriving them from the rendered text. */
  @Column({ type: 'jsonb', nullable: true })
  extraFields: Record<string, string> | null;

  /** Products/booking-services picked in the issue wizard — snapshotted at issue time (name,
   * price, master) so the document stays accurate even if the catalog changes later. */
  @Column({ type: 'jsonb', nullable: true })
  items: EsignDocumentItem[] | null;

  /** Friendly export file name, interpolated from the template's fileNamePattern — the
   * stored PDF itself lives at draftPdfUrl/signedPdfUrl under an opaque id-based path. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ type: 'int', nullable: true })
  fileSizeBytes: number | null;

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
