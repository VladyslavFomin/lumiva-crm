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

  /** Unrendered body — may contain {{contact.name}} / {{tenant.name}} / {{date}} placeholders. */
  @Column({ type: 'text' })
  bodyTemplate: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
