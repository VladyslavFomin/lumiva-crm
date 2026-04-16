// src/email/email-message.entity.ts
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
import { EmailAccount } from './email-account.entity';

/**
 * Email сообщения (входящие и исходящие)
 */
@Entity('email_messages')
@Index(['tenantId', 'messageId']) // messageId - уникальный ID письма от провайдера
@Index(['tenantId', 'accountId', 'date'])
@Index(['tenantId', 'contactId'])
export class EmailMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==== MULTI-TENANT ====
  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // ==== СВЯЗЬ С АККАУНТОМ ====
  @Column({ type: 'uuid' })
  accountId: string;

  @ManyToOne(() => EmailAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account: EmailAccount;

  /** Папка в CRM (иерархия, перетаскивание); системные inbox/sent/trash */
  @Column({ type: 'uuid', nullable: true })
  crmFolderId: string | null;

  // ==== ID ПИСЬМА ОТ ПРОВАЙДЕРА ====
  @Column({ type: 'varchar', length: 255, unique: true })
  messageId: string; // Уникальный ID от email провайдера

  @Column({ type: 'varchar', length: 255, nullable: true })
  threadId: string | null; // ID треда (для группировки)

  // ==== НАПРАВЛЕНИЕ ====
  @Column({ type: 'varchar', length: 20 })
  direction: string; // 'incoming' | 'outgoing'

  // ==== ОТПРАВИТЕЛЬ/ПОЛУЧАТЕЛЬ ====
  @Column({ type: 'varchar', length: 255 })
  from: string; // Email отправителя

  @Column({ type: 'varchar', length: 255, nullable: true })
  fromName: string | null; // Имя отправителя

  @Column({ type: 'text', array: true, default: [] })
  to: string[]; // Email получателей

  @Column({ type: 'text', array: true, default: [] })
  cc: string[]; // CC

  @Column({ type: 'text', array: true, default: [] })
  bcc: string[]; // BCC

  // ==== СОДЕРЖАНИЕ ====
  @Column({ type: 'varchar', length: 500, nullable: true })
  subject: string | null;

  @Column({ type: 'text', nullable: true })
  textBody: string | null; // Текстовое тело

  @Column({ type: 'text', nullable: true })
  htmlBody: string | null; // HTML тело

  // ==== ВЛОЖЕНИЯ ====
  @Column({ type: 'jsonb', nullable: true })
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
    url?: string; // URL для скачивания (если храним отдельно)
  }> | null;

  // ==== СВЯЗЬ С КОНТАКТАМИ/КОМПАНИЯМИ ====
  @Column({ type: 'uuid', nullable: true })
  contactId: string | null; // Связь с Contact

  @Column({ type: 'uuid', nullable: true })
  companyId: string | null; // Связь с Company

  @Column({ type: 'uuid', nullable: true })
  leadId: string | null; // Связь с Lead

  @Column({ type: 'uuid', nullable: true })
  saleId: string | null; // Связь с Sale

  // ==== МЕТАДАННЫЕ ====
  @Column({ type: 'timestamp' })
  date: Date; // Дата письма

  @Column({ type: 'boolean', default: false })
  isRead: boolean; // Прочитано

  @Column({ type: 'boolean', default: false })
  isStarred: boolean; // Помечено звездочкой

  @Column({ type: 'text', array: true, default: [] })
  labels: string[]; // Метки (Gmail labels)

  @Column({ type: 'jsonb', nullable: true })
  headers: any | null; // Email headers

  // ==== META ====
  @Column({ type: 'jsonb', nullable: true })
  meta: any | null;

  // ==== AUDIT ====
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}













