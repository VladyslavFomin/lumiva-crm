import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('booking_services')
@Index(['tenantId', 'projectId'])
@Index(['tenantId', 'active'])
export class BookingService {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  category: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  color: string | null;

  @Column({ type: 'integer', default: 60 })
  durationMinutes: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  price: string;

  @Column({ type: 'char', length: 3, default: 'RUB' })
  currency: string;

  @Column({ type: 'integer', default: 1 })
  capacityMin: number;

  @Column({ type: 'integer', default: 1 })
  capacityMax: number;

  @Column({ type: 'uuid', array: true, default: [] })
  locationIds: string[];

  @Column({ type: 'uuid', array: true, default: [] })
  staffUserIds: string[];

  @Column({ type: 'varchar', length: 60, nullable: true })
  resourceTypeRequired: string | null;

  @Column({ type: 'integer', default: 0 })
  bufferBeforeMinutes: number;

  @Column({ type: 'integer', default: 0 })
  bufferAfterMinutes: number;

  @Column({ type: 'integer', nullable: true })
  minNoticeMinutes: number | null;

  @Column({ type: 'boolean', default: true })
  autoConfirm: boolean;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
