// src/email/email.service.ts
import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { EmailAccount } from './email-account.entity';
import { EmailMessage } from './email-message.entity';
import { EmailTemplate } from './email-template.entity';
import { CreateEmailAccountDto } from './dto/create-email-account.dto';
import { UpdateEmailAccountDto } from './dto/update-email-account.dto';
import { SendEmailDto } from './dto/send-email.dto';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';

@Injectable()
export class EmailService {
  constructor(
    @InjectRepository(EmailAccount)
    private readonly accountRepo: Repository<EmailAccount>,
    @InjectRepository(EmailMessage)
    private readonly messageRepo: Repository<EmailMessage>,
    @InjectRepository(EmailTemplate)
    private readonly templateRepo: Repository<EmailTemplate>,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
  ) {}

  /**
   * Получить все email аккаунты тенанта
   */
  async findAllAccounts(tenantId: string): Promise<EmailAccount[]> {
    return this.accountRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Получить один email аккаунт
   */
  async findAccount(tenantId: string, id: string): Promise<EmailAccount> {
    const account = await this.accountRepo.findOne({
      where: { id, tenantId },
    });

    if (!account) {
      throw new NotFoundException('Email account not found');
    }

    return account;
  }

  /**
   * Создать email аккаунт
   */
  async createAccount(
    tenantId: string,
    dto: CreateEmailAccountDto,
  ): Promise<EmailAccount> {
    const account = this.accountRepo.create({
      tenantId,
      email: dto.email,
      name: dto.name || null,
      imapHost: dto.imapHost || null,
      imapPort: dto.imapPort || null,
      imapSecure: dto.imapSecure ?? true,
      imapUsername: dto.imapUsername || null,
      imapPassword: dto.imapPassword || null,
      smtpHost: dto.smtpHost || null,
      smtpPort: dto.smtpPort || null,
      smtpSecure: dto.smtpSecure ?? true,
      smtpUsername: dto.smtpUsername || null,
      smtpPassword: dto.smtpPassword || null,
      oauthProvider: dto.oauthProvider || null,
      oauthAccessToken: dto.oauthAccessToken || null,
      oauthRefreshToken: dto.oauthRefreshToken || null,
      syncIncoming: dto.syncIncoming ?? true,
      syncOutgoing: dto.syncOutgoing ?? true,
      syncFolder: dto.syncFolder || 'INBOX',
      status: 'active',
    });

    return this.accountRepo.save(account);
  }

  /**
   * Обновить email аккаунт
   */
  async updateAccount(
    tenantId: string,
    id: string,
    dto: UpdateEmailAccountDto,
  ): Promise<EmailAccount> {
    const account = await this.findAccount(tenantId, id);

    if (dto.email !== undefined) account.email = dto.email;
    if (dto.name !== undefined) account.name = dto.name || null;
    if (dto.imapHost !== undefined) account.imapHost = dto.imapHost || null;
    if (dto.imapPort !== undefined) account.imapPort = dto.imapPort || null;
    if (dto.imapSecure !== undefined) account.imapSecure = dto.imapSecure;
    if (dto.imapUsername !== undefined) account.imapUsername = dto.imapUsername || null;
    // Пароль обновляем только если он был передан и не пустой
    if (dto.imapPassword !== undefined && dto.imapPassword !== '') {
      account.imapPassword = dto.imapPassword;
    }
    if (dto.smtpHost !== undefined) account.smtpHost = dto.smtpHost || null;
    if (dto.smtpPort !== undefined) account.smtpPort = dto.smtpPort || null;
    if (dto.smtpSecure !== undefined) account.smtpSecure = dto.smtpSecure;
    if (dto.smtpUsername !== undefined) account.smtpUsername = dto.smtpUsername || null;
    // Пароль обновляем только если он был передан и не пустой
    if (dto.smtpPassword !== undefined && dto.smtpPassword !== '') {
      account.smtpPassword = dto.smtpPassword;
    }
    if (dto.oauthProvider !== undefined) account.oauthProvider = dto.oauthProvider || null;
    if (dto.oauthAccessToken !== undefined) account.oauthAccessToken = dto.oauthAccessToken || null;
    if (dto.oauthRefreshToken !== undefined) account.oauthRefreshToken = dto.oauthRefreshToken || null;
    if (dto.syncIncoming !== undefined) account.syncIncoming = dto.syncIncoming;
    if (dto.syncOutgoing !== undefined) account.syncOutgoing = dto.syncOutgoing;
    if (dto.syncFolder !== undefined) account.syncFolder = dto.syncFolder || null;

    return this.accountRepo.save(account);
  }

  /**
   * Удалить email аккаунт
   */
  async deleteAccount(tenantId: string, id: string): Promise<void> {
    const account = await this.findAccount(tenantId, id);
    await this.accountRepo.remove(account);
  }

  /**
   * Тест подключения к SMTP
   * Использует быструю проверку с короткими таймаутами
   */
  async testSmtpConnection(tenantId: string, id: string): Promise<boolean> {
    const account = await this.findAccount(tenantId, id);

    if (!account.smtpHost || !account.smtpPort) {
      throw new BadRequestException('SMTP settings not configured');
    }

    // Проверяем, что порт правильный (предупреждение для нестандартных портов)
    if (account.smtpPort !== 465 && account.smtpPort !== 587 && account.smtpPort !== 25) {
      console.warn(`Нестандартный SMTP порт: ${account.smtpPort}. Обычно используется 465 (SSL) или 587 (STARTTLS)`);
    }

    try {
      const transporter = nodemailer.createTransport({
        host: account.smtpHost!,
        port: account.smtpPort!,
        secure: account.smtpSecure, // true for 465, false for other ports
        auth: {
          user: account.smtpUsername || account.email,
          pass: account.smtpPassword || '',
        },
        // Увеличенные таймауты для надежности (но не слишком долго)
        connectionTimeout: 15000, // 15 секунд
        greetingTimeout: 15000,
        socketTimeout: 15000,
        // Дополнительные опции
        requireTLS: !account.smtpSecure,
        tls: {
          rejectUnauthorized: false,
        },
        // Отключаем pool для теста
        pool: false,
      } as any);

      // Проверка с таймаутом
      await Promise.race([
        transporter.verify(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout (15s)')), 15000)
        ),
      ]);

      // Обновляем статус
      account.status = 'active';
      account.lastError = null;
      await this.accountRepo.save(account);

      return true;
    } catch (error: any) {
      account.status = 'error';
      account.lastError = error.message;
      await this.accountRepo.save(account);
      
      // Более понятное сообщение об ошибке
      let errorMessage = error.message;
      if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        errorMessage = `Таймаут подключения к SMTP серверу ${account.smtpHost}:${account.smtpPort}. Проверьте:\n\n1. Правильность хоста и порта\n2. Для Titan Email используйте порт 465 (SSL) или 587 (STARTTLS)\n3. Настройку Secure: для порта 465 = true, для 587 = false\n4. Доступность SMTP сервера из сети`;
      } else if (errorMessage.includes('EAUTH') || errorMessage.includes('authentication') || errorMessage.includes('Invalid login')) {
        errorMessage = `Ошибка аутентификации. Проверьте логин (${account.smtpUsername || account.email}) и пароль SMTP.`;
      } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
        errorMessage = `Не удалось подключиться к ${account.smtpHost}:${account.smtpPort}. Проверьте хост и порт.`;
      }
      
      throw new BadRequestException(errorMessage);
    }
  }

  /**
   * Отправить email
   */
  async sendEmail(tenantId: string, dto: SendEmailDto, triggerData?: any): Promise<EmailMessage> {
    const account = await this.findAccount(tenantId, dto.accountId);

    if (!account.smtpHost || !account.smtpPort) {
      throw new BadRequestException('SMTP settings not configured');
    }

    // Если указан templateId, загружаем и применяем шаблон
    let finalSubject = dto.subject;
    let finalTextBody = dto.textBody;
    let finalHtmlBody = dto.htmlBody;

    if (dto.templateId) {
      // Используем triggerData для интерполяции, если он передан
      // Иначе формируем данные из dto
      const templateData: Record<string, any> = triggerData || {};
      
      // Добавляем данные из связанных сущностей, если их нет в triggerData
      if (!templateData.lead && dto.leadId) templateData.lead = { id: dto.leadId };
      if (!templateData.contact && dto.contactId) templateData.contact = { id: dto.contactId };
      if (!templateData.company && dto.companyId) templateData.company = { id: dto.companyId };
      if (!templateData.sale && dto.saleId) templateData.sale = { id: dto.saleId };

      try {
        const templateResult = await this.applyTemplate(tenantId, dto.templateId, templateData);
        // Используем шаблон только если соответствующие поля не указаны напрямую
        if (!finalSubject && templateResult.subject) finalSubject = templateResult.subject;
        if (!finalTextBody && templateResult.textBody) finalTextBody = templateResult.textBody;
        if (!finalHtmlBody && templateResult.htmlBody) finalHtmlBody = templateResult.htmlBody;
      } catch (error) {
        console.error('Failed to apply template:', error);
        // Продолжаем без шаблона, используя прямые значения из dto
      }
    }

    try {
      const transporter = nodemailer.createTransport({
        host: account.smtpHost!,
        port: account.smtpPort!,
        secure: account.smtpSecure,
        auth: {
          user: account.smtpUsername || account.email,
          pass: account.smtpPassword || '',
        },
        connectionTimeout: 20000, // 20 секунд для отправки
        greetingTimeout: 20000,
        socketTimeout: 20000,
        // Дополнительные опции
        requireTLS: !account.smtpSecure,
        tls: {
          rejectUnauthorized: false, // Разрешаем самоподписанные сертификаты
        },
      } as any);

      const attachments = (dto as any).attachments as
        | Array<{
            filename: string;
            contentType: string;
            contentBase64?: string;
            content?: Buffer;
          }>
        | undefined;

      const mailOptions: any = {
        from: account.name
          ? `${account.name} <${account.email}>`
          : account.email,
        to: dto.to,
        cc: dto.cc,
        bcc: dto.bcc,
        subject: finalSubject || '(No subject)',
        text: finalTextBody,
        html: finalHtmlBody,
      };
      if (attachments && attachments.length) {
        mailOptions.attachments = attachments.map((file) => ({
          filename: file.filename,
          contentType: file.contentType,
          content: file.content
            ? file.content
            : file.contentBase64
              ? Buffer.from(file.contentBase64, 'base64')
              : undefined,
        }));
      }

      const info = await transporter.sendMail(mailOptions);

      // Сохраняем отправленное письмо
      const message = this.messageRepo.create({
        tenantId,
        accountId: account.id,
        messageId: info.messageId || `outgoing-${Date.now()}-${Math.random()}`,
        direction: 'outgoing',
        from: account.email,
        fromName: account.name,
        to: dto.to,
        cc: dto.cc || [],
        bcc: dto.bcc || [],
        subject: finalSubject || null,
        textBody: finalTextBody || null,
        htmlBody: finalHtmlBody || null,
        attachments: attachments?.length
          ? attachments.map((file) => ({
              filename: file.filename,
              contentType: file.contentType,
              size: file.content
                ? file.content.length
                : file.contentBase64
                  ? Buffer.byteLength(file.contentBase64, 'base64')
                  : 0,
            }))
          : null,
        contactId: dto.contactId || null,
        companyId: dto.companyId || null,
        leadId: dto.leadId || null,
        saleId: dto.saleId || null,
        date: new Date(),
        isRead: true,
      });

      const saved = await this.messageRepo.save(message);

      // Триггерим автоматизацию
      try {
        await this.automationsService.triggerAutomation(
          tenantId,
          TriggerEvent.EMAIL_SENT,
          {
            entityType: 'email',
            entityId: saved.id,
            email: saved,
            accountId: account.id,
          },
        );
      } catch (error) {
        console.error('Failed to trigger automation:', error);
      }

      return saved;
    } catch (error: any) {
      account.status = 'error';
      account.lastError = error.message;
      await this.accountRepo.save(account);
      throw new BadRequestException(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Получить сообщения
   */
  async findMessages(
    tenantId: string,
    options?: {
      accountId?: string;
      direction?: 'incoming' | 'outgoing';
      contactId?: string;
      companyId?: string;
      leadId?: string;
      saleId?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ items: EmailMessage[]; total: number }> {
    const qb = this.messageRepo
      .createQueryBuilder('message')
      .where('message.tenantId = :tenantId', { tenantId });

    if (options?.accountId) {
      qb.andWhere('message.accountId = :accountId', { accountId: options.accountId });
    }

    if (options?.direction) {
      qb.andWhere('message.direction = :direction', { direction: options.direction });
    }

    if (options?.contactId) {
      qb.andWhere('message.contactId = :contactId', { contactId: options.contactId });
    }

    if (options?.companyId) {
      qb.andWhere('message.companyId = :companyId', { companyId: options.companyId });
    }

    if (options?.leadId) {
      qb.andWhere('message.leadId = :leadId', { leadId: options.leadId });
    }

    if (options?.saleId) {
      qb.andWhere('message.saleId = :saleId', { saleId: options.saleId });
    }

    if (options?.search) {
      const search = `%${options.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(message.subject) LIKE :search OR LOWER(message.textBody) LIKE :search OR LOWER(message.from) LIKE :search)',
        { search },
      );
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

  // ========== EMAIL TEMPLATES ==========

  /**
   * Получить все шаблоны тенанта
   */
  async findAllTemplates(tenantId: string, isActive?: boolean): Promise<EmailTemplate[]> {
    const where: any = { tenantId };
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    return this.templateRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Получить один шаблон
   */
  async findTemplate(tenantId: string, id: string): Promise<EmailTemplate> {
    const template = await this.templateRepo.findOne({
      where: { id, tenantId },
    });

    if (!template) {
      throw new NotFoundException('Email template not found');
    }

    return template;
  }

  /**
   * Создать шаблон
   */
  async createTemplate(
    tenantId: string,
    dto: CreateEmailTemplateDto,
  ): Promise<EmailTemplate> {
    const template = this.templateRepo.create({
      tenantId,
      name: dto.name,
      description: dto.description || null,
      subject: dto.subject || null,
      htmlBody: dto.htmlBody || null,
      textBody: dto.textBody || null,
      meta: dto.meta || null,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });

    return this.templateRepo.save(template);
  }

  /**
   * Обновить шаблон
   */
  async updateTemplate(
    tenantId: string,
    id: string,
    dto: UpdateEmailTemplateDto,
  ): Promise<EmailTemplate> {
    const template = await this.findTemplate(tenantId, id);

    if (dto.name !== undefined) template.name = dto.name;
    if (dto.description !== undefined) template.description = dto.description || null;
    if (dto.subject !== undefined) template.subject = dto.subject || null;
    if (dto.htmlBody !== undefined) template.htmlBody = dto.htmlBody || null;
    if (dto.textBody !== undefined) template.textBody = dto.textBody || null;
    if (dto.meta !== undefined) template.meta = dto.meta || null;
    if (dto.isActive !== undefined) template.isActive = dto.isActive;

    return this.templateRepo.save(template);
  }

  /**
   * Удалить шаблон
   */
  async deleteTemplate(tenantId: string, id: string): Promise<void> {
    const template = await this.findTemplate(tenantId, id);
    await this.templateRepo.remove(template);
  }

  /**
   * Интерполировать переменные в шаблоне
   */
  interpolateTemplate(template: string, data: Record<string, any>): string {
    if (!template) return '';
    
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, key) => {
      const keys = key.split('.');
      let value = data;
      
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return match; // Возвращаем оригинальный placeholder если переменная не найдена
        }
      }
      
      return value != null ? String(value) : match;
    });
  }

  /**
   * Применить шаблон к данным
   */
  async applyTemplate(
    tenantId: string,
    templateId: string,
    data: Record<string, any>,
  ): Promise<{ subject: string; htmlBody: string; textBody: string }> {
    const template = await this.findTemplate(tenantId, templateId);
    
    const subject = template.subject
      ? this.interpolateTemplate(template.subject, data)
      : '';
    
    const htmlBody = template.htmlBody
      ? this.interpolateTemplate(template.htmlBody, data)
      : '';
    
    const textBody = template.textBody
      ? this.interpolateTemplate(template.textBody, data)
      : '';

    return { subject, htmlBody, textBody };
  }
}
