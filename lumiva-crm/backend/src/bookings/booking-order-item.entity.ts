import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BookingOrderItemStatus = 'new' | 'cooking' | 'served' | 'void';
export type BookingOrderItemKind = 'menu' | 'service' | 'pass' | 'rental' | 'deposit' | 'fee' | 'custom';

/** Строка счёта. Название и цена — снимок на момент добавления (меню может поменяться). */
@Entity('booking_order_items')
@Index(['tenantId', 'orderId'])
export class BookingOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'varchar', length: 16, default: 'custom' })
  kind: BookingOrderItemKind;

  /** Ссылка на источник строки: позиция меню / услуга / план абонемента / ресурс. */
  @Column({ type: 'uuid', nullable: true })
  refId: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  unitPrice: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 1 })
  qty: string;

  @Column({ type: 'varchar', length: 16, default: 'new' })
  status: BookingOrderItemStatus;

  /** Курс подачи (1 — закуски, 2 — горячее…), для ресторана. */
  @Column({ type: 'integer', nullable: true })
  course: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
