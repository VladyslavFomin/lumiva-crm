// src/sales-channels/sales-channel.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Sale } from '../sales/sale.entity';

export type SalesChannelType = 'b2b' | 'ota' | 'direct' | 'gds' | 'other';

@Entity('sales_channels')
export class SalesChannel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'other',
  })
  type: SalesChannelType;

  // ВАЖНО: явный тип varchar, без union-типа в свойстве
  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  integrationId: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  integrationName: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  connectedAt: Date;

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @Column({ type: 'varchar', length: 8, default: 'EUR' })
  currency: string;

  // агрегированные поля (для быстрого чтения)
  @Column({ type: 'int', default: 0 })
  totalSalesCount: number;

  @Column({ type: 'double precision', default: 0 })
  totalSalesAmount: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @OneToMany(() => Sale, (sale) => sale.channel)
  sales: Sale[];
}