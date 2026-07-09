// src/integrations/woocommerce/woocommerce-inbound.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

import { IntegrationConnection } from '../integration-connection.entity';
import { Sale, type SaleStatus } from '../../sales/sale.entity';
import { LeadsService } from '../../leads/leads.service';
import { NotesService } from '../../notes/notes.service';
import { EntityType, NoteType } from '../../notes/dto/create-note.dto';

type WooCfg = {
  apiUrl?: string;
  url?: string;
  consumerKey?: string;
  consumerSecret?: string;
  webhookSecret?: string;
  defaultLeadSource?: string;
  [key: string]: unknown;
};

function parseCfg(entity: IntegrationConnection): WooCfg | null {
  if (!entity.configJson) return null;
  try {
    return JSON.parse(entity.configJson) as WooCfg;
  } catch {
    return null;
  }
}

function mapWooStatus(wooStatus: string | undefined | null): SaleStatus {
  const s = (wooStatus || '').toLowerCase();
  switch (s) {
    case 'pending':
    case 'on-hold':
    case 'processing':
      return 'pending';
    case 'completed':
      return 'confirmed';
    case 'cancelled':
    case 'failed':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    default:
      return 'other';
  }
}

function normalizeApiUrl(cfg: WooCfg): string {
  const raw = String(cfg.apiUrl || cfg.url || '').trim();
  return raw.replace(/\/+$/, '');
}

