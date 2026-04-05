// src/marketing/marketing.service.ts
import * as crypto from 'crypto';

import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import { Between, Repository } from 'typeorm';

import { Lead } from '../leads/lead.entity';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

import { MarketingTraffic } from './marketing-traffic.entity';
import { MarketingUtmTemplate } from './marketing-utm-template.entity';
import { MarketingIntegration } from './marketing-integration.entity';
import { MarketingAutomation } from './marketing-automation.entity';
import { MarketingSegment } from './marketing-segment.entity';
import { SeoSettings } from './seo-settings.entity';
import { SeoGscMetric } from './seo-gsc-metric.entity';
import { SeoGscDaily } from './seo-gsc-daily.entity';
import { SeoPageSpeedMetric } from './seo-pagespeed-metric.entity';

import { CreateUtmTemplateDto } from './dto/utm-template.dto';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { CreateSegmentBodyDto } from './dto/create-segment-body.dto';
import { SegmentDto } from './dto/segment.dto';
import { CreateMarketingIntegrationDto } from './dto/create-marketing-integration.dto';
import { UpdateMarketingIntegrationDto } from './dto/update-marketing-integration.dto';

/** Актуальная версия REST Google Ads API (v14 и ниже сняты → 404). */
export const GOOGLE_ADS_API_VERSION = 'v23';

/** Разбор тела ответа googleAds:search / OAuth при ошибке (GoogleAdsFailure в details). */
function extractGoogleAdsRestErrorPayload(data: unknown): string {
  if (data == null) return '';
  if (typeof data === 'string') return data.slice(0, 1200);
  if (typeof data !== 'object') return String(data);
  const root = data as Record<string, unknown>;
  const errObj = root.error as Record<string, unknown> | undefined;
  const top = typeof errObj?.message === 'string' ? errObj.message : '';
  const pieces: string[] = [];
  if (top) pieces.push(top);
  const details = errObj?.details;
  if (Array.isArray(details)) {
    for (const det of details) {
      if (!det || typeof det !== 'object') continue;
      const errors = (det as Record<string, unknown>).errors;
      if (!Array.isArray(errors)) continue;
      for (const ge of errors) {
        if (!ge || typeof ge !== 'object') continue;
        const g = ge as Record<string, unknown>;
        if (typeof g.message === 'string') pieces.push(g.message);
        const ec = g.errorCode;
        if (ec && typeof ec === 'object') {
          for (const [k, v] of Object.entries(ec as Record<string, unknown>)) {
            if (v != null && String(v).trim() !== '') pieces.push(`${k}=${String(v)}`);
          }
        }
      }
    }
  }
  const joined = pieces.filter(Boolean).join(' | ');
  if (joined) return joined.slice(0, 2000);
  try {
    return JSON.stringify(data).slice(0, 800);
  } catch {
    return 'unknown error body';
  }
}

function googleAdsSyncFailureHint(detail: string): string {
  const u = detail.toUpperCase();
  if (u.includes('USER_PERMISSION_DENIED')) {
    return (
      ' Если доступ к аккаунту через менеджерский (MCC), в интеграции укажите Login Customer ID — 10 цифр ID менеджерского аккаунта без дефисов (заголовок login-customer-id). ' +
      'См. https://developers.google.com/google-ads/api/docs/concepts/call-structure#login-customer-id'
    );
  }
  if (
    u.includes('CUSTOMER_NOT_FOUND') ||
    u.includes('CLIENT_CUSTOMER_ID_INVALID') ||
    u.includes('CLIENT_CUSTOMER_ID_IS_REQUIRED')
  ) {
    return ' Проверьте Customer ID (primary ID в CRM): 10 цифр без дефисов, аккаунт должен быть доступен пользователю OAuth.';
  }
  if (u.includes('ORGANIZATION_NOT_ASSOCIATED_WITH_DEVELOPER_TOKEN')) {
    return ' Developer token из API Center должен быть в той же организации Google, что и доступ к рекламному аккаунту.';
  }
  if (u.includes('DEVELOPER_TOKEN_INVALID') || u.includes('DEVELOPER_TOKEN_PROHIBITED')) {
    return ' Проверьте developer token в интеграции или env GOOGLE_ADS_DEVELOPER_TOKEN.';
  }
  if (u.includes('OAUTH_TOKEN_INVALID')) {
    return ' Выпустите новый refresh token со scope https://www.googleapis.com/auth/adwords.';
  }
  if (u.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
    return ' Недостаточно прав OAuth: нужен scope adwords / https://www.googleapis.com/auth/adwords.';
  }
  if (u.includes('REQUESTED_METRICS_FOR_MANAGER')) {
    return (
      ' В поле Customer ID (primary ID) указан менеджерский аккаунт (MCC). Метрики по MCC недоступны — укажите ID конкретного клиентского (рекламного) аккаунта (10 цифр). ' +
      'Login Customer ID при этом остаётся ID менеджера, если доступ через MCC.'
    );
  }
  return '';
}

function normTrafficCurrency(raw: string | null | undefined): string {
  const c = (raw || 'EUR').trim().toUpperCase().slice(0, 8);
  return c || 'EUR';
}

function addCurWeight(weights: Record<string, number>, cur: string, w: number) {
  const k = normTrafficCurrency(cur);
  weights[k] = (weights[k] || 0) + w;
}

function pickDominantCurrency(weights: Record<string, number>): string {
  let best = 'EUR';
  let max = 0;
  for (const [code, w] of Object.entries(weights)) {
    if (w > max) {
      max = w;
      best = code;
    }
  }
  return best;
}

/** Не сохраняем в БД строки-ключи i18n (ошибочно пришедшие с клиента). */
function sanitizeTrafficText(value: string | null | undefined): string | null {
  const s = value?.trim();
  if (!s) return null;
  if (s.startsWith('crm.') && /^crm\.[a-z0-9_.]+$/i.test(s)) return null;
  if (
    /^[\w.]+$/i.test(s) &&
    /\.common\.(noCampaign|unknown|none|noData)$/i.test(s)
  ) {
    return null;
  }
  return s;
}

export interface MarketingTrafficProviderBreakdown {
  /** Совпадает с полем dataSource в marketing_traffic (meta_ads, yandex_metrika, …). */
  dataSource: string;
  rowCount: number;
  sessions: number;
  clicks: number;
  leads: number;
  revenue: number;
  impressions: number;
  cost: number;
  /** Доминирующая валюта строк группы (по весу расхода+выручки). */
  currency: string;
}

export interface MarketingTrafficChannelsStats {
  from: string | null;
  to: string | null;
  /**
   * Одна валюта, если в периоде только она; иначе «MIXED» (суммы по разным валютам нельзя смешивать без конвертации).
   */
  currency: string;
  /** Уникальные валюты сырых строк (верхний регистр). */
  currenciesPresent: string[];
  totalSessions: number;
  totalLeads: number;
  totalRevenue: number;
  /** Суммы по всем строкам выборки (нужны для рекламных / Метрики провайдеров). */
  totalClicks: number;
  totalImpressions: number;
  totalCost: number;
  /** Число сырых строк в marketing_traffic за период (до агрегации по каналам). */
  totalRows: number;
  dataSources: string[];
  providerBreakdown: MarketingTrafficProviderBreakdown[];
  /** Подписи dataSource (ga4_… → имя ресурса из интеграции). */
  dataSourceLabels?: Record<string, string>;
  items: Array<{
    dataSource: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  sessions: number;
  clicks: number;
  leads: number;
  revenue: number;
    impressions: number;
    cost: number;
    /** Доминирующая валюта в агрегате (по весу расхода+выручки). */
  currency: string;
  }>;
}

export interface MarketingTrafficDailyPoint {
  date: string;
  sessions: number;
  clicks: number;
  leads: number;
  revenue: number;
  cost: number;
  impressions: number;
}

@Injectable()
export class MarketingService {
  private readonly log = new Logger(MarketingService.name);

