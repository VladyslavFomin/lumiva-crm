import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * early_booking — раннее бронирование (окно дат брони и/или бронь за N+ дней до заезда);
 * last_minute — горящее (бронь не раньше чем за N дней до заезда); spo — спецпредложение на даты проживания;
 * long_stay — длительное проживание (от N ночей: скидка % или «N ночей — M бесплатно»).
 */
export type HotelPromotionType = 'early_booking' | 'last_minute' | 'spo' | 'long_stay';
export const HOTEL_PROMOTION_TYPES: HotelPromotionType[] = ['early_booking', 'last_minute', 'spo', 'long_stay'];
/** nights — скидка только на ночи внутри периода проживания; arrival — заезд в периоде → скидка на всё проживание */
export type HotelPromotionStayRule = 'nights' | 'arrival';

/**
 * Акция отеля для прямых продаж (стойка, форма брони, сайт). Скидка входит в цену ночей брони; у контракта, блока и
 * брони из канала — свои условия, акции к ним не применяются. Предоплата акции (EB: 50 % до даты) — в сроке предоплаты брони.
 */
@Entity('hotel_promotions')
@Index(['tenantId', 'hotelId'])
export class HotelPromotion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'varchar', length: 16 }) type: HotelPromotionType;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;

  /** скидка, % — или бесплатные ночи (одно из двух) */
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 }) discountPct: string;
  /** «minNights ночей — freeNights бесплатно» (за каждые полные minNights ночей в периоде акции) */
  @Column({ type: 'smallint', default: 0 }) freeNights: number;

  /** окно дат бронирования (дата брони по времени отеля); пусто — без ограничения */
  @Column({ type: 'date', nullable: true }) bookFrom: string | null;
  @Column({ type: 'date', nullable: true }) bookTo: string | null;
  /** период проживания; пусто — любые даты */
  @Column({ type: 'date', nullable: true }) stayFrom: string | null;
  @Column({ type: 'date', nullable: true }) stayTo: string | null;
  @Column({ type: 'varchar', length: 8, default: 'nights' }) stayRule: HotelPromotionStayRule;

  @Column({ type: 'smallint', default: 1 }) minNights: number;
  @Column({ type: 'smallint', nullable: true }) maxNights: number | null;
  /** бронь не позже чем за N дней до заезда (раннее) / не раньше чем за N дней (горящее) */
  @Column({ type: 'smallint', nullable: true }) minDaysBefore: number | null;
  @Column({ type: 'smallint', nullable: true }) maxDaysBefore: number | null;

  /** суммируется с другими акциями; из несуммируемых берётся самая выгодная гостю */
  @Column({ type: 'boolean', default: false }) combinable: boolean;

  /** условие акции: предоплата % от суммы до даты (или через N дней после брони); не внесли — скидку можно снять */
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 }) prepaymentPct: string;
  @Column({ type: 'date', nullable: true }) prepaymentDueDate: string | null;
  @Column({ type: 'smallint', nullable: true }) prepaymentDueDays: number | null;

  /** где действует; пусто — везде */
  @Column({ type: 'uuid', array: true, default: '{}' }) marketGroupIds: string[];
  @Column({ type: 'uuid', array: true, default: '{}' }) roomTypeIds: string[];
  @Column({ type: 'uuid', array: true, default: '{}' }) ratePlanIds: string[];
  @Column({ type: 'boolean', default: true }) sellDirect: boolean;
  @Column({ type: 'boolean', default: true }) sellWebsite: boolean;

  @Column({ type: 'boolean', default: true }) active: boolean;
  /** manual — заведена вручную; import — из прайс-листа Excel (повторный импорт обновляет, а не дублирует) */
  @Column({ type: 'varchar', length: 8, default: 'manual' }) origin: 'manual' | 'import';
  @Column({ type: 'integer', default: 0 }) sortOrder: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
