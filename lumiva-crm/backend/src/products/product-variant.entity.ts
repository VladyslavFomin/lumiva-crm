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
import { Product, type ProductImage } from './product.entity';

/** { [attributeId]: valueId } — e.g. { "<Цвет.id>": "<Красный.id>", "<Размер.id>": "<M.id>" } */
export type ProductVariantAttributeValues = Record<string, string>;

@Entity('product_variants')
@Index(['tenantId', 'productId'])
@Index(['tenantId', 'sku'], { unique: true, where: '"sku" IS NOT NULL' })
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  attributeValues: ProductVariantAttributeValues;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sku: string | null;

  /** Реальный остаток этого варианта — редактируется только через ProductStockMovement. */
  @Column({ type: 'integer', default: 0 })
  quantity: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  priceOverride: string | null;

  @Column({ type: 'jsonb', nullable: true })
  images: ProductImage[] | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
