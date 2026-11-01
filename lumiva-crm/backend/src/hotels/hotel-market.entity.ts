import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Рынок продаж (TR/DE/RU/UK): страны гостя → группа рынков, по которой считается цена.
 * Плоская цена рынка (HotelRoomMarketPrice) с 2026-10-30 в расчёт не идёт — цена рынка = прайс сезона ± группа. */
@Entity('hotel_markets')
@Index(['tenantId', 'hotelId'])
export class HotelMarket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  hotelId: string;

  @Column({ type: 'varchar', length: 16 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** Страны рынка (ISO alpha-2): бронь сама относится к рынку по стране гостя */
  @Column({ type: 'text', array: true, default: '{}' })
  countryCodes: string[];

  /** Группа рынков с оптовыми дневными ценами (Batı Avrupa, Doğu Avrupa…), по которой считается сезонная цена */
  @Column({ type: 'uuid', nullable: true })
  marketGroupId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
