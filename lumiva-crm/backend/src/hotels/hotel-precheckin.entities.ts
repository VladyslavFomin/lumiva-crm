import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** new — ссылка создана; sent — отправлена гостю; opened — гость открыл; completed — гость заполнил */
export type HotelPrecheckinStatus = 'new' | 'sent' | 'opened' | 'completed';

/** Онлайн-регистрация брони: ссылка гостю и что он заполнил (паспорта пишутся прямо в состав брони) */
@Entity('hotel_precheckins')
@Index(['tenantId', 'hotelId'])
export class HotelPrecheckin {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'uuid' }) reservationId: string;
  @Column({ type: 'varchar', length: 48 }) token: string;
  @Column({ type: 'varchar', length: 12, default: 'new' }) status: HotelPrecheckinStatus;
  @Column({ type: 'timestamptz', nullable: true }) sentAt: Date | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) sentTo: string | null;
  @Column({ type: 'timestamptz', nullable: true }) openedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) completedAt: Date | null;
  @Column({ type: 'varchar', length: 5, nullable: true }) language: string | null;
  /** время прибытия ЧЧ:ММ и рейс */
  @Column({ type: 'varchar', length: 5, nullable: true }) eta: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) flight: string | null;
  @Column({ type: 'boolean', default: false }) needTransfer: boolean;
  @Column({ type: 'text', nullable: true }) requests: string | null;
  @Column({ type: 'text', array: true, default: '{}' }) preferences: string[];
  /** согласие на обработку персональных данных (KVKK / GDPR) */
  @Column({ type: 'boolean', default: false }) consent: boolean;
  /** распознаваний паспорта по ссылке — с лимитом (это платный вызов ИИ отеля) */
  @Column({ type: 'integer', default: 0 }) scanCount: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

export type HotelUpsellKind = 'upgrade' | 'early_checkin' | 'late_checkout' | 'extra';
export type HotelUpsellStatus = 'requested' | 'approved' | 'declined';

/** Заявка гостя на допродажу: апгрейд, ранний заезд, поздний выезд, услуга — отель подтверждает или отклоняет */
@Entity('hotel_upsell_requests')
@Index(['tenantId', 'hotelId', 'status'])
export class HotelUpsellRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'uuid' }) reservationId: string;
  @Column({ type: 'varchar', length: 16 }) kind: HotelUpsellKind;
  @Column({ type: 'uuid', nullable: true }) extraServiceId: string | null;
  @Column({ type: 'uuid', nullable: true }) roomTypeId: string | null;
  /** что просили — снимок названия на момент заявки */
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 1 }) quantity: string;
  /** сумма, которую увидел гость (апгрейд — доплата к проживанию) */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) amount: string;
  @Column({ type: 'varchar', length: 12, default: 'requested' }) status: HotelUpsellStatus;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @Column({ type: 'uuid', nullable: true }) decidedBy: string | null;
  @Column({ type: 'timestamptz', nullable: true }) decidedAt: Date | null;
  @Column({ type: 'uuid', nullable: true }) folioLineId: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
