import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DemoRequest } from './demo-request.entity';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { TenantsService } from '../tenants/tenants.service';

@Injectable()
export class DemoRequestsService implements OnModuleInit {
  private readonly logger = new Logger(DemoRequestsService.name);

  constructor(
    @InjectRepository(DemoRequest)
    private readonly repo: Repository<DemoRequest>,
    private readonly platformSettings: PlatformSettingsService,
    private readonly tenants: TenantsService,
    private readonly ds: DataSource,
  ) {}

  // synchronize выключен — колонки формы /contact добавляем идемпотентно при старте.
  async onModuleInit(): Promise<void> {
    await this.ds.query(`
      ALTER TABLE "demo_requests"
        ADD COLUMN IF NOT EXISTS "topic" varchar(32),
        ADD COLUMN IF NOT EXISTS "company" varchar(200),
        ADD COLUMN IF NOT EXISTS "teamSize" varchar(32),
        ADD COLUMN IF NOT EXISTS "message" text
    `);
  }

  async create(data: {
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
    email: string;
    phone?: string | null;
    ordersPerMonth?: string | null;
    contactMethod?: string | null;
    topic?: string | null;
    company?: string | null;
    teamSize?: string | null;
    message?: string | null;
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

    // Форма /contact шлёт одно поле name, лендинг — firstName/lastName.
    const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    let firstName = str(data.firstName, 120);
    let lastName = str(data.lastName, 120);
    if (!firstName && !lastName) {
      const parts = str(data.name, 240).split(/\s+/).filter(Boolean);
      firstName = (parts.shift() || '').slice(0, 120);
      lastName = parts.join(' ').slice(0, 120);
    }
    const email = str(data.email, 180).toLowerCase();
    if (!firstName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('name and valid email are required');
    }

    const entity = this.repo.create({
      firstName,
      lastName,
      email,
      phone: str(data.phone, 40) || null,
      ordersPerMonth: str(data.ordersPerMonth, 64) || null,
      contactMethod: str(data.contactMethod, 32) || 'email',
      topic: str(data.topic, 32) || null,
      company: str(data.company, 200) || null,
      teamSize: str(data.teamSize, 32) || null,
      message: str(data.message, 4000) || null,
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
    if (isBot) return saved;
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

    const topicMap: Record<string, string> = {
      demo: 'Демо',
      pricing: 'Тарифы',
      integration: 'Интеграция',
      support: 'Поддержка',
    };

    const text = [
      req.topic ? `🟣 Заявка с сайта · ${topicMap[req.topic] || req.topic}` : '🟣 Новый запрос на демо',
      `Имя: ${req.firstName} ${req.lastName}`,
      `Почта: ${req.email}`,
      `Телефон: ${req.phone || '—'}`,
      req.company ? `Компания: ${req.company}` : null,
      req.teamSize ? `Команда: ${req.teamSize}` : null,
      req.ordersPerMonth ? `Заказов/мес: ${req.ordersPerMonth}` : null,
      `Связь: ${contactMap[req.contactMethod] || req.contactMethod}`,
      utmParts.length ? `UTM: ${utmParts.join(' | ')}` : null,
      req.message ? `Сообщение: ${req.message.slice(0, 1500)}` : null,
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
