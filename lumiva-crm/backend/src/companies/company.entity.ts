// src/companies/company.entity.ts
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
  Index,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Contact } from '../contacts/contact.entity';
import { Lead } from '../leads/lead.entity';
import { Project } from '../projects/project.entity';

@Entity('companies')
@Index(['tenantId', 'name'])
@Index(['tenantId', 'website'])
export class Company {
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

  @Column({ type: 'varchar', length: 255, nullable: true })
  legalName: string | null; // Юридическое название

  @Column({ type: 'varchar', length: 50, nullable: true })
  taxId: string | null; // ИНН / Tax ID

  /**
   * Структурированный список юр./банковских реквизитов клиента ({ id, type, value }[], см.
   * src/common/legal-requisites.ts) — используется в документах («Мои документы») как
   * {COMPANY_REQUISITES}. Тип выбирается из каталога, сгруппированного по направлению
   * (СНГ/Турция/Европа/Общие: ИНН, БИК, IBAN, ФИО директора, действует на основании и т.п.).
   */
  @Column({ type: 'jsonb', nullable: true })
  legalRequisites: { id: string; type: string; value: string }[] | null;

  // ==== КОНТАКТНАЯ ИНФОРМАЦИЯ ====
  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website: string | null;

  // ==== АДРЕС ====
  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null; // Страна: название или ISO-код

  @Column({ type: 'varchar', length: 255, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  state: string | null; // Регион / штат

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  postalCode: string | null;

  // ==== ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ ====
  @Column({ type: 'varchar', length: 50, nullable: true })
  industry: string | null; // Отрасль

  @Column({ type: 'varchar', length: 50, nullable: true })
  size: string | null; // Размер компании (1-10, 11-50, 51-200, 201-500, 500+)

  @Column({ type: 'varchar', length: 50, nullable: true })
  type: string | null; // Тип (customer, partner, vendor, competitor, other)

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // ==== СОЦИАЛЬНЫЕ СЕТИ ====
  @Column({ type: 'varchar', length: 255, nullable: true })
  linkedin: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  facebook: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  twitter: string | null;

  // ==== ТЕГИ ====
  @Column({ type: 'text', array: true, default: [] })
  tags: string[];

  // ==== ОТВЕТСТВЕННЫЙ ====
  @Column({ type: 'uuid', nullable: true })
  assignedUserId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  assignedTo: string | null;

  // ==== СТАТУС ====
  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: string; // active, inactive, archived

  // ==== КАСТОМНЫЕ ПОЛЯ ====
  @Column({ type: 'jsonb', nullable: true })
  customFields: Record<string, any> | null;

  // ==== META ====
  @Column({ type: 'jsonb', nullable: true })
  meta: any | null;

  // ==== СВЯЗИ ====
  // Контакты компании
  @OneToMany(() => Contact, (contact) => contact.company)
  contacts: Contact[];

  // Лиды компании
  @OneToMany(() => Lead, (lead) => lead.company)
  leads: Lead[];

  // Проекты компании
  @OneToMany(() => Project, (project) => project.company)
  projects: Project[];

  // Задачи компании
  @OneToMany('CompanyTask', 'company')
  tasks: any[];

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


