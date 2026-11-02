import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Элемент оформления плана зала (не бронируется): стена, барная стойка, вход, окно, кухня… */
export interface BookingZoneDecor {
  id: string;
  kind: 'wall' | 'bar' | 'entrance' | 'window' | 'kitchen' | 'plant' | 'stage' | 'label';
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  label?: string | null;
}

/**
 * Зал / зона заведения (ресторан: «Основной зал», «Веранда», «VIP»). Столы — это
 * BookingResource с type='table' и zoneId → координаты на плане хранятся на самом ресурсе,
 * чтобы проверка конфликтов броней продолжала работать по resourceId без изменений.
 */
@Entity('booking_zones')
@Index(['tenantId', 'locationId'])
export class BookingZone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'uuid' })
  locationId: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  color: string | null;

  /** Размер холста плана в условных единицах (1 ед. ≈ 1 px при масштабе 100%). */
  @Column({ type: 'integer', default: 1000 })
  width: number;

  @Column({ type: 'integer', default: 640 })
  height: number;

  @Column({ type: 'jsonb', default: [] })
  decor: BookingZoneDecor[];

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
