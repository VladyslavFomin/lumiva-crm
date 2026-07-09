import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface ProductAttributeValue {
  id: string;
  value: string;
  label: string;
  colorHex?: string;
}

/**
 * Tenant-wide reusable attribute (Цвет, Размер…) used to build product variants.
 * Defined once, reused across many products — see lumiva_products_module_roadmap.md §4.
 */
@Entity('product_attributes')
@Index(['tenantId', 'slug'], { unique: true })
export class ProductAttribute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 140 })
  slug: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  values: ProductAttributeValue[];

  @Column({ type: 'integer', default: 0 })
  order: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
