import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type HotelRoomUnitHousekeepingStatus = 'clean' | 'dirty' | 'inspected' | 'out_of_order';

/** A physical room ("204") inside a room type — distinct from HotelRoomType.quantity, which is
 * just a count with no individual identity. Lets front-desk/housekeeping track "is 204 ready"
 * and lets a reservation be assigned a specific room, usually at check-in (see
 * HotelReservation.roomUnitId, nullable — booking by room type without a unit assigned yet is
 * the normal flow, matching how real hotels operate). */
@Entity('hotel_room_units')
@Index(['tenantId', 'hotelId'])
@Index(['hotelId', 'label'], { unique: true }) // room numbers are unique per hotel, not per room type
export class HotelRoomUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  hotelId: string;

  @Column({ type: 'uuid' })
  roomTypeId: string;

  @Column({ type: 'varchar', length: 64 })
  label: string;

  @Column({ type: 'varchar', length: 16, default: 'clean' })
  housekeepingStatus: HotelRoomUnitHousekeepingStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** Soft-remove from inventory (temporarily or permanently) without losing reservation history
   * that references this unit — reservations keep roomUnitId even after a unit is deactivated. */
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
