import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type HotelFactsheetItemKind = 'restaurant' | 'bar' | 'pool' | 'miniclub' | 'service';

/** Один общий тип для всех повторяющихся блоков фактшита отеля (рестораны/бары/бассейны/
 * мини-клуб/услуги) вместо 5 почти одинаковых таблиц — все блоки имеют одну и ту же форму
 * (название/описание/часы работы), а специфичные для типа редкие поля (площадь бассейна,
 * возрастная группа мини-клуба) живут в "extra" jsonb — тот же принцип "не зашивать в схему
 * специфичные для отельного бизнеса поля", что и у Hotel.infoFields. */
@Entity('hotel_factsheet_items')
@Index(['tenantId', 'hotelId'])
@Index(['hotelId', 'kind'])
export class HotelFactsheetItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  hotelId: string;

  @Column({ type: 'varchar', length: 16 })
  kind: HotelFactsheetItemKind;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Свободный текст ("19:00–22:00", "24 часа", "через день", "10:30–12:00 / 12:00–18:00") —
   * не строгие from/to времена, т.к. реальные фактшиты содержат именно такие форматы. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  hours: string | null;

  /** Используется только для kind='service' (бесплатно/платно), null для остальных типов. */
  @Column({ type: 'boolean', nullable: true })
  paid: boolean | null;

  /** Специфичные для типа поля: pool: {areaM2, depth}, restaurant: {mealType}, miniclub: {ageRange}. */
  @Column({ type: 'jsonb', default: {} })
  extra: Record<string, string>;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
