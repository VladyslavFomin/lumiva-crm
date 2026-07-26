import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('hotel_room_market_prices')
@Index(['tenantId', 'roomTypeId'])
@Index(['roomTypeId', 'marketId'], { unique: true })
export class HotelRoomMarketPrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  roomTypeId: string;

  @Column({ type: 'uuid' })
  marketId: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  price: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
