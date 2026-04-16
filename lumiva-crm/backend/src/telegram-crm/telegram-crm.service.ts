// src/telegram-crm/telegram-crm.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { TelegramBot } from './telegram-bot.entity';
import { TelegramContact } from './telegram-contact.entity';
import { TelegramMessage } from './telegram-message.entity';
import { Lead } from '../leads/lead.entity';
import { LeadsService } from '../leads/leads.service';
import { NotesService } from '../notes/notes.service';
import { EntityType, NoteType } from '../notes/dto/create-note.dto';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';

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
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
    @Inject(forwardRef(() => LeadsService))
    private readonly leadsService: LeadsService,
    @Inject(forwardRef(() => NotesService))
    private readonly notesService: NotesService,
  ) {}

  /**
   * Получить все боты тенанта (или все если tenantId пустой)
   */
  async findAllBots(tenantId?: string): Promise<TelegramBot[]> {
    if (tenantId) {
      return this.botRepo.find({
        where: { tenantId },
        order: { createdAt: 'DESC' },
      });
    }
    return this.botRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Найти бота по токену
   */
  async findBotByToken(botToken: string): Promise<TelegramBot | null> {
    return this.botRepo.findOne({
      where: { botToken },
    });
  }

  /**
   * Получить один бот
   */
  async findBot(tenantId: string, id: string): Promise<TelegramBot> {
    const bot = await this.botRepo.findOne({
      where: { id, tenantId },
    });

    if (!bot) {
      throw new NotFoundException('Telegram bot not found');
    }

    return bot;
  }

  /**
   * Создать бота
   */
  async createBot(
    tenantId: string,
    botToken: string,
    webhookUrl?: string,
  ): Promise<TelegramBot> {
    // Проверяем токен через Telegram API
    try {
      const response = await axios.get(
        `https://api.telegram.org/bot${botToken}/getMe`,
      );
      const botInfo = response.data.result;

      const bot = this.botRepo.create({
        tenantId,
        botToken,
        botUsername: botInfo.username || null,
        botName: botInfo.first_name || null,
        webhookUrl: webhookUrl || null,
        status: 'active',
      });

      const saved = await this.botRepo.save(bot);

      // Устанавливаем webhook если указан
      if (webhookUrl) {
        await this.setWebhook(tenantId, saved.id, webhookUrl);
      }

      return saved;
    } catch (error: any) {
      throw new BadRequestException(
        `Invalid bot token: ${error.message}`,
      );
    }
  }

  /**
   * Обновить бота
   */
  async updateBot(
    tenantId: string,
    id: string,
    data: {
      botToken?: string;
      botName?: string;
      botUsername?: string;
      webhookUrl?: string;
      welcomeMessage?: string;
      isActive?: boolean;
    },
  ): Promise<TelegramBot> {
    const bot = await this.findBot(tenantId, id);

    // Если обновляется токен, проверяем его
    if (data.botToken && data.botToken !== bot.botToken) {
      try {
        const response = await axios.get(
          `https://api.telegram.org/bot${data.botToken}/getMe`,
        );
        const botInfo = response.data.result;
        bot.botToken = data.botToken;
        bot.botUsername = botInfo.username || bot.botUsername;
        bot.botName = botInfo.first_name || bot.botName;
      } catch (error: any) {
        throw new BadRequestException(
          `Invalid bot token: ${error.message}`,
        );
      }
    }

    if (data.botName !== undefined) bot.botName = data.botName;
    if (data.botUsername !== undefined) bot.botUsername = data.botUsername;
    if (data.webhookUrl !== undefined) {
      bot.webhookUrl = data.webhookUrl;
      if (data.webhookUrl) {
        await this.setWebhook(tenantId, id, data.webhookUrl);
      }
    }
    if (data.welcomeMessage !== undefined) bot.welcomeMessage = data.welcomeMessage;
    if (data.isActive !== undefined) {
      // Используем status вместо isActive
      bot.status = data.isActive ? 'active' : 'inactive';
    }

    return this.botRepo.save(bot);
  }

  /**
   * Установить webhook
   */
  async setWebhook(
    tenantId: string,
    botId: string,
    webhookUrl: string,
  ): Promise<void> {
    const bot = await this.findBot(tenantId, botId);

    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${bot.botToken}/setWebhook`,
        {
          url: webhookUrl,
        },
      );

      if (response.data.ok) {
        bot.webhookUrl = webhookUrl;
        bot.webhookSetAt = new Date();
        bot.status = 'active';
        bot.lastError = null;
        await this.botRepo.save(bot);
      } else {
        throw new Error(response.data.description || 'Failed to set webhook');
      }
    } catch (error: any) {
      bot.status = 'error';
      bot.lastError = error.message;
      await this.botRepo.save(bot);
      throw new BadRequestException(`Failed to set webhook: ${error.message}`);
    }
  }

  /**
   * Обработать входящее сообщение от Telegram
   */
  async handleIncomingMessage(
    tenantId: string,
    botToken: string,
    update: any,
  ): Promise<void> {
    const bot = await this.botRepo.findOne({
      where: { tenantId, botToken },
    });

    if (!bot || bot.status !== 'active') {
      return;
    }

    const message = update.message;
    if (!message) return;

    const telegramUserId = String(message.from.id);
    const chatId = String(message.chat.id);

    // Находим или создаем контакт
    let contact = await this.contactRepo.findOne({
      where: { tenantId, telegramUserId },
    });

    if (!contact) {
      contact = this.contactRepo.create({
        tenantId,
        telegramUserId,
        telegramUsername: message.from.username || null,
        telegramFirstName: message.from.first_name || null,
        telegramLastName: message.from.last_name || null,
        telegramPhone: message.from.phone_number || null,
        status: 'active',
      });
    } else {
      contact.telegramUsername = message.from.username || null;
      contact.telegramFirstName = message.from.first_name || null;
      contact.telegramLastName = message.from.last_name || null;
      if (message.from.phone_number) {
        contact.telegramPhone = message.from.phone_number;
      }
    }
    contact = await this.contactRepo.save(contact);

    // Сохраняем сообщение
    const telegramMessage = this.messageRepo.create({
      tenantId,
      contactId: contact.id,
      messageId: String(message.message_id),
      chatId,
      direction: 'incoming',
      text: message.text || null,
      messageType: this.getMessageType(message),
      attachments: this.extractAttachments(message),
      date: new Date(message.date * 1000), // Telegram date в секундах
      isRead: false,
      rawData: message,
    });

    await this.messageRepo.save(telegramMessage);

    await this.syncInboundToLeadNote(
      tenantId,
      bot,
      contact,
      telegramUserId,
      message,
      telegramMessage.id,
    );

    // Триггерим автоматизацию
    try {
      await this.automationsService.triggerAutomation(
        tenantId,
        TriggerEvent.TELEGRAM_MESSAGE_RECEIVED,
        {
          entityType: 'telegram_message',
          entityId: telegramMessage.id,
          message: telegramMessage,
          contact: contact,
          botId: bot.id,
        },
      );
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }

    // Обновляем время последней синхронизации
    bot.lastSyncAt = new Date();
    await this.botRepo.save(bot);
  }

  /**
   * Отправить сообщение
   */
  async sendMessage(
    tenantId: string,
    botId: string,
    telegramUserId: string,
    text: string,
    options?: {
      contactId?: string;
      companyId?: string;
      leadId?: string;
      saleId?: string;
    },
  ): Promise<TelegramMessage> {
    const bot = await this.findBot(tenantId, botId);

    // Находим контакт
    let contact = await this.contactRepo.findOne({
      where: { tenantId, telegramUserId },
    });

    if (!contact) {
      throw new NotFoundException('Telegram contact not found');
    }

    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${bot.botToken}/sendMessage`,
        {
          chat_id: telegramUserId,
          text: text,
        },
      );

      const sentMessage = response.data.result;

      // Сохраняем отправленное сообщение
      const telegramMessage = this.messageRepo.create({
        tenantId,
        contactId: contact.id,
        messageId: String(sentMessage.message_id),
        chatId: String(sentMessage.chat.id),
        direction: 'outgoing',
        text: text,
        messageType: 'text',
        linkedContactId: options?.contactId || null,
        linkedCompanyId: options?.companyId || null,
        linkedLeadId: options?.leadId || null,
        linkedSaleId: options?.saleId || null,
        date: new Date(sentMessage.date * 1000),
        isRead: true,
        rawData: sentMessage,
      });

      return this.messageRepo.save(telegramMessage);
    } catch (error: any) {
      bot.status = 'error';
      bot.lastError = error.message;
      await this.botRepo.save(bot);
      throw new BadRequestException(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Отправить файл в чат (документ). Нужен существующий TelegramContact для chat_id.
   */
  async sendDocumentFromBuffer(
    tenantId: string,
    botId: string,
    telegramUserId: string,
    filename: string,
    file: Buffer,
    caption?: string,
    options?: {
      contactId?: string;
      companyId?: string;
      leadId?: string;
      saleId?: string;
    },
  ): Promise<TelegramMessage> {
    const bot = await this.findBot(tenantId, botId);
    const contact = await this.contactRepo.findOne({
      where: { tenantId, telegramUserId },
    });
    if (!contact) {
      throw new NotFoundException('Telegram contact not found');
    }
    const safeName = String(filename || 'file.dat').replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const boundary = `----lumiva${Date.now()}`;
    const crlf = '\r\n';
    const parts: Buffer[] = [];
    const pushField = (name: string, value: string) => {
      parts.push(
        Buffer.from(
          `--${boundary}${crlf}Content-Disposition: form-data; name="${name}"${crlf}${crlf}${value}${crlf}`,
          'utf8',
        ),
      );
    };
    pushField('chat_id', telegramUserId);
    if (caption) {
      pushField('caption', String(caption).slice(0, 1024));
    }
    parts.push(
      Buffer.from(
        `--${boundary}${crlf}Content-Disposition: form-data; name="document"; filename="${safeName}"${crlf}Content-Type: application/octet-stream${crlf}${crlf}`,
        'utf8',
      ),
    );
    parts.push(file);
    parts.push(Buffer.from(`${crlf}--${boundary}--${crlf}`, 'utf8'));
    const body = Buffer.concat(parts);
    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${bot.botToken}/sendDocument`,
        body,
        {
          headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        },
      );
      const sent = response.data?.result;
      if (!sent) {
        throw new Error(response.data?.description || 'No result from Telegram');
      }
      const telegramMessage = this.messageRepo.create({
        tenantId,
        contactId: contact.id,
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
      });
      return this.messageRepo.save(telegramMessage);
    } catch (error: any) {
      bot.status = 'error';
      bot.lastError = error.message;
      await this.botRepo.save(bot);
      throw new BadRequestException(`Failed to send document: ${error.message}`);
    }
  }

  /**
   * Получить сообщения
   */
  async findMessages(
    tenantId: string,
    options?: {
      contactId?: string;
      telegramUserId?: string;
      direction?: 'incoming' | 'outgoing';
      limit?: number;
      offset?: number;
    },
  ): Promise<{ items: TelegramMessage[]; total: number }> {
    const qb = this.messageRepo
      .createQueryBuilder('message')
      .where('message.tenantId = :tenantId', { tenantId });

    if (options?.contactId) {
      qb.andWhere('message.contactId = :contactId', { contactId: options.contactId });
    }

    if (options?.telegramUserId) {
      qb.leftJoin('message.contact', 'contact');
      qb.andWhere('contact.telegramUserId = :telegramUserId', {
        telegramUserId: options.telegramUserId,
      });
    }

    if (options?.direction) {
      qb.andWhere('message.direction = :direction', { direction: options.direction });
    }

    const total = await qb.getCount();

    if (options?.limit) {
      qb.limit(options.limit);
    }
    if (options?.offset) {
      qb.offset(options.offset);
    }

    qb.orderBy('message.date', 'DESC');

    const items = await qb.getMany();

    return { items, total };
  }

  /**
   * Получить тип сообщения
   */
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

  /**
   * Извлечь вложения
   */
  private extractAttachments(message: any): Array<{
    type: string;
    fileId: string;
    fileUniqueId: string;
    fileName?: string;
    fileSize?: number;
  }> | null {
    const attachments: any[] = [];

    if (message.photo && message.photo.length > 0) {
      const photo = message.photo[message.photo.length - 1]; // Берем самое большое
      attachments.push({
        type: 'photo',
        fileId: photo.file_id,
        fileUniqueId: photo.file_unique_id,
        fileSize: photo.file_size,
      });
    }

    if (message.document) {
      attachments.push({
        type: 'document',
        fileId: message.document.file_id,
        fileUniqueId: message.document.file_unique_id,
        fileName: message.document.file_name,
        fileSize: message.document.file_size,
      });
    }

    if (message.voice) {
      attachments.push({
        type: 'voice',
        fileId: message.voice.file_id,
        fileUniqueId: message.voice.file_unique_id,
        fileSize: message.voice.file_size,
      });
    }

    if (message.video) {
      attachments.push({
        type: 'video',
        fileId: message.video.file_id,
        fileUniqueId: message.video.file_unique_id,
        fileSize: message.video.file_size,
      });
    }

    return attachments.length > 0 ? attachments : null;
  }

  private normalizeDigits(phone: string): string {
    return String(phone || '').replace(/\D/g, '');
  }

  private async findLeadByPhoneDigits(
    tenantId: string,
    digits: string,
  ): Promise<Lead | null> {
    if (!digits) return null;
    return this.leadRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere("regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g') = :digits", {
        digits,
      })
      .orderBy('l.updatedAt', 'DESC')
      .getOne();
  }

  private async findLeadByTelegramUserId(
    tenantId: string,
    telegramUserId: string,
  ): Promise<Lead | null> {
    return this.leadRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere("l.meta->>'telegramUserId' = :telegramUserId", { telegramUserId })
      .orderBy('l.updatedAt', 'DESC')
      .getOne();
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
    if (type === 'text' && message.text) {
      return String(message.text).trim() || '(пустое тело)';
    }
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

      if (contact.leadId) {
        lead = await this.leadRepo.findOne({
          where: { id: contact.leadId, tenantId },
        });
      }

      if (!lead) {
        lead = await this.findLeadByTelegramUserId(tenantId, telegramUserId);
      }

      const phoneRaw =
        (message.from?.phone_number as string | undefined) || contact.telegramPhone || '';
      const digits = this.normalizeDigits(phoneRaw);

      if (!lead && digits) {
        lead = await this.findLeadByPhoneDigits(tenantId, digits);
      }

      if (!lead) {
        const displayName = this.buildTelegramDisplayName(message, telegramUserId);
        const un = message.from?.username ? String(message.from.username).trim() : '';
        const phone =
          phoneRaw && String(phoneRaw).trim().startsWith('+')
            ? String(phoneRaw).trim()
            : digits
              ? `+${digits}`
              : undefined;
        lead = await this.leadsService.createForTenant(tenantId, {
          name: displayName,
          ...(phone ? { phone } : {}),
          source: 'telegram',
          status: 'new',
          meta: {
            telegramUserId,
            telegramUsername: un || null,
            telegramBotId: bot.id,
          },
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
      ]
        .filter((x) => x != null)
        .join('\n');

      await this.notesService.create(
        tenantId,
        {
          entityType: EntityType.LEAD,
          entityId: lead.id,
          content: lines,
          title: 'Telegram · входящее',
          type: NoteType.NOTE,
          metadata: {
            channel: 'telegram_inbound',
            telegramMessageId: String(message.message_id),
            telegramMessageRowId,
            telegramUserId,
            botId: bot.id,
            contactId: contact.id,
          },
        },
        undefined,
        'Telegram',
      );
    } catch (e) {
      this.log.warn(
        `Telegram CRM: failed to sync inbound to lead/note: ${(e as Error).message}`,
      );
    }
  }
}

