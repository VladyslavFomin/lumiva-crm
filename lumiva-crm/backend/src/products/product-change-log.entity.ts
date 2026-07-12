import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Журнал изменений значимых полей товара (цена, себестоимость, статус, артикул и т.п.) —
 * отдельно от ProductStockMovement, который отвечает только за остаток.
 */
@Entity('product_change_logs')
@Index(['tenantId', 'productId', 'createdAt'])
export class ProductChangeLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'varchar', length: 60 })
  field: string;

  @Column({ type: 'text', nullable: true })
  oldValue: string | null;

  @Column({ type: 'text', nullable: true })
  newValue: string | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
