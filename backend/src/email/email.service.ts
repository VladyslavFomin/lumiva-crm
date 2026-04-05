// src/email/email.service.ts
import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
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
import { Tenant } from '../tenants/tenant.entity';
import { Contact } from '../contacts/contact.entity';
import { Lead } from '../leads/lead.entity';
import { Company } from '../companies/company.entity';
import { Sale } from '../sales/sale.entity';
import { PreviewStyledMailDto } from './dto/preview-styled-mail.dto';
import { SendStyledEmailDto } from './dto/send-styled-email.dto';
import { EmailOAuthService } from './email-oauth.service';
import { EmailFoldersService } from './email-folders.service';
import axios from 'axios';

@Injectable()
export class EmailService {
  constructor(
    @InjectRepository(EmailAccount)
    private readonly accountRepo: Repository<EmailAccount>,
    @InjectRepository(EmailMessage)
    private readonly messageRepo: Repository<EmailMessage>,
    @InjectRepository(EmailTemplate)
    private readonly templateRepo: Repository<EmailTemplate>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
    private readonly emailOAuth: EmailOAuthService,
    private readonly emailFolders: EmailFoldersService,
  ) {}

  /** Без секретов — для API. */
  toPublicEmailAccount(account: EmailAccount): Record<string, unknown> {
    return {
      id: account.id,
      tenantId: account.tenantId,
      email: account.email,
      name: account.name,
      imapHost: account.imapHost,
      imapPort: account.imapPort,
      imapSecure: account.imapSecure,
      imapUsername: account.imapUsername,
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      smtpSecure: account.smtpSecure,
      smtpUsername: account.smtpUsername,
      status: account.status,
      lastError: account.lastError,
      lastSyncAt: account.lastSyncAt,
      syncIncoming: account.syncIncoming,
      syncOutgoing: account.syncOutgoing,
      syncFolder: account.syncFolder,
      oauthProvider: account.oauthProvider,
      oauthExpiresAt: account.oauthExpiresAt,
      hasOAuthTokens: Boolean(account.oauthRefreshToken),
      meta: account.meta,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  /**
   * Получить все email аккаунты тенанта
   */
  async findAllAccounts(tenantId: string): Promise<Record<string, unknown>[]> {
    const rows = await this.accountRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((a) => this.toPublicEmailAccount(a));
  }

  async requireAccountEntity(tenantId: string, id: string): Promise<EmailAccount> {
    const account = await this.accountRepo.findOne({
      where: { id, tenantId },
    });

    if (!account) {
      throw new NotFoundException('Email account not found');
    }

    return account;
  }

  /**
   * Один аккаунт (без токенов и паролей).
   */
  async findAccount(
    tenantId: string,
    id: string,
  ): Promise<Record<string, unknown>> {
    return this.toPublicEmailAccount(
      await this.requireAccountEntity(tenantId, id),
    );
  }

  async assertAccountInTenant(tenantId: string, id: string): Promise<void> {
    await this.requireAccountEntity(tenantId, id);
  }

  async patchAccountIngestion(
    tenantId: string,
    accountId: string,
    body: { autoCreateFromUnknown?: boolean; skipDomains?: string[] },
  ): Promise<Record<string, unknown>> {
    const account = await this.requireAccountEntity(tenantId, accountId);
    const meta =
      account.meta && typeof account.meta === 'object' && !Array.isArray(account.meta)
        ? { ...(account.meta as Record<string, unknown>) }
        : {};
    const cur = (meta.leadIngestion as Record<string, unknown>) || {};
    if (body.autoCreateFromUnknown !== undefined) {
      cur.autoCreateFromUnknown = body.autoCreateFromUnknown;
    }
    if (body.skipDomains !== undefined) {
      cur.skipDomains = body.skipDomains.map((s) => String(s).toLowerCase().trim());
    }
    meta.leadIngestion = cur;
    account.meta = meta;
    await this.accountRepo.save(account);
    return this.toPublicEmailAccount(account);
  }

  async findOneMessage(
    tenantId: string,
    messageId: string,
  ): Promise<EmailMessage> {
    const m = await this.messageRepo.findOne({
      where: { id: messageId, tenantId },
    });
    if (!m) throw new NotFoundException('Message not found');
    return m;
  }

  async patchMessage(
    tenantId: string,
    messageId: string,
    patch: {
      isRead?: boolean;
      isStarred?: boolean;
      leadId?: string | null;
      crmFolderId?: string | null;
    },
  ): Promise<EmailMessage> {
    const m = await this.findOneMessage(tenantId, messageId);
    if (patch.isRead !== undefined) m.isRead = patch.isRead;
    if (patch.isStarred !== undefined) m.isStarred = patch.isStarred;
    if (patch.leadId !== undefined) m.leadId = patch.leadId;
    if (patch.crmFolderId !== undefined) m.crmFolderId = patch.crmFolderId;
    return this.messageRepo.save(m);
  }

  async deleteMessage(tenantId: string, messageId: string): Promise<void> {
    const m = await this.messageRepo.findOne({
      where: { id: messageId, tenantId },
    });
    if (!m) throw new NotFoundException('Message not found');
    await this.messageRepo.remove(m);
  }

  /**
   * Создать email аккаунт
   */
  async createAccount(
    tenantId: string,
    dto: CreateEmailAccountDto,
  ): Promise<Record<string, unknown>> {
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

    const saved = await this.accountRepo.save(account);
    await this.emailFolders.ensureSystemFolders(tenantId, saved.id);
    return this.toPublicEmailAccount(saved);
  }

  async patchAccountSignature(
    tenantId: string,
    accountId: string,
    body: { signatureHtml?: string | null; signatureText?: string | null },
  ): Promise<Record<string, unknown>> {
    const account = await this.requireAccountEntity(tenantId, accountId);
    const meta =
      account.meta && typeof account.meta === 'object' && !Array.isArray(account.meta)
        ? { ...(account.meta as Record<string, unknown>) }
        : {};
    if (body.signatureHtml !== undefined) meta.signatureHtml = body.signatureHtml;
    if (body.signatureText !== undefined) meta.signatureText = body.signatureText;
    account.meta = meta;
    await this.accountRepo.save(account);
    return this.toPublicEmailAccount(account);
  }

  /**
   * Обновить email аккаунт
   */
  async updateAccount(
    tenantId: string,
    id: string,
    dto: UpdateEmailAccountDto,
  ): Promise<Record<string, unknown>> {
    const account = await this.requireAccountEntity(tenantId, id);

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

    const saved = await this.accountRepo.save(account);
    return this.toPublicEmailAccount(saved);
  }

  /**
   * Удалить email аккаунт
   */
  async deleteAccount(tenantId: string, id: string): Promise<void> {
    const account = await this.requireAccountEntity(tenantId, id);
    await this.accountRepo.remove(account);
  }

  /**
   * Тест подключения к SMTP
   * Использует быструю проверку с короткими таймаутами
   */
  async testSmtpConnection(tenantId: string, id: string): Promise<boolean> {
    const account = await this.requireAccountEntity(tenantId, id);

    if (account.oauthRefreshToken && account.oauthProvider) {
      try {
        await this.emailOAuth.ensureAccessToken(account);
        account.status = 'active';
        account.lastError = null;
        await this.accountRepo.save(account);
        return true;
      } catch (e: any) {
        account.status = 'error';
        account.lastError = e?.message || 'oauth_failed';
        await this.accountRepo.save(account);
        throw new BadRequestException(
          e?.message || 'OAuth mailbox connection failed',
        );
      }
    }

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
    const account = await this.requireAccountEntity(tenantId, dto.accountId);

    let finalSubject = dto.subject;
    let finalTextBody = dto.textBody;
    let finalHtmlBody = dto.htmlBody;

    if (dto.templateId) {
      const templateData: Record<string, any> = triggerData || {};
      if (!templateData.lead && dto.leadId) templateData.lead = { id: dto.leadId };
      if (!templateData.contact && dto.contactId) templateData.contact = { id: dto.contactId };
      if (!templateData.company && dto.companyId) templateData.company = { id: dto.companyId };
      if (!templateData.sale && dto.saleId) templateData.sale = { id: dto.saleId };

      try {
        const templateResult = await this.applyTemplate(tenantId, dto.templateId, templateData);
        if (!finalSubject && templateResult.subject) finalSubject = templateResult.subject;
        if (!finalTextBody && templateResult.textBody) finalTextBody = templateResult.textBody;
        if (!finalHtmlBody && templateResult.htmlBody) finalHtmlBody = templateResult.htmlBody;
      } catch (error) {
        console.error('Failed to apply template:', error);
      }
    }

    const sigBodies = this.mergeSignatureIntoBodies(
      account,
      finalTextBody,
      finalHtmlBody,
    );
    finalTextBody = sigBodies.text;
    finalHtmlBody = sigBodies.html;

    const attachments = (dto as any).attachments as
      | Array<{
          filename: string;
          contentType: string;
          contentBase64?: string;
          content?: Buffer;
        }>
      | undefined;

    try {
      if (account.oauthProvider === 'gmail' && account.oauthRefreshToken) {
        return await this.sendEmailViaGmail(
          tenantId,
          account,
          dto,
          finalSubject,
          finalTextBody,
          finalHtmlBody,
          attachments,
        );
      }
      if (account.oauthProvider === 'outlook' && account.oauthRefreshToken) {
        return await this.sendEmailViaOutlook(
          tenantId,
          account,
          dto,
          finalSubject,
          finalTextBody,
          finalHtmlBody,
          attachments,
        );
      }

      if (!account.smtpHost || !account.smtpPort) {
        throw new BadRequestException(
          'Настройте SMTP или подключите почту через Gmail / Microsoft (OAuth).',
        );
      }

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

      const sentFolderId = await this.emailFolders.getFolderIdForSystemKey(
        tenantId,
        account.id,
        'sent',
      );

      // Сохраняем отправленное письмо
      const message = this.messageRepo.create({
        tenantId,
        accountId: account.id,
        messageId: info.messageId || `outgoing-${Date.now()}-${Math.random()}`,
        direction: 'outgoing',
        crmFolderId: sentFolderId,
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
      folderId?: string;
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

    if (options?.folderId) {
      if (!options.accountId) {
        throw new BadRequestException(
          'accountId is required when filtering by folder',
        );
      }
      const folder = await this.emailFolders.findFolder(
        tenantId,
        options.folderId,
      );
      if (!folder || folder.accountId !== options.accountId) {
        throw new BadRequestException('Invalid folder for this mailbox');
      }
      if (folder.systemKey === 'inbox') {
        qb.andWhere(
          new Brackets((q) => {
            q.where('message.crmFolderId = :inboxFid', {
              inboxFid: folder.id,
            }).orWhere(
              new Brackets((q2) => {
                q2
                  .where('message.crmFolderId IS NULL')
                  .andWhere('message.direction = :din', { din: 'incoming' });
              }),
            );
          }),
        );
      } else if (folder.systemKey === 'sent') {
        qb.andWhere(
          new Brackets((q) => {
            q.where('message.crmFolderId = :sentFid', {
              sentFid: folder.id,
            }).orWhere(
              new Brackets((q2) => {
                q2
                  .where('message.crmFolderId IS NULL')
                  .andWhere('message.direction = :dout', { dout: 'outgoing' });
              }),
            );
          }),
        );
      } else {
        qb.andWhere('message.crmFolderId = :cfolder', { cfolder: folder.id });
      }
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

    let result = template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, key) => {
      const keys = key.split('.');
      let value: any = data;

      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return match;
        }
      }

      return value != null ? String(value) : match;
    });

    // Простые плейсхолдеры {name}, {email} — плоские ключи верхнего уровня
    result = result.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (match, key) => {
      const v = data[key];
      if (v != null && typeof v !== 'object') {
        return String(v);
      }
      return match;
    });

    return result;
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

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private stripHtmlTags(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Простой текст → безопасные абзацы для вставки в HTML-обёртку */
  private plainTextToEmailParagraphs(text: string): string {
    const t = text.trim();
    if (!t) return '';
    return t
      .split(/\n\n+/)
      .filter(Boolean)
      .map(
        (p) =>
          `<p style="margin:0 0 14px;line-height:1.65;color:#334155;font-size:15px;">${this.escapeHtml(p).replace(/\n/g, '<br/>')}</p>`,
      )
      .join('');
  }

  /**
   * Встроенная обёртка (тот же визуальный язык, что у письма подтверждения регистрации).
   */
  private buildDefaultTransactionWrapperHtml(params: {
    tenantName: string;
    headline: string;
    innerHtml: string;
  }): string {
    const { tenantName, headline, innerHtml } = params;
    const safeName = this.escapeHtml(tenantName);
    const safeHeadline = this.escapeHtml(headline);
    const year = new Date().getFullYear();
    return `<!DOCTYPE html>
<html lang="ru">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 10px;background:linear-gradient(180deg,#f8fafc 0%,#e2e8f0 100%);">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:26px;overflow:hidden;box-shadow:0 20px 60px rgba(15,23,42,0.18);">
            <tr>
              <td style="padding:0;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:radial-gradient(circle at top left,#22d3ee 0%,#0f172a 60%,#020617 100%);">
                  <tr>
                    <td style="padding:34px 28px 26px;">
                      <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.28);font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#e2e8f0;">
                        ${safeName}
                      </div>
                      <div style="font-size:24px;line-height:1.2;font-weight:700;color:#ffffff;padding-top:14px;">
                        ${safeHeadline}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 22px 28px;background:#ffffff;">
                <div style="border:1px solid #e2e8f0;border-radius:20px;background:linear-gradient(135deg,#ffffff 0%,#f8fafc 100%);padding:22px 20px;">
                  ${innerHtml}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 26px 28px;">
                <div style="font-size:12px;line-height:1.7;color:#64748b;">
                  Это письмо отправлено из вашей CRM. Если вы получили его по ошибке, проигнорируйте.
                </div>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;">
            <tr>
              <td align="center" style="padding-top:14px;font-size:11px;color:#64748b;">
                © ${year} ${safeName}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  /**
   * Данные для {{name}}, {{lead.name}}, … в теме и в шаблоне-обёртке.
   */
  async mergeMailInterpolationData(
    tenantId: string,
    opts: {
      variables?: Record<string, any> | null;
      contactId?: string;
      leadId?: string;
      companyId?: string;
      saleId?: string;
    },
  ): Promise<Record<string, any>> {
    const data: Record<string, any> = {
      ...(opts.variables &&
      typeof opts.variables === 'object' &&
      !Array.isArray(opts.variables)
        ? opts.variables
        : {}),
    };

    if (opts.leadId) {
      const lead = await this.leadRepo.findOne({
        where: { id: opts.leadId, tenantId },
      });
      if (lead) {
        data.lead = {
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          status: lead.status,
        };
        if (data.name == null || data.name === '') data.name = lead.name || '';
        if (data.email == null || data.email === '') data.email = lead.email || '';
      }
    }

    if (opts.contactId) {
      const c = await this.contactRepo.findOne({
        where: { id: opts.contactId, tenantId },
      });
      if (c) {
        data.contact = {
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
        };
        const full = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
        if (data.name == null || data.name === '') data.name = full;
        if (data.email == null || data.email === '') data.email = c.email || '';
      }
    }

    if (opts.companyId) {
      const company = await this.companyRepo.findOne({
        where: { id: opts.companyId, tenantId },
      });
      if (company) {
        data.company = { id: company.id, name: company.name };
        if (data.companyName == null || data.companyName === '') {
          data.companyName = company.name || '';
        }
      }
    }

    if (opts.saleId) {
      const sale = await this.saleRepo.findOne({
        where: { id: opts.saleId, tenantId },
      });
      if (sale) {
        data.sale = {
          id: sale.id,
          amount: sale.amount,
          status: sale.status,
        };
      }
    }

    return data;
  }

  /**
   * Тема + HTML/текст письма: единая обёртка (шаблон компании или встроенная).
   * В шаблоне обёртки используйте {{contentHtml}}, {{contentText}}, {{headline}}, {{tenantName}}, {{companyName}}.
   */
  async composeStyledTransactionalMail(
    tenantId: string,
    input: {
      subject: string;
      bodyText?: string;
      bodyHtml?: string;
      headline?: string;
      contactId?: string;
      leadId?: string;
      companyId?: string;
      saleId?: string;
      variables?: Record<string, any> | null;
    },
  ): Promise<{ subject: string; htmlBody: string; textBody: string }> {
    const rawText = (input.bodyText || '').trim();
    const rawHtml = (input.bodyHtml || '').trim();
    if (!rawText && !rawHtml) {
      throw new BadRequestException('bodyText or bodyHtml is required');
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const merged = await this.mergeMailInterpolationData(tenantId, {
      variables: input.variables,
      contactId: input.contactId,
      leadId: input.leadId,
      companyId: input.companyId,
      saleId: input.saleId,
    });

    const innerHtml = rawHtml || this.plainTextToEmailParagraphs(rawText);
    const innerText =
      rawText || this.stripHtmlTags(innerHtml).slice(0, 100_000) || '';
    const headline = (input.headline || 'Сообщение').trim() || 'Сообщение';

    const baseData: Record<string, any> = {
      ...merged,
      contentHtml: innerHtml,
      contentText: innerText,
      headline,
      tenantName: tenant.name,
      companyName: tenant.name,
    };

    const subjectOut = this.interpolateTemplate(
      (input.subject || '').trim() || '(No subject)',
      baseData,
    );

    let htmlBody: string;
    let textBody: string;

    if (tenant.aiWrapperEmailTemplateId) {
      try {
        const tpl = await this.findTemplate(
          tenantId,
          tenant.aiWrapperEmailTemplateId,
        );
        htmlBody = tpl.htmlBody
          ? this.interpolateTemplate(tpl.htmlBody, baseData)
          : this.buildDefaultTransactionWrapperHtml({
              tenantName: tenant.name,
              headline,
              innerHtml,
            });
        textBody = tpl.textBody
          ? this.interpolateTemplate(tpl.textBody, baseData)
          : `${headline}\n\n${innerText}`;
      } catch {
        htmlBody = this.buildDefaultTransactionWrapperHtml({
          tenantName: tenant.name,
          headline,
          innerHtml,
        });
        textBody = `${headline}\n\n${innerText}`;
      }
    } else {
      htmlBody = this.buildDefaultTransactionWrapperHtml({
        tenantName: tenant.name,
        headline,
        innerHtml,
      });
      textBody = `${headline}\n\n${innerText}`;
    }

    return { subject: subjectOut, htmlBody, textBody };
  }

  async previewStyledMail(
    tenantId: string,
    dto: PreviewStyledMailDto,
  ): Promise<{ subject: string; htmlBody: string; textBody: string }> {
    return this.composeStyledTransactionalMail(tenantId, {
      subject: dto.subject,
      bodyText: dto.bodyText,
      bodyHtml: dto.bodyHtml,
      headline: dto.headline,
      contactId: dto.contactId,
      leadId: dto.leadId,
      companyId: dto.companyId,
      saleId: dto.saleId,
      variables: dto.variables,
    });
  }

  async sendStyledTransactionalMail(
    tenantId: string,
    dto: SendStyledEmailDto,
  ): Promise<EmailMessage> {
    const { subject, htmlBody, textBody } =
      await this.composeStyledTransactionalMail(tenantId, {
        subject: dto.subject,
        bodyText: dto.bodyText,
        bodyHtml: dto.bodyHtml,
        headline: dto.headline,
        contactId: dto.contactId,
        leadId: dto.leadId,
        companyId: dto.companyId,
        saleId: dto.saleId,
        variables: dto.variables,
      });

    return this.sendEmail(
      tenantId,
      {
        accountId: dto.accountId,
        to: dto.to,
        subject,
        htmlBody,
        textBody,
        contactId: dto.contactId,
        leadId: dto.leadId,
        companyId: dto.companyId,
        saleId: dto.saleId,
      },
      await this.mergeMailInterpolationData(tenantId, {
        variables: dto.variables,
        contactId: dto.contactId,
        leadId: dto.leadId,
        companyId: dto.companyId,
        saleId: dto.saleId,
      }),
    );
  }

  private mergeSignatureIntoBodies(
    account: EmailAccount,
    text?: string | null,
    html?: string | null,
  ): { text?: string; html?: string } {
    const meta = account.meta as Record<string, any> | null;
    const sigHtml = (meta?.signatureHtml as string | undefined)?.trim();
    const sigText = (meta?.signatureText as string | undefined)?.trim();
    if (!sigHtml && !sigText) {
      return {
        text: text ?? undefined,
        html: html ?? undefined,
      };
    }
    const plainFromHtml = (s: string) =>
      s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const textPart = sigText || (sigHtml ? plainFromHtml(sigHtml) : '');
    const htmlSig =
      sigHtml ||
      (sigText
        ? `<p>${sigText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`
        : '');
    return {
      text: text ? `${text}\n\n${textPart}` : textPart || text || undefined,
      html: html ? `${html}<br><br>${htmlSig}` : htmlSig || html || undefined,
    };
  }

  private async compileOutboundMime(
    account: EmailAccount,
    dto: SendEmailDto,
    finalSubject: string | undefined,
    finalTextBody: string | null | undefined,
    finalHtmlBody: string | null | undefined,
    attachments:
      | Array<{
          filename: string;
          contentType: string;
          contentBase64?: string;
          content?: Buffer;
        }>
      | undefined,
  ): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const MailComposer = require('nodemailer/lib/mail-composer');
    const fromAddr = account.name
      ? `${account.name.replace(/"/g, '')} <${account.email}>`
      : account.email;
    const att =
      attachments?.map((file) => ({
        filename: file.filename,
        contentType: file.contentType,
        content: file.content
          ? file.content
          : file.contentBase64
            ? Buffer.from(file.contentBase64, 'base64')
            : undefined,
      })) || undefined;
    const mail = new MailComposer({
      from: fromAddr,
      to: dto.to,
      cc: dto.cc,
      bcc: dto.bcc,
      subject: finalSubject || '(No subject)',
      text: finalTextBody || undefined,
      html: finalHtmlBody || undefined,
      attachments: att,
    });
    return new Promise((resolve, reject) => {
      mail.compile().build((err: Error, buf: Buffer) => {
        if (err) reject(err);
        else resolve(buf.toString('utf8'));
      });
    });
  }

  private async persistOutgoingSnapshot(
    tenantId: string,
    account: EmailAccount,
    dto: SendEmailDto,
    finalSubject: string | undefined,
    finalTextBody: string | null | undefined,
    finalHtmlBody: string | null | undefined,
    attachments:
      | Array<{
          filename: string;
          contentType: string;
          contentBase64?: string;
          content?: Buffer;
        }>
      | undefined,
    messageId: string,
  ): Promise<EmailMessage> {
    const sentFolderId = await this.emailFolders.getFolderIdForSystemKey(
      tenantId,
      account.id,
      'sent',
    );
    const message = this.messageRepo.create({
      tenantId,
      accountId: account.id,
      messageId,
      direction: 'outgoing',
      crmFolderId: sentFolderId,
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
      meta: { sendChannel: account.oauthProvider || 'smtp' },
    });
    const saved = await this.messageRepo.save(message);
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
    } catch {
      /* ignore */
    }
    return saved;
  }

  private async sendEmailViaGmail(
    tenantId: string,
    account: EmailAccount,
    dto: SendEmailDto,
    finalSubject: string | undefined,
    finalTextBody: string | null | undefined,
    finalHtmlBody: string | null | undefined,
    attachments:
      | Array<{
          filename: string;
          contentType: string;
          contentBase64?: string;
          content?: Buffer;
        }>
      | undefined,
  ): Promise<EmailMessage> {
    const token = await this.emailOAuth.ensureAccessToken(account);
    const rfc822 = await this.compileOutboundMime(
      account,
      dto,
      finalSubject,
      finalTextBody,
      finalHtmlBody,
      attachments,
    );
    const raw = Buffer.from(rfc822, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const res = await axios.post<{ id?: string }>(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      { raw },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const mid = res.data?.id
      ? `gmail-sent:${account.id}:${res.data.id}`
      : `gmail-sent:${account.id}:${Date.now()}`;
    return this.persistOutgoingSnapshot(
      tenantId,
      account,
      dto,
      finalSubject,
      finalTextBody,
      finalHtmlBody,
      attachments,
      mid,
    );
  }

  private async sendEmailViaOutlook(
    tenantId: string,
    account: EmailAccount,
    dto: SendEmailDto,
    finalSubject: string | undefined,
    finalTextBody: string | null | undefined,
    finalHtmlBody: string | null | undefined,
    attachments:
      | Array<{
          filename: string;
          contentType: string;
          contentBase64?: string;
          content?: Buffer;
        }>
      | undefined,
  ): Promise<EmailMessage> {
    const token = await this.emailOAuth.ensureAccessToken(account);
    const graphAtt =
      attachments?.map((a) => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: a.filename,
        contentType: a.contentType || 'application/octet-stream',
        contentBytes: a.contentBase64
          ? a.contentBase64
          : a.content
            ? a.content.toString('base64')
            : '',
      })) || [];
    await axios.post(
      'https://graph.microsoft.com/v1.0/me/sendMail',
      {
        message: {
          subject: finalSubject || '(No subject)',
          body: {
            contentType: finalHtmlBody ? 'HTML' : 'Text',
            content: finalHtmlBody || finalTextBody || '',
          },
          toRecipients: (dto.to || []).map((address) => ({
            emailAddress: { address },
          })),
          ccRecipients: (dto.cc || []).map((address) => ({
            emailAddress: { address },
          })),
          bccRecipients: (dto.bcc || []).map((address) => ({
            emailAddress: { address },
          })),
          attachments: graphAtt.length ? graphAtt : undefined,
        },
        saveToSentItems: true,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const mid = `outlook-sent:${account.id}:${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    return this.persistOutgoingSnapshot(
      tenantId,
      account,
      dto,
      finalSubject,
      finalTextBody,
      finalHtmlBody,
      attachments,
      mid,
    );
  }
}
