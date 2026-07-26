import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Импорт подневных оптовых цен (Bütçe/Brüt/İndirim по датам) — тот же двухфазный
 * preview/apply, что и HotelReservationImportSession, отдельная сессия/таблица. */
@Entity('hotel_pricing_import_sessions')
export class HotelPricingImportSession {
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

  /** Group names carried forward from the sheet's group-label header row (e.g. "Batı Avrupa"),
   * so applyImport can auto-create any HotelMarketGroup that doesn't exist yet for this hotel
   * instead of silently dropping that group's columns. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  groupNames: string[];

  @Column({ type: 'varchar', length: 30, default: 'preview' })
  status: 'preview' | 'applied' | 'failed';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
