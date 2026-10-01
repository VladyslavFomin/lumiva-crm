import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Рекламный кабинет → клиент (компания CRM). Ключ кабинета — тот же, что видит ИИ и выгрузки:
 * google_ads_<cid>, meta_ads_<id кабинета>, ga4_<property>, yandex_direct…, vk_ads….
 * Несколько кабинетов разных площадок сводятся к одной компании (Asteria = Meta + 2× Google).
 */
@Entity('marketing_account_clients')
@Index(['tenantId', 'accountKey'], { unique: true })
export class MarketingAccountClient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 120 })
  accountKey: string;

  @Column({ type: 'uuid' })
  companyId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
