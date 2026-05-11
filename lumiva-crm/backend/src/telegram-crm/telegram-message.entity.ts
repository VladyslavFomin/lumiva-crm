// src/telegram-crm/telegram-message.entity.ts
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
import { TelegramContact } from './telegram-contact.entity';

/**
 * Telegram сообщения для CRM
 */
@Entity('telegram_messages')
@Index(['tenantId', 'messageId']) // messageId - уникальный ID сообщения от Telegram
@Index(['tenantId', 'contactId', 'date'])
export class TelegramMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==== MULTI-TENANT ====
  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // ==== СВЯЗЬ С TELEGRAM КОНТАКТОМ ====
  @Column({ type: 'uuid' })
  contactId: string;

  @ManyToOne(() => TelegramContact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contactId' })
  contact: TelegramContact;

  // ==== TELEGRAM ДАННЫЕ ====
  @Column({ type: 'bigint' })
  messageId: string; // Telegram message ID (unique per chatId, not globally)

  @Column({ type: 'bigint', nullable: true })
  chatId: string | null; // Telegram chat ID

  // ==== НАПРАВЛЕНИЕ ====
  @Column({ type: 'varchar', length: 20 })
  direction: string; // 'incoming' | 'outgoing'

  // ==== СОДЕРЖАНИЕ ====
  @Column({ type: 'text', nullable: true })
  text: string | null; // Текст сообщения

  @Column({ type: 'varchar', length: 50, nullable: true })
  messageType: string | null; // 'text', 'photo', 'document', 'voice', 'video', etc.

  // ==== ВЛОЖЕНИЯ ====
  @Column({ type: 'jsonb', nullable: true })
  attachments: Array<{
    type: string; // 'photo', 'document', 'voice', 'video'
    fileId: string;
    fileUniqueId: string;
    fileName?: string;
    fileSize?: number;
    url?: string; // URL для скачивания
  }> | null;

  // ==== СВЯЗЬ С КОНТАКТАМИ/КОМПАНИЯМИ ====
  @Column({ type: 'uuid', nullable: true })
  linkedContactId: string | null; // Связь с Contact (если есть)

  @Column({ type: 'uuid', nullable: true })
  linkedCompanyId: string | null; // Связь с Company

  @Column({ type: 'uuid', nullable: true })
  linkedLeadId: string | null; // Связь с Lead

  @Column({ type: 'uuid', nullable: true })
  linkedSaleId: string | null; // Связь с Sale

  // ==== МЕТАДАННЫЕ ====
  @Column({ type: 'timestamp' })
  date: Date; // Дата сообщения

  @Column({ type: 'boolean', default: false })
  isRead: boolean; // Прочитано

  @Column({ type: 'jsonb', nullable: true })
  rawData: any | null; // Полные данные от Telegram API

  // ==== META ====
  @Column({ type: 'jsonb', nullable: true })
  meta: any | null;

  // ==== AUDIT ====
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}













