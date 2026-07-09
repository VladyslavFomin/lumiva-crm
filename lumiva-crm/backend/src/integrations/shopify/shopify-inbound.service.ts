// src/integrations/shopify/shopify-inbound.service.ts
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

import { IntegrationConnection } from '../integration-connection.entity';
import { Sale, type SaleStatus } from '../../sales/sale.entity';
import { LeadsService } from '../../leads/leads.service';
import { NotesService } from '../../notes/notes.service';
import { EntityType, NoteType } from '../../notes/dto/create-note.dto';
import { ShopifyApiService } from './shopify-api.service';

type ShopifyCfg = {
  shopDomain?: string;
  accessToken?: string;
  webhookSecret?: string;
  defaultLeadSource?: string;
  [key: string]: unknown;
};

function parseCfg(entity: IntegrationConnection): ShopifyCfg | null {
  if (!entity.configJson) return null;
  try {
    return JSON.parse(entity.configJson) as ShopifyCfg;
  } catch {
    return null;
  }
}

function mapFinancialStatus(financialStatus: string | undefined): SaleStatus {
  const fs = (financialStatus || '').toLowerCase();
  switch (fs) {
    case 'refunded':
    case 'partially_refunded':
      return 'refunded';
    case 'voided':
      return 'cancelled';
    case 'paid':
      return 'confirmed';
    case 'pending':
    case 'authorized':
    case 'partially_paid':
      return 'pending';
    default:
      return 'other';
  }
}

