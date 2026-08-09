import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Site } from '../sites/site.entity';
import { Tenant } from '../tenants/tenant.entity';
import { EmbedFormKind } from './embed-form-templates';

@Entity('embed_forms')
@Index(['tenantId', 'siteId'])
export class EmbedForm {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'site_id', type: 'uuid' })
  @Index()
  siteId!: string;

  @ManyToOne(() => Site, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'site_id' })
  site!: Site;

  @Column({ type: 'varchar', length: 220 })
  name!: string;

  /** Секрет в URL. Достаточно длины для перебора. */
  @Column({ name: 'public_id', type: 'varchar', length: 40, unique: true })
  @Index()
  publicId!: string;

  @Column({ name: 'template_key', type: 'varchar', length: 64 })
  templateKey!: string;

  /** Куда попадает сабмит — 'lead' (по умолчанию, старое поведение) или один из трёх продуктовых
   * kind. Неизменяем после создания, как и templateKey. */
  @Column({ type: 'varchar', length: 24, default: 'lead' })
  kind!: EmbedFormKind;

  @Column({ name: 'field_config', type: 'jsonb' })
  fieldConfig!: Record<string, unknown>;

  @Column({ name: 'design', type: 'jsonb' })
  design!: Record<string, unknown>;

  @Column({ type: 'boolean', default: false })
  published!: boolean;

  @Column({ name: 'honeypot_field', type: 'varchar', length: 64 })
  honeypotField!: string;

  @Column({ name: 'privacy_policy_url', type: 'text', nullable: true })
  privacyPolicyUrl!: string | null;

  @Column({ name: 'success_message', type: 'text', nullable: true })
  successMessage!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
