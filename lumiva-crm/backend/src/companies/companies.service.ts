// src/companies/companies.service.ts
import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { BulkUpdateCompaniesDto } from './dto/bulk-update-companies.dto';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';
import { Lead } from '../leads/lead.entity';
import { excludeTrashedLeads } from '../leads/lead-relations.util';
import { Project } from '../projects/project.entity';
import { Contact } from '../contacts/contact.entity';
import { CompanyTask, CompanyTaskStatus } from './company-task.entity';
import { CreateCompanyTaskDto } from './dto/create-company-task.dto';
import { UpdateCompanyTaskDto } from './dto/update-company-task.dto';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly repo: Repository<Company>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
    @InjectRepository(CompanyTask)
    private readonly taskRepo: Repository<CompanyTask>,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Получить все компании тенанта
   */
  async findAll(
    tenantId: string,
    options?: {
      search?: string;
      status?: string;
      type?: string;
      industry?: string;
      assignedUserId?: string;
      tags?: string[];
      limit?: number;
      offset?: number;
    },
  ): Promise<{ items: Company[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('company')
      .where('company.tenantId = :tenantId', { tenantId });

    if (options?.search) {
      const search = `%${options.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(company.name) LIKE :search OR LOWER(company.legalName) LIKE :search OR LOWER(company.email) LIKE :search OR LOWER(company.website) LIKE :search)',
        { search },
      );
    }

    if (options?.status) {
      qb.andWhere('company.status = :status', { status: options.status });
    }

    if (options?.type) {
      qb.andWhere('company.type = :type', { type: options.type });
    }

    if (options?.industry) {
      qb.andWhere('company.industry = :industry', { industry: options.industry });
    }

    if (options?.assignedUserId) {
      qb.andWhere('company.assignedUserId = :assignedUserId', {
        assignedUserId: options.assignedUserId,
      });
    }

    if (options?.tags && options.tags.length > 0) {
      qb.andWhere('company.tags && :tags', { tags: options.tags });
    }

    const total = await qb.getCount();

    if (options?.limit) {
      qb.limit(options.limit);
    }
    if (options?.offset) {
      qb.offset(options.offset);
    }

    qb.orderBy('company.updatedAt', 'DESC');

    const items = await qb.getMany();

    return { items, total };
  }

  /**
   * Получить одну компанию
   */
  async findOne(tenantId: string, id: string): Promise<Company> {
    const company = await this.repo.findOne({
      where: { id, tenantId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  /**
   * Получить компанию со связанными данными
   */
  async findOneWithRelations(tenantId: string, id: string) {
    const company = await this.findOne(tenantId, id);

    // Контакты компании
    const contacts = await this.contactRepo.find({
      where: { tenantId, companyId: id },
      order: { createdAt: 'DESC' },
    });

    // Лиды компании (через companyId и через contactId)
    const leadsByCompany = await this.leadRepo.find({
      where: { tenantId, companyId: id },
      order: { createdAt: 'DESC' },
    });

    const contactIds = contacts.map((c) => c.id);
    let leadsByContact: Lead[] = [];
    if (contactIds.length > 0) {
      if (contactIds.length === 1) {
        leadsByContact = await this.leadRepo.find({
          where: { tenantId, contactId: contactIds[0] },
          order: { createdAt: 'DESC' },
        });
      } else {
        leadsByContact = await this.leadRepo
          .createQueryBuilder('lead')
          .where('lead.tenantId = :tenantId', { tenantId })
          .andWhere('lead.contactId IN (:...contactIds)', { contactIds })
          .orderBy('lead.createdAt', 'DESC')
          .getMany();
      }
    }

    // Объединяем лиды, убираем дубликаты; корзина (meta.deleted) не в списке связей
    const allLeadsMerged = [
      ...leadsByCompany,
      ...leadsByContact.filter((l) => !leadsByCompany.find((lc) => lc.id === l.id)),
    ];
    const allLeads = excludeTrashedLeads(allLeadsMerged);

    // Проекты компании (через лиды)
    const leadIds = allLeads.map((l) => l.id);
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

    // Задачи компании
    const tasks = await this.taskRepo.find({
      where: { tenantId, companyId: id },
      order: { order: 'ASC', createdAt: 'DESC' },
    });

    return {
      company,
      contacts,
      leads: allLeads,
      projects,
      tasks,
    };
  }

  /**
   * Создать компанию
   */
  async create(tenantId: string, dto: CreateCompanyDto, actorUserId?: string | null): Promise<Company> {
    const company = this.repo.create({
      tenantId,
      name: dto.name,
      legalName: dto.legalName || null,
      taxId: dto.taxId || null,
      email: dto.email || null,
      phone: dto.phone || null,
      website: dto.website || null,
      country: dto.country || null,
      city: dto.city || null,
      state: dto.state || null,
      address: dto.address || null,
      postalCode: dto.postalCode || null,
      industry: dto.industry || null,
      size: dto.size || null,
      type: dto.type || null,
      description: dto.description || null,
      linkedin: dto.linkedin || null,
      facebook: dto.facebook || null,
      twitter: dto.twitter || null,
      tags: dto.tags || [],
      assignedUserId: dto.assignedUserId || null,
      assignedTo: dto.assignedTo || null,
      status: dto.status || 'active',
      customFields: dto.customFields || null,
    });

    const saved = await this.repo.save(company);

    // Триггерим автоматизацию
    try {
      await this.automationsService.triggerAutomation(
        tenantId,
        TriggerEvent.COMPANY_CREATED,
        {
          entityType: 'company',
          entityId: saved.id,
          company: saved,
        },
      );
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }

    void this.auditLog.log({
      tenantId,
      entityType: 'company',
      entityId: saved.id,
      entityLabel: saved.name,
      action: 'create',
      summary: 'Компания создана',
      actorUserId: actorUserId ?? null,
    });

    return saved;
  }

  /**
   * Обновить компанию
   */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateCompanyDto,
    actorUserId?: string | null,
  ): Promise<Company> {
    const company = await this.findOne(tenantId, id);
    const before = { name: company.name, email: company.email, status: company.status, assignedUserId: company.assignedUserId };

    // Обновляем поля
    if (dto.name !== undefined) company.name = dto.name;
    if (dto.legalName !== undefined) company.legalName = dto.legalName || null;
    if (dto.taxId !== undefined) company.taxId = dto.taxId || null;
    if (dto.email !== undefined) company.email = dto.email || null;
    if (dto.phone !== undefined) company.phone = dto.phone || null;
    if (dto.website !== undefined) company.website = dto.website || null;
    if (dto.country !== undefined) company.country = dto.country || null;
    if (dto.city !== undefined) company.city = dto.city || null;
    if (dto.state !== undefined) company.state = dto.state || null;
    if (dto.address !== undefined) company.address = dto.address || null;
    if (dto.postalCode !== undefined) company.postalCode = dto.postalCode || null;
    if (dto.industry !== undefined) company.industry = dto.industry || null;
    if (dto.size !== undefined) company.size = dto.size || null;
    if (dto.type !== undefined) company.type = dto.type || null;
    if (dto.description !== undefined) company.description = dto.description || null;
    if (dto.linkedin !== undefined) company.linkedin = dto.linkedin || null;
    if (dto.facebook !== undefined) company.facebook = dto.facebook || null;
    if (dto.twitter !== undefined) company.twitter = dto.twitter || null;
    if (dto.tags !== undefined) company.tags = dto.tags || [];
    if (dto.assignedUserId !== undefined)
      company.assignedUserId = dto.assignedUserId || null;
    if (dto.assignedTo !== undefined) company.assignedTo = dto.assignedTo || null;
    if (dto.status !== undefined) company.status = dto.status;
    if (dto.customFields !== undefined) company.customFields = dto.customFields;

    const saved = await this.repo.save(company);

    // Триггерим автоматизацию
    try {
      await this.automationsService.triggerAutomation(
        tenantId,
        TriggerEvent.COMPANY_UPDATED,
        {
          entityType: 'company',
          entityId: saved.id,
          company: saved,
          changes: dto,
        },
      );
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }

    const changes = (['name', 'email', 'status', 'assignedUserId'] as const)
      .filter((field) => before[field] !== saved[field])
      .map((field) => ({ field, oldValue: before[field] ?? null, newValue: (saved[field] as string | null) ?? null }));
    void this.auditLog.log({
      tenantId,
      entityType: 'company',
      entityId: saved.id,
      entityLabel: saved.name,
      action: 'update',
      summary: 'Компания обновлена',
      changes: changes.length ? changes : null,
      actorUserId: actorUserId ?? null,
    });

    return saved;
  }

  /**
   * Удалить компанию
   */
  async delete(tenantId: string, id: string, actorUserId?: string | null): Promise<void> {
    const company = await this.findOne(tenantId, id);
    await this.repo.remove(company);
    void this.auditLog.log({
      tenantId,
      entityType: 'company',
      entityId: id,
      entityLabel: company.name,
      action: 'delete',
      summary: 'Компания удалена',
      actorUserId: actorUserId ?? null,
    });
  }

  /**
   * Найти компанию по названию или website
   */
  async findByNameOrWebsite(
    tenantId: string,
    name?: string,
    website?: string,
  ): Promise<Company | null> {
    if (!name && !website) return null;

    const qb = this.repo
      .createQueryBuilder('company')
      .where('company.tenantId = :tenantId', { tenantId });

    if (name) {
      qb.andWhere('LOWER(company.name) = LOWER(:name)', { name });
    }
    if (website) {
      qb.andWhere('LOWER(company.website) = LOWER(:website)', { website });
    }

    return qb.getOne();
  }

  /**
   * Получить аналитику по компании
   */
  async getCompanyAnalytics(tenantId: string, companyId: string) {
    const company = await this.findOne(tenantId, companyId);

    // Получаем все контакты компании
    const contacts = await this.contactRepo.find({
      where: { tenantId, companyId },
    });
    const contactIds = contacts.map((c) => c.id);

    // Лиды компании (через companyId или через contactId)
    const leadsByCompany = await this.leadRepo.find({
      where: { tenantId, companyId },
    });
    
    // Лиды через контакты компании
    let leadsByContact: Lead[] = [];
    if (contactIds.length > 0) {
      if (contactIds.length === 1) {
        leadsByContact = await this.leadRepo.find({
          where: { tenantId, contactId: contactIds[0] },
        });
      } else {
        leadsByContact = await this.leadRepo
          .createQueryBuilder('lead')
          .where('lead.tenantId = :tenantId', { tenantId })
          .andWhere('lead.contactId IN (:...contactIds)', { contactIds })
          .getMany();
      }
    }
    
    // Объединяем и убираем дубликаты
    const allLeadIds = new Set([
      ...leadsByCompany.map((l) => l.id),
      ...leadsByContact.map((l) => l.id),
    ]);
    const allLeads = [
      ...leadsByCompany,
      ...leadsByContact.filter((l) => !allLeadIds.has(l.id) || !leadsByCompany.find((lc) => lc.id === l.id)),
    ];

    // Проекты компании (через лиды)
    const leadIds = allLeads.map((l) => l.id);
    let projects: Project[] = [];
    if (leadIds.length > 0) {
      if (leadIds.length === 1) {
        projects = await this.projectRepo.find({
          where: { tenantId, leadId: leadIds[0] } as any,
        });
      } else {
        projects = await this.projectRepo
          .createQueryBuilder('project')
          .where('project.tenant_id = :tenantId', { tenantId })
          .andWhere('project.lead_id IN (:...leadIds)', { leadIds })
          .getMany();
      }
    }

    // Статистика по лидам
    const leadsStats = {
      total: allLeads.length,
      byStatus: {
        new: allLeads.filter((l) => l.status === 'new').length,
        in_progress: allLeads.filter((l) => l.status === 'in_progress').length,
        waiting: allLeads.filter((l) => l.status === 'waiting').length,
        won: allLeads.filter((l) => l.status === 'won').length,
        lost: allLeads.filter((l) => l.status === 'lost').length,
      },
    };

    // Статистика по проектам
    const projectsStats = {
      total: projects.length,
      byStatus: {
        Новый: projects.filter((p) => p.status === 'Новый').length,
        'В работе': projects.filter((p) => p.status === 'В работе').length,
        'На проверке': projects.filter((p) => p.status === 'На проверке').length,
        Заморожен: projects.filter((p) => p.status === 'Заморожен').length,
        Закрыт: projects.filter((p) => p.status === 'Закрыт').length,
      },
      totalAmount: projects.reduce((sum, p) => {
        const amount = parseFloat(p.amount || '0');
        return sum + amount;
      }, 0),
      closedAmount: projects
        .filter((p) => p.status === 'Закрыт')
        .reduce((sum, p) => {
          const amount = parseFloat(p.amount || '0');
          return sum + amount;
        }, 0),
    };

    // Конверсия лидов в проекты
    const conversionRate = allLeads.length > 0
      ? (projects.length / allLeads.length) * 100
      : 0;

    // ROI (если есть данные о затратах на лиды)
    // Пока упрощенный расчет: сумма проектов / количество лидов
    const avgProjectValue = projects.length > 0
      ? projectsStats.totalAmount / projects.length
      : 0;

    return {
      company: {
        id: company.id,
        name: company.name,
      },
      contacts: {
        total: contacts.length,
      },
      leads: leadsStats,
      projects: projectsStats,
      metrics: {
        conversionRate: Math.round(conversionRate * 100) / 100,
        avgProjectValue: Math.round(avgProjectValue * 100) / 100,
        totalRevenue: projectsStats.closedAmount,
        potentialRevenue: projectsStats.totalAmount,
      },
    };
  }

  /**
   * Получить общую аналитику по всем компаниям
   */
  async getAllCompaniesAnalytics(tenantId: string) {
    const companies = await this.repo.find({ where: { tenantId } });
    
    const analytics = await Promise.all(
      companies.map((company) => this.getCompanyAnalytics(tenantId, company.id)),
    );

    // Агрегированная статистика
    const totalLeads = analytics.reduce((sum, a) => sum + a.leads.total, 0);
    const totalProjects = analytics.reduce((sum, a) => sum + a.projects.total, 0);
    const totalRevenue = analytics.reduce((sum, a) => sum + a.metrics.totalRevenue, 0);
    const totalPotentialRevenue = analytics.reduce((sum, a) => sum + a.metrics.potentialRevenue, 0);

    // Топ компаний по выручке
    const topByRevenue = [...analytics]
      .sort((a, b) => b.metrics.totalRevenue - a.metrics.totalRevenue)
      .slice(0, 10)
      .map((a) => ({
        companyId: a.company.id,
        companyName: a.company.name,
        revenue: a.metrics.totalRevenue,
        projects: a.projects.total,
        leads: a.leads.total,
      }));

    // Топ компаний по количеству проектов
    const topByProjects = [...analytics]
      .sort((a, b) => b.projects.total - a.projects.total)
      .slice(0, 10)
      .map((a) => ({
        companyId: a.company.id,
        companyName: a.company.name,
        projects: a.projects.total,
        revenue: a.metrics.totalRevenue,
        leads: a.leads.total,
      }));

    return {
      summary: {
        totalCompanies: companies.length,
        totalLeads,
        totalProjects,
        totalRevenue,
        totalPotentialRevenue,
        avgConversionRate: totalLeads > 0
          ? Math.round((totalProjects / totalLeads) * 10000) / 100
          : 0,
      },
      topByRevenue,
      topByProjects,
    };
  }

  // ========== ЗАДАЧИ КОМПАНИЙ ==========

  /**
   * Получить все задачи компании
   */
  async findCompanyTasks(
    tenantId: string,
    companyId: string,
    status?: CompanyTaskStatus,
  ): Promise<CompanyTask[]> {
    const where: any = { tenantId, companyId };
    if (status) {
      where.status = status;
    }

    return this.taskRepo.find({
      where,
      order: { order: 'ASC', createdAt: 'DESC' },
    });
  }

  /**
   * Получить одну задачу
   */
  async findTask(tenantId: string, taskId: string): Promise<CompanyTask> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId, tenantId },
    });

    if (!task) {
      throw new NotFoundException('Company task not found');
    }

    return task;
  }

  /**
   * Создать задачу компании
   */
  async createTask(
    tenantId: string,
    dto: CreateCompanyTaskDto,
  ): Promise<CompanyTask> {
    // Проверяем, что компания существует
    await this.findOne(tenantId, dto.companyId);

    const task = this.taskRepo.create({
      tenantId,
      companyId: dto.companyId,
      title: dto.title,
      description: dto.description || null,
      status: dto.status || 'todo',
      priority: dto.priority || null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      assignedUserId: dto.assignedUserId || null,
      assignedTo: dto.assignedTo || null,
      tags: dto.tags || [],
      meta: dto.meta || null,
      order: dto.order || 0,
    });

    const saved = await this.taskRepo.save(task);
    try {
      await this.automationsService.triggerAutomation(
        tenantId,
        TriggerEvent.TASK_CREATED,
        {
          entityType: 'task',
          entityId: saved.id,
          task: saved,
          companyId: saved.companyId,
        },
      );
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }
    return saved;
  }

  /**
   * Обновить задачу
   */
  async updateTask(
    tenantId: string,
    taskId: string,
    dto: UpdateCompanyTaskDto,
  ): Promise<CompanyTask> {
    const task = await this.findTask(tenantId, taskId);
    const beforeStatus = task.status;

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description || null;
    if (dto.status !== undefined) {
      task.status = dto.status;
      // Если статус "done", устанавливаем completedAt
      if (dto.status === 'done' && !task.completedAt) {
        task.completedAt = new Date();
      } else if (dto.status !== 'done') {
        task.completedAt = null;
      }
    }
    if (dto.priority !== undefined) task.priority = dto.priority || null;
    if (dto.dueDate !== undefined) {
      task.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.assignedUserId !== undefined) {
      task.assignedUserId = dto.assignedUserId || null;
    }
    if (dto.assignedTo !== undefined) {
      task.assignedTo = dto.assignedTo || null;
    }
    if (dto.tags !== undefined) task.tags = dto.tags || [];
    if (dto.meta !== undefined) task.meta = dto.meta;
    if (dto.order !== undefined) task.order = dto.order;

    const saved = await this.taskRepo.save(task);
    try {
      await this.automationsService.triggerAutomation(
        tenantId,
        TriggerEvent.TASK_UPDATED,
        {
          entityType: 'task',
          entityId: saved.id,
          task: saved,
          companyId: saved.companyId,
        },
      );
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }
    if (dto.status !== undefined && beforeStatus !== saved.status) {
      try {
        await this.automationsService.triggerAutomation(
          tenantId,
          TriggerEvent.TASK_STATUS_CHANGED,
          {
            entityType: 'task',
            entityId: saved.id,
            task: saved,
            companyId: saved.companyId,
            oldStatus: beforeStatus,
            newStatus: saved.status,
          },
        );
      } catch (error) {
        console.error('Failed to trigger automation:', error);
      }
    }
    return saved;
  }

  /**
   * Удалить задачу
   */
  async deleteTask(tenantId: string, taskId: string): Promise<void> {
    const task = await this.findTask(tenantId, taskId);
    await this.taskRepo.remove(task);
  }

  /**
   * Изменить статус задачи (для drag & drop в канбане)
   */
  async changeTaskStatus(
    tenantId: string,
    taskId: string,
    status: CompanyTaskStatus,
    order?: number,
  ): Promise<CompanyTask> {
    const task = await this.findTask(tenantId, taskId);
    const beforeStatus = task.status;
    task.status = status;

    if (status === 'done' && !task.completedAt) {
      task.completedAt = new Date();
    } else if (status !== 'done') {
      task.completedAt = null;
    }

    if (order !== undefined) {
      task.order = order;
    }

    const saved = await this.taskRepo.save(task);
    try {
      await this.automationsService.triggerAutomation(
        tenantId,
        TriggerEvent.TASK_STATUS_CHANGED,
        {
          entityType: 'task',
          entityId: saved.id,
          task: saved,
          companyId: saved.companyId,
          oldStatus: beforeStatus,
          newStatus: saved.status,
        },
      );
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }
    return saved;
  }

  // ========== МАССОВЫЕ ОПЕРАЦИИ ==========

  /**
   * Массовое обновление компаний
   */
  async bulkUpdate(tenantId: string, dto: BulkUpdateCompaniesDto) {
    const { companyIds, assignedUserId, assignedTo, status, tagsToAdd, tagsToRemove } = dto;

    if (!companyIds || companyIds.length === 0) {
      throw new NotFoundException('No companies selected');
    }

    // Получаем все компании
    const companies = await this.repo.find({
      where: companyIds.map((id) => ({ id, tenantId })),
    });

    if (companies.length === 0) {
      throw new NotFoundException('Companies not found');
    }

    // Обновляем каждую компанию
    for (const company of companies) {
      if (assignedUserId !== undefined) {
        company.assignedUserId = assignedUserId;
      }
      if (assignedTo !== undefined) {
        company.assignedTo = assignedTo;
      }
      if (status !== undefined) {
        company.status = status;
      }
      if (tagsToAdd && tagsToAdd.length > 0) {
        const currentTags = company.tags || [];
        const newTags = [...new Set([...currentTags, ...tagsToAdd])];
        company.tags = newTags;
      }
      if (tagsToRemove && tagsToRemove.length > 0) {
        const currentTags = company.tags || [];
        company.tags = currentTags.filter((tag) => !tagsToRemove.includes(tag));
      }
    }

    await this.repo.save(companies);

    return {
      success: true,
      updated: companies.length,
    };
  }
}
