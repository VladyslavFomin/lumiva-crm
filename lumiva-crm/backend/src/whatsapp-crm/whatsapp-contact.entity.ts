// src/whatsapp-crm/whatsapp-contact.entity.ts
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
 * WhatsApp контакты для CRM
 * Связывает WhatsApp-номера с контактами/компаниями/лидами
 */
@Entity('whatsapp_contacts')
@Index(['tenantId', 'waPhoneDigits'])
@Index(['tenantId', 'connectionId'])
export class WhatsappContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==== MULTI-TENANT ====
  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // ==== ЧЕРЕЗ КАКОЕ ПОДКЛЮЧЕНИЕ (IntegrationConnection, catalogId='whatsapp') ====
  @Column({ type: 'uuid', nullable: true })
  connectionId: string | null;

  // ==== WHATSAPP ДАННЫЕ ====
  @Column({ type: 'varchar', length: 32 })
  waPhoneDigits: string; // Номер без "+", как приходит в webhook.from

  @Column({ type: 'varchar', length: 255, nullable: true })
  waProfileName: string | null; // profile.name из WhatsApp

  // ==== СВЯЗЬ С КОНТАКТОМ ====
  @Column({ type: 'uuid', nullable: true })
  contactId: string | null;

  @Column({ type: 'uuid', nullable: true })
  companyId: string | null;

  @Column({ type: 'uuid', nullable: true })
  leadId: string | null;

  // ==== СТАТУС ====
  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: string; // active, blocked, archived

  // ==== META ====
  @Column({ type: 'jsonb', nullable: true })
  meta: any | null;

  // ==== AUDIT ====
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
