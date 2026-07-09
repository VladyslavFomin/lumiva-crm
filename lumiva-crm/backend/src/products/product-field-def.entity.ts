import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ProductFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'url'
  | 'media'
  | 'gallery';

export type ProductFieldWidth = '25' | '50' | '75' | '100';

@Entity('product_field_defs')
@Index(['tenantId', 'key'], { unique: true })
@Index(['tenantId', 'order'])
export class ProductFieldDef {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 120 })
  key: string;

  @Column({ type: 'varchar', length: 200 })
  label: string;

  @Column({ type: 'varchar', length: 40 })
  type: ProductFieldType;

  @Column({ type: 'boolean', default: false })
  required: boolean;

  @Column({ type: 'jsonb', nullable: true })
  options: Array<{ value: string; label: string }> | null;

  /** Per-type настройки: min/max/step, placeholder, accept, maxCount и т.п. */
  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 3, default: '100' })
  width: ProductFieldWidth;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'integer', default: 0 })
  order: number;

  @Column({ type: 'boolean', default: true })
  showInList: boolean;

  @Column({ type: 'boolean', default: false })
  showInQuickEdit: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
