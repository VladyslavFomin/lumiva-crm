import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Тенант-широкий справочник агентств/туроператоров — общий для всех отелей тенанта
 * (одно и то же агентство продаёт разные объекты). Лениво сеется дефолтным набором
 * при первом обращении, см. HotelsAgenciesService.listOrSeed. */
@Entity('hotel_agencies')
@Index(['tenantId'])
export class HotelAgency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
