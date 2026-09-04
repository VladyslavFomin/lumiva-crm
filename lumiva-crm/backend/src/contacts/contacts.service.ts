// src/contacts/contacts.service.ts
import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { BulkUpdateContactsDto } from './dto/bulk-update-contacts.dto';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';
import { Lead } from '../leads/lead.entity';
import { excludeTrashedLeads } from '../leads/lead-relations.util';
import { Project } from '../projects/project.entity';
import { Company } from '../companies/company.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditLogChange } from '../audit-log/audit-log.entity';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly repo: Repository<Contact>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Получить все контакты тенанта
   */
  async findAll(
    tenantId: string,
    options?: {
      search?: string;
      status?: string;
      assignedUserId?: string;
      tags?: string[];
      companyId?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ items: Contact[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('contact')
      .leftJoin('contact.company', 'company')
      .where('contact.tenantId = :tenantId', { tenantId });

    if (options?.companyId) {
      qb.andWhere('contact.companyId = :companyId', { companyId: options.companyId });
    }

    if (options?.search) {
      const search = `%${options.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(contact.fullName) LIKE :search OR LOWER(contact.email) LIKE :search OR LOWER(contact.phone) LIKE :search OR LOWER(company.name) LIKE :search)',
        { search },
      );
    }

    if (options?.status) {
      qb.andWhere('contact.status = :status', { status: options.status });
    }

    if (options?.assignedUserId) {
      qb.andWhere('contact.assignedUserId = :assignedUserId', {
        assignedUserId: options.assignedUserId,
      });
    }

    if (options?.tags && options.tags.length > 0) {
      qb.andWhere('contact.tags && :tags', { tags: options.tags });
    }

    const total = await qb.getCount();

    if (options?.limit) {
      qb.limit(options.limit);
    }
    if (options?.offset) {
      qb.offset(options.offset);
    }

    qb.orderBy('contact.updatedAt', 'DESC');

    const items = await qb.getMany();

    return { items, total };
  }

  /**
   * Получить один контакт
   */
  async findOne(tenantId: string, id: string): Promise<Contact> {
    const contact = await this.repo.findOne({
      where: { id, tenantId },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return contact;
  }

  /**
   * Получить контакт со связанными данными
   */
  async findOneWithRelations(tenantId: string, id: string) {
    const contact = await this.findOne(tenantId, id);

    // Компания контакта
    let company: Company | null = null;
    if (contact.companyId) {
      company = await this.companyRepo.findOne({
        where: { id: contact.companyId, tenantId },
      });
    }

    // Лиды контакта (через contactId); исключаем корзину (meta.deleted)
    const leadsRaw = await this.leadRepo.find({
      where: { tenantId, contactId: id },
      order: { createdAt: 'DESC' },
    });
    const leads = excludeTrashedLeads(leadsRaw);

    // Проекты контакта (через лиды)
    const leadIds = leads.map((l) => l.id);
    let projects: Project[] = [];
    if (leadIds.length > 0) {
      if (leadIds.length === 1) {
        projects = await this.projectRepo.find({
          where: { tenantId, leadId: leadIds[0] } as any,
          order: { createdAt: 'DESC' } as any,
        });
      } else {
        projects = await this.projectRepo
          .createQueryBuilder('project')
          .where('project.tenant_id = :tenantId', { tenantId })
          .andWhere('project.lead_id IN (:...leadIds)', { leadIds })
          .orderBy('project.created_at', 'DESC')
          .getMany();
      }
    }

    return {
      contact,
      company,
      leads,
      projects,
    };
  }

  /**
   * Создать контакт
   */
  async create(tenantId: string, dto: CreateContactDto, actorUserId?: string | null): Promise<Contact> {
    // Вычисляем fullName
    const fullName = this.computeFullName(dto.firstName, dto.lastName, dto.email);

    const contact = this.repo.create({
      tenantId,
      firstName: dto.firstName || null,
      lastName: dto.lastName || null,
      fullName,
      email: dto.email || null,
      phone: dto.phone || null,
      position: dto.position || null,
      companyId: dto.companyId || null,
      country: dto.country || null,
      city: dto.city || null,
      address: dto.address || null,
      timezone: dto.timezone || null,
      language: dto.language || null,
      linkedin: dto.linkedin || null,
      telegram: dto.telegram || null,
      website: dto.website || null,
      tags: dto.tags || [],
      assignedUserId: dto.assignedUserId || null,
      assignedTo: dto.assignedTo || null,
      status: dto.status || 'active',
      customFields: dto.customFields || null,
    });

    const saved = await this.repo.save(contact);

    // Триггерим автоматизацию
    try {
      const savedContact = Array.isArray(saved) ? saved[0] : saved;
      await this.automationsService.triggerAutomation(
        tenantId,
        TriggerEvent.CONTACT_CREATED,
        {
          entityType: 'contact',
          entityId: savedContact.id,
          contact: savedContact,
        },
      );
    } catch (error) {
      // Логируем, но не прерываем создание контакта
      console.error('Failed to trigger automation:', error);
    }

    const createdContact = Array.isArray(saved) ? saved[0] : saved;
    void this.auditLog.log({
      tenantId,
      entityType: 'contact',
      entityId: createdContact.id,
      entityLabel: createdContact.fullName,
      action: 'create',
      summary: 'Контакт создан',
      actorUserId: actorUserId ?? null,
    });

    return createdContact;
  }

  /**
   * Обновить контакт
   */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateContactDto,
    actorUserId?: string | null,
  ): Promise<Contact> {
    const contact = await this.findOne(tenantId, id);
    const before = { email: contact.email, phone: contact.phone, status: contact.status, assignedUserId: contact.assignedUserId, customFields: JSON.stringify(contact.customFields ?? null) };

    // Обновляем поля
    if (dto.firstName !== undefined) contact.firstName = dto.firstName || null;
    if (dto.lastName !== undefined) contact.lastName = dto.lastName || null;
    if (dto.email !== undefined) contact.email = dto.email || null;
    if (dto.phone !== undefined) contact.phone = dto.phone || null;
    if (dto.position !== undefined) contact.position = dto.position || null;
    if (dto.companyId !== undefined) contact.companyId = dto.companyId || null;
    if (dto.country !== undefined) contact.country = dto.country || null;
    if (dto.city !== undefined) contact.city = dto.city || null;
    if (dto.address !== undefined) contact.address = dto.address || null;
    if (dto.timezone !== undefined) contact.timezone = dto.timezone || null;
    if (dto.language !== undefined) contact.language = dto.language || null;
    if (dto.linkedin !== undefined) contact.linkedin = dto.linkedin || null;
    if (dto.telegram !== undefined) contact.telegram = dto.telegram || null;
    if (dto.website !== undefined) contact.website = dto.website || null;
    if (dto.tags !== undefined) contact.tags = dto.tags || [];
    if (dto.assignedUserId !== undefined)
      contact.assignedUserId = dto.assignedUserId || null;
    if (dto.assignedTo !== undefined) contact.assignedTo = dto.assignedTo || null;
    if (dto.status !== undefined) contact.status = dto.status;
    if (dto.customFields !== undefined) contact.customFields = dto.customFields;

    // Пересчитываем fullName
    contact.fullName = this.computeFullName(
      contact.firstName,
      contact.lastName,
      contact.email,
    );

    const saved = await this.repo.save(contact);

    // Триггерим автоматизацию
    try {
      const savedContact = Array.isArray(saved) ? saved[0] : saved;
      await this.automationsService.triggerAutomation(
        tenantId,
        TriggerEvent.CONTACT_UPDATED,
        {
          entityType: 'contact',
          entityId: savedContact.id,
          contact: savedContact,
          changes: dto,
        },
      );
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }

    const updatedContact = Array.isArray(saved) ? saved[0] : saved;
    const changes: AuditLogChange[] = (['email', 'phone', 'status', 'assignedUserId'] as const)
      .filter((field) => before[field] !== updatedContact[field])
      .map((field) => ({ field, oldValue: before[field] ?? null, newValue: (updatedContact[field] as string | null) ?? null }));
    // Кастомные поля раньше вообще не попадали в audit log, хотя принимаются и сохраняются
    // тем же update() — их можно было менять без единого следа в истории изменений.
    if (before.customFields !== JSON.stringify(updatedContact.customFields ?? null)) {
      changes.push({ field: 'customFields', oldValue: null, newValue: null });
    }
    void this.auditLog.log({
      tenantId,
      entityType: 'contact',
      entityId: updatedContact.id,
      entityLabel: updatedContact.fullName,
      action: 'update',
      summary: 'Контакт обновлён',
      changes: changes.length ? changes : null,
      actorUserId: actorUserId ?? null,
    });

    return updatedContact;
  }

  /**
   * Удалить контакт
   */
  async delete(tenantId: string, id: string, actorUserId?: string | null): Promise<void> {
    const contact = await this.findOne(tenantId, id);
    await this.repo.remove(contact);
    void this.auditLog.log({
      tenantId,
      entityType: 'contact',
      entityId: id,
      entityLabel: contact.fullName,
      action: 'delete',
      summary: 'Контакт удалён',
      actorUserId: actorUserId ?? null,
    });
  }

  /**
   * Вычислить fullName из firstName, lastName, email
   */
  private computeFullName(
    firstName: string | null | undefined,
    lastName: string | null | undefined,
    email: string | null | undefined,
  ): string | null {
    const parts: string[] = [];
    if (firstName) parts.push(firstName);
    if (lastName) parts.push(lastName);
    if (parts.length > 0) return parts.join(' ');
    if (email) return email.split('@')[0];
    return null;
  }

  /**
   * Найти контакт по email или phone
   */
  async findByEmailOrPhone(
    tenantId: string,
    email?: string,
    phone?: string,
  ): Promise<Contact | null> {
    if (!email && !phone) return null;

    const qb = this.repo
      .createQueryBuilder('contact')
      .where('contact.tenantId = :tenantId', { tenantId });

    if (email) {
      qb.andWhere('LOWER(contact.email) = LOWER(:email)', { email });
    }
    if (phone) {
      qb.andWhere('contact.phone = :phone', { phone });
    }

    return qb.getOne();
  }

  // ========== МАССОВЫЕ ОПЕРАЦИИ ==========

  /**
   * Массовое обновление контактов
   */
  async bulkUpdate(tenantId: string, dto: BulkUpdateContactsDto) {
    const { contactIds, assignedUserId, assignedTo, status, tagsToAdd, tagsToRemove } = dto;

    if (!contactIds || contactIds.length === 0) {
      throw new NotFoundException('No contacts selected');
    }

    // Получаем все контакты
    const contacts = await this.repo.find({
      where: contactIds.map((id) => ({ id, tenantId })),
    });

    if (contacts.length === 0) {
      throw new NotFoundException('Contacts not found');
    }

    // Обновляем каждый контакт
    for (const contact of contacts) {
      if (assignedUserId !== undefined) {
        contact.assignedUserId = assignedUserId;
      }
      if (assignedTo !== undefined) {
        contact.assignedTo = assignedTo;
      }
      if (status !== undefined) {
        contact.status = status;
      }
      if (tagsToAdd && tagsToAdd.length > 0) {
        const currentTags = contact.tags || [];
        const newTags = [...new Set([...currentTags, ...tagsToAdd])];
        contact.tags = newTags;
      }
      if (tagsToRemove && tagsToRemove.length > 0) {
        const currentTags = contact.tags || [];
        contact.tags = currentTags.filter((tag) => !tagsToRemove.includes(tag));
      }
    }

    await this.repo.save(contacts);

    return {
      success: true,
      updated: contacts.length,
    };
  }
}

