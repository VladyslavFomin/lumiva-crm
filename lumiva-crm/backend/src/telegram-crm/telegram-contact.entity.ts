// src/telegram-crm/telegram-contact.entity.ts
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
 * Telegram контакты для CRM
 * Связывает Telegram пользователей с контактами/компаниями
 */
@Entity('telegram_contacts')
@Index(['tenantId', 'telegramUserId'])
@Index(['tenantId', 'contactId'])
export class TelegramContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==== MULTI-TENANT ====
  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // ==== TELEGRAM ДАННЫЕ ====
  @Column({ type: 'bigint' })
  telegramUserId: string; // Telegram user ID (bigint)

  @Column({ type: 'varchar', length: 255, nullable: true })
  telegramUsername: string | null; // @username

  @Column({ type: 'varchar', length: 255, nullable: true })
  telegramFirstName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  telegramLastName: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  telegramPhone: string | null;

  // ==== ЧЕРЕЗ КАКОГО БОТА ПОСЛЕДНИЙ РАЗ ПИСАЛИ (нужно для ответа из инбокса) ====
  @Column({ type: 'uuid', nullable: true })
  botId: string | null;

  // ==== СВЯЗЬ С КОНТАКТОМ ====
  @Column({ type: 'uuid', nullable: true })
  contactId: string | null; // Связь с Contact

  @Column({ type: 'uuid', nullable: true })
  companyId: string | null; // Связь с Company

  @Column({ type: 'uuid', nullable: true })
  leadId: string | null; // Связь с Lead

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













