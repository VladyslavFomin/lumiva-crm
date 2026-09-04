// src/telegram-crm/telegram-crm.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import axios from 'axios';
import { TelegramBot } from './telegram-bot.entity';
import { TelegramContact } from './telegram-contact.entity';
import { TelegramMessage } from './telegram-message.entity';
import { Lead } from '../leads/lead.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { LeadsService } from '../leads/leads.service';
import { NotesService } from '../notes/notes.service';
import { EntityType, NoteType } from '../notes/dto/create-note.dto';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';
import { BookingsAvailabilityService } from '../bookings/bookings-availability.service';
import { BookingsCatalogService } from '../bookings/bookings-catalog.service';
import { BookingsStaffService } from '../bookings/bookings-staff.service';
import { ReservationsService } from '../bookings/reservations.service';
import {
  TelegramAiToolsService,
  TELEGRAM_TOOL_DEFINITIONS,
  type TelegramToolContext,
} from './telegram-ai-tools';
import {
  buildDefaultFlows,
  type Flow,
  type FlowNode,
  type FlowsMap,
} from './telegram-flow.types';
// Types only — no circular import at JS module load time
type AiAssistantService = import('../ai/ai-assistant.service').AiAssistantService;
type AiOpenAiService = import('../ai/ai-openai.service').AiOpenAiService;
type ChatMessage = import('../ai/ai-openai.service').ChatMessage;

interface FlowState {
  flowId: string;
  nodeId: string;
  collected: Record<string, any>;
  visited: string[];
  recentMessages: string[];
  pausedUntil?: string | null;
}

export interface TraceStep { step: string; detail: string; ms: number }

const DEFAULT_STOP_WORDS = ['жалоба', 'суд', 'верните деньги', 'обман', 'разводилово'];

const TG_MSG_LIMIT = 4000;
const EXTERNAL_HISTORY_MAX = 16;

// ── Markdown → Telegram HTML ─────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function mdToHtml(md: string): string {
  let s = md;

  // Preserve code blocks before escaping
  const codeBlocks: string[] = [];
  s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre>${escHtml(code.trim())}</pre>`);
    return `\x00CB${idx}\x00`;
  });
  const inlineCodes: string[] = [];
  s = s.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code>${escHtml(code)}</code>`);
    return `\x00IC${idx}\x00`;
  });

  s = escHtml(s);
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  s = s.replace(/__(.+?)__/g, '<b>$1</b>');
  s = s.replace(/\*([^*\n]+?)\*/g, '<i>$1</i>');
  s = s.replace(/_([^_\n]+?)_/g, '<i>$1</i>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');
  s = s.replace(/^---+$/gm, '──────────');
  s = s.replace(/^[\-\*]\s+/gm, '• ');
  s = s.replace(/^(\d+)\.\s+/gm, '$1. ');

  codeBlocks.forEach((b, i) => { s = s.replace(`\x00CB${i}\x00`, b); });
  inlineCodes.forEach((b, i) => { s = s.replace(`\x00IC${i}\x00`, b); });

  return s.trim();
}

