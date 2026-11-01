import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { HotelBoardType, HotelCancellationRule } from './hotel-contract.entity';

export type HotelRatePlanAdjust = 'percent' | 'amount';
/** none — без предоплаты; percent — % от суммы; nights — N первых ночей; full — вся сумма */
export type HotelPrepaymentType = 'none' | 'percent' | 'nights' | 'full';

/**
 * Тариф отеля поверх прайса сезона: питание с доплатой, корректировка цены номера (невозвратный −10 % и т. п.),
 * условия отмены и предоплаты. Бронь хранит тариф; расчёт цены, отмена, предоплата и каналы берут условия отсюда.
 */
@Entity('hotel_rate_plans')
@Index(['tenantId', 'hotelId'])
export class HotelRatePlan {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  /** короткий код (BAR, NRF, BB…) — уникален в отеле */
  @Column({ type: 'varchar', length: 16 }) code: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;

  @Column({ type: 'varchar', length: 4 }) boardType: HotelBoardType;
  /** доплата за питание за ночь (может быть отрицательной, если прайс уже с лучшим питанием) */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) boardSupplementAdult: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) boardSupplementChild: string;

  /** корректировка цены номера за ночь: percent (−10 = −10 %) или amount (сумма за ночь) */
  @Column({ type: 'varchar', length: 8, default: 'percent' }) adjustType: HotelRatePlanAdjust;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) adjustValue: string;

  /** невозвратный: при отмене удерживается вся сумма, правила отмены не нужны */
  @Column({ type: 'boolean', default: true }) refundable: boolean;
  /** правила отмены (как у контракта): «меньше чем за N дней — штраф % или ночи» */
  @Column({ type: 'jsonb', default: [] }) cancellationPolicy: HotelCancellationRule[];

  @Column({ type: 'varchar', length: 8, default: 'none' }) prepaymentType: HotelPrepaymentType;
  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0 }) prepaymentValue: string;
  /** срок предоплаты: 0 — сразу при бронировании, N — за N дней до заезда */
  @Column({ type: 'smallint', default: 0 }) prepaymentDueDays: number;

  @Column({ type: 'smallint', default: 1 }) minNights: number;
  /** типы номеров, где действует; пусто — все */
  @Column({ type: 'uuid', array: true, default: '{}' }) roomTypeIds: string[];
  /** где продаётся напрямую: у стойки / в форме брони и на сайте (каналы — через сопоставление) */
  @Column({ type: 'boolean', default: true }) sellDirect: boolean;
  @Column({ type: 'boolean', default: true }) sellWebsite: boolean;
  /** тариф по умолчанию для новой брони — ровно один на отель */
  @Column({ type: 'boolean', default: false }) isDefault: boolean;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'integer', default: 0 }) sortOrder: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
