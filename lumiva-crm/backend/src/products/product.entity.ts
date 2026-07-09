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
import { ProductCategory } from './product-category.entity';

export type ProductStatus = 'active' | 'draft' | 'archived' | 'out_of_stock';

export interface ProductImage {
  url: string;
  isCover?: boolean;
}

@Entity('products')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'categoryId'])
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'sku'], { unique: true, where: '"sku" IS NOT NULL' })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sku: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => ProductCategory, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category: ProductCategory | null;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: ProductStatus;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  price: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  costPrice: string | null;

  @Column({ type: 'char', length: 3, default: 'EUR' })
  currency: string;

  /** "Вариативный товар" — если true, реальные остатки/цены живут на ProductVariant. */
  @Column({ type: 'boolean', default: false })
  isVariable: boolean;

  /** ProductAttribute.id[] участвующие в вариациях этого товара (только если isVariable). */
  @Column({ type: 'jsonb', nullable: true })
  variantAttributeIds: string[] | null;

  /**
   * Остаток. Для невариативного товара — реальный редактируемый остаток (меняется только
   * через ProductStockMovement). Для вариативного — денормализованная сумма остатков всех
   * активных вариантов, пересчитывается сервисом, не редактируется напрямую.
   */
  @Column({ type: 'integer', default: 0 })
  quantity: number;

  @Column({ type: 'integer', nullable: true })
  lowStockThreshold: number | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  unit: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  images: ProductImage[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalId: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  customFields: Record<string, unknown>;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
