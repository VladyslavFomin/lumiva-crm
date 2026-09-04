// src/projects/project.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Lead } from '../leads/lead.entity';
import { Company } from '../companies/company.entity';
import { Contact } from '../contacts/contact.entity';
import { ProjectTable } from '../project-tables/project-table.entity';

export type ProjectFileProvider = 'google_drive' | 'onedrive' | 'other';

export interface ProjectFileLink {
  id: string;
  label: string;
  url: string;
  provider: ProjectFileProvider;
  createdAt: string;
}

export type ProjectStatus =
  | 'Новый'
  | 'В работе'
  | 'На проверке'
  | 'Заморожен'
  | 'Закрыт'
  | 'Выиграно'
  | 'Проиграно';

@Entity('crm_projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==== MULTI-TENANT ====
  @ManyToOne(() => Tenant, (t) => t.id, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  // ==== ТАБЛИЦА (отдельный, шарируемый набор проектов) ====
  @ManyToOne(() => ProjectTable, { nullable: true })
  @JoinColumn({ name: 'table_id' })
  table: ProjectTable | null;

  @Column({ name: 'table_id', type: 'uuid', nullable: true })
  tableId: string | null;

  // ==== СВЯЗЬ С ЛИДОМ ====
  @ManyToOne(() => Lead, (lead) => lead.projects, { nullable: true })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead | null;

  @Column({ name: 'lead_id', nullable: true })
  leadId: string | null;

  // ==== СВЯЗЬ С КОМПАНИЕЙ ====
  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string | null;

  @ManyToOne(() => Company, (company) => company.projects, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'company_id' })
  company: Company | null;

  // ==== СВЯЗЬ С КОНТАКТОМ ====
  @Column({ name: 'contact_id', type: 'uuid', nullable: true })
  contactId: string | null;

  @ManyToOne(() => Contact, (contact) => contact.projects, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'contact_id' })
  contact: Contact | null;

  // ==== ОСНОВНЫЕ ПОЛЯ ====
  @Column({ length: 255 })
  name: string; // Название

  @Column({ type: 'text', nullable: true })
  description: string | null; // Описание

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  amount: string; // Сумма в валюте проекта (numeric → string в JS)

  @Column({ type: 'char', length: 3, default: 'EUR' })
  currency: string; // EUR / USD / TRY ...

  @Column({ type: 'varchar', length: 32 })
  status: ProjectStatus; // Статус

  @Column({ type: 'varchar', length: 128, nullable: true })
  category: string | null; // Категория (справочник)

  // simple-array = комма-разделённый список в text колонке
  @Column({ type: 'simple-array', nullable: true })
  tags: string[] | null; // Метки (#crm, #lux, ...)

  // ==== ОТВЕТСТВЕННЫЙ ====
  @Column({ type: 'varchar', length: 255, nullable: true })
  ownerName: string | null; // Имя ответственного менеджера (пока просто текст)

  @Column({ type: 'uuid', nullable: true })
  ownerUserId: string | null; // В будущем связь с таблицей пользователей

  @Column({ type: 'uuid', array: true, nullable: true })
  ownerUserIds: string[] | null; // Multiple owners

  // ==== СВЯЗАННЫЕ ПРОЕКТЫ (простая реализация) ====
  @Column({ type: 'simple-array', nullable: true })
  relatedProjectIds: string[] | null; // id других проектов

  // ==== FILE META (ТЗ / СМЕТА / ДОГОВОР) — устаревшее одиночное поле, оставлено для совместимости ====
  @Column({ type: 'varchar', length: 512, nullable: true })
  briefFileName: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  briefFileUrl: string | null;

  // ==== FILES (список ссылок: ТЗ / смета / договор и т.д., с провайдером для иконки) ====
  @Column({ type: 'jsonb', nullable: true })
  files: ProjectFileLink[] | null;

  // ==== ЗАДАЧИ ПРОЕКТА ====
  @Column({ type: 'simple-json', nullable: true })
  tasks: any[] | null; // Массив задач (хранится как JSON)

  @Column({ type: 'jsonb', nullable: true })
  comments: any[] | null;

  // ==== CUSTOM FIELDS ====
  @Column({ type: 'jsonb', nullable: true })
  customFields: Record<string, any> | null;
  
  // ==== AUDIT ====
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // archive
  @Column({ type: 'boolean', default: false, name: 'is_archived' })
  isArchived: boolean;

  @Column({ type: 'timestamp', name: 'archived_at', nullable: true })
  archivedAt: Date | null;

  // soft delete
  @Column({ type: 'boolean', default: false, name: 'is_deleted' })
  isDeleted: boolean;

  @Column({ type: 'timestamp', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}