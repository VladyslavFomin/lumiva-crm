import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Строка размещения (SGL, 2 AD, 2 AD + 1 CHD, ...) для вкладки «Цены с размещением».
 * Цена по умолчанию считается в сервисе из HotelRoomType.pricingMode/ppNetOffset и
 * периодного referenceNetPP (см. HotelsPricingService), НО реальные прайс-листы отелей почти
 * всегда содержат ручные точечные переопределения отдельных ячеек (период × размещение),
 * не подчиняющиеся чистой формуле коэффициента — periodOverrides хранит именно их
 * ({ [HotelPricingPeriod.id]: "явная цена" }); при наличии значения для периода оно побеждает
 * над вычисленным по формуле. */
@Entity('hotel_room_occupancy_types')
@Index(['tenantId', 'roomTypeId'])
export class HotelRoomOccupancyType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  roomTypeId: string;

  @Column({ type: 'varchar', length: 255 })
  label: string;

  @Column({ type: 'numeric', precision: 8, scale: 2, default: 1 })
  coefficient: string;

  @Column({ type: 'integer', default: 0 })
  paidChildCount: number;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @Column({ type: 'jsonb', default: {} })
  periodOverrides: Record<string, string>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
