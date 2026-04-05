import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Lead } from '../leads/lead.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { Company } from '../companies/company.entity';
import { Sale } from '../sales/sale.entity';
import { Project } from '../projects/project.entity';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { MarketingService } from '../marketing/marketing.service';
import { LeadsService } from '../leads/leads.service';
import { NotesService } from '../notes/notes.service';
import { ProjectsService } from '../projects/projects.service';
import type { ProjectStatus } from '../projects/project.entity';
import { EntityType } from '../notes/dto/create-note.dto';
import { AiMemoryChunk } from './ai-memory-chunk.entity';
import { AiQuotaService } from './ai-quota.service';
import { CustomObjectsService } from '../custom-objects/custom-objects.service';
import type { CreateCustomObjectDto } from '../custom-objects/dto/create-custom-object.dto';
import type { CustomObjectFieldType } from '../custom-objects/custom-object-field.entity';
import { SalesImportService } from '../sales/sales-import.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { AiOpenAiService } from './ai-openai.service';
import { CRM_EXTENDED_AI_TOOL_DEFINITIONS } from './crm-ai-tool-definitions';
import { CompaniesService } from '../companies/companies.service';
import { ContactsService } from '../contacts/contacts.service';
import { SalesService } from '../sales/sales.service';
import type { CreateCompanyDto } from '../companies/dto/create-company.dto';
import type { UpdateCompanyDto } from '../companies/dto/update-company.dto';
import type { CreateContactDto } from '../contacts/dto/create-contact.dto';
import type { UpdateContactDto } from '../contacts/dto/update-contact.dto';
import type { UpdateNoteDto } from '../notes/dto/update-note.dto';
import type { ListSalesQueryDto } from '../sales/dto/list-sales-query.dto';
import { EmailService } from '../email/email.service';
import { AutomationsService } from '../automations/automations.service';
import {
  TriggerEvent,
  ActionType,
} from '../automations/automation.entity';
import type { CreateAutomationDto } from '../automations/dto/create-automation.dto';
import type { UpdateAutomationDto } from '../automations/dto/update-automation.dto';
import type { CreateCompanyTaskDto } from '../companies/dto/create-company-task.dto';
import type { UpdateCompanyTaskDto } from '../companies/dto/update-company-task.dto';
import type { UpdateLeadDto } from '../leads/dto/update-lead.dto';

const WORKSPACE_EXTRA_VIEWS = ['kanban', 'calendar', 'analytics'] as const;

const WORKSPACE_FIELD_TYPES: CustomObjectFieldType[] = [
  'text',
  'number',
  'date',
  'datetime',
  'boolean',
  'status',
  'select',
  'multiselect',
];

