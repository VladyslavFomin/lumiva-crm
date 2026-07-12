import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Склад/точка тенанта (см. lumiva_products_module_roadmap.md §12.2). Каждый тенант получает
 * одну дефолтную локацию при миграции — весь текущий остаток приписывается ей, чтобы не
 * сломать существующий учёт.
 */
@Entity('product_locations')
@Index(['tenantId', 'isActive'])
export class ProductLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  code: string | null;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
