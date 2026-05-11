import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiChatSession } from './ai-chat-session.entity';
import {
  deriveAiChatTitleFromUserMessage,
  isDefaultAiChatTitle,
} from './ai-chat-title.util';
import { AiChatMessage } from './ai-chat-message.entity';
import { AiMemoryChunk } from './ai-memory-chunk.entity';
import { AiOpenAiService, type ChatMessage } from './ai-openai.service';
import { AiToolsService, AI_TOOL_DEFINITIONS } from './ai-tools.service';
import { AiQuotaService } from './ai-quota.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { Lead } from '../leads/lead.entity';
import { Company } from '../companies/company.entity';
import { StaffUser } from '../staff/staff-user.entity';

const MAX_TOOL_ROUNDS = 8;
const MAX_HISTORY = 24;

@Injectable()
export class AiAssistantService {
  private readonly log = new Logger(AiAssistantService.name);

  constructor(
    @InjectRepository(AiChatSession)
    private readonly sessions: Repository<AiChatSession>,
    @InjectRepository(AiChatMessage)
    private readonly messages: Repository<AiChatMessage>,
    @InjectRepository(AiMemoryChunk)
    private readonly memoryRepo: Repository<AiMemoryChunk>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
    private readonly openai: AiOpenAiService,
    private readonly tools: AiToolsService,
    private readonly quota: AiQuotaService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  private buildSystemPrompt(memoryBlock: string): string {
    const now = new Date();
    const utcDate = now.toISOString().slice(0, 10);
    const frontendBase = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const envBlock =
      `\nТекущие дата/время (ориентир для модели; UTC): ${now.toISOString()} (дата ${utcDate}). ` +
      `Если пользователь называет только месяц («апрель», «за март») без года — по умолчанию используй календарный год этой даты, не предполагай прошлые годы без явного указания пользователя.` +
      (frontendBase
        ? `\nПубличный URL веб-интерфейса этой CRM: ${frontendBase}. В ссылках для пользователя используй этот домен и относительные пути из инструментов (например ${frontendBase}/workspace/…). Никогда не подставляй example.com или выдуманные домены.`
        : `\nBASE URL фронта не передан сервером (FRONTEND_URL): давай только относительные пути из инструментов (/workspace/…), без выдумывания полного домена.`);

    return `Ты — AI-ассистент Lumiva CRM. Помогаешь с текстами, идеями, аналитикой, маркетингом, данными CRM и модулями ниже.${envBlock}

Термины (не путай):
- Лиды — только модуль лидов CRM. Инструменты: crm_list_leads (последние записи), crm_search_leads (поиск по имени/email/телефону — обязателен для «найди лида Александра»), crm_get_lead (по UUID), crm_create_lead, crm_update_lead.
- Проекты — только модуль «Проекты» (сделки/проекты с суммой и статусом). Инструменты: crm_list_projects, crm_create_project. Это НЕ рабочая область.
- Интеграции: crm_list_integrations отдаёт два списка — salesIntegrations (продажи: WooCommerce, ручной импорт, сторонние связки third_party_link с полем catalogId — Mailchimp, Slack, Teams и т.д.) и marketingIntegrations (маркетинг: Meta/Facebook Ads, GA4, Яндекс.Метрика, Google Ads и т.д.). Запросы про рекламу, Meta, GA4 — смотри marketingIntegrations; не утверждай, что маркетинговых интеграций нет, если в ответе есть непустой marketingIntegrations. Mailchimp: подключение с catalogId mailchimp; в сценариях — действие send_mailchimp; из чата после явного согласия пользователя на добавление в список — crm_mailchimp_subscribe с userConfirmedAdd: true.
- Рабочая область — отдельный модуль пользовательских таблиц (раздел /workspace, свои поля и записи). Инструменты с префиксом crm_workspace_. Для таблицы, записей и сводной аналитики по ней используй только их. Никогда не называй проект «рабочей областью» и наоборот.
- Чтобы перенести в рабочую область данные по рекламе/каналам из CRM (то, что в маркетинге и marketing_traffic), используй crm_workspace_import_marketing_channels — он создаёт таблицу с колонками и заполняет строки. Не создавай пустую таблицу только через crm_workspace_create_table без fields и без последующих crm_workspace_add_record.
- Если таблица уже создана без колонок — добавь поля через crm_workspace_add_field, затем crm_workspace_describe_table и crm_workspace_add_record с правильными key.
- Если в сообщении есть блок «Вложение: импорт продаж» с importId — для завершения импорта вызови crm_sales_import_apply (маппинг из suggestedMapping, если пользователь не указал иное).
- Если блок «CSV в рабочую область» — создай таблицу с полями text по fieldKeys и заполни через crm_workspace_bulk_add_records (при большом файле пользователь может отправить только фрагмент строк).
- Изображения: для новой картинки или правок к недавней вызывай crm_generate_image с полным промптом (лучше на английском). Ты не видишь пиксели прошлого изображения — опиши сцену целиком с учётом правок.
- Если есть блок «Недавнее изображение в этом чате» и пользователь просит изменить персонажа, одежду, стиль или детали — обязательно вызови crm_generate_image; не отвечай только общими рассуждениями и не предлагай «текст отзыва» вместо перегенерации.
- После успешного crm_generate_image в ответе пользователю укажи ссылку на картинку из результата инструмента (markdown ![img](url) или явный URL).

Расширенные действия CRM (используй по запросу):
- Лиды: crm_get_lead, crm_update_lead (поиск по имени — через crm_search_leads, не выдумывай UUID). crm_list_leads поддерживает page (1, 2, 3…), source, search для полного перебора базы.
- Проекты: crm_get_project, crm_update_project (в т.ч. tasks, comments), crm_change_project_status, crm_soft_delete_project.
- Продажи: crm_list_sales, crm_get_sale, crm_update_sale.
- Компании: crm_create_company, crm_get_company, crm_update_company, crm_delete_company.
- Контакты: crm_list_contacts, crm_get_contact, crm_create_contact, crm_update_contact, crm_delete_contact.
- Заметки: crm_list_notes, crm_update_note, crm_delete_note (и crm_create_note как раньше).
- Рабочая область: crm_workspace_update_record, crm_workspace_delete_record.
- Маркетинг: crm_sync_marketing_integration по UUID из marketingIntegrations.
- Задачи компании: crm_list_company_tasks, crm_create_company_task, crm_update_company_task, crm_delete_company_task.
- Встречи лида (meta.meetings; карточка лида и календарь на главной): crm_list_lead_meetings, crm_add_lead_meeting, crm_update_lead_meeting, crm_remove_lead_meeting. Чтобы встреча появилась у пользователя в календаре, всегда привязывай к лиду: сначала crm_search_leads или crm_list_leads, возьми leadId из результата, затем crm_add_lead_meeting с startsAt в ISO 8601. Не выдумывай UUID лида.
- Почта: crm_list_email_accounts, crm_list_email_templates, crm_preview_email_template, crm_draft_client_email (черновик без отправки). Итоговое письмо оформляется единой фирменной HTML-обёрткой (как транзакционные письма): пользователю показывай утверждённый текст/тему; визуальная вёрстка добавится автоматически. Отправка: (1) пользователь открывает «Письмо» в панели и жмёт «Отправить», или (2) после явных фраз («отправляй», «всё ок, отправь», «да, отправь письмо») вызови crm_send_approved_client_email с userConfirmedSend: true, accountId из crm_list_email_accounts, to (массив строк email), subject и утверждённым bodyText/bodyHtml. Если пользователь написал email в чате (например user@mail.ru) — передай его в to как есть; не требуй контакт/лид в CRM для отправки. Если нужен email лида по имени — сначала crm_search_leads с query из имени, возьми email из результата; при нескольких совпадениях уточни у пользователя. Без подтверждения отправки не вызывай crm_send_approved_client_email. Не говори, что письмо отправлено, пока инструмент не вернул ok. В шаблонах маркетинга: {{поле.вложенное}} и простые {name}, {email}.
- Массовая рассылка (bulk): crm_send_bulk_email — отправляет персонализированное письмо ({{name}}, {{email}}) всем лидам или контактам сегмента. Алгоритм: (1) сначала crm_list_leads или crm_list_contacts чтобы показать пользователю аудиторию (кол-во, примеры), (2) показать итоговый черновик письма, (3) дождаться явного «запускай» / «отправляй всем» от пользователя, (4) вызвать crm_send_bulk_email с userConfirmedSend: true. Всегда указывай targetType (leads или contacts), accountId из crm_list_email_accounts. Фильтры: filterStatus, filterSource, filterDateFrom/To, filterSearch, maxRecipients (макс. 500). Без явного согласия пользователя не запускай рассылку.
- Команда: crm_list_staff_members — список сотрудников тенанта (id, ФИО, email, роль, отдел). Используй для получения assignedUserId при назначении лидов/задач или для рассылки внутри команды.
- Автоматизации: crm_list_automations, crm_create_automation, crm_update_automation, crm_delete_automation. Периодические сценарии: triggerEvent scheduled и meta.schedule с полями scheduleFrequency (weekly|daily|monthly|quarterly), scheduleTime (HH:mm), scheduleTimezone (IANA), scheduleDayOfWeek (1–7 пн=1 для weekly), scheduleDayOfMonth. В действии send_email для scheduled укажи accountId и to (массив email) и/или templateId. Mailchimp: send_mailchimp — один подписчик в аудиторию; send_mailchimp_campaign — одна email-кампания на всю аудиторию (subject, htmlBody, replyTo с верифицированного домена).
- AI-сотрудники: crm_list_ai_employees показывает доступных AI Employees (в т.ч. scheduleMode и autonomyMode); crm_assign_ai_employee_task ставит задачу конкретному AI-сотруднику; crm_ask_ai_employee задаёт вопрос AI-сотруднику и возвращает ответ от его роли по CRM-данным. Именование для пользователя: этот чат — универсальный CRM-помощник по всей системе; AI Employees — именованные специалисты с ролями (можно ссылаться по имени из списка). Если у сотрудника scheduleMode не manual, бэкенд может сам запускать фоновые циклы и ежедневный отчёт по dailyReportTime; новые лиды могут автоматически ставить задачи lead_manager/sales_manager (если не read_only и не отключено в settings.proactive.reactToNewLeads). Если пользователь просит «дай задачу AI-маркетологу/лид-менеджеру» или «спроси у AI-сотрудника», используй эти инструменты.

Правила:
- Доступ только к данным текущего арендатора (tenant из авторизации пользователя). Чужие tenantId недоступны; лиды, продажи, рабочая область (/workspace), интеграции и прочее — только внутри этой песочницы. Не проси и не подставляй иной tenant.
- Лиды в корзине или архиве (meta.deleted/meta.archived) не считаются активными и не должны попадать в ответы, рассылки, поиск и подсчёты.
- Отвечай на языке пользователя (по умолчанию русский).
- Для фактов и изменений в CRM вызывай соответствующие инструменты; не выдумывай цифры и не утверждай, что что-то создано, если инструмент не вызывался или вернул ошибку.
- Перед удалением компании/контакта/проекта/заметки/строки workspace убедись, что пользователь явно это просит; destructive-инструменты необратимы или ведут в корзину (проект).
- Выбирай инструмент по смыслу запроса: «лид» → лиды, «проект» в смысле сделки → проекты, «рабочая область / таблица в workspace» → crm_workspace_*.
- Перед созданием сущностей кратко уточни намерение, если запрос двусмысленный; если пользователь явно попросил — создавай через нужный инструмент.
- После успешного вызова инструмента кратко резюмируй результат (id, имя); для рабочей области можно подсказать путь /workspace/{objectId}/table или /analytics — или полный URL из полей tableUrl / analyticsUrl ответа инструмента, если они есть.
- Таблицы и статьи в ответе оформляй в Markdown.
${memoryBlock ? `\nКонтекст из памяти клиента:\n${memoryBlock}\n` : ''}`;
  }

  private async loadMemoryContext(
    tenantId: string,
    userHint: string,
  ): Promise<string> {
    const hint = userHint.slice(0, 500);
    const words = hint
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter((w) => w.length > 2)
      .slice(0, 8);
    if (!words.length) {
      const recent = await this.memoryRepo.find({
        where: { tenantId },
        order: { createdAt: 'DESC' },
        take: 6,
      });
      if (!recent.length) return '';
      return recent.map((m) => `- ${m.title || 'фрагмент'}: ${m.content.slice(0, 800)}`).join('\n');
    }
    const qb = this.memoryRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId })
      .orderBy('m.createdAt', 'DESC')
      .take(20);
    const ors = words.map((_, i) => `m.content ILIKE :w${i}`);
    words.forEach((w, i) => {
      qb.setParameter(`w${i}`, `%${w}%`);
    });
    if (ors.length) qb.andWhere(`(${ors.join(' OR ')})`);
    const rows = await qb.getMany();
    const pick = rows.slice(0, 8);
    if (!pick.length) return '';
    return pick
      .map((m) => `- ${m.title || 'память'}: ${m.content.slice(0, 1200)}`)
      .join('\n');
  }

  /** Текст для модели: видимый content + скрытый в UI контекст из meta (напр. правка картинки). */
  private expandUserContentForModel(row: AiChatMessage): string {
    let c = row.content || '';
    const meta = row.meta;
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return c;
    const im = (meta as Record<string, unknown>).imageFollowUp;
    if (!im || typeof im !== 'object' || Array.isArray(im)) return c;
    const o = im as Record<string, unknown>;
    const lastUrl = String(o.lastUrl || '').trim();
    if (!lastUrl) return c;
    const up = String(o.lastUserPrompt || '').trim() || '—';
    const rp = String(o.lastRevisedPrompt || '').trim() || '—';
    c += `\n\n--- Недавнее изображение в этом чате (интерфейс) ---\nПредыдущий промпт пользователя: ${up}\nУточнённый промпт модели (если был): ${rp}\nURL последней картинки (справочно; ты не видишь пиксели): ${lastUrl}\nЕсли пользователь просит изменить персонажа, одежду, стиль или композицию — вызови crm_generate_image с полным новым описанием сцены.`;
    return c;
  }

  private toOpenAiMessages(
    system: string,
    rows: AiChatMessage[],
  ): ChatMessage[] {
    const out: ChatMessage[] = [{ role: 'system', content: system }];
    for (const r of rows) {
      if (r.role === 'user') {
        out.push({
          role: 'user',
          content: this.expandUserContentForModel(r),
        });
      } else if (r.role === 'assistant') {
        out.push({
          role: 'assistant',
          content: r.content,
          tool_calls: r.toolCalls as any,
        });
      } else if (r.role === 'tool') {
        out.push({
          role: 'tool',
          tool_call_id: r.toolCallId || '',
          content: r.content || '',
        });
      }
    }
    return out;
  }

  async runChat(input: {
    tenantId: string;
    userId: string;
    userEmail?: string;
    userRole?: string;
    telegramUsername?: string;
    telegramChatId?: string;
    sessionId?: string | null;
    message: string;
    salesImportContext?: {
      importId: string;
      suggestedMapping?: Record<string, string | null>;
      fileName?: string;
      totalRows?: number;
    };
    workspaceCsvContext?: {
      fileName?: string;
      tableNameHint?: string;
      headers: string[];
      fieldKeys: string[];
      rows: Record<string, string>[];
    };
    imageFollowUpContext?: {
      lastUserPrompt?: string;
      lastRevisedPrompt?: string;
      lastUrl?: string;
    };
  }): Promise<{
    sessionId: string;
    reply: string;
    toolRounds: number;
    usage: { prompt_tokens: number; completion_tokens: number; costCents: number };
    imageUrl?: string | null;
    imageRevisedPrompt?: string | null;
  }> {
    const text = String(input.message || '').trim();
    const hasSalesAtt = Boolean(input.salesImportContext?.importId);
    const hasWsCsv =
      Array.isArray(input.workspaceCsvContext?.headers) &&
      input.workspaceCsvContext!.headers.length > 0;
    const hasImgCtx = Boolean(input.imageFollowUpContext?.lastUrl?.trim());
    if (!text && !hasSalesAtt && !hasWsCsv && !hasImgCtx) {
      throw new BadRequestException('Пустое сообщение');
    }

    const parts: string[] = [];
    if (text) parts.push(text);
    if (hasSalesAtt) {
      const c = input.salesImportContext!;
      parts.push(
        `\n\n--- Вложение: импорт продаж (CSV) — ${c.fileName || 'файл'}, строк: ${c.totalRows ?? '?'} ---\nimportId: ${c.importId}\nsuggestedMapping (JSON): ${JSON.stringify(c.suggestedMapping || {})}\nДействие: вызови crm_sales_import_apply с importId; fieldMapping можно опустить (подставится из сессии) или скорректировать; channelId — только если пользователь дал UUID канала.`,
      );
    }
    if (hasWsCsv) {
      const w = input.workspaceCsvContext!;
      parts.push(
        `\n\n--- Вложение: CSV в рабочую область — ${w.fileName || 'файл'}, передано строк: ${w.rows.length} ---\nfieldKeys (key колонок): ${JSON.stringify(w.fieldKeys)}\nheaders (подписи): ${JSON.stringify(w.headers)}\nrows (JSON): ${JSON.stringify(w.rows)}\nСначала crm_workspace_create_table: name осмысленное (${w.tableNameHint || w.fileName || 'таблица'}), fields: по одному полю на каждый fieldKeys с type text, label из headers; enabledViews при необходимости ["analytics"]. Затем crm_workspace_bulk_add_records с objectId и records = массив объектов с ключами из fieldKeys.`,
      );
    }
    if (hasImgCtx) {
      const im = input.imageFollowUpContext!;
      parts.push(
        `\n\n--- Недавнее изображение в этом чате (интерфейс) ---\nПредыдущий промпт пользователя: ${im.lastUserPrompt?.trim() || '—'}\nУточнённый промпт модели (если был): ${im.lastRevisedPrompt?.trim() || '—'}\nURL последней картинки (справочно; ты не видишь пиксели): ${im.lastUrl}\nЕсли пользователь просит изменить персонажа, одежду, стиль или композицию — вызови crm_generate_image с полным новым описанием сцены.`,
      );
    }

    const partsVisible: string[] = [];
    if (text) partsVisible.push(text);
    if (hasSalesAtt) {
      const c = input.salesImportContext!;
      partsVisible.push(
        `\n\n--- Вложение: импорт продаж (CSV) — ${c.fileName || 'файл'}, строк: ${c.totalRows ?? '?'} ---\nimportId: ${c.importId}\nsuggestedMapping (JSON): ${JSON.stringify(c.suggestedMapping || {})}\nДействие: вызови crm_sales_import_apply с importId; fieldMapping можно опустить (подставится из сессии) или скорректировать; channelId — только если пользователь дал UUID канала.`,
      );
    }
    if (hasWsCsv) {
      const w = input.workspaceCsvContext!;
      partsVisible.push(
        `\n\n--- Вложение: CSV в рабочую область — ${w.fileName || 'файл'}, передано строк: ${w.rows.length} ---\nfieldKeys (key колонок): ${JSON.stringify(w.fieldKeys)}\nheaders (подписи): ${JSON.stringify(w.headers)}\nrows (JSON): ${JSON.stringify(w.rows)}\nСначала crm_workspace_create_table: name осмысленное (${w.tableNameHint || w.fileName || 'таблица'}), fields: по одному полю на каждый fieldKeys с type text, label из headers; enabledViews при необходимости ["analytics"]. Затем crm_workspace_bulk_add_records с objectId и records = массив объектов с ключами из fieldKeys.`,
      );
    }

    const userContent = parts.join('').trim();
    const userContentVisible = partsVisible.join('').trim();
    if (userContent.length > 32_000) {
      throw new BadRequestException('Сообщение с вложением слишком длинное');
    }

    await this.quota.getQuotaSnapshot(input.tenantId);

    let session: AiChatSession;
    if (input.sessionId) {
      const s = await this.sessions.findOne({
        where: {
          id: input.sessionId,
          tenantId: input.tenantId,
          userId: input.userId,
        },
      });
      if (!s) throw new BadRequestException('Сессия не найдена');
      session = s;
    } else {
      session = this.sessions.create({
        tenantId: input.tenantId,
        userId: input.userId,
        title: (text || 'Вложение / запрос').slice(0, 80),
      });
      await this.sessions.save(session);
    }

    const memoryBlock = await this.loadMemoryContext(input.tenantId, userContent);
    const system = this.buildSystemPrompt(memoryBlock);

    const history = await this.messages.find({
      where: { sessionId: session.id },
      order: { createdAt: 'ASC' },
      take: MAX_HISTORY,
    });

    await this.messages.save(
      this.messages.create({
        sessionId: session.id,
        role: 'user',
        content:
          userContentVisible.length > 0 ? userContentVisible : text,
        meta: hasImgCtx
          ? { imageFollowUp: input.imageFollowUpContext }
          : null,
      }),
    );

    const allRows = await this.messages.find({
      where: { sessionId: session.id },
      order: { createdAt: 'ASC' },
      take: MAX_HISTORY,
    });

    let messages = this.toOpenAiMessages(system, allRows);
    let totalPrompt = 0;
    let totalCompletion = 0;
    let toolRounds = 0;

    const cfg = await this.platformSettings.getSettings();
    const inPrice = parseFloat(
      cfg?.aiPriceInputPerMtokUsd?.trim() || '0.15',
    );
    const outPrice = parseFloat(
      cfg?.aiPriceOutputPerMtokUsd?.trim() || '0.6',
    );

    let finalAssistantText = '';
    let lastGeneratedImage: { url: string; revised_prompt?: string } | null =
      null;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const { message: assistantMsg, usage } = await this.openai.chatCompletion({
        messages,
        tools: AI_TOOL_DEFINITIONS,
      });
      totalPrompt += usage.prompt_tokens || 0;
      totalCompletion += usage.completion_tokens || 0;

      const calls = assistantMsg.tool_calls;
      if (!calls?.length) {
        finalAssistantText = assistantMsg.content || '';
        if (
          lastGeneratedImage?.url &&
          !finalAssistantText.includes(lastGeneratedImage.url)
        ) {
          finalAssistantText = `${finalAssistantText.trim()}\n\n![Изображение](${lastGeneratedImage.url})`.trim();
        }
        await this.messages.save(
          this.messages.create({
            sessionId: session.id,
            role: 'assistant',
            content: finalAssistantText,
            toolCalls: null,
            meta: lastGeneratedImage?.url
              ? {
                  imageUrl: lastGeneratedImage.url,
                  revised_prompt: lastGeneratedImage.revised_prompt ?? null,
                }
              : null,
          }),
        );
        break;
      }

      toolRounds += 1;
      await this.messages.save(
        this.messages.create({
          sessionId: session.id,
          role: 'assistant',
          content: assistantMsg.content,
          toolCalls: calls as any,
        }),
      );

      messages = [...messages, assistantMsg as ChatMessage];

      for (const c of calls) {
        const name = c.function?.name || '';
        const argStr = c.function?.arguments || '{}';
        const result = await this.tools.execute(name, argStr, {
          tenantId: input.tenantId,
          userId: input.userId,
          userEmail: input.userEmail,
          userRole: input.userRole,
          telegramUsername: input.telegramUsername,
          telegramChatId: input.telegramChatId,
        });
        if (name === 'crm_generate_image') {
          try {
            const p = JSON.parse(result) as {
              ok?: boolean;
              url?: string;
              revised_prompt?: string;
            };
            if (p?.ok && p.url) {
              lastGeneratedImage = {
                url: p.url,
                revised_prompt: p.revised_prompt,
              };
            }
          } catch {
            /* ignore */
          }
        }
        await this.messages.save(
          this.messages.create({
            sessionId: session.id,
            role: 'tool',
            content: result,
            toolName: name,
            toolCallId: c.id,
          }),
        );
        messages.push({
          role: 'tool',
          tool_call_id: c.id,
          content: result,
        });
      }
    }

    if (!finalAssistantText && toolRounds >= MAX_TOOL_ROUNDS) {
      finalAssistantText =
        'Достигнут лимит шагов инструментов. Уточните запрос или разбейте задачу.';
      await this.messages.save(
        this.messages.create({
          sessionId: session.id,
          role: 'assistant',
          content: finalAssistantText,
        }),
      );
    }

    const costCents = this.openai.estimateCostCents(
      totalPrompt,
      totalCompletion,
      inPrice,
      outPrice,
    );
    await this.quota.chargeCents(input.tenantId, costCents, {
      userId: input.userId,
      kind: 'chat',
      model: cfg?.openAiModel || null,
      promptTokens: totalPrompt,
      completionTokens: totalCompletion,
      sessionId: session.id,
    });

    if (isDefaultAiChatTitle(session.title)) {
      session.title = deriveAiChatTitleFromUserMessage(text, userContentVisible);
    }
    await this.sessions.save(session);

    return {
      sessionId: session.id,
      reply: finalAssistantText,
      toolRounds,
      usage: {
        prompt_tokens: totalPrompt,
        completion_tokens: totalCompletion,
        costCents,
      },
      imageUrl: lastGeneratedImage?.url ?? null,
      imageRevisedPrompt: lastGeneratedImage?.revised_prompt ?? null,
    };
  }

  private async quickCompletion(prompt: string): Promise<string> {
    const { message } = await this.openai.chatCompletion({
      messages: [{ role: 'user', content: prompt }],
    });
    return message.content || '';
  }

  private isLeadHiddenForAi(lead: Pick<Lead, 'meta'>): boolean {
    const meta = lead.meta as { deleted?: unknown; archived?: unknown } | null | undefined;
    return meta?.deleted === true ||
      meta?.deleted === 'true' ||
      meta?.archived === true ||
      meta?.archived === 'true';
  }

  async scoreLead(tenantId: string, userId: string, leadId: string) {
    const lead = await this.leadRepo.findOne({ where: { id: leadId, tenantId } });
    if (!lead || this.isLeadHiddenForAi(lead)) throw new NotFoundException('Lead not found');

    const prompt = `Ты эксперт по продажам. Оцени качество и приоритет лида на основе данных ниже.
Данные лида:
- Имя: ${lead.name || '—'}
- Email: ${lead.email || '—'}
- Телефон: ${lead.phone || '—'}
- Статус: ${lead.status || '—'}
- Источник: ${lead.source || '—'}
- UTM: source=${lead.utmSource || '—'}, medium=${lead.utmMedium || '—'}, campaign=${lead.utmCampaign || '—'}
- Страна: ${(lead as any).country || '—'}
- Создан: ${lead.createdAt}
- Обновлён: ${lead.updatedAt}
- Доп. поля: ${JSON.stringify(lead.customFields || {}).slice(0, 400)}

Ответь строго в JSON (без markdown, без пояснений вне JSON):
{
  "score": <число 0-100>,
  "priority": "<high|medium|low>",
  "label": "<одно предложение — общий вывод>",
  "reasons": ["<причина 1>", "<причина 2>", "<причина 3>"]
}`;

    try {
      const raw = await this.quickCompletion(prompt);
      const json = raw.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(json);
      return {
        ok: true,
        score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
        priority: ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
        label: String(parsed.label || ''),
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String).slice(0, 5) : [],
        leadId,
        updatedAt: new Date().toISOString(),
      };
    } catch {
      return { ok: false, error: 'parse_failed', leadId };
    }
  }

  async enrichEntity(
    tenantId: string,
    userId: string,
    entityType: 'lead' | 'company',
    entityId: string,
  ) {
    let data: Record<string, any> = {};
    if (entityType === 'lead') {
      const lead = await this.leadRepo.findOne({ where: { id: entityId, tenantId } });
      if (!lead || this.isLeadHiddenForAi(lead)) throw new NotFoundException('Lead not found');
      data = {
        name: lead.name, email: lead.email, phone: lead.phone,
        source: lead.source, status: lead.status,
        utmSource: lead.utmSource, utmMedium: lead.utmMedium, utmCampaign: lead.utmCampaign,
        country: (lead as any).country,
        customFields: lead.customFields,
      };
    } else {
      const company = await this.companyRepo.findOne({ where: { id: entityId, tenantId } });
      if (!company) throw new NotFoundException('Company not found');
      data = {
        name: company.name, email: (company as any).email,
        phone: (company as any).phone, website: (company as any).website,
        country: (company as any).country, city: (company as any).city,
        industry: (company as any).industry, description: (company as any).description,
      };
    }

    const excludedFields = entityType === 'lead'
      ? ['score', 'priority', 'aiScore', 'aiPriority', 'aiLabel', 'leadScore', 'rating', 'id', 'tenantId', 'createdAt', 'updatedAt']
      : ['score', 'rating', 'id', 'tenantId', 'createdAt', 'updatedAt'];

    const prompt = `Ты CRM-аналитик. На основе данных ${entityType === 'lead' ? 'лида' : 'компании'} предложи улучшения/дополнения полей.
Текущие данные: ${JSON.stringify(data)}

ВАЖНО: НЕ предлагай поля: ${excludedFields.join(', ')} — они вычисляются автоматически отдельным модулем.
Предлагай только реальные атрибуты сущности: для лида — industry, country, language, companySize и подобные; для компании — industry, website, description и подобные.

Верни строго JSON (без markdown):
{
  "insight": "<общий вывод 1-2 предложения>",
  "suggestions": [
    {
      "field": "<имя поля>",
      "label": "<читаемое название поля>",
      "currentValue": "<текущее значение или null>",
      "suggestedValue": "<предложенное значение>",
      "confidence": "<high|medium>",
      "reasoning": "<почему>"
    }
  ]
}
Предлагай только поля, которые реально можно заполнить на основе доступных данных (email домен → индустрия, страна; UTM → канал и т.д.). Максимум 5 предложений.`;

    try {
      const raw = await this.quickCompletion(prompt);
      const json = raw.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(json);
      return {
        ok: true,
        insight: String(parsed.insight || ''),
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : [],
        entityType,
        entityId,
        updatedAt: new Date().toISOString(),
      };
    } catch {
      return { ok: false, error: 'parse_failed', entityType, entityId };
    }
  }

  async suggestEmailReply(
    tenantId: string,
    userId: string,
    input: { subject?: string; body?: string; senderName?: string },
  ) {
    const subject = (input.subject || '').trim();
    const body = (input.body || '').trim().slice(0, 3000);
    const sender = (input.senderName || '').trim();
    if (!body && !subject) throw new BadRequestException('subject or body required');

    const prompt = `Ты помощник менеджера по продажам. Письмо от клиента:
Отправитель: ${sender || 'клиент'}
Тема: ${subject || '—'}
Текст: ${body || '—'}

Напиши ровно 3 варианта ответного письма (только текст, без HTML):
1) Официальный и краткий
2) Дружелюбный и развёрнутый
3) Деловой с чётким следующим шагом

Верни строго JSON (без markdown):
{"suggestions": ["<вариант 1>", "<вариант 2>", "<вариант 3>"]}`;

    try {
      const raw = await this.quickCompletion(prompt);
      const json = raw.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(json);
      const suggestions = Array.isArray(parsed.suggestions)
        ? parsed.suggestions.map(String).slice(0, 3)
        : [];
      return { ok: true, suggestions };
    } catch {
      return { ok: false, error: 'parse_failed', suggestions: [] };
    }
  }

  // ── AI NEXT BEST ACTION ──────────────────────────────────────────────────
  async nextAction(tenantId: string, userId: string, leadId: string) {
    const lead = await this.leadRepo.findOne({ where: { id: leadId, tenantId } });
    if (!lead || this.isLeadHiddenForAi(lead)) throw new NotFoundException('Lead not found');

    const prompt = `Ты эксперт по продажам B2B/B2C. Проанализируй данные лида и предложи одно конкретное следующее действие менеджера.
Данные:
- Имя: ${lead.name || '—'}
- Email: ${lead.email || '—'}
- Телефон: ${lead.phone || '—'}
- Статус: ${lead.status || '—'}
- Канал: ${(lead as any).channel || '—'}
- Источник: ${lead.source || '—'}
- UTM: ${[lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean).join(' / ') || '—'}
- Страна: ${(lead as any).country || '—'}
- Создан: ${lead.createdAt}

Верни строго JSON (без markdown):
{
  "action": "<короткое название действия, макс 6 слов>",
  "channel": "<phone|email|meeting|message>",
  "urgency": "<hot|warm|cold>",
  "reason": "<1-2 предложения — почему именно это действие>",
  "steps": ["<шаг 1>", "<шаг 2>", "<шаг 3>"]
}`;

    try {
      const raw = await this.quickCompletion(prompt);
      const json = raw.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(json);
      return {
        ok: true,
        action: String(parsed.action || ''),
        channel: String(parsed.channel || 'email'),
        urgency: String(parsed.urgency || 'warm'),
        reason: String(parsed.reason || ''),
        steps: Array.isArray(parsed.steps) ? parsed.steps.map(String).slice(0, 5) : [],
        leadId,
        updatedAt: new Date().toISOString(),
      };
    } catch {
      return { ok: false, error: 'parse_failed', leadId };
    }
  }

  private countryToLanguage(country: string | null | undefined): string {
    if (!country) return 'Russian';
    const c = country.trim().toUpperCase();
    const map: Record<string, string> = {
      RU: 'Russian', RUS: 'Russian', RUSSIA: 'Russian', РОССИЯ: 'Russian',
      UA: 'Ukrainian', UKR: 'Ukrainian', UKRAINE: 'Ukrainian', УКРАИНА: 'Ukrainian',
      BY: 'Russian', BLR: 'Russian', BELARUS: 'Russian',
      KZ: 'Russian', KAZ: 'Russian', KAZAKHSTAN: 'Russian',
      US: 'English', USA: 'English', GB: 'English', UK: 'English', AU: 'English', CA: 'English',
      DE: 'German', DEU: 'German', GERMANY: 'German',
      FR: 'French', FRA: 'French', FRANCE: 'French',
      ES: 'Spanish', ESP: 'Spanish', SPAIN: 'Spanish',
      IT: 'Italian', ITA: 'Italian', ITALY: 'Italian',
      PL: 'Polish', POL: 'Polish', POLAND: 'Polish',
      CN: 'Chinese', CHN: 'Chinese', CHINA: 'Chinese',
      TR: 'Turkish', TUR: 'Turkish', TURKEY: 'Turkish',
    };
    return map[c] ?? 'English';
  }

  // ── AI OUTREACH EMAIL ────────────────────────────────────────────────────
  async generateOutreachEmail(tenantId: string, userId: string, leadId: string) {
    const lead = await this.leadRepo.findOne({ where: { id: leadId, tenantId } });
    if (!lead || this.isLeadHiddenForAi(lead)) throw new NotFoundException('Lead not found');

    const [companyEntity, senderUser] = await Promise.all([
      lead.companyId ? this.companyRepo.findOne({ where: { id: lead.companyId, tenantId } }) : Promise.resolve(null),
      this.staffRepo.findOne({ where: { id: userId, tenantId } }),
    ]);

    const companyName = (lead as any).companyName || companyEntity?.name || null;
    const senderName = senderUser?.fullName || 'Менеджер';
    const language = this.countryToLanguage((lead as any).country);

    const prompt = `Ты опытный менеджер по продажам. Напиши персонализированное первое письмо потенциальному клиенту.
Данные клиента:
- Имя: ${lead.name || 'клиент'}
- Email: ${lead.email || '—'}
- Компания: ${companyName || '—'}
- Страна: ${(lead as any).country || '—'}
- Источник лида: ${lead.source || (lead as any).channel || '—'}
- UTM кампания: ${lead.utmCampaign || '—'}

Данные отправителя:
- Имя менеджера: ${senderName}

ОБЯЗАТЕЛЬНО: Напиши письмо на языке "${language}". Подпись — "${senderName}".

Требования к письму:
- Персонализация по имени и компании
- Чёткое ценностное предложение (CRM/автоматизация бизнеса)
- Конкретный следующий шаг (звонок, демо)
- Естественный деловой тон, без шаблонных фраз
- Длина: 80-120 слов
- Подпись в конце: ${senderName}

Верни строго JSON (без markdown):
{
  "subject": "<тема письма>",
  "body": "<текст письма с переносами строк через \\n>",
  "tone": "<formal|friendly|direct>"
}`;

    try {
      const raw = await this.quickCompletion(prompt);
      const json = raw.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(json);
      return {
        ok: true,
        subject: String(parsed.subject || ''),
        body: String(parsed.body || ''),
        tone: String(parsed.tone || 'friendly'),
        leadId,
        leadEmail: lead.email || null,
        leadName: lead.name || null,
      };
    } catch {
      return { ok: false, error: 'parse_failed', leadId };
    }
  }

  // ── AI DUPLICATE DETECTION ───────────────────────────────────────────────
  async findDuplicates(tenantId: string, userId: string) {
    const rawLeads = await this.leadRepo.find({
      where: { tenantId },
      select: ['id', 'name', 'email', 'phone', 'createdAt', 'meta'] as any,
      take: 220,
      order: { createdAt: 'DESC' } as any,
    });
    const leads = rawLeads
      .filter((lead) => !this.isLeadHiddenForAi(lead))
      .slice(0, 150);

    if (leads.length < 2) return { ok: true, groups: [] };

    const simplified = leads.map(l => ({
      id: l.id,
      name: l.name || '',
      email: l.email || '',
      phone: (l as any).phone || '',
    }));

    const prompt = `Ты аналитик данных CRM. Найди потенциальные дубликаты среди лидов.
Правила: дубликат — это один и тот же человек/контакт с похожими именем, email или телефоном (учитывай опечатки, разные форматы).
Данные (JSON): ${JSON.stringify(simplified)}

Верни строго JSON (без markdown), только группы с 2+ дублей:
{
  "groups": [
    {
      "ids": ["<id1>", "<id2>"],
      "reason": "<почему они дубликаты>",
      "confidence": "<high|medium>"
    }
  ]
}
Если дублей нет — верни {"groups": []}. Максимум 20 групп.`;

    try {
      const raw = await this.quickCompletion(prompt);
      const json = raw.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(json);
      const leadsById = new Map(leads.map(l => [l.id, l]));
      const groups = Array.isArray(parsed.groups)
        ? parsed.groups
            .filter((g: any) => Array.isArray(g.ids) && g.ids.length >= 2)
            .slice(0, 20)
            .map((g: any) => ({
              leads: g.ids.map((id: string) => leadsById.get(id)).filter(Boolean),
              reason: String(g.reason || ''),
              confidence: String(g.confidence || 'medium'),
            }))
            .filter((g: any) => g.leads.length >= 2)
        : [];
      return { ok: true, groups, scanned: leads.length };
    } catch {
      return { ok: false, error: 'parse_failed', groups: [] };
    }
  }

  // ── AI SMART SEARCH ──────────────────────────────────────────────────────
  async smartSearch(tenantId: string, userId: string, query: string) {
    if (!query.trim()) return { ok: true, filters: {}, description: '' };

    const prompt = `Ты помощник CRM. Разбери запрос пользователя в структурированные фильтры для поиска лидов.
Запрос: "${query}"

Доступные фильтры:
- status: one of "Новый клиент" | "В работе" | "Ожидает ответа" | "Закрыт (успех)" | "Закрыт (проигран)"
- source: строка-источник (например "google", "facebook", "website")
- channel: строка (например "manual", "api", "form")
- country: код страны 2 буквы или название
- search: свободный текст для поиска по имени/email/телефону
- hasEmail: true/false
- hasPhone: true/false
- createdAfter: ISO дата "YYYY-MM-DD"
- createdBefore: ISO дата "YYYY-MM-DD"
Сегодня: ${new Date().toISOString().slice(0, 10)}

Верни строго JSON (без markdown):
{
  "filters": { /* только релевантные поля */ },
  "description": "<что ищем, 1 строка на русском>"
}`;

    try {
      const raw = await this.quickCompletion(prompt);
      const json = raw.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(json);
      return {
        ok: true,
        filters: parsed.filters || {},
        description: String(parsed.description || query),
      };
    } catch {
      return { ok: false, error: 'parse_failed', filters: {}, description: query };
    }
  }
}
