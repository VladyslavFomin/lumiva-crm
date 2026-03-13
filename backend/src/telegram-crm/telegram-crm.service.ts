// src/telegram-crm/telegram-crm.service.ts
import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { TelegramBot } from './telegram-bot.entity';
import { TelegramContact } from './telegram-contact.entity';
import { TelegramMessage } from './telegram-message.entity';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';

@Injectable()
export class TelegramCrmService {
  constructor(
    @InjectRepository(TelegramBot)
    private readonly botRepo: Repository<TelegramBot>,
    @InjectRepository(TelegramContact)
    private readonly contactRepo: Repository<TelegramContact>,
    @InjectRepository(TelegramMessage)
    private readonly messageRepo: Repository<TelegramMessage>,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
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
      contact = await this.contactRepo.save(contact);
    }

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
}