function splitMessage(text: string, maxLen = TG_MSG_LIMIT): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maxLen) {
    const slice = rest.slice(0, maxLen);
    const nl = slice.lastIndexOf('\n');
    const cut = nl > maxLen * 0.5 ? nl + 1 : maxLen;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/** Whether the AI reply appears to be asking a yes/no question */
function isQuestion(text: string): boolean {
  const t = text.trimEnd();
  return t.endsWith('?') || /[?？]\s*$/.test(t);
}

// ── Inline keyboard helpers ──────────────────────────────────────────────────

type InlineButton = { text: string; callback_data: string };
type InlineKeyboard = InlineButton[][];

function confirmKeyboard(): InlineKeyboard {
  return [
    [
      { text: '✅ Да, подтвердить', callback_data: 'MSG:Да' },
      { text: '❌ Отмена', callback_data: 'MSG:Нет, отмена' },
    ],
    [{ text: '🔄 Сбросить сессию', callback_data: 'RESET' }],
  ];
}

function defaultKeyboard(): InlineKeyboard {
  return [
    [
      { text: '📋 Меню', callback_data: 'MENU' },
      { text: '💬 Ещё', callback_data: 'MSG:Продолжи' },
    ],
    [{ text: '🔄 Новый разговор', callback_data: 'RESET' }],
  ];
}

function menuText(): string {
  return (
    '<b>Быстрые команды:</b>\n\n' +
    '📊 <b>Лиды</b> — <i>«покажи лидов»</i>\n' +
    '💼 <b>Сделки</b> — <i>«покажи проекты»</i>\n' +
    '📅 <b>Встречи</b> — <i>«мои встречи»</i>\n' +
    '📧 <b>Письмо</b> — <i>«напиши письмо клиенту»</i>\n' +
    '🆕 <b>Новый лид</b> — <i>«создай лида Иван Иванов»</i>\n' +
    '🔍 <b>Найти</b> — <i>«найди лида Александр»</i>\n\n' +
    '/reset — начать новый разговор'
  );
}

@Injectable()
export class TelegramCrmService {
  private readonly log = new Logger(TelegramCrmService.name);

  constructor(
    @InjectRepository(TelegramBot)
    private readonly botRepo: Repository<TelegramBot>,
    @InjectRepository(TelegramContact)
    private readonly contactRepo: Repository<TelegramContact>,
    @InjectRepository(TelegramMessage)
    private readonly messageRepo: Repository<TelegramMessage>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
    @Inject(forwardRef(() => LeadsService))
    private readonly leadsService: LeadsService,
    @Inject(forwardRef(() => NotesService))
    private readonly notesService: NotesService,
    private readonly bookingsAvailability: BookingsAvailabilityService,
    private readonly bookingsCatalog: BookingsCatalogService,
    private readonly bookingsStaff: BookingsStaffService,
    private readonly reservationsService: ReservationsService,
    private readonly telegramTools: TelegramAiToolsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  // Lazy accessors — avoids circular JS module import at load time
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  private ai(): AiAssistantService { return this.moduleRef.get(require('../ai/ai-assistant.service').AiAssistantService, { strict: false }); }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  private oai(): AiOpenAiService { return this.moduleRef.get(require('../ai/ai-openai.service').AiOpenAiService, { strict: false }); }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  private polling() { return this.moduleRef.get(require('./telegram-polling.service').TelegramPollingService, { strict: false }); }

  // ── Bot CRUD ─────────────────────────────────────────────────────────────
  // findAllBots/findBot return the raw entity (real botToken) — used internally throughout this
  // service for Telegram API calls. The *Public variants below mask the token and are what the
  // controller returns to the frontend.

  async findAllBots(tenantId?: string): Promise<TelegramBot[]> {
    if (tenantId) return this.botRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
    return this.botRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findAllBotsPublic(tenantId: string): Promise<TelegramBot[]> {
    return (await this.findAllBots(tenantId)).map((b) => this.toPublicBot(b));
  }

  async findBotByToken(botToken: string): Promise<TelegramBot | null> {
    return this.botRepo.findOne({ where: { botToken } });
  }

  async findBot(tenantId: string, id: string): Promise<TelegramBot> {
    const bot = await this.botRepo.findOne({ where: { id, tenantId } });
    if (!bot) throw new NotFoundException('Telegram bot not found');
    return bot;
  }

  async findBotPublic(tenantId: string, id: string): Promise<TelegramBot> {
    return this.toPublicBot(await this.findBot(tenantId, id));
  }

  async createBot(tenantId: string, botToken: string, webhookUrl?: string): Promise<TelegramBot> {
    try {
      const { data: { result: botInfo } } = await axios.get(
        `https://api.telegram.org/bot${botToken}/getMe`,
      );
      const bot = this.botRepo.create({
        tenantId, botToken,
        botUsername: botInfo.username || null,
        botName: botInfo.first_name || null,
        webhookUrl: webhookUrl || null,
        status: 'active',
        meta: { flows: buildDefaultFlows() },
      });
      const saved = await this.botRepo.save(bot);
      if (webhookUrl) {
        await this.setWebhook(tenantId, saved.id, webhookUrl);
      } else {
        this.polling().startPollingBot(saved.id, saved.botToken);
      }
      return this.toPublicBot(saved);
    } catch (error: any) {
      throw new BadRequestException(`Invalid bot token: ${error.message}`);
    }
  }

  async updateBot(tenantId: string, id: string, data: {
    botToken?: string; botName?: string; botUsername?: string;
    webhookUrl?: string; welcomeMessage?: string; isActive?: boolean; autoReply?: boolean;
    meta?: {
      aiConnector?: Record<string, any>;
      capabilities?: Record<string, boolean>;
      crmLink?: Record<string, any>;
    };
  }): Promise<TelegramBot> {
    const bot = await this.findBot(tenantId, id);
    if (data.botToken && data.botToken !== bot.botToken) {
      try {
        const { data: { result: botInfo } } = await axios.get(
          `https://api.telegram.org/bot${data.botToken}/getMe`,
        );
        bot.botToken = data.botToken;
        bot.botUsername = botInfo.username || bot.botUsername;
        bot.botName = botInfo.first_name || bot.botName;
      } catch (error: any) {
        throw new BadRequestException(`Invalid bot token: ${error.message}`);
      }
    }
    if (data.botName !== undefined) bot.botName = data.botName;
    if (data.botUsername !== undefined) bot.botUsername = data.botUsername;
    if (data.webhookUrl !== undefined) {
      bot.webhookUrl = data.webhookUrl;
      if (data.webhookUrl) {
        await this.setWebhook(tenantId, id, data.webhookUrl);
      } else {
        // Webhook cleared — switch to polling
        this.polling().startPollingBot(bot.id, bot.botToken);
      }
    }
    if (data.welcomeMessage !== undefined) bot.welcomeMessage = data.welcomeMessage;
    if (data.isActive !== undefined) bot.status = data.isActive ? 'active' : 'inactive';
    if (data.autoReply !== undefined) bot.autoReply = data.autoReply;
    if (data.meta) {
      bot.meta = {
        ...(bot.meta || {}),
        ...(data.meta.aiConnector ? { aiConnector: { ...(bot.meta?.aiConnector || {}), ...data.meta.aiConnector } } : {}),
        ...(data.meta.capabilities ? { capabilities: { ...(bot.meta?.capabilities || {}), ...data.meta.capabilities } } : {}),
        ...(data.meta.crmLink ? { crmLink: { ...(bot.meta?.crmLink || {}), ...data.meta.crmLink } } : {}),
      };
    }
    const saved = await this.botRepo.save(bot);
    return this.toPublicBot(saved);
  }

  async setWebhook(tenantId: string, botId: string, webhookUrl: string): Promise<void> {
    const bot = await this.findBot(tenantId, botId);
    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${bot.botToken}/setWebhook`,
        { url: webhookUrl },
      );
      if (!response.data.ok) throw new Error(response.data.description || 'Failed');
      bot.webhookUrl = webhookUrl;
      bot.webhookSetAt = new Date();
      bot.status = 'active';
      bot.lastError = null;
      // Stop polling — webhook will handle delivery now
      this.polling().stopPollingBot(bot.id);
    } catch (error: any) {
      bot.status = 'error';
      bot.lastError = error.message;
      await this.botRepo.save(bot);
      throw new BadRequestException(`Failed to set webhook: ${error.message}`);
    }
    await this.botRepo.save(bot);
  }

  // ── Incoming message entry point ─────────────────────────────────────────

  async handleIncomingMessage(tenantId: string, botToken: string, update: any): Promise<void> {
    const bot = await this.botRepo.findOne({ where: { tenantId, botToken } });
    if (!bot || bot.status !== 'active') return;

    // ── Callback query (button press) ──────────────────────────────────────
    if (update.callback_query) {
      await this.handleCallbackQuery(bot, update.callback_query);
      return;
    }

    const message = update.message;
    if (!message) return;

    const telegramUserId = String(message.from.id);
    const chatId = String(message.chat.id);
    const isVoice = !!(message.voice || message.audio);

    // Idempotency: skip already-processed messages
    const msgId = String(message.message_id);
    const existing = await this.messageRepo.findOne({ where: { tenantId, chatId, messageId: msgId } });
    if (existing) return;

    // ── Staff recipient check ──────────────────────────────────────────────
    const recipient = this.findRecipientByChatId(bot, chatId);
    if (recipient) {
      let text = message.text || '';
      if (isVoice) {
        const fileId = (message.voice || message.audio)?.file_id;
        if (fileId) {
          await this.sendTyping(bot.botToken, chatId);
          text = await this.transcribeVoice(bot.botToken, fileId).catch(() => '');
          if (text) {
            // Show the transcription as a quote
            await this.sendTgHtml(bot.botToken, chatId, `🎤 <i>${escHtml(text)}</i>`);
          } else {
            await this.sendTgHtml(bot.botToken, chatId, '⚠️ Не удалось распознать голосовое сообщение.');
            return;
          }
        }
      }
      await this.handleStaffAiMessage(bot, recipient, chatId, text);
      bot.lastSyncAt = new Date();
      await this.botRepo.save(bot);
      return;
    }

    // ── External contact ─────────────────────────────────────────────────
    let contact = await this.contactRepo.findOne({ where: { tenantId, telegramUserId } });
    if (!contact) {
      contact = this.contactRepo.create({
        tenantId, telegramUserId,
        botId: bot.id,
        telegramUsername: message.from.username || null,
        telegramFirstName: message.from.first_name || null,
        telegramLastName: message.from.last_name || null,
        telegramPhone: message.from.phone_number || null,
        status: 'active',
      });
    } else {
      contact.botId = bot.id;
      contact.telegramUsername = message.from.username || null;
      contact.telegramFirstName = message.from.first_name || null;
      contact.telegramLastName = message.from.last_name || null;
      if (message.from.phone_number) contact.telegramPhone = message.from.phone_number;
    }
    contact = await this.contactRepo.save(contact);

    const telegramMessage = this.messageRepo.create({
      tenantId,
      contactId: contact.id,
      botId: bot.id,
      messageId: String(message.message_id),
      chatId,
      direction: 'incoming',
      text: message.text || null,
      messageType: this.getMessageType(message),
      attachments: this.extractAttachments(message),
      date: new Date(message.date * 1000),
      isRead: false,
      rawData: message,
    });
    await this.messageRepo.save(telegramMessage);

    const capabilities = this.getCapabilities(bot);
    if (capabilities.leadCreation !== false) {
      await this.syncInboundToLeadNote(tenantId, bot, contact, telegramUserId, message, telegramMessage.id);
    }

    try {
      await this.automationsService.triggerAutomation(
        tenantId,
        TriggerEvent.TELEGRAM_MESSAGE_RECEIVED,
        { entityType: 'telegram_message', entityId: telegramMessage.id, message: telegramMessage, contact, botId: bot.id },
      );
    } catch { /* non-critical */ }

    // AI/flow response for external users
    let text = message.text || '';
    if (isVoice) {
      const fileId = (message.voice || message.audio)?.file_id;
      if (fileId) {
        await this.sendTyping(bot.botToken, chatId);
        text = await this.transcribeVoice(bot.botToken, fileId).catch(() => '');
        if (text) {
          await this.sendTgHtml(bot.botToken, chatId, `🎤 <i>${escHtml(text)}</i>`);
        }
      }
    }
    if (text) {
      await this.routeExternalMessage(bot, contact, chatId, text);
    }

    bot.lastSyncAt = new Date();
    await this.botRepo.save(bot);
  }

  // ── Voice transcription ──────────────────────────────────────────────────

  private async transcribeVoice(botToken: string, fileId: string): Promise<string> {
    // Step 1: get file path from Telegram
    const fileRes = await axios.get(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
    );
    const filePath: string = fileRes.data?.result?.file_path;
    if (!filePath) throw new Error('No file path from Telegram');

    // Step 2: download the file
    const fileRes2 = await axios.get(
      `https://api.telegram.org/file/bot${botToken}/${filePath}`,
      { responseType: 'arraybuffer' },
    );
    const buffer = Buffer.from(fileRes2.data);
    const filename = filePath.split('/').pop() || 'voice.ogg';

    // Step 3: transcribe with Whisper
    return this.oai().transcribeAudio(buffer, filename);
  }

  // ── Staff AI conversation ────────────────────────────────────────────────

  private findRecipientByChatId(bot: TelegramBot, chatId: string): any | null {
    const recipients: any[] = (bot.meta?.recipients as any[]) || [];
    return recipients.find((r) => String(r.telegramChatId) === String(chatId)) || null;
  }

  private async updateRecipientSession(bot: TelegramBot, recipientId: string, sessionId: string): Promise<void> {
    const recipients: any[] = (bot.meta?.recipients as any[]) || [];
    bot.meta = { ...(bot.meta || {}), recipients: recipients.map((r) => r.id === recipientId ? { ...r, aiSessionId: sessionId } : r) };
    await this.botRepo.save(bot);
  }

  private async clearRecipientSession(bot: TelegramBot, recipientId: string): Promise<void> {
    const recipients: any[] = (bot.meta?.recipients as any[]) || [];
    bot.meta = { ...(bot.meta || {}), recipients: recipients.map((r) => r.id === recipientId ? { ...r, aiSessionId: null } : r) };
    await this.botRepo.save(bot);
  }

  private async handleCallbackQuery(bot: TelegramBot, cbq: any): Promise<void> {
    const chatId = String(cbq.message?.chat?.id || cbq.from?.id);
    const data: string = cbq.data || '';

    // Answer callback to stop the spinner
    try {
      await axios.post(`https://api.telegram.org/bot${bot.botToken}/answerCallbackQuery`, {
        callback_query_id: cbq.id,
      });
    } catch { /* non-critical */ }

    const recipient = this.findRecipientByChatId(bot, chatId);
    if (!recipient) return;

    if (data === 'RESET') {
      await this.clearRecipientSession(bot, recipient.id);
      await this.sendTgHtml(bot.botToken, chatId, '✅ Сессия сброшена. Начинаем заново.');
      return;
    }

    if (data === 'MENU') {
      await this.sendTgHtml(bot.botToken, chatId, menuText());
      return;
    }

    if (data.startsWith('MSG:')) {
      const msg = data.slice(4);
      if (msg) await this.handleStaffAiMessage(bot, recipient, chatId, msg);
      return;
    }
  }

  private async handleStaffAiMessage(
    bot: TelegramBot,
    recipient: any,
    chatId: string,
    text: string,
  ): Promise<void> {
    const cmd = text.trim().toLowerCase();

    if (cmd === '/start' || cmd.startsWith('/start ')) {
      const firstName = (recipient.staffUserName || '').split(' ')[0];
      await this.sendTgHtmlWithKeyboard(
        bot.botToken, chatId,
        `Привет${firstName ? `, ${firstName}` : ''}! 👋 Я <b>AI-ассистент Lumiva CRM</b>.\n\n` +
        `<b>Что умею:</b>\n` +
        `• Создавать/искать лидов, сделки, задачи\n` +
        `• Планировать встречи в CRM\n` +
        `• Отправлять письма клиентам\n` +
        `• Анализировать данные CRM\n` +
        `• Запускать автоматизации\n\n` +
        `Просто пишите — я сразу выполню.\n<i>/reset — начать новый разговор</i>`,
        [[
          { text: '📋 Меню команд', callback_data: 'MENU' },
          { text: '🔄 Сброс сессии', callback_data: 'RESET' },
        ]],
      );
      return;
    }

    if (cmd === '/reset' || cmd === '/new' || cmd.startsWith('/reset ') || cmd.startsWith('/new ')) {
      await this.clearRecipientSession(bot, recipient.id);
      await this.sendTgHtml(bot.botToken, chatId, '✅ Сессия сброшена. Начинаем новый разговор.');
      return;
    }

    if (cmd === '/menu' || cmd === '/help') {
      await this.sendTgHtml(bot.botToken, chatId, menuText());
      return;
    }

    if (!text.trim()) return;

    await this.sendTyping(bot.botToken, chatId);

    try {
      const staffUser = await this.staffRepo.findOne({ where: { id: recipient.staffUserId } });
      const result = await this.ai().runChat({
        tenantId: bot.tenantId,
        userId: recipient.staffUserId,
        userRole: staffUser?.role ?? undefined,
        staffUserId: recipient.staffUserId,
        telegramUsername: recipient.telegramUsername ?? undefined,
        telegramChatId: String(chatId),
        sessionId: recipient.aiSessionId || null,
        message: text,
      });

      await this.updateRecipientSession(bot, recipient.id, result.sessionId);

      const reply = (result.reply || '(нет ответа)').trim();
      const keyboard = isQuestion(reply) ? confirmKeyboard() : defaultKeyboard();
      await this.sendTgHtmlWithKeyboard(bot.botToken, chatId, mdToHtml(reply), keyboard);
    } catch (err: any) {
      this.log.error(`Staff AI TG error: ${err.message}`);
      await this.sendTgHtml(bot.botToken, chatId, '⚠️ Ошибка при обращении к AI. Попробуйте ещё раз.');
    }
  }

  // ── External user AI conversation ────────────────────────────────────────

  private async handleExternalUserMessage(
    bot: TelegramBot,
    contact: TelegramContact,
    chatId: string,
    text: string,
  ): Promise<void> {
    if (!text.trim()) return;

    await this.sendTyping(bot.botToken, chatId);

    try {
      const persona = bot.welcomeMessage?.trim() || 'Помогай клиентам с вопросами, будь дружелюбным и краткими.';
      const now = new Date().toISOString().slice(0, 10);
      const systemPrompt = `${persona}\n\nТекущая дата: ${now}. Отвечай на языке пользователя.`;

      // Restore conversation history from contact meta
      const meta = (contact.meta || {}) as any;
      const history: { role: string; content: string }[] = Array.isArray(meta.aiChat)
        ? meta.aiChat.slice(-EXTERNAL_HISTORY_MAX)
        : [];

      const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: text },
      ] as any[];

      const result = await this.oai().chatCompletion({ messages });
      const reply = (result.message.content || '').trim();

      // Save updated history
      const newHistory = [...history, { role: 'user', content: text }, { role: 'assistant', content: reply }];
      contact.meta = { ...(contact.meta || {}), aiChat: newHistory.slice(-EXTERNAL_HISTORY_MAX) };
      await this.contactRepo.save(contact);

      await this.sendTgHtml(bot.botToken, chatId, mdToHtml(reply));
    } catch (err: any) {
      this.log.error(`External AI TG error: ${err.message}`);
      // Silently fail for external users to avoid confusing messages
    }
  }

  // ── CRM event notifications ──────────────────────────────────────────────

  /** Send a text notification to all staff recipients across all bots of a tenant */
  async notifyTenantRecipients(tenantId: string, text: string): Promise<void> {
    try {
      const bots = await this.botRepo.find({ where: { tenantId, status: 'active' } });
      for (const bot of bots) {
        const recipients: any[] = (bot.meta?.recipients as any[]) || [];
        for (const r of recipients) {
          if (r.telegramChatId) {
            await this.sendTgHtml(bot.botToken, String(r.telegramChatId), text).catch(() => undefined);
          }
        }
      }
    } catch (err: any) {
      this.log.warn(`notifyTenantRecipients failed: ${err.message}`);
    }
  }

  /** Send to a specific staff user by their staffUserId */
  async notifyStaffUser(tenantId: string, staffUserId: string, text: string): Promise<void> {
    try {
      const bots = await this.botRepo.find({ where: { tenantId, status: 'active' } });
      for (const bot of bots) {
        const recipients: any[] = (bot.meta?.recipients as any[]) || [];
        const r = recipients.find((rec) => rec.staffUserId === staffUserId);
        if (r?.telegramChatId) {
          await this.sendTgHtml(bot.botToken, String(r.telegramChatId), text).catch(() => undefined);
        }
      }
    } catch (err: any) {
      this.log.warn(`notifyStaffUser failed: ${err.message}`);
    }
  }

  // ── TG send helpers ──────────────────────────────────────────────────────

  private async sendTyping(botToken: string, chatId: string): Promise<void> {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      chat_id: chatId, action: 'typing',
    }).catch(() => undefined);
  }

  private async sendTgHtml(botToken: string, chatId: string, html: string): Promise<void> {
    for (const chunk of splitMessage(html)) {
      try {
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          chat_id: chatId, text: chunk, parse_mode: 'HTML', disable_web_page_preview: true,
        });
      } catch {
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          chat_id: chatId, text: chunk.replace(/<[^>]+>/g, ''),
        }).catch(() => undefined);
      }
    }
  }

  private async sendTgHtmlWithKeyboard(
    botToken: string, chatId: string, html: string, keyboard: InlineKeyboard,
  ): Promise<void> {
    const chunks = splitMessage(html);
    // Send all but last without keyboard
    for (let i = 0; i < chunks.length - 1; i++) {
      await this.sendTgHtml(botToken, chatId, chunks[i]);
    }
    const last = chunks[chunks.length - 1];
    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text: last,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch {
      await this.sendTgHtml(botToken, chatId, last);
    }
  }

  // ── Public API: send message ─────────────────────────────────────────────

  async sendMessage(
    tenantId: string,
    botId: string,
    telegramUserId: string,
    text: string,
    options?: { contactId?: string; companyId?: string; leadId?: string; saleId?: string },
  ): Promise<TelegramMessage> {
    const bot = await this.findBot(tenantId, botId);
    const contact = await this.contactRepo.findOne({ where: { tenantId, telegramUserId } });
    if (!contact) throw new NotFoundException('Telegram contact not found');
    if (contact.botId !== bot.id) {
      contact.botId = bot.id;
      await this.contactRepo.save(contact);
    }

    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${bot.botToken}/sendMessage`,
        { chat_id: telegramUserId, text },
      );
      const sent = response.data.result;
      return this.messageRepo.save(this.messageRepo.create({
        tenantId,
        contactId: contact.id,
        botId: bot.id,
        messageId: String(sent.message_id),
        chatId: String(sent.chat.id),
        direction: 'outgoing',
        text,
        messageType: 'text',
        linkedContactId: options?.contactId || null,
        linkedCompanyId: options?.companyId || null,
        linkedLeadId: options?.leadId || null,
        linkedSaleId: options?.saleId || null,
        date: new Date(sent.date * 1000),
        isRead: true,
        rawData: sent,
      }));
    } catch (error: any) {
      bot.status = 'error';
      bot.lastError = error.message;
      await this.botRepo.save(bot);
      throw new BadRequestException(`Failed to send message: ${error.message}`);
    }
  }

  async sendDocumentFromBuffer(
    tenantId: string,
    botId: string,
    telegramUserId: string,
    filename: string,
    file: Buffer,
    caption?: string,
    options?: { contactId?: string; companyId?: string; leadId?: string; saleId?: string },
  ): Promise<TelegramMessage> {
    const bot = await this.findBot(tenantId, botId);
    const contact = await this.contactRepo.findOne({ where: { tenantId, telegramUserId } });
    if (!contact) throw new NotFoundException('Telegram contact not found');
    if (contact.botId !== bot.id) {
      contact.botId = bot.id;
      await this.contactRepo.save(contact);
    }

    const safeName = String(filename || 'file.dat').replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const boundary = `----lumiva${Date.now()}`;
    const crlf = '\r\n';
    const parts: Buffer[] = [];
    const pushField = (name: string, value: string) => {
      parts.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="${name}"${crlf}${crlf}${value}${crlf}`, 'utf8'));
    };
    pushField('chat_id', telegramUserId);
    if (caption) pushField('caption', String(caption).slice(0, 1024));
    parts.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="document"; filename="${safeName}"${crlf}Content-Type: application/octet-stream${crlf}${crlf}`, 'utf8'));
    parts.push(file);
    parts.push(Buffer.from(`${crlf}--${boundary}--${crlf}`, 'utf8'));
    const body = Buffer.concat(parts);

    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${bot.botToken}/sendDocument`,
        body,
        { headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }, maxBodyLength: Infinity, maxContentLength: Infinity },
      );
      const sent = response.data?.result;
      if (!sent) throw new Error(response.data?.description || 'No result');
      return this.messageRepo.save(this.messageRepo.create({
        tenantId,
        contactId: contact.id,
        botId: bot.id,
        messageId: String(sent.message_id),
        chatId: String(sent.chat?.id ?? telegramUserId),
        direction: 'outgoing',
        text: caption || `[document ${safeName}]`,
        messageType: 'document',
        linkedContactId: options?.contactId || null,
        linkedCompanyId: options?.companyId || null,
        linkedLeadId: options?.leadId || null,
        linkedSaleId: options?.saleId || null,
        date: new Date((sent.date || Date.now() / 1000) * 1000),
        isRead: true,
        rawData: sent,
      }));
    } catch (error: any) {
      bot.status = 'error';
      bot.lastError = error.message;
      await this.botRepo.save(bot);
      throw new BadRequestException(`Failed to send document: ${error.message}`);
    }
  }

  async findMessages(
    tenantId: string,
    options?: { contactId?: string; telegramUserId?: string; direction?: 'incoming' | 'outgoing'; limit?: number; offset?: number },
  ): Promise<{ items: TelegramMessage[]; total: number }> {
    const qb = this.messageRepo.createQueryBuilder('message').where('message.tenantId = :tenantId', { tenantId });
    if (options?.contactId) qb.andWhere('message.contactId = :contactId', { contactId: options.contactId });
    if (options?.telegramUserId) {
      qb.leftJoin('message.contact', 'contact').andWhere('contact.telegramUserId = :telegramUserId', { telegramUserId: options.telegramUserId });
    }
    if (options?.direction) qb.andWhere('message.direction = :direction', { direction: options.direction });
    const total = await qb.getCount();
    if (options?.limit) qb.limit(options.limit);
    if (options?.offset) qb.offset(options.offset);
    qb.orderBy('message.date', 'DESC');
    return { items: await qb.getMany(), total };
  }

  /** Conversation list for the inbox UI: one row per contact with a last-message preview and
   * unread count, newest activity first. */
  async findContacts(
    tenantId: string,
    options?: { search?: string; botId?: string },
  ): Promise<Array<TelegramContact & { lastMessage: TelegramMessage | null; unreadCount: number }>> {
    const qb = this.contactRepo.createQueryBuilder('contact')
      .where('contact.tenantId = :tenantId', { tenantId });
    if (options?.botId) qb.andWhere('contact.botId = :botId', { botId: options.botId });
    if (options?.search) {
      qb.andWhere(
        '(contact.telegramUsername ILIKE :s OR contact.telegramFirstName ILIKE :s OR contact.telegramLastName ILIKE :s OR contact.telegramPhone ILIKE :s)',
        { s: `%${options.search}%` },
      );
    }
    const contacts = await qb.getMany();
    if (!contacts.length) return [];
    const contactIds = contacts.map((c) => c.id);

    const lastMessages = await this.messageRepo.createQueryBuilder('m')
      .distinctOn(['m.contactId'])
      .where('m.tenantId = :tenantId', { tenantId })
      .andWhere('m.contactId IN (:...contactIds)', { contactIds })
      .orderBy('m.contactId')
      .addOrderBy('m.date', 'DESC')
      .getMany();
    const lastByContact = new Map(lastMessages.map((m) => [m.contactId, m]));

    const unreadRows = await this.messageRepo.createQueryBuilder('m')
      .select('m.contactId', 'contactId')
      .addSelect('COUNT(*)', 'count')
      .where('m.tenantId = :tenantId', { tenantId })
      .andWhere('m.contactId IN (:...contactIds)', { contactIds })
      .andWhere('m.direction = :dir', { dir: 'incoming' })
      .andWhere('m.isRead = false')
      .groupBy('m.contactId')
      .getRawMany<{ contactId: string; count: string }>();
    const unreadByContact = new Map(unreadRows.map((r) => [r.contactId, parseInt(r.count, 10)]));

    return contacts
      .map((c) => ({
        ...c,
        lastMessage: lastByContact.get(c.id) ?? null,
        unreadCount: unreadByContact.get(c.id) ?? 0,
      }))
      .sort((a, b) => {
        const ad = a.lastMessage ? new Date(a.lastMessage.date).getTime() : new Date(a.createdAt).getTime();
        const bd = b.lastMessage ? new Date(b.lastMessage.date).getTime() : new Date(b.createdAt).getTime();
        return bd - ad;
      });
  }

  async markContactMessagesRead(tenantId: string, contactId: string): Promise<void> {
    await this.messageRepo.createQueryBuilder()
      .update(TelegramMessage)
      .set({ isRead: true })
      .where('"tenantId" = :tenantId AND "contactId" = :contactId AND direction = :dir AND "isRead" = false', {
        tenantId, contactId, dir: 'incoming',
      })
      .execute();
  }

  async sendDirectToChat(tenantId: string, botId: string, chatId: string, text: string): Promise<void> {
    const bot = await this.findBot(tenantId, botId);
    try {
      await axios.post(`https://api.telegram.org/bot${bot.botToken}/sendMessage`, { chat_id: chatId, text });
    } catch (error: any) {
      throw new BadRequestException(`Failed to send Telegram message: ${error.message}`);
    }
  }

  // ── Bot staff recipients ──────────────────────────────────────────────────

  async getBotRecipients(tenantId: string, botId: string): Promise<any[]> {
    const bot = await this.findBot(tenantId, botId);
    return (bot.meta?.recipients as any[]) || [];
  }

  async addBotRecipient(tenantId: string, botId: string, dto: {
    staffUserId: string; staffUserName: string; telegramChatId: string; telegramUsername?: string;
  }): Promise<any> {
    const bot = await this.findBot(tenantId, botId);
    const recipients: any[] = (bot.meta?.recipients as any[]) || [];
    const newRecipient = {
      id: randomUUID(), botId,
      staffUserId: dto.staffUserId,
      staffUserName: dto.staffUserName,
      telegramChatId: dto.telegramChatId,
      telegramUsername: dto.telegramUsername || null,
      aiSessionId: null,
      createdAt: new Date().toISOString(),
    };
    bot.meta = { ...(bot.meta || {}), recipients: [...recipients, newRecipient] };
    await this.botRepo.save(bot);
    return newRecipient;
  }

  async removeBotRecipient(tenantId: string, botId: string, recipientId: string): Promise<void> {
    const bot = await this.findBot(tenantId, botId);
    bot.meta = { ...(bot.meta || {}), recipients: ((bot.meta?.recipients as any[]) || []).filter((r: any) => r.id !== recipientId) };
    await this.botRepo.save(bot);
  }

  async deleteBot(tenantId: string, id: string): Promise<void> {
    const bot = await this.findBot(tenantId, id);

    // Stop polling for this bot
    try { this.polling().stopPollingBot(bot.id); } catch {}

    // Remove webhook from Telegram (best-effort)
    try {
      await axios.post(`https://api.telegram.org/bot${bot.botToken}/deleteWebhook`, { drop_pending_updates: true });
    } catch (e) {
      this.log.warn(`deleteWebhook failed for bot ${bot.id}: ${(e as Error).message}`);
    }

    await this.botRepo.delete({ id: bot.id, tenantId });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private getMessageType(message: any): string {
    if (message.photo) return 'photo';
    if (message.document) return 'document';
    if (message.voice) return 'voice';
    if (message.video) return 'video';
    if (message.audio) return 'audio';
    if (message.sticker) return 'sticker';
    if (message.location) return 'location';
    return 'text';
  }

  private extractAttachments(message: any): any[] | null {
    const out: any[] = [];
    if (message.photo?.length) {
      const p = message.photo[message.photo.length - 1];
      out.push({ type: 'photo', fileId: p.file_id, fileUniqueId: p.file_unique_id, fileSize: p.file_size });
    }
    if (message.document) out.push({ type: 'document', fileId: message.document.file_id, fileUniqueId: message.document.file_unique_id, fileName: message.document.file_name, fileSize: message.document.file_size });
    if (message.voice) out.push({ type: 'voice', fileId: message.voice.file_id, fileUniqueId: message.voice.file_unique_id, fileSize: message.voice.file_size });
    if (message.video) out.push({ type: 'video', fileId: message.video.file_id, fileUniqueId: message.video.file_unique_id, fileSize: message.video.file_size });
    return out.length ? out : null;
  }

  private normalizeDigits(phone: string): string {
    return String(phone || '').replace(/\D/g, '');
  }

  private async findLeadByPhoneDigits(tenantId: string, digits: string): Promise<Lead | null> {
    if (!digits) return null;
    return this.leadRepo.createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere("regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g') = :digits", { digits })
      .orderBy('l.updatedAt', 'DESC').getOne();
  }

  private async findLeadByTelegramUserId(tenantId: string, telegramUserId: string): Promise<Lead | null> {
    return this.leadRepo.createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere("l.meta->>'telegramUserId' = :telegramUserId", { telegramUserId })
      .orderBy('l.updatedAt', 'DESC').getOne();
  }

  private buildTelegramDisplayName(message: any, telegramUserId: string): string {
    const fn = String(message.from?.first_name || '').trim();
    const ln = String(message.from?.last_name || '').trim();
    const full = [fn, ln].filter(Boolean).join(' ').trim();
    if (full) return full;
    const un = message.from?.username ? String(message.from.username).trim() : '';
    if (un) return `@${un}`;
    return `Telegram ${telegramUserId}`;
  }

  private formatInboundBody(message: any): string {
    const type = this.getMessageType(message);
    if (type === 'text' && message.text) return String(message.text).trim() || '(пустое тело)';
    return `[${type}]`;
  }

  private async syncInboundToLeadNote(
    tenantId: string,
    bot: TelegramBot,
    contact: TelegramContact,
    telegramUserId: string,
    message: any,
    telegramMessageRowId: string,
  ): Promise<void> {
    try {
      let lead: Lead | null = null;
      if (contact.leadId) lead = await this.leadRepo.findOne({ where: { id: contact.leadId, tenantId } });
      if (!lead) lead = await this.findLeadByTelegramUserId(tenantId, telegramUserId);
      const phoneRaw = (message.from?.phone_number as string | undefined) || contact.telegramPhone || '';
      const digits = this.normalizeDigits(phoneRaw);
      if (!lead && digits) lead = await this.findLeadByPhoneDigits(tenantId, digits);
      if (!lead) {
        const displayName = this.buildTelegramDisplayName(message, telegramUserId);
        const un = message.from?.username ? String(message.from.username).trim() : '';
        const phone = phoneRaw && String(phoneRaw).trim().startsWith('+') ? String(phoneRaw).trim() : digits ? `+${digits}` : undefined;
        const crmLink = (bot.meta?.crmLink || {}) as { stage?: string; source?: string; distributionUserIds?: string[] };
        const assignedUserId = await this.nextRoundRobinAssignee(bot, crmLink.distributionUserIds);
        lead = await this.leadsService.createForTenant(tenantId, {
          name: displayName,
          ...(phone ? { phone } : {}),
          source: crmLink.source?.trim() || 'telegram',
          status: crmLink.stage?.trim() || 'new',
          ...(assignedUserId ? { assignedUserId } : {}),
          meta: { telegramUserId, telegramUsername: un || null, telegramBotId: bot.id },
        });
        await this.logEvent(bot, 'ok', `crm · lead создан из чата ${un ? `@${un}` : telegramUserId}`);
      }
      if (contact.leadId !== lead.id) {
        contact.leadId = lead.id;
        await this.contactRepo.save(contact);
      }
      const un = message.from?.username ? `@${String(message.from.username)}` : null;
      const lines = [
        'Входящее сообщение Telegram',
        bot.botUsername ? `Бот: @${bot.botUsername}` : `Бот: ${bot.botName || bot.id}`,
        un ? `Telegram: ${un}` : null,
        `User ID: ${telegramUserId}`,
        '',
        this.formatInboundBody(message),
      ].filter((x) => x != null).join('\n');
      await this.notesService.create(tenantId, {
        entityType: EntityType.LEAD,
        entityId: lead.id,
        content: lines,
        title: 'Telegram · входящее',
        type: NoteType.NOTE,
        metadata: { channel: 'telegram_inbound', telegramMessageId: String(message.message_id), telegramMessageRowId, telegramUserId, botId: bot.id, contactId: contact.id },
      }, undefined, 'Telegram');
    } catch (e) {
      this.log.warn(`Telegram CRM: syncInboundToLeadNote failed: ${(e as Error).message}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Token masking, capabilities, event log
  // ══════════════════════════════════════════════════════════════════════════

  private maskToken(token: string): string {
    if (!token || token.length < 10) return '••••••••';
    return `${token.slice(0, 4)}${'•'.repeat(10)}${token.slice(-3)}`;
  }

  /** Never round-trip the real bot token to the frontend outside the create/edit form's own echo. */
  private toPublicBot(bot: TelegramBot): TelegramBot {
    return { ...bot, botToken: this.maskToken(bot.botToken) } as TelegramBot;
  }

  private getCapabilities(bot: TelegramBot): Record<string, boolean> {
    const caps = (bot.meta?.capabilities || {}) as Record<string, boolean>;
    return {
      aiAutoReply: caps.aiAutoReply !== false,
      humanHandoff: caps.humanHandoff !== false,
      leadCreation: caps.leadCreation !== false,
      bookingIntegration: caps.bookingIntegration !== false,
      payments: caps.payments === true, // off by default — payment charging isn't implemented
      files: caps.files !== false,
      broadcast: caps.broadcast === true, // off by default — segment broadcast isn't implemented
      staffNotifications: caps.staffNotifications !== false,
      offHours: caps.offHours === true,
      dailyDigest: caps.dailyDigest === true,
    };
  }

  /** Appends to the bot's capped rolling event log (in-memory mutation only — relies on the
   * caller's own botRepo.save(bot) shortly after, matching this service's existing pattern of
   * mutating `bot` in-memory across a request and persisting once at the end). */
  private logEvent(bot: TelegramBot, kind: 'ok' | 'er' | 'wr', message: string): void {
    const log: Array<{ t: string; k: string; m: string }> = Array.isArray(bot.meta?.eventLog) ? bot.meta.eventLog : [];
    const entry = { t: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), k: kind, m: message };
    bot.meta = { ...(bot.meta || {}), eventLog: [entry, ...log].slice(0, 200) };
  }

  private async nextRoundRobinAssignee(bot: TelegramBot, ids?: string[]): Promise<string | undefined> {
    if (!ids?.length) return undefined;
    const crmLink = (bot.meta?.crmLink || {}) as any;
    const idx = ((crmLink.lastAssignedIndex ?? -1) + 1) % ids.length;
    bot.meta = { ...(bot.meta || {}), crmLink: { ...crmLink, lastAssignedIndex: idx } };
    return ids[idx];
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Flow builder — CRUD, aggregation, funnel
  // ══════════════════════════════════════════════════════════════════════════

  private getFlowsFromMeta(bot: TelegramBot): FlowsMap {
    return bot.meta?.flows && Object.keys(bot.meta.flows).length ? bot.meta.flows : buildDefaultFlows();
  }

  async getFlows(tenantId: string, botId: string): Promise<{ flows: FlowsMap; activeFlowId: string | null }> {
    const bot = await this.findBot(tenantId, botId);
    if (!bot.meta?.flows || !Object.keys(bot.meta.flows).length) {
      bot.meta = { ...(bot.meta || {}), flows: buildDefaultFlows() };
      await this.botRepo.save(bot);
    }
    return { flows: bot.meta.flows, activeFlowId: bot.meta.activeFlowId || null };
  }

  async saveFlow(tenantId: string, botId: string, flow: Flow): Promise<FlowsMap> {
    const bot = await this.findBot(tenantId, botId);
    const flows = { ...(bot.meta?.flows || buildDefaultFlows()), [flow.id]: flow };
    bot.meta = { ...(bot.meta || {}), flows };
    await this.botRepo.save(bot);
    return flows;
  }

  async deleteFlow(tenantId: string, botId: string, flowId: string): Promise<FlowsMap> {
    const bot = await this.findBot(tenantId, botId);
    const flows = { ...(bot.meta?.flows || {}) };
    delete flows[flowId];
    const activeFlowId = bot.meta?.activeFlowId === flowId ? null : bot.meta?.activeFlowId ?? null;
    bot.meta = { ...(bot.meta || {}), flows, activeFlowId };
    await this.botRepo.save(bot);
    return flows;
  }

  async setActiveFlow(tenantId: string, botId: string, flowId: string | null): Promise<TelegramBot> {
    const bot = await this.findBot(tenantId, botId);
    bot.meta = { ...(bot.meta || {}), activeFlowId: flowId };
    await this.botRepo.save(bot);
    return this.toPublicBot(bot);
  }

  /** How many contacts on this flow have visited each node — backs the tree UI's "512 · 88%" labels. */
  async getFlowStats(tenantId: string, botId: string, flowId: string): Promise<Record<string, number>> {
    const contacts = await this.contactRepo.find({ where: { tenantId, botId } });
    const stats: Record<string, number> = {};
    for (const c of contacts) {
      const state = (c.meta as any)?.flow;
      if (!state || state.flowId !== flowId) continue;
      for (const nodeId of state.visited || []) stats[nodeId] = (stats[nodeId] || 0) + 1;
    }
    return stats;
  }

  /** Real funnel counts derived from actual TelegramContact/Lead rows — no hardcoded numbers. */
  async getFunnelSummary(tenantId: string, botId: string): Promise<Array<{ nm: string; cnt: number }>> {
    const contacts = await this.contactRepo.find({ where: { tenantId, botId } });
    const opened = contacts.length;
    const reachedMenu = contacts.filter((c) => (((c.meta as any)?.flow?.visited as string[]) || []).length > 1).length;
    const leftContact = contacts.filter((c) => !!c.telegramPhone).length;
    const leadIds = [...new Set(contacts.filter((c) => c.leadId).map((c) => c.leadId as string))];
    let qualified = 0;
    if (leadIds.length) {
      const leads = await this.leadRepo.find({ where: { id: In(leadIds), tenantId } });
      qualified = leads.filter((l) => l.status && l.status !== 'new').length;
    }
    return [
      { nm: 'Открыли бота', cnt: opened },
      { nm: 'Дошли до меню', cnt: reachedMenu },
      { nm: 'Оставили контакт', cnt: leftContact },
      { nm: 'Лид в CRM', cnt: leadIds.length },
      { nm: 'Квалифицирован', cnt: qualified },
    ];
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Event log / webhook diagnostics / commands / token preview
  // ══════════════════════════════════════════════════════════════════════════

  async getEventLog(tenantId: string, botId: string, kind?: string): Promise<Array<{ t: string; k: string; m: string }>> {
    const bot = await this.findBot(tenantId, botId);
    const log: Array<{ t: string; k: string; m: string }> = Array.isArray(bot.meta?.eventLog) ? bot.meta.eventLog : [];
    if (!kind || kind === 'all') return log;
    if (kind === 'errors') return log.filter((l) => l.k === 'er');
    if (kind === 'ai') return log.filter((l) => l.m.startsWith('ai ·') || l.m.startsWith('crm ·'));
    return log;
  }

  async getWebhookInfo(tenantId: string, botId: string): Promise<any> {
    const bot = await this.findBot(tenantId, botId);
    try {
      const res = await axios.get(`https://api.telegram.org/bot${bot.botToken}/getWebhookInfo`);
      return res.data?.result || {};
    } catch (e: any) {
      throw new BadRequestException(`Не удалось получить webhook info: ${e.message}`);
    }
  }

  async previewBotToken(botToken: string): Promise<any> {
    try {
      const { data } = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
      if (!data.ok) throw new Error(data.description || 'Telegram отклонил токен');
      return data.result;
    } catch (e: any) {
      throw new BadRequestException(`Неверный токен: ${e.message}`);
    }
  }

  async setCommands(
    tenantId: string,
    botId: string,
    commands: Array<{ command: string; description: string; targetNodeId?: string }>,
  ): Promise<Array<{ command: string; description: string; targetNodeId?: string }>> {
    const bot = await this.findBot(tenantId, botId);
    const cleaned = commands
      .filter((c) => c.command?.trim())
      .map((c) => ({ command: c.command.replace(/^\//, '').trim().toLowerCase(), description: (c.description || '').slice(0, 256), targetNodeId: c.targetNodeId }));
    try {
      await axios.post(`https://api.telegram.org/bot${bot.botToken}/setMyCommands`, {
        commands: cleaned.map((c) => ({ command: c.command, description: c.description || c.command })),
      });
    } catch (e: any) {
      throw new BadRequestException(`Telegram отклонил команды: ${e.message}`);
    }
    bot.meta = { ...(bot.meta || {}), commands: cleaned };
    this.logEvent(bot, 'ok', `команды бота обновлены (${cleaned.length})`);
    await this.botRepo.save(bot);
    return cleaned;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Generic flow interpreter (runtime)
  // ══════════════════════════════════════════════════════════════════════════

  private norm(s: string): string {
    return String(s || '').trim().toLowerCase();
  }

  private render(text: string, contact: Pick<TelegramContact, 'telegramFirstName' | 'telegramUsername'>): string {
    return (text || '')
      .replace(/\{\{\s*first_name\s*\}\}/g, contact.telegramFirstName || 'друг')
      .replace(/\{\{\s*username\s*\}\}/g, contact.telegramUsername ? `@${contact.telegramUsername}` : '');
  }

  private async send(bot: TelegramBot, chatId: string, text: string, dryRun: boolean, trace?: TraceStep[], label = 'bot'): Promise<void> {
    if (!text) return;
    if (dryRun) { trace?.push({ step: label, detail: text, ms: 0 }); return; }
    await this.sendTgHtml(bot.botToken, chatId, escHtml(text));
  }

  private async sendButtons(bot: TelegramBot, chatId: string, text: string, options: Array<{ label: string }>, dryRun: boolean, trace?: TraceStep[]): Promise<void> {
    if (dryRun) { trace?.push({ step: 'bot', detail: `${text}\n[ ${options.map((o) => o.label).join(' | ')} ]`, ms: 0 }); return; }
    try {
      await axios.post(`https://api.telegram.org/bot${bot.botToken}/sendMessage`, {
        chat_id: chatId,
        text: escHtml(text),
        parse_mode: 'HTML',
        reply_markup: options.length ? { keyboard: options.map((o) => [{ text: o.label }]), resize_keyboard: true, one_time_keyboard: true } : { remove_keyboard: true },
      });
    } catch {
      await this.sendTgHtml(bot.botToken, chatId, escHtml(text));
    }
  }

  private async setFlowState(contact: TelegramContact, state: FlowState, dryRun: boolean): Promise<void> {
    if (dryRun) return;
    contact.meta = { ...(contact.meta || {}), flow: state };
    await this.contactRepo.save(contact);
  }

  private async resolveButtonOptions(bot: TelegramBot, node: FlowNode, state: FlowState): Promise<Array<{ id: string; label: string; nextNodeId?: string }>> {
    if (node.source === 'booking_services') {
      const services = await this.bookingsCatalog.listServices(bot.tenantId).catch(() => [] as any[]);
      return services.slice(0, 8).map((s: any) => ({ id: s.id, label: s.name, nextNodeId: node.childIds?.[0] }));
    }
    if (node.source === 'booking_staff') {
      const staff = await this.bookingsStaff.listStaff(bot.tenantId).catch(() => [] as any[]);
      const opts = staff.filter((s: any) => s.staffUser).slice(0, 7).map((s: any) => ({ id: s.staffUserId, label: s.staffUser.fullName || 'Специалист', nextNodeId: node.childIds?.[0] }));
      opts.push({ id: 'any', label: 'Любой свободный', nextNodeId: node.childIds?.[0] });
      return opts;
    }
    if (node.source === 'booking_slots') {
      return this.resolveSlotOptions(bot, state, node.childIds?.[0]);
    }
    return (node.options || []).map((o) => ({ id: o.id, label: o.label, nextNodeId: o.nextNodeId }));
  }

  private async resolveSlotOptions(bot: TelegramBot, state: FlowState, nextNodeId?: string): Promise<Array<{ id: string; label: string; nextNodeId?: string }>> {
    const services = await this.bookingsCatalog.listServices(bot.tenantId).catch(() => [] as any[]);
    const service = services.find((s: any) => s.id === state.collected.serviceId);
    const durationMin = Number(service?.durationMinutes || 60);
    const staffUserId = state.collected.staffUserId && state.collected.staffUserId !== 'any' ? state.collected.staffUserId : undefined;
    const found: Array<{ id: string; label: string; nextNodeId?: string }> = [];
    const now = new Date();
    for (let day = 0; day < 10 && found.length < 6; day++) {
      const base = new Date(now);
      base.setDate(base.getDate() + day);
      for (let hour = 9; hour < 20 && found.length < 6; hour++) {
        for (const min of [0, 30]) {
          const startAt = new Date(base);
          startAt.setHours(hour, min, 0, 0);
          if (startAt <= now) continue;
          const endAt = new Date(startAt.getTime() + durationMin * 60_000);
          const check = await this.bookingsAvailability.inspectSlot(bot.tenantId, { staffUserId, startAt, endAt }).catch(() => ({ ok: false }) as any);
          if (check.ok) {
            found.push({
              id: `${startAt.toISOString()}|${endAt.toISOString()}`,
              label: startAt.toLocaleString('ru-RU', { weekday: 'short', hour: '2-digit', minute: '2-digit' }),
              nextNodeId,
            });
          }
        }
      }
    }
    return found;
  }

  private evalCond(node: FlowNode, state: FlowState): boolean {
    const field = node.condField || '';
    let actual: any;
    if (field === 'repeatCount') {
      const seen = new Set<string>();
      actual = state.recentMessages.filter((m) => (seen.has(m) ? true : (seen.add(m), false))).length;
    } else if (field.startsWith('collected.')) {
      actual = state.collected[field.slice('collected.'.length)];
    }
    if (node.condOp === 'exists') return actual !== undefined && actual !== null && actual !== '';
    if (node.condOp === 'gte') return Number(actual || 0) >= Number(node.condValue || 0);
    return String(actual ?? '') === String(node.condValue ?? '');
  }

  private async writeField(bot: TelegramBot, contact: TelegramContact, fieldTarget: string | undefined, value: string, state: FlowState, dryRun: boolean): Promise<void> {
    if (!fieldTarget || dryRun) { if (fieldTarget?.startsWith('collected.')) state.collected[fieldTarget.slice('collected.'.length)] = value; return; }
    if (fieldTarget === 'contact.firstName') {
      contact.telegramFirstName = value;
      await this.contactRepo.save(contact);
      return;
    }
    if (fieldTarget === 'contact.phone') {
      contact.telegramPhone = value;
      await this.contactRepo.save(contact);
      if (contact.leadId) await this.leadRepo.update({ id: contact.leadId, tenantId: bot.tenantId }, { phone: value }).catch(() => undefined);
      return;
    }
    if (fieldTarget.startsWith('lead.customFields.')) {
      const key = fieldTarget.slice('lead.customFields.'.length);
      if (contact.leadId) {
        const lead = await this.leadRepo.findOne({ where: { id: contact.leadId, tenantId: bot.tenantId } });
        if (lead) {
          lead.customFields = { ...(lead.customFields || {}), [key]: value };
          await this.leadRepo.save(lead);
        }
      }
      state.collected[key] = value;
      return;
    }
    if (fieldTarget.startsWith('collected.')) state.collected[fieldTarget.slice('collected.'.length)] = value;
  }

  private async runCrmAction(bot: TelegramBot, contact: TelegramContact, node: FlowNode, state: FlowState, dryRun: boolean, trace?: TraceStep[]): Promise<void> {
    if (node.crmAction === 'create_lead') {
      trace?.push({ step: 'crm', detail: 'лид создаётся автоматически при первом сообщении', ms: 0 });
      return;
    }
    if (node.crmAction === 'create_reservation') {
      if (dryRun) { trace?.push({ step: 'crm', detail: 'создание брони (тестовый прогон — не сохраняется)', ms: 0 }); return; }
      const locations = await this.bookingsCatalog.listLocations(bot.tenantId).catch(() => [] as any[]);
      const location = locations[0];
      if (!location || !state.collected.startAt || !state.collected.endAt) {
        trace?.push({ step: 'crm', detail: 'не хватает данных для создания брони', ms: 0 });
        return;
      }
      const contactName = [contact.telegramFirstName, contact.telegramLastName].filter(Boolean).join(' ') || (contact.telegramUsername ? `@${contact.telegramUsername}` : 'Telegram клиент');
      const reservation = await this.reservationsService
        .create(bot.tenantId, {
          locationId: location.id,
          serviceId: state.collected.serviceId,
          staffUserId: state.collected.staffUserId && state.collected.staffUserId !== 'any' ? state.collected.staffUserId : undefined,
          startAt: state.collected.startAt,
          endAt: state.collected.endAt,
          customerName: contactName,
          customerPhone: contact.telegramPhone || undefined,
          source: 'telegram',
          customFields: { telegramContactId: contact.id, telegramBotId: bot.id },
        }, null)
        .catch((e: any) => { trace?.push({ step: 'crm', detail: `ошибка создания брони: ${e.message}`, ms: 0 }); return null; });
      if (reservation) {
        state.collected.reservationId = reservation.id;
        this.logEvent(bot, 'ok', `crm · бронь создана из чата (${contactName})`);
        await this.botRepo.save(bot);
      }
      return;
    }
    if (node.crmAction === 'update_lead_stage' && contact.leadId && !dryRun) {
      const status = node.text?.trim();
      if (status) await this.leadRepo.update({ id: contact.leadId, tenantId: bot.tenantId }, { status }).catch(() => undefined);
    }
  }

  private async scheduleDelay(contact: TelegramContact, node: FlowNode, dryRun: boolean): Promise<void> {
    if (dryRun) return;
    const minutes = node.afterMinutes ?? 60;
    const dueAt = new Date(Date.now() + minutes * 60_000).toISOString();
    const meta = (contact.meta || {}) as any;
    const pending: any[] = Array.isArray(meta.pendingReminders) ? meta.pendingReminders : [];
    pending.push({ nodeId: node.id, text: node.text, dueAt, sent: false });
    contact.meta = { ...meta, pendingReminders: pending };
    await this.contactRepo.save(contact);
  }

  private async escalateToHuman(bot: TelegramBot, contact: TelegramContact, department: string | undefined, pauseMinutes: number | undefined, reason: string, dryRun: boolean): Promise<void> {
    if (dryRun) return;
    const pause = pauseMinutes ?? Number(bot.meta?.aiConnector?.escalation?.pauseMinutes) ?? 30;
    const recipients: any[] = (bot.meta?.recipients as any[]) || [];
    const filtered = department ? recipients.filter((r) => r.role === department) : [];
    const list = filtered.length ? filtered : recipients;
    const contactName = [contact.telegramFirstName, contact.telegramLastName].filter(Boolean).join(' ') || (contact.telegramUsername ? `@${contact.telegramUsername}` : contact.telegramUserId);
    const msg = `🔔 <b>Диалог передан вам</b>\nПричина: ${escHtml(reason)}\nКлиент: ${escHtml(contactName)}${contact.telegramPhone ? `\nТелефон: ${contact.telegramPhone}` : ''}`;
    for (const r of list) {
      if (r.telegramChatId) await this.sendTgHtml(bot.botToken, String(r.telegramChatId), msg).catch(() => undefined);
    }

    // Раньше эскалация «бот передал диалог человеку» была видна только тем, у кого привязан
    // Telegram (сообщение выше) — сотрудник без привязки не узнавал о передаче вовсе. Дублируем
    // в колокольчик in-app уведомлений для всех получателей с привязанной учётной записью.
    // Ленивый ModuleRef.get — тот же приём, что уже используется в этом сервисе для
    // AiAssistantService/HelpdeskService, чтобы не заводить статический импорт NotificationsModule
    // и не расширять и без того хрупкий граф forwardRef этого модуля.
    try {
      const staffIds = list.map((r) => r.staffUserId).filter(Boolean);
      if (staffIds.length) {
        const staffRows = await this.staffRepo.find({ where: { id: In(staffIds), tenantId: bot.tenantId } });
        const userIds = staffRows.map((s) => s.externalId).filter((id): id is string => !!id);
        if (userIds.length) {
          const { NotificationsService } = await import('../notifications/notifications.service.js');
          const notifications = this.moduleRef.get(NotificationsService, { strict: false });
          await notifications.create(
            bot.tenantId,
            userIds,
            'Диалог передан вам',
            `${contactName}${reason ? ` · ${reason}` : ''}`,
            { type: 'telegram.handoff', botId: bot.id, contactId: contact.id, link: '/telegram' },
          );
        }
      }
    } catch (e) {
      this.log.warn(`Failed to create in-app notification for telegram handoff: ${(e as Error)?.message}`);
    }

    this.logEvent(bot, 'wr', `ai · эскалация: ${reason}`);
    await this.botRepo.save(bot);
    contact.meta = { ...(contact.meta || {}), flow: { ...(contact.meta as any)?.flow, pausedUntil: new Date(Date.now() + pause * 60_000).toISOString() } };
    await this.contactRepo.save(contact);
  }

  /** Narrow tool-calling AI turn for `ai`-type flow nodes and freeform-mode AI Connector overrides.
   * Never uses the unrestricted staff AiToolsService registry. */
  private async runAiTurn(
    bot: TelegramBot,
    contact: TelegramContact,
    state: FlowState,
    incomingText: string,
    dryRun: boolean,
  ): Promise<{ reply: string; escalate: boolean; escalateReason?: string; trace: TraceStep[] }> {
    const trace: TraceStep[] = [];
    const t0 = Date.now();
    const ai = (bot.meta?.aiConnector || {}) as any;
    const escalation = ai.escalation || {};
    const stopWords: string[] = Array.isArray(escalation.stopWords) && escalation.stopWords.length ? escalation.stopWords : DEFAULT_STOP_WORDS;
    const repeatThreshold = Number(escalation.repeatThreshold) || 2;

    const lower = incomingText.trim().toLowerCase();
    const hitStopWord = stopWords.find((w: string) => lower.includes(w.toLowerCase()));
    state.recentMessages = [...(state.recentMessages || []), lower].slice(-6);
    const repeatCount = state.recentMessages.filter((m) => m === lower).length;
    trace.push({ step: 'lookup', detail: `Контакт #${contact.id.slice(0, 8)}${contact.leadId ? `, лид #${contact.leadId.slice(0, 8)}` : ''}`, ms: Date.now() - t0 });

    if (hitStopWord) {
      trace.push({ step: 'escalate', detail: `Стоп-слово «${hitStopWord}»`, ms: 0 });
      return { reply: '', escalate: true, escalateReason: `стоп-слово «${hitStopWord}»`, trace };
    }
    if (repeatCount > repeatThreshold) {
      trace.push({ step: 'escalate', detail: `Клиент повторил один и тот же вопрос ${repeatCount} раза`, ms: 0 });
      return { reply: '', escalate: true, escalateReason: 'повторяющийся вопрос', trace };
    }

    const enabledFunctions = new Set<string>(Object.entries(ai.functions || {}).filter(([, v]) => v).map(([k]) => k));
    const kb: Array<{ name: string; content: string; kind?: string; storagePath?: string; updatedAt?: string }> = Array.isArray(ai.knowledgeBase) ? ai.knowledgeBase : [];
    const kbText = kb.filter((k) => (k.kind || 'text') === 'text').map((k) => `### ${k.name}\n${k.content}`).join('\n\n').slice(0, 6000);
    const persona = (ai.systemPrompt || bot.welcomeMessage || 'Отвечай клиентам дружелюбно и по делу.').trim();
    const system = `${persona}\n\nТекущая дата: ${new Date().toISOString().slice(0, 10)}. Отвечай на языке пользователя, кратко.` + (kbText ? `\n\nБаза знаний:\n${kbText}` : '');

    const meta = (contact.meta || {}) as any;
    const history: ChatMessage[] = Array.isArray(meta.aiChat) ? meta.aiChat.slice(-EXTERNAL_HISTORY_MAX) : [];
    let messages: ChatMessage[] = [{ role: 'system', content: system }, ...history, { role: 'user', content: incomingText }];

    const knowledgeFiles = kb.filter((k) => k.kind === 'file' && k.storagePath).map((k) => ({ name: k.name, storagePath: k.storagePath as string }));
    const toolCtx: TelegramToolContext = { tenantId: bot.tenantId, botId: bot.id, chatId: contact.telegramUserId, telegramUserId: contact.telegramUserId, enabledFunctions, knowledgeFiles };

    let finalReply = '';
    let escalate = false;
    let escalateReason: string | undefined;
    let totalPrompt = 0;
    let totalCompletion = 0;

    for (let round = 0; round < 4; round++) {
      const stepStart = Date.now();
      const { message: assistantMsg, usage } = await this.oai().chatCompletionWithConfig({
        messages,
        tools: TELEGRAM_TOOL_DEFINITIONS,
        modelOverride: ai.model,
        temperatureOverride: typeof ai.temperature === 'number' ? ai.temperature : 0.3,
      });
      totalPrompt += usage.prompt_tokens || 0;
      totalCompletion += usage.completion_tokens || 0;
      trace.push({ step: `модель · раунд ${round + 1}`, detail: `${usage.prompt_tokens || 0}+${usage.completion_tokens || 0} токенов`, ms: Date.now() - stepStart });

      const calls = assistantMsg.tool_calls;
      if (!calls?.length) {
        finalReply = assistantMsg.content || '';
        messages = [...messages, assistantMsg];
        break;
      }
      messages = [...messages, assistantMsg];
      for (const c of calls) {
        const tStart = Date.now();
        const result = await this.telegramTools.execute(c.function?.name || '', c.function?.arguments || '{}', toolCtx);
        trace.push({ step: `функция · ${c.function?.name}`, detail: result.result.slice(0, 160), ms: Date.now() - tStart });
        if (result.escalate) { escalate = true; escalateReason = result.escalateReason; }
        messages = [...messages, { role: 'tool', tool_call_id: c.id, name: c.function?.name, content: result.result } as ChatMessage];
      }
      if (escalate) break;
    }

    if (!dryRun) {
      const newHistory = [...history, { role: 'user' as const, content: incomingText }, ...(finalReply ? [{ role: 'assistant' as const, content: finalReply }] : [])];
      contact.meta = { ...(contact.meta || {}), aiChat: newHistory.slice(-EXTERNAL_HISTORY_MAX) };
      await this.contactRepo.save(contact);
      this.logEvent(bot, 'ok', `ai · ответ сгенерирован, ${totalPrompt + totalCompletion} токенов`);
      bot.meta = { ...(bot.meta || {}), lastTrace: trace };
      await this.botRepo.save(bot);
    }

    return { reply: finalReply, escalate, escalateReason, trace };
  }

  /** Enters a node: sends its side-effect (message/buttons/CRM action/handoff/...), then either
   * auto-advances to the next node (msg/cond/crm/delay/hook — capped hop count) or parks the
   * conversation at a waiting node (buttons/ask/ai) until the next incoming message. */
  private async enterNode(
    bot: TelegramBot,
    flow: Flow,
    node: FlowNode,
    contact: TelegramContact,
    state: FlowState,
    chatId: string,
    dryRun: boolean,
    trace?: TraceStep[],
    hops = 0,
  ): Promise<void> {
    if (hops > 6) { await this.setFlowState(contact, state, dryRun); return; }
    state.visited = state.visited.includes(node.id) ? state.visited : [...state.visited, node.id];

    switch (node.type) {
      case 'msg': {
        await this.send(bot, chatId, this.render(node.text, contact), dryRun, trace);
        if (node.nextNodeId && flow.nodes[node.nextNodeId]) {
          return this.enterNode(bot, flow, flow.nodes[node.nextNodeId], contact, state, chatId, dryRun, trace, hops + 1);
        }
        state.nodeId = node.id;
        await this.setFlowState(contact, state, dryRun);
        return;
      }
      case 'buttons': {
        const options = await this.resolveButtonOptions(bot, node, state);
        state.nodeId = node.id;
        await this.setFlowState(contact, state, dryRun);
        await this.sendButtons(bot, chatId, this.render(node.text, contact), options, dryRun, trace);
        return;
      }
      case 'ask': {
        state.nodeId = node.id;
        await this.setFlowState(contact, state, dryRun);
        await this.send(bot, chatId, this.render(node.text, contact), dryRun, trace);
        return;
      }
      case 'ai': {
        state.nodeId = node.id;
        await this.setFlowState(contact, state, dryRun);
        if (node.text?.trim()) await this.send(bot, chatId, this.render(node.text, contact), dryRun, trace, 'system');
        return;
      }
      case 'cond': {
        const ok = this.evalCond(node, state);
        const nextId = ok ? node.trueNodeId : node.falseNodeId;
        if (nextId && flow.nodes[nextId]) return this.enterNode(bot, flow, flow.nodes[nextId], contact, state, chatId, dryRun, trace, hops + 1);
        state.nodeId = node.id;
        await this.setFlowState(contact, state, dryRun);
        return;
      }
      case 'crm': {
        await this.runCrmAction(bot, contact, node, state, dryRun, trace);
        if (node.nextNodeId && flow.nodes[node.nextNodeId]) return this.enterNode(bot, flow, flow.nodes[node.nextNodeId], contact, state, chatId, dryRun, trace, hops + 1);
        state.nodeId = node.id;
        await this.setFlowState(contact, state, dryRun);
        return;
      }
      case 'human': {
        await this.escalateToHuman(bot, contact, node.department, node.pauseMinutes, 'сценарий передал диалог сотруднику', dryRun);
        await this.send(bot, chatId, this.render(node.text, contact) || 'Передаю вас сотруднику — он свяжется с вами.', dryRun, trace);
        state.nodeId = node.id;
        await this.setFlowState(contact, state, dryRun);
        return;
      }
      case 'delay': {
        await this.scheduleDelay(contact, node, dryRun);
        if (node.nextNodeId && flow.nodes[node.nextNodeId]) return this.enterNode(bot, flow, flow.nodes[node.nextNodeId], contact, state, chatId, dryRun, trace, hops + 1);
        state.nodeId = node.id;
        await this.setFlowState(contact, state, dryRun);
        return;
      }
      case 'hook': {
        const flows = this.getFlowsFromMeta(bot);
        const targetFlow = node.targetFlowId ? flows[node.targetFlowId] : undefined;
        if (!targetFlow) { state.nodeId = node.id; await this.setFlowState(contact, state, dryRun); return; }
        const newState: FlowState = { flowId: targetFlow.id, nodeId: targetFlow.startNodeId, collected: state.collected, visited: [], recentMessages: [] };
        Object.assign(state, newState);
        return this.enterNode(bot, targetFlow, targetFlow.nodes[targetFlow.startNodeId], contact, state, chatId, dryRun, trace, hops + 1);
      }
      case 'pay': {
        await this.send(bot, chatId, this.render(node.text, contact) || 'Для оплаты с вами свяжется администратор.', dryRun, trace);
        state.nodeId = node.id;
        await this.setFlowState(contact, state, dryRun);
        return;
      }
    }
  }

  /** Resumes a waiting node (buttons/ask/ai) with the incoming message, then chains into enterNode. */
  private async resumeNode(
    bot: TelegramBot,
    flow: Flow,
    node: FlowNode,
    contact: TelegramContact,
    state: FlowState,
    chatId: string,
    incomingText: string,
    dryRun: boolean,
    trace?: TraceStep[],
  ): Promise<void> {
    if (node.type === 'buttons') {
      const options = await this.resolveButtonOptions(bot, node, state);
      const match = options.find((o) => this.norm(o.label) === this.norm(incomingText));
      if (!match) {
        await this.send(bot, chatId, 'Пожалуйста, выберите один из вариантов ниже.', dryRun, trace);
        await this.sendButtons(bot, chatId, this.render(node.text, contact), options, dryRun, trace);
        return;
      }
      if (node.source === 'booking_services') state.collected.serviceId = match.id;
      else if (node.source === 'booking_staff') state.collected.staffUserId = match.id;
      else if (node.source === 'booking_slots') { const [s, e] = String(match.id).split('|'); state.collected.startAt = s; state.collected.endAt = e; }
      const nextId = match.nextNodeId;
      if (!nextId || !flow.nodes[nextId]) { await this.setFlowState(contact, state, dryRun); return; }
      return this.enterNode(bot, flow, flow.nodes[nextId], contact, state, chatId, dryRun, trace);
    }
    if (node.type === 'ask') {
      const value = incomingText.trim();
      if (node.validation === 'phone' && !/[\d+][\d\s\-()]{5,}/.test(value)) {
        await this.send(bot, chatId, 'Похоже, это не похоже на номер телефона. Пришлите номер ещё раз.', dryRun, trace);
        return;
      }
      await this.writeField(bot, contact, node.fieldTarget, value, state, dryRun);
      if (node.nextNodeId && flow.nodes[node.nextNodeId]) return this.enterNode(bot, flow, flow.nodes[node.nextNodeId], contact, state, chatId, dryRun, trace);
      await this.setFlowState(contact, state, dryRun);
      return;
    }
    if (node.type === 'ai') {
      const { reply, escalate, escalateReason, trace: t2 } = await this.runAiTurn(bot, contact, state, incomingText, dryRun);
      if (trace) trace.push(...t2);
      if (reply) await this.send(bot, chatId, reply, dryRun, trace);
      if (escalate) {
        await this.escalateToHuman(bot, contact, node.department, node.pauseMinutes, escalateReason || 'модель запросила передачу', dryRun);
        if (!dryRun && !reply) await this.send(bot, chatId, 'Передаю вас сотруднику — он ответит вам здесь в ближайшее время.', dryRun, trace);
      } else if (node.aiNextNodeId && flow.nodes[node.aiNextNodeId]) {
        return this.enterNode(bot, flow, flow.nodes[node.aiNextNodeId], contact, state, chatId, dryRun, trace);
      }
      await this.setFlowState(contact, state, dryRun);
      return;
    }
    return this.enterNode(bot, flow, node, contact, state, chatId, dryRun, trace);
  }

  /** Top-level external-message router: universal /stop opt-out, then flow-mode interpreter or
   * (when the bot has no active flow) today's unchanged free-form AI chat. */
  async routeExternalMessage(bot: TelegramBot, contact: TelegramContact, chatId: string, text: string): Promise<void> {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    if (lower === '/stop') {
      contact.status = 'unsubscribed';
      await this.contactRepo.save(contact);
      await this.sendTgHtml(bot.botToken, chatId, 'Вы отписаны от сообщений этого бота. Чтобы возобновить — напишите /start.');
      this.logEvent(bot, 'ok', `contact · ${contact.telegramUsername ? `@${contact.telegramUsername}` : contact.telegramUserId} отписался (/stop)`);
      await this.botRepo.save(bot);
      return;
    }
    if (contact.status === 'unsubscribed' && lower !== '/start') return; // respects the opt-out — bot stays silent
    if (contact.status === 'unsubscribed' && lower === '/start') {
      contact.status = 'active';
      await this.contactRepo.save(contact);
    }

    const capabilities = this.getCapabilities(bot);
    const activeFlowId = bot.meta?.activeFlowId as string | null | undefined;

    if (!activeFlowId) {
      if (capabilities.aiAutoReply === false) return;
      return this.handleExternalUserMessage(bot, contact, chatId, text);
    }

    const flows = this.getFlowsFromMeta(bot);
    const flow = flows[activeFlowId];
    if (!flow) return this.handleExternalUserMessage(bot, contact, chatId, text);

    const meta = (contact.meta || {}) as any;
    let state: FlowState | undefined = meta.flow;

    if (!state || state.flowId !== activeFlowId) {
      state = { flowId: flow.id, nodeId: flow.startNodeId, collected: {}, visited: [], recentMessages: [] };
      return this.enterNode(bot, flow, flow.nodes[flow.startNodeId], contact, state, chatId, false);
    }

    if (state.pausedUntil && new Date(state.pausedUntil).getTime() > Date.now()) return; // silent while a human has the thread

    if (lower === '/start' || lower === '/menu') {
      state = { flowId: flow.id, nodeId: flow.startNodeId, collected: {}, visited: [], recentMessages: [] };
      return this.enterNode(bot, flow, flow.nodes[flow.startNodeId], contact, state, chatId, false);
    }

    const customCommands: Array<{ command: string; targetNodeId?: string }> = Array.isArray(bot.meta?.commands) ? bot.meta.commands : [];
    const cmdMatch = lower.startsWith('/') ? customCommands.find((c) => this.norm(c.command) === lower.replace(/^\//, '')) : undefined;
    if (cmdMatch?.targetNodeId && flow.nodes[cmdMatch.targetNodeId]) {
      return this.enterNode(bot, flow, flow.nodes[cmdMatch.targetNodeId], contact, state, chatId, false);
    }

    const node = flow.nodes[state.nodeId];
    if (!node) return this.enterNode(bot, flow, flow.nodes[flow.startNodeId], contact, state, chatId, false);
    if (node.type === 'buttons' || node.type === 'ask' || node.type === 'ai') {
      return this.resumeNode(bot, flow, node, contact, state, chatId, text, false);
    }
    return this.enterNode(bot, flow, flow.nodes[flow.startNodeId], contact, state, chatId, false);
  }

  /** Dry-run entry point behind the AI tab's "Проверка в чате" — same interpreter, no Telegram
   * HTTP calls, no contact/lead writes. History is passed in and out by the caller (frontend
   * React state), not persisted server-side. */
  async sendTestMessage(
    tenantId: string,
    botId: string,
    input: { history: Array<{ role: 'user' | 'assistant'; text: string }>; message: string },
  ): Promise<{ reply: string; trace: TraceStep[] }> {
    const bot = await this.findBot(tenantId, botId);
    const trace: TraceStep[] = [];
    const fakeContact = {
      id: 'test-session', tenantId, telegramUserId: 'test', telegramUsername: 'test_client',
      telegramFirstName: 'Тест', telegramLastName: null, telegramPhone: null, leadId: null, status: 'active',
      meta: { aiChat: input.history.map((h) => ({ role: h.role, content: h.text })) },
    } as unknown as TelegramContact;

    const activeFlowId = bot.meta?.activeFlowId as string | null | undefined;
    if (activeFlowId) {
      const flows = this.getFlowsFromMeta(bot);
      const flow = flows[activeFlowId];
      if (flow) {
        const state: FlowState = { flowId: flow.id, nodeId: flow.startNodeId, collected: {}, visited: [], recentMessages: [] };
        await this.enterNode(bot, flow, flow.nodes[flow.startNodeId], fakeContact, state, 'test', true, trace);
        const current = flow.nodes[state.nodeId];
        if (current && (current.type === 'buttons' || current.type === 'ask' || current.type === 'ai')) {
          await this.resumeNode(bot, flow, current, fakeContact, state, 'test', input.message, true, trace);
        }
        const reply = trace.filter((s) => s.step === 'bot' || s.step === 'system').map((s) => s.detail).join('\n\n');
        return { reply, trace };
      }
    }

    // Freeform dry run — mirrors handleExternalUserMessage's prompt shape without persisting.
    const persona = bot.welcomeMessage?.trim() || 'Помогай клиентам с вопросами, будь дружелюбным и краткими.';
    const now = new Date().toISOString().slice(0, 10);
    const ai = (bot.meta?.aiConnector || {}) as any;
    const kb: Array<{ name: string; content: string; kind?: string }> = Array.isArray(ai.knowledgeBase) ? ai.knowledgeBase : [];
    const kbText = kb.filter((k) => (k.kind || 'text') === 'text').map((k) => `### ${k.name}\n${k.content}`).join('\n\n').slice(0, 6000);
    const systemPrompt = `${ai.systemPrompt?.trim() || persona}\n\nТекущая дата: ${now}. Отвечай на языке пользователя.` + (kbText ? `\n\nБаза знаний:\n${kbText}` : '');
    const history = input.history.map((h) => ({ role: h.role, content: h.text }));
    const messages = [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: input.message }] as any[];
    const t0 = Date.now();
    const result = await this.oai().chatCompletionWithConfig({
      messages,
      modelOverride: ai.model,
      temperatureOverride: typeof ai.temperature === 'number' ? ai.temperature : 0.3,
    });
    trace.push({ step: 'модель', detail: `${result.usage.prompt_tokens || 0}+${result.usage.completion_tokens || 0} токенов`, ms: Date.now() - t0 });
    return { reply: (result.message.content || '').trim(), trace };
  }
}
