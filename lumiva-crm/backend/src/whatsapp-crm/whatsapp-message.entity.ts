// src/whatsapp-crm/whatsapp-message.entity.ts
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
import { WhatsappContact } from './whatsapp-contact.entity';

/**
 * WhatsApp сообщения для CRM
 */
@Entity('whatsapp_messages')
@Index(['tenantId', 'waMessageId'])
@Index(['tenantId', 'contactId', 'date'])
export class WhatsappMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==== MULTI-TENANT ====
  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // ==== СВЯЗЬ С WHATSAPP КОНТАКТОМ ====
  @Column({ type: 'uuid' })
  contactId: string;

  @ManyToOne(() => WhatsappContact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contactId' })
  contact: WhatsappContact;

  // ==== ЧЕРЕЗ КАКОЕ ПОДКЛЮЧЕНИЕ ====
  @Column({ type: 'uuid', nullable: true })
  connectionId: string | null;

  // ==== WHATSAPP ДАННЫЕ ====
  @Column({ type: 'varchar', length: 128, nullable: true })
  waMessageId: string | null; // wamid из Meta Cloud API

  // ==== НАПРАВЛЕНИЕ ====
  @Column({ type: 'varchar', length: 20 })
  direction: string; // 'incoming' | 'outgoing'

  // ==== СОДЕРЖАНИЕ ====
  @Column({ type: 'text', nullable: true })
  text: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  messageType: string | null; // 'text', 'image', 'document', 'audio', 'video', 'sticker', 'location', etc.

  @Column({ type: 'jsonb', nullable: true })
  attachments: Array<{
    type: string;
    id?: string; // media id из Meta (нужен отдельный GET /{media-id} для скачивания, не публичный URL)
    mimeType?: string;
    caption?: string;
  }> | null;

  // ==== СВЯЗЬ С КОНТАКТАМИ/КОМПАНИЯМИ ====
  @Column({ type: 'uuid', nullable: true })
  linkedContactId: string | null;

  @Column({ type: 'uuid', nullable: true })
  linkedCompanyId: string | null;

  @Column({ type: 'uuid', nullable: true })
  linkedLeadId: string | null;

  @Column({ type: 'uuid', nullable: true })
  linkedSaleId: string | null;

  // ==== МЕТАДАННЫЕ ====
  @Column({ type: 'timestamptz' })
  date: Date;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'jsonb', nullable: true })
  rawData: any | null;

  // ==== AUDIT ====
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
