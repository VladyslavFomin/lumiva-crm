// src/integrations/integrations.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IntegrationConnection } from './integration-connection.entity';
import { CreateIntegrationConnectionDto } from './dto/create-integration-connection.dto';
import { UpdateIntegrationConnectionDto } from './dto/update-integration-connection.dto';
import { IntegrationRegistryService } from './integration-registry.service';

import { SalesChannel } from '../sales-channels/sales-channel.entity';
import { Sale } from '../sales/sale.entity';

import type { IntegrationKind } from './integration-kind.enum';
import { isThirdPartyCatalogId } from './integration-catalog.constants';
import type {
  TestConnectionResult,
  SyncResult,
  IntegrationSyncContext,
  WooWorkspaceImportMapping,
} from './sales-integration.adapter';
import { WooCommerceAdapter } from './woocommerce/woocommerce.adapter';
import {
  flattenMetaAdsInsightRow,
  mergeMetaAdsColumns,
} from './meta-ads/meta-ads-workspace-flat.util';
import {
  mergeGa4WorkspaceColumns,
  ga4WorkspaceRowId,
} from './ga4/ga4-workspace-flat.util';
import { applyWorkspaceImportAggregation } from './workspace-import-aggregate.util';
import axios from 'axios';
import { CustomObjectsService } from '../custom-objects/custom-objects.service';
import { WorkspaceAreasService } from '../workspace-areas/workspace-areas.service';
import { WorkspaceAreaActivityLogService } from '../workspace-areas/workspace-area-activity-log.service';
import { SlackWebhookService } from './slack/slack-webhook.service';
import { TeamsWebhookService } from './teams/teams-webhook.service';
import { ZapierHookService } from './zapier/zapier-hook.service';
import { WhatsappCloudService } from './whatsapp/whatsapp-cloud.service';
import {
  GoogleCalendarService,
  type GoogleCalendarEventItem,
} from './google-calendar/google-calendar.service';
import { OutlookCalendarService } from './outlook/outlook-calendar.service';
import { BitrixRestService } from './bitrix/bitrix-rest.service';
import { AmocrmApiService } from './amocrm/amocrm-api.service';
import { HubspotApiService } from './hubspot/hubspot-api.service';
import { GoogleAdsApiService } from './google-ads/google-ads-api.service';
import { MetaAdsGraphService } from './meta-ads/meta-ads-graph.service';
import { MailchimpApiService } from './mailchimp/mailchimp-api.service';
import { GoogleSheetsSyncService } from './google-sheets/google-sheets-sync.service';
import { TenantsService } from '../tenants/tenants.service';
import { Lead } from '../leads/lead.entity';
import { MarketingService } from '../marketing/marketing.service';

export interface IntegrationConnectionDto {
  id: string;
  name: string;
  kind: IntegrationKind;
  channelId: string | null;
  description: string | null;
  isEnabled: boolean;
  isDeleted: boolean;
  lastSyncAt: Date | null;
  lastSyncStatus: string;
  lastError: string | null;
  totalSalesCount: number;
  totalSalesAmount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  configSnippet?: string | null;
  /** Для kind === third_party_link — id из каталога (slack, …) */
  linkCatalogId?: string | null;
  /** WhatsApp: публичный URL вебхука для Meta (если задан PUBLIC_API_URL) */
  whatsappInboundWebhookUrl?: string | null;
  /** amoCRM: URL для входящих вебхуков (если задан PUBLIC_API_URL) */
  amocrmInboundWebhookUrl?: string | null;
  /** WordPress / CF7: URL для заявок с сайта (если задан PUBLIC_API_URL) */
  siteFormInboundWebhookUrl?: string | null;
  /** Zapier / Make: URL входящего вебхука (если задан PUBLIC_API_URL) */
  zapierMakeInboundWebhookUrl?: string | null;
  /** Lumiva Wizard / CRM Connector: POST лида с X-Api-Token (тот же хост, что и публичный API) */
  lumivaWizardCf7IngestUrl?: string | null;
  /**
   * WordPress / CF7: готовая ссылка для вставки в плагин (с ?secret= при заданном секрете).
   * Заполняется только при includeFullConfig (GET одного подключения / ответ create|update).
   */
  siteFormInboundWebhookPasteUrl?: string | null;
  /** Только GET /integrations/:id — полный config (в т.ч. секреты) для UI редактирования. */
  config?: Record<string, unknown> | null;
}

/** Ответ GET события Google — только поля для UI CRM. */
export interface GoogleCalendarEventSnapshotAttendeeDto {
  email?: string;
  displayName?: string;
  responseStatus?: string;
}

