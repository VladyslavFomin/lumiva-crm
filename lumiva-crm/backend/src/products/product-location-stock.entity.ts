import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Источник истины по остатку товара/варианта НА КОНКРЕТНОЙ локации. `Product.quantity`/
 * `ProductVariant.quantity` остаются денормализованной суммой по всем локациям — так старый
 * код (списки, экспорт, публичный API), который читает эти колонки, продолжает работать без
 * изменений (см. lumiva_products_module_roadmap.md §12.2).
 */
// Уникальность (tenantId, productId, variantId, locationId) обеспечена двумя частичными
// уникальными индексами в миграции (variantId IS NULL / IS NOT NULL — NULL не сравнивается
// как равный самому себе в обычном unique-индексе Postgres).
@Entity('product_location_stock')
@Index(['tenantId', 'productId', 'variantId', 'locationId'])
@Index(['tenantId', 'locationId'])
export class ProductLocationStock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'uuid', nullable: true })
  variantId: string | null;

  @Column({ type: 'uuid' })
  locationId: string;

  @Column({ type: 'integer', default: 0 })
  quantity: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
