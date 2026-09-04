/**
 * Единый список стандартных (не кастомных) полей проекта — общий для системного промпта
 * чата, промпта генератора задач и описания crm_project_create_column, чтобы держать в
 * одном месте и не пропускать поля по одному (leadId/priority/currency уже наступали на
 * эти грабли, будучи перечислены в одном месте промпта и забыты в другом).
 */
export const STANDARD_PROJECT_FIELDS_NOTE =
  'Название (name), Статус (status), Сумма (amount), Валюта (currency), Лид (leadId), Компания (companyId), Контакт (contactId), Ответственный (ownerUserId), Категория (category), Теги (tags), Описание (description), Этап/прогресс задач (считается от задач, не редактируется напрямую), Дата создания (createdAt).';

/**
 * Дополнительные function-calling инструменты CRM для AI-ассистента
 * (лиды, проекты, продажи, компании, контакты, заметки, workspace, маркетинг-синк).
 */
export const CRM_EXTENDED_AI_TOOL_DEFINITIONS: unknown[] = [
  {
    type: 'function',
    function: {
      name: 'crm_get_lead',
      description: 'Получить лид по UUID (все основные поля).',
      parameters: {
        type: 'object',
        properties: { leadId: { type: 'string' } },
        required: ['leadId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_update_lead',
      description:
        'Обновить лид: передай leadId и любые поля для изменения (имя, телефон, email, статус, source, utm*, contactId, companyId, assignedUserId и т.д.).',
      parameters: {
        type: 'object',
        properties: {
          leadId: { type: 'string' },
          name: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          country: { type: 'string' },
          status: { type: 'string' },
          source: { type: 'string' },
          utmSource: { type: 'string' },
          utmMedium: { type: 'string' },
          utmCampaign: { type: 'string' },
          utmContent: { type: 'string' },
          utmTerm: { type: 'string' },
          contactId: { type: 'string' },
          companyId: { type: 'string' },
          assignedUserId: { type: 'string' },
          customFields: { type: 'object' },
          meta: { type: 'object' },
        },
        required: ['leadId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_get_project',
      description: 'Получить проект (модуль «Проекты») по UUID.',
      parameters: {
        type: 'object',
        properties: { projectId: { type: 'string' } },
        required: ['projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_update_project',
      description:
        'Обновить проект: projectId и опционально name, description, amount, currency, status, category, tags (строка через запятую), leadId, companyId, contactId, ownerUserId, briefFileName, briefFileUrl, tasks (массив), comments (массив JSON), customFields. ' +
        'customFields — объект { <key>: <значение> } для кастомных колонок проекта: ключи и типы этих колонок узнавай через crm_project_list_columns, а если нужной колонки ещё нет — сначала создай её через crm_project_create_column. Формат значения зависит от type колонки: number → число, boolean → true/false, date → "YYYY-MM-DD", datetime → ISO-строка, daterange → {"start":"YYYY-MM-DD","end":"YYYY-MM-DD"}, select → одно из options.value, multiselect → массив options.value, остальные (text/textarea/email/phone/url) → строка.',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string' },
          status: { type: 'string' },
          category: { type: 'string' },
          tags: { type: 'string' },
          leadId: { type: 'string' },
          companyId: { type: 'string' },
          contactId: { type: 'string' },
          ownerUserId: { type: 'string' },
          briefFileName: { type: 'string' },
          briefFileUrl: { type: 'string' },
          tasks: {
            type: 'array',
            items: { type: 'object' },
            description: 'Задачи проекта (как в CRM)',
          },
          comments: {
            type: 'array',
            items: { type: 'object' },
            description: 'Комментарии к проекту (массив объектов)',
          },
          customFields: {
            type: 'object',
            description: 'Значения кастомных колонок проекта — { <key>: <значение> }, см. описание инструмента.',
          },
        },
        required: ['projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_project_list_columns',
      description:
        'Список кастомных колонок (полей) таблицы «Проекты» тенанта: id, key, label, type, options (для select/multiselect), source (для email/phone: manual — введено вручную, lead/company — берётся автоматически из привязанного лида/компании). ' +
        'Всегда вызывай это перед тем как читать/писать customFields проекта или создавать новую колонку — так узнаёшь реальные key и типы и не создашь дубликат уже существующей колонки.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_project_create_column',
      description:
        'Создать новую кастомную колонку (поле) в таблице «Проекты». НЕ вызывай для стандартных полей таблицы — они уже есть и меняются через crm_update_project, отдельной колонки под них заводить не нужно (например «колонка с лидом» — это уже существующее поле leadId, не кастомная колонка): ' +
        STANDARD_PROJECT_FIELDS_NOTE +
        ' Сначала проверь crm_project_list_columns — не создавай колонку, если подходящая кастомная уже есть. ' +
        'Выбирай type строго по смыслу данных: email → "email", телефон → "phone", ссылка/URL → "url", дата → "date", дата и время → "datetime", период (с — по) → "daterange", да/нет → "boolean", число/сумма → "number", один вариант из фиксированного списка → "select" (передай options), несколько вариантов сразу → "multiselect" (передай options), длинный текст/заметка → "textarea", короткая строка по умолчанию → "text". Ключ (key) генерируется автоматически из label, его знать не нужно.',
      parameters: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Название колонки, как его увидит пользователь, например "Ссылка на бриф"' },
          type: {
            type: 'string',
            enum: ['text', 'textarea', 'number', 'email', 'phone', 'date', 'datetime', 'daterange', 'boolean', 'select', 'multiselect', 'url'],
          },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'Только для select/multiselect — список вариантов (просто подписи текстом)',
          },
          source: {
            type: 'string',
            enum: ['manual', 'lead', 'company'],
            description: 'Только для email/phone: manual — вводится вручную (по умолчанию), lead/company — значение автоматически берётся из email/телефона привязанного лида или компании проекта, ручного ввода тогда нет.',
          },
        },
        required: ['label', 'type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_change_project_status',
      description:
        'Сменить статус проекта. Статусы настраиваются тенантом (см. /projects/settings) и могут отличаться от базового набора (Новый, В работе, На проверке, Заморожен, Закрыт, Выиграно, Проиграно) — если статус не подойдёт, инструмент вернёт allowed с актуальным списком для этого тенанта; используй его, не переспрашивай наугад.',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          status: { type: 'string' },
        },
        required: ['projectId', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_soft_delete_project',
      description: 'Мягко удалить проект (в корзину).',
      parameters: {
        type: 'object',
        properties: { projectId: { type: 'string' } },
        required: ['projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_list_sales',
      description:
        'Список продаж (сделок) с пагинацией. Фильтры: from, to (YYYY-MM-DD), status (pending|confirmed|cancelled|refunded), channelId, search.',
      parameters: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          pageSize: { type: 'integer', default: 25 },
          from: { type: 'string' },
          to: { type: 'string' },
          status: { type: 'string' },
          channelId: { type: 'string' },
          search: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_get_sale',
      description: 'Детальная карточка продажи по UUID.',
      parameters: {
        type: 'object',
        properties: { saleId: { type: 'string' } },
        required: ['saleId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_update_sale',
      description:
        'Обновить продажу: status (pending|confirmed|cancelled|refunded), managerName, notes, leadId, customFields (объект).',
      parameters: {
        type: 'object',
        properties: {
          saleId: { type: 'string' },
          status: { type: 'string' },
          managerName: { type: 'string' },
          notes: { type: 'string' },
          leadId: { type: 'string' },
          customFields: { type: 'object' },
        },
        required: ['saleId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_create_company',
      description: 'Создать компанию. Обязательно name.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          legalName: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          website: { type: 'string' },
          country: { type: 'string' },
          city: { type: 'string' },
          industry: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_get_company',
      description: 'Компания по UUID.',
      parameters: {
        type: 'object',
        properties: { companyId: { type: 'string' } },
        required: ['companyId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_update_company',
      description:
        'Обновить компанию: companyId и любые поля (name, email, phone, website, country, city, status, tags и т.д.).',
      parameters: {
        type: 'object',
        properties: {
          companyId: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          website: { type: 'string' },
          country: { type: 'string' },
          city: { type: 'string' },
          industry: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string' },
        },
        required: ['companyId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_delete_company',
      description: 'Удалить компанию безвозвратно (осторожно).',
      parameters: {
        type: 'object',
        properties: { companyId: { type: 'string' } },
        required: ['companyId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_list_contacts',
      description: 'Список контактов с фильтрами: search (имя/email/телефон/компания), status, assignedUserId, tags, limit (по умолчанию 30).',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          status: { type: 'string', description: 'Фильтр по статусу контакта' },
          assignedUserId: { type: 'string', description: 'UUID ответственного сотрудника' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Фильтр по тегам (совпадение хотя бы по одному)' },
          limit: { type: 'integer', default: 30 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_get_contact',
      description: 'Контакт по UUID.',
      parameters: {
        type: 'object',
        properties: { contactId: { type: 'string' } },
        required: ['contactId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_create_contact',
      description:
        'Создать контакт. Можно указать firstName, lastName, email, phone, companyId, position, country, city, status.',
      parameters: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          companyId: { type: 'string' },
          position: { type: 'string' },
          country: { type: 'string' },
          city: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_update_contact',
      description:
        'Обновить контакт: contactId и поля (firstName, lastName, email, phone, companyId, position, status, …).',
      parameters: {
        type: 'object',
        properties: {
          contactId: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          companyId: { type: 'string' },
          position: { type: 'string' },
          country: { type: 'string' },
          city: { type: 'string' },
          status: { type: 'string' },
        },
        required: ['contactId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_delete_contact',
      description: 'Удалить контакт.',
      parameters: {
        type: 'object',
        properties: { contactId: { type: 'string' } },
        required: ['contactId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_list_notes',
      description:
        'Заметки по сущности: entityType (contact|company|lead|sale|project), entityId. Показывает публичные и приватные текущего пользователя.',
      parameters: {
        type: 'object',
        properties: {
          entityType: {
            type: 'string',
            enum: ['contact', 'company', 'lead', 'sale', 'project'],
          },
          entityId: { type: 'string' },
          limit: { type: 'integer', default: 40 },
        },
        required: ['entityType', 'entityId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_update_note',
      description: 'Редактировать заметку по noteId (content, title, type).',
      parameters: {
        type: 'object',
        properties: {
          noteId: { type: 'string' },
          content: { type: 'string' },
          title: { type: 'string' },
          type: { type: 'string' },
        },
        required: ['noteId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_delete_note',
      description: 'Удалить заметку по noteId.',
      parameters: {
        type: 'object',
        properties: { noteId: { type: 'string' } },
        required: ['noteId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_workspace_update_record',
      description:
        'Обновить строку в таблице рабочей области: objectId, recordId, values (объект полей key→значение, merge с существующими).',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string' },
          recordId: { type: 'string' },
          values: { type: 'object', description: 'Поля для обновления' },
        },
        required: ['objectId', 'recordId', 'values'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_workspace_delete_record',
      description: 'Удалить строку в таблице рабочей области.',
      parameters: {
        type: 'object',
        properties: {
          objectId: { type: 'string' },
          recordId: { type: 'string' },
        },
        required: ['objectId', 'recordId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_sync_marketing_integration',
      description:
        'Запустить синхронизацию маркетинговой интеграции (GA4, Meta Ads, Яндекс.Метрика, Google Ads) по UUID из marketingIntegrations.',
      parameters: {
        type: 'object',
        properties: { integrationId: { type: 'string' } },
        required: ['integrationId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_list_company_tasks',
      description: 'Список задач компании (канбан задач по компании).',
      parameters: {
        type: 'object',
        properties: {
          companyId: { type: 'string' },
          status: {
            type: 'string',
            enum: ['todo', 'in_progress', 'review', 'done', 'cancelled'],
          },
        },
        required: ['companyId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_create_company_task',
      description:
        'Создать задачу компании: companyId, title; опционально description, status, priority, dueDate (ISO), assignedUserId, tags.',
      parameters: {
        type: 'object',
        properties: {
          companyId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string' },
          priority: { type: 'string' },
          dueDate: { type: 'string' },
          assignedUserId: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['companyId', 'title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_update_company_task',
      description:
        'Обновить задачу компании по taskId (любые поля из create + order).',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string' },
          priority: { type: 'string' },
          dueDate: { type: 'string' },
          assignedUserId: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          order: { type: 'integer' },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_delete_company_task',
      description: 'Удалить задачу компании по taskId.',
      parameters: {
        type: 'object',
        properties: { taskId: { type: 'string' } },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_list_lead_meetings',
      description:
        'Список встреч лида (календарь/напоминания): данные в meta.meetings.',
      parameters: {
        type: 'object',
        properties: { leadId: { type: 'string' } },
        required: ['leadId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_add_lead_meeting',
      description:
        'Добавить встречу лиду в meta.meetings (видно в карточке лида и календаре главной). Обязательно: leadId из crm_search_leads/crm_get_lead/crm_list_leads (только доступные пользователю лиды), title, startsAt в ISO 8601 (например 2026-04-05T10:00:00+03:00 или Z). Опционально: endsAt, meetingUrl, notes, attendeeUserIds.',
      parameters: {
        type: 'object',
        properties: {
          leadId: { type: 'string' },
          title: { type: 'string' },
          startsAt: { type: 'string' },
          endsAt: { type: 'string' },
          meetingUrl: { type: 'string' },
          notes: { type: 'string' },
          attendeeUserIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['leadId', 'title', 'startsAt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_update_lead_meeting',
      description:
        'Обновить встречу по leadId и meetingId (поля как у add; только переданные меняются).',
      parameters: {
        type: 'object',
        properties: {
          leadId: { type: 'string' },
          meetingId: { type: 'string' },
          title: { type: 'string' },
          startsAt: { type: 'string' },
          endsAt: { type: 'string' },
          meetingUrl: { type: 'string' },
          notes: { type: 'string' },
          attendeeUserIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['leadId', 'meetingId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_remove_lead_meeting',
      description: 'Удалить встречу у лида по meetingId.',
      parameters: {
        type: 'object',
        properties: {
          leadId: { type: 'string' },
          meetingId: { type: 'string' },
        },
        required: ['leadId', 'meetingId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_list_email_accounts',
      description: 'Список почтовых аккаунтов CRM для отправки (id, email, статус).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_list_email_templates',
      description: 'Список шаблонов писем (id, name, subject preview).',
      parameters: {
        type: 'object',
        properties: {
          activeOnly: { type: 'boolean', description: 'Только активные' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_preview_email_template',
      description:
        'Предпросмотр шаблона (без отправки): templateId и variables (объект). Подставляются {{path}} и простые {name}. Можно передать contactId/leadId. Результат покажи пользователю как черновик; отправка только вручную из панели.',
      parameters: {
        type: 'object',
        properties: {
          templateId: { type: 'string' },
          variables: { type: 'object' },
          contactId: { type: 'string' },
          leadId: { type: 'string' },
        },
        required: ['templateId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_draft_client_email',
      description:
        'ТОЛЬКО черновик — не отправляет почту. Сырой текст письма (subject + bodyText/bodyHtml или маркетинговый templateId). Объясни, что в итоге письмо оформится единой фирменной обёрткой (как транзакционные письма). После одобрения пользователем вызови crm_send_approved_client_email с userConfirmedSend: true или пользователь отправит из панели «Письмо».',
      parameters: {
        type: 'object',
        properties: {
          templateId: { type: 'string' },
          subject: { type: 'string' },
          textBody: { type: 'string' },
          htmlBody: { type: 'string' },
          contactId: { type: 'string' },
          leadId: { type: 'string' },
          companyId: { type: 'string' },
          saleId: { type: 'string' },
          variables: { type: 'object' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_send_approved_client_email',
      description:
        'Отправить письмо клиенту только после ЯВНОГО согласия в чате («отправляй», «всё ок, отправь», «да, отправь»). Обязательно userConfirmedSend: true (иначе отказ). Текст из bodyText/bodyHtml вкладывается в единую красивую обёртку. Нужны accountId (из crm_list_email_accounts), to — массив email-строк (если пользователь дал адрес в сообщении, включи его в to дословно), subject, bodyText и/или bodyHtml. Поиск лида по имени для получения email: crm_search_leads с query; leadId в этом инструменте опционален.',
      parameters: {
        type: 'object',
        properties: {
          userConfirmedSend: {
            type: 'boolean',
            description: 'Должно быть true только если пользователь прямо сейчас подтвердил отправку',
          },
          accountId: { type: 'string' },
          to: { type: 'array', items: { type: 'string' } },
          subject: { type: 'string' },
          bodyText: { type: 'string', description: 'Утверждённый текст (основной вариант для клиента)' },
          bodyHtml: { type: 'string', description: 'Опционально, если нужен свой HTML фрагмент внутри обёртки' },
          headline: { type: 'string', description: 'Заголовок в шапке письма (по умолчанию «Сообщение»)' },
          contactId: { type: 'string' },
          leadId: { type: 'string' },
          companyId: { type: 'string' },
          saleId: { type: 'string' },
          variables: { type: 'object' },
        },
        required: ['userConfirmedSend', 'accountId', 'to', 'subject'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_list_automations',
      description: 'Список автоматизаций тенанта.',
      parameters: {
        type: 'object',
        properties: {
          isActive: { type: 'boolean' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_create_automation',
      description:
        'Создать автоматизацию: name, triggerEvent, actions (массив { type, config }). Для периодических действий используй triggerEvent scheduled и meta: { schedule: { scheduleFrequency: weekly|daily|monthly|quarterly, scheduleTime: HH:mm, scheduleTimezone: IANA, scheduleDayOfWeek: 1-7 (пн=1), scheduleDayOfMonth: 1-31 } }. Действие send_email: accountId, to (массив), templateId или subject/textBody. Действие send_mailchimp: integrationConnectionId, listId, опционально email, mergeFieldsJson (объект), subscriptionStatus subscribed|pending (для double opt-in — pending). Действие send_mailchimp_campaign: разовая рассылка всей аудитории listId — integrationConnectionId, listId, subject, htmlBody, replyTo (email с верифицированного в Mailchimp домена), fromName (опционально), textBody (опционально), campaignTitle (опционально).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          triggerEvent: { type: 'string' },
          conditions: {
            type: 'array',
            items: { type: 'object' },
            description: 'Условия IF (поле, оператор, значение)',
          },
          actions: {
            type: 'array',
            items: { type: 'object' },
            description: 'Действия THEN: { type, config }',
          },
          isActive: { type: 'boolean' },
          maxExecutions: { type: 'integer' },
          cooldownSeconds: { type: 'integer' },
          meta: { type: 'object' },
        },
        required: ['name', 'triggerEvent', 'actions'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_update_automation',
      description: 'Обновить автоматизацию по automationId (любые поля как при создании).',
      parameters: {
        type: 'object',
        properties: {
          automationId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          triggerEvent: { type: 'string' },
          conditions: { type: 'array', items: { type: 'object' } },
          actions: { type: 'array', items: { type: 'object' } },
          isActive: { type: 'boolean' },
          maxExecutions: { type: 'integer' },
          cooldownSeconds: { type: 'integer' },
          meta: { type: 'object' },
        },
        required: ['automationId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_delete_automation',
      description: 'Удалить автоматизацию.',
      parameters: {
        type: 'object',
        properties: { automationId: { type: 'string' } },
        required: ['automationId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_preview_crm_report',
      description:
        'Построить отчёт CRM (как в автоматизациях «Отправить отчёт») за период и вернуть сводку в JSON: заголовок, период, итоги, секции (статусы/каналы и т.д.). Без отправки почты. Используй перед crm_send_crm_report_email, чтобы пользователь увидел цифры в чате.',
      parameters: {
        type: 'object',
        properties: {
          reportType: {
            type: 'string',
            enum: ['sales', 'leads', 'projects', 'tasks', 'marketing'],
            description: 'Тип отчёта',
          },
          dateFrom: { type: 'string', description: 'YYYY-MM-DD начало периода данных' },
          dateTo: { type: 'string', description: 'YYYY-MM-DD конец периода данных' },
          currencyMode: {
            type: 'string',
            enum: ['native', 'converted'],
            description: 'Только для sales',
          },
          displayCurrency: { type: 'string', description: 'Только для sales, например EUR' },
          dateField: {
            type: 'string',
            enum: ['saleDate', 'createdAt'],
            description: 'Только для sales',
          },
        },
        required: ['reportType', 'dateFrom', 'dateTo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_send_crm_report_email',
      description:
        'Отправить на email готовый отчёт CRM (PDF/XLSX как в сценариях): продажи, лиды, проекты, задачи, маркетинг (трафик). Только после явного согласия пользователя в чате («отправь отчёт», «да, на почту») — передай userConfirmedSend: true. Сначала при необходимости вызови crm_list_email_accounts за accountId.',
      parameters: {
        type: 'object',
        properties: {
          userConfirmedSend: {
            type: 'boolean',
            description: 'Обязательно true, если пользователь прямо сейчас подтвердил отправку отчёта',
          },
          reportType: {
            type: 'string',
            enum: ['sales', 'leads', 'projects', 'tasks', 'marketing'],
          },
          dateFrom: { type: 'string' },
          dateTo: { type: 'string' },
          accountId: { type: 'string', description: 'UUID почтового аккаунта из crm_list_email_accounts' },
          to: { type: 'array', items: { type: 'string' }, description: 'Email получателей' },
          subject: { type: 'string', description: 'Тема письма (по умолчанию из заголовка отчёта и дат)' },
          formatPdf: { type: 'boolean', description: 'По умолчанию true' },
          formatXlsx: { type: 'boolean', description: 'По умолчанию true' },
          formatCsv: { type: 'boolean', description: 'По умолчанию false' },
          currencyMode: { type: 'string', enum: ['native', 'converted'] },
          displayCurrency: { type: 'string' },
          dateField: { type: 'string', enum: ['saleDate', 'createdAt'] },
        },
        required: ['userConfirmedSend', 'reportType', 'dateFrom', 'dateTo', 'accountId', 'to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_mailchimp_subscribe',
      description:
        'Добавить или обновить подписчика в аудитории Mailchimp (Marketing API), то же что шаг сценария send_mailchimp. Только после явного согласия пользователя в чате — userConfirmedAdd: true. Сначала crm_list_integrations для integrationConnectionId (third_party_link, catalogId mailchimp).',
      parameters: {
        type: 'object',
        properties: {
          userConfirmedAdd: {
            type: 'boolean',
            description: 'Обязательно true, если пользователь прямо сейчас подтвердил добавление в список',
          },
          integrationConnectionId: {
            type: 'string',
            description: 'UUID подключения Mailchimp из crm_list_integrations.salesIntegrations',
          },
          listId: { type: 'string', description: 'Audience ID из Mailchimp' },
          email: { type: 'string', description: 'Email подписчика' },
          mergeFields: {
            type: 'object',
            description: 'Опционально: объект merge tags → строка (например FNAME, LNAME)',
            additionalProperties: true,
          },
          mergeFieldsJson: {
            type: 'string',
            description: 'Альтернатива mergeFields: JSON-объект одной строкой',
          },
          subscriptionStatus: {
            type: 'string',
            enum: ['subscribed', 'pending'],
            description: 'pending — double opt-in (если включено в аудитории); по умолчанию subscribed',
          },
        },
        required: [
          'userConfirmedAdd',
          'integrationConnectionId',
          'listId',
          'email',
        ],
      },
    },
  },
];

/**
 * Товары (модуль «Товары»): поиск/чтение без подтверждения, изменения цены/статуса/остатков —
 * только после userConfirmed*: true (см. buildSystemPrompt в ai-assistant.service.ts).
 */
export const CRM_PRODUCTS_AI_TOOL_DEFINITIONS: unknown[] = [
  {
    type: 'function',
    function: {
      name: 'crm_product_create',
      description:
        'Создать новый товар в каталоге. quantity задаёт начальный остаток на складе (создаётся движение прихода). ' +
        'Категория: если знаешь реальный UUID — передай categoryId (из crm_product_list_categories); если пользователь назвал категорию словами ("добавь в категорию Продукты") — передай category (текст), и инструмент сам найдёт существующую категорию с таким названием или создаст новую (в ответе будет createdCategory: true, если создал — сообщи об этом пользователю). ' +
        'Валюта: если не указана явно, берётся валюта, которой у тенанта уже оформлено большинство товаров (НЕ жёстко EUR) — проверь currency в ответе, если для тебя важно, в чём именно создан товар.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          sku: { type: 'string' },
          description: { type: 'string' },
          categoryId: { type: 'string', description: 'Реальный UUID категории из crm_product_list_categories' },
          category: { type: 'string', description: 'Название категории текстом — найдётся или создастся автоматически' },
          status: { type: 'string', description: 'active | draft | archived и т.п. — по умолчанию active' },
          price: { type: 'number' },
          costPrice: { type: 'number' },
          currency: { type: 'string', description: 'ISO код валюты; если не задан — определяется автоматически по уже существующим товарам тенанта' },
          unit: { type: 'string' },
          quantity: { type: 'number', description: 'Начальный остаток на складе' },
          barcode: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_product_create_category',
      description: 'Создать новую категорию товаров. Обычно не нужен напрямую — crm_product_create сам создаёт недостающую категорию по имени; используй этот инструмент, если пользователь явно просит завести категорию отдельно (или с родительской категорией/цветом).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          parentId: { type: 'string', description: 'UUID родительской категории (опционально)' },
          color: { type: 'string', description: 'HEX-цвет, напр. #22aabb (опционально)' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_product_search',
      description: 'Найти товары по названию или SKU (поиск ILIKE). Используй перед любым изменением цены/статуса/остатков, чтобы получить productId.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Название или SKU товара (частичное совпадение)' },
          categoryId: { type: 'string' },
          status: { type: 'string' },
          limit: { type: 'integer', default: 10 },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_product_get',
      description: 'Получить товар по UUID целиком (цена, себестоимость, остатки, варианты).',
      parameters: {
        type: 'object',
        properties: { productId: { type: 'string' } },
        required: ['productId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_product_list_categories',
      description: 'Список категорий товаров тенанта.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_product_update_price',
      description:
        'Изменить цену/скидку товара. Только после того как показал пользователю текущую цену (crm_product_get) и новую, и дождался явного согласия («меняй», «да, ставь такую цену») — тогда userConfirmedPriceChange: true.',
      parameters: {
        type: 'object',
        properties: {
          userConfirmedPriceChange: {
            type: 'boolean',
            description: 'true только если пользователь прямо сейчас подтвердил изменение цены',
          },
          productId: { type: 'string' },
          price: { type: 'number' },
          costPrice: { type: 'number' },
          currency: { type: 'string' },
          salePrice: { type: 'number', description: 'Акционная цена (если есть распродажа)' },
          saleStartAt: { type: 'string', description: 'ISO-дата начала акции' },
          saleEndAt: { type: 'string', description: 'ISO-дата окончания акции' },
        },
        required: ['userConfirmedPriceChange', 'productId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_product_update_status',
      description:
        'Изменить статус товара (например active/draft/archived) — влияет на видимость на витрине. Только после явного согласия пользователя — userConfirmedStatusChange: true.',
      parameters: {
        type: 'object',
        properties: {
          userConfirmedStatusChange: { type: 'boolean' },
          productId: { type: 'string' },
          status: { type: 'string' },
        },
        required: ['userConfirmedStatusChange', 'productId', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_product_bulk_update',
      description:
        'Массово изменить несколько товаров сразу (категория, статус, теги). Покажи пользователю список затронутых товаров и дождись согласия — userConfirmedBulkUpdate: true.',
      parameters: {
        type: 'object',
        properties: {
          userConfirmedBulkUpdate: { type: 'boolean' },
          productIds: { type: 'array', items: { type: 'string' } },
          categoryId: { type: 'string' },
          status: { type: 'string' },
          tagsToAdd: { type: 'array', items: { type: 'string' } },
          tagsToRemove: { type: 'array', items: { type: 'string' } },
        },
        required: ['userConfirmedBulkUpdate', 'productIds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_product_adjust_stock',
      description:
        'Скорректировать остаток товара (delta — положительное число, чтобы прибавить, отрицательное — чтобы списать). Только после явного согласия — userConfirmedStockAdjust: true.',
      parameters: {
        type: 'object',
        properties: {
          userConfirmedStockAdjust: { type: 'boolean' },
          productId: { type: 'string' },
          variantId: { type: 'string' },
          locationId: { type: 'string' },
          delta: { type: 'number', description: 'Ненулевое число: + приход, − списание' },
          reason: { type: 'string' },
        },
        required: ['userConfirmedStockAdjust', 'productId', 'delta'],
      },
    },
  },
];

/**
 * Бронирования («Бронирования» — запись на приём к мастеру/сотруднику в конкретное время;
 * НЕ то же самое, что номера отеля — см. CRM_HOTELS_AI_TOOL_DEFINITIONS ниже).
 */
export const CRM_BOOKINGS_AI_TOOL_DEFINITIONS: unknown[] = [
  {
    type: 'function',
    function: {
      name: 'crm_booking_list_locations',
      description: 'Список локаций модуля «Бронирования».',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_booking_list_services',
      description: 'Список услуг модуля «Бронирования» (для резолва названия услуги в id).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_booking_list_resources',
      description: 'Список ресурсов (кабинеты/оборудование) модуля «Бронирования».',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_booking_list_staff',
      description: 'Список сотрудников/мастеров модуля «Бронирования» (для резолва имени мастера в staffUserId). Если по имени несколько совпадений — покажи варианты и спроси пользователя, не выбирай сам.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_booking_check_availability',
      description: 'Проверить, свободен ли мастер/ресурс на конкретный интервал времени, перед созданием брони.',
      parameters: {
        type: 'object',
        properties: {
          staffUserId: { type: 'string' },
          resourceId: { type: 'string' },
          startAt: { type: 'string', description: 'ISO 8601 datetime' },
          endAt: { type: 'string', description: 'ISO 8601 datetime' },
        },
        required: ['startAt', 'endAt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_booking_search',
      description: 'Найти брони (записи на приём) по имени/телефону/email клиента и/или диапазону дат/статусу/мастеру/локации/услуге. Ответ: { results }. Если искал с query (именем) и передал from/to, а results пуст — инструмент САМ уже повторил поиск за тебя без имени и вернул { results: [], note, possibleMatchesByDate }: имя в базе может отличаться от указанного пользователем (опечатка/другое имя, напр. "Александр" вместо "Александра"). В этом случае прочти note и, если possibleMatchesByDate не пуст, покажи эти записи пользователю на подтверждение — НЕ утверждай, что ничего не найдено, и НЕ вызывай инструмент второй раз без query, это уже сделано.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          from: { type: 'string', description: 'ISO-дата, начало диапазона' },
          to: { type: 'string', description: 'ISO-дата, конец диапазона' },
          status: { type: 'string' },
          staffUserId: { type: 'string', description: 'UUID мастера/сотрудника' },
          locationId: { type: 'string', description: 'UUID локации' },
          serviceId: { type: 'string', description: 'UUID услуги' },
          limit: { type: 'integer', default: 15 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_booking_get',
      description: 'Получить бронь (запись на приём) по UUID.',
      parameters: {
        type: 'object',
        properties: { reservationId: { type: 'string' } },
        required: ['reservationId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_booking_create',
      description:
        'Создать бронь (запись клиента на приём к мастеру/на услугу). Перед вызовом озвучь пользователю клиента, мастера/услугу, дату и время и дождись явного согласия — тогда userConfirmedBooking: true.',
      parameters: {
        type: 'object',
        properties: {
          userConfirmedBooking: { type: 'boolean' },
          locationId: { type: 'string' },
          serviceId: { type: 'string' },
          staffUserId: { type: 'string' },
          resourceId: { type: 'string' },
          startAt: { type: 'string', description: 'ISO 8601 datetime' },
          endAt: { type: 'string', description: 'ISO 8601 datetime' },
          participants: { type: 'integer' },
          customerName: { type: 'string' },
          customerPhone: { type: 'string' },
          customerEmail: { type: 'string' },
          price: { type: 'number' },
          currency: { type: 'string' },
        },
        required: ['userConfirmedBooking', 'locationId', 'startAt', 'endAt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_booking_update',
      description:
        'Изменить существующую бронь: перенос времени, смена мастера/кабинета/локации/услуги, данные клиента, кол-во участников, цена, статус оплаты. reservationId и хотя бы одно поле для изменения. Дождись согласия пользователя — userConfirmedChange: true. Для смены статуса брони (подтвердить/отменить/чек-ин и т.п.) используй crm_booking_set_status, не этот инструмент. Если reservationId не найден — берётся не из твоей памяти/предыдущего текста, а СВЕЖИЙ из последнего crm_booking_search; если он всё равно не найден, ответ будет содержать closestMatch (ближайшая реальная запись) — сверься с ним, это почти всегда опечатка в одном символе UUID, а не отсутствие брони.',
      parameters: {
        type: 'object',
        properties: {
          userConfirmedChange: { type: 'boolean' },
          reservationId: { type: 'string' },
          startAt: { type: 'string' },
          endAt: { type: 'string' },
          staffUserId: { type: 'string' },
          resourceId: { type: 'string' },
          serviceId: { type: 'string', description: 'UUID услуги из crm_booking_list_services — меняет саму услугу брони' },
          locationId: { type: 'string' },
          customerName: { type: 'string' },
          customerPhone: { type: 'string' },
          customerEmail: { type: 'string' },
          participants: { type: 'integer' },
          price: { type: 'number' },
          currency: { type: 'string' },
          paymentStatus: { type: 'string', enum: ['not_required', 'unpaid', 'deposit_paid', 'paid', 'partially_refunded', 'refunded', 'failed'] },
        },
        required: ['userConfirmedChange', 'reservationId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_booking_set_status',
      description:
        'Сменить статус брони — объединяет подтверждение/отмену/отклонение/чек-ин/завершение/неявку в один инструмент, укажи action. ' +
        'confirm/cancel/reject меняют намерение по брони — дождись явного согласия пользователя в чате, затем userConfirmed: true. ' +
        'check_in/complete/mark_no_show лишь фиксируют уже случившийся факт — подтверждения не требуют. ' +
        'reservationId бери из свежего crm_booking_search, не из памяти/своего текста; если не найден, ответ вернёт closestMatch — почти всегда опечатка в одном символе UUID.',
      parameters: {
        type: 'object',
        properties: {
          reservationId: { type: 'string' },
          action: {
            type: 'string',
            enum: ['confirm', 'cancel', 'reject', 'check_in', 'complete', 'mark_no_show'],
          },
          userConfirmed: { type: 'boolean', description: 'Обязательно true для action confirm/cancel/reject; не нужен для check_in/complete/mark_no_show' },
        },
        required: ['reservationId', 'action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_booking_manage_location',
      description: 'Создать/изменить/удалить локацию (филиал/точку) — укажи action. create: name обязателен. update: locationId обязателен, любые поля кроме action/locationId — что меняешь; плюс workingHours ({mon..sun: [{start,end}]}) и status (active/pending/disabled). delete: locationId, необратимо — озвучь пользователю и дождись согласия перед вызовом.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'update', 'delete'] },
          locationId: { type: 'string', description: 'Обязателен для update/delete' },
          name: { type: 'string' },
          address: { type: 'string' },
          timezone: { type: 'string', description: 'Напр. Europe/Istanbul' },
          phone: { type: 'string' },
          email: { type: 'string' },
          notes: { type: 'string' },
          status: { type: 'string', description: 'Только для update: active | pending | disabled' },
          workingHours: { type: 'object', description: 'Только для update: ключи mon..sun -> массив [{start:"09:00",end:"18:00"}]' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_booking_manage_service',
      description: 'Создать/изменить/удалить услугу для записи — укажи action. create: name обязателен; ПЕРЕД созданием проверь crm_booking_list_services — если услуга с таким названием уже есть, используй её (update при необходимости), не создавай дубликат. update: serviceId обязателен, плюс active (boolean). delete: serviceId, необратимо — озвучь пользователю и дождись согласия перед вызовом.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'update', 'delete'] },
          serviceId: { type: 'string', description: 'Обязателен для update/delete' },
          name: { type: 'string' },
          category: { type: 'string' },
          color: { type: 'string', description: 'HEX для календаря' },
          durationMinutes: { type: 'integer', default: 60 },
          price: { type: 'number' },
          currency: { type: 'string' },
          capacityMin: { type: 'integer' },
          capacityMax: { type: 'integer' },
          locationIds: { type: 'array', items: { type: 'string' }, description: 'UUID локаций, где доступна услуга (из crm_booking_list_locations)' },
          staffUserIds: { type: 'array', items: { type: 'string' }, description: 'UUID мастеров, которые ВООБЩЕ умеют оказывать эту услугу (справочник/каталог, доступные для выбора при записи) — это НЕ мастер конкретной брони клиента и никак не отражается в списке записей. Если пользователь имеет в виду конкретную бронь/запись клиента ("назначь мастера на эту запись/бронь") — это crm_booking_update с staffUserId, а не это поле; при неясности спроси, что именно имеется в виду.' },
          autoConfirm: { type: 'boolean' },
          active: { type: 'boolean', description: 'Только для update' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_booking_manage_resource',
      description: 'Создать/изменить/удалить ресурс (кабинет/стол/оборудование и т.п.) — укажи action. create: name, locationId, type обязательны. update: resourceId обязателен, плюс active (boolean). delete: resourceId, необратимо — озвучь пользователю и дождись согласия перед вызовом.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'update', 'delete'] },
          resourceId: { type: 'string', description: 'Обязателен для update/delete' },
          name: { type: 'string' },
          locationId: { type: 'string', description: 'UUID локации (из crm_booking_list_locations); обязателен при create' },
          type: { type: 'string', description: 'room | cabinet | table | equipment | hall | parking и т.п.; обязателен при create' },
          quantity: { type: 'integer', description: 'Для пула одинаковых ресурсов, по умолчанию 1' },
          capacity: { type: 'integer' },
          assignedServiceIds: { type: 'array', items: { type: 'string' } },
          active: { type: 'boolean', description: 'Только для update' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_booking_manage_staff_profile',
      description:
        'Настроить сотрудника как мастера для записи: доступность для бронирования, недельный график, к каким локациям/услугам привязан, лимит одновременных броней, цвет в календаре. Не создаёт нового сотрудника (для этого нужен модуль «Команда») — только его профиль в модуле «Бронирования» для уже существующего staffUserId (см. crm_list_staff_members / crm_booking_list_staff).',
      parameters: {
        type: 'object',
        properties: {
          staffUserId: { type: 'string' },
          availableForBooking: { type: 'boolean', description: 'Может ли вообще принимать записи' },
          weeklyAvailability: {
            type: 'object',
            description: 'Ключи mon,tue,wed,thu,fri,sat,sun -> массив периодов [{start:"09:00",end:"18:00"}]; пустой массив или отсутствие ключа = выходной в этот день. Полностью заменяет прежний график.',
          },
          assignedLocationIds: { type: 'array', items: { type: 'string' }, description: 'UUID локаций, где принимает (из crm_booking_list_locations)' },
          assignedServiceIds: { type: 'array', items: { type: 'string' }, description: 'UUID услуг, которые оказывает (из crm_booking_list_services)' },
          maxSimultaneousBookings: { type: 'integer' },
          calendarColor: { type: 'string', description: 'HEX-цвет для календаря' },
        },
        required: ['staffUserId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_booking_manage_staff_time_off',
      description: 'Добавить/удалить отпуск-выходной мастеру — укажи action. add: from/to обязательны — на этот период мастер недоступен для записи и проверки слотов. remove: index обязателен (позиция в списке timeOff, начиная с 0 — узнай через crm_booking_list_staff).',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'remove'] },
          staffUserId: { type: 'string' },
          from: { type: 'string', description: 'ISO дата/время начала; только для add' },
          to: { type: 'string', description: 'ISO дата/время конца; только для add' },
          reason: { type: 'string' },
          index: { type: 'integer', description: 'Только для remove' },
        },
        required: ['action', 'staffUserId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_booking_manage_location_closure',
      description: '"Особая дата" локации (закрытый день/сокращённые часы, напр. праздник) — укажи action. add: date обязателен. remove: index обязателен (позиция в списке closures, начиная с 0 — узнай через crm_booking_list_locations).',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'remove'] },
          locationId: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD; только для add' },
          reason: { type: 'string' },
          customHours: {
            type: 'array',
            items: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' } } },
            description: 'Только для add: сокращённые часы вместо полного закрытия (опционально)',
          },
          index: { type: 'integer', description: 'Только для remove' },
        },
        required: ['action', 'locationId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_booking_analytics',
      description: 'Сводная аналитика модуля «Бронирования» за период: загрузка (occupancy), количество записей, доход и т.п. Используй, когда пользователь спрашивает про статистику/загрузку/динамику записей, а не для поиска конкретной брони.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'YYYY-MM-DD' },
          to: { type: 'string', description: 'YYYY-MM-DD' },
        },
      },
    },
  },
];

/**
 * Система резервации / Отели (номера отеля, тарифы по датам и группам рынков) — ДРУГОЙ модуль,
 * чем «Бронирования» выше: HotelReservation (номера), а не Reservation (запись на приём).
 */
export const CRM_HOTELS_AI_TOOL_DEFINITIONS: unknown[] = [
  {
    type: 'function',
    function: {
      name: 'crm_hotel_list',
      description: 'Список отелей тенанта (для резолва названия отеля в hotelId).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_hotel_get',
      description: 'Получить отель по UUID.',
      parameters: {
        type: 'object',
        properties: { hotelId: { type: 'string' } },
        required: ['hotelId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_hotel_list_room_types',
      description: 'Список типов номеров отеля (для резолва названия типа номера в roomTypeId).',
      parameters: {
        type: 'object',
        properties: { hotelId: { type: 'string' } },
        required: ['hotelId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_hotel_list_market_groups',
      description:
        'Список групп рынков отеля (например «Западная Европа», «Восточная Европа», «Внутренний рынок»). ОБЯЗАТЕЛЬНО вызови перед любым изменением тарифа — тариф хранится отдельно для каждой группы; если групп больше одной и пользователь не назвал нужную, спроси, для какой менять цену.',
      parameters: {
        type: 'object',
        properties: { hotelId: { type: 'string' } },
        required: ['hotelId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_hotel_list_markets',
      description:
        'Плоские (flat) тарифы за ночь по рынкам для КОНКРЕТНОГО типа номера — отдельная от групп рынков (crm_hotel_list_market_groups) и от посуточной цены по заезду (crm_hotel_get_daily_rates) система: если для рынка гостя настроен flat-тариф, он перекрывает Brutto/ночь. ВСЕГДА вызывай перед crm_hotel_reservation_create, если у брони есть определённый рынок гостя (страна) — чтобы не подставить/не попросить у пользователя неверную цену.',
      parameters: {
        type: 'object',
        properties: { roomTypeId: { type: 'string' } },
        required: ['roomTypeId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_hotel_create',
      description: 'Создать новый отель.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          city: { type: 'string' },
          country: { type: 'string' },
          stars: { type: 'integer', description: '1-5, по умолчанию 5' },
          currency: { type: 'string' },
          address: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_hotel_create_room_type',
      description: 'Создать новый тип номера в отеле (crm_hotel_list_room_types покажет существующие). Автоматически создаёт два базовых варианта размещения (SGL, 2 AD) — их можно изменить/дополнить через crm_hotel_create_occupancy_type.',
      parameters: {
        type: 'object',
        properties: {
          hotelId: { type: 'string' },
          name: { type: 'string' },
          sizeM2: { type: 'number' },
          capacityLabel: { type: 'string' },
          basePrice: { type: 'number' },
          currency: { type: 'string' },
          quantity: { type: 'integer', description: 'Кол-во номеров этого типа' },
          amenities: { type: 'array', items: { type: 'string' } },
        },
        required: ['hotelId', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_hotel_list_room_units',
      description: 'Список конкретных номеров (с реальными номерами/названиями — напр. "101", "Deluxe-3") для типа номера или отеля целиком.',
      parameters: {
        type: 'object',
        properties: {
          hotelId: { type: 'string' },
          roomTypeId: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_hotel_manage_room_unit',
      description: 'Создать/изменить/удалить конкретный номер (с номером/названием, напр. "101") у типа номера — укажи action. create: roomTypeId и label обязательны. update: roomUnitId обязателен, плюс active (boolean). delete: roomUnitId, необратимо — озвучь пользователю и дождись согласия перед вызовом.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'update', 'delete'] },
          roomUnitId: { type: 'string', description: 'Обязателен для update/delete' },
          roomTypeId: { type: 'string', description: 'Обязателен для create' },
          label: { type: 'string', description: 'Номер/название, напр. "101"; обязателен для create' },
          note: { type: 'string' },
          active: { type: 'boolean', description: 'Только для update' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_hotel_list_occupancy_types',
      description: 'Варианты размещения для типа номера (напр. SGL, 2 AD, 2 AD + 1 CHD) с коэффициентом цены — основа для посуточных тарифов (crm_hotel_get_daily_rates).',
      parameters: {
        type: 'object',
        properties: { roomTypeId: { type: 'string' } },
        required: ['roomTypeId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_hotel_manage_occupancy_type',
      description: 'Создать/изменить/удалить вариант размещения (заполняемость) типа номера, напр. "3 AD" с коэффициентом цены к базовой ставке — укажи action. create: roomTypeId, label, coefficient обязательны. update: occupancyTypeId обязателен. remove: occupancyTypeId, необратимо — озвучь пользователю и дождись согласия перед вызовом.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'update', 'remove'] },
          occupancyTypeId: { type: 'string', description: 'Обязателен для update/remove' },
          roomTypeId: { type: 'string', description: 'Обязателен для create' },
          label: { type: 'string' },
          coefficient: { type: 'number', description: 'Множитель к базовой цене номера, напр. 1.6; обязателен для create' },
          paidChildCount: { type: 'integer' },
          sortOrder: { type: 'integer' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_hotel_update_room_type',
      description: 'Изменить данные/наполнение типа номера: название, площадь, вместимость, кол-во номеров, удобства (amenities — полный список текстом, перезаписывает старый), обложку, стоп-продажу. Это НЕ тариф/цена за ночь — для тарифов используй crm_hotel_update_rate / crm_hotel_list_markets.',
      parameters: {
        type: 'object',
        properties: {
          roomTypeId: { type: 'string' },
          name: { type: 'string' },
          sizeM2: { type: 'number' },
          capacityLabel: { type: 'string', description: 'Текст вместимости, напр. "2 взрослых + 1 ребёнок"' },
          quantity: { type: 'integer', description: 'Кол-во номеров этого типа в отеле' },
          amenities: { type: 'array', items: { type: 'string' }, description: 'Полный список удобств — перезаписывает существующий, а не добавляет к нему' },
          coverPhotoUrl: { type: 'string' },
          stopSale: { type: 'boolean' },
        },
        required: ['roomTypeId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_hotel_analytics',
      description: 'Сводная аналитика системы резервации: загрузка номеров, доход, воронка, разбивка по типам номеров/рынкам/агентствам/демографии гостей. Используй для вопросов про статистику/загрузку/динамику, а не для поиска конкретной брони.',
      parameters: {
        type: 'object',
        properties: {
          hotelId: { type: 'string', description: 'UUID отеля, либо через запятую несколько; не задано = все отели' },
          roomTypeId: { type: 'string' },
          from: { type: 'string', description: 'YYYY-MM-DD, начало диапазона по дате заезда' },
          to: { type: 'string', description: 'YYYY-MM-DD, конец диапазона по дате заезда' },
          market: { type: 'string' },
          agencyId: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_hotel_get_daily_rates',
      description: 'Текущие тарифы номера на конкретные даты, по всем группам рынков сразу. Используй, чтобы показать «было» перед «станет» в изменении тарифа.',
      parameters: {
        type: 'object',
        properties: {
          roomTypeId: { type: 'string' },
          dates: { type: 'array', items: { type: 'string' }, description: 'Даты в формате YYYY-MM-DD' },
        },
        required: ['roomTypeId', 'dates'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_hotel_update_rate',
      description:
        'Изменить тариф номера на дату для конкретной группы рынков. Сначала crm_hotel_list_market_groups (резолв marketGroupId) и crm_hotel_get_daily_rates (текущая цена), назови группу рынков и старую/новую цену пользователю, дождись согласия — тогда userConfirmedRateChange: true.',
      parameters: {
        type: 'object',
        properties: {
          userConfirmedRateChange: { type: 'boolean' },
          roomTypeId: { type: 'string' },
          marketGroupId: { type: 'string', description: 'Из crm_hotel_list_market_groups — обязательно, если у отеля больше одной группы' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          budgetPP: { type: 'number' },
          ppAvg: { type: 'number' },
          grossPP: { type: 'number' },
          discountPct: { type: 'number' },
        },
        required: ['userConfirmedRateChange', 'roomTypeId', 'marketGroupId', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_hotel_set_stop_sale',
      description: 'Включить/выключить стоп-продажу номера на дату. Дождись согласия пользователя — userConfirmedStopSale: true.',
      parameters: {
        type: 'object',
        properties: {
          userConfirmedStopSale: { type: 'boolean' },
          roomTypeId: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          stopped: { type: 'boolean' },
        },
        required: ['userConfirmedStopSale', 'roomTypeId', 'date', 'stopped'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_hotel_reservation_search',
      description: 'Найти брони номеров отеля (HotelReservation) по отелю/типу номера/статусу/рынку/имени гостя.',
      parameters: {
        type: 'object',
        properties: {
          hotelId: { type: 'string' },
          roomTypeId: { type: 'string' },
          status: { type: 'string' },
          market: { type: 'string' },
          search: { type: 'string', description: 'Поиск по имени/email/телефону гостя' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_hotel_reservation_get',
      description: 'Получить бронь номера отеля по UUID.',
      parameters: {
        type: 'object',
        properties: { reservationId: { type: 'string' } },
        required: ['reservationId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_hotel_reservation_create',
      description:
        'Создать бронь номера отеля (заезд/выезд гостя). Перед вызовом озвучь пользователю отель, тип номера, даты, имя гостя И цену за ночь, дождись явного согласия — тогда userConfirmedReservation: true. Поле market — свободный текст региона гостя (например «Германия»), это НЕ marketGroupId из crm_hotel_list_market_groups, не путай их. Если market указан, а grossPerNight — нет, инструмент попробует автоматически подставить настроенный flat-тариф этого рынка (см. crm_hotel_list_markets) — ОБЯЗАТЕЛЬНО проверь marketPriceNote в ответе и озвучь пользователю реальную цену, использованную в брони, прежде чем подтверждать; если тариф не найден, инструмент не станет угадывать цену — вызови crm_hotel_list_markets и уточни у пользователя.',
      parameters: {
        type: 'object',
        properties: {
          userConfirmedReservation: { type: 'boolean' },
          hotelId: { type: 'string' },
          roomTypeId: { type: 'string' },
          guestName: { type: 'string' },
          guestEmail: { type: 'string' },
          guestPhone: { type: 'string' },
          pax: { type: 'integer' },
          market: { type: 'string', description: 'Свободный текст региона гостя, НЕ id группы рынков' },
          checkIn: { type: 'string', description: 'YYYY-MM-DD' },
          checkOut: { type: 'string', description: 'YYYY-MM-DD' },
          costPerNight: { type: 'number' },
          ppPerNight: { type: 'number' },
          grossPerNight: { type: 'number' },
          discountPct: { type: 'number' },
        },
        required: ['userConfirmedReservation', 'hotelId', 'roomTypeId', 'guestName', 'checkIn', 'checkOut'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_hotel_reservation_update',
      description:
        'Изменить бронь номера отеля — перенос дат, редактирование данных гостя/цены, кол-ва гостей, или отмена (status: "cancelled"). Дождись согласия пользователя — userConfirmedReservationChange: true. ' +
        'Итоговая сумма (total/roomTotal/ppTotal) автоматически пересчитывается из ночей × ставки за ночь при ЛЮБОМ изменении (даты/цена и т.п.) — но сама ставка за ночь НЕ меняется автоматически при изменении pax: если добавляешь/убираешь гостей и это должно повлиять на цену, сначала узнай актуальную ставку под новую вместимость (crm_hotel_get_daily_rates / crm_hotel_list_markets) и передай новый grossPerNight/ppPerNight вместе с pax в этом же вызове — иначе сумма останется прежней, из старой ставки.',
      parameters: {
        type: 'object',
        properties: {
          userConfirmedReservationChange: { type: 'boolean' },
          reservationId: { type: 'string' },
          checkIn: { type: 'string' },
          checkOut: { type: 'string' },
          pax: { type: 'integer' },
          guestName: { type: 'string' },
          guestEmail: { type: 'string' },
          guestPhone: { type: 'string' },
          costPerNight: { type: 'number' },
          ppPerNight: { type: 'number' },
          grossPerNight: { type: 'number' },
          discountPct: { type: 'number' },
          status: { type: 'string', enum: ['confirmed', 'pending', 'checked_in', 'checked_out', 'cancelled'] },
          paidStatus: { type: 'string', enum: ['full', 'partial', 'none', 'refunded'] },
        },
        required: ['userConfirmedReservationChange', 'reservationId'],
      },
    },
  },
];
