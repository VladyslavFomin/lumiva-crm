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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
