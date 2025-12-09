// src/integrations/woocommerce/woocommerce.adapter.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type {
  SalesIntegrationAdapter,
  TestConnectionResult,
  SyncResult,
} from '../sales-integration.adapter';
import type { IntegrationKind } from '../integration-kind.enum';
import { IntegrationConnection } from '../integration-connection.entity';

import { Sale, type SaleStatus } from '../../sales/sale.entity';

type WooConfig = {
  apiUrl?: string; // домен магазина без /wp-json...
  url?: string; // на всякий случай, если раньше так сохраняли
  consumerKey?: string;
  consumerSecret?: string;
  [key: string]: any;
};

type WooOrderLineItem = {
  id?: number | string;
  name?: string;
  product_id?: number | string;
  permalink?: string;
  total?: string;
  [key: string]: any;
};

type WooOrder = {
  id: number | string;
  number?: string;
  status?: string;
  date_created?: string;
  date_created_gmt?: string;
  currency?: string;
  total?: string;
  billing?: {
    first_name?: string;
    last_name?: string;
    company?: string;
    country?: string;
  };
  shipping?: {
    country?: string;
  };
  customer_note?: string;
  meta_data?: { key: string; value: any }[];
  line_items?: WooOrderLineItem[];
  [key: string]: any;
};

@Injectable()
export class WooCommerceAdapter implements SalesIntegrationAdapter {
  public readonly kind: IntegrationKind = 'woocommerce';
  public readonly label = 'WooCommerce';

  private readonly logger = new Logger(WooCommerceAdapter.name);

  constructor(
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
  ) {}

  /* ────────────────────────────────
   * ВСПОМОГАТЕЛЬНОЕ: разбор и нормализация конфига
   * ──────────────────────────────── */

  private parseConfig(connection: IntegrationConnection): WooConfig {
    if (!connection.configJson) return {};
    try {
      const parsed = JSON.parse(connection.configJson);
      return parsed && typeof parsed === 'object' ? (parsed as WooConfig) : {};
    } catch (e) {
      this.logger.warn(
        `Invalid WooCommerce configJson for connection=${connection.id}: ${
          (e as Error).message
        }`,
      );
      return {};
    }
  }

  private normalizeConfig(connection: IntegrationConnection) {
    const cfg = this.parseConfig(connection);
    const apiUrlRaw = cfg.apiUrl || cfg.url;

    const apiUrl = apiUrlRaw
      ? String(apiUrlRaw).replace(/\/+$/, '') // убираем хвостовые слэши
      : '';

    const consumerKey = cfg.consumerKey ? String(cfg.consumerKey) : '';
    const consumerSecret = cfg.consumerSecret
      ? String(cfg.consumerSecret)
      : '';

    return { apiUrl, consumerKey, consumerSecret };
  }

  /* ────────────────────────────────
   * Проверка подключения
   * ──────────────────────────────── */

  async testConnection(
    connection: IntegrationConnection,
  ): Promise<TestConnectionResult> {
    const { apiUrl, consumerKey, consumerSecret } =
      this.normalizeConfig(connection);

    if (!apiUrl || !consumerKey || !consumerSecret) {
      return {
        ok: false,
        message: 'Укажите apiUrl, consumerKey и consumerSecret',
      };
    }

    const url =
      apiUrl +
      '/wp-json/wc/v3/orders?per_page=1&page=1' +
      `&consumer_key=${encodeURIComponent(consumerKey)}` +
      `&consumer_secret=${encodeURIComponent(consumerSecret)}`;

    this.logger.log(
      `Testing WooCommerce connection id=${connection.id} url=${apiUrl}`,
    );

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'LumivaCRM-WooSync/1.0',
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(
          `Woo test failed id=${connection.id} status=${res.status} body=${text.slice(
            0,
            300,
          )}`,
        );

        if (res.status === 401 || res.status === 403) {
          return {
            ok: false,
            message:
              'Доступ запрещён (401/403). Проверьте consumerKey / consumerSecret и права REST API.',
          };
        }

        if (res.status === 404) {
          return {
            ok: false,
            message:
              'WooCommerce вернул 404. Проверьте apiUrl: укажите просто домен сайта без /wp-json и других путей.',
          };
        }

        return {
          ok: false,
          message: `Ошибка при запросе к WooCommerce: HTTP ${res.status}`,
        };
      }

