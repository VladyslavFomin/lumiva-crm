import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Позиция меню. `available=false` — стоп-лист (позиция есть, но временно не подаётся). */
@Entity('booking_menu_items')
@Index(['tenantId', 'projectId'])
@Index(['tenantId', 'categoryId'])
export class BookingMenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  price: string;

  @Column({ type: 'char', length: 3, default: 'RUB' })
  currency: string;

  /** Выход/объём: «250 г», «0.5 л». */
  @Column({ type: 'varchar', length: 60, nullable: true })
  portion: string | null;

  /** Метки: vegan, spicy, new, hit, gluten_free… */
  @Column({ type: 'text', array: true, default: [] })
  tags: string[];

  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  /** Время приготовления, мин — для подсказки официанту. */
  @Column({ type: 'integer', nullable: true })
  prepMinutes: number | null;

  @Column({ type: 'boolean', default: true })
  available: boolean;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
