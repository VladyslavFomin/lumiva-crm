// src/leads/lead.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Site } from '../sites/site.entity';
import { LeadActivity } from './lead-activity.entity';
import { Project } from '../projects/project.entity';
import { Company } from '../companies/company.entity';
import { Contact } from '../contacts/contact.entity';
import { Reservation } from '../bookings/reservation.entity';

export interface LeadTask {
  id: string;
  title: string;
  done: boolean;
  deadline: string | null;
}

export interface LeadComment {
  id: string;
  author: string;
  createdAt: string;
  text: string;
  mentions?: string[];
  parentId?: string | null;
  likedBy?: string[];
}

@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==== MULTI-TENANT ====
  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.leads, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // ==== САЙТ (источник) ====
  @Column({ type: 'uuid', nullable: true })
  siteId: string | null;

  @ManyToOne(() => Site, (site) => site.leads, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'siteId' })
  site: Site | null;

  // ==== СВЯЗЬ С КОНТАКТОМ ====
  @Column({ type: 'uuid', nullable: true })
  contactId: string | null;

  @ManyToOne(() => Contact, (contact) => contact.leads, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'contactId' })
  contact: Contact | null;

  // ==== СВЯЗЬ С КОМПАНИЕЙ ====
  @Column({ type: 'uuid', nullable: true })
  companyId: string | null;

  @ManyToOne(() => Company, (company) => company.leads, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'companyId' })
  company: Company | null;

  // ==== СВЯЗЬ С ПРОЕКТАМИ ====
  @OneToMany(() => Project, (p) => p.lead, { cascade: false })
  projects: Project[];

  // ==== СВЯЗЬ С БРОНИРОВАНИЯМИ ====
  @OneToMany(() => Reservation, (r) => r.lead, { cascade: false })
  reservations: Reservation[];

  // ==== ДАННЫЕ ЛИДА ====
  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  country: string | null; // ISO-код

  @Column({ type: 'varchar', length: 32, default: 'new' })
  status: string; // new, in_progress, waiting, won, lost

  @Column({ type: 'varchar', length: 64, nullable: true })
  source: string | null; // form, chat, wc, api, crm...

  // ==== UTM ====
  @Column({ type: 'varchar', length: 128, nullable: true })
  utmSource: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  utmMedium: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  utmCampaign: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  utmContent: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  utmTerm: string | null;

  // ==== ОТВЕТСТВЕННЫЙ ====
  // ID сотрудника (StaffUser.id)
  @Column({ type: 'uuid', nullable: true })
  assignedUserId: string | null;

  // IDs сотрудников (multiple assignees)
  @Column({ type: 'uuid', array: true, nullable: true })
  assignedUserIds: string[] | null;

  // Читаемое имя ответственного (для быстрых списков)
  @Column({ type: 'varchar', length: 255, nullable: true })
  assignedTo: string | null;

  // Список имён ответственных (для детальных форм)
  @Column({ type: 'jsonb', nullable: true })
  assignedToList: string[] | null;

  // ==== META ====
  @Column({ type: 'jsonb', nullable: true })
  meta: any | null;

  // ==== CUSTOM FIELDS ====
  @Column({ type: 'jsonb', nullable: true })
  customFields: Record<string, any> | null;

  // ==== СДЕЛКА ====
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  amount: string; // numeric → string в JS, как у Project.amount

  @Column({ type: 'char', length: 3, default: 'TRY' })
  currency: string;

  @Column({ type: 'jsonb', nullable: true })
  tasks: LeadTask[] | null; // лёгкий чек-лист шагов (прогресс + «следующий шаг»)

  // ==== КОММЕНТАРИИ (с упоминаниями/лайками/ответами — как у Project.comments) ====
  @Column({ type: 'jsonb', nullable: true })
  comments: LeadComment[] | null;

  /** Посчитано в LeadsService.listForTenant, не хранится в БД. */
  commentsCount?: number;

  /** Посчитано в LeadsController для текущего пользователя, не хранится в БД — см.
   * LeadAccessService. 'owner' покрывает и полный доступ (owner/manager/руководитель отдела),
   * и назначенные лиды. */
  myAccessTier?: 'none' | 'viewer' | 'analyst' | 'editor' | 'owner';
  canViewAnalytics?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canReassign?: boolean;

  // ==== ACTIVITY ====
  @OneToMany(() => LeadActivity, (a) => a.lead)
  activity: LeadActivity[];

  // ==== AUDIT ====
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Only ever set by deduplication merges (see DeduplicationService) — required for
  // repo.softDelete()/restore() to work at all (TypeORM throws MissingDeleteDateColumnError
  // without it). Standard find()/count() calls exclude soft-deleted rows automatically.
  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt?: Date | null;
}
