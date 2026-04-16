// src/custom-fields/custom-field.entity.ts
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
 * Схема кастомных полей для разных сущностей
 */
export enum EntityType {
  CONTACT = 'contact',
  COMPANY = 'company',
  LEAD = 'lead',
  SALE = 'sale',
  PROJECT = 'project',
}

export enum FieldType {
  TEXT = 'text',
  NUMBER = 'number',
  EMAIL = 'email',
  PHONE = 'phone',
  DATE = 'date',
  DATETIME = 'datetime',
  BOOLEAN = 'boolean',
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  TEXTAREA = 'textarea',
  URL = 'url',
}

@Entity('custom_fields')
@Index(['tenantId', 'entityType', 'key'], { unique: true })
export class CustomField {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==== MULTI-TENANT ====
  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // ==== ОСНОВНЫЕ ДАННЫЕ ====
  @Column({ type: 'varchar', length: 50 })
  entityType: string; // 'contact', 'company', 'lead', 'sale', 'project'

  @Column({ type: 'varchar', length: 100 })
  key: string; // Уникальный ключ поля (например: 'custom_phone_2')

  @Column({ type: 'varchar', length: 255 })
  label: string; // Отображаемое название

  @Column({ type: 'varchar', length: 50 })
  type: string; // 'text', 'number', 'email', 'date', 'boolean', 'select', etc.

  // ==== ВАЛИДАЦИЯ ====
  @Column({ type: 'boolean', default: false })
  required: boolean; // Обязательное поле

  @Column({ type: 'text', nullable: true })
  placeholder: string | null; // Placeholder текст

  @Column({ type: 'text', nullable: true })
  helpText: string | null; // Подсказка

  // ==== ОПЦИИ ДЛЯ SELECT/MULTISELECT ====
  @Column({ type: 'jsonb', nullable: true })
  options: Array<{ value: string; label: string }> | null;

  // ==== ДЕФОЛТНОЕ ЗНАЧЕНИЕ ====
  @Column({ type: 'text', nullable: true })
  defaultValue: string | null;

  // ==== ПОРЯДОК ОТОБРАЖЕНИЯ ====
  @Column({ type: 'integer', default: 0 })
  order: number; // Порядок сортировки

  // ==== ВИДИМОСТЬ ====
  @Column({ type: 'boolean', default: true })
  isActive: boolean; // Активно ли поле

  // ==== META ====
  @Column({ type: 'jsonb', nullable: true })
  meta: any | null;

  // ==== AUDIT ====
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}













