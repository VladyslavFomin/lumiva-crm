// src/notes/note.entity.ts
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
 * Универсальные заметки с привязкой к разным сущностям
 * Поддерживает: Contact, Company, Lead, Sale, Project
 */
@Entity('notes')
@Index(['tenantId', 'entityType', 'entityId'])
@Index(['tenantId', 'createdAt'])
export class Note {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==== MULTI-TENANT ====
  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // ==== ПРИВЯЗКА К СУЩНОСТИ ====
  @Column({ type: 'varchar', length: 50 })
  entityType: string; // 'contact', 'company', 'lead', 'sale', 'project'

  @Column({ type: 'uuid' })
  entityId: string; // ID связанной сущности

  // ==== СОДЕРЖАНИЕ ====
  @Column({ type: 'text' })
  content: string; // Текст заметки

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null; // Заголовок (опционально)

  // ==== ТИП ЗАМЕТКИ ====
  @Column({ type: 'varchar', length: 50, default: 'note' })
  type: string; // 'note', 'call', 'meeting', 'email', 'task', 'reminder'

  // ==== МЕТАДАННЫЕ ====
  @Column({ type: 'jsonb', nullable: true })
  metadata: any | null; // Дополнительные данные (например, для call: duration, для email: subject)

  // ==== АВТОР ====
  @Column({ type: 'uuid', nullable: true })
  createdById: string | null; // ID пользователя, создавшего заметку

  @Column({ type: 'varchar', length: 255, nullable: true })
  createdBy: string | null; // Имя автора

  // ==== ПРИВАТНОСТЬ ====
  @Column({ type: 'boolean', default: false })
  isPrivate: boolean; // Приватная заметка (видна только автору)

  // ==== ТЕГИ ====
  @Column({ type: 'text', array: true, default: [] })
  tags: string[];

  // ==== AUDIT ====
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}













