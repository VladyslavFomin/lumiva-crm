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

@Entity('custom_object_records')
@Index(['tenantId', 'objectId', 'createdAt'])
@Index(['tenantId', 'objectId', 'externalId'])
export class CustomObjectRecord {
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

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalId: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  values: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, any> | null;

  /** Кто создал строку — используется ролью own_rows_only (нет FK: сотрудник может быть удалён). */
  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}


