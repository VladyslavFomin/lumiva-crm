import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('tenant_storage_files')
@Index(['tenantId', 'createdAt'])
export class TenantStorageFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'uploaded_by_user_id', type: 'uuid' })
  uploadedByUserId!: string;

  /** Относительно каталога uploads/ (например tenant-files/{tenantId}/uuid.ext) */
  @Column({ name: 'relative_path', type: 'varchar', length: 512 })
  relativePath!: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'size_bytes', type: 'bigint', default: '0' })
  sizeBytes!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
