import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('product_categories')
@Index(['tenantId', 'slug'], { unique: true })
@Index(['tenantId', 'isActive'])
@Index(['tenantId', 'parentId'])
export class ProductCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 180 })
  slug: string;

  /** Родительская категория — для дерева (напр. «Одежда» → «Мужская»). null = корневая. */
  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  /** Цветовая метка категории в UI (hex), напр. '#3b6cb6'. */
  @Column({ type: 'varchar', length: 20, default: '#222222' })
  color: string;

  @Column({ type: 'integer', default: 0 })
  order: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
