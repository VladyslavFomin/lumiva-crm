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
import { CustomObject } from './custom-object.entity';

export type CustomObjectViewType = 'table' | 'kanban' | 'calendar';

@Entity('custom_object_views')
@Index(['tenantId', 'objectId', 'type'])
export class CustomObjectView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'uuid' })
  objectId: string;

  @ManyToOne(() => CustomObject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'objectId' })
  object: CustomObject;

  @Column({ type: 'varchar', length: 40 })
  type: CustomObjectViewType;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, any> | null;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'integer', default: 0 })
  order: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}