  constructor(
    @InjectRepository(MarketingTraffic)
    private readonly trafficRepo: Repository<MarketingTraffic>,
    @InjectRepository(MarketingUtmTemplate)
    private readonly utmRepo: Repository<MarketingUtmTemplate>,
    @InjectRepository(MarketingAutomation)
    private readonly automationRepo: Repository<MarketingAutomation>,
    @InjectRepository(MarketingSegment)
    private readonly segmentRepo: Repository<MarketingSegment>,
    @InjectRepository(MarketingIntegration)
    private readonly integrationRepo: Repository<MarketingIntegration>,
    @InjectRepository(SeoSettings)
    private readonly seoRepo: Repository<SeoSettings>,
    @InjectRepository(SeoGscMetric)
    private readonly gscMetricRepo: Repository<SeoGscMetric>,
    @InjectRepository(SeoGscDaily)
    private readonly gscDailyRepo: Repository<SeoGscDaily>,
    @InjectRepository(SeoPageSpeedMetric)
    private readonly psiRepo: Repository<SeoPageSpeedMetric>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  /**
   * Массовый `save` по десяткам тысяч сущностей даёт один INSERT с огромным числом параметров
   * и падает в PostgreSQL (лимит ~65535). Пишем чанками.
   */
  private async saveMarketingTrafficChunked(
    rows: MarketingTraffic[],
    chunkSize = 350,
  ): Promise<void> {
    if (!rows.length) return;
    for (let i = 0; i < rows.length; i += chunkSize) {
      await this.trafficRepo.save(rows.slice(i, i + chunkSize));
    }
  }

  /** Кэш курсов отдельно по валюте отчёта (display). TTL 1 ч; `force` обходит кэш. */
  private readonly marketingFxCache = new Map<
    string,
    {
      at: number;
      data: {
        display: string;
        asOf: string;
        source: string;
        multiplyToDisplay: Record<string, number>;
      };
    }
  >();

  private readonly marketingFxTtlMs = 60 * 60 * 1000;

  /**
   * Тянем курсы EUR→TRY, GBP с api.frankfurter.app/latest (без /v1 — иначе 404).
   * RUB в наборе ECB на .app часто отсутствует — добираем с api.frankfurter.dev/v2.
   */
  private async fetchFrankfurterMergedRates(): Promise<{
    ratesVsEur: Record<string, number>;
    asOf: string;
    source: string;
  }> {
    const res = await axios.get<{ rates?: Record<string, number>; date?: string }>(
      'https://api.frankfurter.app/latest?from=EUR&to=TRY,GBP',
      { timeout: 12_000 },
    );
    const ratesVsEur: Record<string, number> = { ...(res.data?.rates || {}) };
    let asOf = String(res.data?.date ?? '');
    let source = 'Frankfurter api.frankfurter.app (ECB)';
    try {
      const r2 = await axios.get<
        Array<{ date?: string; quote?: string; rate?: number }>
      >('https://api.frankfurter.dev/v2/rates?base=EUR&quotes=RUB', {
        timeout: 10_000,
      });
      if (Array.isArray(r2.data)) {
        for (const row of r2.data) {
          if (row.quote === 'RUB' && row.rate != null && Number(row.rate) > 0) {
            ratesVsEur.RUB = Number(row.rate);
            if (row.date) asOf = row.date;
          }
        }
        source += ' + RUB (frankfurter.dev v2)';
      }
    } catch (e: unknown) {
      this.log.warn(
        `FX: не удалось подтянуть RUB с frankfurter.dev: ${e instanceof Error ? e.message : e}`,
      );
    }
    if (!asOf) asOf = new Date().toISOString().slice(0, 10);
    if (!ratesVsEur || Object.keys(ratesVsEur).length === 0) {
      throw new BadRequestException('FX: пустой ответ курсов');
    }
    return { ratesVsEur, asOf, source };
  }

  /**
   * Курсы для экранов маркетинга: только EUR, GBP, TRY, RUB.
   * Множитель: amount_in_display = amount_in_src * multiplyToDisplay[src].
   */
  async getMarketingFxRates(
    displayRaw: string,
    opts?: { force?: boolean },
  ): Promise<{
    display: string;
    asOf: string;
    source: string;
    multiplyToDisplay: Record<string, number>;
  }> {
    const allowed = ['EUR', 'GBP', 'TRY', 'RUB'] as const;
    const set = new Set<string>(allowed);
    const display = (displayRaw || 'EUR').toUpperCase().slice(0, 8);
    if (!set.has(display)) {
      throw new BadRequestException(
        `Unsupported display currency: ${display}. Allowed: ${allowed.join(', ')}`,
      );
    }
    const now = Date.now();
    const force = opts?.force === true;
    if (!force) {
      const cached = this.marketingFxCache.get(display);
      if (cached && now - cached.at < this.marketingFxTtlMs) {
        return cached.data;
      }
    }
    let ratesVsEur: Record<string, number>;
    let asOf: string;
    let source: string;
    try {
      const m = await this.fetchFrankfurterMergedRates();
      ratesVsEur = m.ratesVsEur;
      asOf = m.asOf;
      source = m.source;
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.message : String(e);
      throw new BadRequestException(`FX: Frankfurter недоступен (${msg})`);
    }
    /** Сколько EUR в 1 единице валюты F (1 EUR = r units of F ⇒ 1 F = 1/r EUR). */
    const eurPerUnit: Record<string, number> = { EUR: 1 };
    for (const c of ['TRY', 'GBP', 'RUB'] as const) {
      const r = Number(ratesVsEur[c]);
      if (Number.isFinite(r) && r > 0) eurPerUnit[c] = 1 / r;
      else eurPerUnit[c] = 1;
    }
    const multiplyToDisplay: Record<string, number> = {};
    for (const f of allowed) {
      multiplyToDisplay[f] = eurPerUnit[f] / eurPerUnit[display];
    }
    const data = {
      display,
      asOf,
      source,
      multiplyToDisplay,
    };
    this.marketingFxCache.set(display, { at: now, data });
    return data;
  }

  // --- Traffic (каналы / импорт) ---

  async getTrafficChannelsStats(
    tenantId: string,
    from?: string,
    to?: string,
    dataSource?: string,
    /** Лимит строк детализации (после GROUP BY); тоталы и провайдеры — полные. */
    itemsLimit = 14_000,
  ): Promise<MarketingTrafficChannelsStats> {
    const qb = this.trafficRepo
      .createQueryBuilder('t')
      .where('t.tenantId = :tenantId', { tenantId });
    if (from) qb.andWhere('t.date >= :from', { from });
    if (to) qb.andWhere('t.date <= :to', { to });
    if (dataSource) qb.andWhere('t.dataSource = :ds', { ds: dataSource });

    const num = (v: string | number | null | undefined) =>
      Number(v != null && v !== '' ? v : 0) || 0;

    const [totalRows, totalsRaw, curRaw, itemRaw, provRaw, dataSourceLabels] =
      await Promise.all([
        qb.clone().getCount(),
        qb
          .clone()
          .select('COALESCE(SUM(t.sessions), 0)', 'totalSessions')
          .addSelect('COALESCE(SUM(t.clicks), 0)', 'totalClicks')
          .addSelect('COALESCE(SUM(t.leads), 0)', 'totalLeads')
          .addSelect('COALESCE(SUM(t.revenue), 0)', 'totalRevenue')
          .addSelect('COALESCE(SUM(t.impressions), 0)', 'totalImpressions')
          .addSelect('COALESCE(SUM(t.cost), 0)', 'totalCost')
          .getRawOne(),
        qb
          .clone()
          .select('t.currency', 'currency')
          .distinct(true)
          .orderBy('t.currency', 'ASC')
          .getRawMany(),
        qb
          .clone()
          .select('t.dataSource', 'dataSource')
          .addSelect('t.source', 'source')
          .addSelect('t.medium', 'medium')
          .addSelect('t.campaign', 'campaign')
          .addSelect('COALESCE(SUM(t.sessions), 0)', 'sessions')
          .addSelect('COALESCE(SUM(t.clicks), 0)', 'clicks')
          .addSelect('COALESCE(SUM(t.leads), 0)', 'leads')
          .addSelect('COALESCE(SUM(t.revenue), 0)', 'revenue')
          .addSelect('COALESCE(SUM(t.impressions), 0)', 'impressions')
          .addSelect('COALESCE(SUM(t.cost), 0)', 'cost')
          .addSelect('MAX(t.currency)', 'currency')
          .groupBy('t.dataSource')
          .addGroupBy('t.source')
          .addGroupBy('t.medium')
          .addGroupBy('t.campaign')
          // Иначе при GA4 с сотнями тысяч комбинаций UI и JSON «захлёбываются»; тоталы/провайдеры — отдельными запросами.
          .orderBy(
            'COALESCE(SUM(t.sessions), 0) + COALESCE(SUM(t.clicks), 0) + COALESCE(SUM(t.impressions), 0) + ABS(COALESCE(SUM(t.revenue), 0)) + ABS(COALESCE(SUM(t.cost), 0))',
            'DESC',
          )
          .limit(Math.min(Math.max(itemsLimit, 2_000), 80_000))
          .getRawMany(),
        qb
          .clone()
          .select('t.dataSource', 'dataSource')
          .addSelect('COUNT(*)', 'rowCount')
          .addSelect('COALESCE(SUM(t.sessions), 0)', 'sessions')
          .addSelect('COALESCE(SUM(t.clicks), 0)', 'clicks')
          .addSelect('COALESCE(SUM(t.leads), 0)', 'leads')
          .addSelect('COALESCE(SUM(t.revenue), 0)', 'revenue')
          .addSelect('COALESCE(SUM(t.impressions), 0)', 'impressions')
          .addSelect('COALESCE(SUM(t.cost), 0)', 'cost')
          .addSelect('MAX(t.currency)', 'currency')
          .groupBy('t.dataSource')
          .getRawMany(),
        this.buildMarketingDataSourceLabels(tenantId),
      ]);

    const currenciesPresent = (curRaw as { currency?: string }[])
      .map((r) => normTrafficCurrency(r.currency))
      .filter((c, i, a) => c && a.indexOf(c) === i)
      .sort();
    const currency =
      currenciesPresent.length === 0
        ? 'EUR'
        : currenciesPresent.length === 1
          ? currenciesPresent[0]
          : 'MIXED';

    const items = (itemRaw as Record<string, unknown>[]).map((r) => {
      const dsRaw = r.dataSource != null ? String(r.dataSource).trim() : '';
      const ds = dsRaw || '_none';
      return {
        dataSource: ds && ds !== '_none' ? ds : null,
        source:
          r.source != null && String(r.source).trim() !== ''
            ? String(r.source)
            : null,
        medium:
          r.medium != null && String(r.medium).trim() !== ''
            ? String(r.medium)
            : null,
        campaign: sanitizeTrafficText(
          r.campaign != null ? String(r.campaign) : undefined,
        ),
        sessions: num(r.sessions as string),
        clicks: num(r.clicks as string),
        leads: num(r.leads as string),
        revenue: num(r.revenue as string),
        impressions: num(r.impressions as string),
        cost: num(r.cost as string),
        currency: normTrafficCurrency(r.currency as string),
      };
    });

    const providerBreakdown: MarketingTrafficProviderBreakdown[] = (
      provRaw as Record<string, unknown>[]
    )
      .map((r) => {
        const dsRaw = r.dataSource != null ? String(r.dataSource).trim() : '';
        const key = dsRaw || '_none';
      return {
          dataSource: key === '_none' ? 'unknown' : key,
          rowCount: num(r.rowCount as string),
          sessions: num(r.sessions as string),
          clicks: num(r.clicks as string),
          leads: num(r.leads as string),
          revenue: num(r.revenue as string),
          impressions: num(r.impressions as string),
          cost: num(r.cost as string),
          currency: normTrafficCurrency(r.currency as string),
        };
      })
      .sort((a, b) => a.dataSource.localeCompare(b.dataSource));

    const dsSet = new Set<string>();
    for (const it of items) {
      if (it.dataSource) dsSet.add(it.dataSource);
    }
    for (const p of providerBreakdown) {
      dsSet.add(p.dataSource);
    }

    const tr = totalsRaw as Record<string, unknown> | undefined;
    return {
      from: from ?? null,
      to: to ?? null,
      currency,
      currenciesPresent,
      totalSessions: num(tr?.totalSessions as string),
      totalLeads: num(tr?.totalLeads as string),
      totalRevenue: num(tr?.totalRevenue as string),
      totalClicks: num(tr?.totalClicks as string),
      totalImpressions: num(tr?.totalImpressions as string),
      totalCost: num(tr?.totalCost as string),
      totalRows,
      dataSources: [...dsSet].sort(),
      providerBreakdown,
      dataSourceLabels,
      items,
    };
  }

  /**
   * Дневные агрегаты по marketing_traffic для графиков в UI (один канал или только строки без dataSource).
   */
  async getTrafficDailySeries(
    tenantId: string,
    from?: string,
    to?: string,
    dataSource?: string,
    onlyUnattributed?: boolean,
  ): Promise<{ series: MarketingTrafficDailyPoint[] }> {
    const qb = this.trafficRepo
      .createQueryBuilder('t')
      .where('t.tenantId = :tenantId', { tenantId });
    if (from) qb.andWhere('t.date >= :from', { from });
    if (to) qb.andWhere('t.date <= :to', { to });
    if (onlyUnattributed) {
      qb.andWhere('(t.dataSource IS NULL OR t.dataSource = :empty)', {
        empty: '',
      });
    } else if (dataSource && dataSource.trim()) {
      qb.andWhere('t.dataSource = :ds', { ds: dataSource.trim() });
    }

    const num = (v: string | number | null | undefined) =>
      Number(v != null && v !== '' ? v : 0) || 0;

    const raw = await qb
      .select('t.date', 'date')
      .addSelect('COALESCE(SUM(t.sessions), 0)', 'sessions')
      .addSelect('COALESCE(SUM(t.clicks), 0)', 'clicks')
      .addSelect('COALESCE(SUM(t.leads), 0)', 'leads')
      .addSelect('COALESCE(SUM(t.revenue), 0)', 'revenue')
      .addSelect('COALESCE(SUM(t.cost), 0)', 'cost')
      .addSelect('COALESCE(SUM(t.impressions), 0)', 'impressions')
      .groupBy('t.date')
      .orderBy('t.date', 'ASC')
      .getRawMany();

    const series: MarketingTrafficDailyPoint[] = (raw as Record<string, unknown>[]).map(
      (r) => ({
        date: String(r.date ?? '').slice(0, 10),
        sessions: num(r.sessions as string),
        clicks: num(r.clicks as string),
        leads: num(r.leads as string),
        revenue: num(r.revenue as string),
        cost: num(r.cost as string),
        impressions: num(r.impressions as string),
      }),
    );

    return { series };
  }

  /**
   * Агрегат по стране (ISO2 в поле country) за период и канал — для карты и таблицы в UI.
   */
  async getTrafficByCountry(
    tenantId: string,
    from?: string,
    to?: string,
    dataSource?: string,
    onlyUnattributed?: boolean,
  ): Promise<{
    rows: Array<{
      country: string | null;
      sessions: number;
      clicks: number;
      impressions: number;
    }>;
  }> {
    const qb = this.trafficRepo
      .createQueryBuilder('t')
      .where('t.tenantId = :tenantId', { tenantId });
    if (from) qb.andWhere('t.date >= :from', { from });
    if (to) qb.andWhere('t.date <= :to', { to });
    if (onlyUnattributed) {
      qb.andWhere('(t.dataSource IS NULL OR t.dataSource = :empty)', {
        empty: '',
      });
    } else if (dataSource && dataSource.trim()) {
      qb.andWhere('t.dataSource = :ds', { ds: dataSource.trim() });
    }

    const num = (v: string | number | null | undefined) =>
      Number(v != null && v !== '' ? v : 0) || 0;

    const countryKeyExpr = `NULLIF(TRIM(UPPER(COALESCE(t.country, ''))), '')`;

    const raw = await qb
      .select(countryKeyExpr, 'country')
      .addSelect('COALESCE(SUM(t.sessions), 0)', 'sessions')
      .addSelect('COALESCE(SUM(t.clicks), 0)', 'clicks')
      .addSelect('COALESCE(SUM(t.impressions), 0)', 'impressions')
      .groupBy(countryKeyExpr)
      .orderBy('COALESCE(SUM(t.sessions), 0)', 'DESC')
      .getRawMany();

    const rows = (raw as Record<string, unknown>[]).map((r) => {
      const c = r.country as string | null;
    return {
        country: c && String(c).trim() !== '' ? String(c).trim().toUpperCase() : null,
        sessions: num(r.sessions as string),
        clicks: num(r.clicks as string),
        impressions: num(r.impressions as string),
      };
    });

    return { rows };
  }

  /** Имена ресурсов GA4 из настроек интеграций (ключ dataSource = ga4_{propertyId}). */
  private async buildMarketingDataSourceLabels(
    tenantId: string,
  ): Promise<Record<string, string>> {
    const rows = await this.integrationRepo.find({
      where: { tenantId },
      select: ['provider', 'primaryId', 'settings', 'name'],
    });
    const out: Record<string, string> = {};
    for (const r of rows) {
      const p = this.normalizeMarketingIntegrationProvider(r.provider);
      const isGa =
        p === 'ga4' ||
        p === 'google_analytics' ||
        p === 'google_analytics_4' ||
        p === 'google_analytics_ga4';
      if (!isGa) continue;
      const flat = this.flattenNestedIntegrationSettings(
        this.parseSettingsObject(r.settings),
      );
      const pid = this.pickFirstNonEmptyString([
        r.primaryId,
        flat.propertyId,
        flat.ga4PropertyId,
        flat.ga_property_id,
      ])
        ?.replace(/^properties\//i, '')
        .trim();
      if (!pid || !/^\d+$/.test(pid)) continue;
      const key = `ga4_${pid}`.slice(0, 80);
      const display = this.pickFirstNonEmptyString([
        flat.ga4PropertyDisplayName,
        flat.ga4_property_display_name,
        r.name,
      ]);
      if (display) out[key] = display;
    }
    return out;
  }

  async importTraffic(
    tenantId: string,
    body: {
      items: Array<{
        date: string;
        source?: string;
        medium?: string;
        campaign?: string;
        country?: string;
        sessions?: number;
        clicks?: number;
        leads?: number;
        projects?: number;
        cost?: number;
        revenue?: number;
        currency?: string;
        impressions?: number;
        dataSource?: string;
      }>;
    },
  ): Promise<{ imported: number }> {
    const raw = Array.isArray(body?.items) ? body.items : [];
    const rows: MarketingTraffic[] = [];

    for (const it of raw) {
      if (!it?.date) continue;
      const ctry = it.country != null ? String(it.country).trim().toUpperCase().slice(0, 8) : '';
      const row = this.trafficRepo.create({
        tenantId,
        date: String(it.date).slice(0, 10),
        dataSource: it.dataSource?.trim() || 'import',
        source: sanitizeTrafficText(it.source),
        medium: sanitizeTrafficText(it.medium),
        campaign: sanitizeTrafficText(it.campaign),
        country: ctry || null,
        sessions: Math.max(0, Number(it.sessions) || 0),
        clicks: Math.max(0, Number(it.clicks) || 0),
        leads: Math.max(0, Number(it.leads) || 0),
        projects: Math.max(0, Number(it.projects) || 0),
        cost: String(Math.max(0, Number(it.cost) || 0)),
        revenue: String(Math.max(0, Number(it.revenue) || 0)),
        currency: (it.currency || 'EUR').slice(0, 8),
        impressions: Math.max(0, Number(it.impressions) || 0),
      });
      rows.push(row);
    }

    if (rows.length) await this.saveMarketingTrafficChunked(rows);
    return { imported: rows.length };
  }

  // --- UTM ---

  listUtmTemplates(tenantId: string) {
    return this.utmRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async createUtmTemplate(tenantId: string, dto: CreateUtmTemplateDto) {
    const row = this.utmRepo.create({
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
    return this.utmRepo.save(row);
  }

  async deleteUtmTemplate(tenantId: string, id: string) {
    const res = await this.utmRepo.delete({ id, tenantId });
    if (!res.affected) throw new NotFoundException('Template not found');
    return { success: true };
  }

  // --- Интеграции (GA4, Метрика, Google Ads, …) ---

  /** jsonb иногда приходит строкой; UI может класть поля во вложенные объекты. */
  private parseSettingsObject(raw: unknown): Record<string, unknown> {
    if (raw == null) return {};
    if (typeof raw === 'string') {
      const t = raw.trim();
      if (!t) return {};
      try {
        const p = JSON.parse(t) as unknown;
        return typeof p === 'object' && p !== null && !Array.isArray(p)
          ? (p as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      return { ...(raw as Record<string, unknown>) };
    }
    return {};
  }

  /**
   * Провайдер в БД/UI может содержать пробелы, дефисы, невидимые символы (копипаст).
   */
  private normalizeMarketingIntegrationProvider(raw: unknown): string {
    return String(raw ?? '')
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/-/g, '_');
  }

  private isMetaAdsProvider(normalized: string): boolean {
    return (
      normalized === 'meta_ads' ||
      normalized === 'facebook_ads' ||
      normalized === 'meta' ||
      normalized === 'facebook_marketing' ||
      normalized === 'instagram_ads' ||
      normalized === 'fb_ads'
    );
  }

  private flattenNestedIntegrationSettings(
    s: Record<string, unknown>,
  ): Record<string, unknown> {
    const out = { ...s };
    const nest = [
      'metrika',
      'yandex',
      'metrica',
      'yandexMetrika',
      'yandex_metrika',
      'config',
      'credentials',
      'auth',
      'ga4',
      'googleAnalytics',
      'google_analytics',
      'meta',
      'facebook',
      'metaAds',
      'meta_ads',
      'google_ads',
      'googleAds',
      'adwords',
    ];
    for (const k of nest) {
      const inner = out[k];
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
        Object.assign(out, inner as Record<string, unknown>);
      }
    }
    return out;
  }

  private pickFirstNonEmptyString(values: unknown[]): string {
    for (const v of values) {
      if (v === null || v === undefined) continue;
      const t = String(v).trim();
      if (t) return t;
    }
    return '';
  }

  private normalizeMetrikaOAuthToken(raw: string): string {
    let t = raw.trim();
    if (/^oauth\s+/i.test(t)) t = t.replace(/^oauth\s+/i, '').trim();
    if (/^bearer\s+/i.test(t)) t = t.replace(/^bearer\s+/i, '').trim();
    return t;
  }

  listMarketingIntegrations(tenantId: string) {
    return this.integrationRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async createMarketingIntegration(
    tenantId: string,
    dto: CreateMarketingIntegrationDto,
  ) {
    const settings: Record<string, unknown> = {
      ...this.parseSettingsObject(dto.settings as unknown),
    };
    if (dto.ga4ServiceAccountJson?.trim()) {
      settings.serviceAccountJson = dto.ga4ServiceAccountJson.trim();
    }
    const row = this.integrationRepo.create({
        tenantId,
      provider: dto.provider,
      kind: dto.kind ?? 'analytics',
      name: dto.name,
      isActive: dto.isActive ?? true,
      primaryId: dto.primaryId?.trim() || null,
      settings: Object.keys(settings).length ? settings : null,
    });
    return this.integrationRepo.save(row);
  }

  async updateMarketingIntegration(
    tenantId: string,
    id: string,
    dto: UpdateMarketingIntegrationDto,
  ) {
    const row = await this.integrationRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Integration not found');

    if (dto.provider !== undefined) row.provider = dto.provider;
    if (dto.kind !== undefined) row.kind = dto.kind;
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.primaryId !== undefined) {
      row.primaryId = dto.primaryId?.trim() || null;
    }

    const patchSettings =
      dto.settings !== undefined || dto.ga4ServiceAccountJson !== undefined;
    if (patchSettings) {
      const base: Record<string, unknown> = {
        ...this.parseSettingsObject(row.settings),
      };
      if (dto.settings !== undefined && typeof dto.settings === 'object') {
        Object.assign(base, dto.settings);
      }
      if (dto.ga4ServiceAccountJson !== undefined) {
        const j = dto.ga4ServiceAccountJson?.trim();
        if (j) base.serviceAccountJson = j;
        else delete base.serviceAccountJson;
      }
      row.settings = Object.keys(base).length ? base : null;
    }

    return this.integrationRepo.save(row);
  }

  async deleteMarketingIntegration(tenantId: string, id: string) {
    const res = await this.integrationRepo.delete({ id, tenantId });
    if (!res.affected) throw new NotFoundException('Integration not found');
    return { success: true };
  }

  /**
   * Ручная синхронизация одной интеграции (UI: «Синхронизировать» для Google Ads).
   */
  /** @returns сколько строк трафика записано (0 — ок, но данных за период нет или синк пропущен). */
  async syncMarketingIntegrationById(tenantId: string, id: string): Promise<number> {
    const row = await this.integrationRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Integration not found');
    if (!row.isActive) {
      throw new BadRequestException('Integration is inactive');
    }
    const provider = this.normalizeMarketingIntegrationProvider(row.provider);
    try {
      if (provider === 'google_ads') {
        return await this.syncGoogleAdsIntegration(row);
      }
      if (
        provider === 'yandex_metrika' ||
        provider === 'yandex_metrica' ||
        provider === 'yandex_metrika_web'
      ) {
        return await this.syncYandexMetrikaIntegration(row);
      }
      if (
        provider === 'ga4' ||
        provider === 'google_analytics' ||
        provider === 'google_analytics_4' ||
        provider === 'google_analytics_ga4'
      ) {
        return await this.syncGa4Integration(row);
      }
      if (this.isMetaAdsProvider(provider)) {
        return await this.syncMetaAdsIntegration(row);
      }
      throw new BadRequestException(
        `Синхронизация недоступна для провайдера «${row.provider}». Обновите backend или проверьте значение поля provider в интеграции.`,
      );
    } catch (e: unknown) {
      if (e instanceof HttpException) {
        throw e;
      }
      const msg = e instanceof Error ? e.message : String(e);
      this.log.error(
        `syncMarketingIntegrationById failed id=${id} provider=${row.provider}: ${msg}`,
        e instanceof Error ? e.stack : undefined,
      );
      throw new BadRequestException(
        `Синхронизация не удалась (${row.provider}): ${msg}`,
      );
    }
  }

  // --- Automations ---

  listAutomations(tenantId: string) {
    return this.automationRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  createAutomation(tenantId: string, dto: CreateAutomationDto) {
    const row = this.automationRepo.create({
      tenantId,
      name: dto.name,
      type: dto.type ?? 'n8n_webhook',
      webhookUrl: dto.webhookUrl ?? null,
      isActive: dto.isActive ?? true,
      meta: dto.meta ?? null,
    });
    return this.automationRepo.save(row);
  }

  async updateAutomation(tenantId: string, id: string, dto: UpdateAutomationDto) {
    const row = await this.automationRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Automation not found');
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.type !== undefined) row.type = dto.type;
    if (dto.webhookUrl !== undefined) row.webhookUrl = dto.webhookUrl ?? null;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.meta !== undefined) row.meta = dto.meta ?? null;
    return this.automationRepo.save(row);
  }

  async deleteAutomation(tenantId: string, id: string) {
    const res = await this.automationRepo.delete({ id, tenantId });
    if (!res.affected) throw new NotFoundException('Automation not found');
    return { success: true };
  }

  // --- Segments ---

  private toSegmentDto(e: MarketingSegment): SegmentDto {
      return {
      id: e.id,
      entityType: 'lead',
      name: e.name,
      description: e.description,
      leadStatuses: e.leadStatuses,
      source: e.source,
      country: e.country,
      manager: e.manager,
      createdFrom: e.createdFrom
        ? String(e.createdFrom).slice(0, 10)
        : null,
      createdTo: e.createdTo ? String(e.createdTo).slice(0, 10) : null,
      lastMatchedCount: e.lastMatchedCount,
      lastRunAt: e.lastRunAt ? e.lastRunAt.toISOString() : null,
      createdAt: e.createdAt.toISOString(),
    };
  }

  async listSegments(tenantId: string): Promise<SegmentDto[]> {
    const list = await this.segmentRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
    return list.map((e) => this.toSegmentDto(e));
  }

  async createSegment(
    tenantId: string,
    body: CreateSegmentBodyDto,
  ): Promise<SegmentDto> {
    if (body.entityType !== 'lead') {
      throw new BadRequestException('Only entityType=lead is supported');
    }
    const f = body.filters ?? {};
    const row = this.segmentRepo.create({
      tenantId,
      name: body.name,
      description: body.description?.trim() || null,
      leadStatuses: f.statuses?.length ? f.statuses : null,
      source: f.sources?.[0]?.trim() || null,
      country: f.countries?.[0]?.trim()?.slice(0, 8) || null,
      manager: f.managers?.[0]?.trim() || null,
      createdFrom: f.createdFrom?.trim()?.slice(0, 10) || null,
      createdTo: f.createdTo?.trim()?.slice(0, 10) || null,
      lastMatchedCount: 0,
      lastRunAt: null,
    });
    const saved = await this.segmentRepo.save(row);
    return this.toSegmentDto(saved);
  }

  async runSegment(
    tenantId: string,
    segmentId: string,
  ): Promise<
    Array<{
      id: string;
      name: string | null;
      email: string | null;
      phone: string | null;
      status: string;
    }>
  > {
    const seg = await this.segmentRepo.findOne({
      where: { id: segmentId, tenantId },
    });
    if (!seg) throw new NotFoundException('Segment not found');

    const qb = this.leadRepo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId });

    if (seg.leadStatuses?.length) {
      qb.andWhere('l.status IN (:...st)', { st: seg.leadStatuses });
    }
    if (seg.source) {
      qb.andWhere('l.source = :source', { source: seg.source });
    }
    if (seg.country) {
      qb.andWhere('l.country = :country', { country: seg.country });
    }
    if (seg.manager) {
      qb.andWhere('l.assignedTo ILIKE :mgr', { mgr: `%${seg.manager}%` });
    }
    if (seg.createdFrom) {
      qb.andWhere('l.createdAt >= :cf', { cf: seg.createdFrom });
    }
    if (seg.createdTo) {
      const ctEnd = new Date(`${seg.createdTo}T23:59:59.999Z`);
      qb.andWhere('l.createdAt <= :ctEnd', { ctEnd });
    }

    const leads = await qb
      .orderBy('l.createdAt', 'DESC')
      .take(5000)
      .getMany();

    seg.lastMatchedCount = leads.length;
    seg.lastRunAt = new Date();
    await this.segmentRepo.save(seg);

    return leads.map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      phone: l.phone,
      status: l.status,
    }));
  }

  // --- Google Ads (REST v23, unary search) ---

  private normalizeGoogleAdsCustomerId(id: string): string {
    return String(id || '').replace(/-/g, '').trim();
  }

  private googleAdsSearchUrl(customerId: string): string {
    const cid = this.normalizeGoogleAdsCustomerId(customerId);
    return `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${cid}/googleAds:search`;
  }

  /**
   * Обмен refresh_token на access_token.
   * Если в интеграции заданы оба поля clientId + clientSecret — используются они
   * (тот же OAuth-клиент, что выдал refresh token). Иначе — из настроек платформы CRM.
   */
  private async googleOAuthAccessToken(
    refreshToken: string,
    integrationOAuth?: { clientId: string; clientSecret: string },
  ): Promise<string> {
    let clientId = integrationOAuth?.clientId?.trim() || '';
    let clientSecret = integrationOAuth?.clientSecret?.trim() || '';
    if (!clientId || !clientSecret) {
      const platform = await this.platformSettings.getGoogleOAuthConfig();
      clientId = platform.clientId?.trim() || '';
      clientSecret = platform.clientSecret?.trim() || '';
    }
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Google OAuth: укажите client_id и client_secret в настройках платформы CRM или в JSON интеграции (поля clientId и clientSecret)',
      );
    }
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });
    try {
      const res = await axios.post(
        'https://oauth2.googleapis.com/token',
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      const access = res.data?.access_token as string | undefined;
      if (!access) {
        throw new BadRequestException('Google не вернул access_token');
      }
      return access;
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const body = err.response?.data as
          | { error?: string; error_description?: string }
          | undefined;
        const code = body?.error;
        if (status === 401 && code === 'unauthorized_client') {
          throw new BadRequestException(
            'OAuth: refresh token выдан другим Client ID, чем сейчас в CRM. ' +
              'Либо в JSON интеграции Google Ads укажите clientId и clientSecret того же OAuth-клиента, ' +
              'что использовали при получении refresh token, либо получите новый refresh token через OAuth Playground / приложение с тем же client_id, что в настройках платформы.',
          );
        }
        if (status === 400 && code === 'invalid_grant') {
          throw new BadRequestException(
            'OAuth: refresh token недействителен или отозван. Получите новый refresh token.',
          );
        }
        const hint = [code, body?.error_description].filter(Boolean).join(' — ');
        throw new BadRequestException(
          hint
            ? `Запрос токена Google отклонён (${status ?? '?'})${hint ? `: ${hint}` : ''}`
            : `Запрос токена Google отклонён (${status ?? 'network'})`,
        );
      }
      throw err;
    }
  }

  /**
   * Тянет статистику кампаний за период и пишет строки в marketing_traffic (dataSource=google_ads).
   */
  /** @returns число сохранённых строк marketing_traffic (0 если пропуск или нет данных). */
  async syncGoogleAdsIntegration(row: MarketingIntegration): Promise<number> {
    if (row.provider !== 'google_ads' || !row.isActive) return 0;

    const s = this.flattenNestedIntegrationSettings(
      this.parseSettingsObject(row.settings),
    );
    const refreshToken = String(s.refreshToken || s.refresh_token || '').trim();
    const customerId = String(s.customerId || s.customer_id || row.primaryId || '').trim();
    const developerToken = String(
      s.developerToken ||
        s.developer_token ||
        process.env.GOOGLE_ADS_DEVELOPER_TOKEN ||
        '',
    ).trim();
    const loginCustomerId = String(
      s.loginCustomerId || s.login_customer_id || '',
    ).trim();

    if (!refreshToken || !customerId || !developerToken) {
      this.log.warn(
        `Google Ads sync skipped for integration ${row.id}: missing refreshToken, customerId or developerToken`,
      );
      return 0;
    }

    const intClientId = String(s.clientId || s.client_id || '').trim();
    const intClientSecret = String(s.clientSecret || s.client_secret || '').trim();
    const integrationOAuth =
      intClientId && intClientSecret
        ? { clientId: intClientId, clientSecret: intClientSecret }
        : undefined;

    const accessToken = await this.googleOAuthAccessToken(
      refreshToken,
      integrationOAuth,
    );
    const end = new Date();
    const start = new Date();
    start.setUTCDate(end.getUTCDate() - 30);
    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);

    const query = `
      SELECT campaign.id, campaign.name, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros
      FROM campaign
      WHERE segments.date BETWEEN '${from}' AND '${to}'
        AND campaign.status != 'REMOVED'
      ORDER BY segments.date, campaign.id
    `.trim();

    const url = this.googleAdsSearchUrl(customerId);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    };
    const login = this.normalizeGoogleAdsCustomerId(loginCustomerId);
    if (login) headers['login-customer-id'] = login;

    const trafficRows: MarketingTraffic[] = [];
    let pageToken: string | undefined;

    try {
      do {
        // pageSize в теле не передаём: REST googleAds:search фиксирует страницу 10000 строк (PAGE_SIZE_NOT_SUPPORTED).
        const body: Record<string, unknown> = { query };
        if (pageToken) body.pageToken = pageToken;

        const res = await axios.post(url, body, {
          headers,
          timeout: 180_000,
          validateStatus: (s) => s < 500,
        });
        if (res.status >= 400) {
          const detail = extractGoogleAdsRestErrorPayload(res.data);
          const hint = googleAdsSyncFailureHint(detail);
          const reqId =
            (typeof res.headers?.['request-id'] === 'string' && res.headers['request-id']) ||
            (typeof res.headers?.['Request-Id'] === 'string' && res.headers['Request-Id']) ||
            '';
          const rid = reqId ? ` [request-id: ${reqId}]` : '';
          if (detail.includes('DEVELOPER_TOKEN_NOT_APPROVED')) {
            throw new BadRequestException(
              'Developer token Google Ads только для тестовых аккаунтов. ' +
                'В Google Ads: Инструменты → API Center подайте заявку на Basic или Standard access для работы с боевым Customer ID. ' +
                'Интеграцию в CRM заново создавать не нужно — после одобрения токена синк заработает с теми же настройками.' +
                rid,
            );
          }
          throw new BadRequestException(
            `Google Ads API: запрос отклонён (${res.status})${detail ? ` — ${detail}` : ''}${hint}${rid}`,
          );
        }
        const results = (res.data?.results || []) as any[];
        pageToken = res.data?.nextPageToken as string | undefined;

        for (const r of results) {
          const date = r.segments?.date as string | undefined;
          const name = r.campaign?.name as string | undefined;
          if (!date) continue;
          const impressions = Number(r.metrics?.impressions || 0);
          const clicks = Number(r.metrics?.clicks || 0);
          const costMicros = Number(r.metrics?.costMicros || 0);
          const cost = costMicros / 1_000_000;

          trafficRows.push(
            this.trafficRepo.create({
              tenantId: row.tenantId,
              date: String(date).slice(0, 10),
              dataSource: 'google_ads',
              source: 'google',
              medium: 'cpc',
              campaign: name || '(campaign)',
              sessions: clicks,
              clicks,
              leads: 0,
              projects: 0,
              cost: String(cost),
              revenue: '0',
              currency: String(s.currency || 'EUR').slice(0, 8) || 'EUR',
              impressions,
            }),
          );
        }
      } while (pageToken);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const st = err.response?.status;
        const detail = extractGoogleAdsRestErrorPayload(err.response?.data);
        const hint = googleAdsSyncFailureHint(detail);
        if (detail.includes('DEVELOPER_TOKEN_NOT_APPROVED')) {
          throw new BadRequestException(
            'Developer token Google Ads только для тестовых аккаунтов. ' +
              'В Google Ads: Инструменты → API Center подайте заявку на Basic или Standard access для работы с боевым Customer ID. ' +
              'Интеграцию в CRM заново создавать не нужно — после одобрения токена синк заработает с теми же настройками.',
          );
        }
        if (st && st >= 400 && detail) {
          throw new BadRequestException(
            `Google Ads API: запрос отклонён (${st}) — ${detail}${hint}`,
          );
        }
        const net = err.code === 'ECONNABORTED' ? 'таймаут запроса к Google Ads' : err.message || 'сеть';
        throw new BadRequestException(
          `Google Ads API: нет ответа (${st ?? 'network'}) — ${net}${hint ? `. ${hint}` : ''}`,
        );
      }
      throw err;
    }

    if (!trafficRows.length) return 0;

    await this.trafficRepo
      .createQueryBuilder()
      .delete()
      .from(MarketingTraffic)
      .where('tenantId = :tenantId', { tenantId: row.tenantId })
      .andWhere('dataSource = :ds', { ds: 'google_ads' })
      .andWhere('date BETWEEN :from AND :to', { from, to })
      .execute();

    await this.saveMarketingTrafficChunked(trafficRows);
    this.log.log(
      `Google Ads v23: saved ${trafficRows.length} rows for tenant ${row.tenantId}`,
    );
    return trafficRows.length;
  }

  async syncAllActiveGoogleAds(): Promise<void> {
    const list = await this.integrationRepo.find({
      where: { provider: 'google_ads', isActive: true },
    });
    for (const row of list) {
      try {
        await this.syncGoogleAdsIntegration(row);
      } catch (e: any) {
        this.log.error(
          `Google Ads sync failed for ${row.id}: ${e?.message || e}`,
        );
      }
    }
  }

  async syncGoogleAdsForTenant(tenantId: string): Promise<void> {
    const list = await this.integrationRepo.find({
      where: { tenantId, provider: 'google_ads', isActive: true },
    });
    for (const row of list) {
      await this.syncGoogleAdsIntegration(row);
    }
  }

  // --- Яндекс.Метрика + GA4 (отчётность в marketing_traffic) ---

  private async googleServiceAccountAccessToken(
    serviceAccountJson: string,
    scope: string,
  ): Promise<string> {
    let key: {
      client_email: string;
      private_key: string;
      token_uri?: string;
    };
    try {
      key = JSON.parse(serviceAccountJson);
    } catch {
      throw new BadRequestException('GA4: невалидный JSON сервисного аккаунта');
    }
    const pk = String(key.private_key || '').replace(/\\n/g, '\n');
    if (!key.client_email || !pk) {
      throw new BadRequestException(
        'GA4: в JSON сервисного аккаунта нужны client_email и private_key',
      );
    }
    const tokenUri = key.token_uri || 'https://oauth2.googleapis.com/token';
    const now = Math.floor(Date.now() / 1000);
    const assertion = jwt.sign(
      {
        iss: key.client_email,
        sub: key.client_email,
        scope,
        aud: tokenUri,
      iat: now,
      exp: now + 3600,
      },
      pk,
      { algorithm: 'RS256' },
    );
    try {
      const res = await axios.post(
        tokenUri,
        new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      const token = res.data?.access_token as string | undefined;
      if (!token) {
        throw new BadRequestException('GA4: Google не вернул access_token');
      }
      return token;
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const d = err.response?.data as
          | { error_description?: string; error?: string }
          | undefined;
        throw new BadRequestException(
          `GA4 (service account): ${d?.error_description || d?.error || err.message}`,
        );
      }
      throw err;
    }
  }

  private ga4DimensionDateToIso(raw: string): string | null {
    const v = String(raw).replace(/-/g, '');
    if (/^\d{8}$/.test(v)) {
      return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return raw.slice(0, 10);
    }
    return null;
  }

  /** Display name ресурса GA4 (Admin API), тот же scope analytics.readonly. */
  private async fetchGa4PropertyDisplayName(
    serviceAccountJson: string,
    numericPropertyId: string,
  ): Promise<string | null> {
    try {
      const access = await this.googleServiceAccountAccessToken(
        serviceAccountJson,
        'https://www.googleapis.com/auth/analytics.readonly',
      );
      const url = `https://analyticsadmin.googleapis.com/v1beta/properties/${numericPropertyId}`;
      const res = await axios.get<{ displayName?: string }>(url, {
        headers: { Authorization: `Bearer ${access}` },
      });
      const n = res.data?.displayName?.trim();
      return n || null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(
        `GA4 Admin API: не удалось прочитать displayName для ${numericPropertyId}: ${msg}`,
      );
      return null;
    }
  }

  private async persistGa4PropertyDisplayName(
    row: MarketingIntegration,
    displayName: string,
  ): Promise<void> {
    const base = this.parseSettingsObject(row.settings);
    if (String(base.ga4PropertyDisplayName || '').trim() === displayName) {
      return;
    }
    await this.integrationRepo.update(
      { id: row.id, tenantId: row.tenantId },
      {
        settings: { ...base, ga4PropertyDisplayName: displayName } as Record<
          string,
          unknown
        >,
      } as Record<string, unknown>,
    );
  }

  /**
   * GET stat/v1/data — визиты и просмотры по дням.
   * Настройки: counterId (или primaryId), oauthToken (OAuth-токен пользователя с доступом к счётчику).
   */
  async syncYandexMetrikaIntegration(row: MarketingIntegration): Promise<number> {
    const s = this.flattenNestedIntegrationSettings(
      this.parseSettingsObject(row.settings),
    );
    const counterId = this.pickFirstNonEmptyString([
      row.primaryId,
      s.counterId,
      s.counter_id,
      s.counter,
      s.counterNumber,
      s.counter_number,
      s.metrikaCounterId,
      s.metrika_counter_id,
      s.tagId,
      s.tag_id,
      s.ids,
      s.siteCounterId,
      s.site_counter_id,
    ]);
    const oauthRaw = this.pickFirstNonEmptyString([
      s.oauthToken,
      s.oauth_token,
      s.oauth,
      s.token,
      s.accessToken,
      s.access_token,
      s.metrikaOAuth,
      s.metrika_oauth,
      s.metrikaToken,
      s.metrika_token,
      s.yandexToken,
      s.yandex_token,
      s.yandexOAuthToken,
      s.yandex_oauth_token,
      s.apiToken,
      s.api_token,
    ]);
    const oauth = oauthRaw ? this.normalizeMetrikaOAuthToken(oauthRaw) : '';
    if (!counterId || !oauth) {
      throw new BadRequestException(
        'Яндекс.Метрика: не найдены номер счётчика и OAuth-токен в сохранённых настройках. ' +
          'Укажите в primaryId или в JSON: counterId / counter_id / tagId и oauthToken / access_token / token ' +
          '(при необходимости внутри объекта metrika или yandex).',
      );
    }
    const end = new Date();
    const start = new Date();
    start.setUTCDate(end.getUTCDate() - 30);
    const date1 = start.toISOString().slice(0, 10);
    const date2 = end.toISOString().slice(0, 10);
    const url = 'https://api-metrika.yandex.net/stat/v1/data';
    try {
      const res = await axios.get(url, {
        headers: { Authorization: `OAuth ${oauth}` },
        params: {
          ids: counterId,
          metrics: 'ym:s:visits,ym:s:pageviews',
          dimensions: 'ym:s:date',
          date1,
          date2,
          accuracy: '1',
          limit: '100000',
        },
      });
      const data = res.data?.data as Array<{
        dimensions?: Array<{ id?: string; name?: string }>;
        metrics?: number[];
      }>;
      if (!Array.isArray(data) || !data.length) {
        this.log.warn(`Yandex Metrika: пустой ответ для счётчика ${counterId}`);
        return 0;
      }
      const trafficRows: MarketingTraffic[] = [];
      for (const item of data) {
        const dim = item.dimensions?.[0];
        const rawDate = dim?.id ?? dim?.name;
        if (rawDate == null || rawDate === '') continue;
        const dateStr = String(rawDate).slice(0, 10);
        const visits = Number(item.metrics?.[0] ?? 0);
        const pageviews = Number(item.metrics?.[1] ?? 0);
        trafficRows.push(
          this.trafficRepo.create({
            tenantId: row.tenantId,
            date: dateStr,
            dataSource: 'yandex_metrika',
            source: 'yandex',
            medium: 'organic',
            campaign: '(metrika)',
            sessions: visits,
            clicks: pageviews,
            leads: 0,
            projects: 0,
            cost: '0',
            revenue: '0',
            currency: String(s.currency || 'RUB').slice(0, 8) || 'RUB',
            impressions: 0,
          }),
        );
      }
      if (!trafficRows.length) return 0;
      await this.trafficRepo
        .createQueryBuilder()
        .delete()
        .from(MarketingTraffic)
        .where('tenantId = :tenantId', { tenantId: row.tenantId })
        .andWhere('dataSource = :ds', { ds: 'yandex_metrika' })
        .andWhere('date BETWEEN :from AND :to', { from: date1, to: date2 })
        .execute();
      await this.saveMarketingTrafficChunked(trafficRows);
      this.log.log(
        `Yandex Metrika: сохранено ${trafficRows.length} строк, счётчик ${counterId}`,
      );
      return trafficRows.length;
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
          `Яндекс.Метрика API (${st ?? '?'}): ${snippet || err.message}`,
        );
      }
      throw err;
    }
  }

  /**
   * GA4 Data API runReport — сессии и просмотры по дням с разбивкой по источнику / medium / кампании сессии.
   * dataSource: ga4_{propertyId}, чтобы несколько ресурсов GA4 не перетирали друг друга при синке.
   */
  async syncGa4Integration(row: MarketingIntegration): Promise<number> {
    const s = this.flattenNestedIntegrationSettings(
      this.parseSettingsObject(row.settings),
    );
    const jsonRaw = this.pickFirstNonEmptyString([
      s.serviceAccountJson,
      s.service_account_json,
      s.ga4ServiceAccountJson,
      s.ga4_service_account_json,
      s.credentialsJson,
      s.credentials_json,
    ]);
    let propertyId = this.pickFirstNonEmptyString([
      row.primaryId,
      s.propertyId,
      s.ga4PropertyId,
      s.ga_property_id,
    ]);
    propertyId = propertyId.replace(/^properties\//i, '');
    if (!jsonRaw || !propertyId) {
      throw new BadRequestException(
        'GA4: укажите serviceAccountJson (ключ сервисного аккаунта) и propertyId (или primaryId свойства GA4, только цифры).',
      );
    }
    const dataSourceTag = `ga4_${propertyId}`.slice(0, 80);
    const end = new Date();
    const start = new Date();
    start.setUTCDate(end.getUTCDate() - 30);
    const date1 = start.toISOString().slice(0, 10);
    const date2 = end.toISOString().slice(0, 10);

    const access = await this.googleServiceAccountAccessToken(
      jsonRaw,
      'https://www.googleapis.com/auth/analytics.readonly',
    );
    const apiUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;

    const clip = (v: string | null | undefined, max: number): string | null => {
      const t = sanitizeTrafficText(v);
      if (!t) return null;
      return t.length > max ? t.slice(0, max) : t;
    };

    type GaRow = {
      dimensionValues?: Array<{ value?: string }>;
      metricValues?: Array<{ value?: string }>;
    };

    try {
      const pageLimit = 25_000;
      const allRows: GaRow[] = [];
      let offset = 0;
      for (let guard = 0; guard < 40; guard += 1) {
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
            metrics: [
              { name: 'sessions' },
              { name: 'screenPageViews' },
            ],
            limit: pageLimit,
            offset,
            orderBys: [
              { dimension: { dimensionName: 'date', orderType: 'ALPHANUMERIC' } },
              {
                dimension: {
                  dimensionName: 'countryId',
                  orderType: 'ALPHANUMERIC',
                },
              },
              {
                dimension: {
                  dimensionName: 'sessionSource',
                  orderType: 'ALPHANUMERIC',
                },
              },
              {
                dimension: {
                  dimensionName: 'sessionMedium',
                  orderType: 'ALPHANUMERIC',
                },
              },
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
              Authorization: `Bearer ${access}`,
              'Content-Type': 'application/json',
            },
          },
        );
        const batch = res.data?.rows as GaRow[] | undefined;
        if (!Array.isArray(batch) || batch.length === 0) break;
        allRows.push(...batch);
        if (batch.length < pageLimit) break;
        offset += pageLimit;
      }

      if (!allRows.length) {
        this.log.warn(`GA4: пустой отчёт для property ${propertyId}`);
        return 0;
      }

      const mergeMap = new Map<string, MarketingTraffic>();
      for (const r of allRows) {
        const rawD = r.dimensionValues?.[0]?.value;
        if (rawD == null) continue;
        const dateStr = this.ga4DimensionDateToIso(String(rawD));
        if (!dateStr) continue;
        const sessions = Number(r.metricValues?.[0]?.value ?? 0);
        const views = Number(r.metricValues?.[1]?.value ?? 0);
        if (!sessions && !views) continue;
        const rawCountry = String(r.dimensionValues?.[1]?.value ?? '')
          .trim()
          .toUpperCase();
        const countryIso =
          rawCountry &&
          rawCountry !== '(NOT SET)' &&
          rawCountry !== 'NOT SET' &&
          /^[A-Z]{2}$/.test(rawCountry)
            ? rawCountry
            : null;
        const src = clip(r.dimensionValues?.[2]?.value, 128) ?? '(not set)';
        const med = clip(r.dimensionValues?.[3]?.value, 128) ?? '(not set)';
        const camp =
          clip(r.dimensionValues?.[4]?.value, 256) ?? '(not set)';
        const cKey = countryIso ?? '';
        const key = `${dateStr}\t${src}\t${med}\t${camp}\t${cKey}`;
        const prev = mergeMap.get(key);
        if (prev) {
          prev.sessions += sessions;
          prev.clicks += views;
          prev.impressions += views;
          continue;
        }
        mergeMap.set(
          key,
          this.trafficRepo.create({
            tenantId: row.tenantId,
            date: dateStr,
            dataSource: dataSourceTag,
            source: src,
            medium: med,
            campaign: camp,
            country: countryIso,
            sessions,
            clicks: views,
            leads: 0,
            projects: 0,
            cost: '0',
            revenue: '0',
            currency: String(s.currency || 'EUR').slice(0, 8) || 'EUR',
            /** GA4: screenPageViews — в CRM «Показы» (просмотры экранов/страниц), не рекламные impressions. */
            impressions: views,
          }),
        );
      }
      const trafficRows = [...mergeMap.values()];
      if (!trafficRows.length) return 0;
      await this.trafficRepo
        .createQueryBuilder()
        .delete()
        .from(MarketingTraffic)
        .where('tenantId = :tenantId', { tenantId: row.tenantId })
        .andWhere('dataSource = :ds', { ds: dataSourceTag })
        .andWhere('date BETWEEN :from AND :to', { from: date1, to: date2 })
        .execute();
      await this.saveMarketingTrafficChunked(trafficRows);
      const displayName = await this.fetchGa4PropertyDisplayName(
        jsonRaw,
        propertyId,
      );
      if (displayName) {
        try {
          await this.persistGa4PropertyDisplayName(row, displayName);
        } catch (e: unknown) {
          this.log.warn(
            `GA4: не удалось сохранить displayName в интеграции: ${
              e instanceof Error ? e.message : e
            }`,
          );
        }
      }
      this.log.log(
        `GA4: сохранено ${trafficRows.length} строк (источник/кампания/страна), property ${propertyId}`,
      );
      return trafficRows.length;
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

  /**
   * Meta / Facebook Marketing API — дневные insights по рекламному аккаунту.
   * Нужны: access token с правами ads_read и ID счёта (только цифры или act_…).
   */
  async syncMetaAdsIntegration(row: MarketingIntegration): Promise<number> {
    const s = this.flattenNestedIntegrationSettings(
      this.parseSettingsObject(row.settings),
    );
    const token = this.pickFirstNonEmptyString([
      s.accessToken,
      s.access_token,
      s.longLivedToken,
      s.long_lived_token,
      s.metaAccessToken,
      s.meta_access_token,
      s.fbAccessToken,
      s.fb_access_token,
    ]);
    let accountRaw = this.pickFirstNonEmptyString([
      row.primaryId,
      s.adAccountId,
      s.ad_account_id,
      s.accountId,
      s.account_id,
    ]);
    if (!token || !accountRaw) {
      throw new BadRequestException(
        'Meta Ads: укажите access token и ID рекламного аккаунта (adAccountId в JSON или primaryId; цифры из Ads Manager, с префиксом act_ или без).',
      );
    }
    accountRaw = accountRaw.replace(/^act_/i, '').trim();
    if (!/^\d+$/.test(accountRaw)) {
      throw new BadRequestException(
        'Meta Ads: ID рекламного аккаунта — только цифры (как в Ads Manager, без букв).',
      );
    }
    const actPath = `act_${accountRaw}`;

    const end = new Date();
    const start = new Date();
    start.setUTCDate(end.getUTCDate() - 30);
    const since = start.toISOString().slice(0, 10);
    const until = end.toISOString().slice(0, 10);

    const graphVer = 'v19.0';
    const baseUrl = `https://graph.facebook.com/${graphVer}/${actPath}/insights`;
    const agg = new Map<
      string,
      { impressions: number; clicks: number; spend: number; campaignLabel: string }
    >();

    try {
      let nextUrl: string | null = null;
      let useParams = true;
      while (useParams || nextUrl) {
        const res = await axios.get(useParams ? baseUrl : (nextUrl as string), {
          params: useParams
            ? {
                fields:
                  'impressions,clicks,spend,date_start,campaign_name,campaign_id',
                level: 'campaign',
                time_increment: 1,
                time_range: JSON.stringify({ since, until }),
                access_token: token,
                limit: 500,
              }
            : undefined,
        });
        useParams = false;
        nextUrl = res.data?.paging?.next || null;

        const data = res.data?.data as
          | Array<{
              impressions?: string;
              clicks?: string;
              spend?: string;
              date_start?: string;
              campaign_name?: string;
              campaign_id?: string;
            }>
          | undefined;
        if (Array.isArray(data)) {
          for (const it of data) {
            const ds = it.date_start?.slice(0, 10);
            if (!ds) continue;
            const rawName = it.campaign_name?.trim();
            const id = it.campaign_id?.toString().trim();
            const campaignLabel =
              rawName || (id ? `Campaign ${id}` : 'Meta');
            const key = `${ds}\0${campaignLabel}`;
            const impressions =
              parseInt(String(it.impressions ?? 0), 10) || 0;
            const clicks = parseInt(String(it.clicks ?? 0), 10) || 0;
            const spend = parseFloat(String(it.spend ?? 0)) || 0;
            const prev = agg.get(key) || {
              impressions: 0,
              clicks: 0,
              spend: 0,
              campaignLabel,
            };
            agg.set(key, {
              impressions: prev.impressions + impressions,
              clicks: prev.clicks + clicks,
              spend: prev.spend + spend,
              campaignLabel,
            });
          }
        }
        if (!nextUrl) break;
      }

      if (!agg.size) {
        this.log.warn(`Meta Ads: пустой insights для ${actPath}`);
        return 0;
      }

      const trafficRows: MarketingTraffic[] = [];
      for (const [key, m] of agg) {
        const dateStr = key.split('\0')[0];
        const safeName =
          sanitizeTrafficText(m.campaignLabel) ??
          m.campaignLabel.slice(0, 256);
        trafficRows.push(
          this.trafficRepo.create({
            tenantId: row.tenantId,
            date: dateStr,
            dataSource: 'meta_ads',
            source: 'meta',
            medium: 'paid',
            campaign: safeName,
            sessions: m.clicks,
            clicks: m.clicks,
            leads: 0,
            projects: 0,
            cost: String(m.spend),
            revenue: '0',
            currency: String(s.currency || 'USD').slice(0, 8) || 'USD',
            impressions: m.impressions,
          }),
        );
      }

      await this.trafficRepo
        .createQueryBuilder()
        .delete()
        .from(MarketingTraffic)
        .where('tenantId = :tenantId', { tenantId: row.tenantId })
        .andWhere('dataSource = :ds', { ds: 'meta_ads' })
        .andWhere('date BETWEEN :from AND :to', { from: since, to: until })
        .execute();
      await this.saveMarketingTrafficChunked(trafficRows);
      this.log.log(
        `Meta Ads: сохранено ${trafficRows.length} строк (по кампаниям), ${actPath}`,
      );
      return trafficRows.length;
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const fb = err.response?.data as
          | { error?: { message?: string } }
          | undefined;
        const msg = fb?.error?.message;
        const raw = err.response?.data;
        const snippet =
          typeof raw === 'object' && raw
            ? JSON.stringify(raw).slice(0, 400)
            : '';
        throw new BadRequestException(
          msg
            ? `Meta Ads API: ${msg}`
            : `Meta Ads API (${err.response?.status ?? '?'}): ${snippet || err.message}`,
        );
      }
      throw err;
    }
  }

  /** Ночной прогон: Метрика, GA4, Meta Ads. */
  async syncAllActiveAnalyticsIntegrations(): Promise<void> {
    const list = await this.integrationRepo.find({ where: { isActive: true } });
    for (const row of list) {
      const p = this.normalizeMarketingIntegrationProvider(row.provider);
      const yandex =
        p === 'yandex_metrika' ||
        p === 'yandex_metrica' ||
        p === 'yandex_metrika_web';
      const ga =
        p === 'ga4' ||
        p === 'google_analytics' ||
        p === 'google_analytics_4' ||
        p === 'google_analytics_ga4';
      const meta = this.isMetaAdsProvider(p);
      if (!yandex && !ga && !meta) continue;
      try {
        if (yandex) await this.syncYandexMetrikaIntegration(row);
        else if (ga) await this.syncGa4Integration(row);
        else await this.syncMetaAdsIntegration(row);
      } catch (e: any) {
        this.log.error(
          `Analytics sync failed [${row.provider} ${row.id}]: ${e?.message || e}`,
        );
      }
    }
  }

  // --- SEO (настройки, OAuth state, метрики) ---

  private seoOauthSecret(): string {
    return process.env.JWT_SECRET || 'changeme';
  }

  encodeGscOauthState(tenantId: string, redirect: string): string {
    const payload = Buffer.from(
      JSON.stringify({ tenantId, redirect }),
      'utf8',
    ).toString('base64url');
    const sig = crypto
      .createHmac('sha256', this.seoOauthSecret())
      .update(payload)
      .digest('base64url');
    return `${payload}.${sig}`;
  }

  decodeGscOauthState(state: string): { tenantId: string; redirect: string } | null {
    try {
      const dot = state.indexOf('.');
      if (dot <= 0) return null;
      const payloadB64 = state.slice(0, dot);
      const sig = state.slice(dot + 1);
      const expected = crypto
        .createHmac('sha256', this.seoOauthSecret())
        .update(payloadB64)
        .digest('base64url');
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
      const data = JSON.parse(
        Buffer.from(payloadB64, 'base64url').toString('utf8'),
      );
      if (!data?.tenantId || typeof data.redirect !== 'string') return null;
      return { tenantId: data.tenantId, redirect: data.redirect };
    } catch {
      return null;
    }
  }

  async getOrCreateSeoSettings(tenantId: string): Promise<SeoSettings> {
    let row = await this.seoRepo.findOne({ where: { tenantId } });
    if (!row) {
      row = this.seoRepo.create({ tenantId });
      row = await this.seoRepo.save(row);
    }
    return row;
  }

  async getSeoSettingsPublic(tenantId: string) {
    const row = await this.getOrCreateSeoSettings(tenantId);
    return {
      gscPropertyUrl: row.gscPropertyUrl,
      gscConnected: Boolean(row.gscRefreshToken),
      pageSpeedApiKey: row.pageSpeedApiKey,
      pageSpeedUrl: row.pageSpeedUrl,
      pageSpeedStrategy: row.pageSpeedStrategy || 'mobile',
      updatedAt: row.updatedAt?.toISOString() ?? null,
    };
  }

  async patchSeoSettings(
    tenantId: string,
    patch: Partial<{
      gscPropertyUrl: string | null;
      pageSpeedApiKey: string | null;
      pageSpeedUrl: string | null;
      pageSpeedStrategy: string;
    }>,
  ) {
    const row = await this.getOrCreateSeoSettings(tenantId);
    if (patch.gscPropertyUrl !== undefined)
      row.gscPropertyUrl = patch.gscPropertyUrl;
    if (patch.pageSpeedApiKey !== undefined)
      row.pageSpeedApiKey = patch.pageSpeedApiKey;
    if (patch.pageSpeedUrl !== undefined) row.pageSpeedUrl = patch.pageSpeedUrl;
    if (patch.pageSpeedStrategy !== undefined)
      row.pageSpeedStrategy = patch.pageSpeedStrategy;
    await this.seoRepo.save(row);
    return this.getSeoSettingsPublic(tenantId);
  }

  async buildGscAuthUrlAsync(
    tenantId: string,
    redirectPath: string,
  ): Promise<string> {
    const { clientId } = await this.platformSettings.getGoogleOAuthConfig();
    if (!clientId) {
      throw new BadRequestException('Google OAuth client id is not configured');
    }
    const apiBase = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    if (!apiBase) {
      throw new BadRequestException('PUBLIC_API_URL is not set (needed for GSC redirect_uri)');
    }
    const redirectUri = `${apiBase}/v1/marketing/seo/google/callback`;
    const state = this.encodeGscOauthState(tenantId, redirectPath || '/app/marketing/seo');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeGscCode(code: string, redirectUri: string): Promise<string> {
    const { clientId, clientSecret } =
      await this.platformSettings.getGoogleOAuthConfig();
    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google OAuth is not configured');
    }
    const params = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
    });
    const res = await axios.post(
      'https://oauth2.googleapis.com/token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    const rt = res.data?.refresh_token as string | undefined;
    if (!rt) {
      throw new BadRequestException('No refresh_token from Google (try prompt=consent)');
    }
    return rt;
  }

  async saveGscRefreshToken(tenantId: string, refreshToken: string) {
    const row = await this.getOrCreateSeoSettings(tenantId);
    row.gscRefreshToken = refreshToken;
    await this.seoRepo.save(row);
  }

  async getSeoMetrics(
    tenantId: string,
    dateFrom?: string,
    dateTo?: string,
    compare?: boolean,
  ) {
    const settings = await this.getOrCreateSeoSettings(tenantId);
    const propertyUrl = settings.gscPropertyUrl || '';

    const gsc = propertyUrl
      ? await this.gscMetricRepo.findOne({
          where: { tenantId, propertyUrl },
        })
      : null;

    let gscDaily: SeoGscDaily[] = [];
    if (propertyUrl && dateFrom && dateTo) {
      gscDaily = await this.gscDailyRepo.find({
        where: {
          tenantId,
          propertyUrl,
          date: Between(dateFrom, dateTo) as any,
        },
        order: { date: 'ASC' },
      });
    }

    const psiUrl = settings.pageSpeedUrl || '';
    const psiStrategy = settings.pageSpeedStrategy || 'mobile';
    const psi = psiUrl
      ? await this.psiRepo.findOne({
          where: { tenantId, pageUrl: psiUrl, strategy: psiStrategy },
        })
      : null;

    const mapGsc = (m: SeoGscMetric | null) =>
      m
        ? {
            propertyUrl: m.propertyUrl,
            dateFrom: String(m.dateFrom).slice(0, 10),
            dateTo: String(m.dateTo).slice(0, 10),
            clicks: m.clicks,
            impressions: m.impressions,
            ctr: Number(m.ctr),
            position: Number(m.position),
            updatedAt: m.updatedAt.toISOString(),
          }
        : null;

    const mapDaily = (rows: SeoGscDaily[]) =>
      rows.map((d) => ({
        date: String(d.date).slice(0, 10),
        clicks: d.clicks,
        impressions: d.impressions,
        ctr: Number(d.ctr),
        position: Number(d.position),
      }));

    const result: any = {
      gsc: mapGsc(gsc),
      gscDaily: mapDaily(gscDaily),
      psi: psi
        ? {
            pageUrl: psi.pageUrl,
            strategy: psi.strategy,
            performance: psi.performance,
            accessibility: psi.accessibility,
            bestPractices: psi.bestPractices,
            seo: psi.seo,
            lcp: Number(psi.lcp),
            cls: Number(psi.cls),
            fcp: Number(psi.fcp),
            tbt: Number(psi.tbt),
            speedIndex: Number(psi.speedIndex),
            updatedAt: psi.updatedAt.toISOString(),
          }
        : null,
    };

    if (compare) {
      result.gscCompare = null;
      result.gscCompareDaily = [];
    }

    return result;
  }

  async syncSeo(
    tenantId: string,
    dateFrom?: string,
    dateTo?: string,
    _compare?: boolean,
  ): Promise<{
    ok: boolean;
    gsc: boolean;
    psi: boolean;
    gscReauthRequired: boolean;
  }> {
    const settings = await this.getOrCreateSeoSettings(tenantId);
    let gscOk = false;
    let psiOk = false;

    const end = dateTo || new Date().toISOString().slice(0, 10);
    const start =
      dateFrom ||
      new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

    if (settings.gscRefreshToken && settings.gscPropertyUrl) {
      try {
        const access = await this.googleOAuthAccessToken(
          settings.gscRefreshToken,
        );
        const siteUrl = encodeURIComponent(settings.gscPropertyUrl);
        const url = `https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`;
        const res = await axios.post(
          url,
          {
            startDate: start,
            endDate: end,
          dimensions: ['date'],
          rowLimit: 25000,
          },
          { headers: { Authorization: `Bearer ${access}` } },
        );

        const totals = { clicks: 0, impressions: 0, ctr: 0, position: 0 };
        const rows = (res.data?.rows || []) as any[];
        let posWt = 0;

        await this.gscDailyRepo
          .createQueryBuilder()
          .delete()
          .from(SeoGscDaily)
          .where('tenantId = :tenantId', { tenantId })
          .andWhere('propertyUrl = :pu', { pu: settings.gscPropertyUrl })
          .andWhere('date BETWEEN :a AND :b', { a: start, b: end })
          .execute();

        for (const gscRow of rows) {
          const keys = gscRow.keys || [];
          const d = keys[0] as string;
          if (!d) continue;
          const clicks = Number(gscRow.clicks || 0);
          const impressions = Number(gscRow.impressions || 0);
          const ctr = Number(gscRow.ctr || 0);
          const position = Number(gscRow.position || 0);
          totals.clicks += clicks;
          totals.impressions += impressions;
          posWt += position * impressions;

          await this.gscDailyRepo.insert({
      tenantId,
            propertyUrl: settings.gscPropertyUrl,
            date: d,
      clicks,
      impressions,
      ctr: String(ctr),
      position: String(position),
          });
        }

        const avgPos =
          totals.impressions > 0 ? posWt / totals.impressions : 0;
        const aggCtr =
          totals.impressions > 0 ? totals.clicks / totals.impressions : 0;

        let metric = await this.gscMetricRepo.findOne({
          where: { tenantId, propertyUrl: settings.gscPropertyUrl },
        });
        if (!metric) {
          metric = this.gscMetricRepo.create({
            tenantId,
            propertyUrl: settings.gscPropertyUrl,
            dateFrom: start,
            dateTo: end,
            clicks: totals.clicks,
            impressions: totals.impressions,
            ctr: String(aggCtr),
            position: String(avgPos),
          });
          } else {
          metric.dateFrom = start;
          metric.dateTo = end;
          metric.clicks = totals.clicks;
          metric.impressions = totals.impressions;
          metric.ctr = String(aggCtr);
          metric.position = String(avgPos);
        }
        await this.gscMetricRepo.save(metric);
        gscOk = true;
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 401 || status === 403) {
          return {
            ok: false,
            gsc: false,
            psi: false,
            gscReauthRequired: true,
          };
        }
        this.log.warn(`GSC sync error: ${e?.message || e}`);
      }
    }

    if (settings.pageSpeedUrl?.trim() && settings.pageSpeedApiKey?.trim()) {
      try {
        const strategy = settings.pageSpeedStrategy || 'mobile';
        const psiRes = await axios.get(
          'https://www.googleapis.com/pagespeedonline/v5/runPagespeed',
          {
            params: {
              url: settings.pageSpeedUrl,
              key: settings.pageSpeedApiKey,
              strategy,
            },
          },
        );
        const lh = psiRes.data?.lighthouseResult;
        const cat = lh?.categories || {};
        const audits = lh?.audits || {};
        const num = (id: string) =>
          Number(
            audits[id]?.numericValue != null
              ? audits[id].numericValue
              : audits[id]?.score ?? 0,
          );

        let row = await this.psiRepo.findOne({
          where: {
      tenantId,
            pageUrl: settings.pageSpeedUrl,
            strategy,
          },
        });
        const perf = Math.round((cat.performance?.score || 0) * 100);
        const acc = Math.round((cat.accessibility?.score || 0) * 100);
        const bp = Math.round((cat['best-practices']?.score || 0) * 100);
        const seo = Math.round((cat.seo?.score || 0) * 100);

        const payload = {
          tenantId,
          pageUrl: settings.pageSpeedUrl,
          strategy,
          performance: perf,
          accessibility: acc,
          bestPractices: bp,
          seo,
          lcp: String(num('largest-contentful-paint') || 0),
          cls: String(num('cumulative-layout-shift') || 0),
          fcp: String(num('first-contentful-paint') || 0),
          tbt: String(num('total-blocking-time') || 0),
          speedIndex: String(num('speed-index') || 0),
        };

        if (!row) row = this.psiRepo.create(payload);
        else Object.assign(row, payload);
        await this.psiRepo.save(row);
        psiOk = true;
      } catch (e: any) {
        this.log.warn(`PageSpeed sync error: ${e?.message || e}`);
      }
    }

    return {
      ok: gscOk || psiOk,
      gsc: gscOk,
      psi: psiOk,
      gscReauthRequired: false,
    };
  }
}
