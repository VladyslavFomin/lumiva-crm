import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DemoRequest } from './demo-request.entity';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { TenantsService } from '../tenants/tenants.service';

@Injectable()
export class DemoRequestsService {
  private readonly logger = new Logger(DemoRequestsService.name);

  constructor(
    @InjectRepository(DemoRequest)
    private readonly repo: Repository<DemoRequest>,
    private readonly platformSettings: PlatformSettingsService,
    private readonly tenants: TenantsService,
  ) {}

  async create(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    ordersPerMonth?: string | null;
    contactMethod: string;
    botField?: string | null;
    utm?: any;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    utmContent?: string | null;
    utmTerm?: string | null;
  }) {
    const isBot = Boolean(data.botField && data.botField.trim());
    const utm = data.utm || {};
    const utmSource =
      data.utmSource ?? utm.utmSource ?? utm.utm_source ?? null;
    const utmMedium =
      data.utmMedium ?? utm.utmMedium ?? utm.utm_medium ?? null;
    const utmCampaign =
      data.utmCampaign ?? utm.utmCampaign ?? utm.utm_campaign ?? null;
    const utmContent =
      data.utmContent ?? utm.utmContent ?? utm.utm_content ?? null;
    const utmTerm =
      data.utmTerm ?? utm.utmTerm ?? utm.utm_term ?? null;

    const entity = this.repo.create({
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone?.trim() || null,
      ordersPerMonth: data.ordersPerMonth?.trim() || null,
      contactMethod: data.contactMethod?.trim() || 'unknown',
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      status: isBot ? 'spam' : 'new',
      tenantId: null,
      provisionedAt: null,
    });

    const saved = await this.repo.save(entity);
    this.notifyTelegram(saved).catch((err) => {
      this.logger.warn(
        `Failed to notify Telegram for demo request ${saved.id}: ${String(err)}`,
      );
    });
    return saved;
  }

  async listAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async updateStatus(id: string, status: string) {
    const req = await this.repo.findOne({ where: { id } });
    if (!req) {
      throw new NotFoundException('Demo request not found');
    }
    req.status = status;
    return this.repo.save(req);
  }

  async markTelegramMeta(
    id: string,
    meta: { chatId?: string | null; messageId?: number | null; userId?: string | null },
  ) {
    const req = await this.repo.findOne({ where: { id } });
    if (!req) return;
    if (meta.chatId !== undefined) req.telegramChatId = meta.chatId;
    if (meta.messageId !== undefined) req.telegramMessageId = meta.messageId;
    if (meta.userId !== undefined) req.telegramUserId = meta.userId;
    await this.repo.save(req);
  }

  async startTenantProvisionFlow(
    id: string,
    meta: { chatId: string; userId: string },
  ) {
    const req = await this.repo.findOne({ where: { id } });
    if (!req) {
      throw new NotFoundException('Demo request not found');
    }
    req.status = 'awaiting_tenant_id';
    req.telegramChatId = meta.chatId;
    req.telegramUserId = meta.userId;
    await this.repo.save(req);
    return req;
  }

  async findPendingByChat(chatId: string, userId?: string | null) {
    const qb = this.repo
      .createQueryBuilder('req')
      .where('req.status = :status', { status: 'awaiting_tenant_id' })
      .andWhere('req.telegramChatId = :chatId', { chatId })
      .orderBy('req.createdAt', 'DESC');
    if (userId) {
      qb.andWhere('req.telegramUserId = :userId', { userId });
    }
    return qb.getOne();
  }

  async provisionTenantForRequest(req: DemoRequest, clientKey: string) {
    const tenantName = `${req.firstName} ${req.lastName}`.trim() || req.email;
    const notesParts = [
      `Provisioned via Telegram for demo request ${req.id}.`,
      `Contact: ${req.contactMethod}.`,
      `Orders/month: ${req.ordersPerMonth || 'n/a'}.`,
      `Phone: ${req.phone || '-'}.`,
    ];

    const tenant = await this.tenants.platformCreateTenant({
      name: tenantName,
      ownerEmail: req.email,
      ownerFullName: tenantName,
      clientKey,
      notes: notesParts.join(' '),
    });

    req.status = 'tenant_created';
    req.tenantId = tenant.id;
    req.provisionedAt = new Date();
    await this.repo.save(req);
    return tenant;
  }

  private async notifyTelegram(req: DemoRequest) {
    const { token, chatId } = await this.platformSettings.getTelegramConfig();
    if (!token || !chatId) return;

    const contactMap: Record<string, string> = {
      email: 'E-mail',
      phone: 'Телефон',
      whatsapp: 'WhatsApp',
      telegram: 'Telegram',
    };

    const utmParts = [
      req.utmSource ? `utm_source=${req.utmSource}` : null,
      req.utmMedium ? `utm_medium=${req.utmMedium}` : null,
      req.utmCampaign ? `utm_campaign=${req.utmCampaign}` : null,
      req.utmContent ? `utm_content=${req.utmContent}` : null,
      req.utmTerm ? `utm_term=${req.utmTerm}` : null,
    ].filter(Boolean);

    const text = [
      '🟣 Новый запрос на демо',
      `Имя: ${req.firstName} ${req.lastName}`,
      `Почта: ${req.email}`,
      `Телефон: ${req.phone || '—'}`,
      `Заказов/мес: ${req.ordersPerMonth || '—'}`,
      `Связь: ${contactMap[req.contactMethod] || req.contactMethod}`,
      utmParts.length ? `UTM: ${utmParts.join(' | ')}` : null,
      `Статус: ${req.status}`,
    ]
      .filter(Boolean)
      .join('\n');

    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: 'Создать тенант',
            callback_data: `create_tenant:${req.id}`,
          },
        ],
      ],
    };

    const result = await this.platformSettings.sendTelegramMessage(text, {
      replyMarkup,
    });

    if (result.ok && result.messageId) {
      await this.markTelegramMeta(req.id, {
        chatId,
        messageId: result.messageId,
      });
    }
  }
}
