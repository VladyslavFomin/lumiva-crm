// src/integrations/integration-connection.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { IntegrationKind } from './integration-kind.enum';

@Entity('integration_connections')
export class IntegrationConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Человеческое название подключения (например "WooCommerce · main shop")
  @Column({ length: 100 })
  name: string;

  // Тип интеграции: woocommerce / manual-import / other
  @Column({ type: 'varchar', length: 32 })
  kind: IntegrationKind;

  // Привязка к каналу продаж (sales_channels.id), НЕ обязательно
  @Column({ type: 'uuid', nullable: true })
  channelId: string | null;

  // Краткое описание или подпись (например, домен магазина)
  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  // Храним конфиг как JSON в текстовом поле
  // (apiUrl, consumerKey, consumerSecret, доп. поля и т.п.)
  @Column({ type: 'text', nullable: true })
  configJson: string | null;

  // Подключение включено
  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  // "Мягкое" удаление (для истории)
  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  // Последняя успешная синхронизация
  @Column({ type: 'timestamptz', nullable: true })
  lastSyncAt: Date | null;

  // Последний статус ("ok" / "error" / "never")
  @Column({ type: 'varchar', length: 32, default: 'never' })
  lastSyncStatus: string;

  // Краткое описание последней ошибки
  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  // Минимальная статистика по продажам, чтобы быстро показывать в UI
  @Column({ type: 'int', default: 0 })
  totalSalesCount: number;

  @Column({ type: 'double precision', default: 0 })
  totalSalesAmount: number;

  @Column({ type: 'varchar', length: 8, default: 'EUR' })
  currency: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}