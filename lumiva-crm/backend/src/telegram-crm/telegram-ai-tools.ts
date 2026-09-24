// src/telegram-crm/telegram-ai-tools.ts
// Narrow, allowlisted tool set for the Telegram AI connector's external (anonymous) chat.
// Deliberately NOT the full staff AiToolsService.execute registry — that's built for
// authenticated staff members and would let any anonymous Telegram user read/write arbitrary
// tenant data. This file only exposes the handful of scoped, safe actions the design calls for.

import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ContactsService } from '../contacts/contacts.service';
import { BookingsAvailabilityService } from '../bookings/bookings-availability.service';
import { BookingsCatalogService } from '../bookings/bookings-catalog.service';
import { SalesService } from '../sales/sales.service';
import { TenantLogsService } from '../tenants/tenant-logs.service';
import { safeExcerpt } from '../common/ai-security-guard.util';
// Types only — no circular import at JS module load time, mirrors the lazy-accessor pattern
// already used in telegram-crm.service.ts for AiAssistantService/AiOpenAiService. HelpdeskService
// itself constructor-injects TelegramCrmService, so a plain constructor injection here would form
// a genuine circular *provider* graph (TelegramAiToolsService -> HelpdeskService ->
// TelegramCrmService -> TelegramAiToolsService) that forwardRef on module imports alone can't fix
// — only the ModuleRef lazy-lookup pattern breaks it.
type TelegramCrmService = import('./telegram-crm.service').TelegramCrmService;
type HelpdeskService = import('../helpdesk/helpdesk.service').HelpdeskService;

