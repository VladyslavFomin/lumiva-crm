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

@Entity('custom_object_import_sessions')
@Index(['tenantId', 'objectId', 'status'])
export class CustomObjectImportSession {
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
  originalFileName: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  columns: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  rows: Array<Record<string, any>>;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  sample: Array<Record<string, any>>;

  @Column({ type: 'integer', default: 0 })
  totalRows: number;

  @Column({ type: 'jsonb', nullable: true })
  suggestedMapping: Record<string, string | null> | null;

  @Column({ type: 'varchar', length: 30, default: 'preview' })
  status: 'preview' | 'applied' | 'failed';

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

