import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ProductStockMovementType =
  | 'in'
  | 'out'
  | 'adjustment'
  | 'sale'
  | 'return'
  | 'transfer_out'
  | 'transfer_in';
export type ProductStockMovementSource = 'manual' | 'import' | 'public_api' | 'sale';

/**
 * Журнал движения остатков — любое изменение Product.quantity/ProductVariant.quantity идёт
 * через сервис, который пишет сюда строку. Это то, что отличает «Склад» от простого
 * редактируемого числа (см. lumiva_products_module_roadmap.md §4).
 */
@Entity('product_stock_movements')
@Index(['tenantId', 'productId', 'createdAt'])
@Index(['tenantId', 'variantId', 'createdAt'])
export class ProductStockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'uuid', nullable: true })
  variantId: string | null;

  /** Локация (склад/точка), к которой относится движение — см. ProductLocation. */
  @Column({ type: 'uuid', nullable: true })
  locationId: string | null;

  /**
   * Для перемещений между складами — id парного движения (out↔in одного transferStock()),
   * чтобы можно было показать «откуда → куда» одной строкой в истории.
   */
  @Column({ type: 'uuid', nullable: true })
  relatedMovementId: string | null;

  @Column({ type: 'varchar', length: 20 })
  type: ProductStockMovementType;

  @Column({ type: 'integer' })
  quantityDelta: number;

  @Column({ type: 'integer' })
  resultingQuantity: number;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  source: ProductStockMovementSource | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
