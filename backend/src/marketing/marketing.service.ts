import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import { createHmac, createSign } from 'crypto';
import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MarketingTraffic } from './marketing-traffic.entity';
import { ImportTrafficDto } from './dto/import-traffic.dto';
import { MarketingUtmTemplate } from './marketing-utm-template.entity';
import { MarketingIntegration } from './marketing-integration.entity';
import { MarketingAutomation } from './marketing-automation.entity';
import { CreateUtmTemplateDto } from './dto/utm-template.dto';
import { CreateMarketingIntegrationDto } from './dto/create-marketing-integration.dto';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { SeoSettings } from './seo-settings.entity';
import { SeoGscMetric } from './seo-gsc-metric.entity';
import { SeoPageSpeedMetric } from './seo-pagespeed-metric.entity';
import { SeoGscDaily } from './seo-gsc-daily.entity';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

export interface MarketingTrafficRow {
  date: string; // YYYY-MM-DD
  source: string | null;
  medium: string | null;
  campaign: string | null;

  sessions: number;
  clicks: number;
  leads: number;

  cost: number;
  revenue: number;
  currency: string;
}

export interface MarketingTrafficStats {
  currency: string;
  totalSessions: number;
  totalLeads: number;
  totalRevenue: number;
  totalCost: number;
  items: MarketingTrafficRow[];
}

type TrafficUpsertRow = {
  date: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  sessions: number;
  clicks: number;
  leads: number;
  cost: number;
  revenue: number;
  currency: string;
  system?: 'analytics' | 'ads' | 'manual';
};

