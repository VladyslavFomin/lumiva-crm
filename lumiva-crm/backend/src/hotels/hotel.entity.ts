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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
