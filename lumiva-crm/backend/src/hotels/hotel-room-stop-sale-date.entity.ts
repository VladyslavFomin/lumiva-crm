import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Точечная стоп-продажа: этот тип номера не продаётся на конкретную дату, во всех рыночных
 * группах сразу (для «Цены и рынки» — оптовая сетка). Модель "presence = stopped": наличие
 * строки для (roomTypeId, date) означает, что дата закрыта для продаж; строку просто удаляют,
 * чтобы снова открыть дату. Независима от HotelRoomDateOverride.blocked (розничный календарь —
 * отдельная система цен, решение из plan mode) и от HotelRoomType.stopSale (стоп на весь номер
 * без привязки к датам). */
@Entity('hotel_room_stop_sale_dates')
@Index(['tenantId', 'roomTypeId'])
@Index(['roomTypeId', 'date'], { unique: true })
export class HotelRoomStopSaleDate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  roomTypeId: string;

  @Column({ type: 'date' })
  date: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
