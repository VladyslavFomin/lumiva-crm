import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Импорт листа «Цены с размещением» (period-pair заголовок + строки размещения с ручными
 * override-значениями) — та же двухфазная preview/apply сессия, что и остальные импорты. */
@Entity('hotel_room_pricing_import_sessions')
export class HotelRoomPricingImportSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  originalFileName: string | null;

  /** Разобранные периоды листа: [{ startDate, endDate, colIndex }] */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  periods: Array<{ startDate: string; endDate: string }>;

  /** Разобранные строки размещения: [{ label, valuesByPeriodIndex: string[] }] */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  occupancyRows: Array<{ label: string; values: string[] }>;

  @Column({ type: 'varchar', length: 30, default: 'preview' })
  status: 'preview' | 'applied' | 'failed';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
