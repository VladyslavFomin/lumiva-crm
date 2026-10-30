import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const HOTEL_UNIT_FEATURES = ['connecting', 'accessible', 'smoking', 'non_smoking', 'pet_friendly', 'sea_view', 'balcony'] as const;

export type HotelOutageKind = 'ooo' | 'oos';
export const HOTEL_OUTAGE_REASONS = ['repair', 'renovation', 'deep_cleaning', 'pest_control', 'damage', 'staff_use', 'other'] as const;
export type HotelOutageReason = (typeof HOTEL_OUTAGE_REASONS)[number];

/**
 * Номер не работает на период (PMS-005). OOO (out of order) — снят с продажи, уменьшает доступность;
 * OOS (out of service) — продаётся, но с пометкой (мелкий дефект). dateTo — день, когда номер снова в строю
 * (как дата выезда); null — до устранения неисправности.
 */
@Entity('hotel_room_outages')
@Index(['tenantId', 'hotelId', 'dateFrom'])
@Index(['roomUnitId'])
export class HotelRoomOutage {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'uuid' }) roomUnitId: string;
  @Column({ type: 'varchar', length: 8, default: 'ooo' }) kind: HotelOutageKind;
  @Column({ type: 'date' }) dateFrom: string;
  @Column({ type: 'date', nullable: true }) dateTo: string | null;
  @Column({ type: 'varchar', length: 32, default: 'repair' }) reason: HotelOutageReason;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @Column({ type: 'uuid', nullable: true }) issueId: string | null;
  @Column({ type: 'uuid', nullable: true }) createdBy: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

export type HotelHkTaskKind = 'departure' | 'stayover' | 'arrival' | 'vacant_dirty';
export type HotelHkTaskStatus = 'pending' | 'in_progress' | 'done' | 'inspected' | 'skipped';

/** Задача плана уборки на день (PMS-100…104): одна на номер и дату */
@Entity('hotel_housekeeping_tasks')
@Index(['tenantId', 'hotelId', 'date'])
@Index(['hotelId', 'date', 'roomUnitId'], { unique: true })
@Index(['tenantId', 'assigneeUserId', 'date'])
export class HotelHousekeepingTask {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'date' }) date: string;
  @Column({ type: 'uuid' }) roomUnitId: string;
  @Column({ type: 'varchar', length: 16 }) kind: HotelHkTaskKind;
  @Column({ type: 'integer', default: 0 }) priority: number;
  /** Нагрузка в кредитах: выезд 3, заезд 2, грязный свободный 2, проживающий 1 */
  @Column({ type: 'integer', default: 1 }) credits: number;
  @Column({ type: 'uuid', nullable: true }) reservationId: string | null;
  @Column({ type: 'uuid', nullable: true }) assigneeUserId: string | null;
  @Column({ type: 'varchar', length: 16, default: 'pending' }) status: HotelHkTaskStatus;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @Column({ type: 'timestamptz', nullable: true }) startedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) doneAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) inspectedAt: Date | null;
  @Column({ type: 'uuid', nullable: true }) inspectedBy: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

export const HOTEL_ISSUE_CATEGORIES = ['ac', 'plumbing', 'electric', 'tv', 'safe', 'furniture', 'door_lock', 'minibar', 'other'] as const;
export type HotelIssueCategory = (typeof HOTEL_ISSUE_CATEGORIES)[number];
export type HotelIssuePriority = 'low' | 'normal' | 'high' | 'urgent';
export type HotelIssueStatus = 'open' | 'in_progress' | 'resolved' | 'cancelled';

/** Неисправность в номере (PMS-103): отмечает горничная или ресепшн, может снять номер с продажи */
@Entity('hotel_maintenance_issues')
@Index(['tenantId', 'hotelId', 'status'])
@Index(['roomUnitId'])
export class HotelMaintenanceIssue {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'uuid', nullable: true }) roomUnitId: string | null;
  @Column({ type: 'varchar', length: 24, default: 'other' }) category: HotelIssueCategory;
  @Column({ type: 'varchar', length: 8, default: 'normal' }) priority: HotelIssuePriority;
  @Column({ type: 'varchar', length: 16, default: 'open' }) status: HotelIssueStatus;
  @Column({ type: 'text' }) description: string;
  @Column({ type: 'jsonb', default: [] }) photoUrls: string[];
  @Column({ type: 'uuid', nullable: true }) reportedBy: string | null;
  @Column({ type: 'uuid', nullable: true }) assigneeUserId: string | null;
  @Column({ type: 'uuid', nullable: true }) outageId: string | null;
  @Column({ type: 'text', nullable: true }) resolution: string | null;
  @Column({ type: 'timestamptz', nullable: true }) resolvedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

export const HOTEL_LOST_CATEGORIES = ['documents', 'electronics', 'jewelry', 'clothing', 'money', 'bag', 'other'] as const;
export type HotelLostCategory = (typeof HOTEL_LOST_CATEGORIES)[number];
export type HotelLostStatus = 'stored' | 'returned' | 'disposed' | 'handed_over';

/** Находки (Lost & Found, PMS-105) */
@Entity('hotel_lost_found')
@Index(['tenantId', 'hotelId', 'status'])
export class HotelLostFound {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) tenantId: string;
  @Column({ type: 'uuid' }) hotelId: string;
  @Column({ type: 'uuid', nullable: true }) roomUnitId: string | null;
  @Column({ type: 'uuid', nullable: true }) reservationId: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) guestName: string | null;
  @Column({ type: 'varchar', length: 16, default: 'other' }) category: HotelLostCategory;
  @Column({ type: 'text' }) description: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) foundPlace: string | null;
  @Column({ type: 'timestamptz' }) foundAt: Date;
  @Column({ type: 'uuid', nullable: true }) foundBy: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) storageLocation: string | null;
  @Column({ type: 'jsonb', default: [] }) photoUrls: string[];
  @Column({ type: 'varchar', length: 16, default: 'stored' }) status: HotelLostStatus;
  @Column({ type: 'varchar', length: 255, nullable: true }) returnedTo: string | null;
  @Column({ type: 'timestamptz', nullable: true }) closedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) notifiedAt: Date | null;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
