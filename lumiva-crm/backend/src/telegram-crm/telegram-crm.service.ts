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
import { Repository } from 'typeorm';
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
// Types only — no circular import at JS module load time
type AiAssistantService = import('../ai/ai-assistant.service').AiAssistantService;
type AiOpenAiService = import('../ai/ai-openai.service').AiOpenAiService;

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

  async findAllBots(tenantId?: string): Promise<TelegramBot[]> {
    if (tenantId) return this.botRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
    return this.botRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findBotByToken(botToken: string): Promise<TelegramBot | null> {
    return this.botRepo.findOne({ where: { botToken } });
  }

  async findBot(tenantId: string, id: string): Promise<TelegramBot> {
    const bot = await this.botRepo.findOne({ where: { id, tenantId } });
    if (!bot) throw new NotFoundException('Telegram bot not found');
    return bot;
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
      });
      const saved = await this.botRepo.save(bot);
      if (webhookUrl) {
        await this.setWebhook(tenantId, saved.id, webhookUrl);
      } else {
        this.polling().startPollingBot(saved.id, saved.botToken);
      }
      return saved;
    } catch (error: any) {
      throw new BadRequestException(`Invalid bot token: ${error.message}`);
    }
  }

  async updateBot(tenantId: string, id: string, data: {
    botToken?: string; botName?: string; botUsername?: string;
    webhookUrl?: string; welcomeMessage?: string; isActive?: boolean;
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
    return this.botRepo.save(bot);
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

    await this.syncInboundToLeadNote(tenantId, bot, contact, telegramUserId, message, telegramMessage.id);

    try {
      await this.automationsService.triggerAutomation(
        tenantId,
        TriggerEvent.TELEGRAM_MESSAGE_RECEIVED,
        { entityType: 'telegram_message', entityId: telegramMessage.id, message: telegramMessage, contact, botId: bot.id },
      );
    } catch { /* non-critical */ }

    // AI response for external users
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
      await this.handleExternalUserMessage(bot, contact, chatId, text);
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
        lead = await this.leadsService.createForTenant(tenantId, {
          name: displayName,
          ...(phone ? { phone } : {}),
          source: 'telegram', status: 'new',
          meta: { telegramUserId, telegramUsername: un || null, telegramBotId: bot.id },
        });
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
}
