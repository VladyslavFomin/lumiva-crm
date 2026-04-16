import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('platform_settings')
export class PlatformSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  telegramBotToken: string | null;

  @Column({ type: 'text', nullable: true })
  telegramChatId: string | null;

  @Column({ type: 'text', nullable: true })
  googleOauthClientId: string | null;

  @Column({ type: 'text', nullable: true })
  googleOauthClientSecret: string | null;

  @Column({ type: 'text', nullable: true })
  metaOauthAppId: string | null;

  @Column({ type: 'text', nullable: true })
  metaOauthAppSecret: string | null;

  @Column({ type: 'text', nullable: true })
  vkOauthClientId: string | null;

  @Column({ type: 'text', nullable: true })
  vkOauthClientSecret: string | null;

  @Column({ type: 'text', nullable: true })
  stripeSecretKey: string | null;

  @Column({ type: 'text', nullable: true })
  stripePublishableKey: string | null;

  @Column({ type: 'text', nullable: true })
  stripeWebhookSecret: string | null;

  @Column({ type: 'text', nullable: true })
  stripePriceStandard: string | null;

  @Column({ type: 'text', nullable: true })
  stripePriceProfessional: string | null;

  @Column({ type: 'text', nullable: true })
  stripePriceEnterprise: string | null;

  @Column({ type: 'text', nullable: true })
  stripePriceUltimate: string | null;

  @Column({ type: 'jsonb', nullable: true })
  billingPlans: unknown[] | null;

  /** OpenAI-compatible API key (platform-wide; не отдавать в CRM UI) */
  @Column({ type: 'text', nullable: true })
  openAiApiKey: string | null;

  /** База URL, например https://api.openai.com/v1 */
  @Column({ type: 'text', nullable: true })
  openAiBaseUrl: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  openAiModel: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  openAiImageModel: string | null;

  /** USD за 1M input tokens (строка для decimal) */
  @Column({ type: 'varchar', length: 32, nullable: true })
  aiPriceInputPerMtokUsd: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  aiPriceOutputPerMtokUsd: string | null;

  /** Фикс. списание в центах за одно изображение (внутренняя «стоимость») */
  @Column({ type: 'int', nullable: true })
  aiImageCostCents: number | null;

  @Column({ type: 'text', nullable: true })
  stripePriceAiCredits: string | null;

  @Column({ type: 'text', nullable: true })
  stripePriceStoragePack: string | null;

  /** Сколько центов AI-кредитов начислять за одну покупку (если нет metadata в Stripe) */
  @Column({ type: 'int', nullable: true })
  aiCreditsPackAmountCents: number | null;

  /** +байт к storage_extra при покупке пакета хранилища */
  @Column({ type: 'bigint', nullable: true })
  storagePackBytes: string | null;

  /**
   * OAuth-приложения платформы для CRM-интеграций (клиентский id/secret).
   * Ключи — как в каталоге: slack, ms_teams, … Значения: { clientId, clientSecret }.
   */
  @Column({ type: 'jsonb', nullable: true, name: 'integration_oauth_apps' })
  integrationOAuthApps: Record<
    string,
    { clientId?: string | null; clientSecret?: string | null }
  > | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
