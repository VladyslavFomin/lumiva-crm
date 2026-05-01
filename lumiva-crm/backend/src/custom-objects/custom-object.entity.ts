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
import { WorkspaceArea } from '../workspace-areas/workspace-area.entity';

@Entity('custom_objects')
@Index(['tenantId', 'slug'], { unique: true })
@Index(['tenantId', 'isActive'])
@Index(['tenantId', 'workspaceAreaId'])
export class CustomObject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'uuid', nullable: true })
  workspaceAreaId: string | null;

  @ManyToOne(() => WorkspaceArea, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'workspaceAreaId' })
  workspaceArea: WorkspaceArea | null;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 180 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}


