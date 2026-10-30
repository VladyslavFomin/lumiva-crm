import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const HOTEL_GUEST_REQUEST_CATEGORIES = ['towels', 'cleaning', 'amenities', 'minibar', 'maintenance', 'noise', 'other', 'message'] as const;
export type HotelGuestRequestCategory = (typeof HOTEL_GUEST_REQUEST_CATEGORIES)[number];
/** Что уходит в уборку, а что — техникам (неисправность) */
export const HOTEL_GUEST_HK_CATEGORIES: HotelGuestRequestCategory[] = ['towels', 'cleaning', 'amenities', 'minibar'];
export type HotelGuestRequestStatus = 'new' | 'in_progress' | 'done' | 'cancelled';

/** Заявка гостя: QR-код в номере, сообщение WhatsApp проживающего или запись сотрудника со слов гостя */
@Entity('hotel_guest_requests')
@Index(['tenantId', 'hotelId', 'status', 'createdAt'])
export class HotelGuestRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'uuid', nullable: true }) roomUnitId: string | null;
  @Column({ type: 'uuid', nullable: true }) reservationId: string | null;
  /** короткий номер заявки в отеле — гость видит его на экране «Заявка принята» */
  @Column({ type: 'integer' }) number: number;
  @Column({ type: 'varchar', length: 16 }) source: 'qr' | 'whatsapp' | 'staff';
  @Column({ type: 'varchar', length: 24 }) category: HotelGuestRequestCategory;
  @Column({ type: 'varchar', length: 24, nullable: true }) subcategory: string | null;
  @Column({ type: 'text', nullable: true }) text: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) guestName: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) guestPhone: string | null;
  @Column({ type: 'varchar', length: 4, nullable: true }) lang: string | null;
  @Column({ type: 'varchar', length: 16, default: 'new' }) status: HotelGuestRequestStatus;
  @Column({ type: 'uuid', nullable: true }) assigneeUserId: string | null;
  /** техническая заявка → неисправность (уборка/техники видят её в «Неисправностях») */
  @Column({ type: 'uuid', nullable: true }) maintenanceIssueId: string | null;
  @Column({ type: 'text', nullable: true }) staffNote: string | null;
  @Column({ type: 'timestamptz', nullable: true }) startedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) doneAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
