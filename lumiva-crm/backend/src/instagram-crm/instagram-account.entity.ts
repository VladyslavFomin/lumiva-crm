import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type InstagramAccountSettings = {
  /** Новый собеседник в директе → лид (по умолчанию да) */
  dmToLead?: boolean;
  /** Комментарий под постом → лид (по умолчанию да) */
  commentsToLead?: boolean;
  /** Лид из комментария только если в тексте есть одно из слов (пусто — из любого) */
  commentKeywords?: string[];
};

/** Подключённый Instagram Business аккаунт (через страницу Facebook платформенного Meta-приложения). */
@Entity('instagram_accounts')
export class InstagramAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  /** ID Instagram Business аккаунта — по нему маршрутизируется вебхук (entry.id) */
  @Column({ type: 'varchar', length: 64 })
  igUserId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  igUsername: string | null;

  @Column({ type: 'text', nullable: true })
  profilePictureUrl: string | null;

  @Column({ type: 'varchar', length: 64 })
  pageId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pageName: string | null;

  /** Токен страницы из долгоживущего токена пользователя — не истекает, пока не отозван. Наружу не отдаётся. */
  @Column({ type: 'text', select: false })
  pageAccessToken: string;

  /** active / error / disconnected */
  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: string;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastEventAt: Date | null;

  /** Владельцу уже сообщили о текущей ошибке (IntegrationHealthService) */
  @Column({ type: 'timestamptz', nullable: true })
  healthNotifiedAt: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  settings: InstagramAccountSettings;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
