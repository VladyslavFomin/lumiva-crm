import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
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
import { ReportsService } from '../automations/reports.service';
import { IntegrationsService } from '../integrations/integrations.service';
import {
  TriggerEvent,
  ActionType,
} from '../automations/automation.entity';
import type { CreateAutomationDto } from '../automations/dto/create-automation.dto';
import type { UpdateAutomationDto } from '../automations/dto/update-automation.dto';
import type { CreateCompanyTaskDto } from '../companies/dto/create-company-task.dto';
import type { UpdateCompanyTaskDto } from '../companies/dto/update-company-task.dto';
import type { UpdateLeadDto } from '../leads/dto/update-lead.dto';
import { AiAgent } from '../ai-employees/ai-agent.entity';
import { AiAgentAction } from '../ai-employees/ai-agent-action.entity';
import { AiAgentLog } from '../ai-employees/ai-agent-log.entity';
import { AiAgentPermission } from '../ai-employees/ai-agent-permission.entity';
import { getAiEmployeeRole } from '../ai-employees/ai-employee-role-catalog';
import { WorkspaceAreasService } from '../workspace-areas/workspace-areas.service';

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
        'Список лидов (модуль лидов CRM): имя, статус, источник, email, телефон. Поддерживает постраничный просмотр (page) и фильтры. Не проекты и не рабочая область.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'Макс. записей на страницу (1–50)', default: 15 },
          page: { type: 'integer', description: 'Номер страницы, начиная с 1 (для листания большого списка)', default: 1 },
          status: { type: 'string', description: 'Фильтр по статусу (new, in_progress, won, lost, …)' },
          source: { type: 'string', description: 'Фильтр по источнику (form, chat, api, …)' },
          search: { type: 'string', description: 'Поиск по имени/email/телефону (ILIKE)' },
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
      description:
        'Краткая сводка продаж за период: количество, сумма. Параметры from/to желательно в YYYY-MM-DD; если указан только месяц — возьми границы месяца в году из системной даты в системном промпте.',
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
        'Агрегированная аналитика маркетинга (трафик/каналы): сессии, лиды, расход, выручка. ' +
        'Передавай from/to (YYYY-MM-DD) для нужного интервала. ' +
        'Опционально dataSource — ключ конкретного источника (например google_ads_5094620264) для разбивки по одному каналу/аккаунту; список источников с именами возвращается в dataSources+dataSourceLabels. ' +
        'displayCurrency (ISO 4217): revenue/cost пересчитываются в эту валюту. ' +
        'Чтобы узнать доступные источники и имена аккаунтов — используй crm_marketing_integrations. ' +
        'Чтобы записать каналы в таблицу рабочей области — crm_workspace_import_marketing_channels.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'YYYY-MM-DD' },
          to: { type: 'string', description: 'YYYY-MM-DD' },
          dataSource: {
            type: 'string',
            description:
              'Опционально: ключ источника данных (google_ads_<cid>, ga4_<id>, yandex_metrika, meta_ads и т.д.). Если не задан — агрегат по всем источникам.',
          },
          displayCurrency: {
            type: 'string',
            description:
              'Опционально: код валюты отчёта (EUR, USD, CHF, PLN, … из набора ECB/Frankfurter). Revenue и cost пересчитываются для ответа.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_marketing_daily_series',
      description:
        'Дневной ряд метрик маркетинга для построения тренда: за каждый день возвращает sessions, clicks, impressions, cost, leads. ' +
        'Используй, когда пользователь спрашивает о динамике / тренде по времени или хочет сравнить периоды. ' +
        'Опционально dataSource — фильтр по конкретному каналу (google_ads_<cid>, ga4_<id> и т.д.).',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'YYYY-MM-DD' },
          to: { type: 'string', description: 'YYYY-MM-DD' },
          dataSource: {
            type: 'string',
            description: 'Опционально: ключ источника (google_ads_<cid>, meta_ads и т.д.).',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_marketing_integrations',
      description:
        'Детальный список маркетинговых интеграций: провайдер, имя, активность, primaryId, режим аккаунта. ' +
        'Для Google Ads в режиме MCC включает список sub-аккаунтов (managedAccounts) с именами и ключами dataSource. ' +
        'Также возвращает dataSources — все ключи, под которыми есть данные в трафике, с человекочитаемыми именами (dataSourceLabels). ' +
        'Используй, чтобы понять, какие рекламные аккаунты подключены и под каким ключом искать их данные.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_list_integrations',
      description:
        'Все подключения: salesIntegrations — интеграции продаж/импорта и сторонние связки (WooCommerce, manual-import, Mailchimp/Slack/Teams как third_party_link с полем catalogId, раздел «Интеграции» / автоматизации); marketingIntegrations — маркетинг и аналитика (Meta/Facebook Ads, GA4, Яндекс.Метрика, Google Ads и т.п.). Для Mailchimp: catalogId mailchimp; шаги send_mailchimp (подписчик) и send_mailchimp_campaign (рассылка всей аудитории); crm_mailchimp_subscribe из чата после согласия.',
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
        'Создать новую таблицу в рабочей области (/workspace): она будет привязана к первой доступной области тенанта (как при создании из UI). Если нужно вносить данные — ОБЯЗАТЕЛЬНО передай fields (колонки), иначе таблица будет пустой и crm_workspace_add_record некуда писать. Для выгрузки рекламы/каналов из CRM удобнее crm_workspace_import_marketing_channels.',
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
        'Выгрузить в рабочую область строки по рекламе/маркетингу из CRM (агрегаты по каналам: source, medium, campaign, сессии, клики, лиды, выручка, расход и т.д.). Один вызов: создаёт таблицу с колонками и заполняет данными из marketing_traffic; таблица привязывается к области тенанта. Используй, когда пользователь просит перенести рекламу/каналы/метрику в рабочую область.',
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
      name: 'crm_workspace_import_file',
      description:
        'Импортировать ВСЕ строки из файла (Excel/CSV), прикреплённого пользователем в этом чате, прямо в таблицу рабочей области — без передачи строк через контекст модели. Используй вместо crm_workspace_bulk_add_records, когда в сообщении есть вложение с importId. Сначала создай таблицу через crm_workspace_create_table (или используй уже существующую), затем вызови этот инструмент с её objectId и importId из вложения. В ответе будет unmatchedColumns — колонки файла, для которых не нашлось поле; если он не пуст, можно вызвать инструмент ещё раз (тем же objectId и importId) с явным fieldMapping — это безопасно и не создаст дублей полей, но ДОБАВИТ повторные строки, поэтому обязательно исправляй маппинг с первой попытки, а не действием наугад.',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string', description: 'UUID таблицы рабочей области (из crm_workspace_create_table)' },
          importId: { type: 'string', description: 'importId вложения из сообщения пользователя' },
          fieldMapping: {
            type: 'object',
            description:
              'Соответствие: key поля таблицы → название колонки файла (из columns вложения). Если не задано — подберётся автоматически по схожести названий field.key/label и названия колонки.',
          },
        },
        required: ['objectId', 'importId'],
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
  {
    type: 'function',
    function: {
      name: 'crm_list_staff_members',
      description:
        'Список сотрудников (команды) тенанта: id, ФИО, email, роль, отдел, активность. Используй для получения assignedUserId при назначении задач/лидов или для отправки писем коллегам.',
      parameters: {
        type: 'object',
        properties: {
          activeOnly: {
            type: 'boolean',
            description: 'Только активные сотрудники (по умолчанию true)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_list_ai_employees',
      description:
        'Список активных AI-сотрудников клиента: id, имя, роль, отдел, статус, режим автономности. Это не замена основному CRM-ассистенту в чате: здесь именованные специалисты с ролями, расписанием и согласованиями. Используй перед постановкой задачи или вопросом конкретному AI-сотруднику.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_assign_ai_employee_task',
      description:
        'Поставить задачу именованному AI-сотруднику (специалисту). Универсальный чат CRM всё так же доступен пользователю отдельно. Можно передать agentId или role/name для подбора сотрудника. Создаёт задачу в AI Employees, чтобы сотрудник увидел её в своём списке действий.',
      parameters: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'UUID AI-сотрудника из crm_list_ai_employees' },
          role: { type: 'string', description: 'Роль, например marketing_analyst, lead_manager, sales_manager' },
          name: { type: 'string', description: 'Имя AI-сотрудника, если пользователь назвал его по имени' },
          title: { type: 'string', description: 'Короткое название задачи' },
          task: { type: 'string', description: 'Что нужно сделать AI-сотруднику' },
          priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
          dueAt: { type: 'string', description: 'ISO date/time или текстовый срок, если пользователь указал' },
        },
        required: ['title', 'task'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_ask_ai_employee',
      description:
        'Задать вопрос конкретному AI-сотруднику (специалисту по роли) и получить ответ на основе CRM-данных — делегирование от универсального чата. Можно передать agentId или role/name.',
      parameters: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'UUID AI-сотрудника из crm_list_ai_employees' },
          role: { type: 'string', description: 'Роль, например marketing_analyst, lead_manager, sales_manager' },
          name: { type: 'string', description: 'Имя AI-сотрудника' },
          question: { type: 'string', description: 'Вопрос пользователя к AI-сотруднику' },
        },
        required: ['question'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_send_bulk_email',
      description:
        'Массовая рассылка письма сегменту лидов или контактов. Только после ЯВНОГО согласия пользователя («рассылай», «да, отправь всем», «запускай»). Персонализирует {{name}} и {{email}} для каждого получателя. Сначала можно сделать crm_list_leads/crm_list_contacts для проверки аудитории, затем показать пользователю сводку (кол-во получателей, тему) и только после подтверждения — вызвать этот инструмент.',
      parameters: {
        type: 'object',
        properties: {
          userConfirmedSend: {
            type: 'boolean',
            description: 'Обязательно true только если пользователь прямо сейчас подтвердил рассылку',
          },
          accountId: { type: 'string', description: 'UUID почтового аккаунта из crm_list_email_accounts' },
          subject: { type: 'string', description: 'Тема письма (поддерживает {{name}}, {{email}})' },
          bodyText: { type: 'string', description: 'Текст письма (поддерживает {{name}}, {{email}})' },
          bodyHtml: { type: 'string', description: 'HTML-тело письма (опционально)' },
          headline: { type: 'string', description: 'Заголовок в шапке фирменного письма' },
          templateId: { type: 'string', description: 'ID шаблона письма (вместо bodyText/bodyHtml)' },
          targetType: {
            type: 'string',
            enum: ['leads', 'contacts'],
            description: 'Кому рассылать: лиды или контакты',
          },
          filterStatus: { type: 'string', description: 'Фильтр по статусу (only for targetType leads: new/in_progress/won/lost; contacts: active/inactive)' },
          filterSource: { type: 'string', description: 'Фильтр по источнику лида (только для leads)' },
          filterDateFrom: { type: 'string', description: 'YYYY-MM-DD — созданы начиная с даты' },
          filterDateTo: { type: 'string', description: 'YYYY-MM-DD — созданы до даты' },
          filterSearch: { type: 'string', description: 'Поиск по имени/email (ILIKE) для сужения аудитории' },
          maxRecipients: {
            type: 'integer',
            description: 'Лимит получателей (1–500, по умолчанию 200)',
          },
        },
        required: ['userConfirmedSend', 'accountId', 'subject', 'targetType'],
      },
    },
  },
  ...CRM_EXTENDED_AI_TOOL_DEFINITIONS,
];

