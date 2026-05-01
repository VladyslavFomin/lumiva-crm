import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { EmbedForm } from './embed-form.entity';

/**
 * Промежуточное хранение файла после POST /public/embed/.../attachment
 * и до сабмита формы. Привязка к tenant + form, очистка по TTL опциональна.
 */
@Entity('embed_form_uploads')
@Index(['tenantId', 'formId'])
export class EmbedFormUpload {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ name: 'form_id', type: 'uuid' })
  formId!: string;

  @ManyToOne(() => EmbedForm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'form_id' })
  form!: EmbedForm;

  /** Путь относительно getUploadsRoot (например tenants/.../embed/...) */
  @Column({ name: 'relative_path', type: 'varchar', length: 512 })
  relativePath!: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mimetype!: string | null;

  @Column({ name: 'size_bytes', type: 'bigint', default: '0' })
  sizeBytes!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
