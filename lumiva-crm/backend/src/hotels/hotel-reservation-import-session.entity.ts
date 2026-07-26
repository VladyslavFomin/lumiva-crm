import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Мирроит ReservationImportSession (см. src/bookings/reservation-import-session.entity.ts). */
@Entity('hotel_reservation_import_sessions')
export class HotelReservationImportSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  originalFileName: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  columns: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  rows: Array<Record<string, any>>;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  sample: Array<Record<string, any>>;

  @Column({ type: 'integer', default: 0 })
  totalRows: number;

  @Column({ type: 'jsonb', nullable: true })
  suggestedMapping: Record<string, string | null> | null;

  @Column({ type: 'varchar', length: 30, default: 'preview' })
  status: 'preview' | 'applied' | 'failed';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
