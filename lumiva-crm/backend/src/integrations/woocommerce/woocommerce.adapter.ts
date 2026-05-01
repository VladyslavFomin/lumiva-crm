// src/integrations/woocommerce/woocommerce.adapter.ts
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type {
  SalesIntegrationAdapter,
  TestConnectionResult,
  SyncResult,
  IntegrationSyncContext,
} from '../sales-integration.adapter';
import { CustomObjectsService } from '../../custom-objects/custom-objects.service';
import type { IntegrationKind } from '../integration-kind.enum';
import { IntegrationConnection } from '../integration-connection.entity';

import { Sale, type SaleStatus } from '../../sales/sale.entity';
import { LeadsService } from '../../leads/leads.service';
import {
  flattenWooOrder,
  mergeColumnKeys,
  wooOrderTotalNumber,
} from './woo-order-flat.util';
import { applyWorkspaceImportAggregation } from '../workspace-import-aggregate.util';
import type { WooWorkspaceImportMapping } from '../sales-integration.adapter';

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
    private readonly customObjectsService: CustomObjectsService,
    @Inject(forwardRef(() => LeadsService))
    private readonly leadsService: LeadsService,
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

  /** Origin магазина из apiUrl/url интеграции (без /wp-json). */
  private siteOriginFromConnection(
    connection: IntegrationConnection,
  ): string | null {
    const cfg = this.parseConfig(connection);
    const raw = String(cfg.apiUrl || cfg.url || '').trim();
    if (!raw) return null;
    let base = raw.split('/wp-json')[0] || raw;
    base = base.replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(base)) {
      base = `https://${base}`;
    }
    try {
      return new URL(base).origin;
    } catch {
      return null;
    }
  }

  /**
   * Ссылка на страницу товара: WC не всегда кладёт permalink в line_item.
   * Пробуем permalink / product_permalink / вложенный product.permalink / ?p=id на сайте.
   */
  private resolveLineItemProductUrl(
    firstLine: WooOrderLineItem | undefined,
    connection: IntegrationConnection,
  ): string | null {
    if (!firstLine) return null;
    const li = firstLine as Record<string, any>;

    const tryHttp = (v: unknown): string | null => {
      if (typeof v !== 'string') return null;
      const u = v.trim();
      return /^https?:\/\//i.test(u) ? u : null;
    };

    const direct =
      tryHttp(li.permalink) ||
      tryHttp(li.product_permalink);
    if (direct) return direct;

    const prod = li.product;
    if (prod && typeof prod === 'object') {
      const nested = tryHttp((prod as Record<string, unknown>).permalink);
      if (nested) return nested;
    }

    const origin = this.siteOriginFromConnection(connection);
    if (!origin) return null;

    const vid = Number(li.variation_id);
    const pid = Number(li.product_id);
    const postId =
      Number.isFinite(vid) && vid > 0 ? vid : Number.isFinite(pid) && pid > 0 ? pid : 0;
    if (postId <= 0) return null;

    return `${origin}/?p=${postId}`;
  }

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

    const productUrl = this.resolveLineItemProductUrl(firstLine, connection);

    // Дата покупки
    const saleDateStr =
      order.date_created_gmt || order.date_created || undefined;
    const saleDate = saleDateStr ? new Date(saleDateStr) : new Date();

    const amount = wooOrderTotalNumber(order as Record<string, any>);
    const status = this.mapStatus(order.status);

    const country = billing.country || shipping.country || null;

    const saleData: Partial<Sale> = {
      tenantId: connection.tenantId ?? null,
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

  /**
   * Выборка заказов для превью импорта в таблицу рабочей области (плоские колонки).
   */
  async previewWorkspaceImport(
    connection: IntegrationConnection,
    maxOrders: number,
  ): Promise<{
    columns: string[];
    sampleRows: Record<string, string>[];
    uniqueValuesByColumn: Record<string, string[]>;
    sampleOrderCount: number;
  }> {
    const { apiUrl, consumerKey, consumerSecret } =
      this.normalizeConfig(connection);

    if (!apiUrl || !consumerKey || !consumerSecret) {
      throw new Error(
        'Конфиг WooCommerce не заполнен. Укажите apiUrl, consumerKey и consumerSecret.',
      );
    }

    const perPage = Math.min(Math.max(1, maxOrders), 50);
    const url =
      apiUrl +
      `/wp-json/wc/v3/orders?per_page=${perPage}&page=1` +
      `&order=desc&orderby=date` +
      `&consumer_key=${encodeURIComponent(consumerKey)}` +
      `&consumer_secret=${encodeURIComponent(consumerSecret)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'LumivaCRM-WooSync/1.0',
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `WooCommerce preview: HTTP ${res.status} ${text.slice(0, 200)}`,
      );
    }

    const data = (await res.json().catch(() => null)) as Record<
      string,
      any
    >[] | null;
    if (!Array.isArray(data) || data.length === 0) {
      return {
        columns: [],
        sampleRows: [],
        uniqueValuesByColumn: {},
        sampleOrderCount: 0,
      };
    }

    const rows = data.map((o) => flattenWooOrder(o));
    const columns = mergeColumnKeys(rows);

    const uniqueValuesByColumn: Record<string, string[]> = {};
    for (const col of columns) {
      const set = new Set<string>();
      for (const r of rows) {
        const v = (r[col] ?? '').trim();
        if (v) set.add(v);
        if (set.size >= 100) break;
      }
      uniqueValuesByColumn[col] = [...set].slice(0, 100);
    }

    return {
      columns,
      sampleRows: rows.slice(0, 25),
      uniqueValuesByColumn,
      sampleOrderCount: rows.length,
    };
  }

  /* ────────────────────────────────
   * Основная синхронизация заказов
   * ──────────────────────────────── */

  async syncSales(
    connection: IntegrationConnection,
    context?: IntegrationSyncContext,
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
    const wsMap = context?.wooWorkspaceImport;
    const aggregateImport =
      Boolean(wsMap?.importMode === 'aggregate' && wsMap.aggregateGroupBySourceKeys?.length);
    const maxPages = aggregateImport ? 15 : 5; // при агрегации — больше заказов за прогон
    let page = 1;

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let workspaceCreated = 0;
    let workspaceUpdated = 0;
    let workspaceSkipped = 0;
    const writeWorkspace =
      Boolean(context?.customObjectId?.trim()) && Boolean(context?.tenantId);
    const workspaceObjectId = context?.customObjectId?.trim();
    const workspaceTenantId = context?.tenantId;
    const mappedImport = Boolean(context?.wooWorkspaceImport);
    const workspaceFlats: Record<string, string>[] = [];

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
            try {
              await this.leadsService.ensureLeadLinkedForSale(existing);
            } catch (err) {
              this.logger.warn(
                `ensureLeadLinkedForSale failed: ${(err as Error).message}`,
              );
            }
            updated++;
          } else {
            const entity = this.saleRepo.create(saleData);
            await this.saleRepo.save(entity);
            try {
              await this.leadsService.ensureLeadLinkedForSale(entity);
            } catch (err) {
              this.logger.warn(
                `ensureLeadLinkedForSale failed: ${(err as Error).message}`,
              );
            }
            created++;
          }

          if (writeWorkspace && workspaceObjectId && workspaceTenantId) {
            // Resolve CRM lead by billing email to auto-populate the crm_lead ref field
            let workspaceLeadId: string | null = null;
            const billingEmail = (order as any)?.billing?.email;
            if (billingEmail && typeof billingEmail === 'string' && billingEmail.trim()) {
              try {
                workspaceLeadId = await this.leadsService.findLeadIdByEmail(
                  workspaceTenantId,
                  billingEmail.trim(),
                );
              } catch {
                // non-critical
              }
            }

            if (mappedImport && context?.wooWorkspaceImport) {
              const flat = flattenWooOrder(order as Record<string, any>);
              if (aggregateImport) {
                workspaceFlats.push(flat);
              } else {
                const wr = await this.customObjectsService.upsertRecordFromWooMapped(
                  workspaceTenantId,
                  workspaceObjectId,
                  flat,
                  {
                    enabledWooColumns:
                      context.wooWorkspaceImport.enabledWooColumns,
                    wooColumnToFieldKey:
                      context.wooWorkspaceImport.wooColumnToFieldKey,
                    statusFieldKey:
                      context.wooWorkspaceImport.statusFieldKey ?? null,
                  },
                  workspaceLeadId,
                );
                if (wr === 'created') workspaceCreated++;
                else if (wr === 'updated') workspaceUpdated++;
                else workspaceSkipped++;
              }
            } else {
              const wr = await this.customObjectsService.upsertRecordFromWooOrder(
                workspaceTenantId,
                workspaceObjectId,
                order as Record<string, any>,
                workspaceLeadId,
              );
              if (wr === 'created') workspaceCreated++;
              else if (wr === 'updated') workspaceUpdated++;
              else workspaceSkipped++;
            }
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

      if (
        writeWorkspace &&
        workspaceObjectId &&
        workspaceTenantId &&
        mappedImport &&
        context?.wooWorkspaceImport &&
        aggregateImport &&
        workspaceFlats.length
      ) {
        const mapping = context.wooWorkspaceImport as WooWorkspaceImportMapping;
        const toUpsert = applyWorkspaceImportAggregation(workspaceFlats, mapping);
        for (const flat of toUpsert) {
          const wr = await this.customObjectsService.upsertRecordFromWooMapped(
            workspaceTenantId,
            workspaceObjectId,
            flat,
            {
              enabledWooColumns: mapping.enabledWooColumns,
              wooColumnToFieldKey: mapping.wooColumnToFieldKey,
              statusFieldKey: mapping.statusFieldKey ?? null,
            },
          );
          if (wr === 'created') workspaceCreated++;
          else if (wr === 'updated') workspaceUpdated++;
          else workspaceSkipped++;
        }
      }

      this.logger.log(
        `Woo sync done connection=${connection.id} created=${created}, updated=${updated}, skipped=${skipped}`,
      );

      let message = `Синхронизация WooCommerce выполнена. Создано: ${created}, обновлено: ${updated}, пропущено: ${skipped}.`;
      if (writeWorkspace) {
        message += ` Рабочая область${mappedImport ? ' (по маппингу)' : ''}: записей создано ${workspaceCreated}, обновлено ${workspaceUpdated}, пропущено ${workspaceSkipped}.`;
      } else {
        message +=
          ' Пользовательская таблица не обновлялась: в запросе не передан customObjectId (или в привязанных областях не одна таблица). Запустите синхронизацию из «Импорт данных» нужной таблицы или оставьте одну таблицу в области с этим Woo.';
      }
      return {
        ok: true,
        created,
        updated,
        skipped,
        workspaceCreated: writeWorkspace ? workspaceCreated : undefined,
        workspaceUpdated: writeWorkspace ? workspaceUpdated : undefined,
        workspaceSkipped: writeWorkspace ? workspaceSkipped : undefined,
        message,
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