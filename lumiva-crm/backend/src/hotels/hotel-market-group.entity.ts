import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Группа рынков продаж (Batı Avrupa/Doğu Avrupa/İç Pazar): цена = прайс сезона ± adjustmentPct
 * (или свой PP на период); рынки (HotelMarket) относятся к группе через marketGroupId. */
@Entity('hotel_market_groups')
@Index(['tenantId', 'hotelId'])
export class HotelMarketGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  hotelId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  /** Надбавка (+) / скидка (−) в % к PP прайса сезона; у опорной группы не применяется */
  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  adjustmentPct: string;

  /** Свой PP минимальной категории на период ({ [periodId]: "PP" }) — важнее надбавки в % */
  @Column({ type: 'jsonb', default: {} })
  periodPP: Record<string, string>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