export interface GoogleCalendarEventSnapshotDto {
  summary: string | null;
  description: string | null;
  htmlLink: string | null;
  hangoutLink: string | null;
  meetUri: string | null;
  startDisplay: string | null;
  endDisplay: string | null;
  attendees: GoogleCalendarEventSnapshotAttendeeDto[];
  organizerEmail: string | null;
  organizerDisplayName: string | null;
}

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly repo: Repository<IntegrationConnection>,

    @InjectRepository(Sale)
    private readonly salesRepo: Repository<Sale>,

    @InjectRepository(SalesChannel)
    private readonly channelsRepo: Repository<SalesChannel>,

    private readonly registry: IntegrationRegistryService,

    private readonly slackWebhook: SlackWebhookService,
    private readonly teamsWebhook: TeamsWebhookService,
    private readonly zapierHook: ZapierHookService,
    private readonly whatsappCloud: WhatsappCloudService,
    private readonly googleCalendar: GoogleCalendarService,
    private readonly outlookCalendar: OutlookCalendarService,
    private readonly bitrixRest: BitrixRestService,
    private readonly amocrmApi: AmocrmApiService,
    private readonly hubspotApi: HubspotApiService,
    private readonly googleAdsApi: GoogleAdsApiService,
    private readonly metaAdsGraph: MetaAdsGraphService,
    private readonly mailchimpApi: MailchimpApiService,
    private readonly googleSheetsSync: GoogleSheetsSyncService,

    private readonly tenantsService: TenantsService,

    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,

    private readonly customObjectsService: CustomObjectsService,
    private readonly workspaceAreasService: WorkspaceAreasService,
    private readonly workspaceAreaActivityLog: WorkspaceAreaActivityLogService,
    private readonly wooCommerceAdapter: WooCommerceAdapter,

    private readonly marketingService: MarketingService,
  ) {}

  /** Привязка интеграции к рабочей области таблицы (без проверки типа интеграции). */
  private async assertWorkspaceTableImportAccess(
    tenantId: string,
    integrationId: string,
    customObjectId: string,
  ): Promise<{ entity: IntegrationConnection }> {
    const entity = await this.repo.findOne({
      where: { id: integrationId, tenantId, isDeleted: false } as any,
    });
    if (!entity) throw new NotFoundException('Интеграция не найдена');
    const oid = customObjectId.trim();
    if (!/^[0-9a-f-]{36}$/i.test(oid)) {
      throw new BadRequestException('Некорректный идентификатор таблицы');
    }
    const obj = await this.customObjectsService.getObject(tenantId, oid);
    const wid = obj.workspaceAreaId?.trim();
    if (!wid || !/^[0-9a-f-]{36}$/i.test(wid)) {
      throw new BadRequestException('Таблица не привязана к рабочей области');
    }
    const area = await this.workspaceAreasService.getOne(tenantId, wid);
    if (!this.workspaceAreasService.isIntegrationBoundToArea(area.meta, entity)) {
      throw new ForbiddenException(
        'Эта интеграция не подключена к рабочей области этой таблицы',
      );
    }
    return { entity };
  }

  private async assertMarketingMetaWorkspaceTableAccess(
    tenantId: string,
    marketingIntegrationId: string,
    customObjectId: string,
  ): Promise<void> {
    const oid = customObjectId.trim();
    if (!/^[0-9a-f-]{36}$/i.test(oid)) {
      throw new BadRequestException('Некорректный идентификатор таблицы');
    }
    const obj = await this.customObjectsService.getObject(tenantId, oid);
    const wid = obj.workspaceAreaId?.trim();
    if (!wid || !/^[0-9a-f-]{36}$/i.test(wid)) {
      throw new BadRequestException('Таблица не привязана к рабочей области');
    }
    const area = await this.workspaceAreasService.getOne(tenantId, wid);
    if (
      !this.workspaceAreasService.isMarketingIntegrationBoundToArea(
        area.meta,
        marketingIntegrationId,
        'meta_ads',
      )
    ) {
      throw new ForbiddenException(
        'Эта интеграция маркетинга не подключена к рабочей области этой таблицы',
      );
    }
  }

  private async assertMarketingGa4WorkspaceTableAccess(
    tenantId: string,
    marketingIntegrationId: string,
    customObjectId: string,
  ): Promise<void> {
    const oid = customObjectId.trim();
    if (!/^[0-9a-f-]{36}$/i.test(oid)) {
      throw new BadRequestException('Некорректный идентификатор таблицы');
    }
    const obj = await this.customObjectsService.getObject(tenantId, oid);
    const wid = obj.workspaceAreaId?.trim();
    if (!wid || !/^[0-9a-f-]{36}$/i.test(wid)) {
      throw new BadRequestException('Таблица не привязана к рабочей области');
    }
    const area = await this.workspaceAreasService.getOne(tenantId, wid);
    if (
      !this.workspaceAreasService.isMarketingIntegrationBoundToArea(
        area.meta,
        marketingIntegrationId,
        'google_analytics',
      )
    ) {
      throw new ForbiddenException(
        'Эта интеграция маркетинга не подключена к рабочей области этой таблицы',
      );
    }
  }

  /**
   * Синк Woo из хаба без customObjectId: если к областям с привязкой этого подключения
   * относится ровно одна активная таблица — импортируем в неё (эвристика полей).
   */
  private async tryResolveSingleWooWorkspaceObjectId(
    tenantId: string,
    entity: IntegrationConnection,
  ): Promise<string | null> {
    if (entity.kind !== 'woocommerce') return null;
    const areas = await this.workspaceAreasService.list(tenantId);
    const tableIds = new Set<string>();
    for (const area of areas) {
      if (!this.workspaceAreasService.isIntegrationBoundToArea(area.meta, entity)) {
        continue;
      }
      const objects = await this.customObjectsService.listObjects(tenantId, area.id);
      for (const o of objects) {
        if (o.isActive) tableIds.add(o.id);
      }
    }
    if (tableIds.size !== 1) return null;
    return [...tableIds][0] ?? null;
  }

  private async validateWorkspaceImportMapping(
    tenantId: string,
    customObjectId: string,
    m: WooWorkspaceImportMapping,
  ): Promise<void> {
    if (!Array.isArray(m.enabledWooColumns) || m.enabledWooColumns.length === 0) {
      throw new BadRequestException('Отметьте хотя бы одну колонку для импорта');
    }
    const fieldList = await this.customObjectsService.listFields(
      tenantId,
      customObjectId,
    );
    const fieldKeys = new Set(fieldList.filter((f) => f.isActive).map((f) => f.key));
    for (const wc of m.enabledWooColumns) {
      const fk = (m.wooColumnToFieldKey[wc] || '').trim();
      if (!fk) {
        throw new BadRequestException(
          `Сопоставьте поле таблицы для колонки «${wc}»`,
        );
      }
      if (!fieldKeys.has(fk)) {
        throw new BadRequestException(`Поле «${fk}» не найдено в таблице`);
      }
    }
    if (m.statusFieldKey?.trim() && !fieldKeys.has(m.statusFieldKey.trim())) {
      throw new BadRequestException('Указанное поле статуса не найдено в таблице');
    }
    if (m.importMode === 'aggregate') {
      const gk = m.aggregateGroupBySourceKeys?.map((x) => x.trim()).filter(Boolean) ?? [];
      if (!gk.length) {
        throw new BadRequestException(
          'При суммировании укажите хотя бы одно поле группировки (колонки источника)',
        );
      }
      const enabled = new Set(m.enabledWooColumns);
      for (const k of gk) {
        if (!enabled.has(k)) {
          throw new BadRequestException(
            `Поле группировки «${k}» должно быть включено в импорт (галочка колонки)`,
          );
        }
      }
    }
  }

  /** Превью заказов Woo как плоских колонок для настройки импорта в таблицу. */
  async previewWooWorkspaceImport(
    tenantId: string,
    integrationId: string,
    customObjectId: string,
  ) {
    const { entity } = await this.assertWorkspaceTableImportAccess(
      tenantId,
      integrationId,
      customObjectId,
    );
    if (entity.kind !== 'woocommerce') {
      throw new BadRequestException('Превью доступно только для WooCommerce');
    }
    return this.wooCommerceAdapter.previewWorkspaceImport(entity, 25);
  }

  private async resolveMetaAdsActPath(entity: IntegrationConnection): Promise<{
    accessToken: string;
    actPath: string;
  }> {
    if (entity.kind !== 'third_party_link' || !entity.configJson) {
      throw new BadRequestException('Некорректное подключение Meta Ads');
    }
    let cfg: { catalogId?: string; apiToken?: string; webhookUrl?: string };
    try {
      cfg = JSON.parse(entity.configJson) as {
        catalogId?: string;
        apiToken?: string;
        webhookUrl?: string;
      };
    } catch {
      throw new BadRequestException('Некорректный config подключения');
    }
    if (cfg.catalogId !== 'meta_ads') {
      throw new BadRequestException('Превью Meta Ads только для каталога meta_ads');
    }
    const accessToken = typeof cfg.apiToken === 'string' ? cfg.apiToken.trim() : '';
    if (!accessToken) {
      throw new BadRequestException('Укажите Marketing API access token в подключении');
    }
    const url = typeof cfg.webhookUrl === 'string' ? cfg.webhookUrl.trim() : '';
    const digits = url.replace(/\D/g, '');
    if (digits.length >= 8) {
      return { accessToken, actPath: `act_${digits}` };
    }
    const me = (await this.metaAdsGraph.request({
      accessToken,
      method: 'GET',
      path: 'me/adaccounts?fields=id&limit=5',
    })) as { data?: Array<{ id?: string }> };
    const id = me?.data?.[0]?.id;
    if (!id) {
      throw new BadRequestException(
        'Не найден рекламный аккаунт: укажите ID счёта (цифры) в поле URL/Webhook при подключении Meta Ads',
      );
    }
    return {
      accessToken,
      actPath: id.startsWith('act_') ? id : `act_${id}`,
    };
  }

  /** Превью insights Meta (кампания × день) для импорта в таблицу. */
  async previewMetaAdsWorkspaceImport(
    tenantId: string,
    integrationId: string,
    customObjectId: string,
  ) {
    const { entity } = await this.assertWorkspaceTableImportAccess(
      tenantId,
      integrationId,
      customObjectId,
    );
    const cat = this.parseThirdPartyLinkCatalogId(entity);
    if (entity.kind !== 'third_party_link' || cat !== 'meta_ads') {
      throw new BadRequestException('Превью доступно только для Meta Ads');
    }
    const { accessToken, actPath } = await this.resolveMetaAdsActPath(entity);
    return this.buildMetaAdsWorkspaceImportPreview(accessToken, actPath);
  }

  /** Превью Meta по интеграции из раздела «Маркетинг» (тот же Graph API). */
  async previewMetaAdsWorkspaceImportFromMarketing(
    tenantId: string,
    marketingIntegrationId: string,
    customObjectId: string,
  ) {
    await this.assertMarketingMetaWorkspaceTableAccess(
      tenantId,
      marketingIntegrationId,
      customObjectId,
    );
    const { accessToken, actPath } =
      await this.marketingService.getMetaAdsGraphCredentialsForWorkspace(
        tenantId,
        marketingIntegrationId,
      );
    return this.buildMetaAdsWorkspaceImportPreview(accessToken, actPath);
  }

  private async buildMetaAdsWorkspaceImportPreview(
    accessToken: string,
    actPath: string,
  ) {
    const raw = await this.metaAdsGraph.fetchCampaignInsightsDaily(
      accessToken,
      actPath,
      { limit: 80, maxPages: 1 },
    );
    const rows = raw.map((r) => flattenMetaAdsInsightRow(r));
    for (const r of rows) {
      r.id = `${r.campaign_id || 'c'}_${r.date_start || 'd'}`.replace(/\s+/g, '');
    }
    const columns = mergeMetaAdsColumns(rows);
    const uniqueValuesByColumn: Record<string, string[]> = {};
    for (const col of columns) {
      const set = new Set<string>();
      for (const r of rows) {
        const v = (r[col] || '').trim();
        if (v) set.add(v);
        if (set.size >= 100) break;
      }
      uniqueValuesByColumn[col] = [...set].slice(0, 100);
    }
    return {
      columns,
      sampleRows: rows.slice(0, 40),
      uniqueValuesByColumn,
      sampleOrderCount: rows.length,
    };
  }

  private async syncMetaAdsWorkspaceImportRun(
    tenantId: string,
    entity: IntegrationConnection,
    customObjectId: string,
    mapping: WooWorkspaceImportMapping,
  ): Promise<SyncResult> {
    const { accessToken, actPath } = await this.resolveMetaAdsActPath(entity);
    return this.syncMetaAdsWorkspaceImportWithGraph(
      tenantId,
      customObjectId,
      mapping,
      accessToken,
      actPath,
    );
  }

  async syncMetaAdsWorkspaceImportFromMarketing(
    tenantId: string,
    marketingIntegrationId: string,
    customObjectId: string,
    mapping: WooWorkspaceImportMapping,
  ): Promise<SyncResult> {
    await this.assertMarketingMetaWorkspaceTableAccess(
      tenantId,
      marketingIntegrationId,
      customObjectId,
    );
    await this.validateWorkspaceImportMapping(tenantId, customObjectId, mapping);
    const { accessToken, actPath } =
      await this.marketingService.getMetaAdsGraphCredentialsForWorkspace(
        tenantId,
        marketingIntegrationId,
      );
    return this.syncMetaAdsWorkspaceImportWithGraph(
      tenantId,
      customObjectId,
      mapping,
      accessToken,
      actPath,
    );
  }

  private async syncMetaAdsWorkspaceImportWithGraph(
    tenantId: string,
    customObjectId: string,
    mapping: WooWorkspaceImportMapping,
    accessToken: string,
    actPath: string,
  ): Promise<SyncResult> {
    /** Меньше страниц, чем теоретический максимум — иначе запрос импорта не укладывается в таймаут прокси. */
    const raw = await this.metaAdsGraph.fetchCampaignInsightsDaily(
      accessToken,
      actPath,
      { limit: 500, maxPages: 6 },
    );
    const MAX_META_WORKSPACE_ROWS = 4000;
    const rows = raw.slice(0, MAX_META_WORKSPACE_ROWS);
    const flats: Record<string, string>[] = [];
    for (const item of rows) {
      const flat = flattenMetaAdsInsightRow(item as Record<string, unknown>);
      flat.id = `${flat.campaign_id || 'c'}_${flat.date_start || 'd'}`.replace(/\s+/g, '');
      flats.push(flat);
    }
    const toUpsert = applyWorkspaceImportAggregation(flats, mapping);
    let workspaceCreated = 0;
    let workspaceUpdated = 0;
    let workspaceSkipped = 0;
    for (const flat of toUpsert) {
      const wr = await this.customObjectsService.upsertRecordFromWooMapped(
        tenantId,
        customObjectId,
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
    const message = `Meta Ads → таблица: создано ${workspaceCreated}, обновлено ${workspaceUpdated}, пропущено ${workspaceSkipped}.`;
    return {
      ok: true,
      created: 0,
      updated: 0,
      skipped: 0,
      workspaceCreated,
      workspaceUpdated,
      workspaceSkipped,
      message,
    };
  }

  private ga4WorkspaceDimensionDateToIso(raw: string): string | null {
    const v = String(raw).replace(/-/g, '');
    if (/^\d{8}$/.test(v)) {
      return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return raw.slice(0, 10);
    }
    return null;
  }

  private mapGa4RunReportRowToWorkspaceFlat(r: {
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }): Record<string, string> {
    const rawD = r.dimensionValues?.[0]?.value;
    const dateStr = this.ga4WorkspaceDimensionDateToIso(String(rawD ?? '')) ?? '';
    const rawCountry = String(r.dimensionValues?.[1]?.value ?? '').trim();
    const src = String(r.dimensionValues?.[2]?.value ?? '').trim() || '(not set)';
    const med = String(r.dimensionValues?.[3]?.value ?? '').trim() || '(not set)';
    const camp = String(r.dimensionValues?.[4]?.value ?? '').trim() || '(not set)';
    return {
      date: dateStr,
      country_id: rawCountry,
      session_source: src,
      session_medium: med,
      session_campaign_name: camp,
      sessions: String(r.metricValues?.[0]?.value ?? ''),
      screen_page_views: String(r.metricValues?.[1]?.value ?? ''),
    };
  }

  /** За один HTTP-запрос импорта — верхняя граница строк (иначе 504 у прокси). */
  private static readonly MAX_GA4_WORKSPACE_IMPORT_ROWS = 3000;

  private async ga4WorkspaceFetchReportPage(
    accessToken: string,
    propertyId: string,
    offset: number,
    limit: number,
  ): Promise<
    Array<{
      dimensionValues?: Array<{ value?: string }>;
      metricValues?: Array<{ value?: string }>;
    }>
  > {
    const apiUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
    try {
      const res = await axios.post(
        apiUrl,
        {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensions: [
            { name: 'date' },
            { name: 'countryId' },
            { name: 'sessionSource' },
            { name: 'sessionMedium' },
            { name: 'sessionCampaignName' },
          ],
          metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }],
          limit,
          offset,
          orderBys: [
            { dimension: { dimensionName: 'date', orderType: 'ALPHANUMERIC' } },
            { dimension: { dimensionName: 'countryId', orderType: 'ALPHANUMERIC' } },
            { dimension: { dimensionName: 'sessionSource', orderType: 'ALPHANUMERIC' } },
            { dimension: { dimensionName: 'sessionMedium', orderType: 'ALPHANUMERIC' } },
            {
              dimension: {
                dimensionName: 'sessionCampaignName',
                orderType: 'ALPHANUMERIC',
              },
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000,
        },
      );
      const batch = res.data?.rows as
        | Array<{
            dimensionValues?: Array<{ value?: string }>;
            metricValues?: Array<{ value?: string }>;
          }>
        | undefined;
      return Array.isArray(batch) ? batch : [];
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const st = err.response?.status;
        const raw = err.response?.data;
        const snippet =
          typeof raw === 'string'
            ? raw.slice(0, 400)
            : raw && typeof raw === 'object'
              ? JSON.stringify(raw).slice(0, 400)
              : '';
        throw new BadRequestException(
          `GA4 Data API (${st ?? '?'}): ${snippet || err.message}`,
        );
      }
      throw err;
    }
  }

  /** Превью отчёта GA4 (маркетинг) для импорта в таблицу. */
  async previewGa4WorkspaceImportFromMarketing(
    tenantId: string,
    marketingIntegrationId: string,
    customObjectId: string,
  ) {
    await this.assertMarketingGa4WorkspaceTableAccess(
      tenantId,
      marketingIntegrationId,
      customObjectId,
    );
    const { accessToken, propertyId } =
      await this.marketingService.getGa4WorkspaceReportingAccess(
        tenantId,
        marketingIntegrationId,
      );
    const page = await this.ga4WorkspaceFetchReportPage(accessToken, propertyId, 0, 500);
    const rowObjs: Record<string, string>[] = [];
    for (const r of page) {
      const flat = this.mapGa4RunReportRowToWorkspaceFlat(r);
      if (!flat.date) continue;
      flat.id = ga4WorkspaceRowId(flat);
      rowObjs.push(flat);
    }
    const columns = mergeGa4WorkspaceColumns(rowObjs);
    const uniqueValuesByColumn: Record<string, string[]> = {};
    for (const col of columns) {
      const set = new Set<string>();
      for (const row of rowObjs) {
        const v = (row[col] || '').trim();
        if (v) set.add(v);
        if (set.size >= 100) break;
      }
      uniqueValuesByColumn[col] = [...set].slice(0, 100);
    }
    return {
      columns,
      sampleRows: rowObjs.slice(0, 40),
      uniqueValuesByColumn,
      sampleOrderCount: rowObjs.length,
    };
  }

  async syncGa4WorkspaceImportFromMarketing(
    tenantId: string,
    marketingIntegrationId: string,
    customObjectId: string,
    mapping: WooWorkspaceImportMapping,
  ): Promise<SyncResult> {
    await this.assertMarketingGa4WorkspaceTableAccess(
      tenantId,
      marketingIntegrationId,
      customObjectId,
    );
    await this.validateWorkspaceImportMapping(tenantId, customObjectId, mapping);
    const { accessToken, propertyId } =
      await this.marketingService.getGa4WorkspaceReportingAccess(
        tenantId,
        marketingIntegrationId,
      );
    return this.syncGa4WorkspaceImportWithGraph(
      tenantId,
      customObjectId,
      mapping,
      accessToken,
      propertyId,
    );
  }

  private async syncGa4WorkspaceImportWithGraph(
    tenantId: string,
    customObjectId: string,
    mapping: WooWorkspaceImportMapping,
    accessToken: string,
    propertyId: string,
  ): Promise<SyncResult> {
    let workspaceCreated = 0;
    let workspaceUpdated = 0;
    let workspaceSkipped = 0;
    const pageLimit = 1500;
    let offset = 0;
    let totalImported = 0;
    const maxRows = IntegrationsService.MAX_GA4_WORKSPACE_IMPORT_ROWS;
    const collected: Record<string, string>[] = [];
    outer: for (let p = 0; p < 12; p++) {
      const batch = await this.ga4WorkspaceFetchReportPage(
        accessToken,
        propertyId,
        offset,
        pageLimit,
      );
      if (!batch.length) break;
      for (const r of batch) {
        if (totalImported >= maxRows) break outer;
        const flat = this.mapGa4RunReportRowToWorkspaceFlat(r);
        if (!flat.date) continue;
        flat.id = ga4WorkspaceRowId(flat);
        collected.push(flat);
        totalImported++;
      }
      if (batch.length < pageLimit) break;
      offset += pageLimit;
    }
    const toUpsert = applyWorkspaceImportAggregation(collected, mapping);
    for (const flat of toUpsert) {
      const wr = await this.customObjectsService.upsertRecordFromWooMapped(
        tenantId,
        customObjectId,
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
    const capped = totalImported >= maxRows;
    const message = `GA4 → таблица: создано ${workspaceCreated}, обновлено ${workspaceUpdated}, пропущено ${workspaceSkipped}${
      capped ? ` (лимит за один запрос: ${maxRows} строк; при необходимости повторите импорт).` : '.'
    }`;
    return {
      ok: true,
      created: 0,
      updated: 0,
      skipped: 0,
      workspaceCreated,
      workspaceUpdated,
      workspaceSkipped,
      message,
    };
  }

  private parseThirdPartyLinkCatalogId(entity: IntegrationConnection): string | null {
    if (entity.kind !== 'third_party_link' || !entity.configJson) return null;
    try {
      const cid = (JSON.parse(entity.configJson) as { catalogId?: string }).catalogId;
      return typeof cid === 'string' && cid.length > 0 ? cid : null;
    } catch {
      return null;
    }
  }

  /**
   * Флаги clientcabinet / chat на тенанте: true, если есть хотя бы одно включённое
   * подключение Lumiva Wizard соответствующего каталога (несколько сайтов / интеграций).
   */
  private async recomputeLumivaWizardAddonTenantModules(tenantId: string): Promise<void> {
    const rows = await this.repo.find({
      where: { tenantId, isDeleted: false, kind: 'third_party_link' } as any,
    });
    const anyCabinet = rows.some(
      (r) =>
        r.isEnabled &&
        this.parseThirdPartyLinkCatalogId(r) === 'lumiva_client_cabinet',
    );
    const anyChat = rows.some(
      (r) =>
        r.isEnabled && this.parseThirdPartyLinkCatalogId(r) === 'lumiva_online_chat',
    );
    await this.tenantsService.reconcileTenantModule(tenantId, 'clientcabinet', anyCabinet);
    await this.tenantsService.reconcileTenantModule(tenantId, 'chat', anyChat);
  }

  /* ============================================================
   * DTO
   * ============================================================ */
  private toDto(
    entity: IntegrationConnection,
    opts?: { includeFullConfig?: boolean },
  ): IntegrationConnectionDto {
    let snippet: string | null = null;
    let linkCatalogId: string | null = null;
    let whatsappInboundWebhookUrl: string | null = null;
    let amocrmInboundWebhookUrl: string | null = null;
    let siteFormInboundWebhookUrl: string | null = null;
    let siteFormInboundWebhookPasteUrl: string | null = null;
    let lumivaWizardCf7IngestUrl: string | null = null;
    let zapierMakeInboundWebhookUrl: string | null = null;

    if (entity.configJson) {
      try {
        const cfg = JSON.parse(entity.configJson);
        if (cfg.consumerKey) snippet = '…' + String(cfg.consumerKey).slice(-4);
        if (cfg.apiKey) snippet = '…' + String(cfg.apiKey).slice(-4);
        if (entity.kind === 'shopify' && cfg.shopDomain) snippet = String(cfg.shopDomain);
        if (entity.kind === 'third_party_link' && cfg.catalogId) {
          linkCatalogId = String(cfg.catalogId);
          snippet = linkCatalogId;
          const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
          if (linkCatalogId === 'whatsapp' && base) {
            whatsappInboundWebhookUrl = `${base}/v1/webhooks/whatsapp/${entity.id}`;
          }
          if (linkCatalogId === 'amocrm' && base) {
            amocrmInboundWebhookUrl = `${base}/v1/webhooks/amocrm/${entity.id}`;
          }
          if (linkCatalogId === 'wordpress_cf7' && base) {
            siteFormInboundWebhookUrl = `${base}/v1/webhooks/site-forms/${entity.id}`;
            lumivaWizardCf7IngestUrl = `${base}/v1/marketing/leads/cf7`;
            if (opts?.includeFullConfig && siteFormInboundWebhookUrl) {
              const sec = String(cfg.webhookInboundSecret || '').trim();
              siteFormInboundWebhookPasteUrl =
                sec.length >= 6
                  ? `${siteFormInboundWebhookUrl}?secret=${encodeURIComponent(sec)}`
                  : siteFormInboundWebhookUrl;
            }
          }
          if ((linkCatalogId === 'zapier' || linkCatalogId === 'make') && base) {
            const inboundToken = String(cfg.inboundToken || '').trim();
            zapierMakeInboundWebhookUrl =
              `${base}/v1/webhooks/zapier-make/${entity.id}` +
              (inboundToken ? `?token=${encodeURIComponent(inboundToken)}` : '');
          }
        }
      } catch {
        // ignore
      }
    }

    const dto: IntegrationConnectionDto = {
      id: entity.id,
      name: entity.name,
      kind: entity.kind,
      channelId: entity.channelId ?? null,
      description: entity.description ?? null,
      isEnabled: entity.isEnabled,
      isDeleted: entity.isDeleted,
      lastSyncAt: entity.lastSyncAt,
      lastSyncStatus: entity.lastSyncStatus,
      lastError: entity.lastError,
      totalSalesAmount: entity.totalSalesAmount,
      totalSalesCount: entity.totalSalesCount,
      currency: entity.currency,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      configSnippet: snippet,
      linkCatalogId,
      whatsappInboundWebhookUrl,
      amocrmInboundWebhookUrl,
      siteFormInboundWebhookUrl,
      siteFormInboundWebhookPasteUrl,
      lumivaWizardCf7IngestUrl,
      zapierMakeInboundWebhookUrl,
    };

    if (opts?.includeFullConfig && entity.configJson) {
      try {
        dto.config = JSON.parse(entity.configJson) as Record<string, unknown>;
      } catch {
        dto.config = null;
      }
    }

    return dto;
  }

  private kindUsesSalesChannel(kind: IntegrationKind): boolean {
    return kind === 'woocommerce' || kind === 'manual-import' || kind === 'other';
  }

  /* ============================================================
   * КАНАЛ ДЛЯ ИНТЕГРАЦИИ (tenant-safe)
   * ============================================================ */
  private async ensureChannel(
    tenantId: string,
    entity: IntegrationConnection,
  ): Promise<SalesChannel> {
    if (entity.tenantId && entity.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied');
    }

    // 1) Если интеграция уже привязана к каналу — проверим, что канал НАШЕГО tenant
    if (entity.channelId) {
      const existing = await this.channelsRepo.findOne({
        where: { id: entity.channelId, tenantId, isDeleted: false } as any,
      });

      if (existing) {
        let dirty = false;

        if (existing.integrationId !== entity.id) {
          existing.integrationId = entity.id;
          dirty = true;
        }
        if (existing.integrationName !== entity.name) {
          existing.integrationName = entity.name;
          dirty = true;
        }
        if ((existing as any).currency !== (entity.currency || 'EUR')) {
          (existing as any).currency = entity.currency || 'EUR';
          dirty = true;
        }

        if (dirty) await this.channelsRepo.save(existing);
        return existing;
      }

      // channelId указывает на чужой tenant или удалённый канал — отвязываем
      entity.channelId = null;
      await this.repo.save(entity);
    }

    // 2) Создаём новый канал
    // ВАЖНО: TypeORM typings иногда выбирают overload массива -> TS думает, что это SalesChannel[]
    // Поэтому приводим через unknown.
    const channel = (this.channelsRepo.create({
      name: entity.name,
      type: 'other',
      integrationId: entity.id,
      integrationName: entity.name,
      currency: entity.currency || 'EUR',
      isEnabled: true,
      isDeleted: false,
      tenantId,
    } as any) as unknown) as SalesChannel;

    const savedChannel = ((await this.channelsRepo.save(channel)) as unknown) as SalesChannel;

    // 3) Привязка канала к интеграции
    entity.channelId = savedChannel.id;
    entity.tenantId = tenantId;
    await this.repo.save(entity);

    return savedChannel;
  }

  /* ============================================================
   * CRUD (tenant-safe)
   * ============================================================ */

  async findAllForTenant(tenantId: string): Promise<IntegrationConnectionDto[]> {
    const list = await this.repo.find({
      where: { tenantId, isDeleted: false } as any,
      order: { createdAt: 'DESC' },
    });
    return list.map((e) => this.toDto(e));
  }

  async findOneForTenant(
    tenantId: string,
    id: string,
  ): Promise<IntegrationConnectionDto> {
    const entity = await this.repo.findOne({
      where: { id, tenantId, isDeleted: false } as any,
    });
    if (!entity) throw new NotFoundException('Интеграция не найдена');
    return this.toDto(entity, { includeFullConfig: true });
  }

  /** Сырая entity (не DTO) — нужна там, где конфиг может быть переписан обратно (напр. ротация OAuth refresh token у Jira). */
  async findEntityForTenant(tenantId: string, id: string): Promise<IntegrationConnection> {
    const entity = await this.repo.findOne({
      where: { id, tenantId, isDeleted: false } as any,
    });
    if (!entity) throw new NotFoundException('Интеграция не найдена');
    return entity;
  }

  async createForTenant(
    tenantId: string,
    dto: CreateIntegrationConnectionDto,
  ): Promise<IntegrationConnectionDto> {
    if (dto.kind === 'third_party_link') {
      const cid = dto.config?.catalogId;
      const s = cid !== undefined && cid !== null ? String(cid) : '';
      if (!s || !isThirdPartyCatalogId(s)) {
        throw new BadRequestException(
          'Для подключения внешнего сервиса укажите config.catalogId (slack, ms_teams, …)',
        );
      }
    }

    // Аналогично: typings иногда выбирают overload массива -> TS думает, что это IntegrationConnection[]
    const entity = (this.repo.create({
      tenantId,
      name: dto.name,
      kind: dto.kind as any,
      description: dto.description ?? null,
      configJson: dto.config ? JSON.stringify(dto.config) : null,
      isEnabled: dto.isEnabled ?? true,
      isDeleted: false,
      lastSyncStatus: 'never',
      channelId: dto.channelId ?? null,
    } as any) as unknown) as IntegrationConnection;

    const saved = ((await this.repo.save(entity)) as unknown) as IntegrationConnection;

    if (this.kindUsesSalesChannel(saved.kind as IntegrationKind)) {
      await this.ensureChannel(tenantId, saved);
    }
    await this.recomputeLumivaWizardAddonTenantModules(tenantId);
    return this.toDto(saved, { includeFullConfig: true });
  }

  async updateForTenant(
    tenantId: string,
    id: string,
    dto: UpdateIntegrationConnectionDto,
  ): Promise<IntegrationConnectionDto> {
    const entity = await this.repo.findOne({ where: { id, tenantId } as any });
    if (!entity || entity.isDeleted) {
      throw new NotFoundException('Интеграция не найдена');
    }

    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.kind !== undefined) entity.kind = dto.kind as any;
    if (dto.channelId !== undefined) entity.channelId = dto.channelId;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.isEnabled !== undefined) entity.isEnabled = dto.isEnabled;
    if (dto.isDeleted !== undefined) entity.isDeleted = dto.isDeleted;
    if (dto.config !== undefined) {
      entity.configJson = dto.config === null ? null : JSON.stringify(dto.config);
    }

    const saved = ((await this.repo.save(entity)) as unknown) as IntegrationConnection;

    if (this.kindUsesSalesChannel(saved.kind as IntegrationKind)) {
      await this.ensureChannel(tenantId, saved);
    }
    await this.recomputeLumivaWizardAddonTenantModules(tenantId);
    return this.toDto(saved, { includeFullConfig: true });
  }

  async softDeleteForTenant(tenantId: string, id: string): Promise<void> {
    const entity = await this.repo.findOne({ where: { id, tenantId } as any });
    if (!entity) throw new NotFoundException('Интеграция не найдена');

    entity.isDeleted = true;
    await this.repo.save(entity);
    await this.recomputeLumivaWizardAddonTenantModules(tenantId);
  }

  /* ============================================================
   * ТЕСТ ПОДКЛЮЧЕНИЯ (tenant-safe)
   * ============================================================ */
  async testConnectionForTenant(
    tenantId: string,
    id: string,
  ): Promise<TestConnectionResult> {
    const entity = await this.repo.findOne({
      where: { id, tenantId, isDeleted: false } as any,
    });
    if (!entity) throw new NotFoundException('Интеграция не найдена');

    const adapter = this.registry.getAdapter(entity.kind);
    if (!adapter) {
      return { ok: false, message: `Адаптер ${entity.kind} не найден` };
    }

    return adapter.testConnection(entity);
  }

  /* ============================================================
   * АГРЕГАТЫ ПО ПРОДАЖАМ (tenant-safe)
   * ============================================================ */
  private async refreshAggregates(
  tenantId: string,
  entity: IntegrationConnection,
  ): Promise<void> {
  if (!entity.channelId) return;

  const agg = await this.salesRepo
    .createQueryBuilder('s')
    .select('COUNT(*)', 'cnt')
    .addSelect('COALESCE(SUM(s.amount),0)', 'sum')
    // ВАЖНО: колонка в БД = channel_id
    .where('s.channel_id = :cid', { cid: entity.channelId })
    .getRawOne<{ cnt: string; sum: string }>();

  entity.totalSalesCount = Number(agg?.cnt ?? 0);
  entity.totalSalesAmount = Number(agg?.sum ?? 0);

  const byCurrency = await this.salesRepo
    .createQueryBuilder('s')
    .select('s.currency', 'currency')
    .addSelect('COUNT(*)', 'cnt')
    .where('s.channel_id = :cid', { cid: entity.channelId })
    .groupBy('s.currency')
    .orderBy('cnt', 'DESC')
    .limit(1)
    .getRawMany<{ currency: string; cnt: string }>();

  if (byCurrency.length) entity.currency = byCurrency[0].currency;
  }

  /* ============================================================
   * СИНХРОНИЗАЦИЯ (tenant-safe)
   * ============================================================ */
  async syncForTenant(
    tenantId: string,
    id: string,
    opts?: {
      customObjectId?: string;
      wooWorkspaceImport?: WooWorkspaceImportMapping;
      metaAdsWorkspaceImport?: WooWorkspaceImportMapping;
    },
  ): Promise<SyncResult> {
    const entity = await this.repo.findOne({
      where: { id, tenantId, isDeleted: false } as any,
    });
    if (!entity) throw new NotFoundException('Интеграция не найдена');

    if (opts?.metaAdsWorkspaceImport && opts?.wooWorkspaceImport) {
      throw new BadRequestException(
        'Укажите только один тип маппинга импорта (Woo или Meta Ads)',
      );
    }

    let customObjectIdForWorkspace: string | undefined;
    let wooHubImplicitWorkspaceObject = false;
    const oidRaw = opts?.customObjectId?.trim();
    if (oidRaw) {
      await this.assertWorkspaceTableImportAccess(tenantId, id, oidRaw);
      customObjectIdForWorkspace = oidRaw;
    } else if (!opts?.wooWorkspaceImport && !opts?.metaAdsWorkspaceImport) {
      const implicitOid = await this.tryResolveSingleWooWorkspaceObjectId(
        tenantId,
        entity,
      );
      if (implicitOid) {
        await this.assertWorkspaceTableImportAccess(tenantId, id, implicitOid);
        customObjectIdForWorkspace = implicitOid;
        wooHubImplicitWorkspaceObject = true;
      }
    }

    if (opts?.metaAdsWorkspaceImport) {
      if (!customObjectIdForWorkspace) {
        throw new BadRequestException(
          'Укажите customObjectId вместе с маппингом импорта',
        );
      }
      const cat = this.parseThirdPartyLinkCatalogId(entity);
      if (entity.kind !== 'third_party_link' || cat !== 'meta_ads') {
        throw new BadRequestException(
          'Импорт по маппингу Meta Ads доступен только для подключения Meta Ads',
        );
      }
      await this.validateWorkspaceImportMapping(
        tenantId,
        customObjectIdForWorkspace,
        opts.metaAdsWorkspaceImport,
      );
      const startedAt = new Date();
      const result = await this.syncMetaAdsWorkspaceImportRun(
        tenantId,
        entity,
        customObjectIdForWorkspace,
        opts.metaAdsWorkspaceImport,
      );
      entity.lastSyncAt = startedAt;
      entity.lastSyncStatus = result.ok ? 'ok' : 'error';
      entity.lastError = result.ok ? null : result.message ?? null;
      await this.repo.save(entity);
      await this.logWorkspaceSync(tenantId, customObjectIdForWorkspace, entity.name, result);
      return result;
    }

    if (opts?.wooWorkspaceImport) {
      if (!customObjectIdForWorkspace) {
        throw new BadRequestException(
          'Укажите customObjectId вместе с маппингом импорта',
        );
      }
      if (entity.kind !== 'woocommerce') {
        throw new BadRequestException(
          'Маппинг Woo доступен только для подключения WooCommerce',
        );
      }
      await this.validateWorkspaceImportMapping(
        tenantId,
        customObjectIdForWorkspace,
        opts.wooWorkspaceImport,
      );
    }

    const syncContext: IntegrationSyncContext = {
      tenantId,
      ...(customObjectIdForWorkspace
        ? { customObjectId: customObjectIdForWorkspace }
        : {}),
      ...(opts?.wooWorkspaceImport && customObjectIdForWorkspace
        ? { wooWorkspaceImport: opts.wooWorkspaceImport }
        : {}),
    };

    if (this.kindUsesSalesChannel(entity.kind as IntegrationKind)) {
      await this.ensureChannel(tenantId, entity);
    }

    const adapter = this.registry.getAdapter(entity.kind);
    if (!adapter) {
      const msg = `Адаптер ${entity.kind} не найден`;
      entity.lastError = msg;
      entity.lastSyncAt = new Date();
      entity.lastSyncStatus = 'error';
      await this.repo.save(entity);
      return { ok: false, created: 0, updated: 0, skipped: 0, message: msg };
    }

    const startedAt = new Date();

    try {
      let result: SyncResult;
      if (entity.kind === 'third_party_link' && entity.configJson) {
        try {
          const parsed = JSON.parse(entity.configJson) as { catalogId?: string };
          if (parsed?.catalogId === 'google_calendar') {
            result = await this.syncGoogleCalendarWithLeads(tenantId, entity);
          } else {
            result = await adapter.syncSales(entity, syncContext);
          }
        } catch {
          result = await adapter.syncSales(entity, syncContext);
        }
      } else {
        result = await adapter.syncSales(entity, syncContext);
      }

      await this.refreshAggregates(tenantId, entity);

      entity.lastSyncAt = startedAt;
      entity.lastSyncStatus = result.ok ? 'ok' : 'error';
      entity.lastError = result.ok ? null : result.message ?? null;

      await this.repo.save(entity);
      await this.logWorkspaceSync(tenantId, customObjectIdForWorkspace, entity.name, result);

      if (result.ok && entity.kind === 'third_party_link') {
        let cfgCatalog: string | undefined;
        if (entity.configJson) {
          try {
            cfgCatalog = (JSON.parse(entity.configJson) as { catalogId?: string })?.catalogId;
          } catch {
            cfgCatalog = undefined;
          }
        }
        if (cfgCatalog === 'google_sheets') {
          if (this.googleSheetsSync.shouldEnqueuePull(entity)) {
            const enq = await this.googleSheetsSync.enqueuePullFromConnection(
              tenantId,
              entity.id,
            );
            const tail = enq.enqueued
              ? ' Задача чтения таблицы поставлена в очередь (обработка обычно до 1–2 минут). Счётчики (+0/0) относятся к «продажам» канала, а не к лидам: новые лиды появятся после фоновой обработки, если в строке есть email или телефон и колонки сопоставлены.'
              : ' Задача чтения таблицы уже в очереди — дождитесь завершения предыдущего запуска.';
            result = { ...result, message: (result.message || '') + tail };
          } else {
            result = {
              ...result,
              message:
                (result.message || '') +
                ' Импорт строк из таблицы не запущен: проверьте цель (лиды или рабочая область с объектом), ID таблицы, вкладку, токен и диапазон или выбранные строки. Счётчики (+0/0) не отражают созданные лиды. Настройки меняются в разделе Продажи → Интеграции.',
            };
          }
        } else if (this.googleSheetsSync.shouldEnqueuePull(entity)) {
          await this.googleSheetsSync.enqueuePullFromConnection(tenantId, entity.id);
        }
      }

      if (
        result.ok &&
        wooHubImplicitWorkspaceObject &&
        entity.kind === 'woocommerce'
      ) {
        result = {
          ...result,
          message:
            (result.message || '') +
            ' Таблица выбрана автоматически (одна активная таблица в области с привязкой Woo). Поля по эвристике; свой маппинг колонок — в «Импорт данных».',
        };
      }

      return result;
    } catch (e) {
      const msg = (e as Error).message ?? 'Неизвестная ошибка';

      entity.lastSyncAt = startedAt;
      entity.lastSyncStatus = 'error';
      entity.lastError = msg;
      await this.repo.save(entity);
      await this.logWorkspaceSync(tenantId, customObjectIdForWorkspace, entity.name, {
        ok: false,
        created: 0,
        updated: 0,
        skipped: 0,
        message: msg,
      });

      return { ok: false, created: 0, updated: 0, skipped: 0, message: msg };
    }
  }

  /** Пишет событие в журнал области, только если этот запуск синка целился в конкретную
   * таблицу рабочей области — иначе (обычный синк продаж без workspace-таблицы) молчим. */
  private async logWorkspaceSync(
    tenantId: string,
    customObjectId: string | undefined,
    connectionName: string,
    result: SyncResult,
  ): Promise<void> {
    if (!customObjectId) return;
    try {
      const obj = await this.customObjectsService.getObject(tenantId, customObjectId);
      await this.workspaceAreaActivityLog.log(
        tenantId,
        obj.workspaceAreaId,
        result.ok ? 'sync' : 'error',
        result.ok
          ? `Синхронизация «${connectionName}»`
          : `Ошибка синхронизации «${connectionName}»`,
        result.ok
          ? `Добавлено ${result.created}, обновлено ${result.updated}, пропущено ${result.skipped}`
          : result.message || null,
        { relatedObjectId: customObjectId },
      );
    } catch {
      // getObject 404 or similar — nothing meaningful to log against
    }
  }

  /** URL Incoming Webhook для подключения Slack этого тенанта */
  async getSlackWebhookUrlForConnection(
    tenantId: string,
    connectionId: string,
  ): Promise<string | null> {
    const entity = await this.repo.findOne({
      where: { id: connectionId, tenantId, isDeleted: false } as any,
    });
    if (!entity || entity.kind !== 'third_party_link' || !entity.configJson) {
      return null;
    }
    let cfg: { catalogId?: string; webhookUrl?: string };
    try {
      cfg = JSON.parse(entity.configJson) as { catalogId?: string; webhookUrl?: string };
    } catch {
      return null;
    }
    if (cfg.catalogId !== 'slack') return null;
    const url = typeof cfg.webhookUrl === 'string' ? cfg.webhookUrl.trim() : '';
    if (!url.startsWith('https://') || !url.includes('hooks.slack.com')) {
      return null;
    }
    return url;
  }

  async sendSlackIncomingWebhookRaw(webhookUrl: string, text: string): Promise<void> {
    await this.slackWebhook.postIncomingWebhook(webhookUrl.trim(), { text });
  }

  async getTeamsWebhookUrlForConnection(
    tenantId: string,
    connectionId: string,
  ): Promise<string | null> {
    const entity = await this.repo.findOne({
      where: { id: connectionId, tenantId, isDeleted: false } as any,
    });
    if (!entity || entity.kind !== 'third_party_link' || !entity.configJson) {
      return null;
    }
    let cfg: { catalogId?: string; webhookUrl?: string };
    try {
      cfg = JSON.parse(entity.configJson) as { catalogId?: string; webhookUrl?: string };
    } catch {
      return null;
    }
    if (cfg.catalogId !== 'ms_teams') return null;
    const url = typeof cfg.webhookUrl === 'string' ? cfg.webhookUrl.trim() : '';
    if (
      !url.startsWith('https://') ||
      (!url.includes('webhook.office.com') && !url.includes('outlook.office.com/webhook'))
    ) {
      return null;
    }
    return url;
  }

  async sendTeamsIncomingWebhookRaw(
    webhookUrl: string,
    title: string,
    text: string,
  ): Promise<void> {
    await this.teamsWebhook.postConnectorCard(webhookUrl.trim(), title, text);
  }

  /** API key Mailchimp из подключения third_party_link · mailchimp */
  async getMailchimpApiKeyForConnection(
    tenantId: string,
    connectionId: string,
  ): Promise<string | null> {
    const entity = await this.repo.findOne({
      where: { id: connectionId, tenantId, isDeleted: false } as any,
    });
    if (!entity || entity.kind !== 'third_party_link' || !entity.configJson) {
      return null;
    }
    let cfg: { catalogId?: string; apiToken?: string };
    try {
      cfg = JSON.parse(entity.configJson) as { catalogId?: string; apiToken?: string };
    } catch {
      return null;
    }
    if (cfg.catalogId !== 'mailchimp') return null;
    const tok = typeof cfg.apiToken === 'string' ? cfg.apiToken.trim() : '';
    return tok.length >= 8 ? tok : null;
  }

  async mailchimpUpsertMemberRaw(
    apiKey: string,
    listId: string,
    email: string,
    mergeFields: Record<string, unknown> | Record<string, string>,
    options?: { status?: 'subscribed' | 'pending' },
  ): Promise<void> {
    const st = options?.status === 'pending' ? 'pending' : 'subscribed';
    await this.mailchimpApi.upsertListMember(
      apiKey,
      listId,
      email,
      mergeFields,
      st,
    );
  }

  /** Разовая кампания Mailchimp: вся аудитория list_id, затем send */
  async mailchimpCreateAndSendCampaignRaw(
    apiKey: string,
    params: {
      listId: string;
      subjectLine: string;
      campaignTitle: string;
      fromName: string;
      replyTo: string;
      html: string;
      plainText?: string;
    },
  ): Promise<{ campaignId: string }> {
    const { id } = await this.mailchimpApi.createRegularCampaignAndSend(
      apiKey,
      params,
    );
    return { campaignId: id };
  }

  async getZapierWebhookUrlForConnection(
    tenantId: string,
    connectionId: string,
  ): Promise<string | null> {
    const entity = await this.repo.findOne({
      where: { id: connectionId, tenantId, isDeleted: false } as any,
    });
    if (!entity || entity.kind !== 'third_party_link' || !entity.configJson) {
      return null;
    }
    let cfg: { catalogId?: string; webhookUrl?: string };
    try {
      cfg = JSON.parse(entity.configJson) as { catalogId?: string; webhookUrl?: string };
    } catch {
      return null;
    }
    if (cfg.catalogId !== 'zapier') return null;
    const url = typeof cfg.webhookUrl === 'string' ? cfg.webhookUrl.trim() : '';
    if (!url.startsWith('https://') || !url.includes('hooks.zapier.com')) {
      return null;
    }
    return url;
  }

  async postZapierCatchHookRaw(
    webhookUrl: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.zapierHook.postCatchHook(webhookUrl.trim(), payload);
  }

  async getWhatsappCredentialsForConnection(
    tenantId: string,
    connectionId: string,
  ): Promise<{ phoneNumberId: string; accessToken: string } | null> {
    const entity = await this.repo.findOne({
      where: { id: connectionId, tenantId, isDeleted: false } as any,
    });
    if (!entity || entity.kind !== 'third_party_link' || !entity.configJson) {
      return null;
    }
    let cfg: { catalogId?: string; apiToken?: string; phoneNumberId?: string };
    try {
      cfg = JSON.parse(entity.configJson) as {
        catalogId?: string;
        apiToken?: string;
        phoneNumberId?: string;
      };
    } catch {
      return null;
    }
    if (cfg.catalogId !== 'whatsapp') return null;
    const accessToken = typeof cfg.apiToken === 'string' ? cfg.apiToken.trim() : '';
    const phoneNumberId =
      (typeof cfg.phoneNumberId === 'string' ? cfg.phoneNumberId.trim() : '') ||
      (typeof (cfg as any).phone_number_id === 'string'
        ? String((cfg as any).phone_number_id).trim()
        : '');
    if (!accessToken || !phoneNumberId) return null;
    return { phoneNumberId, accessToken };
  }

  async sendWhatsappTextRaw(
    phoneNumberId: string,
    accessToken: string,
    to: string,
    body: string,
  ): Promise<{ messageId?: string }> {
    return this.whatsappCloud.sendTextMessage({ phoneNumberId, accessToken, to, body });
  }

  async getGoogleCalendarCredentialsForConnection(
    tenantId: string,
    connectionId: string,
  ): Promise<{ accessToken: string; calendarId: string } | null> {
    const entity = await this.repo.findOne({
      where: { id: connectionId, tenantId, isDeleted: false } as any,
    });
    if (!entity || entity.kind !== 'third_party_link' || !entity.configJson) {
      return null;
    }
    let cfg: {
      catalogId?: string;
      apiToken?: string;
      accountEmail?: string;
      calendarId?: string;
      oauthRefreshToken?: string;
    };
    try {
      cfg = JSON.parse(entity.configJson) as {
        catalogId?: string;
        apiToken?: string;
        accountEmail?: string;
        calendarId?: string;
        oauthRefreshToken?: string;
      };
    } catch {
      return null;
    }
    if (cfg.catalogId !== 'google_calendar') return null;
    return this.googleCalendar.resolveAccessFromConfig({
      apiToken: cfg.apiToken,
      oauthRefreshToken: cfg.oauthRefreshToken,
      calendarId: cfg.calendarId,
      accountEmail: cfg.accountEmail,
    });
  }

  async createGoogleCalendarEventRaw(
    accessToken: string,
    calendarId: string,
    params: {
      summary: string;
      description?: string;
      startIso: string;
      endIso: string;
      timeZone: string;
    },
  ): Promise<{ id?: string }> {
    return this.googleCalendar.insertEvent({
      accessToken,
      calendarId,
      summary: params.summary,
      description: params.description,
      startIso: params.startIso,
      endIso: params.endIso,
      timeZone: params.timeZone,
    });
  }

  async getOutlookCalendarCredentialsForConnection(
    tenantId: string,
    connectionId: string,
  ): Promise<{ accessToken: string; calendarGraphId: string | null } | null> {
    const entity = await this.repo.findOne({
      where: { id: connectionId, tenantId, isDeleted: false } as any,
    });
    if (!entity || entity.kind !== 'third_party_link' || !entity.configJson) {
      return null;
    }
    let cfg: {
      catalogId?: string;
      apiToken?: string;
      accountEmail?: string;
      calendarId?: string;
      oauthRefreshToken?: string;
    };
    try {
      cfg = JSON.parse(entity.configJson) as {
        catalogId?: string;
        apiToken?: string;
        accountEmail?: string;
        calendarId?: string;
        oauthRefreshToken?: string;
      };
    } catch {
      return null;
    }
    if (cfg.catalogId !== 'outlook') return null;
    const resolved = await this.outlookCalendar.resolveAccessFromConfig({
      apiToken: cfg.apiToken,
      oauthRefreshToken: cfg.oauthRefreshToken,
      calendarId: cfg.calendarId,
    });
    if (resolved?.rotatedRefreshToken) {
      // Иначе после нескольких автоматических обновлений Microsoft в какой-то момент
      // инвалидирует исходный refresh_token (обычная ротация для offline_access), и
      // синхронизация календаря начинает падать invalid_grant без предупреждения.
      await this.patchOutlookCalendarOAuthTokens(tenantId, connectionId, resolved.rotatedRefreshToken).catch(() => undefined);
    }
    return resolved ? { accessToken: resolved.accessToken, calendarGraphId: resolved.calendarGraphId } : null;
  }

  async createOutlookCalendarOAuthConnection(
    tenantId: string,
    params: { name: string; calendarId: string; oauthRefreshToken: string },
  ): Promise<IntegrationConnectionDto> {
    const cal = (params.calendarId || '').trim();
    return this.createForTenant(tenantId, {
      name: params.name.trim() || 'Outlook Calendar',
      kind: 'third_party_link',
      config: {
        catalogId: 'outlook',
        ...(cal ? { calendarId: cal } : {}),
        oauthRefreshToken: params.oauthRefreshToken.trim(),
        calendarOAuth: true,
        authMode: 'oauth',
      },
      isEnabled: true,
    });
  }

  async patchOutlookCalendarOAuthTokens(
    tenantId: string,
    integrationId: string,
    oauthRefreshToken: string,
  ): Promise<IntegrationConnectionDto> {
    const entity = await this.repo.findOne({
      where: { id: integrationId, tenantId, isDeleted: false } as any,
    });
    if (!entity || entity.kind !== 'third_party_link' || !entity.configJson) {
      throw new NotFoundException('Подключение не найдено');
    }
    let cfg: Record<string, unknown>;
    try {
      cfg = JSON.parse(entity.configJson) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Некорректный config подключения');
    }
    if (String(cfg.catalogId) !== 'outlook') {
      throw new BadRequestException('Подключение не является Outlook Calendar');
    }
    cfg.oauthRefreshToken = oauthRefreshToken.trim();
    cfg.calendarOAuth = true;
    cfg.authMode = 'oauth';
    return this.updateForTenant(tenantId, integrationId, { config: cfg });
  }

  async createOutlookCalendarEventRaw(
    accessToken: string,
    calendarGraphId: string | null,
    params: {
      subject: string;
      bodyText?: string;
      startIsoUtc: string;
      endIsoUtc: string;
    },
  ): Promise<{ id?: string }> {
    return this.outlookCalendar.insertEvent({
      accessToken,
      calendarGraphId,
      subject: params.subject,
      bodyText: params.bodyText,
      startIsoUtc: params.startIsoUtc,
      endIsoUtc: params.endIsoUtc,
    });
  }

  async getBitrixWebhookBaseForConnection(
    tenantId: string,
    connectionId: string,
  ): Promise<string | null> {
    const entity = await this.repo.findOne({
      where: { id: connectionId, tenantId, isDeleted: false } as any,
    });
    if (!entity || entity.kind !== 'third_party_link' || !entity.configJson) {
      return null;
    }
    let cfg: { catalogId?: string; webhookUrl?: string };
    try {
      cfg = JSON.parse(entity.configJson) as { catalogId?: string; webhookUrl?: string };
    } catch {
      return null;
    }
    if (cfg.catalogId !== 'bitrix') return null;
    const url = typeof cfg.webhookUrl === 'string' ? cfg.webhookUrl.trim() : '';
    if (!url.startsWith('https://') || !url.toLowerCase().includes('/rest/')) {
      return null;
    }
    return this.bitrixRest.normalizeWebhookBase(url);
  }

  async callBitrixRestMethodRaw(
    webhookBaseUrl: string,
    method: string,
    payload: Record<string, unknown>,
  ): Promise<unknown> {
    return this.bitrixRest.callMethod(webhookBaseUrl, method, payload);
  }

  async getAmocrmCredentialsForConnection(
    tenantId: string,
    connectionId: string,
  ): Promise<{ baseUrl: string; accessToken: string } | null> {
    const entity = await this.repo.findOne({
      where: { id: connectionId, tenantId, isDeleted: false } as any,
    });
    if (!entity || entity.kind !== 'third_party_link' || !entity.configJson) {
      return null;
    }
    let cfg: { catalogId?: string; webhookUrl?: string; apiToken?: string };
    try {
      cfg = JSON.parse(entity.configJson) as {
        catalogId?: string;
        webhookUrl?: string;
        apiToken?: string;
      };
    } catch {
      return null;
    }
    if (cfg.catalogId !== 'amocrm') return null;
    const baseRaw = typeof cfg.webhookUrl === 'string' ? cfg.webhookUrl.trim() : '';
    const accessToken = typeof cfg.apiToken === 'string' ? cfg.apiToken.trim() : '';
    if (
      !baseRaw.startsWith('https://') ||
      !baseRaw.toLowerCase().includes('amocrm.') ||
      !accessToken
    ) {
      return null;
    }
    return {
      baseUrl: this.amocrmApi.normalizeBaseUrl(baseRaw),
      accessToken,
    };
  }

  async callAmocrmApiRaw(
    baseUrl: string,
    accessToken: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    return this.amocrmApi.request({
      baseUrl: this.amocrmApi.normalizeBaseUrl(baseUrl),
      accessToken,
      method,
      path,
      body,
    });
  }

  async getHubspotCredentialsForConnection(
    tenantId: string,
    connectionId: string,
  ): Promise<{ baseUrl: string; accessToken: string } | null> {
    const entity = await this.repo.findOne({
      where: { id: connectionId, tenantId, isDeleted: false } as any,
    });
    if (!entity || entity.kind !== 'third_party_link' || !entity.configJson) {
      return null;
    }
    let cfg: {
      catalogId?: string;
      webhookUrl?: string;
      apiToken?: string;
      oauthRefreshToken?: string;
    };
    try {
      cfg = JSON.parse(entity.configJson) as {
        catalogId?: string;
        webhookUrl?: string;
        apiToken?: string;
        oauthRefreshToken?: string;
      };
    } catch {
      return null;
    }
    if (cfg.catalogId !== 'hubspot') return null;
    const accessToken = await this.hubspotApi.resolveAccessFromConfig({
      apiToken: cfg.apiToken,
      oauthRefreshToken: cfg.oauthRefreshToken,
    });
    if (!accessToken) return null;
    const customBase =
      typeof cfg.webhookUrl === 'string' && cfg.webhookUrl.trim().length > 0
        ? cfg.webhookUrl.trim()
        : undefined;
    try {
      const baseUrl = this.hubspotApi.normalizeBaseUrl(customBase);
      return { baseUrl, accessToken };
    } catch {
      return null;
    }
  }

  async callHubspotApiRaw(
    baseUrl: string,
    accessToken: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    return this.hubspotApi.request({
      baseUrl: this.hubspotApi.normalizeBaseUrl(baseUrl),
      accessToken,
      method,
      path,
      body,
    });
  }

  async getGoogleAdsCredentialsForConnection(
    tenantId: string,
    connectionId: string,
  ): Promise<{
    developerToken: string;
    accessToken: string;
    customerId: string | null;
  } | null> {
    const entity = await this.repo.findOne({
      where: { id: connectionId, tenantId, isDeleted: false } as any,
    });
    if (!entity || entity.kind !== 'third_party_link' || !entity.configJson) {
      return null;
    }
    let cfg: {
      catalogId?: string;
      apiToken?: string;
      webhookUrl?: string;
      developerToken?: string;
    };
    try {
      cfg = JSON.parse(entity.configJson) as {
        catalogId?: string;
        apiToken?: string;
        webhookUrl?: string;
        developerToken?: string;
      };
    } catch {
      return null;
    }
    if (cfg.catalogId !== 'google_ads') return null;
    const accessToken = typeof cfg.apiToken === 'string' ? cfg.apiToken.trim() : '';
    const developerToken =
      typeof cfg.developerToken === 'string' ? cfg.developerToken.trim() : '';
    if (!accessToken || !developerToken) return null;
    const cidRaw = typeof cfg.webhookUrl === 'string' ? cfg.webhookUrl.trim().replace(/\D/g, '') : '';
    const customerId = cidRaw.length > 0 ? cidRaw : null;
    return { developerToken, accessToken, customerId };
  }

  async callGoogleAdsApiRaw(
    developerToken: string,
    oauthAccessToken: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    return this.googleAdsApi.request({
      developerToken,
      oauthAccessToken,
      method,
      path,
      body,
    });
  }

  async getMetaAdsCredentialsForConnection(
    tenantId: string,
    connectionId: string,
  ): Promise<{ accessToken: string } | null> {
    const entity = await this.repo.findOne({
      where: { id: connectionId, tenantId, isDeleted: false } as any,
    });
    if (!entity || entity.kind !== 'third_party_link' || !entity.configJson) {
      return null;
    }
    let cfg: { catalogId?: string; apiToken?: string };
    try {
      cfg = JSON.parse(entity.configJson) as { catalogId?: string; apiToken?: string };
    } catch {
      return null;
    }
    if (cfg.catalogId !== 'meta_ads') return null;
    const accessToken = typeof cfg.apiToken === 'string' ? cfg.apiToken.trim() : '';
    if (!accessToken) return null;
    return { accessToken };
  }

  async callMetaAdsGraphRaw(
    accessToken: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    return this.metaAdsGraph.request({
      accessToken,
      method,
      path,
      body,
    });
  }

  private defaultCalendarTimeZone(): string {
    return (process.env.CRM_DEFAULT_TIMEZONE || 'UTC').trim() || 'UTC';
  }

  async createGoogleCalendarOAuthConnection(
    tenantId: string,
    params: { name: string; calendarId: string; oauthRefreshToken: string },
  ): Promise<IntegrationConnectionDto> {
    const cal = (params.calendarId || 'primary').trim() || 'primary';
    return this.createForTenant(tenantId, {
      name: params.name.trim() || 'Google Calendar',
      kind: 'third_party_link',
      config: {
        catalogId: 'google_calendar',
        calendarId: cal,
        oauthRefreshToken: params.oauthRefreshToken.trim(),
        calendarOAuth: true,
        authMode: 'oauth',
      },
      isEnabled: true,
    });
  }

  async patchGoogleCalendarOAuthTokens(
    tenantId: string,
    integrationId: string,
    oauthRefreshToken: string,
  ): Promise<IntegrationConnectionDto> {
    const entity = await this.repo.findOne({
      where: { id: integrationId, tenantId, isDeleted: false } as any,
    });
    if (!entity || entity.kind !== 'third_party_link' || !entity.configJson) {
      throw new NotFoundException('Подключение не найдено');
    }
    let cfg: Record<string, unknown>;
    try {
      cfg = JSON.parse(entity.configJson) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Некорректный config подключения');
    }
    if (String(cfg.catalogId) !== 'google_calendar') {
      throw new BadRequestException('Подключение не является Google Calendar');
    }
    cfg.oauthRefreshToken = oauthRefreshToken.trim();
    cfg.calendarOAuth = true;
    cfg.authMode = 'oauth';
    return this.updateForTenant(tenantId, integrationId, { config: cfg });
  }

  private async findPrimaryGoogleCalendarConnection(
    tenantId: string,
  ): Promise<IntegrationConnection | null> {
    const rows = await this.repo.find({
      where: { tenantId, isDeleted: false, kind: 'third_party_link' } as any,
    });
    const enabled = rows.filter((r) => r.isEnabled);
    for (const r of enabled) {
      if (!r.configJson) continue;
      try {
        const cfg = JSON.parse(r.configJson) as { catalogId?: string };
        if (cfg.catalogId === 'google_calendar') return r;
      } catch {
        continue;
      }
    }
    return null;
  }

  /**
   * Импорт изменений событий из Google → встречи в meta.leads (только события с метками Lumiva).
   */
  async syncGoogleCalendarWithLeads(
    tenantId: string,
    entity: IntegrationConnection,
  ): Promise<SyncResult> {
    const creds = await this.getGoogleCalendarCredentialsForConnection(tenantId, entity.id);
    if (!creds) {
      return {
        ok: false,
        created: 0,
        updated: 0,
        skipped: 0,
        message:
          'Google Calendar: нет действительного токена (OAuth или access token). Переподключите интеграцию.',
      };
    }
    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setDate(timeMin.getDate() - 120);
    const timeMax = new Date(now);
    timeMax.setDate(timeMax.getDate() + 400);
    const timeMinIso = timeMin.toISOString();
    const timeMaxIso = timeMax.toISOString();
    const extProp = `lumivaTenantId=${tenantId}`;
    let items: GoogleCalendarEventItem[];
    try {
      items = await this.googleCalendar.listEvents({
        accessToken: creds.accessToken,
        calendarId: creds.calendarId,
        timeMinIso,
        timeMaxIso,
        privateExtendedProperty: extProp,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        created: 0,
        updated: 0,
        skipped: 0,
        message: `Google Calendar: не удалось загрузить события — ${msg}`,
      };
    }

    let updated = 0;
    let skipped = 0;
    for (const ev of items) {
      const priv = ev.extendedProperties?.private;
      const leadId = priv?.lumivaLeadId?.trim();
      const meetingId = priv?.lumivaMeetingId?.trim();
      const startDt = ev.start?.dateTime || (ev.start?.date ? `${ev.start.date}T00:00:00` : '');
      const endDt = ev.end?.dateTime || (ev.end?.date ? `${ev.end.date}T23:59:59` : '');
      if (!leadId || !meetingId || !startDt) {
        skipped += 1;
        continue;
      }
      const lead = await this.leadRepo.findOne({ where: { id: leadId, tenantId } as any });
      if (!lead) {
        skipped += 1;
        continue;
      }
      const meta = { ...((lead.meta as Record<string, unknown>) || {}) };
      const meetingsRaw = meta.meetings;
      const meetings = Array.isArray(meetingsRaw) ? [...meetingsRaw] : [];
      const idx = meetings.findIndex(
        (m: { id?: string }) => String((m as { id?: string }).id) === meetingId,
      );
      if (idx < 0) {
        skipped += 1;
        continue;
      }
      const cur = meetings[idx] as Record<string, unknown>;
      meetings[idx] = {
        ...cur,
        title: typeof ev.summary === 'string' && ev.summary.trim() ? ev.summary.trim() : cur.title,
        startsAt: startDt,
        endsAt: endDt || cur.endsAt,
        googleCalendarEventId: typeof ev.id === 'string' ? ev.id : cur.googleCalendarEventId,
      };
      meta.meetings = meetings;
      await this.leadRepo.update(lead.id, { meta: meta as any });
      updated += 1;
    }

    return {
      ok: true,
      created: 0,
      updated,
      skipped,
      message: `Google Calendar: импорт из Google завершён (обновлено встреч в лидах: ${updated}, пропущено: ${skipped}).`,
    };
  }

  /**
   * CRM → Google: создание/обновление/удаление событий; вызывается после сохранения лида.
   */
  async onLeadMeetingsChanged(
    tenantId: string,
    lead: Lead,
    previousMeetings: unknown[] | null | undefined,
  ): Promise<void> {
    const conn = await this.findPrimaryGoogleCalendarConnection(tenantId);
    if (!conn) return;
    const creds = await this.getGoogleCalendarCredentialsForConnection(tenantId, conn.id);
    if (!creds) return;

    const tz = this.defaultCalendarTimeZone();
    const meta = (lead.meta || {}) as Record<string, unknown>;
    let meetings = Array.isArray(meta.meetings) ? [...meta.meetings] : [];
    const prev = Array.isArray(previousMeetings) ? previousMeetings : [];
    const currIds = new Set(
      meetings.map((m: { id?: string }) => String((m as { id?: string }).id || '')),
    );

    for (const p of prev) {
      const row = p as { id?: string; googleCalendarEventId?: string };
      const pid = String(row.id || '');
      const gid = String(row.googleCalendarEventId || '').trim();
      if (gid && !currIds.has(pid)) {
        try {
          await this.googleCalendar.deleteEvent({
            accessToken: creds.accessToken,
            calendarId: creds.calendarId,
            eventId: gid,
          });
        } catch {
          /* уже удалено в Google */
        }
      }
    }

    const priv = {
      lumivaTenantId: tenantId,
      lumivaLeadId: lead.id,
    };

    for (const raw of meetings) {
      const m = raw as Record<string, unknown>;
      const mid = String(m.id || '').trim();
      const startsAt = String(m.startsAt || '').trim();
      if (!mid || !startsAt) continue;

      const title =
        (typeof m.title === 'string' && m.title.trim()) ||
        `Встреча (лид ${lead.name || lead.id})`;
      const notes = typeof m.notes === 'string' ? m.notes : '';
      const url = typeof m.meetingUrl === 'string' ? m.meetingUrl : '';
      const desc = [notes, url ? `Ссылка: ${url}` : ''].filter(Boolean).join('\n');
      let endIso = typeof m.endsAt === 'string' && String(m.endsAt).trim() ? String(m.endsAt) : '';
      if (!endIso) {
        const d = new Date(startsAt);
        d.setHours(d.getHours() + 1);
        endIso = d.toISOString();
      }

      const ext = { ...priv, lumivaMeetingId: mid };
      const existingGid =
        typeof m.googleCalendarEventId === 'string' ? m.googleCalendarEventId.trim() : '';
      const addGoogleMeet = !GoogleCalendarService.suppressAutoGoogleMeet(url);

      try {
        if (existingGid) {
          await this.googleCalendar.patchEvent({
            accessToken: creds.accessToken,
            calendarId: creds.calendarId,
            eventId: existingGid,
            summary: title,
            description: desc || undefined,
            startIso: startsAt,
            endIso,
            timeZone: tz,
            extendedProperties: { private: ext },
            createMeetConference: addGoogleMeet,
          });
        } else {
          const created = await this.googleCalendar.insertEvent({
            accessToken: creds.accessToken,
            calendarId: creds.calendarId,
            summary: title,
            description: desc || undefined,
            startIso: startsAt,
            endIso,
            timeZone: tz,
            extendedProperties: { private: ext },
            createMeetConference: addGoogleMeet,
          });
          const newId = typeof created.id === 'string' ? created.id : '';
          if (newId) {
            const nextMeetings = meetings.map((row: unknown) => {
              const o = row as Record<string, unknown>;
              if (String(o.id || '') !== mid) return o;
              return { ...o, googleCalendarEventId: newId };
            });
            meetings = nextMeetings as typeof meetings;
            await this.leadRepo.update(lead.id, {
              meta: { ...meta, meetings: nextMeetings } as any,
            });
          }
        }
      } catch (e: unknown) {
        console.error(
          `Google Calendar sync for lead ${lead.id} meeting ${mid}: ${(e as Error)?.message || e}`,
        );
      }
    }
  }

  /** Ссылка на видеовстречу (Meet) из ответа Google. */
  private pickMeetUriFromGoogleEventRaw(raw: Record<string, unknown>): string | null {
    const hang = typeof raw.hangoutLink === 'string' ? raw.hangoutLink.trim() : '';
    if (hang) return hang;
    const cd = raw.conferenceData as
      | { entryPoints?: { entryPointType?: string; uri?: string }[] }
      | undefined;
    const eps = cd?.entryPoints;
    if (Array.isArray(eps)) {
      for (const ep of eps) {
        const u = typeof ep?.uri === 'string' ? ep.uri.trim() : '';
        if (u.includes('meet.google.com')) return u;
      }
      const video = eps.find((x) => x?.uri && x.entryPointType === 'video');
      if (video?.uri) return String(video.uri).trim();
      const anyUri = eps.find((x) => typeof x?.uri === 'string' && /^https?:\/\//i.test(x.uri));
      if (anyUri?.uri) return String(anyUri.uri).trim();
    }
    const loc = raw.location;
    if (typeof loc === 'string') {
      const m = loc.match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/i);
      if (m) return m[0];
    }
    return null;
  }

  private mapGoogleEventRawToSnapshotDto(
    raw: Record<string, unknown>,
  ): GoogleCalendarEventSnapshotDto {
    const summary = typeof raw.summary === 'string' ? raw.summary : null;
    const description = typeof raw.description === 'string' ? raw.description : null;
    const htmlLink = typeof raw.htmlLink === 'string' ? raw.htmlLink : null;
    const hangoutLink = typeof raw.hangoutLink === 'string' ? raw.hangoutLink : null;
    const meetUri = this.pickMeetUriFromGoogleEventRaw(raw);
    const start = raw.start as { dateTime?: string; date?: string; timeZone?: string } | undefined;
    const end = raw.end as { dateTime?: string; date?: string; timeZone?: string } | undefined;
    const startDisplay =
      (typeof start?.dateTime === 'string' && start.dateTime) ||
      (typeof start?.date === 'string' && start.date) ||
      null;
    const endDisplay =
      (typeof end?.dateTime === 'string' && end.dateTime) ||
      (typeof end?.date === 'string' && end.date) ||
      null;
    const attendeesRaw = raw.attendees;
    const attendees: GoogleCalendarEventSnapshotAttendeeDto[] = Array.isArray(attendeesRaw)
      ? attendeesRaw
          .filter((a): a is Record<string, unknown> => a !== null && typeof a === 'object')
          .map((a) => ({
            email: typeof a.email === 'string' ? a.email : undefined,
            displayName: typeof a.displayName === 'string' ? a.displayName : undefined,
            responseStatus: typeof a.responseStatus === 'string' ? a.responseStatus : undefined,
          }))
      : [];
    const org = raw.organizer as { email?: string; displayName?: string } | undefined;
    return {
      summary,
      description,
      htmlLink,
      hangoutLink: hangoutLink || meetUri,
      meetUri,
      startDisplay,
      endDisplay,
      attendees,
      organizerEmail: typeof org?.email === 'string' ? org.email : null,
      organizerDisplayName: typeof org?.displayName === 'string' ? org.displayName : null,
    };
  }

  /**
   * Детали события из Google Calendar (Meet, участники, описание).
   * Доступно только если у события в private extendedProperties указан lumivaTenantId этого тенанта.
   */
  async getGoogleCalendarEventSnapshot(
    tenantId: string,
    eventId: string,
  ): Promise<GoogleCalendarEventSnapshotDto> {
    const id = eventId.trim();
    if (!id) {
      throw new BadRequestException('Пустой идентификатор события');
    }
    const conn = await this.findPrimaryGoogleCalendarConnection(tenantId);
    if (!conn) {
      throw new NotFoundException('Google Calendar не подключён для этого тенанта');
    }
    const creds = await this.getGoogleCalendarCredentialsForConnection(tenantId, conn.id);
    if (!creds) {
      throw new BadRequestException(
        'Нет действительного токена Google Calendar — переподключите интеграцию.',
      );
    }
    let raw: Record<string, unknown>;
    try {
      raw = await this.googleCalendar.getEventRaw({
        accessToken: creds.accessToken,
        calendarId: creds.calendarId,
        eventId: id,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(msg);
    }
    const ext = raw.extendedProperties as { private?: Record<string, string> } | undefined;
    const priv = ext?.private;
    if (!priv?.lumivaTenantId || String(priv.lumivaTenantId).trim() !== tenantId) {
      throw new ForbiddenException(
        'Событие не связано с этим тенантом Lumiva (нет метки в Google Calendar).',
      );
    }
    return this.mapGoogleEventRawToSnapshotDto(raw);
  }
}