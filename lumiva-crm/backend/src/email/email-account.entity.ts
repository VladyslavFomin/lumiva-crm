// src/email/email-account.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';

/**
 * Email аккаунты для интеграции
 * Поддерживает IMAP (входящие) и SMTP (исходящие)
 */
@Entity('email_accounts')
@Index(['tenantId', 'email'])
@Index(['tenantId', 'userId'])
export class EmailAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==== MULTI-TENANT ====
  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // ==== OWNER ====
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  // ==== ОСНОВНЫЕ ДАННЫЕ ====
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null; // Отображаемое имя

  // ==== IMAP (входящие) ====
  @Column({ type: 'varchar', length: 255, nullable: true })
  imapHost: string | null; // imap.gmail.com, imap.mail.yahoo.com

  @Column({ type: 'integer', nullable: true })
  imapPort: number | null; // 993 для SSL, 143 для STARTTLS

  @Column({ type: 'boolean', default: true })
  imapSecure: boolean; // SSL/TLS

  @Column({ type: 'varchar', length: 255, nullable: true })
  imapUsername: string | null;

  @Column({ type: 'text', nullable: true })
  imapPassword: string | null; // Зашифрованный пароль или app password

  // ==== SMTP (исходящие) ====
  @Column({ type: 'varchar', length: 255, nullable: true })
  smtpHost: string | null; // smtp.gmail.com, smtp.mail.yahoo.com

  @Column({ type: 'integer', nullable: true })
  smtpPort: number | null; // 465 для SSL, 587 для STARTTLS

  @Column({ type: 'boolean', default: true })
  smtpSecure: boolean; // SSL/TLS

  @Column({ type: 'varchar', length: 255, nullable: true })
  smtpUsername: string | null;

  @Column({ type: 'text', nullable: true })
  smtpPassword: string | null;

  // ==== OAuth (для Gmail/Outlook) ====
  @Column({ type: 'text', nullable: true })
  oauthAccessToken: string | null;

  @Column({ type: 'text', nullable: true })
  oauthRefreshToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  oauthExpiresAt: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  oauthProvider: string | null; // 'gmail', 'outlook', 'yahoo'

  // ==== СТАТУС ====
  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: string; // active, inactive, error

  @Column({ type: 'text', nullable: true })
  lastError: string | null; // Последняя ошибка подключения

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt: Date | null; // Последняя синхронизация

  // ==== НАСТРОЙКИ ====
  @Column({ type: 'boolean', default: true })
  syncIncoming: boolean; // Синхронизировать входящие

  @Column({ type: 'boolean', default: true })
  syncOutgoing: boolean; // Синхронизировать исходящие

  @Column({ type: 'varchar', length: 255, nullable: true })
  syncFolder: string | null; // Папка для синхронизации (INBOX по умолчанию)

  // ==== META ====
  @Column({ type: 'jsonb', nullable: true })
  meta: any | null;

  // ==== AUDIT ====
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}













