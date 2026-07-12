import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as crypto from 'crypto';
import { ProductWebhook, type ProductWebhookEvent } from './product-webhook.entity';

const ALL_EVENTS: ProductWebhookEvent[] = [
  'product.created',
  'product.updated',
  'product.deleted',
  'product.stock_changed',
  'product.published',
];

/**
 * Исходящие вебхуки товаров — «CRM → внешний сайт» push вместо периодического опроса
 * `/public/catalog` (см. lumiva_products_module_roadmap.md §15). По образцу существующих
 * исходящих интеграций (`TeamsWebhookService`/`SlackWebhookService`): прямой `axios.post` с
 * таймаутом, без очереди — на объёме одного тенанта этого достаточно, а очередь (BullMQ) можно
 * добавить отдельно, если понадобятся ретраи при недоступности сайта.
 */
@Injectable()
export class ProductWebhooksService {
  private readonly log = new Logger(ProductWebhooksService.name);

  constructor(
    @InjectRepository(ProductWebhook)
    private readonly repo: Repository<ProductWebhook>,
  ) {}

  private generateSecret(): string {
    return crypto.randomBytes(24).toString('hex');
  }

  async list(tenantId: string) {
    return this.repo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async create(
    tenantId: string,
    dto: { name: string; url: string; events: string[]; siteId?: string | null; isActive?: boolean },
  ) {
    const name = (dto.name || '').trim().slice(0, 255);
    if (!name) throw new BadRequestException('Название вебхука обязательно');
    const url = (dto.url || '').trim();
    if (!/^https:\/\//.test(url)) throw new BadRequestException('URL вебхука должен начинаться с https://');
    const events = (Array.isArray(dto.events) ? dto.events : []).filter((e): e is ProductWebhookEvent =>
      ALL_EVENTS.includes(e as ProductWebhookEvent),
    );
    if (!events.length) throw new BadRequestException('Нужно выбрать хотя бы одно событие');
    const webhook = this.repo.create({
      tenantId,
      siteId: dto.siteId || null,
      name,
      url,
      events,
      secret: this.generateSecret(),
      isActive: dto.isActive !== false,
    });
    return this.repo.save(webhook);
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<{ name: string; url: string; events: string[]; siteId: string | null; isActive: boolean }>,
  ) {
    const webhook = await this.repo.findOne({ where: { tenantId, id } });
    if (!webhook) throw new NotFoundException('Вебхук не найден');
    if (dto.name !== undefined) webhook.name = dto.name.trim().slice(0, 255);
    if (dto.url !== undefined) {
      if (!/^https:\/\//.test(dto.url.trim())) {
        throw new BadRequestException('URL вебхука должен начинаться с https://');
      }
      webhook.url = dto.url.trim();
    }
    if (dto.events !== undefined) {
      const events = dto.events.filter((e): e is ProductWebhookEvent => ALL_EVENTS.includes(e as ProductWebhookEvent));
      if (!events.length) throw new BadRequestException('Нужно выбрать хотя бы одно событие');
      webhook.events = events;
    }
    if (dto.siteId !== undefined) webhook.siteId = dto.siteId || null;
    if (dto.isActive !== undefined) webhook.isActive = dto.isActive;
    return this.repo.save(webhook);
  }

  async regenerateSecret(tenantId: string, id: string) {
    const webhook = await this.repo.findOne({ where: { tenantId, id } });
    if (!webhook) throw new NotFoundException('Вебхук не найден');
    webhook.secret = this.generateSecret();
    return this.repo.save(webhook);
  }

  async remove(tenantId: string, id: string) {
    const webhook = await this.repo.findOne({ where: { tenantId, id } });
    if (!webhook) throw new NotFoundException('Вебхук не найден');
    await this.repo.remove(webhook);
    return { ok: true };
  }

  /**
   * Рассылает событие всем активным вебхукам тенанта, подписанным на него (и на этот сайт, если
   * указан). Fire-and-forget с точки зрения вызывающего кода — ошибки логируются и пишутся на
   * сам вебхук (`lastError`/`lastStatusCode`), но не пробрасываются наружу, чтобы недоступный
   * внешний сайт не ронял операцию над товаром.
   */
  async dispatch(
    tenantId: string,
    event: ProductWebhookEvent,
    payload: Record<string, unknown>,
    siteId?: string | null,
  ): Promise<void> {
    const webhooks = await this.repo.find({ where: { tenantId, isActive: true } });
    const targets = webhooks.filter(
      (w) => w.events.includes(event) && (!w.siteId || !siteId || w.siteId === siteId),
    );
    await Promise.all(targets.map((w) => this.send(w, event, payload)));
  }

  private async send(webhook: ProductWebhook, event: ProductWebhookEvent, payload: Record<string, unknown>) {
    const body = JSON.stringify({ event, data: payload, sentAt: new Date().toISOString() });
    const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');
    try {
      const res = await axios.post(webhook.url, body, {
        headers: {
          'Content-Type': 'application/json',
          'X-Lumiva-Event': event,
          'X-Lumiva-Signature': signature,
        },
        timeout: 10000,
        validateStatus: () => true,
      });
      webhook.lastTriggeredAt = new Date();
      webhook.lastStatusCode = res.status;
      webhook.lastError = res.status >= 200 && res.status < 300 ? null : `HTTP ${res.status}`;
    } catch (err: any) {
      webhook.lastTriggeredAt = new Date();
      webhook.lastStatusCode = null;
      webhook.lastError = err?.message || 'Network error';
      this.log.warn(`Webhook ${webhook.id} (${webhook.url}) failed: ${webhook.lastError}`);
    }
    await this.repo.save(webhook).catch(() => {});
  }
}