type ToolCtx = {
  tenantId: string;
  userId: string;
  userEmail?: string;
  /**
   * Видимость лидов в инструментах ИИ:
   * — owner / admin / superadmin: все лиды тенанта;
   * — иначе как GET /leads: только «свои» по staff-профилю;
   * — если задано LUMIVA_AI_LEADS_TENANT_WIDE=true|1 — все лиды тенанта для любой роли (осторожно на shared-аккаунтах).
   */
  userRole?: string;
  /** Telegram-контекст: заполняется когда запрос пришёл через Telegram-бот */
  telegramUsername?: string;
  telegramChatId?: string;
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
    @Inject(forwardRef(() => LeadsService))
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
    private readonly reportsService: ReportsService,
    private readonly integrationsService: IntegrationsService,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
    @InjectRepository(AiAgent)
    private readonly aiAgentsRepo: Repository<AiAgent>,
    @InjectRepository(AiAgentAction)
    private readonly aiAgentActionsRepo: Repository<AiAgentAction>,
    @InjectRepository(AiAgentLog)
    private readonly aiAgentLogsRepo: Repository<AiAgentLog>,
    @InjectRepository(AiAgentPermission)
    private readonly aiAgentPermissionsRepo: Repository<AiAgentPermission>,
    private readonly workspaceAreas: WorkspaceAreasService,
  ) {}

  private crmFrontendBase(): string {
    return (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  }

  /** Ссылки для ответов модели: всегда пути + опционально полные URL если задан FRONTEND_URL */
  private workspaceToolLinkPayload(
    workspaceAreaId: string | null | undefined,
    objectId: string,
    analyticsUrlPath: string | null,
  ) {
    const tableUrlPath = `/workspace/${objectId}/table`;
    const base = this.crmFrontendBase();
    const out: Record<string, unknown> = {
      tableUrlPath,
      analyticsUrlPath,
    };
    if (workspaceAreaId) out.workspaceAreaId = workspaceAreaId;
    if (base) {
      out.tableUrl = `${base}${tableUrlPath}`;
      if (analyticsUrlPath) out.analyticsUrl = `${base}${analyticsUrlPath}`;
      if (workspaceAreaId) {
        out.workspaceAreaUrl = `${base}/workspace/areas/${workspaceAreaId}`;
      }
    }
    return out;
  }

  /**
   * Таблицы без области не попадают в сайдбар при открытой конкретной области (/workspace/areas/:id).
   */
  private async workspaceAreaForNewTable(
    tenantId: string,
    dto: CreateCustomObjectDto,
  ): Promise<{ dto: CreateCustomObjectDto; workspaceAreaId: string | null }> {
    if (dto.workspaceAreaId) {
      return { dto, workspaceAreaId: dto.workspaceAreaId };
    }
    const areas = await this.workspaceAreas.list(tenantId);
    const wid = areas[0]?.id ?? null;
    if (!wid) return { dto, workspaceAreaId: null };
    return {
      dto: { ...dto, workspaceAreaId: wid },
      workspaceAreaId: wid,
    };
  }

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

  private activeLeadCondition(alias: string) {
    return `NOT (
      COALESCE(${alias}.meta::jsonb, '{}'::jsonb) @> '{"deleted":true}'::jsonb
      OR COALESCE(${alias}.meta::jsonb, '{}'::jsonb) @> '{"deleted":"true"}'::jsonb
      OR COALESCE(${alias}.meta::jsonb, '{}'::jsonb) @> '{"archived":true}'::jsonb
      OR COALESCE(${alias}.meta::jsonb, '{}'::jsonb) @> '{"archived":"true"}'::jsonb
    )`;
  }

  private isLeadHiddenForAi(lead: Pick<Lead, 'meta'>): boolean {
    const meta = lead.meta as { deleted?: unknown; archived?: unknown } | null | undefined;
    return meta?.deleted === true ||
      meta?.deleted === 'true' ||
      meta?.archived === true ||
      meta?.archived === 'true';
  }

  /** Все лиды тенанта в CRM-инструментах ИИ (не путать с правами UI / GET /leads). */
  private aiSeesAllTenantLeads(ctx: ToolCtx): boolean {
    const wide = (process.env.LUMIVA_AI_LEADS_TENANT_WIDE || '').trim().toLowerCase();
    if (wide === '1' || wide === 'true' || wide === 'yes') return true;
    const r = (ctx.userRole || '').trim().toLowerCase();
    return r === 'owner' || r === 'admin' || r === 'superadmin';
  }

  private async filterLeadsByAccess(ctx: ToolCtx, leads: Lead[]): Promise<Lead[]> {
    const visibleLeads = leads.filter((lead) => !this.isLeadHiddenForAi(lead));
    if (this.aiSeesAllTenantLeads(ctx)) return visibleLeads;
    const staff = await this.getStaffForToolCtx(ctx);
    if (!staff) return [];
    return visibleLeads.filter((l) => this.isLeadMineForAi(l, staff));
  }

  private async checkLeadAccessible(
    ctx: ToolCtx,
    lead: Lead,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (this.isLeadHiddenForAi(lead)) return { ok: false, error: 'lead_deleted_or_archived' };
    if (this.aiSeesAllTenantLeads(ctx)) return { ok: true };
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
    // Изоляция тенантов: tenant только из JWT (ctx). Модель не может сменить песочницу через аргументы.
    delete args.tenantId;
    delete args.tenant_id;
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
        case 'crm_marketing_daily_series':
          return JSON.stringify(await this.toolMarketingDailySeries(ctx.tenantId, args));
        case 'crm_marketing_integrations':
          return JSON.stringify(await this.toolMarketingIntegrations(ctx.tenantId));
        case 'crm_list_integrations':
          return JSON.stringify(await this.toolIntegrations(ctx.tenantId));
        case 'crm_list_projects':
          return JSON.stringify(await this.toolProjects(ctx.tenantId, args));
        case 'crm_create_lead':
          return JSON.stringify(
            await this.toolCreateLead(ctx.tenantId, args, ctx),
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
        case 'crm_workspace_import_file':
          return JSON.stringify(await this.toolWorkspaceImportFile(ctx.tenantId, args));
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
        case 'crm_list_staff_members':
          return JSON.stringify(await this.toolListStaffMembers(ctx.tenantId, args));
        case 'crm_list_ai_employees':
          return JSON.stringify(await this.toolListAiEmployees(ctx.tenantId));
        case 'crm_assign_ai_employee_task':
          return JSON.stringify(await this.toolAssignAiEmployeeTask(ctx, args));
        case 'crm_ask_ai_employee':
          return JSON.stringify(await this.toolAskAiEmployee(ctx, args));
        case 'crm_send_bulk_email':
          return JSON.stringify(await this.toolSendBulkEmail(ctx, args));
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
        case 'crm_preview_crm_report':
          return JSON.stringify(await this.toolPreviewCrmReport(ctx.tenantId, args));
        case 'crm_send_crm_report_email':
          return JSON.stringify(await this.toolSendCrmReportEmail(ctx.tenantId, args));
        case 'crm_mailchimp_subscribe':
          return JSON.stringify(
            await this.toolMailchimpSubscribe(ctx.tenantId, args),
          );
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
    const page = Math.max(1, Number(args.page) || 1);
    const status = args.status ? String(args.status) : undefined;
    const source = args.source ? String(args.source) : undefined;
    const search = args.search ? String(args.search).trim() : undefined;
    const fetchCap = Math.min(500, Math.max(limit * 5, 50));
    const skip = (page - 1) * limit;
    const qb = this.leadsRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId: ctx.tenantId })
      .andWhere(this.activeLeadCondition('l'))
      .orderBy('l.createdAt', 'DESC')
      .take(fetchCap + skip);
    if (status) qb.andWhere('l.status = :status', { status });
    if (source) qb.andWhere('l.source = :source', { source });
    if (search) {
      const like = `%${search}%`;
      qb.andWhere(
        "(COALESCE(l.name,'') ILIKE :like OR COALESCE(l.email,'') ILIKE :like OR COALESCE(l.phone,'') ILIKE :like)",
        { like },
      );
    }
    const rows = await qb.getMany();
    const filtered = await this.filterLeadsByAccess(ctx, rows);
    const sliced = filtered.slice(skip, skip + limit);
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
      page,
      limit,
      returned: sliced.length,
      hasMore: filtered.length > skip + limit,
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
      .andWhere(this.activeLeadCondition('l'))
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
    const dataSourceFilter = args.dataSource ? String(args.dataSource).trim() : undefined;
    const displayOptRaw = args.displayCurrency
      ? String(args.displayCurrency).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)
      : '';
    const displayOpt = /^[A-Z]{3}$/.test(displayOptRaw) ? displayOptRaw : null;

    const stats = await this.marketing.getTrafficChannelsStats(
      tenantId,
      from,
      to,
      dataSourceFilter,
      500,
    );

    let fx: {
      multiplyToDisplay: Record<string, number>;
      display: string;
      asOf: string;
      source: string;
    } | null = null;
    if (displayOpt) {
      try {
        const loaded = await this.marketing.getMarketingFxRates(displayOpt);
        fx = {
          multiplyToDisplay: loaded.multiplyToDisplay,
          display: loaded.display,
          asOf: loaded.asOf,
          source: loaded.source,
        };
      } catch {
        fx = null;
      }
    }

    const conv = (amount: number, cur: string | null | undefined): number => {
      if (!fx || !amount) return amount;
      const code = (cur || 'EUR').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'EUR';
      const m = fx.multiplyToDisplay[code];
      if (m == null || !Number.isFinite(m)) return amount;
      return amount * m;
    };

    const topChannels = (stats.items || []).slice(0, 50).map((i) => {
      const cur = i.currency;
      return {
        dataSource: i.dataSource,
        campaign: i.campaign,
        source: i.source,
        medium: i.medium,
        sessions: i.sessions,
        clicks: i.clicks,
        impressions: i.impressions,
        leads: i.leads,
        revenue: fx ? conv(i.revenue, cur) : i.revenue,
        cost: fx ? conv(i.cost, cur) : i.cost,
        ...(fx ? { originalCurrency: cur } : { currency: cur }),
      };
    });

    const providerBreakdown = (stats.providerBreakdown || []).slice(0, 20).map((p) => ({
      dataSource: p.dataSource,
      label: stats.dataSourceLabels?.[p.dataSource] || p.dataSource,
      rowCount: p.rowCount,
      sessions: p.sessions,
      clicks: p.clicks,
      impressions: p.impressions,
      leads: p.leads,
      revenue: fx ? conv(p.revenue, p.currency) : p.revenue,
      cost: fx ? conv(p.cost, p.currency) : p.cost,
      currency: fx ? fx.display : p.currency,
    }));

    // Список доступных источников с человекочитаемыми именами
    const dataSources = (stats.dataSources || []).map((ds) => ({
      key: ds,
      label: stats.dataSourceLabels?.[ds] || ds,
    }));

    const out: Record<string, unknown> = {
      from: stats.from,
      to: stats.to,
      currency: stats.currency,
      totalSessions: stats.totalSessions,
      totalClicks: stats.totalClicks,
      totalImpressions: stats.totalImpressions,
      totalLeads: stats.totalLeads,
      totalRevenue: stats.totalRevenue,
      totalCost: stats.totalCost,
      providerBreakdown,
      topChannels,
      dataSources,
      ...(dataSourceFilter ? { filteredByDataSource: dataSourceFilter } : {}),
    };

    if (fx) {
      out.displayCurrency = fx.display;
      out.fxAsOf = fx.asOf;
      out.fxSource = fx.source;
      out.financialTotalsNote =
        'totalRevenue и totalCost — грубые суммы из БД; при смеси валют смотри providerBreakdown, где суммы в displayCurrency.';
    }

    return out;
  }

  private async toolMarketingDailySeries(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const from = args.from ? String(args.from) : undefined;
    const to = args.to ? String(args.to) : undefined;
    const dataSource = args.dataSource ? String(args.dataSource).trim() : undefined;

    const { series } = await this.marketing.getTrafficDailySeries(
      tenantId,
      from,
      to,
      dataSource,
    );

    // Сжатый формат для экономии токенов: массив массивов [date, sessions, clicks, impressions, cost, leads]
    const rows = series.map((d) => ({
      date: d.date,
      sessions: d.sessions,
      clicks: d.clicks,
      impressions: d.impressions,
      cost: d.cost,
      leads: d.leads,
    }));

    const totalCost = rows.reduce((s, r) => s + (r.cost || 0), 0);
    const totalSessions = rows.reduce((s, r) => s + (r.sessions || 0), 0);
    const totalLeads = rows.reduce((s, r) => s + (r.leads || 0), 0);

    return {
      from: from ?? null,
      to: to ?? null,
      ...(dataSource ? { dataSource } : {}),
      totalDays: rows.length,
      totals: { sessions: totalSessions, cost: totalCost, leads: totalLeads },
      series: rows,
    };
  }

  private async toolMarketingIntegrations(tenantId: string) {
    const [integrations, stats] = await Promise.all([
      this.marketing.listMarketingIntegrations(tenantId),
      this.marketing
        .getTrafficChannelsStats(tenantId, undefined, undefined, undefined, 1)
        .catch(() => null),
    ]);

    const dataSourceLabels = stats?.dataSourceLabels ?? {};
    const existingDataSources = new Set(stats?.dataSources ?? []);

    const result = integrations.map((m) => {
      const s =
        m.settings && typeof m.settings === 'object' ? (m.settings as Record<string, unknown>) : {};
      const mode = String(s.googleAdsAccountMode || s.google_ads_account_mode || 'customer')
        .trim()
        .toLowerCase();

      const entry: Record<string, unknown> = {
        id: m.id,
        provider: m.provider,
        name: m.name,
        active: m.isActive,
        primaryId: m.primaryId,
        updatedAt: m.updatedAt,
      };

      if (m.provider === 'google_ads') {
        entry.accountMode = mode;
        if (mode === 'mcc_managed') {
          // Collect sub-accounts from the stored labels map
          const lblMap =
            (s.googleAdsManagedAccountLabels as Record<string, string> | undefined) ??
            (s.google_ads_managed_account_labels as Record<string, string> | undefined);
          if (lblMap && typeof lblMap === 'object') {
            entry.managedAccounts = Object.entries(lblMap).map(([cid, name]) => {
              const key = `google_ads_${cid.replace(/\D/g, '')}`.slice(0, 80);
              return {
                customerId: cid,
                name: name || `Google Ads · ${cid}`,
                dataSourceKey: key,
                hasTrafficData: existingDataSources.has(key),
              };
            });
          }
          entry.mccManagerId = m.primaryId;
        } else {
          const cid = String(m.primaryId || '').replace(/\D/g, '');
          const key = `google_ads_${cid}`.slice(0, 80);
          entry.dataSourceKey = key;
          entry.hasTrafficData = existingDataSources.has(key);
        }
      } else if (m.provider === 'ga4' || String(m.provider).startsWith('google_analytics')) {
        const pid = String(m.primaryId || '').replace(/\D/g, '');
        const key = `ga4_${pid}`.slice(0, 80);
        entry.dataSourceKey = key;
        entry.label = dataSourceLabels[key] || m.name;
        entry.hasTrafficData = existingDataSources.has(key);
      } else {
        // meta_ads, yandex_metrika, etc.
        const key = m.provider;
        entry.dataSourceKey = key;
        entry.hasTrafficData = existingDataSources.has(key);
      }

      return entry;
    });

    // Also expose all known data source keys so AI can use them in crm_marketing_overview
    const allDataSources = [...existingDataSources].map((ds) => ({
      key: ds,
      label: dataSourceLabels[ds] || ds,
    }));

    return {
      integrations: result,
      allDataSources,
      hint: 'Используй dataSourceKey как параметр dataSource в crm_marketing_overview для получения данных по конкретному аккаунту.',
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
    const salesIntegrations = salesRows.map((r) => {
      let catalogId: string | null = null;
      if (r.kind === 'third_party_link' && r.configJson) {
        try {
          const c = JSON.parse(r.configJson) as { catalogId?: string };
          if (c && typeof c.catalogId === 'string' && c.catalogId.trim()) {
            catalogId = c.catalogId.trim();
          }
        } catch {
          /* ignore */
        }
      }
      return {
        id: r.id,
        kind: r.kind,
        name: r.name,
        enabled: r.isEnabled,
        lastSyncStatus: r.lastSyncStatus,
        catalogId,
      };
    });
    return {
      salesIntegrations,
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
      integrations: salesIntegrations,
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
    ctx?: ToolCtx,
  ) {
    const tgMeta = ctx?.telegramChatId
      ? { telegram: { chatId: ctx.telegramChatId, username: ctx.telegramUsername ?? null } }
      : undefined;

    const lead = await this.leadsService.createForTenant(tenantId, {
      name: String(args.name || 'Без имени'),
      email: args.email ? String(args.email) : undefined,
      phone: args.phone ? String(args.phone) : undefined,
      source: args.source ? String(args.source) : (ctx?.telegramChatId ? 'telegram' : 'ai_assistant'),
      status: args.status ? String(args.status) : 'new',
      country: args.country ? String(args.country) : undefined,
      meta: tgMeta,
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
    const dtoBase: CreateCustomObjectDto = {
      name,
      description,
      meta,
      ...(fields?.length ? { fields } : {}),
    };
    const { dto, workspaceAreaId } = await this.workspaceAreaForNewTable(
      tenantId,
      dtoBase,
    );
    const created = await this.customObjects.createObject(tenantId, dto);
    const hasAnalytics = (meta.enabledViews as string[]).includes('analytics');
    const analyticsUrlPath = hasAnalytics
      ? `/workspace/${created.id}/analytics`
      : null;
    return {
      ok: true,
      objectId: created.id,
      name: created.name,
      slug: created.slug,
      ...this.workspaceToolLinkPayload(workspaceAreaId, created.id, analyticsUrlPath),
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

    const dtoBase: CreateCustomObjectDto = {
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

    const { dto, workspaceAreaId } = await this.workspaceAreaForNewTable(
      tenantId,
      dtoBase,
    );

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

    const analyticsUrlPath = `/workspace/${created.id}/analytics`;

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
      ...this.workspaceToolLinkPayload(workspaceAreaId, created.id, analyticsUrlPath),
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

  private async toolWorkspaceImportFile(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const objectId = String(args.objectId || '').trim();
    const importId = String(args.importId || '').trim();
    if (!objectId) return { ok: false, error: 'objectId_required' };
    if (!importId) return { ok: false, error: 'importId_required' };
    const fieldMapping = args.fieldMapping as Record<string, string | null> | undefined;
    try {
      const result = await this.customObjects.attachImportAndApply(
        tenantId,
        importId,
        objectId,
        fieldMapping && typeof fieldMapping === 'object' ? fieldMapping : undefined,
      );
      return { ...result, objectId, ...this.workspaceToolLinkPayload(null, objectId, null) };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'import_failed' };
    }
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

  private stripHtmlReport(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private async aiBuildReportPayload(
    tenantId: string,
    reportType: string,
    range: { from: Date; to: Date },
    args: Record<string, unknown>,
  ) {
    if (reportType === 'sales') {
      let rateMap = args.rates as Record<string, number> | string | undefined;
      if (typeof rateMap === 'string') {
        try {
          rateMap = JSON.parse(rateMap) as Record<string, number>;
        } catch {
          rateMap = undefined;
        }
      }
      return this.reportsService.buildSalesReport(tenantId, range, {
        currencyMode: args.currencyMode as 'native' | 'converted' | undefined,
        displayCurrency: args.displayCurrency as string | undefined,
        rates: rateMap as Record<string, number> | undefined,
        dateField: args.dateField as 'saleDate' | 'createdAt' | undefined,
      });
    }
    if (reportType === 'projects') {
      return this.reportsService.buildProjectsReport(tenantId, range);
    }
    if (reportType === 'tasks') {
      return this.reportsService.buildTasksReport(tenantId, range);
    }
    if (reportType === 'marketing') {
      return this.reportsService.buildMarketingReport(tenantId, range);
    }
    return this.reportsService.buildLeadsReport(tenantId, range);
  }

  private previewReportJson(payload: import('../automations/reports.service').ReportPayload) {
    return {
      title: payload.title,
      from: payload.range.from.toISOString().slice(0, 10),
      to: payload.range.to.toISOString().slice(0, 10),
      summary: payload.summary,
      summaryLabels: payload.summaryLabels,
      sections: payload.sections.map((s) => ({
        title: s.title,
        rows: s.rows.map((r) => ({
          label: r.label,
          count: r.count,
          amount: r.amount,
        })),
      })),
    };
  }

  private async toolPreviewCrmReport(
    tenantId: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const reportType = String(args.reportType || '').trim();
    const df = String(args.dateFrom || '').trim().slice(0, 10);
    const dt = String(args.dateTo || '').trim().slice(0, 10);
    if (!reportType || df.length !== 10 || dt.length !== 10) {
      return { ok: false, error: 'reportType_dateFrom_dateTo_required' };
    }
    const range = this.reportsService.parseInclusiveDateRange(df, dt);
    const payload = await this.aiBuildReportPayload(tenantId, reportType, range, args);
    return { ok: true, report: this.previewReportJson(payload) };
  }

  private async toolSendCrmReportEmail(
    tenantId: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (args.userConfirmedSend !== true) {
      return {
        ok: false,
        error: 'userConfirmedSend_must_be_true',
        hint:
          'Нужно явное согласие пользователя на отправку отчёта на почту; повтори вызов с userConfirmedSend: true (строго boolean true).',
      };
    }
    const reportType = String(args.reportType || '').trim();
    const df = String(args.dateFrom || '').trim().slice(0, 10);
    const dt = String(args.dateTo || '').trim().slice(0, 10);
    const accountId = String(args.accountId || '').trim();
    const toRaw = args.to;
    const toList = Array.isArray(toRaw)
      ? toRaw.map((x) => String(x).trim()).filter(Boolean)
      : String(toRaw || '')
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean);
    if (!reportType || df.length !== 10 || dt.length !== 10 || !accountId || !toList.length) {
      return {
        ok: false,
        error: 'missing_fields',
        need: ['reportType', 'dateFrom', 'dateTo', 'accountId', 'to'],
      };
    }
    const range = this.reportsService.parseInclusiveDateRange(df, dt);
    const payload = await this.aiBuildReportPayload(tenantId, reportType, range, args);
    const html = this.reportsService.renderEmailHtml(payload);
    const subject =
      (args.subject && String(args.subject).trim()) ||
      `${payload.title} · ${df} – ${dt}`;
    const attachments: Array<{ filename: string; contentType: string; content: Buffer }> = [];
    const wantPdf = args.formatPdf !== false;
    const wantXlsx = args.formatXlsx !== false;
    const wantCsv = Boolean(args.formatCsv);
    if (wantPdf) {
      attachments.push({
        filename: 'report.pdf',
        contentType: 'application/pdf',
        content: await this.reportsService.renderPdf(payload),
      });
    }
    if (wantXlsx) {
      attachments.push({
        filename: 'report.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        content: await this.reportsService.renderXlsx(payload),
      });
    }
    if (wantCsv) {
      attachments.push({
        filename: 'report.csv',
        contentType: 'text/csv; charset=utf-8',
        content: await this.reportsService.renderCsv(payload),
      });
    }
    await this.emailService.sendEmail(
      tenantId,
      {
        accountId,
        to: toList,
        subject,
        htmlBody: html,
        textBody: this.stripHtmlReport(html),
        attachments,
      } as any,
    );
    return {
      ok: true,
      subject,
      to: toList,
      attachments: attachments.map((a) => a.filename),
    };
  }

  private async toolMailchimpSubscribe(
    tenantId: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (args.userConfirmedAdd !== true) {
      return {
        ok: false,
        error: 'userConfirmedAdd_must_be_true',
        hint:
          'Нужно явное согласие пользователя на добавление в аудиторию Mailchimp; передай userConfirmedAdd: true (строго boolean true).',
      };
    }
    const connectionId = String(args.integrationConnectionId || '').trim();
    const listId = String(args.listId || '').trim();
    const email = String(args.email || '').trim().toLowerCase();
    if (!connectionId || !listId || !email) {
      return {
        ok: false,
        error: 'missing_fields',
        need: ['integrationConnectionId', 'listId', 'email'],
      };
    }
    const apiKey = await this.integrationsService.getMailchimpApiKeyForConnection(
      tenantId,
      connectionId,
    );
    if (!apiKey) {
      return {
        ok: false,
        error: 'invalid_mailchimp_connection',
        hint:
          'Проверь id подключения в crm_list_integrations (kind third_party_link, catalogId mailchimp).',
      };
    }
    let merge: Record<string, unknown> = {};
    const mf = args.mergeFields;
    if (mf != null) {
      if (typeof mf !== 'object' || Array.isArray(mf)) {
        return { ok: false, error: 'mergeFields_must_be_object' };
      }
      merge = mf as Record<string, unknown>;
    } else if (
      typeof args.mergeFieldsJson === 'string' &&
      args.mergeFieldsJson.trim()
    ) {
      try {
        const parsed = JSON.parse(args.mergeFieldsJson) as unknown;
        if (
          parsed === null ||
          typeof parsed !== 'object' ||
          Array.isArray(parsed)
        ) {
          return { ok: false, error: 'mergeFieldsJson_must_be_object' };
        }
        merge = parsed as Record<string, unknown>;
      } catch {
        return { ok: false, error: 'mergeFieldsJson_invalid_json' };
      }
    }
    const statusStr = String(args.subscriptionStatus || 'subscribed')
      .trim()
      .toLowerCase();
    const memberStatus = statusStr === 'pending' ? 'pending' : 'subscribed';
    await this.integrationsService.mailchimpUpsertMemberRaw(
      apiKey,
      listId,
      email,
      merge,
      { status: memberStatus },
    );
    return { ok: true, email, listId, subscriptionStatus: memberStatus };
  }

  private async toolListStaffMembers(
    tenantId: string,
    args: Record<string, unknown>,
  ) {
    const activeOnly = args.activeOnly !== false;
    const where: Record<string, unknown> = { tenantId };
    if (activeOnly) where.isActive = true;
    const staff = await this.staffRepo.find({
      where: where as any,
      order: { fullName: 'ASC' },
      take: 200,
    });
    return {
      ok: true,
      staff: staff.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        email: s.email,
        role: s.role,
        department: s.department,
        isActive: s.isActive,
      })),
      total: staff.length,
    };
  }

  private async findAiEmployeeForTool(
    tenantId: string,
    args: Record<string, unknown>,
  ): Promise<AiAgent | null> {
    const agentId = String(args.agentId || '').trim();
    if (agentId) {
      return this.aiAgentsRepo.findOne({
        where: { tenantId, id: agentId, status: 'active' as any },
      });
    }
    const role = String(args.role || '').trim().toLowerCase();
    const name = String(args.name || '').trim().toLowerCase();
    const agents = await this.aiAgentsRepo.find({
      where: { tenantId, status: 'active' as any },
      order: { createdAt: 'ASC' },
      take: 200,
    });
    if (role) {
      const byRole = agents.find((a) => String(a.role).toLowerCase() === role);
      if (byRole) return byRole;
    }
    if (name) {
      const byName = agents.find((a) => a.name.toLowerCase().includes(name));
      if (byName) return byName;
    }
    return agents[0] ?? null;
  }

  private async toolListAiEmployees(tenantId: string) {
    const agents = await this.aiAgentsRepo.find({
      where: { tenantId, status: 'active' as any },
      order: { createdAt: 'ASC' },
      take: 200,
    });
    return {
      ok: true,
      employees: agents.map((agent) => {
        const role = getAiEmployeeRole(agent.role);
        return {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          roleTitle: role?.title ?? agent.role,
          department: agent.department,
          jobTitle: agent.jobTitle,
          autonomyMode: agent.autonomyMode,
          scheduleMode: agent.scheduleMode,
          dailyReportTime: agent.dailyReportTime,
          createdAt: agent.createdAt,
        };
      }),
      total: agents.length,
    };
  }

  private async toolAssignAiEmployeeTask(
    ctx: ToolCtx,
    args: Record<string, unknown>,
  ) {
    const agent = await this.findAiEmployeeForTool(ctx.tenantId, args);
    if (!agent) return { ok: false, error: 'ai_employee_not_found' };
    const title = String(args.title || '').trim().slice(0, 255);
    const task = String(args.task || '').trim();
    if (!title || !task) {
      return { ok: false, error: 'title_and_task_required' };
    }
    const priority = String(args.priority || 'normal').trim().toLowerCase();
    const dueAt = args.dueAt ? String(args.dueAt).trim() : null;
    const action = this.aiAgentActionsRepo.create({
      tenantId: ctx.tenantId,
      agentId: agent.id,
      actionType: 'assigned_task',
      targetType: 'ai_employee',
      targetId: agent.id,
      title,
      reason: task.slice(0, 4000),
      payload: {
        task,
        priority,
        dueAt,
        assignedBy: {
          userId: ctx.userId,
          userEmail: ctx.userEmail ?? null,
        },
      },
      status: 'pending',
      requiresApproval: false,
      executedAt: null,
    });
    await this.aiAgentActionsRepo.save(action);
    await this.aiAgentLogsRepo.save(
      this.aiAgentLogsRepo.create({
        tenantId: ctx.tenantId,
        agentId: agent.id,
        actionId: action.id,
        userId: ctx.userId,
        eventType: 'task_assigned_from_main_ai',
        targetType: 'ai_employee',
        targetId: agent.id,
        inputSummary: title,
        outputSummary: task.slice(0, 500),
        status: 'success',
      }),
    );
    return {
      ok: true,
      assignedTo: {
        id: agent.id,
        name: agent.name,
        role: agent.role,
      },
      task: action,
    };
  }

  private async aiEmployeePermissions(tenantId: string, agent: AiAgent) {
    const rows = await this.aiAgentPermissionsRepo.find({
      where: { tenantId, agentId: agent.id },
      order: { permissionKey: 'ASC' },
    });
    const current = rows.reduce<Record<string, boolean>>((acc, row) => {
      acc[row.permissionKey] = row.value;
      return acc;
    }, {});
    const role = getAiEmployeeRole(agent.role);
    for (const key of role?.defaultPermissions || []) {
      if (!Object.prototype.hasOwnProperty.call(current, key)) current[key] = true;
    }
    return current;
  }

  private async aiEmployeeQuestionSnapshot(tenantId: string, permissions: Record<string, boolean>) {
    const canRead = (key: string) => permissions[key] === true;
    const canReadLeads = canRead('read_leads');
    const canReadSales = canRead('read_sales') || canRead('read_deals');
    const canReadProjects = canRead('read_projects') || canRead('read_tasks');
    const canReadMarketing = [
      'read_marketing',
      'read_campaigns',
      'read_marketing_traffic',
      'read_marketing_costs',
      'read_marketing_roi',
      'read_marketing_integrations',
      'read_attribution',
      'read_analytics',
    ].some(canRead);
    const leadsQb = this.leadsRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere(this.activeLeadCondition('l'));
    const [leadCount, recentLeads, salesSummary, projects, marketing] =
      await Promise.all([
        canReadLeads ? leadsQb.clone().getCount() : Promise.resolve(0),
        canReadLeads
          ? leadsQb.clone().orderBy('l.createdAt', 'DESC').take(20).getMany()
          : Promise.resolve([]),
        canReadSales
          ? this.toolSalesSummary(tenantId, {})
          : Promise.resolve(null),
        canReadProjects
          ? this.projectsRepo.find({
              where: { tenantId, isDeleted: false, isArchived: false } as any,
              order: { updatedAt: 'DESC' },
              take: 20,
            })
          : Promise.resolve([]),
        canReadMarketing
          ? this.toolMarketing(tenantId, {})
          : Promise.resolve(null),
      ]);
    return {
      generatedAt: new Date().toISOString(),
      permissions,
      leads: {
        totalActive: leadCount,
        recent: recentLeads.map((l) => ({
          id: l.id,
          name: l.name,
          status: l.status,
          source: l.source,
          email: l.email,
          phone: l.phone,
          createdAt: l.createdAt,
        })),
      },
      sales: salesSummary,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        amount: p.amount,
        currency: p.currency,
        updatedAt: p.updatedAt,
      })),
      marketing,
    };
  }

  private async toolAskAiEmployee(ctx: ToolCtx, args: Record<string, unknown>) {
    const agent = await this.findAiEmployeeForTool(ctx.tenantId, args);
    if (!agent) return { ok: false, error: 'ai_employee_not_found' };
    const question = String(args.question || '').trim();
    if (!question) return { ok: false, error: 'question_required' };
    const role = getAiEmployeeRole(agent.role);
    const permissions = await this.aiEmployeePermissions(ctx.tenantId, agent);
    const snapshot = await this.aiEmployeeQuestionSnapshot(ctx.tenantId, permissions);
    const { message, usage } = await this.openai.chatCompletion({
      messages: [
        {
          role: 'system',
          content: `Ты отвечаешь как AI-сотрудник Lumiva CRM, а не как общий ассистент.
Имя: ${agent.name}
Роль: ${role?.title ?? agent.role}
Отдел: ${agent.department || role?.department || 'CRM'}
Должность: ${agent.jobTitle || role?.jobTitle || agent.role}
Тон: ${agent.tone}
Инструкция роли: ${role?.systemPrompt || 'Отвечай строго по данным CRM.'}
Отвечай на языке пользователя. Не выдумывай цифры. Если данных нет в snapshot, так и скажи.`,
        },
        {
          role: 'user',
          content: `Вопрос пользователя к AI-сотруднику:
${question}

CRM snapshot для ответа:
${JSON.stringify(snapshot).slice(0, 18000)}`,
        },
      ],
      toolChoice: 'none',
    });
    const answer = message.content || '';
    await this.aiAgentLogsRepo.save(
      this.aiAgentLogsRepo.create({
        tenantId: ctx.tenantId,
        agentId: agent.id,
        userId: ctx.userId,
        eventType: 'question_answered_from_main_ai',
        inputSummary: question.slice(0, 500),
        outputSummary: answer.slice(0, 500),
        status: 'success',
        tokensUsed: (usage.prompt_tokens || 0) + (usage.completion_tokens || 0),
      }),
    );
    return {
      ok: true,
      employee: {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        roleTitle: role?.title ?? agent.role,
      },
      answer,
      snapshotGeneratedAt: snapshot.generatedAt,
    };
  }

  private async toolSendBulkEmail(
    ctx: ToolCtx,
    args: Record<string, unknown>,
  ) {
    if (args.userConfirmedSend !== true) {
      return {
        ok: false,
        error: 'userConfirmedSend_must_be_true',
        hint: 'Вызывай только после явного подтверждения рассылки пользователем.',
      };
    }

    const accountId = String(args.accountId || '').trim();
    const subject = String(args.subject || '').trim();
    const targetType = String(args.targetType || 'leads');
    const bodyText = args.bodyText ? String(args.bodyText) : '';
    const bodyHtml = args.bodyHtml ? String(args.bodyHtml) : '';
    const templateId = args.templateId ? String(args.templateId).trim() : '';
    const headline = args.headline ? String(args.headline).trim() : undefined;
    const maxRecipients = Math.min(500, Math.max(1, Number(args.maxRecipients) || 200));

    if (!accountId || !subject) {
      return { ok: false, error: 'accountId_subject_required' };
    }
    if (!bodyText.trim() && !bodyHtml.trim() && !templateId) {
      return { ok: false, error: 'bodyText_or_bodyHtml_or_templateId_required' };
    }

    type Recipient = { id: string; name: string; email: string; entityType: 'lead' | 'contact' };
    const recipients: Recipient[] = [];

    if (targetType === 'leads') {
      const qb = this.leadsRepo
        .createQueryBuilder('l')
        .where('l.tenantId = :tenantId', { tenantId: ctx.tenantId })
        .andWhere(this.activeLeadCondition('l'))
        .andWhere("COALESCE(l.email,'') != ''")
        .orderBy('l.createdAt', 'DESC')
        .take(maxRecipients * 4);
      if (args.filterStatus) qb.andWhere('l.status = :status', { status: String(args.filterStatus) });
      if (args.filterSource) qb.andWhere('l.source = :source', { source: String(args.filterSource) });
      if (args.filterDateFrom) qb.andWhere('l.createdAt >= :from', { from: new Date(String(args.filterDateFrom)) });
      if (args.filterDateTo) qb.andWhere('l.createdAt <= :to', { to: new Date(String(args.filterDateTo) + 'T23:59:59') });
      if (args.filterSearch) {
        const like = `%${args.filterSearch}%`;
        qb.andWhere("(COALESCE(l.name,'') ILIKE :like OR COALESCE(l.email,'') ILIKE :like)", { like });
      }
      const leads = await qb.getMany();
      const filtered = await this.filterLeadsByAccess(ctx, leads);
      for (const l of filtered.slice(0, maxRecipients)) {
        if (l.email) recipients.push({ id: l.id, name: l.name || '', email: l.email, entityType: 'lead' });
      }
    } else {
      const { items } = await this.contacts.findAll(ctx.tenantId, {
        search: args.filterSearch ? String(args.filterSearch) : undefined,
        status: args.filterStatus ? String(args.filterStatus) : undefined,
        limit: maxRecipients * 2,
      });
      for (const c of items.slice(0, maxRecipients)) {
        if (c.email) {
          const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
          recipients.push({ id: c.id, name: fullName, email: c.email, entityType: 'contact' });
        }
      }
    }

    if (!recipients.length) {
      return { ok: false, error: 'no_recipients_with_email', hint: 'В выбранном сегменте нет записей с email.' };
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const r of recipients) {
      try {
        const vars = { name: r.name, email: r.email };
        const entityOpts =
          r.entityType === 'lead'
            ? { leadId: r.id, variables: vars }
            : { contactId: r.id, variables: vars };

        if (templateId) {
          await this.emailService.sendStyledTransactionalMail(ctx.tenantId, {
            accountId,
            to: [r.email],
            subject,
            headline,
            ...entityOpts,
          });
        } else {
          const personalizedText = bodyText
            ? bodyText.replace(/\{\{name\}\}/g, r.name).replace(/\{\{email\}\}/g, r.email)
            : '';
          const personalizedHtml = bodyHtml
            ? bodyHtml.replace(/\{\{name\}\}/g, r.name).replace(/\{\{email\}\}/g, r.email)
            : '';
          await this.emailService.sendStyledTransactionalMail(ctx.tenantId, {
            accountId,
            to: [r.email],
            subject: subject.replace(/\{\{name\}\}/g, r.name).replace(/\{\{email\}\}/g, r.email),
            bodyText: personalizedText || undefined,
            bodyHtml: personalizedHtml || undefined,
            headline,
            ...entityOpts,
          });
        }
        sent++;
      } catch (e: any) {
        failed++;
        if (errors.length < 5) errors.push(`${r.email}: ${e?.message || 'error'}`);
      }
    }

    return {
      ok: sent > 0,
      sent,
      failed,
      total: recipients.length,
      ...(errors.length ? { sampleErrors: errors } : {}),
    };
  }
}
