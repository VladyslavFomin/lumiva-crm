// src/tenants/tenant.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../users/user.entity';
import { Site } from '../sites/site.entity';
import { Lead } from '../leads/lead.entity';
import { ApiToken } from '../api-tokens/api-token.entity';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  clientKey: string;

  @Column()
  name: string;

  /**
   * Статус тенанта:
   *  - active    → клиент имеет доступ к системе
   *  - blocked   → клиент НЕ должен иметь доступ
   *  - suspended → временная заморозка
   */
  @Column({ type: 'varchar', default: 'active' })
  status: string;

  /**
   * Тарифный план
   */
  @Column({ type: 'varchar', default: 'basic' })
  plan: string;

  /**
   * Логотип (URL)
   */
  @Column({ type: 'varchar', length: 512, nullable: true })
  logoUrl: string | null;

  /**
   * Язык интерфейса
   */
  @Column({ type: 'varchar', length: 16, nullable: true, default: 'ru' })
  uiLanguage: string | null;

  /**
   * API включён/выключен
   */
  @Column({ type: 'boolean', default: true })
  apiEnabled: boolean;

  /**
   * До какой даты активен тенант (null = бессрочно)
   */
  @Column({ type: 'timestamptz', nullable: true })
  activeUntil: Date | null;

  /**
   * Отображаемое имя владельца компании в платформе
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  ownerName: string | null;

  /**
   * Основной email владельца
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  ownerEmail: string | null;

  /**
   * Внутренние заметки по тенанту (видны только в админ-панели)
   */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /**
   * Включенные модули для тенента (JSON объект: { "chat": true, "marketing": false, ... })
   */
  @Column({ type: 'jsonb', nullable: true })
  enabledModules: Record<string, boolean> | null;

  /**
   * Включенные компоненты интерфейса для тенента
   */
  @Column({ type: 'jsonb', nullable: true })
  enabledComponents: Record<string, boolean> | null;

  /** Использовано хранилища компании (байты) */
  @Column({ name: 'storage_used_bytes', type: 'bigint', default: '0' })
  storageUsedBytes: string;

  /** Докупленный объём (байты), сверх базового по тарифу */
  @Column({ name: 'storage_extra_bytes', type: 'bigint', default: '0' })
  storageExtraBytes: string;

  @Column({ type: 'text', nullable: true })
  lastBillingSessionId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // ===== Связи =====

  @OneToMany(() => ApiToken, (token) => token.tenant)
  apiTokens: ApiToken[];

  @OneToMany(() => User, (user) => user.tenant)
  users: User[];

  @OneToMany(() => Site, (site) => site.tenant)
  sites: Site[];

  @OneToMany(() => Lead, (lead) => lead.tenant)
  leads: Lead[];
}
