// src/sales/sale.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SalesChannel } from '../sales-channels/sales-channel.entity';
import { Lead } from '../leads/lead.entity';
import { Project } from '../projects/project.entity';
import { Contact } from '../contacts/contact.entity';

// если у тебя уже есть ./sale-status.enum.ts — можешь импортировать оттуда
export type SaleStatus =
  | 'new'
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'refunded'
  | 'other';

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ───── СВЯЗИ ───── */
  @Column({ type: 'uuid', nullable: true })
  tenantId: string | null;
  
  @ManyToOne(() => SalesChannel, (ch) => ch.sales, { nullable: true })
  @JoinColumn({ name: 'channel_id' })
  channel: SalesChannel | null;

  @Column({ type: 'uuid', name: 'channel_id', nullable: true })
  channelId: string | null;

  @ManyToOne(() => Lead, { nullable: true })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead | null;

  @Column({ type: 'uuid', name: 'lead_id', nullable: true })
  leadId: string | null;

  @ManyToOne(() => Project, { nullable: true })
  @JoinColumn({ name: 'project_id' })
  project: Project | null;

  @ManyToOne(() => Contact, { nullable: true })
  @JoinColumn({ name: 'contact_id' })
  contact: Contact | null;

  @Column({ type: 'uuid', name: 'contact_id', nullable: true })
  contactId: string | null;

  @Column({ type: 'uuid', name: 'project_id', nullable: true })
  projectId: string | null;

  /* ───── ИДЕНТИФИКАТОРЫ ИЗ ВНЕШНИХ СИСТЕМ ───── */

  // Используется в поиске: externalId ILIKE ...
  @Column({
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  externalId: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  externalOrderNo: string | null;

  /* ───── ОСНОВНЫЕ ПОЛЯ ПРОДАЖИ ───── */

  // Дата продажи / брони — именно по ней фильтрует сервис (saleDate)
  @Column({ type: 'timestamptz', nullable: true })
  saleDate: Date | null;

  // Имя гостя (если есть)
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  guestName: string | null;

  // Агент / партнёр — используется в поиске (agentName ILIKE ...)
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  agentName: string | null;

  // Отель / объект размещения — используется в поиске (hotel ILIKE ...)
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  hotel: string | null;

  // Рынок / страна (market ILIKE ...)
  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  market: string | null;

  // Сумма
  @Column({
    type: 'double precision',
    default: 0,
  })
  amount: number;

  // Валюта
  @Column({
    type: 'varchar',
    length: 8,
    default: 'EUR',
  })
  currency: string;

  // Статус продажи (используется в stats и list)
  @Column({
    type: 'varchar',
    length: 32,
    default: 'other',
  })
  status: SaleStatus;

  // Даты заезда / выезда — пригодятся для отчётов, можно использовать позже
  @Column({ type: 'timestamptz', nullable: true })
  checkInAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  checkOutAt: Date | null;

  /* ───── ДОПОЛНИТЕЛЬНОЕ ОПИСАНИЕ ───── */

  // Ответственный менеджер (обновляется в update())
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  managerName: string | null;

  // Заметки по продаже (обновляются в update())
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /* ───── СЫРОЙ PAYLOAD И ТЕХ. ПОЛЯ ───── */

  @Column({ type: 'jsonb', nullable: true })
  rawPayload: any;

  @Column({ type: 'jsonb', nullable: true })
  customFields: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}