export const AI_TOOL_DEFINITIONS: unknown[] = [
  {
    type: 'function',
    function: {
      name: 'crm_list_leads',
      description:
        'Список последних лидов (модуль лидов CRM): имя, статус, источник, email, телефон. Не проекты и не рабочая область.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'Макс. записей (1–50)', default: 15 },
          status: { type: 'string', description: 'Фильтр по статусу (new, won, …)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_search_leads',
      description:
        'Поиск лидов по подстроке в имени, email или телефоне (ILIKE). Возвращает только лиды, видимые пользователю в CRM (как список лидов). Используй для leadId перед встречей/письмом.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Подстрока имени, email или телефона' },
          limit: { type: 'integer', description: 'Макс. результатов (1–30)', default: 15 },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_search_companies',
      description: 'Поиск компаний по названию.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Подстрока названия' },
          limit: { type: 'integer', default: 10 },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_sales_summary',
      description: 'Краткая сводка продаж за период: количество, сумма.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'YYYY-MM-DD' },
          to: { type: 'string', description: 'YYYY-MM-DD' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_marketing_overview',
      description:
        'Агрегированная аналитика маркетинга (трафик/каналы): сессии, лиды, расход, выручка. Чтобы записать каналы в таблицу рабочей области, после просмотра используй crm_workspace_import_marketing_channels.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'YYYY-MM-DD' },
          to: { type: 'string', description: 'YYYY-MM-DD' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_list_integrations',
      description:
        'Все подключения: salesIntegrations — интеграции продаж/импорта (WooCommerce, manual-import и т.д., раздел «Интеграции»); marketingIntegrations — маркетинг и аналитика (Meta/Facebook Ads, GA4, Яндекс.Метрика, Google Ads и т.п., настройки маркетинга). Для вопросов про рекламу/Meta/GA4 обязательно смотри marketingIntegrations.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_list_projects',
      description:
        'Последние проекты в модуле «Проекты» (сделки с суммой/статусом). Это не рабочая область (/workspace).',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 15 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_create_lead',
      description: 'Создать лид в модуле лидов CRM (не проект и не таблица рабочей области).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          source: { type: 'string' },
          status: { type: 'string' },
          country: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_create_note',
      description: 'Добавить заметку к контакту, компании, лиду, сделке или проекту.',
      parameters: {
        type: 'object',
        properties: {
          entityType: {
            type: 'string',
            enum: ['contact', 'company', 'lead', 'sale', 'project'],
          },
          entityId: { type: 'string', description: 'UUID сущности' },
          content: { type: 'string' },
          title: { type: 'string' },
        },
        required: ['entityType', 'entityId', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_create_project',
      description:
        'Создать проект в модуле «Проекты». Не создаёт таблицу в рабочей области (/workspace) — для того есть crm_workspace_create_table.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string' },
          status: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_workspace_list_tables',
      description:
        'Список таблиц рабочей области (раздел /workspace в CRM): пользовательские объекты. Не путать с проектами и лидами.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_workspace_describe_table',
      description:
        'Описание таблицы рабочей области: id, имя, slug, поля (key, label, type). Вызови перед добавлением записей.',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string', description: 'UUID таблицы' },
        },
        required: ['objectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_workspace_create_table',
      description:
        'Создать новую таблицу в рабочей области (/workspace). Если нужно вносить данные — ОБЯЗАТЕЛЬНО передай fields (колонки), иначе таблица будет пустой и crm_workspace_add_record некуда писать. Для выгрузки рекламы/каналов из CRM удобнее crm_workspace_import_marketing_channels.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          enabledViews: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Дополнительно: kanban, calendar, analytics (экран аналитики/отчёта по таблице). Таблица включена всегда.',
          },
          fields: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                label: { type: 'string' },
                type: { type: 'string' },
                required: { type: 'boolean' },
              },
            },
            description:
              'Колонки таблицы (рекомендуется всегда при ручном сценарии). type: text, number, date, datetime, boolean, status, select, multiselect.',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_workspace_add_field',
      description:
        'Добавить колонку в существующую таблицу рабочей области (если таблицу создали без полей).',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string' },
          key: { type: 'string', description: 'Латиница/ключ, например campaign_name' },
          label: { type: 'string', description: 'Подпись в UI' },
          type: {
            type: 'string',
            description:
              'text, number, date, datetime, boolean, status, select, multiselect',
          },
          required: { type: 'boolean' },
        },
        required: ['objectId', 'key', 'label', 'type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_workspace_enable_views',
      description:
        'Включить для таблицы рабочей области экраны канбан, календарь или аналитику (отчёт).',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string' },
          enabledViews: {
            type: 'array',
            items: { type: 'string' },
            description: 'Одно или несколько: kanban, calendar, analytics',
          },
        },
        required: ['objectId', 'enabledViews'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_workspace_add_record',
      description:
        'Добавить строку в таблицу рабочей области. В values — только ключи полей (key) из crm_workspace_describe_table, типы должны совпадать (числа числом). Сначала у таблицы должны быть колонки (fields при создании или crm_workspace_add_field).',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string' },
          values: {
            type: 'object',
            description: 'Значения полей по ключам',
          },
        },
        required: ['objectId', 'values'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_workspace_list_records',
      description: 'Последние записи таблицы рабочей области.',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string' },
          limit: { type: 'integer', description: '1–50', default: 20 },
        },
        required: ['objectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_workspace_analytics',
      description:
        'Сводка по данным таблицы рабочей области: сколько записей, распределение по статусу, по дням. Для запросов вроде «отчёт по таблице».',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string' },
        },
        required: ['objectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_workspace_import_marketing_channels',
      description:
        'Выгрузить в рабочую область строки по рекламе/маркетингу из CRM (агрегаты по каналам: source, medium, campaign, сессии, клики, лиды, выручка, расход и т.д.). Один вызов: создаёт таблицу с колонками и заполняет данными из marketing_traffic. Используй, когда пользователь просит перенести рекламу/каналы/метрику в рабочую область.',
      parameters: {
        type: 'object',
        properties: {
          tableName: { type: 'string', description: 'Название новой таблицы' },
          description: { type: 'string', description: 'Описание таблицы (опционально)' },
          from: { type: 'string', description: 'YYYY-MM-DD начало периода' },
          to: { type: 'string', description: 'YYYY-MM-DD конец периода' },
          maxRows: {
            type: 'integer',
            description: 'Макс. строк каналов (1–300), по умолчанию 120',
          },
        },
        required: ['tableName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_sales_import_apply',
      description:
        'Завершить импорт продаж из CSV после предпросмотра (сессия POST /sales/import/preview). importId — из вложения в чате. Если fieldMapping не указан, подставится suggestedMapping из сессии.',
      parameters: {
        type: 'object',
        properties: {
          importId: { type: 'string' },
          channelId: {
            type: 'string',
            description: 'UUID канала продаж (опционально; иначе из колонки channel или имя файла)',
          },
          fieldMapping: {
            type: 'object',
            description:
              'Соответствие полей CRM → колонка CSV; пустой объект — взять из сессии предпросмотра',
          },
        },
        required: ['importId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_workspace_bulk_add_records',
      description:
        'Добавить до 80 строк в таблицу рабочей области за один вызов (после crm_workspace_create_table). Ключи в каждой записи = key полей.',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string' },
          records: { type: 'array', items: { type: 'object' } },
        },
        required: ['objectId', 'records'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_generate_image',
      description:
        'Сгенерировать или перегенерировать изображение по текстовому описанию (DALL·E). Вызывай, когда пользователь просит нарисовать картинку ИЛИ изменить/переделать недавнюю (другой человек, одежда, стиль, фон). Модель не видит пиксели прошлой картинки — передай полное новое описание сцены с учётом всех правок; для качества промпт лучше на английском.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description:
              'Полное описание сцены для генерации (учти правки пользователя целиком)',
          },
          size: {
            type: 'string',
            enum: ['1024x1024', '1792x1024', '1024x1792'],
            description: 'Размер (по умолчанию 1024x1024)',
          },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_save_memory',
      description:
        'Сохранить фрагмент в долговременную память ассистента для этого клиента (контекст будущих диалогов).',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['content'],
      },
    },
  },
  ...CRM_EXTENDED_AI_TOOL_DEFINITIONS,
];

type ToolCtx = {
  tenantId: string;
  userId: string;
  userEmail?: string;
  /** Как в JWT / GET /leads: owner видит всех лидов, остальные — только «свои». */
  userRole?: string;
};

@Injectable()
export class AiToolsService {
  private readonly log = new Logger(AiToolsService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadsRepo: Repository<Lead>,
    @InjectRepository(Company)
    private readonly companiesRepo: Repository<Company>,
    @InjectRepository(Sale)
    private readonly salesRepo: Repository<Sale>,
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectRepository(IntegrationConnection)
    private readonly intRepo: Repository<IntegrationConnection>,
    @InjectRepository(AiMemoryChunk)
    private readonly memoryRepo: Repository<AiMemoryChunk>,
    private readonly marketing: MarketingService,
    private readonly leadsService: LeadsService,
    private readonly notesService: NotesService,
    private readonly projectsService: ProjectsService,
    private readonly quota: AiQuotaService,
    private readonly customObjects: CustomObjectsService,
    private readonly salesImport: SalesImportService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly openai: AiOpenAiService,
    private readonly companies: CompaniesService,
    private readonly contacts: ContactsService,
    private readonly sales: SalesService,
    private readonly emailService: EmailService,
    private readonly automationsService: AutomationsService,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
  ) {}

  /** Совпадает с LeadsController.isLeadMine — поиск/встречи только по лидам, видимым пользователю в CRM. */
  private isLeadMineForAi(lead: Lead, staff: StaffUser): boolean {
    const staffId = staff.id;
    const fullName = staff.fullName?.trim();
    const l = lead as any;
    if (
      Array.isArray(l.assignedUserIds) &&
      l.assignedUserIds.includes(staffId)
    ) {
      return true;
    }
    if (
      Array.isArray(l.assignedToList) &&
      fullName &&
      l.assignedToList.includes(fullName)
    ) {
      return true;
    }
    if (l.assignedUserId && l.assignedUserId === staffId) {
      return true;
    }
    if (fullName && l.assignedTo && l.assignedTo === fullName) {
      return true;
    }
    return false;
  }

  private async getStaffForToolCtx(ctx: ToolCtx): Promise<StaffUser | null> {
    const email = (ctx.userEmail || '').trim();
    if (!email) return null;
    return this.staffRepo.findOne({
      where: { tenantId: ctx.tenantId, email },
    });
  }

  private async filterLeadsByAccess(ctx: ToolCtx, leads: Lead[]): Promise<Lead[]> {
    if ((ctx.userRole || '').trim() === 'owner') return leads;
    const staff = await this.getStaffForToolCtx(ctx);
    if (!staff) return [];
    return leads.filter((l) => this.isLeadMineForAi(l, staff));
  }

  private async checkLeadAccessible(
    ctx: ToolCtx,
    lead: Lead,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if ((ctx.userRole || '').trim() === 'owner') return { ok: true };
    const staff = await this.getStaffForToolCtx(ctx);
    if (!staff) return { ok: false, error: 'no_staff_profile' };
    if (!this.isLeadMineForAi(lead, staff)) {
      return { ok: false, error: 'lead_not_accessible' };
    }
    return { ok: true };
  }

  async execute(name: string, argsJson: string, ctx: ToolCtx): Promise<string> {
    let args: Record<string, unknown> = {};
    try {
      args = argsJson ? JSON.parse(argsJson) : {};
    } catch {
      return JSON.stringify({ error: 'invalid_json_arguments' });
    }
    try {
      switch (name) {
        case 'crm_list_leads':
          return JSON.stringify(await this.toolListLeads(ctx, args));
        case 'crm_search_leads':
          return JSON.stringify(await this.toolSearchLeads(ctx, args));
        case 'crm_search_companies':
          return JSON.stringify(await this.toolSearchCompanies(ctx.tenantId, args));
        case 'crm_sales_summary':
          return JSON.stringify(await this.toolSalesSummary(ctx.tenantId, args));
        case 'crm_marketing_overview':
          return JSON.stringify(await this.toolMarketing(ctx.tenantId, args));
        case 'crm_list_integrations':
          return JSON.stringify(await this.toolIntegrations(ctx.tenantId));
        case 'crm_list_projects':
          return JSON.stringify(await this.toolProjects(ctx.tenantId, args));
        case 'crm_create_lead':
          return JSON.stringify(
            await this.toolCreateLead(ctx.tenantId, args),
          );
        case 'crm_create_note':
          return JSON.stringify(
            await this.toolCreateNote(ctx.tenantId, ctx.userId, ctx.userEmail, args),
          );
        case 'crm_create_project':
          return JSON.stringify(
            await this.toolCreateProject(ctx.tenantId, ctx.userId, ctx.userEmail, args),
          );
        case 'crm_workspace_list_tables':
          return JSON.stringify(await this.toolWorkspaceListTables(ctx.tenantId));
        case 'crm_workspace_describe_table':
          return JSON.stringify(
            await this.toolWorkspaceDescribeTable(ctx.tenantId, args),
          );
        case 'crm_workspace_create_table':
          return JSON.stringify(await this.toolWorkspaceCreateTable(ctx.tenantId, args));
        case 'crm_workspace_add_field':
          return JSON.stringify(await this.toolWorkspaceAddField(ctx.tenantId, args));
        case 'crm_workspace_enable_views':
          return JSON.stringify(await this.toolWorkspaceEnableViews(ctx.tenantId, args));
        case 'crm_workspace_add_record':
          return JSON.stringify(await this.toolWorkspaceAddRecord(ctx.tenantId, args));
        case 'crm_workspace_list_records':
          return JSON.stringify(await this.toolWorkspaceListRecords(ctx.tenantId, args));
        case 'crm_workspace_analytics':
          return JSON.stringify(await this.toolWorkspaceAnalytics(ctx.tenantId, args));
        case 'crm_workspace_import_marketing_channels':
          return JSON.stringify(
            await this.toolWorkspaceImportMarketingChannels(ctx.tenantId, args),
          );
        case 'crm_sales_import_apply':
          return JSON.stringify(
            await this.toolSalesImportApply(ctx.tenantId, args),
          );
        case 'crm_workspace_bulk_add_records':
          return JSON.stringify(
            await this.toolWorkspaceBulkAddRecords(ctx.tenantId, args),
          );
        case 'crm_get_lead':
          return JSON.stringify(await this.toolGetLead(ctx, args));
        case 'crm_update_lead':
          return JSON.stringify(await this.toolUpdateLead(ctx, args));
        case 'crm_get_project':
          return JSON.stringify(await this.toolGetProject(ctx.tenantId, args));
        case 'crm_update_project':
          return JSON.stringify(
            await this.toolUpdateProject(ctx.tenantId, ctx, args),
          );
        case 'crm_change_project_status':
          return JSON.stringify(
            await this.toolChangeProjectStatus(ctx.tenantId, ctx, args),
          );
        case 'crm_soft_delete_project':
          return JSON.stringify(
            await this.toolSoftDeleteProject(ctx.tenantId, ctx, args),
          );
        case 'crm_list_sales':
          return JSON.stringify(await this.toolListSales(ctx.tenantId, args));
        case 'crm_get_sale':
          return JSON.stringify(await this.toolGetSale(ctx.tenantId, args));
        case 'crm_update_sale':
          return JSON.stringify(await this.toolUpdateSale(ctx.tenantId, args));
        case 'crm_create_company':
          return JSON.stringify(await this.toolCreateCompany(ctx.tenantId, args));
        case 'crm_get_company':
          return JSON.stringify(await this.toolGetCompany(ctx.tenantId, args));
        case 'crm_update_company':
          return JSON.stringify(await this.toolUpdateCompany(ctx.tenantId, args));
        case 'crm_delete_company':
          return JSON.stringify(await this.toolDeleteCompany(ctx.tenantId, args));
        case 'crm_list_contacts':
          return JSON.stringify(await this.toolListContacts(ctx.tenantId, args));
        case 'crm_get_contact':
          return JSON.stringify(await this.toolGetContact(ctx.tenantId, args));
        case 'crm_create_contact':
          return JSON.stringify(await this.toolCreateContact(ctx.tenantId, args));
        case 'crm_update_contact':
          return JSON.stringify(await this.toolUpdateContact(ctx.tenantId, args));
        case 'crm_delete_contact':
          return JSON.stringify(await this.toolDeleteContact(ctx.tenantId, args));
        case 'crm_list_notes':
          return JSON.stringify(await this.toolListNotes(ctx.tenantId, ctx, args));
        case 'crm_update_note':
          return JSON.stringify(
            await this.toolUpdateNote(ctx.tenantId, ctx, args),
          );
        case 'crm_delete_note':
          return JSON.stringify(
            await this.toolDeleteNote(ctx.tenantId, ctx, args),
          );
        case 'crm_workspace_update_record':
          return JSON.stringify(
            await this.toolWorkspaceUpdateRecord(ctx.tenantId, args),
          );
        case 'crm_workspace_delete_record':
          return JSON.stringify(
            await this.toolWorkspaceDeleteRecord(ctx.tenantId, args),
          );
        case 'crm_sync_marketing_integration':
          return JSON.stringify(
            await this.toolSyncMarketingIntegration(ctx.tenantId, args),
          );
        case 'crm_generate_image':
          return JSON.stringify(
            await this.toolGenerateImage(ctx.tenantId, ctx.userId, args),
          );
        case 'crm_save_memory':
          return JSON.stringify(
            await this.toolSaveMemory(ctx.tenantId, ctx.userId, args),
          );
        case 'crm_list_company_tasks':
          return JSON.stringify(
            await this.toolListCompanyTasks(ctx.tenantId, args),
          );
        case 'crm_create_company_task':
          return JSON.stringify(
            await this.toolCreateCompanyTask(ctx.tenantId, args),
          );
        case 'crm_update_company_task':
          return JSON.stringify(
            await this.toolUpdateCompanyTask(ctx.tenantId, args),
          );
        case 'crm_delete_company_task':
          return JSON.stringify(
            await this.toolDeleteCompanyTask(ctx.tenantId, args),
          );
        case 'crm_list_lead_meetings':
          return JSON.stringify(await this.toolListLeadMeetings(ctx, args));
        case 'crm_add_lead_meeting':
          return JSON.stringify(await this.toolAddLeadMeeting(ctx, args));
        case 'crm_update_lead_meeting':
          return JSON.stringify(
            await this.toolUpdateLeadMeeting(ctx, args),
          );
        case 'crm_remove_lead_meeting':
          return JSON.stringify(
            await this.toolRemoveLeadMeeting(ctx, args),
          );
        case 'crm_list_email_accounts':
          return JSON.stringify(await this.toolListEmailAccounts(ctx.tenantId));
        case 'crm_list_email_templates':
          return JSON.stringify(await this.toolListEmailTemplates(ctx.tenantId, args));
        case 'crm_preview_email_template':
          return JSON.stringify(
            await this.toolPreviewEmailTemplate(ctx.tenantId, args),
          );
        case 'crm_draft_client_email':
          return JSON.stringify(await this.toolDraftClientEmail(ctx.tenantId, args));
        case 'crm_send_approved_client_email':
          return JSON.stringify(
            await this.toolSendApprovedClientEmail(ctx.tenantId, args),
          );
        case 'crm_list_automations':
          return JSON.stringify(await this.toolListAutomations(ctx.tenantId, args));
        case 'crm_create_automation':
          return JSON.stringify(await this.toolCreateAutomation(ctx.tenantId, args));
        case 'crm_update_automation':
          return JSON.stringify(await this.toolUpdateAutomation(ctx.tenantId, args));
        case 'crm_delete_automation':
          return JSON.stringify(await this.toolDeleteAutomation(ctx.tenantId, args));
        default:
          return JSON.stringify({ error: 'unknown_tool', name });
      }
    } catch (e: any) {
      this.log.warn(`Tool ${name} failed: ${e?.message || e}`);
      return JSON.stringify({
        error: e?.message || 'tool_failed',
        tool: name,
      });
    }
  }

  private async toolListLeads(ctx: ToolCtx, args: Record<string, unknown>) {
    const limit = Math.min(50, Math.max(1, Number(args.limit) || 15));
    const status = args.status ? String(args.status) : undefined;
    const fetchCap = Math.min(250, Math.max(limit * 10, limit));
    const qb = this.leadsRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId: ctx.tenantId })
      .orderBy('l.createdAt', 'DESC')
      .take(fetchCap);
    if (status) qb.andWhere('l.status = :status', { status });
    const rows = await qb.getMany();
    const filtered = await this.filterLeadsByAccess(ctx, rows);
    const sliced = filtered.slice(0, limit);
    return {
      leads: sliced.map((l) => ({
        id: l.id,
        name: l.name,
        status: l.status,
        source: l.source,
        email: l.email,
        phone: l.phone,
        createdAt: l.createdAt,
      })),
    };
  }

  private async toolSearchLeads(ctx: ToolCtx, args: Record<string, unknown>) {
    const q = String(args.query || '').trim();
    const limit = Math.min(30, Math.max(1, Number(args.limit) || 15));
    if (!q) {
      return { ok: false, error: 'query_required', leads: [] };
    }
    const like = `%${q}%`;
    const fetchCap = Math.min(250, Math.max(limit * 10, limit));
    const rows = await this.leadsRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId: ctx.tenantId })
      .andWhere(
        '(COALESCE(l.name, \'\') ILIKE :like OR COALESCE(l.email, \'\') ILIKE :like OR COALESCE(l.phone, \'\') ILIKE :like)',
        { like },
      )
      .orderBy('l.updatedAt', 'DESC')
      .take(fetchCap)
      .getMany();
    const filtered = await this.filterLeadsByAccess(ctx, rows);
    const sliced = filtered.slice(0, limit);
    return {
      ok: true,
      leads: sliced.map((l) => ({
        id: l.id,
        name: l.name,
        status: l.status,
        source: l.source,
        email: l.email,
        phone: l.phone,
        createdAt: l.createdAt,
      })),
    };
  }

  private async toolSearchCompanies(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const q = String(args.query || '').trim();
    const limit = Math.min(30, Math.max(1, Number(args.limit) || 10));
    if (!q) return { companies: [] };
    const rows = await this.companiesRepo.find({
      where: { tenantId, name: ILike(`%${q}%`) },
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return {
      companies: rows.map((c) => ({
        id: c.id,
        name: c.name,
        industry: c.industry,
      })),
    };
  }

  private async toolSalesSummary(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const qb = this.salesRepo
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId });
    if (args.from) qb.andWhere('s.purchaseDate >= :from', { from: args.from });
    if (args.to) qb.andWhere('s.purchaseDate <= :to', { to: args.to });
    const raw = await qb
      .select('COUNT(s.id)', 'cnt')
      .addSelect('COALESCE(SUM(s.amount),0)', 'sum')
      .getRawOne();
    return {
      count: Number(raw?.cnt || 0),
      totalAmount: Number(raw?.sum || 0),
    };
  }

  private async toolMarketing(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const from = args.from ? String(args.from) : undefined;
    const to = args.to ? String(args.to) : undefined;
    const stats = await this.marketing.getTrafficChannelsStats(
      tenantId,
      from,
      to,
    );
    return {
      from: stats.from,
      to: stats.to,
      currency: stats.currency,
      totalSessions: stats.totalSessions,
      totalLeads: stats.totalLeads,
      totalRevenue: stats.totalRevenue,
      totalCost: stats.totalCost,
      providerBreakdown: stats.providerBreakdown?.slice(0, 12) || [],
      topChannels: (stats.items || []).slice(0, 15).map((i) => ({
        campaign: i.campaign,
        source: i.source,
        medium: i.medium,
        sessions: i.sessions,
        leads: i.leads,
        revenue: i.revenue,
        cost: i.cost,
      })),
    };
  }

  private async toolIntegrations(tenantId: string) {
    const [salesRows, marketingRows] = await Promise.all([
      this.intRepo.find({
        where: { tenantId, isDeleted: false },
        order: { createdAt: 'DESC' },
        take: 40,
      }),
      this.marketing.listMarketingIntegrations(tenantId),
    ]);
    const marketingSlice = marketingRows.slice(0, 40);
    return {
      salesIntegrations: salesRows.map((r) => ({
        id: r.id,
        kind: r.kind,
        name: r.name,
        enabled: r.isEnabled,
        lastSyncStatus: r.lastSyncStatus,
      })),
      marketingIntegrations: marketingSlice.map((m) => ({
        id: m.id,
        provider: m.provider,
        kind: m.kind,
        name: m.name,
        active: m.isActive,
        primaryId: m.primaryId,
        updatedAt: m.updatedAt,
      })),
      /** Совместимость: раньше был только один массив integrations (= продажи). */
      integrations: salesRows.map((r) => ({
        id: r.id,
        kind: r.kind,
        name: r.name,
        enabled: r.isEnabled,
        lastSyncStatus: r.lastSyncStatus,
      })),
    };
  }

  private async toolProjects(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const limit = Math.min(40, Math.max(1, Number(args.limit) || 15));
    const rows = await this.projectsRepo.find({
      where: { tenantId },
      order: { updatedAt: 'DESC' },
      take: limit,
    });
    return {
      projects: rows.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        amount: p.amount,
        currency: p.currency,
      })),
    };
  }

  private async toolCreateLead(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const lead = await this.leadsService.createForTenant(tenantId, {
      name: String(args.name || 'Без имени'),
      email: args.email ? String(args.email) : undefined,
      phone: args.phone ? String(args.phone) : undefined,
      source: args.source ? String(args.source) : 'ai_assistant',
      status: args.status ? String(args.status) : 'new',
      country: args.country ? String(args.country) : undefined,
    });
    return {
      ok: true,
      leadId: lead.id,
      message: `Лид создан: ${lead.name} (${lead.id})`,
    };
  }

  private async toolCreateNote(
    tenantId: string,
    userId: string,
    userEmail: string | undefined,
    args: Record<string, unknown>,
  ) {
    const entityType = String(args.entityType || '') as EntityType;
    if (!Object.values(EntityType).includes(entityType)) {
      return { ok: false, error: 'invalid_entityType' };
    }
    const note = await this.notesService.create(
      tenantId,
      {
        entityType,
        entityId: String(args.entityId),
        content: String(args.content || ''),
        title: args.title ? String(args.title) : undefined,
      },
      userId,
      userEmail,
    );
    return { ok: true, noteId: note.id };
  }

  private async toolCreateProject(
    tenantId: string,
    userId: string,
    userEmail: string | undefined,
    args: Record<string, unknown>,
  ) {
    const amt =
      args.amount != null && args.amount !== ''
        ? String(Number(args.amount))
        : '0';
    const allowed: ProjectStatus[] = [
      'Новый',
      'В работе',
      'На проверке',
      'Заморожен',
      'Закрыт',
      'Выиграно',
      'Проиграно',
    ];
    const rawStatus = args.status ? String(args.status).trim() : '';
    const status: ProjectStatus = allowed.includes(rawStatus as ProjectStatus)
      ? (rawStatus as ProjectStatus)
      : 'Новый';
    const proj = await this.projectsService.createForTenant(
      tenantId,
      {
        name: String(args.name || 'Проект'),
        description: args.description ? String(args.description) : undefined,
        amount: amt,
        currency: args.currency ? String(args.currency) : 'EUR',
        status,
      },
      { userId, email: userEmail },
    );
    return { ok: true, projectId: proj.id, name: proj.name };
  }

  private mergeWorkspaceEnabledViews(
    meta: Record<string, unknown> | null | undefined,
    extra: string[],
  ): string[] {
    const ev = new Set<string>(['table']);
    const existing = meta?.enabledViews;
    if (Array.isArray(existing)) {
      for (const x of existing) ev.add(String(x));
    }
    for (const x of extra) {
      const s = String(x).toLowerCase();
      if ((WORKSPACE_EXTRA_VIEWS as readonly string[]).includes(s)) ev.add(s);
    }
    return [...ev];
  }

  private async toolWorkspaceListTables(tenantId: string) {
    const rows = await this.customObjects.listObjects(tenantId);
    return {
      tables: rows.map((o) => ({
        objectId: o.id,
        name: o.name,
        slug: o.slug,
        description: o.description,
        updatedAt: o.updatedAt,
      })),
    };
  }

  private async toolWorkspaceDescribeTable(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const objectId = String(args.objectId || '').trim();
    if (!objectId) return { ok: false, error: 'objectId_required' };
    try {
      const o = await this.customObjects.getObject(tenantId, objectId);
      const fields = await this.customObjects.listFields(tenantId, objectId);
      const meta =
        o.meta && typeof o.meta === 'object' && !Array.isArray(o.meta)
          ? (o.meta as Record<string, unknown>)
          : {};
      return {
        ok: true,
        objectId: o.id,
        name: o.name,
        slug: o.slug,
        description: o.description,
        enabledViews: Array.isArray(meta.enabledViews)
          ? meta.enabledViews
          : ['table'],
        fields: fields.map((f) => ({
          id: f.id,
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required,
        })),
      };
    } catch {
      return { ok: false, error: 'table_not_found' };
    }
  }

  private async toolWorkspaceCreateTable(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const name = String(args.name || '').trim();
    if (!name) return { ok: false, error: 'name_required' };
    const description = args.description
      ? String(args.description).trim()
      : undefined;
    const extra: string[] = [];
    if (Array.isArray(args.enabledViews)) {
      for (const x of args.enabledViews) {
        const s = String(x).toLowerCase();
        if ((WORKSPACE_EXTRA_VIEWS as readonly string[]).includes(s)) {
          extra.push(s);
        }
      }
    }
    const meta = { enabledViews: this.mergeWorkspaceEnabledViews({}, extra) };
    let fields: NonNullable<CreateCustomObjectDto['fields']> | undefined;
    if (Array.isArray(args.fields) && args.fields.length) {
      fields = [];
      for (const raw of args.fields) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const r = raw as Record<string, unknown>;
        const key = String(r.key || '').trim();
        const label = String(r.label || '').trim();
        const t = String(r.type || '').trim();
        if (!key || !label) continue;
        if (!WORKSPACE_FIELD_TYPES.includes(t as CustomObjectFieldType)) {
          return {
            ok: false,
            error: 'invalid_field_type',
            fieldKey: key,
            type: t,
            allowed: WORKSPACE_FIELD_TYPES,
          };
        }
        fields.push({
          key,
          label,
          type: t as CustomObjectFieldType,
          required: Boolean(r.required),
        });
      }
    }
    const dto: CreateCustomObjectDto = {
      name,
      description,
      meta,
      ...(fields?.length ? { fields } : {}),
    };
    const created = await this.customObjects.createObject(tenantId, dto);
    const hasAnalytics = (meta.enabledViews as string[]).includes('analytics');
    return {
      ok: true,
      objectId: created.id,
      name: created.name,
      slug: created.slug,
      tableUrlPath: `/workspace/${created.id}/table`,
      analyticsUrlPath: hasAnalytics
        ? `/workspace/${created.id}/analytics`
        : null,
    };
  }

  private async toolWorkspaceEnableViews(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const objectId = String(args.objectId || '').trim();
    if (!objectId) return { ok: false, error: 'objectId_required' };
    const raw = args.enabledViews;
    if (!Array.isArray(raw) || !raw.length) {
      return { ok: false, error: 'enabledViews_required' };
    }
    const extra: string[] = [];
    for (const x of raw) {
      const s = String(x).toLowerCase();
      if ((WORKSPACE_EXTRA_VIEWS as readonly string[]).includes(s)) extra.push(s);
    }
    if (!extra.length) return { ok: false, error: 'no_valid_views' };
    try {
      const o = await this.customObjects.getObject(tenantId, objectId);
      const prev =
        o.meta && typeof o.meta === 'object' && !Array.isArray(o.meta)
          ? (o.meta as Record<string, unknown>)
          : {};
      const meta = {
        ...prev,
        enabledViews: this.mergeWorkspaceEnabledViews(prev, extra),
      };
      await this.customObjects.updateObject(tenantId, objectId, { meta });
      const ev = meta.enabledViews as string[];
      return {
        ok: true,
        objectId,
        enabledViews: ev,
        analyticsUrlPath: ev.includes('analytics')
          ? `/workspace/${objectId}/analytics`
          : null,
      };
    } catch {
      return { ok: false, error: 'table_not_found' };
    }
  }

  private async toolWorkspaceAddRecord(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const objectId = String(args.objectId || '').trim();
    if (!objectId) return { ok: false, error: 'objectId_required' };
    const values = args.values;
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return { ok: false, error: 'values_must_be_object' };
    }
    try {
      const rec = await this.customObjects.createRecord(tenantId, objectId, {
        values: values as Record<string, any>,
      });
      return { ok: true, recordId: rec.id, objectId };
    } catch (e: any) {
      return {
        ok: false,
        error: e?.message || 'create_record_failed',
        objectId,
      };
    }
  }

  private async toolWorkspaceListRecords(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const objectId = String(args.objectId || '').trim();
    if (!objectId) return { ok: false, error: 'objectId_required' };
    const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
    try {
      const { items, total } = await this.customObjects.listRecords(
        tenantId,
        objectId,
        { limit },
      );
      return {
        ok: true,
        total,
        records: items.map((r) => ({
          id: r.id,
          values: r.values,
          updatedAt: r.updatedAt,
        })),
      };
    } catch {
      return { ok: false, error: 'table_not_found' };
    }
  }

  private async toolWorkspaceAnalytics(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const objectId = String(args.objectId || '').trim();
    if (!objectId) return { ok: false, error: 'objectId_required' };
    try {
      const a = await this.customObjects.getAnalytics(tenantId, objectId);
      return {
        ok: true,
        objectId,
        totalRecords: a.totalRecords,
        byStatus: a.byStatus,
        byDay: a.byDay,
        analyticsPath: `/workspace/${objectId}/analytics`,
      };
    } catch {
      return { ok: false, error: 'table_not_found' };
    }
  }

  private async toolWorkspaceAddField(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const objectId = String(args.objectId || '').trim();
    if (!objectId) return { ok: false, error: 'objectId_required' };
    const key = String(args.key || '').trim();
    const label = String(args.label || '').trim();
    const type = String(args.type || '').trim();
    if (!key || !label) return { ok: false, error: 'key_and_label_required' };
    if (!WORKSPACE_FIELD_TYPES.includes(type as CustomObjectFieldType)) {
      return {
        ok: false,
        error: 'invalid_field_type',
        allowed: WORKSPACE_FIELD_TYPES,
      };
    }
    try {
      const f = await this.customObjects.createField(tenantId, objectId, {
        key,
        label,
        type: type as CustomObjectFieldType,
        required: Boolean(args.required),
      });
      return {
        ok: true,
        fieldId: f.id,
        key: f.key,
        label: f.label,
        type: f.type,
      };
    } catch (e: any) {
      return {
        ok: false,
        error: e?.message || 'create_field_failed',
      };
    }
  }

  private async toolWorkspaceImportMarketingChannels(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const tableName = String(args.tableName || '').trim();
    if (!tableName) return { ok: false, error: 'tableName_required' };
    const from = args.from ? String(args.from) : undefined;
    const to = args.to ? String(args.to) : undefined;
    const maxRows = Math.min(300, Math.max(1, Number(args.maxRows) || 120));
    const description = args.description
      ? String(args.description).trim()
      : undefined;

    const itemsLimit = Math.min(50_000, Math.max(maxRows * 15, 6_000));
    const stats = await this.marketing.getTrafficChannelsStats(
      tenantId,
      from,
      to,
      undefined,
      itemsLimit,
    );

    const items = (stats.items || []).slice(0, maxRows);
    if (!items.length) {
      return {
        ok: false,
        error: 'no_marketing_channel_rows',
        hint:
          'В CRM нет агрегированных строк по каналам за выбранный период (таблица marketing_traffic пуста или даты не попадают в данные). Проверьте период и импорт трафика / интеграции.',
        period: { from: stats.from, to: stats.to },
        totalRawRowsInDb: stats.totalRows,
        dataSources: stats.dataSources || [],
      };
    }

    const columnDefs: Array<{
      key: string;
      label: string;
      type: CustomObjectFieldType;
      order: number;
    }> = [
      { key: 'data_source', label: 'Источник данных', type: 'text', order: 0 },
      { key: 'source', label: 'Source', type: 'text', order: 1 },
      { key: 'medium', label: 'Medium', type: 'text', order: 2 },
      { key: 'campaign', label: 'Кампания', type: 'text', order: 3 },
      { key: 'sessions', label: 'Сессии', type: 'number', order: 4 },
      { key: 'clicks', label: 'Клики', type: 'number', order: 5 },
      { key: 'leads', label: 'Лиды', type: 'number', order: 6 },
      { key: 'revenue', label: 'Выручка', type: 'number', order: 7 },
      { key: 'impressions', label: 'Показы', type: 'number', order: 8 },
      { key: 'cost', label: 'Расход', type: 'number', order: 9 },
      { key: 'currency', label: 'Валюта', type: 'text', order: 10 },
    ];

    const dto: CreateCustomObjectDto = {
      name: tableName,
      description:
        description ||
        'Каналы маркетинга / рекламы (выгрузка из CRM, marketing_traffic)',
      meta: { enabledViews: ['table', 'analytics'] },
      fields: columnDefs.map((c) => ({
        key: c.key,
        label: c.label,
        type: c.type,
        required: false,
        order: c.order,
      })),
    };

    const created = await this.customObjects.createObject(tenantId, dto);
    let recordsImported = 0;
    const importErrors: string[] = [];

    for (const it of items) {
      try {
        await this.customObjects.createRecord(tenantId, created.id, {
          values: {
            data_source: it.dataSource ?? '',
            source: it.source ?? '',
            medium: it.medium ?? '',
            campaign: it.campaign ?? '',
            sessions: it.sessions,
            clicks: it.clicks,
            leads: it.leads,
            revenue: it.revenue,
            impressions: it.impressions,
            cost: it.cost,
            currency: it.currency ?? '',
          },
        });
        recordsImported += 1;
      } catch (e: any) {
        importErrors.push(e?.message || String(e));
        if (importErrors.length >= 8) break;
      }
    }

    return {
      ok: true,
      objectId: created.id,
      name: created.name,
      slug: created.slug,
      recordsImported,
      recordsAvailable: items.length,
      importErrors: importErrors.length ? importErrors : undefined,
      period: { from: stats.from, to: stats.to },
      reportCurrency: stats.currency,
      totalsFromCrm: {
        sessions: stats.totalSessions,
        leads: stats.totalLeads,
        revenue: stats.totalRevenue,
        cost: stats.totalCost,
        clicks: stats.totalClicks,
        impressions: stats.totalImpressions,
      },
      tableUrlPath: `/workspace/${created.id}/table`,
      analyticsUrlPath: `/workspace/${created.id}/analytics`,
    };
  }

  private async toolSalesImportApply(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const importId = String(args.importId || '').trim();
    if (!importId) return { ok: false, error: 'importId_required' };
    let fieldMapping = args.fieldMapping as
      | Record<string, string | null>
      | undefined;
    const explicit =
      fieldMapping &&
      Object.values(fieldMapping).some(
        (v) => v != null && String(v).trim().length > 0,
      );
    if (!explicit) {
      const meta = await this.salesImport.getImportSession(importId);
      if (!meta) return { ok: false, error: 'import_session_not_found' };
      if (meta.status === 'applied') {
        return { ok: false, error: 'import_already_applied' };
      }
      fieldMapping = meta.suggestedMapping || {};
    }
    const channelId = args.channelId ? String(args.channelId).trim() : undefined;
    try {
      return await this.salesImport.apply(
        {
          importId,
          channelId: channelId || undefined,
          fieldMapping: fieldMapping!,
        },
        tenantId,
      );
    } catch (e: any) {
      return { ok: false, error: e?.message || 'apply_failed' };
    }
  }

  private async toolWorkspaceBulkAddRecords(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const objectId = String(args.objectId || '').trim();
    const records = args.records;
    if (!objectId) return { ok: false, error: 'objectId_required' };
    if (!Array.isArray(records) || !records.length) {
      return { ok: false, error: 'records_required' };
    }
    const max = Math.min(80, records.length);
    let created = 0;
    const rowErrors: Array<{ index: number; error: string }> = [];
    for (let i = 0; i < max; i++) {
      const row = records[i];
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        rowErrors.push({ index: i, error: 'invalid_row' });
        continue;
      }
      try {
        await this.customObjects.createRecord(tenantId, objectId, {
          values: row as Record<string, any>,
        });
        created += 1;
      } catch (e: any) {
        rowErrors.push({
          index: i,
          error: e?.message || String(e),
        });
        if (rowErrors.length >= 20) break;
      }
    }
    return {
      ok: true,
      objectId,
      created,
      attempted: max,
      errors: rowErrors.length ? rowErrors : undefined,
    };
  }

  private async toolGenerateImage(
    tenantId: string,
    userId: string,
    args: Record<string, unknown>,
  ) {
    const prompt = String(args.prompt || '').trim();
    if (!prompt.length) return { ok: false, error: 'empty_prompt' };
    const rawSize = args.size ? String(args.size) : '';
    const allowed = ['1024x1024', '1792x1024', '1024x1792'] as const;
    const size = (allowed as readonly string[]).includes(rawSize)
      ? (rawSize as (typeof allowed)[number])
      : undefined;
    const cfg = await this.platformSettings.getSettings();
    const cost =
      cfg?.aiImageCostCents != null && cfg.aiImageCostCents > 0
        ? cfg.aiImageCostCents
        : 8;
    const img = await this.openai.generateImage({ prompt, size });
    await this.quota.chargeCents(tenantId, cost, {
      userId,
      kind: 'image',
      model: cfg?.openAiImageModel || 'dall-e-3',
      promptTokens: 0,
      completionTokens: 0,
    });
    return {
      ok: true,
      url: img.url,
      revised_prompt: img.revised_prompt,
    };
  }

  private async toolSaveMemory(
    tenantId: string,
    userId: string,
    args: Record<string, unknown>,
  ) {
    const content = String(args.content || '').trim();
    if (!content) return { ok: false, error: 'empty_content' };
    const addBytes = BigInt(Buffer.byteLength(content, 'utf8'));
    await this.quota.assertStorageHeadroom(tenantId, addBytes);
    const chunk = this.memoryRepo.create({
      tenantId,
      userId,
      title: args.title ? String(args.title).slice(0, 500) : null,
      content: content.slice(0, 50_000),
    });
    await this.memoryRepo.save(chunk);
    await this.quota.addStorageUsedBytes(tenantId, addBytes);
    return { ok: true, memoryId: chunk.id };
  }

  private pickArgs(
    args: Record<string, unknown>,
    omit: string[],
  ): Record<string, unknown> {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args)) {
      if (omit.includes(k) || v === undefined) continue;
      o[k] = v;
    }
    return o;
  }

  private serializeLead(l: Lead) {
    return {
      id: l.id,
      tenantId: l.tenantId,
      name: l.name,
      phone: l.phone,
      email: l.email,
      country: l.country,
      status: l.status,
      source: l.source,
      utmSource: l.utmSource,
      utmMedium: l.utmMedium,
      utmCampaign: l.utmCampaign,
      utmContent: l.utmContent,
      utmTerm: l.utmTerm,
      contactId: l.contactId,
      companyId: l.companyId,
      siteId: l.siteId,
      assignedUserId: l.assignedUserId,
      assignedUserIds: l.assignedUserIds,
      assignedTo: l.assignedTo,
      assignedToList: l.assignedToList,
      meta: l.meta,
      customFields: l.customFields,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    };
  }

  private serializeProject(p: Project) {
    return {
      id: p.id,
      tenantId: p.tenantId,
      name: p.name,
      description: p.description,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      category: p.category,
      tags: p.tags,
      leadId: p.leadId,
      companyId: p.companyId,
      contactId: p.contactId,
      ownerName: p.ownerName,
      ownerUserId: p.ownerUserId,
      ownerUserIds: p.ownerUserIds,
      relatedProjectIds: p.relatedProjectIds,
      briefFileName: p.briefFileName,
      briefFileUrl: p.briefFileUrl,
      tasks: p.tasks,
      comments: p.comments,
      customFields: p.customFields,
      isArchived: p.isArchived,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  private async toolGetLead(ctx: ToolCtx, args: Record<string, unknown>) {
    const id = String(args.leadId || '').trim();
    if (!id) return { ok: false, error: 'leadId_required' };
    const lead = await this.leadsService.findOneForTenant(ctx.tenantId, id);
    const acc = await this.checkLeadAccessible(ctx, lead);
    if (!acc.ok) return { ok: false, error: acc.error };
    return { ok: true, lead: this.serializeLead(lead) };
  }

  private async toolUpdateLead(ctx: ToolCtx, args: Record<string, unknown>) {
    const id = String(args.leadId || '').trim();
    if (!id) return { ok: false, error: 'leadId_required' };
    const existing = await this.leadsService.findOneForTenant(ctx.tenantId, id);
    const acc = await this.checkLeadAccessible(ctx, existing);
    if (!acc.ok) return { ok: false, error: acc.error };
    const patch = this.pickArgs(args, ['leadId']);
    if (!Object.keys(patch).length) return { ok: false, error: 'no_fields_to_update' };
    const updated = await this.leadsService.updateForTenant(
      ctx.tenantId,
      id,
      patch as any,
    );
    return { ok: true, lead: this.serializeLead(updated) };
  }

  private async toolGetProject(tenantId: string, args: Record<string, unknown>) {
    const id = String(args.projectId || '').trim();
    if (!id) return { ok: false, error: 'projectId_required' };
    const p = await this.projectsService.findOneForTenant(tenantId, id);
    return { ok: true, project: this.serializeProject(p) };
  }

  private async toolUpdateProject(
    tenantId: string,
    ctx: ToolCtx,
    args: Record<string, unknown>,
  ) {
    const id = String(args.projectId || '').trim();
    if (!id) return { ok: false, error: 'projectId_required' };
    const patch = this.pickArgs(args, ['projectId']);
    if (patch.amount !== undefined && typeof patch.amount === 'number') {
      patch.amount = String(patch.amount);
    }
    if (!Object.keys(patch).length) return { ok: false, error: 'no_fields_to_update' };
    const actor = { userId: ctx.userId, email: ctx.userEmail };
    const updated = await this.projectsService.updateForTenant(
      tenantId,
      id,
      patch as any,
      actor,
    );
    return { ok: true, project: this.serializeProject(updated) };
  }

  private readonly allowedProjectStatuses: ProjectStatus[] = [
    'Новый',
    'В работе',
    'На проверке',
    'Заморожен',
    'Закрыт',
    'Выиграно',
    'Проиграно',
  ];

  private async toolChangeProjectStatus(
    tenantId: string,
    ctx: ToolCtx,
    args: Record<string, unknown>,
  ) {
    const id = String(args.projectId || '').trim();
    const status = String(args.status || '').trim() as ProjectStatus;
    if (!id) return { ok: false, error: 'projectId_required' };
    if (!this.allowedProjectStatuses.includes(status)) {
      return {
        ok: false,
        error: 'invalid_status',
        allowed: this.allowedProjectStatuses,
      };
    }
    const actor = { userId: ctx.userId, email: ctx.userEmail };
    const updated = await this.projectsService.changeStatusForTenant(
      tenantId,
      id,
      status,
      actor,
    );
    return { ok: true, project: this.serializeProject(updated) };
  }

  private async toolSoftDeleteProject(
    tenantId: string,
    ctx: ToolCtx,
    args: Record<string, unknown>,
  ) {
    const id = String(args.projectId || '').trim();
    if (!id) return { ok: false, error: 'projectId_required' };
    const actor = { userId: ctx.userId, email: ctx.userEmail };
    await this.projectsService.softDeleteForTenant(tenantId, id, actor);
    return { ok: true, projectId: id, deleted: true };
  }

  private async toolListSales(tenantId: string, args: Record<string, unknown>) {
    const query: ListSalesQueryDto = {
      page: Math.min(100, Math.max(1, Number(args.page) || 1)),
      pageSize: Math.min(50, Math.max(1, Number(args.pageSize) || 25)),
      from: args.from ? String(args.from) : undefined,
      to: args.to ? String(args.to) : undefined,
      status: args.status ? (String(args.status) as any) : undefined,
      channelId: args.channelId ? String(args.channelId) : undefined,
      search: args.search ? String(args.search) : undefined,
    };
    const res = await this.sales.list(tenantId, query);
    return {
      ok: true,
      total: res.total,
      page: res.page,
      pageSize: res.pageSize,
      sales: res.items.map((s) => ({
        id: s.id,
        amount: s.amount,
        currency: s.currency,
        status: s.status,
        saleDate: s.saleDate,
        channelId: s.channelId,
        externalId: s.externalId,
        agentName: s.agentName,
        hotel: s.hotel,
        createdAt: s.createdAt,
      })),
    };
  }

  private async toolGetSale(tenantId: string, args: Record<string, unknown>) {
    const id = String(args.saleId || '').trim();
    if (!id) return { ok: false, error: 'saleId_required' };
    const detail = await this.sales.findOneDetailed(tenantId, id);
    return { ok: true, ...detail };
  }

  private async toolUpdateSale(tenantId: string, args: Record<string, unknown>) {
    const id = String(args.saleId || '').trim();
    if (!id) return { ok: false, error: 'saleId_required' };
    const patch = this.pickArgs(args, ['saleId']);
    if (!Object.keys(patch).length) return { ok: false, error: 'no_fields_to_update' };
    const updated = await this.sales.update(tenantId, id, patch as any);
    return {
      ok: true,
      sale: {
        id: updated.id,
        status: updated.status,
        amount: updated.amount,
        saleDate: updated.saleDate,
        notes: (updated as any).notes,
        managerName: (updated as any).managerName,
      },
    };
  }

  private async toolCreateCompany(tenantId: string, args: Record<string, unknown>) {
    const name = String(args.name || '').trim();
    if (!name) return { ok: false, error: 'name_required' };
    const dto = { ...this.pickArgs(args, []), name } as unknown as CreateCompanyDto;
    const c = await this.companies.create(tenantId, dto);
    return { ok: true, company: { id: c.id, name: c.name } };
  }

  private async toolGetCompany(tenantId: string, args: Record<string, unknown>) {
    const id = String(args.companyId || '').trim();
    if (!id) return { ok: false, error: 'companyId_required' };
    const c = await this.companies.findOne(tenantId, id);
    return {
      ok: true,
      company: {
        id: c.id,
        name: c.name,
        legalName: c.legalName,
        email: c.email,
        phone: c.phone,
        website: c.website,
        country: c.country,
        city: c.city,
        industry: c.industry,
        status: c.status,
        tags: c.tags,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      },
    };
  }

  private async toolUpdateCompany(tenantId: string, args: Record<string, unknown>) {
    const id = String(args.companyId || '').trim();
    if (!id) return { ok: false, error: 'companyId_required' };
    const patch = this.pickArgs(args, ['companyId']) as UpdateCompanyDto;
    if (!Object.keys(patch).length) return { ok: false, error: 'no_fields_to_update' };
    const c = await this.companies.update(tenantId, id, patch);
    return { ok: true, company: { id: c.id, name: c.name } };
  }

  private async toolDeleteCompany(tenantId: string, args: Record<string, unknown>) {
    const id = String(args.companyId || '').trim();
    if (!id) return { ok: false, error: 'companyId_required' };
    await this.companies.delete(tenantId, id);
    return { ok: true, companyId: id, deleted: true };
  }

  private async toolListContacts(tenantId: string, args: Record<string, unknown>) {
    const limit = Math.min(80, Math.max(1, Number(args.limit) || 30));
    const search = args.search ? String(args.search) : undefined;
    const { items, total } = await this.contacts.findAll(tenantId, {
      search,
      limit,
    });
    return {
      ok: true,
      total,
      contacts: items.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        email: c.email,
        phone: c.phone,
        companyId: c.companyId,
        status: c.status,
        updatedAt: c.updatedAt,
      })),
    };
  }

  private async toolGetContact(tenantId: string, args: Record<string, unknown>) {
    const id = String(args.contactId || '').trim();
    if (!id) return { ok: false, error: 'contactId_required' };
    const c = await this.contacts.findOne(tenantId, id);
    return {
      ok: true,
      contact: {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        fullName: c.fullName,
        email: c.email,
        phone: c.phone,
        companyId: c.companyId,
        position: c.position,
        country: c.country,
        city: c.city,
        status: c.status,
        tags: c.tags,
        customFields: c.customFields,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      },
    };
  }

  private async toolCreateContact(tenantId: string, args: Record<string, unknown>) {
    const has =
      String(args.email || '').trim() ||
      String(args.firstName || '').trim() ||
      String(args.lastName || '').trim() ||
      String(args.phone || '').trim();
    if (!has) {
      return {
        ok: false,
        error: 'need_email_or_name_or_phone',
      };
    }
    const dto = this.pickArgs(args, []) as CreateContactDto;
    const c = await this.contacts.create(tenantId, dto);
    return { ok: true, contact: { id: c.id, fullName: c.fullName, email: c.email } };
  }

  private async toolUpdateContact(tenantId: string, args: Record<string, unknown>) {
    const id = String(args.contactId || '').trim();
    if (!id) return { ok: false, error: 'contactId_required' };
    const patch = this.pickArgs(args, ['contactId']) as UpdateContactDto;
    if (!Object.keys(patch).length) return { ok: false, error: 'no_fields_to_update' };
    const c = await this.contacts.update(tenantId, id, patch);
    return { ok: true, contact: { id: c.id, fullName: c.fullName, email: c.email } };
  }

  private async toolDeleteContact(tenantId: string, args: Record<string, unknown>) {
    const id = String(args.contactId || '').trim();
    if (!id) return { ok: false, error: 'contactId_required' };
    await this.contacts.delete(tenantId, id);
    return { ok: true, contactId: id, deleted: true };
  }

  private async toolListNotes(
    tenantId: string,
    ctx: ToolCtx,
    args: Record<string, unknown>,
  ) {
    const entityType = String(args.entityType || '').trim();
    const entityId = String(args.entityId || '').trim();
    if (!entityId) return { ok: false, error: 'entityId_required' };
    const valid = ['contact', 'company', 'lead', 'sale', 'project'];
    if (!valid.includes(entityType)) {
      return { ok: false, error: 'invalid_entityType', allowed: valid };
    }
    const limit = Math.min(80, Math.max(1, Number(args.limit) || 40));
    const { items, total } = await this.notesService.findByEntity(
      tenantId,
      entityType,
      entityId,
      { createdById: ctx.userId, limit },
    );
    return {
      ok: true,
      total,
      notes: items.map((n) => ({
        id: n.id,
        entityType: n.entityType,
        entityId: n.entityId,
        title: n.title,
        content: n.content,
        type: n.type,
        isPrivate: n.isPrivate,
        createdAt: n.createdAt,
        createdById: n.createdById,
      })),
    };
  }

  private async toolUpdateNote(
    tenantId: string,
    ctx: ToolCtx,
    args: Record<string, unknown>,
  ) {
    const id = String(args.noteId || '').trim();
    if (!id) return { ok: false, error: 'noteId_required' };
    const patch = this.pickArgs(args, ['noteId']) as UpdateNoteDto;
    if (!Object.keys(patch).length) return { ok: false, error: 'no_fields_to_update' };
    const n = await this.notesService.update(tenantId, id, patch, ctx.userId);
    return { ok: true, note: { id: n.id, title: n.title } };
  }

  private async toolDeleteNote(
    tenantId: string,
    ctx: ToolCtx,
    args: Record<string, unknown>,
  ) {
    const id = String(args.noteId || '').trim();
    if (!id) return { ok: false, error: 'noteId_required' };
    await this.notesService.delete(tenantId, id, ctx.userId);
    return { ok: true, noteId: id, deleted: true };
  }

  private async toolWorkspaceUpdateRecord(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const objectId = String(args.objectId || '').trim();
    const recordId = String(args.recordId || '').trim();
    const values = args.values;
    if (!objectId || !recordId) return { ok: false, error: 'objectId_and_recordId_required' };
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return { ok: false, error: 'values_must_be_object' };
    }
    const rec = await this.customObjects.updateRecord(tenantId, objectId, recordId, {
      values: values as Record<string, any>,
    });
    return { ok: true, recordId: rec.id, objectId };
  }

  private async toolWorkspaceDeleteRecord(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const objectId = String(args.objectId || '').trim();
    const recordId = String(args.recordId || '').trim();
    if (!objectId || !recordId) return { ok: false, error: 'objectId_and_recordId_required' };
    await this.customObjects.deleteRecord(tenantId, objectId, recordId);
    return { ok: true, recordId, objectId, deleted: true };
  }

  private async toolSyncMarketingIntegration(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const integrationId = String(args.integrationId || '').trim();
    if (!integrationId) return { ok: false, error: 'integrationId_required' };
    const rows = await this.marketing.syncMarketingIntegrationById(
      tenantId,
      integrationId,
    );
    return { ok: true, integrationId, rowsWritten: rows };
  }

  private async toolListCompanyTasks(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const companyId = String(args.companyId || '').trim();
    if (!companyId) return { ok: false, error: 'companyId_required' };
    const status = args.status ? String(args.status) : undefined;
    const tasks = await this.companies.findCompanyTasks(
      tenantId,
      companyId,
      status as any,
    );
    return {
      ok: true,
      tasks: tasks.map((t) => ({
        id: t.id,
        companyId: t.companyId,
        title: t.title,
        status: t.status,
        dueDate: t.dueDate,
        priority: t.priority,
      })),
    };
  }

  private async toolCreateCompanyTask(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const companyId = String(args.companyId || '').trim();
    const title = String(args.title || '').trim();
    if (!companyId || !title) return { ok: false, error: 'companyId_and_title_required' };
    const dto = this.pickArgs(args, []) as unknown as CreateCompanyTaskDto;
    dto.companyId = companyId;
    dto.title = title;
    const task = await this.companies.createTask(tenantId, dto);
    return { ok: true, task: { id: task.id, title: task.title, companyId: task.companyId } };
  }

  private async toolUpdateCompanyTask(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const taskId = String(args.taskId || '').trim();
    if (!taskId) return { ok: false, error: 'taskId_required' };
    const patch = this.pickArgs(args, ['taskId']) as unknown as UpdateCompanyTaskDto;
    if (!Object.keys(patch).length) return { ok: false, error: 'no_fields_to_update' };
    const task = await this.companies.updateTask(tenantId, taskId, patch);
    return { ok: true, task: { id: task.id, title: task.title, status: task.status } };
  }

  private async toolDeleteCompanyTask(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const taskId = String(args.taskId || '').trim();
    if (!taskId) return { ok: false, error: 'taskId_required' };
    await this.companies.deleteTask(tenantId, taskId);
    return { ok: true, taskId, deleted: true };
  }

  private readLeadMeetingsRaw(lead: Lead): any[] {
    const raw = (lead.meta as any)?.meetings;
    if (!Array.isArray(raw)) return [];
    return raw.filter((item) => item && typeof item.id === 'string');
  }

  private async toolListLeadMeetings(
    ctx: ToolCtx,
    args: Record<string, unknown>,
  ) {
    const leadId = String(args.leadId || '').trim();
    if (!leadId) return { ok: false, error: 'leadId_required' };
    const lead = await this.leadsService.findOneForTenant(ctx.tenantId, leadId);
    const acc = await this.checkLeadAccessible(ctx, lead);
    if (!acc.ok) return { ok: false, error: acc.error };
    return { ok: true, meetings: this.readLeadMeetingsRaw(lead) };
  }

  private async toolAddLeadMeeting(
    ctx: ToolCtx,
    args: Record<string, unknown>,
  ) {
    const leadId = String(args.leadId || '').trim();
    const title = String(args.title || '').trim();
    const startsAt = String(args.startsAt || '').trim();
    if (!leadId || !title || !startsAt) {
      return { ok: false, error: 'leadId_title_startsAt_required' };
    }
    const lead = await this.leadsService.findOneForTenant(ctx.tenantId, leadId);
    const access = await this.checkLeadAccessible(ctx, lead);
    if (!access.ok) return { ok: false, error: access.error };
    const meta =
      typeof lead.meta === 'object' && lead.meta && !Array.isArray(lead.meta)
        ? { ...(lead.meta as Record<string, any>) }
        : {};
    const meetings = [...this.readLeadMeetingsRaw(lead)];
    const id = randomUUID();
    meetings.push({
      id,
      title,
      startsAt,
      endsAt: args.endsAt ? String(args.endsAt) : '',
      meetingUrl: args.meetingUrl ? String(args.meetingUrl) : '',
      notes: args.notes ? String(args.notes) : '',
      attendeeUserIds: Array.isArray(args.attendeeUserIds)
        ? (args.attendeeUserIds as unknown[]).map(String)
        : [],
    });
    meta.meetings = meetings;
    await this.leadsService.updateForTenant(ctx.tenantId, leadId, {
      meta,
    } as UpdateLeadDto);
    return { ok: true, meetingId: id, leadId };
  }

  private async toolUpdateLeadMeeting(
    ctx: ToolCtx,
    args: Record<string, unknown>,
  ) {
    const leadId = String(args.leadId || '').trim();
    const meetingId = String(args.meetingId || '').trim();
    if (!leadId || !meetingId) return { ok: false, error: 'leadId_meetingId_required' };
    const lead = await this.leadsService.findOneForTenant(ctx.tenantId, leadId);
    const access = await this.checkLeadAccessible(ctx, lead);
    if (!access.ok) return { ok: false, error: access.error };
    const meetings = this.readLeadMeetingsRaw(lead);
    const idx = meetings.findIndex((m) => m.id === meetingId);
    if (idx < 0) return { ok: false, error: 'meeting_not_found' };
    const cur = { ...meetings[idx] };
    if (args.title !== undefined) cur.title = String(args.title);
    if (args.startsAt !== undefined) cur.startsAt = String(args.startsAt);
    if (args.endsAt !== undefined) cur.endsAt = String(args.endsAt);
    if (args.meetingUrl !== undefined) cur.meetingUrl = String(args.meetingUrl);
    if (args.notes !== undefined) cur.notes = String(args.notes);
    if (args.attendeeUserIds !== undefined) {
      cur.attendeeUserIds = Array.isArray(args.attendeeUserIds)
        ? (args.attendeeUserIds as unknown[]).map(String)
        : [];
    }
    meetings[idx] = cur;
    const meta =
      typeof lead.meta === 'object' && lead.meta && !Array.isArray(lead.meta)
        ? { ...(lead.meta as Record<string, any>) }
        : {};
    meta.meetings = meetings;
    await this.leadsService.updateForTenant(ctx.tenantId, leadId, { meta } as UpdateLeadDto);
    return { ok: true, meetingId, leadId };
  }

  private async toolRemoveLeadMeeting(
    ctx: ToolCtx,
    args: Record<string, unknown>,
  ) {
    const leadId = String(args.leadId || '').trim();
    const meetingId = String(args.meetingId || '').trim();
    if (!leadId || !meetingId) return { ok: false, error: 'leadId_meetingId_required' };
    const lead = await this.leadsService.findOneForTenant(ctx.tenantId, leadId);
    const access = await this.checkLeadAccessible(ctx, lead);
    if (!access.ok) return { ok: false, error: access.error };
    const meetings = this.readLeadMeetingsRaw(lead).filter((m) => m.id !== meetingId);
    const meta =
      typeof lead.meta === 'object' && lead.meta && !Array.isArray(lead.meta)
        ? { ...(lead.meta as Record<string, any>) }
        : {};
    meta.meetings = meetings;
    await this.leadsService.updateForTenant(ctx.tenantId, leadId, { meta } as UpdateLeadDto);
    return { ok: true, removed: true, meetingId, leadId };
  }

  private async toolListEmailAccounts(tenantId: string) {
    const accounts = await this.emailService.findAllAccounts(tenantId);
    return {
      ok: true,
      accounts: accounts.map((a) => ({
        id: a.id,
        email: a.email,
        name: a.name,
        status: a.status,
      })),
    };
  }

  private async toolListEmailTemplates(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const activeOnly = args.activeOnly === true;
    const templates = await this.emailService.findAllTemplates(
      tenantId,
      activeOnly ? true : undefined,
    );
    return {
      ok: true,
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        subject: t.subject,
        isActive: t.isActive,
      })),
    };
  }

  private async buildEmailTemplateData(
    tenantId: string,
    args: {
      variables?: Record<string, unknown>;
      contactId?: string;
      leadId?: string;
      companyId?: string;
      saleId?: string;
    },
  ): Promise<Record<string, any>> {
    const data: Record<string, any> = {
      ...(args.variables && typeof args.variables === 'object' && !Array.isArray(args.variables)
        ? (args.variables as Record<string, any>)
        : {}),
    };
    if (args.leadId) {
      const lead = await this.leadsService.findOneForTenant(
        tenantId,
        String(args.leadId),
      );
      data.lead = {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
      };
      if (data.name == null || data.name === '') data.name = lead.name || '';
      if (data.email == null || data.email === '') data.email = lead.email || '';
    }
    if (args.contactId) {
      const c = await this.contacts.findOne(tenantId, String(args.contactId));
      data.contact = {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
      };
      const full = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
      if (data.name == null || data.name === '') data.name = full;
      if (data.email == null || data.email === '') data.email = c.email || '';
    }
    if (args.companyId) {
      const company = await this.companies.findOne(tenantId, String(args.companyId));
      data.company = { id: company.id, name: company.name };
      if (data.companyName == null || data.companyName === '') {
        data.companyName = company.name || '';
      }
    }
    if (args.saleId) {
      const sale = await this.salesRepo.findOne({
        where: { id: String(args.saleId), tenantId },
      });
      if (sale) {
        data.sale = {
          id: sale.id,
          amount: sale.amount,
          status: sale.status,
        };
      }
    }
    return data;
  }

  private async toolPreviewEmailTemplate(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const templateId = String(args.templateId || '').trim();
    if (!templateId) return { ok: false, error: 'templateId_required' };
    const data = await this.buildEmailTemplateData(tenantId, {
      variables: args.variables as Record<string, unknown>,
      contactId: args.contactId ? String(args.contactId) : undefined,
      leadId: args.leadId ? String(args.leadId) : undefined,
    });
    const preview = await this.emailService.applyTemplate(tenantId, templateId, data);
    return { ok: true, ...preview, variablesUsedHint: Object.keys(data) };
  }

  private async toolDraftClientEmail(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const templateId = args.templateId ? String(args.templateId).trim() : '';
    const contactId = args.contactId ? String(args.contactId).trim() : undefined;
    const leadId = args.leadId ? String(args.leadId).trim() : undefined;
    const companyId = args.companyId ? String(args.companyId).trim() : undefined;
    const saleId = args.saleId ? String(args.saleId).trim() : undefined;

    const triggerData = await this.buildEmailTemplateData(tenantId, {
      variables: args.variables as Record<string, unknown>,
      contactId,
      leadId,
      companyId,
      saleId,
    });

    const hint =
      'Покажи пользователю тему и тело письма (textBody и/или htmlBody). Напиши «Письмо готово (черновик)». Отправка только вручную: кнопка «Письмо» в панели AI — там можно отредактировать и отправить. Не говори, что письмо уже ушло.';

    if (templateId) {
      const applied = await this.emailService.applyTemplate(
        tenantId,
        templateId,
        triggerData,
      );
      return {
        ok: true,
        subject: applied.subject,
        htmlBody: applied.htmlBody,
        textBody: applied.textBody,
        hint,
      };
    }

    const subject = args.subject != null ? String(args.subject) : '';
    const textBody = args.textBody != null ? String(args.textBody) : '';
    const htmlBody = args.htmlBody != null ? String(args.htmlBody) : '';
    if (!subject.trim() && !textBody.trim() && !htmlBody.trim()) {
      return {
        ok: false,
        error: 'templateId_or_subject_or_body_required',
      };
    }
    return {
      ok: true,
      subject: subject
        ? this.emailService.interpolateTemplate(subject, triggerData)
        : '',
      textBody: textBody
        ? this.emailService.interpolateTemplate(textBody, triggerData)
        : '',
      htmlBody: htmlBody
        ? this.emailService.interpolateTemplate(htmlBody, triggerData)
        : '',
      hint,
    };
  }

  private async toolSendApprovedClientEmail(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    if (args.userConfirmedSend !== true) {
      return {
        ok: false,
        error: 'userConfirmedSend_must_be_true',
        hint: 'Вызывай только после явного «отправляй» / «да, отправь» от пользователя.',
      };
    }
    const accountId = String(args.accountId || '').trim();
    const toRaw = args.to;
    const subject = String(args.subject || '').trim();
    const to = Array.isArray(toRaw)
      ? (toRaw as unknown[]).map((e) => String(e).trim()).filter(Boolean)
      : [];
    if (!accountId || !to.length || !subject) {
      return { ok: false, error: 'accountId_to_subject_required' };
    }
    const bodyText = args.bodyText != null ? String(args.bodyText) : '';
    const bodyHtml = args.bodyHtml != null ? String(args.bodyHtml) : '';
    if (!bodyText.trim() && !bodyHtml.trim()) {
      return { ok: false, error: 'bodyText_or_bodyHtml_required' };
    }
    try {
      const msg = await this.emailService.sendStyledTransactionalMail(tenantId, {
        accountId,
        to,
        subject,
        bodyText: bodyText.trim() || undefined,
        bodyHtml: bodyHtml.trim() || undefined,
        headline: args.headline != null ? String(args.headline) : undefined,
        contactId: args.contactId ? String(args.contactId) : undefined,
        leadId: args.leadId ? String(args.leadId) : undefined,
        companyId: args.companyId ? String(args.companyId) : undefined,
        saleId: args.saleId ? String(args.saleId) : undefined,
        variables:
          args.variables && typeof args.variables === 'object' && !Array.isArray(args.variables)
            ? (args.variables as Record<string, any>)
            : undefined,
      });
      return {
        ok: true,
        messageId: msg.id,
        subject: msg.subject,
        sentTo: to,
      };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'send_failed' };
    }
  }

  private async toolListAutomations(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const isActive =
      args.isActive === true ? true : args.isActive === false ? false : undefined;
    const rows = await this.automationsService.findAll(tenantId, isActive);
    return {
      ok: true,
      automations: rows.map((a) => ({
        id: a.id,
        name: a.name,
        triggerEvent: a.triggerEvent,
        isActive: a.isActive,
        actionsCount: a.actions?.length ?? 0,
        meta: a.meta,
      })),
    };
  }

  private async toolCreateAutomation(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const name = String(args.name || '').trim();
    const triggerRaw = String(args.triggerEvent || '').trim();
    const actionsIn = args.actions;
    if (!name) return { ok: false, error: 'name_required' };
    if (!triggerRaw) return { ok: false, error: 'triggerEvent_required' };
    if (!Object.values(TriggerEvent).includes(triggerRaw as TriggerEvent)) {
      return { ok: false, error: 'invalid_triggerEvent' };
    }
    if (!Array.isArray(actionsIn) || actionsIn.length === 0) {
      return { ok: false, error: 'actions_required' };
    }
    const actions = actionsIn.map((a: any) => {
      const type = String(a?.type || '');
      if (!Object.values(ActionType).includes(type as ActionType)) {
        throw new Error(`invalid_action_type:${type}`);
      }
      return { type: type as ActionType, config: a?.config && typeof a.config === 'object' ? a.config : {} };
    });
    const dto: CreateAutomationDto = {
      name,
      description: args.description != null ? String(args.description) : undefined,
      triggerEvent: triggerRaw as TriggerEvent,
      conditions: Array.isArray(args.conditions) ? (args.conditions as any) : undefined,
      actions,
      isActive: args.isActive === false ? false : true,
      maxExecutions:
        args.maxExecutions != null ? Number(args.maxExecutions) : undefined,
      cooldownSeconds:
        args.cooldownSeconds != null ? Number(args.cooldownSeconds) : undefined,
      meta:
        args.meta && typeof args.meta === 'object' && !Array.isArray(args.meta)
          ? (args.meta as Record<string, any>)
          : undefined,
    };
    try {
      const created = await this.automationsService.create(tenantId, dto);
      return { ok: true, automation: { id: created.id, name: created.name } };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'create_failed' };
    }
  }

  private async toolUpdateAutomation(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const automationId = String(args.automationId || '').trim();
    if (!automationId) return { ok: false, error: 'automationId_required' };
    const patch: UpdateAutomationDto = {};
    if (args.name !== undefined) patch.name = String(args.name);
    if (args.description !== undefined) patch.description = String(args.description);
    if (args.triggerEvent !== undefined) {
      const t = String(args.triggerEvent);
      if (!Object.values(TriggerEvent).includes(t as TriggerEvent)) {
        return { ok: false, error: 'invalid_triggerEvent' };
      }
      patch.triggerEvent = t as TriggerEvent;
    }
    if (args.conditions !== undefined) {
      patch.conditions = Array.isArray(args.conditions) ? (args.conditions as any) : [];
    }
    if (args.actions !== undefined) {
      if (!Array.isArray(args.actions)) return { ok: false, error: 'actions_must_be_array' };
      patch.actions = args.actions.map((a: any) => {
        const type = String(a?.type || '');
        if (!Object.values(ActionType).includes(type as ActionType)) {
          throw new Error(`invalid_action_type:${type}`);
        }
        return {
          type: type as ActionType,
          config: a?.config && typeof a.config === 'object' ? a.config : {},
        };
      });
    }
    if (args.isActive !== undefined) patch.isActive = Boolean(args.isActive);
    if (args.maxExecutions !== undefined) patch.maxExecutions = Number(args.maxExecutions);
    if (args.cooldownSeconds !== undefined) {
      patch.cooldownSeconds = Number(args.cooldownSeconds);
    }
    if (
      args.meta !== undefined &&
      args.meta &&
      typeof args.meta === 'object' &&
      !Array.isArray(args.meta)
    ) {
      patch.meta = args.meta as Record<string, any>;
    }
    if (!Object.keys(patch).length) return { ok: false, error: 'no_fields_to_update' };
    try {
      const updated = await this.automationsService.update(
        tenantId,
        automationId,
        patch,
      );
      return { ok: true, automation: { id: updated.id, name: updated.name } };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'update_failed' };
    }
  }

  private async toolDeleteAutomation(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const automationId = String(args.automationId || '').trim();
    if (!automationId) return { ok: false, error: 'automationId_required' };
    await this.automationsService.delete(tenantId, automationId);
    return { ok: true, automationId, deleted: true };
  }
}