@Injectable()
export class ShopifyInboundService {
  private readonly log = new Logger(ShopifyInboundService.name);

  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly connectionRepo: Repository<IntegrationConnection>,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    private readonly leadsService: LeadsService,
    private readonly notesService: NotesService,
    private readonly shopifyApi: ShopifyApiService,
  ) {}

  private verifyHmac(secret: string, rawBodyStr: string, hmacHeader: string): boolean {
    const computed = crypto
      .createHmac('sha256', secret)
      .update(rawBodyStr, 'utf8')
      .digest('base64');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(computed, 'base64'),
        Buffer.from(hmacHeader, 'base64'),
      );
    } catch {
      return computed === hmacHeader;
    }
  }

  async receive(
    connectionId: string,
    topic: string,
    body: any,
    hmacHeader?: string,
  ): Promise<{ ok: true }> {
    // 1. Load connection
    const entity = await this.connectionRepo.findOne({
      where: { id: connectionId, isDeleted: false, isEnabled: true } as any,
    });
    if (!entity || entity.kind !== 'shopify') {
      this.log.warn(`Unknown or disabled Shopify connection ${connectionId}`);
      return { ok: true };
    }

    const cfg = parseCfg(entity);
    if (!cfg) {
      this.log.warn(`Invalid config for Shopify connection ${connectionId}`);
      return { ok: true };
    }

    // 2. Verify HMAC if secret is configured
    if (cfg.webhookSecret && hmacHeader) {
      const bodyStr =
        body && typeof body === 'object' ? JSON.stringify(body) : String(body ?? '');
      const valid = this.verifyHmac(cfg.webhookSecret, bodyStr, hmacHeader);
      if (!valid) {
        this.log.warn(`HMAC mismatch for Shopify connection ${connectionId}`);
        throw new UnauthorizedException('Invalid Shopify HMAC signature');
      }
    }

    // 3. Handle topics
    const normalizedTopic = (topic || '').toLowerCase().trim();
    const isOrderTopic =
      normalizedTopic === 'orders/create' ||
      normalizedTopic === 'orders/paid' ||
      normalizedTopic === 'orders/updated';

    if (!isOrderTopic) {
      this.log.log(`Shopify webhook topic '${topic}' ignored for connection ${connectionId}`);
      return { ok: true };
    }

    const order = body;
    if (!order || typeof order !== 'object') {
      this.log.warn(`Empty Shopify order body for connection ${connectionId}`);
      return { ok: true };
    }

    const orderId = order.id ? String(order.id) : null;
    if (!orderId) {
      this.log.warn(`No order.id in Shopify webhook for connection ${connectionId}`);
      return { ok: true };
    }

    const tenantId = entity.tenantId;

    // Extract order fields
    const billing = order.billing_address || {};
    const customer = order.customer || {};
    const firstName: string =
      customer.first_name || billing.first_name || '';
    const lastName: string =
      customer.last_name || billing.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim().replace(/\s+/g, ' ');
    const email: string = (order.email || customer.email || '').trim();
    const phone: string = (billing.phone || customer.phone || order.phone || '').trim();
    const totalPrice: string = order.total_price || '0';
    const currency: string = order.currency || 'USD';
    const financialStatus: string = order.financial_status || '';
    const orderNumber = order.order_number || order.name || orderId;

    // 4. Upsert Sale
    const externalId = orderId;
    let sale = await this.saleRepo.findOne({
      where: {
        externalId,
        tenantId,
      } as any,
    });

    const status = mapFinancialStatus(financialStatus);
    const amount = parseFloat(totalPrice) || 0;
    const firstLine = Array.isArray(order.line_items) ? order.line_items[0] : undefined;
    const productName = firstLine?.title || firstLine?.name || null;
    const saleDateStr = order.processed_at || order.created_at;
    const saleDate = saleDateStr ? new Date(saleDateStr) : new Date();
    const externalOrderNo = order.name
      ? String(order.name).replace(/^#/, '')
      : order.order_number
      ? String(order.order_number)
      : null;
    const country =
      billing.country_code || (order.shipping_address || {}).country_code || billing.country || null;

    const saleData: Partial<Sale> = {
      tenantId,
      externalId,
      externalOrderNo,
      saleDate,
      guestName: fullName || null,
      agentName: billing.company || null,
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

    // 5. Ensure lead exists
    let leadId: string | null = null;
    if (email) {
      leadId = await this.leadsService.findLeadIdByEmail(tenantId, email).catch(() => null);
    }

    if (!leadId) {
      try {
        const newLead = await this.leadsService.createForTenant(tenantId, {
          name: (fullName || 'Shopify Customer').slice(0, 250),
          email: email ? email.slice(0, 250) : undefined,
          phone: phone ? phone.slice(0, 50) : undefined,
          source: cfg.defaultLeadSource || 'shopify',
          status: 'new',
          meta: {
            integrationConnectionId: entity.id,
            shopifyCustomerId: customer.id ? String(customer.id) : undefined,
            shopifyOrderId: orderId,
          },
        });
        leadId = newLead.id;
      } catch (e) {
        this.log.error(`Failed to create Shopify lead: ${(e as Error).message}`);
      }
    }

    // Link sale to lead
    if (leadId && sale.id) {
      try {
        await this.leadsService.ensureLeadLinkedForSale(sale);
      } catch {
        // non-critical
      }
    }

    // 6. Create note on lead
    if (leadId) {
      const noteContent = [
        `Shopify ${topic}: заказ #${orderNumber}, ${totalPrice} ${currency}, статус: ${financialStatus}`,
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
            title: `Shopify ${topic}`,
            type: NoteType.NOTE,
          },
          undefined,
          'integration:shopify',
        );
      } catch (e) {
        this.log.error(`Failed to create Shopify note: ${(e as Error).message}`);
      }
    }

    return { ok: true };
  }

  /**
   * Push fulfillment status back to Shopify when a sale is marked completed.
   */
  async pushStatusToShopify(
    connection: IntegrationConnection,
    externalOrderId: string,
    newStatus: string,
  ): Promise<void> {
    if (newStatus !== 'completed' && newStatus !== 'confirmed') return;

    const cfg = parseCfg(connection);
    if (!cfg?.shopDomain || !cfg?.accessToken) return;

    try {
      const baseUrl = this.shopifyApi.buildBaseUrl(cfg.shopDomain);
      await this.shopifyApi.createFulfillment(baseUrl, cfg.accessToken, externalOrderId);
      this.log.log(
        `Shopify fulfillment created for order ${externalOrderId} on connection ${connection.id}`,
      );
    } catch (e) {
      this.log.error(
        `Failed to push fulfillment to Shopify for order ${externalOrderId}: ${(e as Error).message}`,
      );
    }
  }
}
