import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** tentative — под опцион (брони «ожидает» до optionUntil); definite — подтверждена; cancelled — отменена целиком */
export type HotelGroupStatus = 'tentative' | 'definite' | 'cancelled';
/** group — проживание оплачивает группа (общие платежи раскладываются по броням); individual — каждый гость сам */
export type HotelGroupBilling = 'group' | 'individual';

/**
 * Групповая бронь: одна заявка на много номеров (туроператор, свадьба, конференция). Номера — обычные брони с groupId:
 * цена, отмена, заселение, фолио работают как у одиночной брони, группа даёт общие действия и rooming list.
 */
@Entity('hotel_groups')
@Index(['tenantId', 'hotelId'])
export class HotelGroup {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  /** GRP-2611-0007 — для писем и счетов */
  @Column({ type: 'varchar', length: 24 }) code: string;
  @Column({ type: 'varchar', length: 160 }) name: string;
  @Column({ type: 'uuid', nullable: true }) agencyId: string | null;
  @Column({ type: 'uuid', nullable: true }) contractId: string | null;
  @Column({ type: 'uuid', nullable: true }) blockId: string | null;
  @Column({ type: 'uuid', nullable: true }) ratePlanId: string | null;
  @Column({ type: 'varchar', length: 160, nullable: true }) contactName: string | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) contactEmail: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) contactPhone: string | null;
  @Column({ type: 'date' }) checkIn: string;
  @Column({ type: 'date' }) checkOut: string;
  @Column({ type: 'varchar', length: 12, default: 'definite' }) status: HotelGroupStatus;
  @Column({ type: 'timestamptz', nullable: true }) optionUntil: Date | null;
  /** срок, до которого туроператор присылает rooming list */
  @Column({ type: 'date', nullable: true }) roomingDue: string | null;
  @Column({ type: 'varchar', length: 12, default: 'individual' }) billing: HotelGroupBilling;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
