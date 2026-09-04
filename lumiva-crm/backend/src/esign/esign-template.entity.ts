// src/esign/esign-template.entity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('esign_templates')
@Index(['tenantId', 'createdAt'])
export class EsignTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 64, default: 'Договор' })
  kind: string;

  /** Unrendered body — contains {KEY} placeholders (see esign-keys.ts), e.g. {NAME}, {AMOUNT}. */
  @Column({ type: 'text' })
  bodyTemplate: string;

  /** File name pattern used when exporting a document issued from this template — {KEY}
   * tokens are substituted the same way as the body. E.g. "{KIND}-{NAME}-{CONTRACT_DATE}". */
  @Column({ type: 'varchar', length: 255, default: '{KIND}-{NAME}-{CONTRACT_DATE}' })
  fileNamePattern: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
