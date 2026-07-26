import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Плоский рынок продаж (TR/DE/RU/UK) для вкладки «Рынки и цены» — быстрый
 * одноцветный прайс по типу номера, независимый от подробной ежедневной таблицы
 * HotelDailyMarketRate (см. решение пользователя в plan mode: не объединять). */
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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