      // Пытаемся прочитать JSON только ради логов
      try {
        const data = (await res.json()) as any;
        const sampleId =
          Array.isArray(data) && data.length ? data[0]?.id : undefined;
        if (sampleId) {
          this.logger.log(
            `Woo test OK id=${connection.id}, sample order id=${sampleId}`,
          );
        } else {
          this.logger.log(
            `Woo test OK id=${connection.id}, но список заказов пуст`,
          );
        }
      } catch {
        this.logger.log(
          `Woo test OK id=${connection.id}, но не удалось распарсить JSON`,
        );
      }

      return {
        ok: true,
        message: 'Подключение к WooCommerce успешно, заказы доступны',
      };
    } catch (e) {
      this.logger.error(
        `Woo test error id=${connection.id}: ${(e as Error).message}`,
      );
      return {
        ok: false,
        message:
          'Ошибка сети при обращении к WooCommerce. Проверьте apiUrl и доступность сайта.',
      };
    }
  }

  /* ────────────────────────────────
   * Маппинг статуса Woo → SaleStatus
   * ──────────────────────────────── */

  private mapStatus(wooStatus: string | undefined | null): SaleStatus {
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

  /* ────────────────────────────────
   * Маппинг WooOrder → Partial<Sale>
   *   - productName → hotel
   *   - clientName  → guestName
   *   - country     → market
   *   - productUrl  → notes (для столбца «Ссылка на товар»)
   * ──────────────────────────────── */

  private mapOrderToSale(
    order: WooOrder,
    connection: IntegrationConnection,
  ): Partial<Sale> {
    const billing = order.billing || {};
    const shipping = order.shipping || {};

    // Клиент: имя + фамилия
    const fullName = `${billing.first_name || ''} ${billing.last_name || ''}`
      .trim()
      .replace(/\s+/g, ' ');

    // Основной товар из первого line_item
    const firstLine: WooOrderLineItem | undefined = Array.isArray(
      order.line_items,
    )
      ? order.line_items[0]
      : undefined;

    const productName = firstLine?.name
      ? String(firstLine.name)
      : null;

    const productUrl = firstLine?.permalink
      ? String(firstLine.permalink)
      : null;

    // Дата покупки
    const saleDateStr =
      order.date_created_gmt || order.date_created || undefined;
    const saleDate = saleDateStr ? new Date(saleDateStr) : new Date();

    const amount = order.total ? parseFloat(order.total) || 0 : 0;
    const status = this.mapStatus(order.status);

    const country = billing.country || shipping.country || null;

    const saleData: Partial<Sale> = {
      externalId: String(order.id),
      externalOrderNo: order.number ? String(order.number) : null,
      saleDate,
      // Клиент
      guestName: fullName || null,
      // Компания / доп-инфо по клиенту
      agentName: billing.company || order.customer_note || null,
      // Товар (для столбца «Товар»)
      hotel: productName,
      // Рынок / страна
      market: country,
      amount,
      currency: order.currency || 'EUR',
      status,
      // Доп: ссылка на товар кладём в notes, чтобы вывести в колонке «Ссылка на товар»
      notes: productUrl || null,
      checkInAt: null,
      checkOutAt: null,
      rawPayload: order,
    };

    if (connection.channelId) {
      saleData.channelId = connection.channelId;
    }

    return saleData;
  }

  /* ────────────────────────────────
   * Основная синхронизация заказов
   * ──────────────────────────────── */

  async syncSales(
    connection: IntegrationConnection,
  ): Promise<SyncResult> {
    const { apiUrl, consumerKey, consumerSecret } =
      this.normalizeConfig(connection);

    if (!apiUrl || !consumerKey || !consumerSecret) {
      return {
        ok: false,
        created: 0,
        updated: 0,
        skipped: 0,
        message:
          'Конфиг WooCommerce не заполнен. Укажите apiUrl, consumerKey и consumerSecret.',
      };
    }

    const perPage = 50;
    const maxPages = 5; // максимум 250 заказов за один прогон (для MVP)
    let page = 1;

    let created = 0;
    let updated = 0;
    let skipped = 0;

    this.logger.log(
      `Start Woo sync connection=${connection.id} apiUrl=${apiUrl}`,
    );

    try {
      while (page <= maxPages) {
        const url =
          apiUrl +
          `/wp-json/wc/v3/orders?per_page=${perPage}&page=${page}` +
          `&order=desc&orderby=date` +
          `&consumer_key=${encodeURIComponent(consumerKey)}` +
          `&consumer_secret=${encodeURIComponent(consumerSecret)}`;

        this.logger.log(`Woo sync: GET ${url}`);

        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'LumivaCRM-WooSync/1.0',
            Accept: 'application/json',
          },
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          this.logger.warn(
            `Woo sync failed id=${connection.id} status=${res.status} body=${text.slice(
              0,
              300,
            )}`,
          );

          if (res.status === 401 || res.status === 403) {
            return {
              ok: false,
              created,
              updated,
              skipped,
              message:
                'Доступ запрещён (401/403) при синхронизации. Проверьте consumerKey / consumerSecret и права REST API.',
            };
          }

          if (res.status === 404) {
            return {
              ok: false,
              created,
              updated,
              skipped,
              message:
                'WooCommerce вернул 404 при синхронизации. Проверьте apiUrl (только домен сайта, без /wp-json...).',
            };
          }

          return {
            ok: false,
            created,
            updated,
            skipped,
            message: `Ошибка при запросе к WooCommerce: HTTP ${res.status}`,
          };
        }

        const data = (await res.json().catch(() => null)) as WooOrder[] | null;

        if (!Array.isArray(data) || data.length === 0) {
          this.logger.log(
            `Woo sync: page=${page} пустая, заканчиваем синхронизацию.`,
          );
          break;
        }

        for (const order of data) {
          const externalId = order.id != null ? String(order.id) : '';

          if (!externalId) {
            skipped++;
            continue;
          }

          // Ищем по externalId (+ channelId, если привязан канал)
          const existing = await this.saleRepo.findOne({
            where: {
              externalId,
              ...(connection.channelId
                ? { channelId: connection.channelId }
                : {}),
            },
          });

          const saleData = this.mapOrderToSale(order, connection);

          if (existing) {
            this.saleRepo.merge(existing, saleData);
            await this.saleRepo.save(existing);
            updated++;
          } else {
            const entity = this.saleRepo.create(saleData);
            await this.saleRepo.save(entity);
            created++;
          }
        }

        if (data.length < perPage) {
          this.logger.log(
            `Woo sync: page=${page}, получено ${data.length} (<${perPage}), выходим.`,
          );
          break;
        }

        page++;
      }

      this.logger.log(
        `Woo sync done connection=${connection.id} created=${created}, updated=${updated}, skipped=${skipped}`,
      );

      return {
        ok: true,
        created,
        updated,
        skipped,
        message: `Синхронизация WooCommerce выполнена. Создано: ${created}, обновлено: ${updated}, пропущено: ${skipped}.`,
      };
    } catch (e) {
      this.logger.error(
        `Woo sync error id=${connection.id}: ${(e as Error).message}`,
      );
      return {
        ok: false,
        created,
        updated,
        skipped,
        message:
          'Ошибка сети при синхронизации WooCommerce. Проверьте доступность магазина.',
      };
    }
  }
}