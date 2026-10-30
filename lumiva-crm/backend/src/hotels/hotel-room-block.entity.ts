import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type HotelRoomBlockStatus = 'tentative' | 'definite' | 'released' | 'cancelled';

/** Блок номеров под группу/событие: N номеров типа на период до даты отсечки (cutoff).
 * Пока блок «definite» и отсечка не прошла, невыкупленные номера блока не продаются другим.
 * Выкуп (pickup) — брони с blockId этого блока. */
@Entity('hotel_room_blocks')
@Index(['tenantId', 'hotelId'])
export class HotelRoomBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  hotelId: string;

  @Column({ type: 'uuid' })
  roomTypeId: string;

  @Column({ type: 'uuid', nullable: true })
  agencyId: string | null;

  @Column({ type: 'uuid', nullable: true })
  contractId: string | null;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 12, default: 'tentative' })
  status: HotelRoomBlockStatus;

  @Column({ type: 'date' })
  dateFrom: string;

  /** Дата выезда (последняя ночь — накануне) */
  @Column({ type: 'date' })
  dateTo: string;

  @Column({ type: 'integer' })
  rooms: number;

  /** После этой даты невыкупленные номера возвращаются в продажу */
  @Column({ type: 'date' })
  cutoffDate: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  ratePerNight: string | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  boardType: string | null;

  /** ISO alpha-2 — страна группы для аналитики */
  @Column({ type: 'varchar', length: 2, nullable: true })
  countryCode: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  contactName: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
