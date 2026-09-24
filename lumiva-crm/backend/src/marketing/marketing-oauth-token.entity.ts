import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * OAuth-доступ клиента к рекламному кабинету (пока Meta Ads): получен кнопкой «Подключить»,
 * из него подключаются выбранные рекламные аккаунты. Отдельно от marketing_integrations,
 * чтобы токен не светился в списке интеграций.
 */
@Entity('marketing_oauth_tokens')
@Index(['tenantId', 'provider'], { unique: true })
export class MarketingOauthToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  /** meta_ads */
  @Column({ type: 'varchar', length: 40 })
  provider: string;

  @Column({ type: 'text' })
  accessToken: string;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  /** Какое напоминание об истечении уже отправлено: 'soon' (за 7 дней) / 'expired'; null — ничего. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  expiryNotice: 'soon' | 'expired' | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
