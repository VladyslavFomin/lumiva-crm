import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('hotel_photos')
@Index(['tenantId', 'hotelId'])
@Index(['categoryId'])
@Index(['roomTypeId'])
export class HotelPhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  hotelId: string;

  /** null — фото вне категории. При удалении категории фото не удаляются, а становятся
   * некатегоризированными (ON DELETE SET NULL на уровне БД). */
  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  /** null — фото в общей галерее отеля. Заполнено — фото принадлежит галерее конкретного типа
   * номера (отдельная от общей, без категорий). */
  @Column({ type: 'uuid', nullable: true })
  roomTypeId: string | null;

  @Column({ type: 'varchar', length: 512 })
  url: string;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
