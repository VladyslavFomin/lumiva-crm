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
        'Обновить проект: projectId и опционально name, description, amount, currency, status, category, tags (строка через запятую), leadId, companyId, contactId, ownerUserId, briefFileName, briefFileUrl, tasks (массив), comments (массив JSON), customFields.',
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
        },
        required: ['projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crm_change_project_status',
      description:
        'Сменить статус проекта. status: Новый | В работе | На проверке | Заморожен | Закрыт | Выиграно | Проиграно',
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
      description: 'Список контактов: search, limit (по умолчанию 30).',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string' },
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
