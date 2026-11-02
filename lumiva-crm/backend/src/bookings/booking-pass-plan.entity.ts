import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** visits — N посещений; unlimited — безлимит на срок. Для консультаций это «пакет сессий». */
export type BookingPassPlanKind = 'visits' | 'unlimited';

/** Тариф абонемента / пакета сессий. */
@Entity('booking_pass_plans')
@Index(['tenantId', 'projectId'])
export class BookingPassPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 16, default: 'visits' })
  kind: BookingPassPlanKind;

  @Column({ type: 'integer', nullable: true })
  visits: number | null;

  @Column({ type: 'integer', default: 30 })
  validityDays: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  price: string;

  @Column({ type: 'char', length: 3, default: 'RUB' })
  currency: string;

  /** На какие направления/услуги действует. Пусто — на все. */
  @Column({ type: 'uuid', array: true, default: [] })
  serviceIds: string[];

  /** Сколько дней заморозки допускается суммарно. */
  @Column({ type: 'integer', default: 0 })
  freezeDaysAllowed: number;

  @Column({ type: 'varchar', length: 16, nullable: true })
  color: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
