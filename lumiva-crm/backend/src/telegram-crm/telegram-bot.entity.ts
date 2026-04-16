// src/telegram-crm/telegram-bot.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';

/**
 * Telegram боты для каждого тенанта
 */
@Entity('telegram_bots')
@Index(['tenantId', 'botToken'])
export class TelegramBot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==== MULTI-TENANT ====
  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // ==== TELEGRAM ДАННЫЕ ====
  @Column({ type: 'varchar', length: 255, unique: true })
  botToken: string; // Telegram Bot Token

  @Column({ type: 'varchar', length: 255, nullable: true })
  botUsername: string | null; // @botname

  @Column({ type: 'varchar', length: 255, nullable: true })
  botName: string | null; // Имя бота

  // ==== WEBHOOK ====
  @Column({ type: 'varchar', length: 500, nullable: true })
  webhookUrl: string | null; // URL для webhook

  @Column({ type: 'timestamp', nullable: true })
  webhookSetAt: Date | null;

  // ==== СТАТУС ====
  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: string; // active, inactive, error

  @Column({ type: 'text', nullable: true })
  lastError: string | null; // Последняя ошибка

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt: Date | null; // Последняя синхронизация

  // ==== НАСТРОЙКИ ====
  @Column({ type: 'boolean', default: true })
  autoReply: boolean; // Автоответы

  @Column({ type: 'text', nullable: true })
  welcomeMessage: string | null; // Приветственное сообщение

  // ==== META ====
  @Column({ type: 'jsonb', nullable: true })
  meta: any | null;

  // ==== AUDIT ====
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}













