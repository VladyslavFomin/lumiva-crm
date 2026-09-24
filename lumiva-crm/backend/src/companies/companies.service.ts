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
import { AuditLogChange } from '../audit-log/audit-log.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { StaffUsersService } from '../staff/staff-users.service';
import { CurrencyRatesService } from '../currency/currency-rates.service';
import { Tenant } from '../tenants/tenant.entity';

// Статусы проекта, которые ещё "в работе" (не имеют финального исхода) — считаются в
// pipeline/"потенциале", а не в выручке и не в потерях.
const PROJECT_OPEN_STATUSES = ['Новый', 'В работе', 'На проверке', 'Заморожен'];
const PROJECT_LOST_STATUSES = ['Проиграно'];

// Реальные тенанты используют "Выиграно" как статус выигранного проекта (см. project.entity.ts
// ProjectStatus), а не буквально "Закрыт" — со старой логикой ниже (`p.status === 'Закрыт'`)
// закрытая выручка ВСЕГДА была 0, потому что ни один реальный проект не имеет статуса "Закрыт".
const PROJECT_WON_STATUSES = ['Закрыт', 'Выиграно'];

function sumProjectsByCurrency(projects: Project[]): Record<string, number> {
  const map: Record<string, number> = {};
  projects.forEach((p) => {
    const cur = p.currency || '—';
    map[cur] = (map[cur] || 0) + (parseFloat(p.amount || '0') || 0);
  });
  return map;
}

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
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
    private readonly staffUsersService: StaffUsersService,
    private readonly currencyRates: CurrencyRatesService,
  ) {}

  /** Уведомляет в колокольчик новоназначенного ответственного (только если поле реально
   * изменилось — не спамим на каждое сохранение без смены ответственного). */
  private async notifySingleAssignee(
    tenantId: string,
    previousStaffId: string | null | undefined,
    nextStaffId: string | null | undefined,
    title: string,
    body: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    if (!nextStaffId || nextStaffId === previousStaffId) return;
    const userIds = await this.staffUsersService.resolveNotificationUserIdsForTenant(tenantId, [nextStaffId]);
    if (!userIds.length) return;
    await this.notifications.create(tenantId, userIds, title, body, meta);
  }

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

    // Проекты компании — объединение по companyId (проект привязан к компании напрямую) и по
    // lead_id (проект создан из лида этой компании); проект без lead_id иначе выпадал бы
    // отсюда полностью (см. тот же фикс в getCompanyAnalytics).
    const leadIds = allLeads.map((l) => l.id);
    const projects = await this.projectRepo
      .createQueryBuilder('project')
      .where('project.tenant_id = :tenantId', { tenantId })
      .andWhere(
        leadIds.length > 0
          ? '(project.company_id = :companyId OR project.lead_id IN (:...leadIds))'
          : 'project.company_id = :companyId',
        { companyId: id, leadIds },
      )
      .orderBy('project.created_at', 'DESC')
      .getMany();

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
      assignedUserIds: Array.isArray(dto.assignedUserIds) ? dto.assignedUserIds : [],
      status: dto.status || 'active',
      customFields: dto.customFields || null,
      legalRequisites: Array.isArray(dto.legalRequisites)
        ? dto.legalRequisites.filter((it) => it && it.value && String(it.value).trim())
        : null,
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

    await this.notifySingleAssignee(
      tenantId,
      null,
      saved.assignedUserId,
      'Вам назначена компания',
      saved.name,
      { type: 'company.assigned', companyId: saved.id, link: `/companies/${saved.id}` },
    ).catch(() => undefined);

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
    const before = { name: company.name, email: company.email, status: company.status, assignedUserId: company.assignedUserId, customFields: JSON.stringify(company.customFields ?? null) };

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
    if (dto.assignedUserIds !== undefined)
      company.assignedUserIds = Array.isArray(dto.assignedUserIds) ? dto.assignedUserIds : [];
    if (dto.status !== undefined) company.status = dto.status;
    if (dto.customFields !== undefined) company.customFields = dto.customFields;
    if (dto.comments !== undefined) company.comments = dto.comments as any;
    if (dto.legalRequisites !== undefined) {
      company.legalRequisites = Array.isArray(dto.legalRequisites)
        ? dto.legalRequisites.filter((it) => it && it.value && String(it.value).trim())
        : null;
    }

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

    await this.notifySingleAssignee(
      tenantId,
      before.assignedUserId,
      saved.assignedUserId,
      'Вам назначена компания',
      saved.name,
      { type: 'company.assigned', companyId: saved.id, link: `/companies/${saved.id}` },
    ).catch(() => undefined);

    const changes: AuditLogChange[] = (['name', 'email', 'status', 'assignedUserId'] as const)
      .filter((field) => before[field] !== saved[field])
      .map((field) => ({ field, oldValue: before[field] ?? null, newValue: (saved[field] as string | null) ?? null }));
    // Кастомные поля раньше не попадали в audit log, хотя принимаются и сохраняются тем же
    // update() — их можно было менять без единого следа в истории изменений компании.
    if (before.customFields !== JSON.stringify(saved.customFields ?? null)) {
      changes.push({ field: 'customFields', oldValue: null, newValue: null });
    }
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
    // корзина (meta.deleted) не участвует в аналитике
    const allLeads = excludeTrashedLeads([
      ...leadsByCompany,
      ...leadsByContact.filter((l) => !allLeadIds.has(l.id) || !leadsByCompany.find((lc) => lc.id === l.id)),
    ]);

    // Проекты компании — раньше искали ТОЛЬКО через lead_id (проекты, созданные из лида),
    // но проект можно привязать к компании и напрямую (companyId), без лида (например, вручную
    // через "Проекты"/"Новый проект") — такие проекты полностью выпадали из аналитики (не
    // считались в "Выручка"/"Потенциал"), хотя видны в самой вкладке "Проекты" (та фильтрует
    // по companyId на фронте). Теперь берём объединение обоих условий.
    const leadIds = allLeads.map((l) => l.id);
    const projectsQb = this.projectRepo
      .createQueryBuilder('project')
      .where('project.tenant_id = :tenantId', { tenantId })
      .andWhere(
        leadIds.length > 0
          ? '(project.company_id = :companyId OR project.lead_id IN (:...leadIds))'
          : 'project.company_id = :companyId',
        { companyId, leadIds },
      );
    const projects = await projectsQb.getMany();

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
        Выиграно: projects.filter((p) => p.status === 'Выиграно').length,
        Проиграно: projects.filter((p) => p.status === 'Проиграно').length,
      },
      totalAmount: projects.reduce((sum, p) => {
        const amount = parseFloat(p.amount || '0');
        return sum + amount;
      }, 0),
      closedAmount: projects
        .filter((p) => PROJECT_WON_STATUSES.includes(p.status))
        .reduce((sum, p) => {
          const amount = parseFloat(p.amount || '0');
          return sum + amount;
        }, 0),
      // Проекты одной компании могут быть в разных валютах (currency — поле проекта, а не
      // тенанта) — totalAmount/closedAmount выше остаются "смешанной" суммой для обратной
      // совместимости (используется в кросс-компанийной BI-аналитике), а тут — честная
      // разбивка по валюте для отображения в карточке конкретной компании.
      totalAmountByCurrency: sumProjectsByCurrency(projects),
      closedAmountByCurrency: sumProjectsByCurrency(projects.filter((p) => PROJECT_WON_STATUSES.includes(p.status))),
      // "Потенциал"/"В работе" — сделки без финального исхода (не выиграны и не проиграны).
      pipelineAmountByCurrency: sumProjectsByCurrency(projects.filter((p) => PROJECT_OPEN_STATUSES.includes(p.status))),
      lostAmountByCurrency: sumProjectsByCurrency(projects.filter((p) => PROJECT_LOST_STATUSES.includes(p.status))),
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
    const countByCurrency: Record<string, number> = {};
    projects.forEach((p) => {
      const cur = p.currency || '—';
      countByCurrency[cur] = (countByCurrency[cur] || 0) + 1;
    });
    const avgProjectValueByCurrency: Record<string, number> = {};
    Object.entries(projectsStats.totalAmountByCurrency).forEach(([cur, sum]) => {
      avgProjectValueByCurrency[cur] = Math.round((sum / countByCurrency[cur]) * 100) / 100;
    });

    // Деньги считаются ТОЛЬКО по проектам (сделкам), не по лидам — лиды остаются просто
    // списком заявок без денежной семантики (см. lumiva_currency_conversion_and_deals memory).
    // У проектов одной компании может быть разная валюта — конвертируем всё в основную валюту
    // тенанта (tenant.primaryCurrency) по актуальному курсу вместо смешивания сумм.
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const primaryCurrency = (tenant?.primaryCurrency || 'EUR').toUpperCase();
    const rates = await this.currencyRates.getRates();
    const conv = (byCur: Record<string, number>) =>
      this.currencyRates.convertMapToSingleWithRates(byCur, primaryCurrency, rates);

    const totalRevenueConverted = conv(projectsStats.closedAmountByCurrency);
    const pipelineRevenueConverted = conv(projectsStats.pipelineAmountByCurrency);
    const lostRevenueConverted = conv(projectsStats.lostAmountByCurrency);
    const totalAmountConverted = conv(projectsStats.totalAmountByCurrency);
    const avgProjectValueConverted = projects.length
      ? Math.round((totalAmountConverted / projects.length) * 100) / 100
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
        avgProjectValueByCurrency,
        totalRevenue: projectsStats.closedAmount,
        potentialRevenue: projectsStats.totalAmount,
        // Сконвертированные в primaryCurrency тенанта — единое число для показа в UI вместо
        // "N EUR + M TRY". "Потенциал" = pipeline (открытые, без исхода) сделки.
        currency: primaryCurrency,
        totalRevenueConverted,
        potentialRevenueConverted: pipelineRevenueConverted,
        pipelineRevenueConverted,
        lostRevenueConverted,
        avgProjectValueConverted,
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

    // Агрегированная статистика — раньше складывались "сырые" totalRevenue/potentialRevenue
    // разных компаний вперемешку по валютам; теперь у каждой компании уже есть *Converted в
    // единой primaryCurrency тенанта, поэтому сумма по всем компаниям корректна.
    const primaryCurrency = analytics[0]?.metrics.currency || 'EUR';
    const totalLeads = analytics.reduce((sum, a) => sum + a.leads.total, 0);
    const totalProjects = analytics.reduce((sum, a) => sum + a.projects.total, 0);
    const totalRevenue = analytics.reduce((sum, a) => sum + a.metrics.totalRevenueConverted, 0);
    const totalPotentialRevenue = analytics.reduce((sum, a) => sum + a.metrics.pipelineRevenueConverted, 0);
    const totalWonLeads = analytics.reduce((sum, a) => sum + a.leads.byStatus.won, 0);

    // Топ компаний по выручке
    const topByRevenue = [...analytics]
      .sort((a, b) => b.metrics.totalRevenueConverted - a.metrics.totalRevenueConverted)
      .slice(0, 10)
      .map((a) => ({
        companyId: a.company.id,
        companyName: a.company.name,
        revenue: a.metrics.totalRevenueConverted,
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
        revenue: a.metrics.totalRevenueConverted,
        leads: a.leads.total,
      }));

    return {
      summary: {
        totalCompanies: companies.length,
        totalLeads,
        totalProjects,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalPotentialRevenue: Math.round(totalPotentialRevenue * 100) / 100,
        currency: primaryCurrency,
        totalWonLeads,
        avgConversionRate: totalLeads > 0
          ? Math.round((totalProjects / totalLeads) * 10000) / 100
          : 0,
        // Лид → клиент (won), в отличие от avgConversionRate выше (лид → проект).
        avgWonConversionRate: totalLeads > 0 ? Math.round((totalWonLeads / totalLeads) * 10000) / 100 : 0,
      },
      topByRevenue,
      topByProjects,
      // Полный список по каждой компании — для колонок "Выручка"/"Потенциал"/"Сделки" на
      // странице списка компаний (topByRevenue/topByProjects режут до 10, этого недостаточно).
      // Считается ТОЛЬКО по проектам (сделкам), уже сконвертировано в primaryCurrency тенанта.
      perCompany: analytics.map((a) => ({
        companyId: a.company.id,
        contacts: a.contacts.total,
        leads: a.leads.total,
        projects: a.projects.total,
        revenue: a.metrics.totalRevenueConverted,
        potential: a.metrics.pipelineRevenueConverted,
        avgProjectValue: a.metrics.avgProjectValueConverted,
        currency: a.metrics.currency,
        wonLeads: a.leads.byStatus.won,
      })),
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
    await this.notifySingleAssignee(
      tenantId,
      null,
      saved.assignedUserId,
      'Вам назначена задача',
      saved.title,
      { type: 'company_task.assigned', taskId: saved.id, companyId: saved.companyId, link: `/companies/${saved.companyId}` },
    ).catch(() => undefined);
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
    const beforeAssignedUserId = task.assignedUserId;

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
    await this.notifySingleAssignee(
      tenantId,
      beforeAssignedUserId,
      saved.assignedUserId,
      'Вам назначена задача',
      saved.title,
      { type: 'company_task.assigned', taskId: saved.id, companyId: saved.companyId, link: `/companies/${saved.companyId}` },
    ).catch(() => undefined);
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
    const { companyIds, assignedUserId, assignedTo, status, type, tagsToAdd, tagsToRemove } = dto;

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
      if (type !== undefined) {
        company.type = type;
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
