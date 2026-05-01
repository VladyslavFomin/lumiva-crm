import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';

@Entity('workspace_areas')
@Index(['tenantId', 'slug'], { unique: true })
export class WorkspaceArea {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 180 })
  slug: string;

  /** Ключ иконки сайдбара (совместимо с NavIconKey на фронте) */
  @Column({ type: 'varchar', length: 48, default: 'folder' })
  iconKey: string;

  @Column({ type: 'varchar', length: 32, default: '#3b82f6' })
  iconColor: string;

  @Column({ type: 'text', nullable: true })
  coverImageUrl: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** integrationBindings, menuExtras, notes — произвольный JSON */
  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, any> | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
