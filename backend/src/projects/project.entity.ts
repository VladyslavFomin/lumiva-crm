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

export type ProjectStatus =
  | 'Новый'
  | 'В работе'
  | 'На проверке'
  | 'Заморожен'
  | 'Закрыт';

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

  // ==== СВЯЗЬ С ЛИДОМ ====
  @ManyToOne(() => Lead, (lead) => lead.projects, { nullable: true })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead | null;

  @Column({ name: 'lead_id', nullable: true })
  leadId: string | null;

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

  // ==== СВЯЗАННЫЕ ПРОЕКТЫ (простая реализация) ====
  @Column({ type: 'simple-array', nullable: true })
  relatedProjectIds: string[] | null; // id других проектов

  // ==== FILE META (ТЗ / СМЕТА / ДОГОВОР) ====
  @Column({ type: 'varchar', length: 512, nullable: true })
  briefFileName: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  briefFileUrl: string | null;

  // ==== ЗАДАЧИ ПРОЕКТА ====
  @Column({ type: 'simple-json', nullable: true })
  tasks: any[] | null; // Массив задач (хранится как JSON)

  @Column({ type: 'jsonb', nullable: true })
  comments: any[] | null;
  
  // ==== AUDIT ====
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // soft delete
  @Column({ type: 'boolean', default: false, name: 'is_deleted' })
  isDeleted: boolean;

  @Column({ type: 'timestamp', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}