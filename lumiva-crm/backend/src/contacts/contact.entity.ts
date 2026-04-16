// src/contacts/contact.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Company } from '../companies/company.entity';
import { Lead } from '../leads/lead.entity';
import { Project } from '../projects/project.entity';

@Entity('contacts')
@Index(['tenantId', 'email'])
@Index(['tenantId', 'phone'])
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==== MULTI-TENANT ====
  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // ==== ОСНОВНЫЕ ДАННЫЕ ====
  @Column({ type: 'varchar', length: 255, nullable: true })
  firstName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  lastName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fullName: string | null; // Вычисляемое поле для поиска

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  position: string | null; // Должность

  @Column({ type: 'uuid', nullable: true })
  companyId: string | null;

  // Связь с Company entity
  @ManyToOne(() => Company, (company) => company.contacts, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'companyId' })
  company: Company | null;

  // ==== ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ ====
  @Column({ type: 'varchar', length: 2, nullable: true })
  country: string | null; // ISO-код страны

  @Column({ type: 'varchar', length: 255, nullable: true })
  city: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  timezone: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  language: string | null; // ru, en, tr

  // ==== СОЦИАЛЬНЫЕ СЕТИ ====
  @Column({ type: 'varchar', length: 255, nullable: true })
  linkedin: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  telegram: string | null; // @username или phone

  @Column({ type: 'varchar', length: 255, nullable: true })
  website: string | null;

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
  // Лиды контакта
  @OneToMany(() => Lead, (lead) => lead.contact)
  leads: Lead[];

  // Проекты контакта
  @OneToMany(() => Project, (project) => project.contact)
  projects: Project[];

  // ==== AUDIT ====
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

