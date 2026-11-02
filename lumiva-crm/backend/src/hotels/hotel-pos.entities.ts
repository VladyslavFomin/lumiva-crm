import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const HOTEL_POS_KINDS = ['restaurant', 'bar', 'spa', 'minibar', 'shop', 'other'] as const;
export type HotelPosKind = (typeof HOTEL_POS_KINDS)[number];

/** Точка продаж отеля: ресторан, бар, SPA, мини-бар, магазин */
@Entity('hotel_pos_outlets')
@Index(['tenantId', 'hotelId'])
export class HotelPosOutlet {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'varchar', length: 12, default: 'restaurant' }) kind: HotelPosKind;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'integer', default: 0 }) sortOrder: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

export interface HotelPosLine {
  extraServiceId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  /** входит во «всё включено» гостя — к оплате 0, цена — для учёта стоимости */
  included: boolean;
}

/** Чек точки продаж: на номер заселённого гостя (строки фолио) или оплата на месте; сторно снимает начисления */
@Entity('hotel_pos_checks')
@Index(['tenantId', 'hotelId', 'businessDate'])
export class HotelPosCheck {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'uuid' }) outletId: string;
  /** сквозной номер чека в точке */
  @Column({ type: 'integer' }) number: number;
  @Column({ type: 'date' }) businessDate: string;
  @Column({ type: 'uuid', nullable: true }) reservationId: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) roomLabel: string | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) guestName: string | null;
  /** оплата на месте: cash / card / other; на номер — null */
  @Column({ type: 'varchar', length: 16, nullable: true }) paymentMethod: string | null;
  /** смена, в кассу которой пришли деньги за оплату на месте; null — на номер или смена не была открыта */
  @Column({ type: 'uuid', nullable: true }) shiftId: string | null;
  /** смена, из кассы которой вернули деньги при сторно оплаченного на месте чека */
  @Column({ type: 'uuid', nullable: true }) voidShiftId: string | null;
  @Column({ type: 'jsonb', default: [] }) lines: HotelPosLine[];
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) total: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) includedValue: string;
  @Column({ type: 'uuid', array: true, default: '{}' }) folioLineIds: string[];
  @Column({ type: 'varchar', length: 8, default: 'posted' }) status: 'posted' | 'voided';
  @Column({ type: 'text', nullable: true }) note: string | null;
  @Column({ type: 'text', nullable: true }) voidReason: string | null;
  @Column({ type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ type: 'uuid', nullable: true }) voidedBy: string | null;
  @Column({ type: 'timestamptz', nullable: true }) voidedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
