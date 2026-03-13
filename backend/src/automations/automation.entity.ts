// src/automations/automation.entity.ts
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
 * Rule-based автоматизации
 * IF/THEN логика для различных событий
 */

export enum TriggerEvent {
  // Контакты
  CONTACT_CREATED = 'contact.created',
  CONTACT_UPDATED = 'contact.updated',
  CONTACT_TAG_ADDED = 'contact.tag_added',
  
  // Компании
  COMPANY_CREATED = 'company.created',
  COMPANY_UPDATED = 'company.updated',
  
  // Лиды
  LEAD_CREATED = 'lead.created',
  LEAD_UPDATED = 'lead.updated',
  LEAD_STATUS_CHANGED = 'lead.status_changed',
  LEAD_ASSIGNED = 'lead.assigned',
  
  // Сделки
  SALE_CREATED = 'sale.created',
  SALE_UPDATED = 'sale.updated',
  SALE_STATUS_CHANGED = 'sale.status_changed',
  
  // Проекты
  PROJECT_CREATED = 'project.created',
  PROJECT_STATUS_CHANGED = 'project.status_changed',

  // Задачи
  TASK_CREATED = 'task.created',
  TASK_UPDATED = 'task.updated',
  TASK_STATUS_CHANGED = 'task.status_changed',
  
  // Email
  EMAIL_RECEIVED = 'email.received',
  EMAIL_SENT = 'email.sent',
  
  // Telegram
  TELEGRAM_MESSAGE_RECEIVED = 'telegram.message_received',
  
  // Заметки
  NOTE_CREATED = 'note.created',

  // Отчёты по расписанию
  REPORT_SCHEDULED = 'report.scheduled',
}

export enum ActionType {
  // Задачи
  CREATE_TASK = 'create_task',
  ASSIGN_TASK = 'assign_task',
  
  // Уведомления
  SEND_EMAIL = 'send_email',
  SEND_TELEGRAM = 'send_telegram',
  SEND_NOTIFICATION = 'send_notification',
  
  // Обновления
  UPDATE_FIELD = 'update_field',
  ADD_TAG = 'add_tag',
  REMOVE_TAG = 'remove_tag',
  CHANGE_STATUS = 'change_status',
  ASSIGN_USER = 'assign_user',
  
  // Webhook
  TRIGGER_WEBHOOK = 'trigger_webhook',
  
  // Заметки
  CREATE_NOTE = 'create_note',

  // Отчёты
  SEND_REPORT = 'send_report',
}

@Entity('automations')
@Index(['tenantId', 'isActive'])
@Index(['tenantId', 'triggerEvent'])
export class Automation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==== MULTI-TENANT ====
  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // ==== ОСНОВНЫЕ ДАННЫЕ ====
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // ==== ТРИГГЕР (IF) ====
  @Column({ type: 'varchar', length: 100 })
  triggerEvent: string; // Событие, которое запускает автоматизацию

  // ==== УСЛОВИЯ (IF условия) ====
  @Column({ type: 'jsonb', nullable: true })
  conditions: Array<{
    field: string; // Поле для проверки
    operator: string; // 'equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'
    value?: any; // Значение для сравнения (опционально для операторов is_empty, is_not_empty)
  }> | null;

  // ==== ДЕЙСТВИЯ (THEN) ====
  @Column({ 
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  actions: Array<{
    type: string; // Тип действия
    config: Record<string, any>; // Конфигурация действия
  }>;

  // ==== СТАТУС ====
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'integer', default: 0 })
  executionCount: number; // Количество выполнений

  @Column({ type: 'integer', default: 0 })
  errorCount: number; // Количество ошибок

  @Column({ type: 'timestamp', nullable: true })
  lastExecutedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  // ==== ОГРАНИЧЕНИЯ ====
  @Column({ type: 'integer', nullable: true })
  maxExecutions: number | null; // Максимум выполнений (null = без ограничений)

  @Column({ type: 'integer', nullable: true })
  cooldownSeconds: number | null; // Задержка между выполнениями (в секундах)

  // ==== META ====
  @Column({ type: 'jsonb', nullable: true })
  meta: any | null;

  // ==== AUDIT ====
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
