// src/email/email-template.entity.ts
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
 * Шаблоны писем для маркетинга
 */
@Entity('email_templates')
@Index(['tenantId', 'name'])
export class EmailTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==== MULTI-TENANT ====
  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // ==== ОСНОВНАЯ ИНФОРМАЦИЯ ====
  @Column({ type: 'varchar', length: 255 })
  name: string; // Название шаблона

  @Column({ type: 'text', nullable: true })
  description: string | null; // Описание

  @Column({ type: 'varchar', length: 255, nullable: true })
  subject: string | null; // Тема письма (может содержать переменные {{lead.name}})

  // ==== СОДЕРЖАНИЕ ====
  @Column({ type: 'text', nullable: true })
  htmlBody: string | null; // HTML содержимое

  @Column({ type: 'text', nullable: true })
  textBody: string | null; // Текстовая версия (plain text)

  // ==== МЕТАДАННЫЕ ====
  @Column({ type: 'jsonb', nullable: true })
  meta: {
    // Метаданные для шаблона
    variables?: string[]; // Доступные переменные
    category?: string; // Категория (marketing, transactional, etc.)
    tags?: string[]; // Теги
    previewImage?: string; // URL превью изображения
    [key: string]: any;
  } | null;

  // ==== СТАТУС ====
  @Column({ type: 'boolean', default: true })
  isActive: boolean; // Активен ли шаблон

  /**
   * Оборачивать ли htmlBody/textBody в единый дизайн компании (tenant.aiWrapperEmailTemplateId
   * или встроенный дизайн) при отправке через автоматизации/ИИ. false для шаблонов, которые сами
   * являются полноценным HTML-документом (созданы до появления обёртки).
   */
  @Column({ type: 'boolean', default: false })
  useWrapper: boolean;

  // ==== AUDIT ====
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}













