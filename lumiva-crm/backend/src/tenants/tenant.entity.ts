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

  /** Период учёта AI (YYYY-MM); при смене месяца сбрасывается spent из пакета */
  @Column({ name: 'ai_period_ym', type: 'varchar', length: 7, nullable: true })
  aiPeriodYm: string | null;

  /** Потрачено из месячного включённого пула (центы USD-эквивалента) */
  @Column({ name: 'ai_spent_included_cents', type: 'int', default: 0 })
  aiSpentIncludedCents: number;

  /** Предоплаченные AI-кредиты (центы), пополняются отдельным продуктом */
  @Column({ name: 'ai_prepaid_cents', type: 'int', default: 0 })
  aiPrepaidCents: number;

  /**
   * Месячный включённый лимит в центах; 0 = брать из тарифа платформы
   */
  @Column({ name: 'ai_monthly_included_cents', type: 'int', default: 0 })
  aiMonthlyIncludedCents: number;

  /**
   * Шаблон письма CRM с плейсхолдерами {{contentHtml}}, {{contentText}}, {{headline}}, {{tenantName}}.
   * Если null — используется встроенная обёртка в стиле транзакционных писем Lumiva.
   */
  @Column({ name: 'ai_wrapper_email_template_id', type: 'uuid', nullable: true })
  aiWrapperEmailTemplateId: string | null;

  @Column({ type: 'text', nullable: true })
  lastBillingSessionId: string | null;

  /** Идемпотентность Stripe Checkout для докупки AI / хранилища */
  @Column({ type: 'text', nullable: true })
  stripeAuxLastSessionId: string | null;

  /** Постоянный Stripe Customer id — для чекаута и Customer Portal (способы оплаты) */
  @Column({ type: 'text', nullable: true })
  stripeCustomerId: string | null;

  /**
   * IP-телефония — платный добавок поверх любого тарифа (не входит ни в один план по умолчанию,
   * поэтому НЕ участвует в plan-entitlements/COMPONENT_MIN_PLAN — тот механизм считает "не задано
   * явно" как "разрешено по тарифу", что здесь означало бы бесплатный доступ). Включается либо
   * вручную из pl1, либо автоматически вебхуком Stripe при успешной оплате чек-аута
   * `telephony_addon`.
   */
  @Column({ type: 'boolean', default: false })
  telephonyAddonEnabled: boolean;

  /** Set once the new-tenant setup wizard is completed or explicitly skipped. Null = still pending
   * (backfilled to createdAt for tenants that predate the wizard — see migration Onboarding1781500000000). */
  @Column({ type: 'timestamptz', nullable: true })
  onboardingCompletedAt: Date | null;

  /** Set once the "load example data" wizard step has run — makes seeding idempotent. */
  @Column({ type: 'timestamptz', nullable: true })
  sampleDataSeededAt: Date | null;

  /** Last Stripe `invoice.payment_failed` for this tenant's telephony addon subscription — the
   * main plan is prepaid one-time Checkout, not a Stripe Subscription, so it never raises this. */
  @Column({ type: 'timestamptz', nullable: true })
  lastPaymentFailedAt: Date | null;

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
