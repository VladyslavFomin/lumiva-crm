import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type HotelRoomPricingMode = 'offset' | 'fixed_rate';

@Entity('hotel_room_types')
@Index(['tenantId', 'hotelId'])
export class HotelRoomType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  hotelId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  sizeM2: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  capacityLabel: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  basePrice: string;

  @Column({ type: 'char', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'integer', default: 0 })
  quantity: number;

  @Column({ type: 'text', array: true, default: '{}' })
  amenities: string[];

  /** offset: цена = (referenceNetPP + ppNetOffset) * коэффициент занятости.
   *  fixed_rate: цена = коэффициент * referenceNetPP (коэффициент — сама итоговая ставка). */
  @Column({ type: 'varchar', length: 16, default: 'offset' })
  pricingMode: HotelRoomPricingMode;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  ppNetOffset: string;

  /** Ровно один тип номера на отель должен быть true — его Daily Market Rate.netPP
   * служит базой (referenceNetPP) для всех остальных типов номеров этого отеля. */
  @Column({ type: 'boolean', default: false })
  isBaseRoomType: boolean;

  /** "Информация по номеру" — гибкая карта полей (м², вместимость, удобства и т.д.),
   * т.к. список полей специфичен для отельного бизнеса и не должен быть жёстко зашит в схему. */
  @Column({ type: 'jsonb', default: {} })
  infoFields: Record<string, string | boolean>;

  /** Полная стоп-продажа этого типа номера (независимо от дат) — например, номер выведен из
   * эксплуатации или полностью распродан по другому каналу. Отдельно от точечных стоп-дат
   * (см. HotelRoomStopSaleDate) и от блокировок в розничном календаре (HotelRoomDateOverride,
   * другая, независимая система цен по решению из plan mode). */
  @Column({ type: 'boolean', default: false })
  stopSale: boolean;

  @Column({ type: 'varchar', length: 512, nullable: true })
  coverPhotoUrl: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
