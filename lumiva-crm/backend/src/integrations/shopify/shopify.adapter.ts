// src/integrations/shopify/shopify.adapter.ts
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type {
  SalesIntegrationAdapter,
  TestConnectionResult,
  SyncResult,
  IntegrationSyncContext,
} from '../sales-integration.adapter';
import type { IntegrationKind } from '../integration-kind.enum';
import { IntegrationConnection } from '../integration-connection.entity';
import { Sale, type SaleStatus } from '../../sales/sale.entity';
import { LeadsService } from '../../leads/leads.service';
import { ShopifyApiService, type ShopifyOrder } from './shopify-api.service';

type ShopifyConfig = {
  shopDomain?: string;
  accessToken?: string;
  [key: string]: unknown;
};

@Injectable()
export class ShopifyAdapter implements SalesIntegrationAdapter {
  public readonly kind: IntegrationKind = 'shopify';
  public readonly label = 'Shopify';

  private readonly logger = new Logger(ShopifyAdapter.name);

  constructor(
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    private readonly shopifyApi: ShopifyApiService,
    @Inject(forwardRef(() => LeadsService))
    private readonly leadsService: LeadsService,
  ) {}

  private parseConfig(connection: IntegrationConnection): ShopifyConfig {
    if (!connection.configJson) return {};
    try {
      const p = JSON.parse(connection.configJson);
      return p && typeof p === 'object' ? (p as ShopifyConfig) : {};
    } catch {
      return {};
    }
  }

  private normalizeConfig(connection: IntegrationConnection) {
    const cfg = this.parseConfig(connection);
    const shopDomain = (cfg.shopDomain || '').trim();
    const accessToken = (cfg.accessToken || '').trim();
    return { shopDomain, accessToken };
  }

  async testConnection(connection: IntegrationConnection): Promise<TestConnectionResult> {
    const { shopDomain, accessToken } = this.normalizeConfig(connection);
    if (!shopDomain || !accessToken) {
      return { ok: false, message: 'Укажите домен магазина и Access Token' };
    }
    try {
      const baseUrl = this.shopifyApi.buildBaseUrl(shopDomain);
      const shop = await this.shopifyApi.getShop(baseUrl, accessToken);
      const shopName = shop.name || shopDomain;
      return {
        ok: true,
        message: `Подключение к Shopify успешно. Магазин: ${shopName}`,
      };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  private mapStatus(order: ShopifyOrder): SaleStatus {
    if (order.cancelled_at) return 'cancelled';
    const fs = (order.financial_status || '').toLowerCase();
    switch (fs) {
      case 'refunded':
      case 'partially_refunded':
        return 'refunded';
      case 'voided':
        return 'cancelled';
      case 'paid':
        return order.fulfillment_status === 'fulfilled' ? 'confirmed' : 'pending';
      case 'pending':
      case 'authorized':
      case 'partially_paid':
        return 'pending';
      default:
        return 'other';
    }
  }

  private mapOrderToSale(order: ShopifyOrder, connection: IntegrationConnection): Partial<Sale> {
    const customer = order.customer || {};
    const billing = order.billing_address || {};
    const shipping = order.shipping_address || {};

    const firstName = customer.first_name || billing.first_name || '';
    const lastName = customer.last_name || billing.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim().replace(/\s+/g, ' ');

    const firstLine = Array.isArray(order.line_items) ? order.line_items[0] : undefined;
    const productName = firstLine?.title || firstLine?.name || null;

    const saleDateStr = order.processed_at || order.created_at;
    const saleDate = saleDateStr ? new Date(saleDateStr) : new Date();

    const amount = parseFloat(order.total_price || '0') || 0;
    const status = this.mapStatus(order);
    const country = billing.country_code || shipping.country_code || billing.country || null;

    const externalOrderNo =
      order.name
        ? String(order.name).replace(/^#/, '')
        : order.order_number
          ? String(order.order_number)
          : null;

    const saleData: Partial<Sale> = {
      tenantId: connection.tenantId ?? null,
      externalId: String(order.id),
      externalOrderNo,
      saleDate,
      guestName: fullName || null,
      agentName: billing.company || null,
      hotel: productName,
      market: country,
      amount,
      currency: order.currency || 'USD',
      status,
      notes: null,
      checkInAt: null,
      checkOutAt: null,
      rawPayload: order,
    };

    if (connection.channelId) {
      saleData.channelId = connection.channelId;
    }

    return saleData;
  }

  async syncSales(
    connection: IntegrationConnection,
    _context?: IntegrationSyncContext,
  ): Promise<SyncResult> {
    const { shopDomain, accessToken } = this.normalizeConfig(connection);
    if (!shopDomain || !accessToken) {
      return {
        ok: false,
        created: 0,
        updated: 0,
        skipped: 0,
        message: 'Конфиг Shopify не заполнен. Укажите домен магазина и Access Token.',
      };
    }

    const baseUrl = this.shopifyApi.buildBaseUrl(shopDomain);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let pageCount = 0;
    const maxPages = 5; // 5 × 250 = 1250 orders per run
    let nextPageInfo: string | null = null;

    this.logger.log(`Start Shopify sync connection=${connection.id} domain=${shopDomain}`);

    try {
      do {
        const page = await this.shopifyApi.getOrdersPage(baseUrl, accessToken, {
          limit: 250,
          status: 'any',
          pageInfo: nextPageInfo ?? undefined,
        });

        if (page.orders.length === 0) break;

        for (const order of page.orders) {
          const externalId = String(order.id);
          if (!externalId) { skipped++; continue; }

          const existing = await this.saleRepo.findOne({
            where: {
              externalId,
              ...(connection.channelId ? { channelId: connection.channelId } : {}),
            },
          });

          const saleData = this.mapOrderToSale(order, connection);

          if (existing) {
            this.saleRepo.merge(existing, saleData);
            await this.saleRepo.save(existing);
            try { await this.leadsService.ensureLeadLinkedForSale(existing); } catch {}
            updated++;
          } else {
            const entity = this.saleRepo.create(saleData);
            await this.saleRepo.save(entity);
            try { await this.leadsService.ensureLeadLinkedForSale(entity); } catch {}
            created++;
          }

          // Auto-link lead by customer email
          const email = order.customer?.email?.trim();
          if (email && existing) {
            try {
              await this.leadsService.ensureLeadLinkedForSale(existing);
            } catch {}
          }
        }

        nextPageInfo = page.nextPageInfo;
        pageCount++;
      } while (nextPageInfo && pageCount < maxPages);

      this.logger.log(
        `Shopify sync done connection=${connection.id} created=${created} updated=${updated} skipped=${skipped}`,
      );

      return {
        ok: true,
        created,
        updated,
        skipped,
        message: `Синхронизация Shopify выполнена. Создано: ${created}, обновлено: ${updated}, пропущено: ${skipped}.`,
      };
    } catch (e) {
      this.logger.error(`Shopify sync error id=${connection.id}: ${(e as Error).message}`);
      return {
        ok: false,
        created,
        updated,
        skipped,
        message: `Ошибка при синхронизации Shopify: ${(e as Error).message}`,
      };
    }
  }
}
