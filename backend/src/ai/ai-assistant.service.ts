import { Injectable, BadRequestException, Logger } from '@nestjs/common';
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
    private readonly openai: AiOpenAiService,
    private readonly tools: AiToolsService,
    private readonly quota: AiQuotaService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  private buildSystemPrompt(memoryBlock: string): string {
    return `Ты — AI-ассистент Lumiva CRM. Помогаешь с текстами, идеями, аналитикой, маркетингом, данными CRM и модулями ниже.

Термины (не путай):
- Лиды — только модуль лидов CRM. Инструменты: crm_list_leads (последние записи), crm_search_leads (поиск по имени/email/телефону — обязателен для «найди лида Александра»), crm_get_lead (по UUID), crm_create_lead, crm_update_lead.
- Проекты — только модуль «Проекты» (сделки/проекты с суммой и статусом). Инструменты: crm_list_projects, crm_create_project. Это НЕ рабочая область.
- Интеграции: crm_list_integrations отдаёт два списка — salesIntegrations (продажи: WooCommerce, ручной импорт, раздел «Интеграции» CRM) и marketingIntegrations (маркетинг: Meta/Facebook Ads, GA4, Яндекс.Метрика, Google Ads и т.д.). Запросы про рекламу, Meta, GA4 — смотри marketingIntegrations; не утверждай, что маркетинговых интеграций нет, если в ответе есть непустой marketingIntegrations.
- Рабочая область — отдельный модуль пользовательских таблиц (раздел /workspace, свои поля и записи). Инструменты с префиксом crm_workspace_. Для таблицы, записей и сводной аналитики по ней используй только их. Никогда не называй проект «рабочей областью» и наоборот.
- Чтобы перенести в рабочую область данные по рекламе/каналам из CRM (то, что в маркетинге и marketing_traffic), используй crm_workspace_import_marketing_channels — он создаёт таблицу с колонками и заполняет строки. Не создавай пустую таблицу только через crm_workspace_create_table без fields и без последующих crm_workspace_add_record.
- Если таблица уже создана без колонок — добавь поля через crm_workspace_add_field, затем crm_workspace_describe_table и crm_workspace_add_record с правильными key.
- Если в сообщении есть блок «Вложение: импорт продаж» с importId — для завершения импорта вызови crm_sales_import_apply (маппинг из suggestedMapping, если пользователь не указал иное).
- Если блок «CSV в рабочую область» — создай таблицу с полями text по fieldKeys и заполни через crm_workspace_bulk_add_records (при большом файле пользователь может отправить только фрагмент строк).
- Изображения: для новой картинки или правок к недавней вызывай crm_generate_image с полным промптом (лучше на английском). Ты не видишь пиксели прошлого изображения — опиши сцену целиком с учётом правок.
- Если есть блок «Недавнее изображение в этом чате» и пользователь просит изменить персонажа, одежду, стиль или детали — обязательно вызови crm_generate_image; не отвечай только общими рассуждениями и не предлагай «текст отзыва» вместо перегенерации.
- После успешного crm_generate_image в ответе пользователю укажи ссылку на картинку из результата инструмента (markdown ![img](url) или явный URL).

Расширенные действия CRM (используй по запросу):
- Лиды: crm_get_lead, crm_update_lead (поиск по имени — через crm_search_leads, не выдумывай UUID).
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
- Автоматизации: crm_list_automations, crm_create_automation, crm_update_automation, crm_delete_automation. Периодические сценарии: triggerEvent scheduled и meta.schedule с полями scheduleFrequency (weekly|daily|monthly|quarterly), scheduleTime (HH:mm), scheduleTimezone (IANA), scheduleDayOfWeek (1–7 пн=1 для weekly), scheduleDayOfMonth. В действии send_email для scheduled укажи accountId и to (массив email) и/или templateId.

Правила:
- Отвечай на языке пользователя (по умолчанию русский).
- Для фактов и изменений в CRM вызывай соответствующие инструменты; не выдумывай цифры и не утверждай, что что-то создано, если инструмент не вызывался или вернул ошибку.
- Перед удалением компании/контакта/проекта/заметки/строки workspace убедись, что пользователь явно это просит; destructive-инструменты необратимы или ведут в корзину (проект).
- Выбирай инструмент по смыслу запроса: «лид» → лиды, «проект» в смысле сделки → проекты, «рабочая область / таблица в workspace» → crm_workspace_*.
- Перед созданием сущностей кратко уточни намерение, если запрос двусмысленный; если пользователь явно попросил — создавай через нужный инструмент.
- После успешного вызова инструмента кратко резюмируй результат (id, имя); для рабочей области можно подсказать путь /workspace/{objectId}/table или /analytics.
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
}
