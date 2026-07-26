import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type HotelStatus = 'active' | 'draft';

@Entity('hotels')
@Index(['tenantId'])
export class Hotel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  country: string | null;

  @Column({ type: 'integer', default: 5 })
  stars: number;

  @Column({ type: 'char', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: HotelStatus;

  @Column({ type: 'varchar', length: 8, default: '14:00' })
  checkInTime: string;

  @Column({ type: 'varchar', length: 8, default: '12:00' })
  checkOutTime: string;

  /** Какая рыночная группа (HotelMarketGroup) служит базой для Net PP при расчёте
   * "Цены с размещением" — по умолчанию первая созданная группа, если не задано явно. */
  @Column({ type: 'uuid', nullable: true })
  referenceMarketGroupId: string | null;

  /** Плановая выручка на сезон/период — используется в воронке выручки в аналитике. */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  seasonRevenueTarget: string;

  /** Пороги риска для теплокарты дат заезда в аналитике (загрузка ниже bad% — красный, ниже
   * warn% — жёлтый). null означает "использовать значения по умолчанию (45/65)". */
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  riskThresholdBadPct: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  riskThresholdWarnPct: string | null;

  /** "Информация об отеле" (factsheet) — гибкая карта полей (год открытия, реновация, лифты,
   * пляж, бассейны и т.д.), т.к. список полей специфичен для отельного бизнеса и не должен быть
   * жёстко зашит в схему. Тот же паттерн, что и HotelRoomType.infoFields. */
  @Column({ type: 'jsonb', default: {} })
  infoFields: Record<string, string | boolean>;

  @Column({ type: 'varchar', length: 512, nullable: true })
  coverPhotoUrl: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
