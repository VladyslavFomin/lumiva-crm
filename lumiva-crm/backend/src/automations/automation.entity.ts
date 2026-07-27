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

  /** Действия по расписанию (расписание в meta.schedule, как у отчётов) */
  SCHEDULED = 'scheduled',

  // Custom objects (no-code tables)
  CUSTOM_OBJECT_RECORD_CREATED = 'custom_object.record_created',
  CUSTOM_OBJECT_RECORD_UPDATED = 'custom_object.record_updated',
  CUSTOM_OBJECT_STATUS_CHANGED = 'custom_object.status_changed',

  // Shopify
  SHOPIFY_PAYMENT_RECEIVED = 'shopify.payment_received',

  // Бронирования (Booking)
  BOOKING_RESERVATION_CREATED = 'booking.reservation_created',
  BOOKING_RESERVATION_STATUS_CHANGED = 'booking.reservation_status_changed',
  BOOKING_RESERVATION_RESCHEDULED = 'booking.reservation_rescheduled',
  BOOKING_WAITLIST_ENTRY_CREATED = 'booking.waitlist_entry_created',

  // Отели (Hotels / Система резервации)
  HOTEL_RESERVATION_CREATED = 'hotel.reservation_created',
  HOTEL_RESERVATION_STATUS_CHANGED = 'hotel.reservation_status_changed',
  HOTEL_PRICE_CHANGED = 'hotel.price_changed',
  HOTEL_STOP_SALE_SET = 'hotel.stop_sale_set',
  HOTEL_LOW_AVAILABILITY = 'hotel.low_availability',
}

export enum ActionType {
  // Задачи
  CREATE_TASK = 'create_task',
  ASSIGN_TASK = 'assign_task',
  
  // Уведомления
  SEND_EMAIL = 'send_email',
  SEND_TELEGRAM = 'send_telegram',
  /** Slack Incoming Webhook (подключение third_party_link catalog slack) или webhookUrl в конфиге */
  SEND_SLACK = 'send_slack',
  /** Microsoft Teams Incoming Webhook (third_party_link · ms_teams) */
  SEND_TEAMS = 'send_teams',
  /** Mailchimp Marketing API — подписка в аудитории (third_party_link · mailchimp) */
  SEND_MAILCHIMP = 'send_mailchimp',
  /** Mailchimp Marketing API — разовая email-кампания всей аудитории (list), create + content + send */
  SEND_MAILCHIMP_CAMPAIGN = 'send_mailchimp_campaign',
  /** Zapier Catch Hook (third_party_link · zapier) */
  SEND_ZAPIER = 'send_zapier',
  /** WhatsApp Cloud API (third_party_link · whatsapp) */
  SEND_WHATSAPP = 'send_whatsapp',
  /** SMS через Twilio / SMSC.ru / SMS.ru (настройки в sms_configs) */
  SEND_SMS = 'send_sms',
  /** Google Calendar — событие по OAuth-токену (third_party_link · google_calendar) */
  SEND_GOOGLE_CALENDAR = 'send_google_calendar',
  /** Microsoft 365 / Outlook — событие в календаре (third_party_link · outlook) */
  SEND_OUTLOOK_CALENDAR = 'send_outlook_calendar',
  /** Битрикс24 — вызов REST по входящему вебхуку (third_party_link · bitrix) */
  SEND_BITRIX = 'send_bitrix',
  /** amoCRM — запрос API v4 (third_party_link · amocrm) */
  SEND_AMOCRM = 'send_amocrm',
  /** HubSpot — запрос CRM API (third_party_link · hubspot) */
  SEND_HUBSPOT = 'send_hubspot',
  /** Google Ads API (third_party_link · google_ads) */
  SEND_GOOGLE_ADS = 'send_google_ads',
  /** Meta Marketing API / Graph (third_party_link · meta_ads) */
  SEND_META_ADS = 'send_meta_ads',
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

  /** Отправка результата предыдущего шага (JSON / XLSX / PDF) на email или в Telegram */
  SEND_DATA_EXPORT = 'send_data_export',

  /** Копирование строки из пользовательской таблицы (триггер custom_object.*) в другую таблицу */
  CREATE_CUSTOM_OBJECT_RECORD = 'create_custom_object_record',
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