@Injectable()
export class MarketingService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @InjectRepository(MarketingTraffic)
    private readonly trafficRepo: Repository<MarketingTraffic>,

    @InjectRepository(MarketingUtmTemplate)
    private readonly utmRepo: Repository<MarketingUtmTemplate>,

    @InjectRepository(MarketingIntegration)
    private readonly integrationRepo: Repository<MarketingIntegration>,

    @InjectRepository(MarketingAutomation)
    private readonly automationRepo: Repository<MarketingAutomation>,

    @InjectRepository(SeoSettings)
    private readonly seoSettingsRepo: Repository<SeoSettings>,

    @InjectRepository(SeoGscMetric)
    private readonly seoGscRepo: Repository<SeoGscMetric>,

    @InjectRepository(SeoPageSpeedMetric)
    private readonly seoPsiRepo: Repository<SeoPageSpeedMetric>,

    @InjectRepository(SeoGscDaily)
    private readonly seoGscDailyRepo: Repository<SeoGscDaily>,

    private readonly platformSettings: PlatformSettingsService,
  ) {}

  private seoSyncTimer?: NodeJS.Timeout;
  private seoSyncRunning = false;

  onModuleInit() {
    const disabled = process.env.SEO_SYNC_DISABLED === 'true';
    if (disabled) return;
    const minutes = Number(process.env.SEO_SYNC_INTERVAL_MIN || 360);
    const intervalMs = Math.max(10, minutes) * 60 * 1000;
    this.seoSyncTimer = setInterval(() => {
      void this.syncSeoForAllTenants();
    }, intervalMs);
    // первичный запуск через минуту
    setTimeout(() => {
      void this.syncSeoForAllTenants();
    }, 60 * 1000);
  }

  onModuleDestroy() {
    if (this.seoSyncTimer) {
      clearInterval(this.seoSyncTimer);
    }
  }

  // ===== ТРАФИК =====
  async getTrafficForTenant(
    tenantId: string,
    from?: string,
    to?: string,
  ): Promise<MarketingTrafficStats> {
    const where: FindOptionsWhere<MarketingTraffic> = { tenantId };

    if (from && to) {
      where.date = Between(from, to);
    } else if (from) {
      where.date = Between(from, from);
    } else if (to) {
      where.date = Between(to, to);
    }

    const rows = await this.trafficRepo.find({
      where,
      order: { date: 'ASC' },
    });

    if (!rows.length) {
      return {
        currency: 'EUR',
        totalSessions: 0,
        totalLeads: 0,
        totalRevenue: 0,
        totalCost: 0,
        items: [],
      };
    }

    const items: MarketingTrafficRow[] = rows.map((r) => ({
      date: r.date,
      source: r.source,
      medium: r.medium,
      campaign: r.campaign,
      sessions: r.sessions || 0,
      clicks: r.clicks || 0,
      leads: r.leads || 0,
      cost: Number(r.cost) || 0,
      revenue: Number(r.revenue) || 0,
      currency: r.currency || 'EUR',
    }));

    const totalSessions = items.reduce((s, r) => s + r.sessions, 0);
    const totalLeads = items.reduce((s, r) => s + r.leads, 0);
    const totalRevenue = items.reduce((s, r) => s + r.revenue, 0);
    const totalCost = items.reduce((s, r) => s + r.cost, 0);
    const currency = items[0]?.currency || 'EUR';

    return {
      currency,
      totalSessions,
      totalLeads,
      totalRevenue,
      totalCost,
      items,
    };
  }

  async importTraffic(tenantId: string, dto: ImportTrafficDto): Promise<void> {
    const rows: TrafficUpsertRow[] = dto.items.map((item) => ({
      date: item.date,
      source: item.source ?? null,
      medium: item.medium ?? null,
      campaign: item.campaign ?? null,
      sessions: item.sessions ?? 0,
      clicks: item.clicks ?? 0,
      leads: item.leads ?? 0,
      cost: item.cost ?? 0,
      revenue: item.revenue ?? 0,
      currency: item.currency || 'EUR',
      system: 'manual',
    }));

    await this.upsertTrafficRows(tenantId, rows);
  }

  async syncIntegration(
    tenantId: string,
    integrationId: string,
    from?: string,
    to?: string,
  ): Promise<{ ok: boolean; updated: number }> {
    const integration = await this.integrationRepo.findOne({
      where: { id: integrationId, tenantId },
    });

    if (!integration) {
      throw new Error('Integration not found');
    }

    const range = this.resolveRange(from, to);
    let rows: TrafficUpsertRow[] = [];

    if (integration.provider === 'google_analytics') {
      rows = await this.fetchGa4Traffic(integration, range.from, range.to);
    } else if (integration.provider === 'yandex_metrika') {
      rows = await this.fetchYandexTraffic(integration, range.from, range.to);
    } else if (integration.provider === 'google_ads') {
      rows = await this.fetchGoogleAdsTraffic(integration, range.from, range.to);
    } else if (integration.provider === 'meta_ads') {
      rows = await this.fetchMetaAdsTraffic(integration, range.from, range.to);
    } else {
      throw new Error('Sync is not supported for this provider');
    }

    if (!rows.length) {
      return { ok: true, updated: 0 };
    }

    await this.upsertTrafficRows(tenantId, rows);
    await this.touchIntegration(integration, rows.length);

    return { ok: true, updated: rows.length };
  }

  private resolveRange(from?: string, to?: string) {
    const today = new Date();
    const end = to
      ? new Date(to)
      : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const start = from
      ? new Date(from)
      : new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);

    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    };
  }

  private async upsertTrafficRows(tenantId: string, rows: TrafficUpsertRow[]) {
    for (const item of rows) {
      const key: Partial<MarketingTraffic> = {
        tenantId,
        date: item.date,
        source: item.source ?? null,
        medium: item.medium ?? null,
        campaign: item.campaign ?? null,
      };

      const where: FindOptionsWhere<MarketingTraffic> = {
        tenantId: key.tenantId!,
        date: key.date!,
        source: key.source ?? undefined,
        medium: key.medium ?? undefined,
        campaign: key.campaign ?? undefined,
      };

      const existing = await this.trafficRepo.findOne({ where });

      const base: Partial<MarketingTraffic> = {
        ...key,
        sessions: item.sessions ?? 0,
        clicks: item.clicks ?? 0,
        leads: item.leads ?? 0,
        cost: String(item.cost ?? 0),
        revenue: String(item.revenue ?? 0),
        currency: item.currency || 'EUR',
      };

      if (existing) {
        const next: Partial<MarketingTraffic> = { ...existing, ...base };
        if (item.system === 'analytics') {
          next.clicks = existing.clicks;
          next.cost = existing.cost;
        } else if (item.system === 'ads') {
          next.sessions = existing.sessions;
          next.leads = existing.leads;
          next.revenue = existing.revenue;
        }

        await this.trafficRepo.save(next);
      } else {
        const row = this.trafficRepo.create(base);
        await this.trafficRepo.save(row);
      }
    }
  }

  private async touchIntegration(integration: MarketingIntegration, updated: number) {
    const settings = integration.settings ?? {};
    settings.lastSyncAt = new Date().toISOString();
    settings.lastSyncRows = updated;
    await this.integrationRepo.save({ ...integration, settings });
  }

  private parseGaDate(value: string) {
    if (!value || value.length !== 8) return value;
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  private async fetchGa4Traffic(
    integration: MarketingIntegration,
    from: string,
    to: string,
  ): Promise<TrafficUpsertRow[]> {
    const settings = integration.settings ?? {};
    const propertyId = settings.propertyId || integration.primaryId;
    const serviceAccountJson = settings.serviceAccountJson;
    if (!propertyId || !serviceAccountJson) {
      throw new Error('GA4 settings are missing (propertyId/serviceAccountJson)');
    }

    const token = await this.getGoogleAccessToken(serviceAccountJson);
    const revenueMetric = settings.revenueMetric || 'purchaseRevenue';
    const metrics = [
      { name: 'sessions' },
      { name: revenueMetric },
      ...(settings.conversionEvent ? [] : [{ name: 'conversions' }]),
    ];

    const baseBody = {
      dateRanges: [{ startDate: from, endDate: to }],
      dimensions: [
        { name: 'date' },
        { name: 'sessionSource' },
        { name: 'sessionMedium' },
        { name: 'sessionCampaignName' },
      ],
      metrics,
      limit: 100000,
    };

    const baseRows = await this.fetchGa4Report(propertyId, token, baseBody);

    let conversionsMap: Map<string, number> | null = null;
    if (settings.conversionEvent) {
      const convBody = {
        ...baseBody,
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: { value: settings.conversionEvent },
          },
        },
      };
      const convRows = await this.fetchGa4Report(propertyId, token, convBody);
      conversionsMap = new Map(
        convRows.map((row) => [row.key, row.values.metrics.eventCount || 0]),
      );
    }

    return baseRows.map((row) => ({
      date: row.values.date,
      source: row.values.source,
      medium: row.values.medium,
      campaign: row.values.campaign,
      sessions: row.values.metrics.sessions || 0,
      clicks: 0,
      leads: conversionsMap
        ? conversionsMap.get(row.key) || 0
        : row.values.metrics.conversions || 0,
      cost: 0,
      revenue: row.values.metrics[revenueMetric] || 0,
      currency: settings.currency || 'EUR',
      system: 'analytics',
    }));
  }

  private async fetchGa4Report(propertyId: string, token: string, body: any) {
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GA4 API error: ${res.status} ${text}`);
    }

    const data = await res.json();
    const rows = data.rows || [];
    const metricNames = (body.metrics || []).map((m: any) => m.name);

    return rows.map((row: any) => {
      const dims = row.dimensionValues || [];
      const metrics = row.metricValues || [];
      const date = this.parseGaDate(dims[0]?.value || '');
      const source = dims[1]?.value || null;
      const medium = dims[2]?.value || null;
      const campaign = dims[3]?.value || null;

      const metricsMap: Record<string, number> = {};
      metricNames.forEach((name: string, idx: number) => {
        metricsMap[name] = Number(metrics[idx]?.value || 0);
      });

      const key = `${date}::${source}::${medium}::${campaign}`;
      return {
        key,
        values: {
          date,
          source,
          medium,
          campaign,
          metrics: metricsMap,
        },
      };
    });
  }

  private async getGoogleAccessToken(serviceAccountJson: string) {
    const creds =
      typeof serviceAccountJson === 'string'
        ? JSON.parse(serviceAccountJson)
        : serviceAccountJson;
    if (!creds?.client_email || !creds?.private_key) {
      throw new Error('Invalid GA4 service account JSON');
    }

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: creds.client_email,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };

    const base64url = (input: string) =>
      Buffer.from(input)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    const encodedHeader = base64url(JSON.stringify(header));
    const encodedPayload = base64url(JSON.stringify(payload));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const sign = createSign('RSA-SHA256');
    sign.update(signatureInput);
    sign.end();
    const signature = sign.sign(creds.private_key, 'base64');
    const encodedSignature = signature
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const assertion = `${signatureInput}.${encodedSignature}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Google OAuth error: ${tokenRes.status} ${text}`);
    }

    const tokenJson = await tokenRes.json();
    return tokenJson.access_token as string;
  }

  private async getGoogleOAuthAccessToken(settings: {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
  }) {
    const clientId = settings.clientId;
    const clientSecret = settings.clientSecret;
    const refreshToken = settings.refreshToken;
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Google OAuth settings are missing (clientId/clientSecret/refreshToken)');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Google OAuth error: ${tokenRes.status} ${text}`);
    }

    const tokenJson = await tokenRes.json();
    return tokenJson.access_token as string;
  }

  private normalizeAdsCustomerId(value?: string | null) {
    if (!value) return null;
    return value.replace(/-/g, '').trim();
  }

  private async fetchGoogleAdsTraffic(
    integration: MarketingIntegration,
    from: string,
    to: string,
  ): Promise<TrafficUpsertRow[]> {
    const settings = integration.settings ?? {};
    const customerId = this.normalizeAdsCustomerId(
      settings.customerId || integration.primaryId,
    );
    const developerToken = settings.developerToken;
    if (!customerId || !developerToken) {
      throw new Error('Google Ads settings are missing (customerId/developerToken)');
    }

    const accessToken = await this.getGoogleOAuthAccessToken(settings);
    const loginCustomerId = this.normalizeAdsCustomerId(settings.loginCustomerId);

    const query = `
      SELECT
        segments.date,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${from}' AND '${to}'
    `;

    const res = await fetch(
      `https://googleads.googleapis.com/v14/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': developerToken,
          ...(loginCustomerId ? { 'login-customer-id': loginCustomerId } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Ads API error: ${res.status} ${text}`);
    }

    const data = await res.json();
    const rows: TrafficUpsertRow[] = [];

    for (const chunk of data || []) {
      for (const row of chunk.results || []) {
        const date = row?.segments?.date || '';
        const campaign = row?.campaign?.name || null;
        const metrics = row?.metrics || {};
        const costMicros = Number(metrics.costMicros || 0);
        rows.push({
          date,
          source: settings.source || 'google',
          medium: settings.medium || 'cpc',
          campaign,
          sessions: 0,
          clicks: Number(metrics.clicks || 0),
          leads: 0,
          cost: costMicros / 1_000_000,
          revenue: 0,
          currency: settings.currency || 'EUR',
          system: 'ads',
        });
      }
    }

    return rows;
  }

  private async fetchMetaAdsTraffic(
    integration: MarketingIntegration,
    from: string,
    to: string,
  ): Promise<TrafficUpsertRow[]> {
    const settings = integration.settings ?? {};
    const accessToken = settings.accessToken;
    const accountId = settings.adAccountId || integration.primaryId;
    if (!accessToken || !accountId) {
      throw new Error('Meta Ads settings are missing (accessToken/adAccountId)');
    }

    const url = new URL(`https://graph.facebook.com/v19.0/act_${accountId}/insights`);
    url.searchParams.set('access_token', accessToken);
    url.searchParams.set('level', 'campaign');
    url.searchParams.set('time_increment', '1');
    url.searchParams.set('fields', [
      'date_start',
      'campaign_name',
      'impressions',
      'clicks',
      'spend',
      'actions',
      'action_values',
    ].join(','));
    url.searchParams.set('time_range[since]', from);
    url.searchParams.set('time_range[until]', to);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Meta Ads API error: ${res.status} ${text}`);
    }

    const data = await res.json();
    const rows: TrafficUpsertRow[] = [];

    for (const row of data?.data || []) {
      const date = row.date_start || '';
      const campaign = row.campaign_name || null;
      rows.push({
        date,
        source: settings.source || 'meta',
        medium: settings.medium || 'paid_social',
        campaign,
        sessions: 0,
        clicks: Number(row.clicks || 0),
        leads: 0,
        cost: Number(row.spend || 0),
        revenue: 0,
        currency: settings.currency || 'EUR',
        system: 'ads',
      });
    }

    return rows;
  }

  private async fetchYandexTraffic(
    integration: MarketingIntegration,
    from: string,
    to: string,
  ): Promise<TrafficUpsertRow[]> {
    const settings = integration.settings ?? {};
    const counterId = settings.counterId || integration.primaryId;
    const token = settings.token;
    if (!counterId || !token) {
      throw new Error('Metrika settings are missing (counterId/token)');
    }

    const goalId = settings.goalId;
    const revenueMetric = settings.revenueMetric || 'ym:s:purchaseRevenue';
    const conversionMetric = goalId
      ? `ym:s:goal${goalId}reaches`
      : 'ym:s:goalReachesAny';

    const metrics = ['ym:s:visits', conversionMetric, revenueMetric].join(',');
    const dimensions = [
      'ym:s:date',
      'ym:s:UTMSource',
      'ym:s:UTMMedium',
      'ym:s:UTMCampaign',
    ].join(',');

    const url = new URL('https://api-metrika.yandex.net/stat/v1/data');
    url.searchParams.set('ids', String(counterId));
    url.searchParams.set('metrics', metrics);
    url.searchParams.set('dimensions', dimensions);
    url.searchParams.set('date1', from);
    url.searchParams.set('date2', to);
    url.searchParams.set('accuracy', 'full');
    url.searchParams.set('limit', '100000');

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `OAuth ${token}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Metrika API error: ${res.status} ${text}`);
    }

    const data = await res.json();
    const rows = data.data || [];

    return rows.map((row: any) => {
      const dims = row.dimensions || [];
      const metrics = row.metrics || [];
      const date = dims[0]?.name || '';
      const source = dims[1]?.name || null;
      const medium = dims[2]?.name || null;
      const campaign = dims[3]?.name || null;

      return {
        date,
        source,
        medium,
        campaign,
        sessions: Number(metrics[0] || 0),
        clicks: 0,
        leads: Number(metrics[1] || 0),
        cost: 0,
        revenue: Number(metrics[2] || 0),
        currency: settings.currency || 'EUR',
        system: 'analytics',
      };
    });
  }

  // ===== SEO SETTINGS / METRICS =====
  async getSeoSettings(tenantId: string) {
    const current = await this.seoSettingsRepo.findOne({
      where: { tenantId },
    });

    return {
      gscPropertyUrl: current?.gscPropertyUrl ?? null,
      gscConnected: Boolean(current?.gscRefreshToken),
      pageSpeedApiKey: current?.pageSpeedApiKey ?? null,
      pageSpeedUrl: current?.pageSpeedUrl ?? null,
      pageSpeedStrategy: current?.pageSpeedStrategy ?? 'mobile',
      updatedAt: current?.updatedAt ?? null,
    };
  }

  async updateSeoSettings(
    tenantId: string,
    payload: {
      gscPropertyUrl?: string | null;
      pageSpeedApiKey?: string | null;
      pageSpeedUrl?: string | null;
      pageSpeedStrategy?: string | null;
    },
  ) {
    let current = await this.seoSettingsRepo.findOne({
      where: { tenantId },
    });

    if (!current) {
      current = this.seoSettingsRepo.create({
        tenantId,
        gscPropertyUrl: payload.gscPropertyUrl ?? null,
        pageSpeedApiKey: payload.pageSpeedApiKey ?? null,
        pageSpeedUrl: payload.pageSpeedUrl ?? null,
        pageSpeedStrategy: payload.pageSpeedStrategy ?? 'mobile',
      });
    } else {
      if (payload.gscPropertyUrl !== undefined) {
        current.gscPropertyUrl = payload.gscPropertyUrl;
      }
      if (payload.pageSpeedApiKey !== undefined) {
        current.pageSpeedApiKey = payload.pageSpeedApiKey;
      }
      if (payload.pageSpeedUrl !== undefined) {
        current.pageSpeedUrl = payload.pageSpeedUrl;
      }
      if (payload.pageSpeedStrategy !== undefined) {
        current.pageSpeedStrategy = payload.pageSpeedStrategy || 'mobile';
      }
    }

    await this.seoSettingsRepo.save(current);
    return this.getSeoSettings(tenantId);
  }

  private normalizeDateRange(dateFrom?: string, dateTo?: string) {
    const isValid = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (isValid(dateFrom) && isValid(dateTo)) {
      return { dateFrom: dateFrom as string, dateTo: dateTo as string };
    }
    const today = new Date();
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
    const start = new Date(end.getTime() - 27 * 24 * 60 * 60 * 1000);
    return {
      dateFrom: start.toISOString().slice(0, 10),
      dateTo: end.toISOString().slice(0, 10),
    };
  }

  private getCompareRange(dateFrom: string, dateTo: string) {
    const start = new Date(`${dateFrom}T00:00:00.000Z`);
    const end = new Date(`${dateTo}T00:00:00.000Z`);
    const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    const prevStart = new Date(prevEnd.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    return {
      dateFrom: prevStart.toISOString().slice(0, 10),
      dateTo: prevEnd.toISOString().slice(0, 10),
    };
  }

  private async getGscRangeSummary(tenantId: string, propertyUrl: string, dateFrom: string, dateTo: string) {
    const rows = await this.seoGscDailyRepo.find({
      where: { tenantId, propertyUrl, date: Between(dateFrom, dateTo) },
      order: { date: 'ASC' },
    });

    let clicks = 0;
    let impressions = 0;
    let positionSum = 0;
    rows.forEach((r) => {
      clicks += Number(r.clicks || 0);
      impressions += Number(r.impressions || 0);
      positionSum += Number(r.position || 0) * Number(r.impressions || 0);
    });
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const position = impressions > 0 ? positionSum / impressions : 0;
    return {
      summary: {
        propertyUrl,
        dateFrom,
        dateTo,
        clicks,
        impressions,
        ctr,
        position,
      },
      daily: rows.map((row) => ({
        date: row.date,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: Number(row.ctr) || 0,
        position: Number(row.position) || 0,
      })),
    };
  }

  async getSeoMetrics(tenantId: string, opts?: { dateFrom?: string; dateTo?: string; compare?: boolean }) {
    const gsc = await this.seoGscRepo.findOne({ where: { tenantId } });
    const psi = await this.seoPsiRepo.findOne({ where: { tenantId } });
    const settings = await this.seoSettingsRepo.findOne({ where: { tenantId } });
    const propertyUrl = settings?.gscPropertyUrl || gsc?.propertyUrl || null;

    if (opts?.dateFrom && opts?.dateTo && propertyUrl) {
      const { dateFrom, dateTo } = this.normalizeDateRange(opts.dateFrom, opts.dateTo);
      const range = await this.getGscRangeSummary(tenantId, propertyUrl, dateFrom, dateTo);
      const compare = opts.compare ? this.getCompareRange(dateFrom, dateTo) : null;
      const compareRange = compare
        ? await this.getGscRangeSummary(tenantId, propertyUrl, compare.dateFrom, compare.dateTo)
        : null;
      return {
        gsc: range.summary,
        gscDaily: range.daily,
        gscCompare: compareRange?.summary || null,
        gscCompareDaily: compareRange?.daily || [],
        psi: psi
          ? {
              pageUrl: psi.pageUrl,
              strategy: psi.strategy,
              performance: psi.performance,
              accessibility: psi.accessibility,
              bestPractices: psi.bestPractices,
              seo: psi.seo,
              lcp: Number(psi.lcp) || 0,
              cls: Number(psi.cls) || 0,
              fcp: Number(psi.fcp) || 0,
              tbt: Number(psi.tbt) || 0,
              speedIndex: Number(psi.speedIndex) || 0,
              updatedAt: psi.updatedAt,
            }
          : null,
      };
    }

    const daily = await this.seoGscDailyRepo.find({
      where: { tenantId },
      order: { date: 'ASC' },
      take: 31,
    });
    return {
      gsc: gsc
        ? {
            propertyUrl: gsc.propertyUrl,
            dateFrom: gsc.dateFrom,
            dateTo: gsc.dateTo,
            clicks: gsc.clicks,
            impressions: gsc.impressions,
            ctr: Number(gsc.ctr) || 0,
            position: Number(gsc.position) || 0,
            updatedAt: gsc.updatedAt,
          }
        : null,
      gscDaily: daily.map((row) => ({
        date: row.date,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: Number(row.ctr) || 0,
        position: Number(row.position) || 0,
      })),
      gscCompare: null,
      gscCompareDaily: [],
      psi: psi
        ? {
            pageUrl: psi.pageUrl,
            strategy: psi.strategy,
            performance: psi.performance,
            accessibility: psi.accessibility,
            bestPractices: psi.bestPractices,
            seo: psi.seo,
            lcp: Number(psi.lcp) || 0,
            cls: Number(psi.cls) || 0,
            fcp: Number(psi.fcp) || 0,
            tbt: Number(psi.tbt) || 0,
            speedIndex: Number(psi.speedIndex) || 0,
            updatedAt: psi.updatedAt,
          }
        : null,
    };
  }

  async getGoogleAuthUrl(tenantId: string, redirect?: string) {
    const { clientId } = await this.platformSettings.getGoogleOAuthConfig();
    if (!clientId) {
      throw new Error('Google OAuth clientId is not configured');
    }

    const redirectUri =
      process.env.GOOGLE_OAUTH_REDIRECT_URI ||
      'https://crm.lumiva.agency/v1/marketing/seo/google/callback';
    const state = this.signState({
      tenantId,
      redirect: redirect || '/app/marketing/seo',
      ts: Date.now(),
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      state,
    });

    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
  }

  async handleGoogleCallback(code?: string, state?: string) {
    if (!code || !state) {
      return this.safeRedirect('/app/marketing/seo?seo=error');
    }

    const parsed = this.verifyState(state);
    if (!parsed?.tenantId) {
      return this.safeRedirect('/app/marketing/seo?seo=invalid_state');
    }

    const { clientId, clientSecret } =
      await this.platformSettings.getGoogleOAuthConfig();
    if (!clientId || !clientSecret) {
      return this.safeRedirect('/app/marketing/seo?seo=missing_oauth');
    }

    const redirectUri =
      process.env.GOOGLE_OAUTH_REDIRECT_URI ||
      'https://crm.lumiva.agency/v1/marketing/seo/google/callback';

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      return this.safeRedirect('/app/marketing/seo?seo=oauth_error');
    }

    const tokenJson = await tokenRes.json();
    const refreshToken = tokenJson.refresh_token as string | undefined;

    let current = await this.seoSettingsRepo.findOne({
      where: { tenantId: parsed.tenantId },
    });
    if (!current) {
      current = this.seoSettingsRepo.create({
        tenantId: parsed.tenantId,
        gscRefreshToken: refreshToken || null,
      });
    } else if (refreshToken) {
      current.gscRefreshToken = refreshToken;
    }

    if (current) {
      await this.seoSettingsRepo.save(current);
    }

    const redirect = parsed.redirect || '/app/marketing/seo';
    return this.safeRedirect(`${redirect}?seo=connected`);
  }

  async syncSeoMetrics(tenantId: string, opts?: { dateFrom?: string; dateTo?: string; compare?: boolean }) {
    const settings = await this.seoSettingsRepo.findOne({
      where: { tenantId },
    });
    if (!settings) {
      return { ok: true, gsc: false, psi: false };
    }

    const gscUpdated = await this.syncGscMetrics(tenantId, settings, opts);
    const psiUpdated = await this.syncPageSpeedMetrics(tenantId, settings);

    return { ok: true, gsc: gscUpdated, psi: psiUpdated };
  }

  private async syncSeoForAllTenants() {
    if (this.seoSyncRunning) return;
    this.seoSyncRunning = true;
    try {
      const all = await this.seoSettingsRepo.find();
      for (const settings of all) {
        await this.syncSeoMetrics(settings.tenantId);
      }
    } catch (e) {
      // avoid noisy crashes; cron will retry next run
    } finally {
      this.seoSyncRunning = false;
    }
  }

  private async syncGscMetrics(
    tenantId: string,
    settings: SeoSettings,
    opts?: { dateFrom?: string; dateTo?: string; compare?: boolean },
  ) {
    if (!settings.gscPropertyUrl || !settings.gscRefreshToken) return false;

    const { clientId, clientSecret } =
      await this.platformSettings.getGoogleOAuthConfig();
    if (!clientId || !clientSecret) return false;

    const accessToken = await this.getGoogleAccessTokenFromRefreshToken({
      clientId,
      clientSecret,
      refreshToken: settings.gscRefreshToken,
    });

    const mainRange = this.normalizeDateRange(opts?.dateFrom, opts?.dateTo);
    const compareRange = opts?.compare ? this.getCompareRange(mainRange.dateFrom, mainRange.dateTo) : null;

    const normalizePropertyUrl = (value: string) => {
      if (value.startsWith('sc-domain:')) {
        return value;
      }
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return value.endsWith('/') ? value : `${value}/`;
      }
      return `https://${value.replace(/\/+$/, '')}/`;
    };

    const buildFallbackPropertyUrl = (value: string) => {
      if (value.startsWith('sc-domain:')) {
        return normalizePropertyUrl(value.replace(/^sc-domain:/, ''));
      }
      try {
        const url = new URL(normalizePropertyUrl(value));
        return `sc-domain:${url.host}`;
      } catch {
        return `sc-domain:${value}`;
      }
    };

    const fetchRange = async (propertyUrl: string, dateFrom: string, dateTo: string) => {
      const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
        propertyUrl,
      )}/searchAnalytics/query`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: dateFrom,
          endDate: dateTo,
          dimensions: ['date'],
          rowLimit: 25000,
        }),
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      return data?.rows || [];
    };

    const primaryPropertyUrl = normalizePropertyUrl(settings.gscPropertyUrl);
    const fallbackPropertyUrl = buildFallbackPropertyUrl(settings.gscPropertyUrl);

    let propertyUrl = primaryPropertyUrl;
    let rows = await fetchRange(primaryPropertyUrl, mainRange.dateFrom, mainRange.dateTo);
    if (!rows && fallbackPropertyUrl !== primaryPropertyUrl) {
      rows = await fetchRange(fallbackPropertyUrl, mainRange.dateFrom, mainRange.dateTo);
      if (rows) {
        propertyUrl = fallbackPropertyUrl;
        settings.gscPropertyUrl = fallbackPropertyUrl;
        await this.seoSettingsRepo.save(settings);
      }
    }
    if (!rows) return false;

    let clicks = 0;
    let impressions = 0;
    let positionSum = 0;
    rows.forEach((r: any) => {
      const c = Number(r.clicks || 0);
      const i = Number(r.impressions || 0);
      clicks += c;
      impressions += i;
      positionSum += Number(r.position || 0) * i;
    });

    const ctr = impressions > 0 ? clicks / impressions : 0;
    const position = impressions > 0 ? positionSum / impressions : 0;

    const existing = await this.seoGscRepo.findOne({
      where: { tenantId, propertyUrl },
    });

    const payload: Partial<SeoGscMetric> = {
      tenantId,
      propertyUrl,
      dateFrom: mainRange.dateFrom,
      dateTo: mainRange.dateTo,
      clicks,
      impressions,
      ctr: String(ctr),
      position: String(position),
    };

    if (existing) {
      await this.seoGscRepo.save({ ...existing, ...payload });
    } else {
      await this.seoGscRepo.save(this.seoGscRepo.create(payload));
    }

    for (const row of rows) {
      const date = row.keys?.[0];
      if (!date) continue;
      const i = Number(row.impressions || 0);
      const ctrRow = i > 0 ? Number(row.clicks || 0) / i : 0;
      const dailyPayload: Partial<SeoGscDaily> = {
        tenantId,
          propertyUrl,
        date,
        clicks: Number(row.clicks || 0),
        impressions: i,
        ctr: String(ctrRow),
        position: String(Number(row.position || 0)),
      };

      const dailyExisting = await this.seoGscDailyRepo.findOne({
        where: { tenantId, propertyUrl, date },
      });
      if (dailyExisting) {
        await this.seoGscDailyRepo.save({ ...dailyExisting, ...dailyPayload });
      } else {
        await this.seoGscDailyRepo.save(this.seoGscDailyRepo.create(dailyPayload));
      }
    }

    if (compareRange) {
      const compareRows = await fetchRange(propertyUrl, compareRange.dateFrom, compareRange.dateTo);
      if (compareRows) {
        for (const row of compareRows) {
          const date = row.keys?.[0];
          if (!date) continue;
          const i = Number(row.impressions || 0);
          const ctrRow = i > 0 ? Number(row.clicks || 0) / i : 0;
          const dailyPayload: Partial<SeoGscDaily> = {
            tenantId,
            propertyUrl,
            date,
            clicks: Number(row.clicks || 0),
            impressions: i,
            ctr: String(ctrRow),
            position: String(Number(row.position || 0)),
          };

          const dailyExisting = await this.seoGscDailyRepo.findOne({
            where: { tenantId, propertyUrl, date },
          });
          if (dailyExisting) {
            await this.seoGscDailyRepo.save({ ...dailyExisting, ...dailyPayload });
          } else {
            await this.seoGscDailyRepo.save(this.seoGscDailyRepo.create(dailyPayload));
          }
        }
      }
    }

    return true;
  }

  private async syncPageSpeedMetrics(tenantId: string, settings: SeoSettings) {
    if (!settings.pageSpeedApiKey || !settings.pageSpeedUrl) return false;
    const strategy = settings.pageSpeedStrategy || 'mobile';
    const normalizeUrl = (value: string) => {
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return value;
      }
      return `https://${value}`;
    };
    const url = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    url.searchParams.set('url', normalizeUrl(settings.pageSpeedUrl));
    url.searchParams.set('strategy', strategy);
    url.searchParams.set('key', settings.pageSpeedApiKey);
    url.searchParams.append('category', 'performance');
    url.searchParams.append('category', 'accessibility');
    url.searchParams.append('category', 'best-practices');
    url.searchParams.append('category', 'seo');

    const res = await fetch(url.toString());
    if (!res.ok) return false;

    const data = await res.json();
    const categories = data?.lighthouseResult?.categories || {};
    const audits = data?.lighthouseResult?.audits || {};
    if (!data?.lighthouseResult?.categories) {
      return false;
    }

    const toScore = (v?: number) => Math.round((v || 0) * 100);
    const metricValue = (key: string) =>
      Number(audits?.[key]?.numericValue || 0);

    const bestPracticesScore =
      categories?.['best-practices']?.score ??
      categories?.bestPractices?.score ??
      0;

    const accessibilityScore =
      categories?.accessibility?.score ?? 0;

    const seoScore =
      categories?.seo?.score ?? 0;

    const payload: Partial<SeoPageSpeedMetric> = {
      tenantId,
      pageUrl: normalizeUrl(settings.pageSpeedUrl),
      strategy,
      performance: toScore(categories?.performance?.score),
      accessibility: toScore(accessibilityScore),
      bestPractices: toScore(bestPracticesScore),
      seo: toScore(seoScore),
      lcp: String(metricValue('largest-contentful-paint')),
      cls: String(metricValue('cumulative-layout-shift')),
      fcp: String(metricValue('first-contentful-paint')),
      tbt: String(metricValue('total-blocking-time')),
      speedIndex: String(metricValue('speed-index')),
    };

    const existing = await this.seoPsiRepo.findOne({
      where: { tenantId, pageUrl: settings.pageSpeedUrl, strategy },
    });

    if (existing) {
      await this.seoPsiRepo.save({ ...existing, ...payload });
    } else {
      await this.seoPsiRepo.save(this.seoPsiRepo.create(payload));
    }

    return true;
  }

  private async getGoogleAccessTokenFromRefreshToken(params: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  }) {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: params.clientId,
        client_secret: params.clientSecret,
        refresh_token: params.refreshToken,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Google OAuth error: ${tokenRes.status} ${text}`);
    }

    const tokenJson = await tokenRes.json();
    return tokenJson.access_token as string;
  }

  private signState(payload: Record<string, unknown>) {
    const secret = process.env.JWT_SECRET || 'changeme';
    const raw = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', secret).update(raw).digest('base64url');
    return `${raw}.${sig}`;
  }

  private verifyState(state?: string | null): { tenantId?: string; redirect?: string } | null {
    if (!state) return null;
    const [raw, sig] = state.split('.');
    if (!raw || !sig) return null;
    const secret = process.env.JWT_SECRET || 'changeme';
    const expected = createHmac('sha256', secret).update(raw).digest('base64url');
    if (expected !== sig) return null;
    try {
      return JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8'));
    } catch {
      return null;
    }
  }

  private safeRedirect(path: string) {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `https://crm.lumiva.agency${path}`;
  }

  // ===== UTM ТЕМПЛЕЙТЫ =====
  async listUtmTemplates(tenantId: string): Promise<MarketingUtmTemplate[]> {
    return this.utmRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async createUtmTemplate(
    tenantId: string,
    dto: CreateUtmTemplateDto,
  ): Promise<MarketingUtmTemplate> {
    const entity = this.utmRepo.create({
      tenantId,
      name: dto.name,
      baseUrl: dto.baseUrl ?? null,
      channelType: dto.channelType ?? null,
      utmSource: dto.utmSource ?? null,
      utmMedium: dto.utmMedium ?? null,
      utmCampaign: dto.utmCampaign ?? null,
      utmContent: dto.utmContent ?? null,
      utmTerm: dto.utmTerm ?? null,
    });

    return this.utmRepo.save(entity);
  }

  async deleteUtmTemplate(tenantId: string, id: string): Promise<void> {
    await this.utmRepo.delete({ id, tenantId });
  }

  // ===== ИНТЕГРАЦИИ =====
  async listIntegrations(tenantId: string): Promise<MarketingIntegration[]> {
    return this.integrationRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async createIntegration(
    tenantId: string,
    dto: CreateMarketingIntegrationDto,
  ): Promise<MarketingIntegration> {
    const entity = this.integrationRepo.create({
      tenantId,
      provider: dto.provider,
      kind: dto.kind ?? 'analytics',
      name: dto.name,
      isActive: dto.isActive ?? true,
      primaryId: dto.primaryId ?? null,
      settings: dto.settings ?? null,
    });

    return this.integrationRepo.save(entity);
  }

  async updateIntegration(
    tenantId: string,
    id: string,
    dto: Partial<CreateMarketingIntegrationDto>,
  ): Promise<MarketingIntegration> {
    const prev = await this.integrationRepo.findOne({
      where: { id, tenantId },
    });
    if (!prev) {
      throw new Error('Integration not found');
    }

    const merged = {
      ...prev,
      ...dto,
      primaryId: dto.primaryId ?? prev.primaryId,
      settings: dto.settings ?? prev.settings,
    };

    return this.integrationRepo.save(merged);
  }

  async deleteIntegration(tenantId: string, id: string): Promise<void> {
    await this.integrationRepo.delete({ id, tenantId });
  }

  // ===== АВТОМАТИЗАЦИИ (n8n) =====
  async listAutomations(tenantId: string): Promise<MarketingAutomation[]> {
    return this.automationRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async createAutomation(
    tenantId: string,
    dto: CreateAutomationDto,
  ): Promise<MarketingAutomation> {
    const entity = this.automationRepo.create({
      tenantId,
      name: dto.name,
      type: dto.type ?? 'n8n_webhook',
      webhookUrl: dto.webhookUrl ?? null,
      isActive: dto.isActive ?? true,
      meta: dto.meta ?? null,
    });

    return this.automationRepo.save(entity);
  }

  async updateAutomation(
    tenantId: string,
    id: string,
    dto: Partial<CreateAutomationDto>,
  ): Promise<MarketingAutomation> {
    const prev = await this.automationRepo.findOne({
      where: { id, tenantId },
    });
    if (!prev) throw new Error('Automation not found');

    const merged = {
      ...prev,
      ...dto,
      webhookUrl: dto.webhookUrl ?? prev.webhookUrl,
      meta: dto.meta ?? prev.meta,
    };

    return this.automationRepo.save(merged);
  }

  async deleteAutomation(tenantId: string, id: string): Promise<void> {
    await this.automationRepo.delete({ id, tenantId });
  }

  // ===== СЕГМЕНТЫ (пока заглушки, чтобы не ломать UI) =====
  async getSegmentsForTenant(_tenantId: string): Promise<any[]> {
    return [];
  }
}
