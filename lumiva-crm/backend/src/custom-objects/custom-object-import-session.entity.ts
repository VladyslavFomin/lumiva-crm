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

  /**
   * Nullable so a session can exist before a target table is chosen — the AI chat previews
   * an attached spreadsheet first, then "adopts" the session into a table once one exists
   * (either picked or just created via crm_workspace_create_table).
   */
  @Column({ type: 'uuid', nullable: true })
  objectId: string | null;

  @ManyToOne(() => CustomObject, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'objectId' })
  object: CustomObject | null;

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