export const TELEGRAM_TOOL_DEFINITIONS: unknown[] = [
  {
    type: 'function',
    function: {
      name: 'booking_check_availability',
      description: 'Найти ближайшие свободные окна для записи на услугу. Возвращает до 6 вариантов на ближайшие 7 дней.',
      parameters: {
        type: 'object',
        properties: {
          serviceName: { type: 'string', description: 'Название услуги, как назвал клиент' },
          after: { type: 'string', description: 'Желаемое время начала поиска, напр. "19:00" или "завтра утром" (свободный текст)' },
        },
        required: ['serviceName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sale_read',
      description: 'Найти заказ/сделку ЭТОГО клиента по его собственному номеру телефона (для ответа на вопрос о статусе заказа). Всегда ищет по номеру телефона именно этого диалога — передай его, чтобы подтвердить, что это тот же клиент; чужой номер не примется.',
      parameters: {
        type: 'object',
        properties: { phone: { type: 'string', description: 'Номер телефона клиента этого диалога, как он его назвал' } },
        required: ['phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'helpdesk_ticket_read',
      description: 'Проверить статус последних обращений в поддержку ЭТОГО клиента по его собственному номеру телефона (чужой номер не примется).',
      parameters: {
        type: 'object',
        properties: { phone: { type: 'string' } },
        required: ['phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_send',
      description: 'Отправить клиенту документ из базы знаний бота (если он там загружен).',
      parameters: {
        type: 'object',
        properties: { fileName: { type: 'string', description: 'Название файла из базы знаний' } },
        required: ['fileName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalate_to_human',
      description: 'Передать диалог живому сотруднику: используй, когда не уверен в ответе, клиент недоволен, просит человека, или дважды переспрашивает одно и то же.',
      parameters: {
        type: 'object',
        properties: { reason: { type: 'string', description: 'Короткая причина передачи' } },
        required: ['reason'],
      },
    },
  },
];

/** Maps OpenAI-safe function names (underscored) to the `bot.meta.aiConnector.functions` keys shown/toggled in the Settings UI. */
const TOOL_NAME_TO_FUNCTION_KEY: Record<string, string> = {
  booking_check_availability: 'booking.availability',
  sale_read: 'sale.read',
  helpdesk_ticket_read: 'helpdesk.ticket.read',
  file_send: 'file.send',
};

export interface TelegramToolContext {
  tenantId: string;
  botId: string;
  chatId: string;
  telegramUserId: string;
  enabledFunctions: Set<string>;
  knowledgeFiles: Array<{ name: string; storagePath: string }>;
  contactPhone?: string | null;
  leadId?: string | null;
  dryRun?: boolean;
}

@Injectable()
export class TelegramAiToolsService {
  private readonly log = new Logger(TelegramAiToolsService.name);

  constructor(
    private readonly contactsService: ContactsService,
    private readonly bookingsAvailability: BookingsAvailabilityService,
    private readonly bookingsCatalog: BookingsCatalogService,
    private readonly salesService: SalesService,
    private readonly moduleRef: ModuleRef,
    private readonly tenantLogs: TenantLogsService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  private telegramCrm(): TelegramCrmService { return this.moduleRef.get(require('./telegram-crm.service').TelegramCrmService, { strict: false }); }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  private helpdesk(): HelpdeskService { return this.moduleRef.get(require('../helpdesk/helpdesk.service').HelpdeskService, { strict: false }); }

  /** escalate_to_human is always allowed regardless of the function toggle set — it's a safety valve, not a feature. */
  async execute(name: string, argsJson: string, ctx: TelegramToolContext): Promise<{ ok: boolean; result: string; escalate?: boolean; escalateReason?: string }> {
    let args: any = {};
    try { args = JSON.parse(argsJson || '{}'); } catch { /* keep {} */ }

    if (name === 'escalate_to_human') {
      return { ok: true, result: 'Диалог передан сотруднику.', escalate: true, escalateReason: String(args.reason || 'модель запросила передачу') };
    }

    const toolKey = TOOL_NAME_TO_FUNCTION_KEY[name] || name;
    if (!ctx.enabledFunctions.has(toolKey)) {
      return { ok: false, result: `Функция «${toolKey}» отключена в настройках этого бота.` };
    }

    // sale_read / helpdesk_ticket_read must only ever look up THIS conversation's own, already
    // verified phone (ctx.contactPhone — resolved server-side from Telegram's contact-share or a
    // linked CRM lead, see buildExternalAiContext). The model is never allowed to supply/override
    // the lookup phone itself: a malicious "client" could otherwise type something like "check the
    // order for phone +7..." with someone ELSE's number and read that other customer's order/ticket
    // history through the bot (a same-tenant IDOR via prompt injection). If the model still tries —
    // whether from a genuine jailbreak attempt or just guessing — we log it for pl1 instead of
    // silently ignoring it.
    this.flagPhoneOverrideAttempt(ctx, name, args?.phone);

    try {
      switch (name) {
        case 'booking_check_availability':
          return { ok: true, result: await this.checkAvailability(ctx.tenantId, String(args.serviceName || ''), String(args.after || '')) };
        case 'sale_read':
          return { ok: true, result: await this.readSale(ctx.tenantId, ctx.contactPhone || '') };
        case 'helpdesk_ticket_read':
          return { ok: true, result: await this.readTickets(ctx.tenantId, ctx.contactPhone || '') };
        case 'file_send':
          return { ok: true, result: await this.sendFile(ctx, String(args.fileName || '')) };
        default:
          return { ok: false, result: `Неизвестная функция: ${name}` };
      }
    } catch (err: any) {
      this.log.warn(`Telegram AI tool ${name} failed: ${err.message}`);
      return { ok: false, result: `Ошибка при вызове функции: ${err.message}` };
    }
  }

  private normPhone(v: unknown): string {
    return String(v || '').replace(/[^\d]/g, '');
  }

  /** Logs to pl1's global tenant log when the model tried to look up a phone other than this
   * conversation's own verified one. Never throws, never blocks the reply. */
  private flagPhoneOverrideAttempt(ctx: TelegramToolContext, toolName: string, requestedPhone: unknown): void {
    const requested = this.normPhone(requestedPhone);
    if (!requested) return;
    const own = this.normPhone(ctx.contactPhone);
    if (requested === own) return; // client confirming their own number back — fine
    this.tenantLogs
      .record({
        tenantId: ctx.tenantId,
        type: 'ai_security_denied',
        statusCode: 403,
        method: 'AI_TOOL',
        path: `telegram-ai-tools/${toolName}`,
        message: `Telegram AI chat tried to look up another phone number than the conversation's own via ${toolName}`,
        meta: {
          botId: ctx.botId,
          telegramUserId: ctx.telegramUserId,
          leadId: ctx.leadId || null,
          requestedPhoneMasked: requested.slice(0, 3) + '***' + requested.slice(-2),
          hadOwnPhone: Boolean(own),
        },
      })
      .catch(() => undefined);
  }

  private hasCalendarDate(value: string): boolean {
    return /(?:^|\D)\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?(?:\D|$)/.test(value || '');
  }

  private parseAvailabilityStart(after: string): Date {
    const now = new Date();
    const text = String(after || '').toLowerCase();
    const start = new Date(now);

    if (text.includes('послезавтра')) start.setDate(start.getDate() + 2);
    else if (text.includes('завтра')) start.setDate(start.getDate() + 1);

    const dateMatch = text.match(/(?:^|\D)(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?(?:\D|$)/);
    if (dateMatch) {
      const day = Number(dateMatch[1]);
      const month = Number(dateMatch[2]);
      const rawYear = dateMatch[3] ? Number(dateMatch[3]) : now.getFullYear();
      const year = rawYear < 100 ? 2000 + rawYear : rawYear;
      start.setFullYear(year, month - 1, day);
      start.setHours(0, 0, 0, 0);
      if (start.getTime() < now.getTime() - 24 * 60 * 60_000 && !dateMatch[3]) {
        start.setFullYear(start.getFullYear() + 1);
      }
    }

    const textForTime = dateMatch ? text.replace(dateMatch[0], ' ') : text;
    const timeMatch = textForTime.match(/(?:^|\D)(\d{1,2})(?::|ч\s*)(\d{2})?(?:\D|$)/);
    if (timeMatch && !dateMatch) {
      start.setHours(Number(timeMatch[1]), Number(timeMatch[2] || 0), 0, 0);
    } else if (timeMatch && dateMatch) {
      start.setHours(Number(timeMatch[1]), Number(timeMatch[2] || 0), 0, 0);
    }

    return start;
  }

  private async checkAvailability(tenantId: string, serviceName: string, after = ''): Promise<string> {
    const services = await this.bookingsCatalog.listServices(tenantId).catch(() => [] as any[]);
    const normalized = serviceName.toLowerCase().trim();
    const activeServices = services.filter((s: any) => s.active !== false);
    if (!normalized || ['все', 'all', 'any', 'любая', 'любой'].includes(normalized) || normalized.includes('все услуг')) {
      const names = activeServices.slice(0, 12).map((s: any) => s.name).filter(Boolean).join(', ');
      return names
        ? `Для проверки записи нужно выбрать конкретную услугу. Доступные услуги: ${names}.`
        : 'Каталог услуг пуст — передайте диалог сотруднику.';
    }

    const service = activeServices.find((s: any) => {
      const name = String(s.name || '').toLowerCase();
      return name === normalized || name.includes(normalized) || normalized.includes(name);
    });
    if (!service) {
      const names = activeServices.slice(0, 12).map((s: any) => s.name).filter(Boolean).join(', ');
      return `Услуга «${serviceName}» не найдена в каталоге.${names ? ` Доступные услуги: ${names}.` : ''}`;
    }

    const durationMin = Number(service.durationMinutes || 60);
    const found: string[] = [];
    const startFrom = this.parseAvailabilityStart(after);
    const searchDays = this.hasCalendarDate(after) ? 1 : 7;
    for (let day = 0; day < searchDays && found.length < 6; day++) {
      const base = new Date(startFrom);
      base.setDate(base.getDate() + day);
      for (let hour = 9; hour < 20 && found.length < 6; hour++) {
        for (const min of [0, 30]) {
          const startAt = new Date(base);
          startAt.setHours(hour, min, 0, 0);
          if (startAt < startFrom) continue;
          const endAt = new Date(startAt.getTime() + durationMin * 60_000);
          const check = await this.bookingsAvailability.inspectSlot(tenantId, { startAt, endAt }).catch(() => ({ ok: false }) as any);
          if (check.ok) {
            found.push(startAt.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit' }));
            if (found.length >= 6) break;
          }
        }
      }
    }
    if (!found.length) return `Свободных окон для «${service.name}»${after ? ` по запросу «${after}»` : ' на ближайшую неделю'} не нашлось.`;
    return `Свободно для «${service.name}» (${durationMin} мин): ${found.join(', ')}.`;
  }

  private async readSale(tenantId: string, phone: string): Promise<string> {
    if (!phone) return 'Не указан телефон клиента.';
    const res = await this.salesService.list(tenantId, { search: phone, page: 1, pageSize: 3 } as any).catch(() => null);
    const items: any[] = res?.items || [];
    if (!items.length) return `Заказы по номеру/имени «${phone}» не найдены (поиск по продажам не индексирован по телефону — лучше уточните номер заказа).`;
    return items.map((s: any) => `#${s.externalOrderNo || s.externalId || s.id.slice(0, 8)} — ${s.status || '?'}, ${s.amount ?? '?'} ${s.currency || ''}`).join('; ');
  }

  private async readTickets(tenantId: string, phone: string): Promise<string> {
    if (!phone) return 'Не указан телефон клиента.';
    const contact = await this.contactsService.findByEmailOrPhone(tenantId, undefined, phone).catch(() => null);
    if (!contact) return `Контакт с телефоном ${phone} не найден — обращений нет.`;
    const tickets = await this.helpdesk().listTicketsForContact(tenantId, contact.id).catch(() => [] as any[]);
    if (!tickets.length) return 'Обращений от этого клиента не найдено.';
    return tickets.slice(0, 3).map((t: any) => `#${String(t.id).slice(0, 8)} — ${t.status}: ${t.subject || ''}`).join('; ');
  }

  private async sendFile(ctx: TelegramToolContext, fileName: string): Promise<string> {
    const file = ctx.knowledgeFiles.find((f) => f.name.toLowerCase() === fileName.toLowerCase());
    if (!file) return `Файл «${fileName}» не настроен в базе знаний этого бота.`;
    if (ctx.dryRun) return `Файл «${file.name}» был бы отправлен клиенту.`;
    try {
      const fs = await import('fs/promises');
      const buf = await fs.readFile(file.storagePath);
      await this.telegramCrm().sendDocumentFromBuffer(ctx.tenantId, ctx.botId, ctx.telegramUserId, file.name, buf, undefined, { source: 'ai', meta: { tool: 'file_send' } });
      return `Файл «${file.name}» отправлен клиенту.`;
    } catch (err: any) {
      return `Не удалось отправить файл «${fileName}»: ${err.message}`;
    }
  }
}
