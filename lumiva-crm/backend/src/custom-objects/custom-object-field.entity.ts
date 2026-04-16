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

export type CustomObjectFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'status'
  | 'select'
  | 'multiselect'
  | 'file';

@Entity('custom_object_fields')
@Index(['tenantId', 'objectId', 'key'], { unique: true })
@Index(['tenantId', 'objectId', 'order'])
export class CustomObjectField {
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

  @Column({ type: 'varchar', length: 120 })
  key: string;

  @Column({ type: 'varchar', length: 200 })
  label: string;

  @Column({ type: 'varchar', length: 40 })
  type: CustomObjectFieldType;

  @Column({ type: 'boolean', default: false })
  required: boolean;

  @Column({ type: 'jsonb', nullable: true })
  options: Array<{ value: string; label: string }> | null;

  @Column({ type: 'integer', default: 0 })
  order: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}


