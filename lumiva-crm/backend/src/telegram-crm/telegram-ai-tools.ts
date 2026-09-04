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
      description: 'Найти заказ/сделку клиента по номеру телефона (для ответа на вопрос о статусе заказа).',
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
      name: 'helpdesk_ticket_read',
      description: 'Проверить статус последних обращений в поддержку по номеру телефона клиента.',
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

    try {
      switch (name) {
        case 'booking_check_availability':
          return { ok: true, result: await this.checkAvailability(ctx.tenantId, String(args.serviceName || '')) };
        case 'sale_read':
          return { ok: true, result: await this.readSale(ctx.tenantId, String(args.phone || '')) };
        case 'helpdesk_ticket_read':
          return { ok: true, result: await this.readTickets(ctx.tenantId, String(args.phone || '')) };
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

  private async checkAvailability(tenantId: string, serviceName: string): Promise<string> {
    const services = await this.bookingsCatalog.listServices(tenantId).catch(() => [] as any[]);
    const service = services.find((s: any) => String(s.name || '').toLowerCase().includes(serviceName.toLowerCase()));
    if (!service) return `Услуга «${serviceName}» не найдена в каталоге. Уточните название у клиента.`;

    const durationMin = Number(service.durationMinutes || 60);
    const found: string[] = [];
    const now = new Date();
    for (let day = 0; day < 7 && found.length < 6; day++) {
      const base = new Date(now);
      base.setDate(base.getDate() + day);
      for (let hour = 9; hour < 20 && found.length < 6; hour++) {
        for (const min of [0, 30]) {
          const startAt = new Date(base);
          startAt.setHours(hour, min, 0, 0);
          if (startAt <= now) continue;
          const endAt = new Date(startAt.getTime() + durationMin * 60_000);
          const check = await this.bookingsAvailability.inspectSlot(tenantId, { startAt, endAt }).catch(() => ({ ok: false }) as any);
          if (check.ok) {
            found.push(startAt.toLocaleString('ru-RU', { weekday: 'short', hour: '2-digit', minute: '2-digit' }));
            if (found.length >= 6) break;
          }
        }
      }
    }
    if (!found.length) return `Свободных окон на ближайшую неделю для «${service.name}» не нашлось.`;
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
    try {
      const fs = await import('fs/promises');
      const buf = await fs.readFile(file.storagePath);
      await this.telegramCrm().sendDocumentFromBuffer(ctx.tenantId, ctx.botId, ctx.telegramUserId, file.name, buf);
      return `Файл «${file.name}» отправлен клиенту.`;
    } catch (err: any) {
      return `Не удалось отправить файл «${fileName}»: ${err.message}`;
    }
  }
}