@Injectable()
export class WooCommerceInboundService {
  private readonly log = new Logger(WooCommerceInboundService.name);

  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly connectionRepo: Repository<IntegrationConnection>,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    private readonly leadsService: LeadsService,
    private readonly notesService: NotesService,
  ) {}

  private verifySignature(secret: string, bodyStr: string, signatureHeader: string): boolean {
    const computed = crypto
      .createHmac('sha256', secret)
      .update(bodyStr, 'utf8')
      .digest('base64');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(computed, 'base64'),
        Buffer.from(signatureHeader, 'base64'),
      );
    } catch {
      return computed === signatureHeader;
    }
  }

  async receive(
    connectionId: string,
    querySecret: string | undefined,
    topic: string | undefined,
    signatureHeader: string | undefined,
    body: any,
  ): Promise<{ ok: true }> {
    // 1. Load connection
    const entity = await this.connectionRepo.findOne({
      where: { id: connectionId, isDeleted: false, isEnabled: true } as any,
    });
    if (!entity || entity.kind !== 'woocommerce') {
      this.log.warn(`Unknown or disabled WooCommerce connection ${connectionId}`);
      return { ok: true };
    }

    const cfg = parseCfg(entity);
    if (!cfg) {
      this.log.warn(`Invalid config for WooCommerce connection ${connectionId}`);
      return { ok: true };
    }

    // 2. Verify authentication
    const webhookSecret = (cfg.webhookSecret as string | undefined) || '';
    if (webhookSecret) {
      // Check query secret first (simple auth)
      if (querySecret && querySecret === webhookSecret) {
        // OK — simple secret matches
      } else if (signatureHeader) {
        // Check HMAC signature
        const bodyStr =
          body && typeof body === 'object' ? JSON.stringify(body) : String(body ?? '');
        const valid = this.verifySignature(webhookSecret, bodyStr, signatureHeader);
        if (!valid) {
          this.log.warn(`Signature mismatch for WooCommerce connection ${connectionId}`);
          return { ok: true };
        }
      } else if (querySecret && querySecret !== webhookSecret) {
        this.log.warn(`Bad secret for WooCommerce connection ${connectionId}`);
        return { ok: true };
      }
    }

    // 3. Determine the event topic
    // WooCommerce sends X-WC-Webhook-Topic header, or body may contain event field
    const eventTopic =
      topic ||
      (body && typeof body === 'object' ? (body as any).event : undefined) ||
      '';
    const normalizedTopic = String(eventTopic).toLowerCase().trim();

    const isOrderTopic =
      normalizedTopic === 'order.created' ||
      normalizedTopic === 'order.updated' ||
      normalizedTopic.startsWith('order.');

    if (!isOrderTopic) {
      this.log.log(
        `WooCommerce webhook topic '${eventTopic}' ignored for connection ${connectionId}`,
      );
      return { ok: true };
    }

    const order = body;
    if (!order || typeof order !== 'object') {
      this.log.warn(`Empty WooCommerce order body for connection ${connectionId}`);
      return { ok: true };
    }

    const orderId = order.id != null ? String(order.id) : null;
    if (!orderId) {
      this.log.warn(`No order.id in WooCommerce webhook for connection ${connectionId}`);
      return { ok: true };
    }

    const tenantId = entity.tenantId;

    // Extract order fields
    const billing = order.billing || {};
    const shipping = order.shipping || {};
    const firstName: string = billing.first_name || '';
    const lastName: string = billing.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim().replace(/\s+/g, ' ');
    const email: string = (billing.email || '').trim();
    const phone: string = (billing.phone || '').trim();
    const total: string = order.total || '0';
    const currency: string = order.currency || 'EUR';
    const wooStatus: string = order.status || '';
    const orderNumber: string = order.number ? String(order.number) : orderId;

    // 4. Upsert Sale
    const externalId = orderId;
    let sale = await this.saleRepo.findOne({
      where: {
        externalId,
        tenantId,
      } as any,
    });

    const status = mapWooStatus(wooStatus);
    const amount = parseFloat(total) || 0;
    const firstLine = Array.isArray(order.line_items) ? order.line_items[0] : undefined;
    const productName = firstLine?.name ? String(firstLine.name) : null;
    const saleDateStr = order.date_created_gmt || order.date_created;
    const saleDate = saleDateStr ? new Date(saleDateStr) : new Date();
    const country = billing.country || shipping.country || null;

    const saleData: Partial<Sale> = {
      tenantId,
      externalId,
      externalOrderNo: order.number ? String(order.number) : null,
      saleDate,
      guestName: fullName || null,
      agentName: billing.company || order.customer_note || null,
      hotel: productName,
      market: country,
      amount,
      currency,
      status,
      rawPayload: order,
    };

    if (entity.channelId) {
      saleData.channelId = entity.channelId;
    }

    if (sale) {
      this.saleRepo.merge(sale, saleData);
      sale = await this.saleRepo.save(sale);
    } else {
      sale = await this.saleRepo.save(this.saleRepo.create(saleData));
    }

    // 5. Ensure lead exists (find by email or create)
    let leadId: string | null = null;
    if (email) {
      leadId = await this.leadsService.findLeadIdByEmail(tenantId, email).catch(() => null);
    }

    if (!leadId) {
      try {
        const newLead = await this.leadsService.createForTenant(tenantId, {
          name: (fullName || 'WooCommerce Customer').slice(0, 250),
          email: email ? email.slice(0, 250) : undefined,
          phone: phone ? phone.slice(0, 50) : undefined,
          source: cfg.defaultLeadSource || 'woocommerce',
          status: 'new',
          meta: {
            integrationConnectionId: entity.id,
            wooOrderId: orderId,
          },
        });
        leadId = newLead.id;
      } catch (e) {
        this.log.error(`Failed to create WooCommerce lead: ${(e as Error).message}`);
      }
    }

    // Link sale to lead
    if (sale.id) {
      try {
        await this.leadsService.ensureLeadLinkedForSale(sale);
      } catch {
        // non-critical
      }
    }

    // 6. Create note on lead
    if (leadId) {
      const noteContent = [
        `WooCommerce ${eventTopic || 'order'}: заказ #${orderNumber}, ${total} ${currency}, статус: ${wooStatus}`,
        '',
        '---',
        `ID заказа: ${orderId}`,
      ].join('\n');

      try {
        await this.notesService.create(
          tenantId,
          {
            entityType: EntityType.LEAD,
            entityId: leadId,
            content: noteContent,
            title: `WooCommerce ${eventTopic || 'order'}`,
            type: NoteType.NOTE,
          },
          undefined,
          'integration:woocommerce',
        );
      } catch (e) {
        this.log.error(`Failed to create WooCommerce note: ${(e as Error).message}`);
      }
    }

    return { ok: true };
  }

  /**
   * Register webhooks in WooCommerce on connection setup.
   * Called after a successful testConnection to configure push delivery.
   */
  async registerWebhooks(connection: IntegrationConnection): Promise<void> {
    const publicApiUrl = process.env.PUBLIC_API_URL;
    if (!publicApiUrl) {
      this.log.log(
        `PUBLIC_API_URL not set — skipping WooCommerce webhook registration for connection ${connection.id}`,
      );
      return;
    }

    const cfg = parseCfg(connection);
    if (!cfg) return;

    const apiUrl = normalizeApiUrl(cfg);
    const consumerKey = (cfg.consumerKey as string | undefined) || '';
    const consumerSecret = (cfg.consumerSecret as string | undefined) || '';

    if (!apiUrl || !consumerKey || !consumerSecret) {
      this.log.warn(
        `Missing WooCommerce credentials — cannot register webhooks for connection ${connection.id}`,
      );
      return;
    }

    const deliveryUrl = `${publicApiUrl.replace(/\/+$/, '')}/v1/webhooks/woocommerce/${connection.id}`;
    const webhookSecret = (cfg.webhookSecret as string | undefined) || '';

    const topics = [
      { name: 'Lumiva Order Created', topic: 'order.created' },
      { name: 'Lumiva Order Updated', topic: 'order.updated' },
    ];

    const baseWooUrl = `${apiUrl}/wp-json/wc/v3/webhooks`;
    const authParams =
      `consumer_key=${encodeURIComponent(consumerKey)}` +
      `&consumer_secret=${encodeURIComponent(consumerSecret)}`;

    for (const wh of topics) {
      try {
        const payload: Record<string, unknown> = {
          name: wh.name,
          topic: wh.topic,
          delivery_url: deliveryUrl,
          status: 'active',
        };
        if (webhookSecret) {
          payload.secret = webhookSecret;
        }

        const res = await fetch(`${baseWooUrl}?${authParams}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'LumivaCRM-WooWebhookSetup/1.0',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          this.log.log(
            `Registered WooCommerce webhook '${wh.topic}' for connection ${connection.id}`,
          );
        } else {
          const text = await res.text().catch(() => '');
          this.log.warn(
            `Failed to register WooCommerce webhook '${wh.topic}' for connection ${connection.id}: HTTP ${res.status} ${text.slice(0, 200)}`,
          );
        }
      } catch (e) {
        this.log.error(
          `Error registering WooCommerce webhook '${wh.topic}': ${(e as Error).message}`,
        );
      }
    }
  }
}
