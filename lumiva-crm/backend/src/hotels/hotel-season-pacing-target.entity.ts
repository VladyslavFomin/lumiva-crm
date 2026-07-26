import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Целевая кривая темпа продаж (pacing) по срокам до заезда — сколько % инвентаря должно быть
 * продано за N дней до заезда. Одна строка на бакет (90/60/30/14/7/0) на отель, с ленивым
 * заполнением значениями по умолчанию при первом обращении (как HotelAgency). */
@Entity('hotel_season_pacing_targets')
@Index(['tenantId', 'hotelId'])
@Index(['hotelId', 'daysBeforeArrival'], { unique: true })
export class HotelSeasonPacingTarget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  hotelId: string;

  @Column({ type: 'integer' })
  daysBeforeArrival: number;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  targetPct: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
