import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import axios from 'axios';
import * as crypto from 'crypto';
import { ProductWebhook, type ProductWebhookEvent } from './product-webhook.entity';
import { ProductWebhookDelivery } from './product-webhook-delivery.entity';

const ALL_EVENTS: ProductWebhookEvent[] = [
  'product.created',
  'product.updated',
  'product.deleted',
  'product.stock_changed',
  'product.published',
];

/** Задержка перед N-й попыткой (минуты), считая от момента провала предыдущей. */
const RETRY_DELAYS_MIN = [1, 5, 30, 180];
const MAX_ATTEMPTS = RETRY_DELAYS_MIN.length + 1; // 1 немедленная + 4 ретрая

/**
 * Исходящие вебхуки товаров — «CRM → внешний сайт» push вместо периодического опроса
 * `/public/catalog` (см. lumiva_products_module_roadmap.md §15/§16). Первая попытка — прямой
 * `axios.post` синхронно с событием (без задержки на happy path, как и раньше). Если сайт
 * недоступен — попытка логируется в `product_webhook_deliveries` и ретраится по расписанию
 * (`retryPendingDeliveries`, `@Cron`) с бэкоффом, вместо мгновенного отказа без следа. Без
 * очереди (BullMQ/Redis не гарантированно доступны в этом деплое — см. .env) — состояние живёт
 * в БД, ретрай-свип работает in-process, по тому же паттерну, что уже используется в проекте
 * (`LeadsMeetingsReminderService` и другие `@Cron`-сервисы).
 */
@Injectable()
export class ProductWebhooksService {
  private readonly log = new Logger(ProductWebhooksService.name);

  constructor(
    @InjectRepository(ProductWebhook)
    private readonly repo: Repository<ProductWebhook>,
    @InjectRepository(ProductWebhookDelivery)
    private readonly deliveries: Repository<ProductWebhookDelivery>,
  ) {}

  private generateSecret(): string {
    return crypto.randomBytes(24).toString('hex');
  }

  async list(tenantId: string) {
    return this.repo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async listDeliveries(tenantId: string, webhookId: string) {
    const webhook = await this.repo.findOne({ where: { tenantId, id: webhookId } });
    if (!webhook) throw new NotFoundException('Вебхук не найден');
    return this.deliveries.find({
      where: { tenantId, webhookId },
      order: { createdAt: 'DESC' },
      take: 30,
    });
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
   * указан). Fire-and-forget с точки зрения вызывающего кода — первая попытка синхронна, но её
   * провал не пробрасывается наружу (недоступный внешний сайт не должен ронять операцию над
   * товаром); дальнейшие ретраи уходят в фон.
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
    await Promise.all(
      targets.map(async (w) => {
        const delivery = await this.deliveries.save(
          this.deliveries.create({
            tenantId,
            webhookId: w.id,
            event,
            payload,
            status: 'pending',
            attempt: 0,
            maxAttempts: MAX_ATTEMPTS,
            nextAttemptAt: new Date(),
          }),
        );
        await this.attemptDelivery(w, delivery);
      }),
    );
  }

  /** Отправляет одну попытку доставки и обновляет и вебхук (последний статус), и саму запись доставки. */
  private async attemptDelivery(webhook: ProductWebhook, delivery: ProductWebhookDelivery): Promise<void> {
    const body = JSON.stringify({ event: delivery.event, data: delivery.payload, sentAt: new Date().toISOString() });
    const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');
    delivery.attempt += 1;

    let statusCode: number | null = null;
    let error: string | null = null;
    try {
      const res = await axios.post(webhook.url, body, {
        headers: {
          'Content-Type': 'application/json',
          'X-Lumiva-Event': delivery.event,
          'X-Lumiva-Signature': signature,
        },
        timeout: 10000,
        validateStatus: () => true,
      });
      statusCode = res.status;
      if (res.status < 200 || res.status >= 300) error = `HTTP ${res.status}`;
    } catch (err: any) {
      error = err?.message || 'Network error';
    }

    const ok = error === null;
    delivery.lastStatusCode = statusCode;
    delivery.lastError = error;

    if (ok) {
      delivery.status = 'success';
    } else if (delivery.attempt >= delivery.maxAttempts) {
      delivery.status = 'failed';
      this.log.warn(
        `Webhook ${webhook.id} (${webhook.url}) — доставка ${delivery.id} провалена окончательно после ${delivery.attempt} попыток: ${error}`,
      );
    } else {
      delivery.status = 'pending';
      const delayMin = RETRY_DELAYS_MIN[delivery.attempt - 1] ?? RETRY_DELAYS_MIN[RETRY_DELAYS_MIN.length - 1];
      delivery.nextAttemptAt = new Date(Date.now() + delayMin * 60_000);
      this.log.warn(
        `Webhook ${webhook.id} (${webhook.url}) — попытка ${delivery.attempt} провалена (${error}), ретрай через ${delayMin} мин`,
      );
    }
    await this.deliveries.save(delivery).catch(() => {});

    // Последний статус на самом вебхуке — для существующего UI (таблица вебхуков), который
    // показывает "последнюю отправку" не открывая историю доставок.
    webhook.lastTriggeredAt = new Date();
    webhook.lastStatusCode = statusCode;
    webhook.lastError = error;
    await this.repo.save(webhook).catch(() => {});
  }

  /** Свип ретраев — раз в минуту подбирает все просроченные `pending`-доставки и повторяет их. */
  @Cron('*/1 * * * *')
  async retryPendingDeliveries(): Promise<void> {
    const due = await this.deliveries.find({
      where: { status: 'pending', nextAttemptAt: LessThanOrEqual(new Date()) },
      take: 100,
    });
    if (!due.length) return;

    const webhookIds = [...new Set(due.map((d) => d.webhookId))];
    const webhooks = await this.repo.find({ where: { id: In(webhookIds) } });
    const webhookById = new Map(webhooks.map((w) => [w.id, w]));

    for (const delivery of due) {
      // attempt=0 значит первая попытка ещё не отправлялась (только что создана dispatch()) —
      // такое сюда попасть не должно (dispatch сразу же вызывает attemptDelivery), но на всякий
      // случай не ретраим дважды в одном свипе то, что уже успело смениться на success/failed.
      const webhook = webhookById.get(delivery.webhookId);
      if (!webhook || !webhook.isActive) continue;
      await this.attemptDelivery(webhook, delivery);
    }
  }
}
