// src/marketing/marketing.service.ts
import * as crypto from 'crypto';

import {
  BadRequestException,
  forwardRef,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import {
  Between,
  Brackets,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { Lead } from '../leads/lead.entity';
import { LeadsService } from '../leads/leads.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

import { MarketingTraffic } from './marketing-traffic.entity';
import {
  buildMarketRegexPatterns,
  marketLabel,
  resolveRowMarket,
} from './marketing-market-catalog';
import { MarketingUtmTemplate } from './marketing-utm-template.entity';
import { MarketingIntegration } from './marketing-integration.entity';
import { MarketingAutomation } from './marketing-automation.entity';
import { MarketingSegment } from './marketing-segment.entity';
import { SeoSettings } from './seo-settings.entity';
import { SeoGscMetric } from './seo-gsc-metric.entity';
import { SeoGscDaily } from './seo-gsc-daily.entity';
import { SeoPageSpeedMetric } from './seo-pagespeed-metric.entity';

import { CreateUtmTemplateDto, UpdateUtmTemplateDto } from './dto/utm-template.dto';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { CreateSegmentBodyDto } from './dto/create-segment-body.dto';
import { SegmentDto, SegmentTrafficPresetDto } from './dto/segment.dto';
import { CreateMarketingIntegrationDto } from './dto/create-marketing-integration.dto';
import { UpdateMarketingIntegrationDto } from './dto/update-marketing-integration.dto';
import { GoogleAdsOAuthStartDto } from './dto/google-ads-oauth-start.dto';
import { Ga4OAuthStartDto } from './dto/ga4-oauth-start.dto';
import { YandexDirectApiService } from './yandex-direct/yandex-direct-api.service';
import { VkAdsApiService } from './vk-ads/vk-ads-api.service';

/** Актуальная версия REST Google Ads API (v14 и ниже сняты → 404). */
export const GOOGLE_ADS_API_VERSION = 'v23';

/** Если по `campaign` строк нет — дневная сводка по `customer`; подпись строки включает CID и имя счёта. */

const GOOGLE_ADS_MARKETING_OAUTH_STATE_TYP = 'lumiva_ga_mkt_oauth_v1' as const;
const GOOGLE_ADS_MARKETING_OAUTH_TTL_SEC = 900;

/** Подписанный state в callback Google Ads marketing OAuth. */
export type GoogleAdsMarketingOAuthStateDecoded = {
  typ: typeof GOOGLE_ADS_MARKETING_OAUTH_STATE_TYP;
  exp: number;
  tenantId: string;
  userId: string;
  redirect: string;
  intent: 'create' | 'reconnect';
  integrationId?: string;
  draft?: {
    name: string;
    primaryId: string;
    currency: string;
    loginCustomerId?: string;
    source?: string;
    medium?: string;
    googleAdsAccountMode?: 'customer' | 'mcc_managed';
  };
};

const GA4_MARKETING_OAUTH_STATE_TYP = 'lumiva_ga4_mkt_oauth_v1' as const;
const GA4_MARKETING_OAUTH_TTL_SEC = 900;

export type Ga4MarketingOAuthStateDecoded = {
  typ: typeof GA4_MARKETING_OAUTH_STATE_TYP;
  exp: number;
  tenantId: string;
  userId: string;
  redirect: string;
  intent: 'create' | 'reconnect';
  integrationId?: string;
  draft?: {
    name: string;
    primaryId: string;
    currency: string;
  };
};

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
  if (u.includes('INVALID_ARGUMENT') || u.includes('REQUEST CONTAINS AN INVALID ARGUMENT')) {
    return (
      ' Возможная причина — некорректная GAQL-строка (например, сортировка по полю, не входящему в SELECT) или запрос списка клиентов не с Customer ID менеджерского (MCC) счёта; проверьте login-customer-id.'
    );
  }
  return '';
}

/** Ключ marketing_traffic для конкретного клиентского Google Ads CID (позволяет несколько аккаунтов в одном tenant). */
export function marketingTrafficGoogleAdsDataSource(customerDigits: string): string {
  const d = String(customerDigits || '').replace(/\D/g, '').trim();
  return (`google_ads_${d}`).slice(0, 80);
}

export function trafficPresetIsGoogleAds(dataSource: string): boolean {
  const t = String(dataSource || '').trim();
  return t === 'google_ads' || /^google_ads_\d{4,15}$/.test(t);
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
    @Inject(forwardRef(() => LeadsService))
    private readonly leadsService: LeadsService,
    private readonly yandexDirect: YandexDirectApiService,
    private readonly vkAds: VkAdsApiService,
  ) {}

  /**
   * Добавляет в query builder WHERE-условие по рынку: точный ISO2 из GA4 (t.country),
   * ИЛИ префикс-тег кампании ("LV - ..."), ИЛИ вхождение имени страны как слова в тексте
   * кампании (мультиязычно). Нужно, т.к. country заполнен только у GA4-строк — у Google
   * Ads/Meta/Yandex/VK гео есть только в свободном тексте campaign (см. marketing-market-catalog.ts).
   */
  /**
   * Приоритет намеренный: тег/текст названия КАМПАНИИ (то, что рекламодатель таргетировал и
   * оплачивал) важнее страны визита из GA4 (t.country) — иначе клик из Британии по кампании
   * "RO - ..." (Румыния) засчитался бы в бюджет GB. country используется только как запасной
   * вариант для строк БЕЗ содержательного названия кампании (direct/referral/organic/не задано/
   * голый числовой id) — единственный случай, когда у строки нет иного сигнала о рынке.
   */
  private applyMarketFilter(
    qb: SelectQueryBuilder<MarketingTraffic>,
    market: string | undefined,
  ): SelectQueryBuilder<MarketingTraffic> {
    if (!market) return qb;
    const code = market.toUpperCase();
    const { prefix, names } = buildMarketRegexPatterns(code);
    const genericCampaign =
      `(t.campaign IS NULL OR t.campaign = '' OR t.campaign ~ '^\(.*\)$' OR t.campaign ~ '^[0-9]+$')`;
    // LOWER(t.campaign) + регистро-чувствительный ~ (не ~*): у Postgres ~* не приводит турецкую
    // заглавную İ к "i" (в отличие от LOWER(), которая в локали en_US.utf8 это делает верно) —
    // с ~* кампании вида "İngiltere" молча не матчились, хотя JS-классификатор их ловил.
    const params: Record<string, string> = { mCode: code, mPrefix: prefix };
    let sql = `(LOWER(t.campaign) ~ :mPrefix`;
    if (names) {
      sql += ` OR LOWER(t.campaign) ~ :mNames`;
      params.mNames = names;
    }
    sql += ` OR (UPPER(COALESCE(t.country,'')) = :mCode AND ${genericCampaign}))`;
    qb.andWhere(sql, params);
    return qb;
  }

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

  /** Кэш вычисленного ответа по валюте отчёта (display). TTL 1 ч; `force` обходит кэш. */
  private readonly marketingFxCache = new Map<
    string,
    {
      at: number;
      data: {
        display: string;
        asOf: string;
        source: string;
        multiplyToDisplay: Record<string, number>;
        availableDisplayCurrencies: string[];
      };
    }
  >();

  private readonly marketingFxTtlMs = 60 * 60 * 1000;

  /** Сырые курсы Frankfurter (EUR → *) — один HTTP на TTL, пересчёт multiply под любую display без повторной загрузки. */
  private frankfurterRawCache: {
    at: number;
    ratesVsEur: Record<string, number>;
    asOf: string;
    source: string;
  } | null = null;

  /**
   * Полный список курсов ECB с api.frankfurter.app/latest?from=EUR (без /v1).
   * RUB в наборе .app часто отсутствует — добираем с api.frankfurter.dev/v2.
   */
  private async fetchFrankfurterMergedRates(): Promise<{
    ratesVsEur: Record<string, number>;
    asOf: string;
    source: string;
  }> {
    const res = await axios.get<{ rates?: Record<string, number>; date?: string }>(
      'https://api.frankfurter.app/latest?from=EUR',
      { timeout: 12_000 },
    );
    const ratesVsEur: Record<string, number> = { ...(res.data?.rates || {}) };
    let asOf = String(res.data?.date ?? '');
    let source = 'Frankfurter api.frankfurter.app (ECB)';
    const needRub = !(Number(ratesVsEur.RUB) > 0);
    if (needRub) {
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
    }
    if (!asOf) asOf = new Date().toISOString().slice(0, 10);
    if (!ratesVsEur || Object.keys(ratesVsEur).length === 0) {
      throw new BadRequestException('FX: пустой ответ курсов');
    }
    return { ratesVsEur, asOf, source };
  }

  /** Один запрос Frankfurter на TTL либо взять из кэша. */
  private async loadFrankfurterRaw(force: boolean): Promise<{
    ratesVsEur: Record<string, number>;
    asOf: string;
    source: string;
  }> {
    const now = Date.now();
    if (!force && this.frankfurterRawCache && now - this.frankfurterRawCache.at < this.marketingFxTtlMs) {
      return this.frankfurterRawCache;
    }
    try {
      const m = await this.fetchFrankfurterMergedRates();
      this.frankfurterRawCache = { at: now, ...m };
      return this.frankfurterRawCache;
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.message : String(e);
      throw new BadRequestException(`FX: Frankfurter недоступен (${msg})`);
    }
  }

  /**
   * Курсы для экранов маркетинга: все валюты из ответа ECB (Frankfurter).
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
    availableDisplayCurrencies: string[];
  }> {
    const display = (displayRaw || 'EUR')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 3);
    if (!/^[A-Z]{3}$/.test(display)) {
      throw new BadRequestException(
        `Unsupported display currency code: ${displayRaw}. Use a 3-letter ISO code (e.g. CHF, PLN).`,
      );
    }
    const now = Date.now();
    const force = opts?.force === true;
    if (force) {
      this.marketingFxCache.clear();
    }
    if (!force) {
      const cached = this.marketingFxCache.get(display);
      if (cached && now - cached.at < this.marketingFxTtlMs) {
        return cached.data;
      }
    }
    const { ratesVsEur, asOf, source } = await this.loadFrankfurterRaw(force);

    /** Сколько EUR в 1 единице валюты F (1 EUR = r units of F ⇒ 1 F = 1/r EUR). */
    const eurPerUnit: Record<string, number> = { EUR: 1 };
    for (const code of Object.keys(ratesVsEur)) {
      if (!/^[A-Z]{3}$/.test(code)) continue;
      if (code === 'EUR') continue;
      const r = Number(ratesVsEur[code]);
      if (Number.isFinite(r) && r > 0) eurPerUnit[code] = 1 / r;
    }

    const availableDisplayCurrencies = Object.keys(eurPerUnit)
      .filter((c) => Number(eurPerUnit[c]) > 0)
      .sort();

    if (!(display in eurPerUnit) || !(Number(eurPerUnit[display]) > 0)) {
      const sample = availableDisplayCurrencies.slice(0, 12).join(', ');
      throw new BadRequestException(
        `Unsupported display currency: ${display}. Not in current ECB set. Examples: ${sample}${
          availableDisplayCurrencies.length > 12 ? ', …' : ''
        }`,
      );
    }

    const multiplyToDisplay: Record<string, number> = {};
    for (const f of Object.keys(eurPerUnit)) {
      if (Number(eurPerUnit[f]) > 0 && Number(eurPerUnit[display]) > 0) {
        multiplyToDisplay[f] = eurPerUnit[f] / eurPerUnit[display];
      }
    }

    const data = {
      display,
      asOf,
      source,
      multiplyToDisplay,
      availableDisplayCurrencies,
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
    /** ISO2 код рынка (см. marketing-market-catalog.ts) — уже разрешённый, не свободный текст. */
    market?: string,
  ): Promise<MarketingTrafficChannelsStats> {
    const qb = this.trafficRepo
      .createQueryBuilder('t')
      .where('t.tenantId = :tenantId', { tenantId });
    if (from) qb.andWhere('t.date >= :from', { from });
    if (to) qb.andWhere('t.date <= :to', { to });
    if (dataSource) qb.andWhere('t.dataSource = :ds', { ds: dataSource });
    this.applyMarketFilter(qb, market);

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
    market?: string,
  ): Promise<{ series: MarketingTrafficDailyPoint[] }> {
    const qb = this.trafficRepo
      .createQueryBuilder('t')
      .where('t.tenantId = :tenantId', { tenantId });
    if (from) qb.andWhere('t.date >= :from', { from });
    if (to) qb.andWhere('t.date <= :to', { to });
    this.applyMarketFilter(qb, market);
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

  /**
   * Реальный список рынков, присутствующих в рекламных данных за период — для AI-чата:
   * определяет рынок каждой сгруппированной строки (GA4 country / префикс-тег кампании /
   * имя страны в тексте, см. marketing-market-catalog.ts) и агрегирует cost/sessions/etc
   * по рынку. Строки, для которых рынок не удалось определить, попадают в market:null
   * ("unclassified") — они НЕ должны молча растворяться в общих итогах отчёта по одной стране.
   */
  async getMarketingMarketsBreakdown(
    tenantId: string,
    from?: string,
    to?: string,
    dataSource?: string,
  ): Promise<{
    markets: Array<{
      code: string;
      label: string;
      campaigns: number;
      sessions: number;
      clicks: number;
      impressions: number;
      leads: number;
      revenue: number;
      cost: number;
    }>;
    unclassified: {
      campaigns: number;
      sessions: number;
      cost: number;
      sampleCampaigns: string[];
    };
  }> {
    const qb = this.trafficRepo
      .createQueryBuilder('t')
      .where('t.tenantId = :tenantId', { tenantId });
    if (from) qb.andWhere('t.date >= :from', { from });
    if (to) qb.andWhere('t.date <= :to', { to });
    if (dataSource) qb.andWhere('t.dataSource = :ds', { ds: dataSource });

    const num = (v: string | number | null | undefined) =>
      Number(v != null && v !== '' ? v : 0) || 0;

    const raw = await qb
      .select('t.campaign', 'campaign')
      .addSelect('t.country', 'country')
      .addSelect('COALESCE(SUM(t.sessions), 0)', 'sessions')
      .addSelect('COALESCE(SUM(t.clicks), 0)', 'clicks')
      .addSelect('COALESCE(SUM(t.impressions), 0)', 'impressions')
      .addSelect('COALESCE(SUM(t.leads), 0)', 'leads')
      .addSelect('COALESCE(SUM(t.revenue), 0)', 'revenue')
      .addSelect('COALESCE(SUM(t.cost), 0)', 'cost')
      .groupBy('t.campaign')
      .addGroupBy('t.country')
      .limit(20_000)
      .getRawMany();

    const byMarket = new Map<
      string,
      { campaigns: number; sessions: number; clicks: number; impressions: number; leads: number; revenue: number; cost: number }
    >();
    const unclassified = { campaigns: 0, sessions: 0, cost: 0, sampleCampaigns: [] as string[] };

    for (const r of raw as Record<string, unknown>[]) {
      const campaign = r.campaign != null ? String(r.campaign) : null;
      const country = r.country != null ? String(r.country) : null;
      const code = resolveRowMarket(campaign, country);
      const row = {
        sessions: num(r.sessions as string),
        clicks: num(r.clicks as string),
        impressions: num(r.impressions as string),
        leads: num(r.leads as string),
        revenue: num(r.revenue as string),
        cost: num(r.cost as string),
      };
      if (!code) {
        unclassified.campaigns += 1;
        unclassified.sessions += row.sessions;
        unclassified.cost += row.cost;
        if (unclassified.sampleCampaigns.length < 15 && campaign) {
          unclassified.sampleCampaigns.push(campaign);
        }
        continue;
      }
      const acc = byMarket.get(code) || {
        campaigns: 0,
        sessions: 0,
        clicks: 0,
        impressions: 0,
        leads: 0,
        revenue: 0,
        cost: 0,
      };
      acc.campaigns += 1;
      acc.sessions += row.sessions;
      acc.clicks += row.clicks;
      acc.impressions += row.impressions;
      acc.leads += row.leads;
      acc.revenue += row.revenue;
      acc.cost += row.cost;
      byMarket.set(code, acc);
    }

    const markets = [...byMarket.entries()]
      .map(([code, acc]) => ({ code, label: marketLabel(code), ...acc }))
      .sort((a, b) => b.cost - a.cost || b.sessions - a.sessions);

    return { markets, unclassified };
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

    for (const r of rows) {
      const p = this.normalizeMarketingIntegrationProvider(r.provider);
      if (p !== 'google_ads') continue;
      const flat = this.flattenNestedIntegrationSettings(
        this.parseSettingsObject(r.settings),
      );
      const pid = this.pickFirstNonEmptyString([
        r.primaryId,
        flat.customerId,
        flat.customer_id,
      ])?.replace(/\D/g, '');
      if (!pid || !/^\d{6,15}$/.test(pid)) continue;
      const mode = String(flat.googleAdsAccountMode || '').trim().toLowerCase();
      if (mode !== 'mcc_managed') {
        const key = marketingTrafficGoogleAdsDataSource(pid);
        if (!out[key]) {
          const lbl = String(r.name || '').trim();
          if (lbl) out[key] = lbl.slice(0, 200);
        }
        continue;
      }
      const lblMap = flat.googleAdsManagedAccountLabels ?? flat.google_ads_managed_account_labels;
      if (lblMap && typeof lblMap === 'object' && !Array.isArray(lblMap)) {
        for (const [cid, name] of Object.entries(lblMap as Record<string, unknown>)) {
          const d = String(cid).replace(/\D/g, '').trim();
          if (!d || !/^\d{6,15}$/.test(d)) continue;
          const nm = typeof name === 'string' ? name.trim() : String(name ?? '').trim();
          const key = marketingTrafficGoogleAdsDataSource(d);
          // Use the stored name; if absent fall back to the CID so every sub-account
          // tracked in settings gets an explicit entry in dataSourceLabels.
          if (!out[key]) out[key] = (nm || `Google Ads · ${d}`).slice(0, 200);
        }
      }
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

  /**
   * WordPress Lumiva CRM Connector / Lumiva Wizard: POST с X-Api-Token и телом { items: [...] }.
   * Совместимо с плагином на сайте (send_to_crm).
   */
  async importCf7WordpressLeads(
    tenantId: string,
    body: { items?: unknown[] },
  ): Promise<{ created: number; skipped: number }> {
    const raw = Array.isArray(body?.items) ? body.items : [];
    let created = 0;
    let skipped = 0;
    for (const it of raw) {
      if (!it || typeof it !== 'object' || Array.isArray(it)) {
        skipped++;
        continue;
      }
      const o = it as Record<string, unknown>;
      const email = String(o.email ?? '').trim();
      const phone = String(o.phone ?? '').trim();
      if (!email && !phone) {
        skipped++;
        continue;
      }
      const name = String(o.name ?? 'Website form').slice(0, 250);
      const source = String(o.source ?? 'wordpress_cf7').slice(0, 120);
      const meta: Record<string, unknown> = {
        ...(typeof o.meta === 'object' && o.meta !== null && !Array.isArray(o.meta)
          ? (o.meta as Record<string, unknown>)
          : {}),
        site: o.site,
        form: o.form,
        message: o.message,
        lumivaWizardCf7: true,
      };
      await this.leadsService.createForTenant(tenantId, {
        name,
        email: email || undefined,
        phone: phone || undefined,
        source,
        status: 'new',
        meta,
      });
      created++;
    }
    return { created, skipped };
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

  async updateUtmTemplate(
    tenantId: string,
    id: string,
    dto: UpdateUtmTemplateDto,
  ) {
    const row = await this.utmRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Template not found');

    if (dto.name !== undefined) row.name = dto.name;
    if (dto.baseUrl !== undefined) row.baseUrl = dto.baseUrl ?? null;
    if (dto.channelType !== undefined) row.channelType = dto.channelType ?? null;
    if (dto.utmSource !== undefined) row.utmSource = dto.utmSource ?? null;
    if (dto.utmMedium !== undefined) row.utmMedium = dto.utmMedium ?? null;
    if (dto.utmCampaign !== undefined) row.utmCampaign = dto.utmCampaign ?? null;
    if (dto.utmContent !== undefined) row.utmContent = dto.utmContent ?? null;
    if (dto.utmTerm !== undefined) row.utmTerm = dto.utmTerm ?? null;

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

  private isYandexDirectProvider(normalized: string): boolean {
    return normalized === 'yandex_direct' || normalized === 'yandexdirect' || normalized === 'direct';
  }

  private isVkAdsProvider(normalized: string): boolean {
    return (
      normalized === 'vk_ads' ||
      normalized === 'vkads' ||
      normalized === 'vk' ||
      normalized === 'vk_reklama' ||
      normalized === 'vk_реклама'
    );
  }

  private isGa4MarketingProvider(normalized: string): boolean {
    return (
      normalized === 'google_analytics' ||
      normalized === 'ga4' ||
      normalized === 'google_analytics_4' ||
      normalized === 'google_analytics_ga4'
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
      'yandexDirect',
      'yandex_direct',
      'vkAds',
      'vk_ads',
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

  /**
   * Окно выгрузки рекламных интеграций (Google Ads, Meta): строго календарные дни UTC, включительно [from .. to].
   * Настройка JSON: syncLookbackDays (или наследованные ключи googleAdsSyncLookbackDays / adsSyncLookbackDays), 30–731, по умолчанию ~2 года.
   */
  private resolveAdvertisingSyncInclusiveUtcRange(
    flatSettings: Record<string, unknown>,
  ): { from: string; to: string; lookbackDays: number } {
    const minD = 30;
    const maxD = 731;
    const defaultD = 730;
    const raw =
      flatSettings.syncLookbackDays ??
      flatSettings.googleAdsSyncLookbackDays ??
      flatSettings.adsSyncLookbackDays;
    let n = Number(raw);
    if (!Number.isFinite(n)) n = defaultD;
    n = Math.floor(n);
    n = Math.min(Math.max(n, minD), maxD);

    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const d = now.getUTCDate();
    const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const startUtcMs = Date.UTC(y, m, d) - (n - 1) * 864e5;
    const st = new Date(startUtcMs);
    const from = `${st.getUTCFullYear()}-${String(st.getUTCMonth() + 1).padStart(2, '0')}-${String(st.getUTCDate()).padStart(2, '0')}`;
    return { from, to, lookbackDays: n };
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

  /**
   * Что уже настроено на уровне платформы (pl1 / env), без секретов —
   * чтобы CRM мог скрыть поля client id / developer token для конечного пользователя.
   */
  async getMarketingIntegrationSetupHints() {
    const g = await this.platformSettings.getGoogleOAuthConfig();
    const m = await this.platformSettings.getMetaOAuthConfig();
    const platformDeveloperToken = Boolean(
      String(process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '').trim(),
    );
    const publicApi = Boolean(String(process.env.PUBLIC_API_URL || '').trim());
    const platformGoogleOAuth = Boolean(g.clientId && g.clientSecret);
    return {
      googleAds: {
        platformGoogleOAuth,
        platformDeveloperToken,
        /** Готов полный браузерный OAuth: платформа + callback host. */
        oauthWizardAvailable: platformGoogleOAuth && publicApi,
      },
      googleAnalyticsGa4: {
        oauthWizardAvailable: platformGoogleOAuth && publicApi,
      },
      metaAds: {
        platformMetaOAuth: Boolean(m.appId && m.appSecret),
      },
    };
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
    await this.integrationRepo.manager.transaction(async (em: EntityManager) => {
      const row = await em.findOne(MarketingIntegration, { where: { id, tenantId } });
      if (!row) {
        throw new NotFoundException('Integration not found');
      }
      await this.deleteMarketingTrafficTiedToIntegration(em, row);
      const del = await em.delete(MarketingIntegration, { id, tenantId });
      if (!del.affected) throw new NotFoundException('Integration not found');
    });
    return { success: true };
  }

  /**
   * По возможности удалить строки marketing_traffic этого подключения.
   * Google Ads / GA4 — по точным тегам; Meta и Метрика делят один dataSource между интеграциями —
   * очищаем весь пул метрик только если других интеграций этого типа у тенанта не останется.
   */
  private async deleteMarketingTrafficTiedToIntegration(
    em: EntityManager,
    row: MarketingIntegration,
  ): Promise<void> {
    const tenantId = row.tenantId;
    const prov = this.normalizeMarketingIntegrationProvider(row.provider);

    if (prov === 'google_ads') {
      const flat = this.flattenNestedIntegrationSettings(
        this.parseSettingsObject(row.settings),
      );
      const mode = String(
        flat.googleAdsAccountMode || flat.google_ads_account_mode || 'customer',
      )
        .trim()
        .toLowerCase();

      const googleAdsPeers = await this.marketingIntegrationPeersCount(em, tenantId, row.id, [
        'google_ads',
      ]);

      if (mode === 'mcc_managed' && googleAdsPeers === 0) {
        // No other Google Ads integrations — safely remove all google_ads_* and google_ads rows
        // (covers both tracked accounts and any that were synced before name tracking was added).
        await em
          .createQueryBuilder()
          .delete()
          .from(MarketingTraffic)
          .where('tenantId = :tenantId', { tenantId })
          .andWhere("dataSource LIKE 'google_ads_%'")
          .execute();
        await this.marketingTrafficDeleteExactDataSource(em, tenantId, 'google_ads');
        return;
      }

      // Either non-MCC mode or there are peer Google Ads integrations.
      // Use the settings-based tag list (contains all CIDs written by this integration).
      const tags = this.collectGoogleAdsTrafficDataSourcesForIntegration(row);
      if (mode === 'mcc_managed' && !tags.length) {
        this.log.warn(
          `Удаление Google Ads MCC ${row.id}: в настройках нет googleAdsManagedAccountLabels / whitelist — строки marketing_traffic с тегами google_ads_<cid> не удалены автоматически; при необходимости удалите их вручную из БД.`,
        );
      }
      if (tags.length) await this.marketingTrafficDeleteByDataSources(em, tenantId, tags);
      if (googleAdsPeers === 0) {
        await this.marketingTrafficDeleteExactDataSource(em, tenantId, 'google_ads');
      }
      return;
    }

    if (this.isGa4MarketingProvider(prov)) {
      const pid = String(row.primaryId || '').replace(/\D/g, '').trim();
      if (pid.length >= 4) {
        const tag = (`ga4_${pid}`).slice(0, 80);
        await this.marketingTrafficDeleteExactDataSource(em, tenantId, tag);
      }
      return;
    }

    if (
      prov === 'yandex_metrika' ||
      prov === 'yandex_metrica' ||
      prov === 'yandex_metrika_web'
    ) {
      const ymPeers = await this.marketingIntegrationPeersCount(em, tenantId, row.id, [
        'yandex_metrika',
        'yandex_metrica',
        'yandex_metrika_web',
      ]);
      if (ymPeers === 0) {
        await this.marketingTrafficDeleteExactDataSource(em, tenantId, 'yandex_metrika');
      }
      return;
    }

    if (this.isMetaAdsProvider(prov)) {
      const metaPeers = await this.metaMarketingIntegrationPeersCount(em, tenantId, row.id);
      if (metaPeers === 0) {
        await this.marketingTrafficDeleteExactDataSource(em, tenantId, 'meta_ads');
      }
      return;
    }
  }

  /** Список ключей google_ads_<cid>, которые синк мог сохранять для этого подключения. */
  private collectGoogleAdsTrafficDataSourcesForIntegration(
    row: MarketingIntegration,
  ): string[] {
    const flat = this.flattenNestedIntegrationSettings(
      this.parseSettingsObject(row.settings),
    );
    const mode = String(flat.googleAdsAccountMode || flat.google_ads_account_mode || 'customer')
      .trim()
      .toLowerCase();
    const tags = new Set<string>();

    const addCidDigits = (raw: unknown) => {
      const d = String(raw ?? '')
        .replace(/\D/g, '')
        .trim();
      if (/^\d{6,15}$/.test(d)) tags.add(marketingTrafficGoogleAdsDataSource(d));
    };

    if (mode === 'mcc_managed') {
      const labels =
        flat.googleAdsManagedAccountLabels ?? flat.google_ads_managed_account_labels;
      if (labels && typeof labels === 'object' && !Array.isArray(labels)) {
        for (const k of Object.keys(labels as Record<string, unknown>)) {
          addCidDigits(k);
        }
      }
      const wl =
        flat.googleAdsManagedCustomerIds ?? flat.google_ads_managed_customer_ids;
      if (Array.isArray(wl)) {
        for (const it of wl) addCidDigits(it);
      }
    } else {
      addCidDigits(flat.customerId || flat.customer_id || row.primaryId);
      if (row.primaryId) addCidDigits(row.primaryId);
    }
    return [...tags];
  }

  private async marketingIntegrationPeersCount(
    em: EntityManager,
    tenantId: string,
    excludeId: string,
    normalizedProviders: string[],
  ): Promise<number> {
    const peers = await em.find(MarketingIntegration, {
      where: { tenantId },
      select: ['id', 'provider'],
    });
    const want = new Set(normalizedProviders);
    let n = 0;
    for (const r of peers) {
      if (r.id === excludeId) continue;
      if (want.has(this.normalizeMarketingIntegrationProvider(r.provider))) n += 1;
    }
    return n;
  }

  private async metaMarketingIntegrationPeersCount(
    em: EntityManager,
    tenantId: string,
    excludeId: string,
  ): Promise<number> {
    const peers = await em.find(MarketingIntegration, {
      where: { tenantId },
      select: ['id', 'provider'],
    });
    let n = 0;
    for (const r of peers) {
      if (r.id === excludeId) continue;
      if (this.isMetaAdsProvider(this.normalizeMarketingIntegrationProvider(r.provider)))
        n += 1;
    }
    return n;
  }

  private async marketingTrafficDeleteByDataSources(
    em: EntityManager,
    tenantId: string,
    dataSources: string[],
  ): Promise<void> {
    const ds = [...new Set(dataSources.map((s) => String(s || '').trim()).filter(Boolean))];
    if (!ds.length) return;
    await em
      .createQueryBuilder()
      .delete()
      .from(MarketingTraffic)
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('dataSource IN (:...ds)', { ds })
      .execute();
  }

  private async marketingTrafficDeleteExactDataSource(
    em: EntityManager,
    tenantId: string,
    dataSource: string,
  ): Promise<void> {
    const ds = String(dataSource || '').trim();
    if (!ds) return;
    await em
      .createQueryBuilder()
      .delete()
      .from(MarketingTraffic)
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('dataSource = :ds', { ds })
      .execute();
  }

  /**
   * Ручная синхронизация одной интеграции (UI: «Синхронизировать» для Google Ads).
   * @returns сколько строк трафика записано (0 — ок, но данных за период нет или синк пропущен).
   */
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
      if (this.isYandexDirectProvider(provider)) {
        return await this.syncYandexDirectIntegration(row);
      }
      if (this.isVkAdsProvider(provider)) {
        return await this.syncVkAdsIntegration(row);
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
      trafficPresets: (e.trafficPresets as SegmentTrafficPresetDto[] | null) ?? null,
      lastMatchedCount: e.lastMatchedCount,
      lastRunAt: e.lastRunAt ? e.lastRunAt.toISOString() : null,
      createdAt: e.createdAt.toISOString(),
    };
  }

  /**
   * Агрегаты по кампаниям из синка Google Ads / Meta Ads (marketing_traffic).
   * Используется на странице сегментов: чекбоксы = реальные кампании.
   */
  async listAdsTrafficPresets(tenantId: string) {
    const raw = await this.trafficRepo
      .createQueryBuilder('t')
      .select('t.dataSource', 'dataSource')
      .addSelect('t.source', 'source')
      .addSelect('t.medium', 'medium')
      .addSelect('t.campaign', 'campaign')
      .addSelect('SUM(t.clicks)', 'totalClicks')
      .addSelect('SUM(t.impressions)', 'totalImpressions')
      .addSelect('MAX(t.date)', 'lastDate')
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere(
        '(t.dataSource = :g OR t.dataSource LIKE :gprefix OR t.dataSource = :m)',
        { g: 'google_ads', gprefix: 'google_ads_%', m: 'meta_ads' },
      )
      .andWhere("COALESCE(TRIM(t.campaign), '') <> ''")
      .groupBy('t.dataSource')
      .addGroupBy('t.source')
      .addGroupBy('t.medium')
      .addGroupBy('t.campaign')
      .orderBy('MAX(t.date)', 'DESC')
      .addOrderBy('t.campaign', 'ASC')
      .getRawMany<{
        dataSource: string;
        source: string | null;
        medium: string | null;
        campaign: string | null;
        totalClicks: string;
        totalImpressions: string;
        lastDate: string;
      }>();

    return raw.map((r) => {
      const campaign = r.campaign || '';
      const key = `${r.dataSource}|${r.source || ''}|${r.medium || ''}|${campaign}`;
      const clicks = Number(r.totalClicks) || 0;
      const imps = Number(r.totalImpressions) || 0;
      const lastDate = r.lastDate ? String(r.lastDate).slice(0, 10) : null;
      const label = trafficPresetIsGoogleAds(r.dataSource)
        ? `Google Ads · ${campaign}`
        : `Meta Ads · ${campaign}`;
      return {
        key,
        label,
        dataSource: r.dataSource,
        source: r.source,
        medium: r.medium,
        campaign,
        totalClicks: clicks,
        totalImpressions: imps,
        lastDate,
      };
    });
  }

  async listSegments(tenantId: string): Promise<SegmentDto[]> {
    const list = await this.segmentRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
    return list.map((e) => this.toSegmentDto(e));
  }

  async getSegment(tenantId: string, id: string): Promise<SegmentDto> {
    const seg = await this.segmentRepo.findOne({ where: { tenantId, id } });
    if (!seg) throw new NotFoundException('Сегмент не найден');
    return this.toSegmentDto(seg);
  }

  async createSegment(
    tenantId: string,
    body: CreateSegmentBodyDto,
  ): Promise<SegmentDto> {
    if (body.entityType !== 'lead') {
      throw new BadRequestException('Only entityType=lead is supported');
    }
    const f = body.filters ?? {};
    const trafficRaw = f.trafficPresets ?? [];
    const trafficPresets: SegmentTrafficPresetDto[] = trafficRaw
      .filter(
        (p) =>
          p &&
          (trafficPresetIsGoogleAds(String(p.dataSource || '')) ||
            p.dataSource === 'meta_ads') &&
          String(p.campaign || '').trim(),
      )
      .map((p) => ({
        dataSource: p.dataSource,
        source: p.source?.trim() || null,
        medium: p.medium?.trim() || null,
        campaign: String(p.campaign).trim(),
      }));

    const hasLegacy =
      (f.statuses && f.statuses.length > 0) ||
      Boolean(f.sources?.[0]?.trim()) ||
      Boolean(f.countries?.[0]?.trim()) ||
      Boolean(f.managers?.[0]?.trim()) ||
      Boolean(f.createdFrom?.trim()) ||
      Boolean(f.createdTo?.trim());

    if (!trafficPresets.length && !hasLegacy) {
      throw new BadRequestException(
        'Select at least one Google/Meta campaign from synced traffic, or set lead filters (statuses, dates, etc.)',
      );
    }

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
      trafficPresets: trafficPresets.length ? trafficPresets : null,
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

    const presets = (seg.trafficPresets || []).filter(
      (p) =>
        p &&
        String(p.campaign || '').trim() &&
        (trafficPresetIsGoogleAds(String(p.dataSource || '')) ||
          p.dataSource === 'meta_ads'),
    );
    if (presets.length) {
      qb.andWhere(
        new Brackets((outer) => {
          for (let i = 0; i < presets.length; i++) {
            const p = presets[i];
            const campaign = String(p.campaign).trim();
            const campParam = `utmCamp${i}`;
            const medParam = `utmMed${i}`;
            outer.orWhere(
              new Brackets((inner) => {
                inner.andWhere(
                  `LOWER(TRIM(COALESCE(l.utmCampaign, ''))) = LOWER(TRIM(:${campParam}))`,
                  { [campParam]: campaign },
                );
                if (trafficPresetIsGoogleAds(String(p.dataSource || ''))) {
                  inner.andWhere(
                    `(LOWER(TRIM(COALESCE(l.utmSource, ''))) IN ('google', 'adwords') OR LOWER(TRIM(COALESCE(l.utmSource, ''))) LIKE 'google%')`,
                  );
                  inner.andWhere(
                    `(LOWER(TRIM(COALESCE(l.utmMedium, ''))) IN ('cpc', 'ppc', 'paid_search') OR LOWER(TRIM(COALESCE(l.utmMedium, ''))) = LOWER(TRIM(:${medParam})))`,
                    { [medParam]: String(p.medium || 'cpc').trim() },
                  );
                } else {
                  inner.andWhere(
                    `LOWER(TRIM(COALESCE(l.utmSource, ''))) IN ('meta', 'facebook', 'fb', 'instagram', 'ig')`,
                  );
                  inner.andWhere(
                    `(LOWER(TRIM(COALESCE(l.utmMedium, ''))) IN ('paid', 'cpc', 'paid_social', 'ppc') OR LOWER(TRIM(COALESCE(l.utmMedium, ''))) = LOWER(TRIM(:${medParam})))`,
                    { [medParam]: String(p.medium || 'paid').trim() },
                  );
                }
              }),
            );
          }
        }),
      );
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

  /** Разбор одной строки ответа unary search (camelCase / PascalCase). */
  private pickGoogleAdsSearchRowFields(r: unknown): {
    date?: string;
    campaignName?: string;
    impressions: number;
    clicks: number;
    costMicros: number;
  } {
    if (!r || typeof r !== 'object') {
      return { impressions: 0, clicks: 0, costMicros: 0 };
    }
    const row = r as Record<string, unknown>;
    const segBlock = (row.segments || row.Segments) as Record<string, unknown> | undefined;
    const dateRaw = segBlock?.date ?? segBlock?.Date;
    const campaign = (row.campaign || row.Campaign) as Record<string, unknown> | undefined;
    const nameRaw = campaign?.name ?? campaign?.Name;
    const metrics = (row.metrics || row.Metrics) as Record<string, unknown> | undefined;
    return {
      date: typeof dateRaw === 'string' ? dateRaw.trim().slice(0, 10) : undefined,
      campaignName: typeof nameRaw === 'string' ? nameRaw.trim() : undefined,
      impressions: Number(metrics?.impressions ?? 0),
      clicks: Number(metrics?.clicks ?? 0),
      costMicros: Number(metrics?.costMicros ?? metrics?.cost_micros ?? 0),
    };
  }

  private googleAdsGaqlCampaignDailyStats(from: string, to: string): string {
    // Include REMOVED campaigns so historical spend/impressions are not lost when a
    // campaign was later deleted (Google Ads excludes REMOVED resources by default;
    // without the explicit IN clause, accounts where all campaigns are REMOVED would
    // return 0 rows here and fall back to the customer-level summary).
    return `
      SELECT campaign.id, campaign.name, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros
      FROM campaign
      WHERE segments.date BETWEEN '${from}' AND '${to}'
        AND campaign.status IN (ENABLED, PAUSED, REMOVED)
      ORDER BY segments.date, campaign.id
    `.trim();
  }

  /** Дневные итоги по аккаунту — запасной вариант, если отчёт по campaign пуст при ненулевых метриках в UI. */
  private googleAdsGaqlCustomerDailyStats(from: string, to: string): string {
    return `
      SELECT segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros
      FROM customer
      WHERE segments.date BETWEEN '${from}' AND '${to}'
      ORDER BY segments.date
    `.trim();
  }

  private async googleAdsSearchCampaignOrCustomerDailyMetrics(
    customerIdDigits: string,
    headers: Record<string, string>,
    from: string,
    to: string,
    logHint: string,
  ): Promise<{ results: any[]; level: 'campaign' | 'customer' }> {
    const qc = this.googleAdsGaqlCampaignDailyStats(from, to);
    const campaignRows = await this.googleAdsSearchAllPages(
      customerIdDigits,
      headers,
      qc,
    );
    if (campaignRows.length) return { results: campaignRows, level: 'campaign' };
    const qu = this.googleAdsGaqlCustomerDailyStats(from, to);
    const customerRows = await this.googleAdsSearchAllPages(customerIdDigits, headers, qu);
    if (customerRows.length) {
      this.log.log(
        `${logHint}: customer ${customerIdDigits} — отчёт campaign пуст за ${from}…${to}, берём сводку customer (${customerRows.length} строк GAQL).`,
      );
    }
    return { results: customerRows, level: 'customer' };
  }

  /** Из resourceName вида \"customers/1234567890\" — только цифры. */
  private parseGoogleAdsCustomerResourceCid(resourceName: unknown): string | null {
    if (typeof resourceName !== 'string') return null;
    const m = /customers\/(\d{4,15})/i.exec(resourceName.trim());
    return m?.[1]?.trim() || null;
  }

  /**
   * POST googleAds:search с постраничным обходом; при status>=400 бросает BadRequestException.
   */
  private async googleAdsSearchAllPages(
    customerIdDigits: string,
    headers: Record<string, string>,
    query: string,
  ): Promise<any[]> {
    const url = this.googleAdsSearchUrl(customerIdDigits);
    const out: any[] = [];
    let pageToken: string | undefined;
    do {
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
      out.push(...results);
    } while (pageToken);
    return out;
  }

  /** Рекламные (не‑менеджерские, не тестовые) клиенты под указанным MCC. */
  private async googleAdsListManagedAdvertisingAccounts(
    managerCid: string,
    headers: Record<string, string>,
    opts: {
      maxAccounts: number;
      includeOnlyCids?: Set<string>;
    },
  ): Promise<Array<{ cid: string; descriptiveName: string }>> {
    // Поля в ORDER BY обязаны быть в SELECT (иначе 400 INVALID_ARGUMENT).
    const q = `
      SELECT
        customer_client.id,
        customer_client.client_customer,
        customer_client.descriptive_name,
        customer_client.manager,
        customer_client.status,
        customer_client.test_account
      FROM customer_client
      WHERE customer_client.status = ENABLED
      ORDER BY customer_client.id
    `.trim();
    const rows = await this.googleAdsSearchAllPages(managerCid, headers, q);
    const picked: Array<{ cid: string; descriptiveName: string }> = [];
    const seen = new Set<string>();
    for (const raw of rows) {
      const cc = (raw?.customerClient ?? raw?.customer_client) as Record<string, unknown> | undefined;
      if (!cc || typeof cc !== 'object') continue;
      if (cc.manager === true || String(cc.manager) === 'true') continue;
      if (cc.testAccount === true || cc.test_account === true) continue;
      const cidRaw = cc.clientCustomer ?? cc.client_customer;
      const cid =
        typeof cidRaw === 'string'
          ? this.parseGoogleAdsCustomerResourceCid(cidRaw)
          : null;
      if (!cid || !/^\d{6,15}$/.test(cid)) continue;
      if (opts.includeOnlyCids?.size && !opts.includeOnlyCids.has(cid)) continue;
      if (seen.has(cid)) continue;
      seen.add(cid);
      picked.push({
        cid,
        descriptiveName: String(cc.descriptiveName ?? cc.descriptive_name ?? '').trim(),
      });
      if (picked.length >= opts.maxAccounts) break;
    }
    return picked;
  }

  /**
   * Одна строка marketing_traffic на день при GAQL `FROM customer` (нет разбивки по кампаниям/странам).
   * Явно указываем Customer ID и при наличии название из Ads — чтобы в UI было видно источник.
   */
  private googleAdsDailySummaryCampaignTitle(
    customerIdDigits: string,
    descriptiveNameOrIntegrationName?: string | null,
  ): string {
    const cid = String(customerIdDigits || '').replace(/\D/g, '').trim();
    const hint = String(descriptiveNameOrIntegrationName || '')
      .trim()
      .replace(/\s+/g, ' ');
    const parts: string[] = [];
    if (/^\d{6,15}$/.test(cid)) parts.push(cid);
    if (hint) parts.push(hint.slice(0, 120));
    parts.push('сводка по дням');
    let s = parts.join(' · ');
    if (s.length > 256) s = `${s.slice(0, 253)}…`;
    return s || 'Google Ads · сводка по дням';
  }

  private buildGoogleAdsCampaignTrafficEntities(params: {
    tenantId: string;
    dataSourceTag: string;
    currencyNorm: string;
    results: any[];
    /** Строки GAQL `FROM customer` без campaign — одна подпись на все дни. */
    fallbackCampaignLabel?: string;
  }): MarketingTraffic[] {
    const rows: MarketingTraffic[] = [];
    const cur =
      String(params.currencyNorm || 'EUR').trim().toUpperCase().slice(0, 8) || 'EUR';
    const fallback = params.fallbackCampaignLabel?.trim();
    for (const r of params.results) {
      const picked = this.pickGoogleAdsSearchRowFields(r);
      if (!picked.date) continue;
      const name =
        fallback && fallback.length
          ? fallback
          : picked.campaignName?.trim() || '(campaign)';
      const cost = picked.costMicros / 1_000_000;

      rows.push(
        this.trafficRepo.create({
          tenantId: params.tenantId,
          date: picked.date,
          dataSource: params.dataSourceTag,
          source: 'google',
          medium: 'cpc',
          campaign: name,
          sessions: picked.clicks,
          clicks: picked.clicks,
          leads: 0,
          projects: 0,
          cost: String(cost),
          revenue: '0',
          currency: cur,
          impressions: picked.impressions,
        }),
      );
    }
    return rows;
  }

  private parseGoogleAdsMccWhitelist(flatSettings: Record<string, unknown>): Set<string> | undefined {
    const raw =
      flatSettings.googleAdsManagedCustomerIds ??
      flatSettings.google_ads_managed_customer_ids;
    let list: unknown[] | null = null;
    if (Array.isArray(raw)) list = raw;
    else if (typeof raw === 'string') {
      const t = raw.trim();
      if (t.startsWith('[')) {
        try {
          const p = JSON.parse(t) as unknown;
          list = Array.isArray(p) ? p : [];
        } catch {
          list = [];
        }
      } else if (t) {
        list = t.split(/[\s,;]+/).map((x) => x.trim());
      }
    }
    if (!list || !list.length) return undefined;
    const out = new Set<string>();
    for (const it of list) {
      const d = String(it ?? '').replace(/\D/g, '').trim();
      if (/^\d{6,15}$/.test(d)) out.add(d);
    }
    return out.size ? out : undefined;
  }

  /** Customer ID исключённые из синка MCC (белый список по-прежнему в googleAdsManagedCustomerIds). */
  private parseGoogleAdsMccExcludeList(
    flatSettings: Record<string, unknown>,
  ): Set<string> | undefined {
    const raw =
      flatSettings.googleAdsExcludedManagedCustomerIds ??
      flatSettings.google_ads_excluded_managed_customer_ids;
    let list: unknown[] | null = null;
    if (Array.isArray(raw)) list = raw;
    else if (typeof raw === 'string') {
      const t = raw.trim();
      if (t.startsWith('[')) {
        try {
          const p = JSON.parse(t) as unknown;
          list = Array.isArray(p) ? p : [];
        } catch {
          list = [];
        }
      } else if (t) {
        list = t.split(/[\s,;]+/).map((x) => x.trim());
      }
    }
    if (!list || !list.length) return undefined;
    const out = new Set<string>();
    for (const it of list) {
      const d = String(it ?? '').replace(/\D/g, '').trim();
      if (/^\d{6,15}$/.test(d)) out.add(d);
    }
    return out.size ? out : undefined;
  }

  /**
   * OAuth мастер сохраняет refresh token в JSON; developer token обычно один на платформу (env).
   * Собираем поля и отдельно список «чего не хватает» — для UI и логов синка.
   */
  private pickGoogleAdsCredentialParts(
    flat: Record<string, unknown>,
    rowPrimaryId: string | null,
  ): {
    refreshToken: string;
    customerIdRaw: string;
    developerToken: string;
    missingHints: string[];
  } {
    const refreshToken = String(flat.refreshToken || flat.refresh_token || '').trim();
    const customerIdRaw = String(
      flat.customerId || flat.customer_id || rowPrimaryId || '',
    ).trim();
    const developerToken = String(
      flat.developerToken ||
        flat.developer_token ||
        process.env.GOOGLE_ADS_DEVELOPER_TOKEN ||
        '',
    ).trim();
    const missingHints: string[] = [];
    if (!refreshToken) {
      missingHints.push(
        'refresh token — снова выполните вход через Google для этой интеграции или укажите refresh token в расширенных настройках.',
      );
    }
    if (!customerIdRaw) {
      missingHints.push(
        'Customer ID — в карточке интеграции должен быть заполнен основной ID (для режима MCC это ID менеджерского счёта).',
      );
    }
    if (!developerToken) {
      missingHints.push(
        'developer token — задайте переменную окружения GOOGLE_ADS_DEVELOPER_TOKEN для сервиса API (например в backend/.env для Docker) или поле developerToken в настройках интеграции.',
      );
    }
    return { refreshToken, customerIdRaw, developerToken, missingHints };
  }

  /** Публичный список клиентских счетов под MCC (режим mcc_managed или явный запрос). */
  async listGoogleAdsManagedCustomersForIntegration(
    tenantId: string,
    integrationId: string,
  ): Promise<{
    mode: string;
    managerId: string;
    loginCustomerId: string;
    customers: Array<{ customerId: string; descriptiveName: string | null }>;
  }> {
    const row = await this.integrationRepo.findOne({
      where: { id: integrationId, tenantId },
    });
    if (!row || row.provider !== 'google_ads') {
      throw new NotFoundException('Интеграция Google Ads не найдена');
    }
    const flat = this.flattenNestedIntegrationSettings(
      this.parseSettingsObject(row.settings),
    );
    const creds = this.pickGoogleAdsCredentialParts(flat, row.primaryId);
    if (creds.missingHints.length) {
      throw new BadRequestException(
        `Не хватает данных для Google Ads API. ${creds.missingHints.join(' ')}`,
      );
    }
    const { refreshToken, customerIdRaw: mccId, developerToken } = creds;
    let loginCustomerId = String(
      flat.loginCustomerId || flat.login_customer_id || '',
    ).trim();
    const mode = String(
      flat.googleAdsAccountMode || flat.google_ads_account_mode || 'customer',
    )
      .trim()
      .toLowerCase();
    const managerNorm = this.normalizeGoogleAdsCustomerId(mccId);
    if (mode === 'mcc_managed') {
      if (!loginCustomerId) loginCustomerId = managerNorm;
    } else if (!loginCustomerId) {
      loginCustomerId = managerNorm;
    }

    const intClientId = String(flat.clientId || flat.client_id || '').trim();
    const intClientSecret = String(flat.clientSecret || flat.client_secret || '').trim();
    const integrationOAuth =
      intClientId && intClientSecret
        ? { clientId: intClientId, clientSecret: intClientSecret }
        : undefined;
    const accessToken = await this.googleOAuthAccessToken(
      refreshToken,
      integrationOAuth,
    );
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    };
    const login = this.normalizeGoogleAdsCustomerId(loginCustomerId);
    if (login) headers['login-customer-id'] = login;

    const maxRaw = Number(
      flat.googleAdsMccMaxAccounts ?? flat.google_ads_mcc_max_accounts ?? 200,
    );
    const maxAccounts = Math.min(
      500,
      Math.max(1, Number.isFinite(maxRaw) ? Math.floor(maxRaw) : 200),
    );

    const list = await this.googleAdsListManagedAdvertisingAccounts(
      managerNorm,
      headers,
      { maxAccounts, includeOnlyCids: undefined },
    );
    return {
      mode,
      managerId: managerNorm,
      loginCustomerId: login,
      customers: list.map((c) => ({
        customerId: c.cid,
        descriptiveName: c.descriptiveName ? c.descriptiveName : null,
      })),
    };
  }

  /**
   * Refresh после платформенного OAuth выдан платформенному client_id.
   * Старые clientId/clientSecret в JSON интеграции (ручной ввод) иначе перекрывают pl1 и дают unauthorized_client.
   */
  private stripPerIntegrationGoogleClientOverride(settings: Record<string, unknown>): void {
    delete settings.clientId;
    delete settings.client_id;
    delete settings.clientSecret;
    delete settings.client_secret;
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
   * Креды Google Ads для действий автоматизаций: те же поля, что и у маркетинговой синхронизации
   * (refresh_token → access_token). Не возвращает refresh token.
   */
  async getGoogleAdsCredentialBundleForAutomation(
    tenantId: string,
    marketingIntegrationId: string,
  ): Promise<{
    developerToken: string;
    accessToken: string;
    customerId: string | null;
  } | null> {
    const row = await this.integrationRepo.findOne({
      where: { id: marketingIntegrationId, tenantId } as any,
    });
    if (!row || row.provider !== 'google_ads' || !row.isActive) return null;

    const s = this.flattenNestedIntegrationSettings(
      this.parseSettingsObject(row.settings),
    );
    const refreshToken = String(s.refreshToken || s.refresh_token || '').trim();
    const customerRaw = String(s.customerId || s.customer_id || row.primaryId || '').trim();
    const developerToken = String(
      s.developerToken ||
        s.developer_token ||
        process.env.GOOGLE_ADS_DEVELOPER_TOKEN ||
        '',
    ).trim();
    if (!refreshToken || !developerToken) return null;

    const intClientId = String(s.clientId || s.client_id || '').trim();
    const intClientSecret = String(s.clientSecret || s.client_secret || '').trim();
    const integrationOAuth =
      intClientId && intClientSecret
        ? { clientId: intClientId, clientSecret: intClientSecret }
        : undefined;

    const accessToken = await this.googleOAuthAccessToken(refreshToken, integrationOAuth);
    const cidDigits = customerRaw.replace(/\D/g, '');
    const customerId = cidDigits.length >= 6 ? cidDigits : null;
    return { developerToken, accessToken, customerId };
  }

  /**
   * Access token Meta из маркетинговой интеграции (как в syncMetaAdsIntegration).
   */
  async getMetaAdsCredentialBundleForAutomation(
    tenantId: string,
    marketingIntegrationId: string,
  ): Promise<{ accessToken: string } | null> {
    const row = await this.integrationRepo.findOne({
      where: { id: marketingIntegrationId, tenantId } as any,
    });
    if (!row || row.provider !== 'meta_ads' || !row.isActive) return null;

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
    if (!token) return null;
    return { accessToken: token.trim() };
  }

  private normalizeGoogleAdsSearchAxiosError(err: unknown): never {
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
      const net =
        err.code === 'ECONNABORTED' ? 'таймаут запроса к Google Ads' : err.message || 'сеть';
      throw new BadRequestException(
        `Google Ads API: нет ответа (${st ?? 'network'}) — ${net}${hint ? `. ${hint}` : ''}`,
      );
    }
    throw err;
  }

  /**
   * Одна интеграция Google Ads:
   * - режим по умолчанию `customer` — один рекламный Customer ID (`primaryId`/settings.customerId).
   * - `mcc_managed` — значение Primary ID трактуется как MCC / менеджерский счёт;
   *   синк обходит активные клиентские **не‑менеджерские** аккаунты и пишет источники `google_ads_<CID>`.
   */
  /** @returns число сохранённых строк marketing_traffic (0 если пропуск или нет данных). */
  async syncGoogleAdsIntegration(row: MarketingIntegration): Promise<number> {
    if (row.provider !== 'google_ads' || !row.isActive) return 0;

    const s = this.flattenNestedIntegrationSettings(
      this.parseSettingsObject(row.settings),
    );
    const creds = this.pickGoogleAdsCredentialParts(s, row.primaryId);
    if (creds.missingHints.length) {
      this.log.warn(
        `Google Ads sync skipped for integration ${row.id}: ${creds.missingHints.join(' | ')}`,
      );
      return 0;
    }
    const { refreshToken, customerIdRaw: primaryDigits, developerToken } = creds;
    let loginCustomerRaw = String(
      s.loginCustomerId || s.login_customer_id || '',
    ).trim();

    const mode = String(
      s.googleAdsAccountMode || s.google_ads_account_mode || 'customer',
    )
      .trim()
      .toLowerCase();

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

    const { from, to, lookbackDays } =
      this.resolveAdvertisingSyncInclusiveUtcRange(s);

    const currencyNorm =
      String(s.currency || 'EUR').trim().toUpperCase().slice(0, 8) || 'EUR';

    const baseHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    };

    const managerNorm = this.normalizeGoogleAdsCustomerId(primaryDigits);

    /** Подписи аккаунтов для подписей в отчётах — не затираем произвольные ключи пользователя целиком. */
    const readManagedLabels = (): Record<string, string> => {
      const raw = s.googleAdsManagedAccountLabels ?? s.google_ads_managed_account_labels;
      const out: Record<string, string> = {};
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
          const dk = String(k).replace(/\D/g, '').trim();
          const val = typeof v === 'string' ? v.trim() : String(v ?? '').trim();
          if (!dk || !val || val.length > 200) continue;
          out[dk] = val;
        }
      }
      return out;
    };

    if (mode === 'mcc_managed') {
      if (!loginCustomerRaw) loginCustomerRaw = managerNorm;
      const mccHeaders = { ...baseHeaders };
      const login = this.normalizeGoogleAdsCustomerId(loginCustomerRaw);
      if (login) mccHeaders['login-customer-id'] = login;

      this.log.log(
        `Google Ads MCC sync: integration ${row.id} manager ${managerNorm} UTC ${from}..${to} (${lookbackDays}d inclusive)`,
      );

      const maxRaw = Number(
        s.googleAdsMccMaxAccounts ?? s.google_ads_mcc_max_accounts ?? 120,
      );
      const maxAccounts = Math.min(
        250,
        Math.max(1, Number.isFinite(maxRaw) ? Math.floor(maxRaw) : 120),
      );
      const filter = this.parseGoogleAdsMccWhitelist(s);

      let clients: Array<{ cid: string; descriptiveName: string }>;
      try {
        clients = await this.googleAdsListManagedAdvertisingAccounts(
          managerNorm,
          mccHeaders,
          { maxAccounts, includeOnlyCids: filter },
        );
      } catch (e: unknown) {
        this.normalizeGoogleAdsSearchAxiosError(e);
      }

      const exclude = this.parseGoogleAdsMccExcludeList(s);
      if (exclude?.size) {
        const beforeEx = clients.length;
        clients = clients.filter((c) => !exclude.has(c.cid));
        if (beforeEx !== clients.length) {
          this.log.log(
            `Google Ads MCC sync (${row.id}): после исключений — ${clients.length}/${beforeEx} клиентских аккаунтов.`,
          );
        }
      }

      if (!clients.length) {
        this.log.warn(
          `Google Ads MCC sync (${row.id}): нет активных клиентских рекламных аккаунтов. Проверьте что Primary ID — Customer ID именно менеджерского счёта (MCC).`,
        );
        return 0;
      }

      let totalRows = 0;
      let failedAccounts = 0;
      const mergedLabels = readManagedLabels();
      let labelsDirty = false;

      for (const c of clients) {
        const tag = marketingTrafficGoogleAdsDataSource(c.cid);
        try {
          const { results, level } =
            await this.googleAdsSearchCampaignOrCustomerDailyMetrics(
              c.cid,
              mccHeaders,
              from,
              to,
              `Google Ads MCC sync ${row.id}`,
            );
          const batch = this.buildGoogleAdsCampaignTrafficEntities({
            tenantId: row.tenantId,
            dataSourceTag: tag,
            currencyNorm,
            results,
            fallbackCampaignLabel:
              level === 'customer'
                ? this.googleAdsDailySummaryCampaignTitle(c.cid, c.descriptiveName || row.name)
                : undefined,
          });

          await this.trafficRepo
            .createQueryBuilder()
            .delete()
            .from(MarketingTraffic)
            .where('tenantId = :tenantId', { tenantId: row.tenantId })
            .andWhere('dataSource = :ds', { ds: tag })
            .andWhere('date BETWEEN :from AND :to', { from, to })
            .execute();

          if (batch.length) {
            await this.saveMarketingTrafficChunked(batch);
            totalRows += batch.length;
          }
          const nm = String(c.descriptiveName || '').trim();
          // Always track the CID (even without a name) so deletion cleanup can find it.
          // Update the stored label only when a non-empty name is available or the CID is new.
          if (!(c.cid in mergedLabels) || (nm && mergedLabels[c.cid] !== nm)) {
            mergedLabels[c.cid] = nm;
            labelsDirty = true;
          }
        } catch (e: unknown) {
          failedAccounts += 1;
          const msg =
            e instanceof BadRequestException
              ? e.message
              : e instanceof Error
                ? e.message
                : String(e);
          this.log.warn(
            `Google Ads MCC sync: ошибка аккаунта клиента ${c.cid} (${c.descriptiveName || '—'}): ${msg}`,
          );
        }
      }

      if (labelsDirty) {
        const baseSettings = this.parseSettingsObject(row.settings) as Record<
          string,
          unknown
        >;
        baseSettings.googleAdsManagedAccountLabels = mergedLabels;
        row.settings = Object.keys(baseSettings).length ? baseSettings : null;
        await this.integrationRepo.save(row);
      }

      if (failedAccounts >= clients.length && clients.length > 0) {
        throw new BadRequestException(
          'Google Ads MCC: не удалось выгрузить данные ни по одному клиентскому аккаунту. Проверьте доступ OAuth к дочерним аккаунтам и заголовок login-customer-id (обычно = Customer ID вашего менеджерского счёта).',
        );
      }

      this.log.log(
        `Google Ads MCC sync: integration ${row.id} — всего сохранено ${totalRows} строк по ${clients.length - failedAccounts}/${clients.length} аккаунтам`,
      );
      return totalRows;
    }

    /* --- режим один рекламный аккаунт --- */
    const cid = managerNorm;
    const hdrSingle = { ...baseHeaders };
    const loginSingle = this.normalizeGoogleAdsCustomerId(loginCustomerRaw);
    if (loginSingle) hdrSingle['login-customer-id'] = loginSingle;

    this.log.log(
      `Google Ads sync: integration ${row.id} customer ${cid} UTC ${from}..${to} (${lookbackDays}d inclusive)`,
    );

    let results: any[];
    let summaryLevel: 'campaign' | 'customer' = 'campaign';
    try {
      const fetched = await this.googleAdsSearchCampaignOrCustomerDailyMetrics(
        cid,
        hdrSingle,
        from,
        to,
        `Google Ads sync ${row.id}`,
      );
      results = fetched.results;
      summaryLevel = fetched.level;
    } catch (e: unknown) {
      this.normalizeGoogleAdsSearchAxiosError(e);
    }

    const tag = marketingTrafficGoogleAdsDataSource(cid);
    const trafficRows = this.buildGoogleAdsCampaignTrafficEntities({
      tenantId: row.tenantId,
      dataSourceTag: tag,
      currencyNorm,
      results,
      fallbackCampaignLabel:
        summaryLevel === 'customer'
          ? this.googleAdsDailySummaryCampaignTitle(cid, row.name)
          : undefined,
    });

    await this.trafficRepo
      .createQueryBuilder()
      .delete()
      .from(MarketingTraffic)
      .where('tenantId = :tenantId', { tenantId: row.tenantId })
      .andWhere('dataSource = :ds', { ds: tag })
      .andWhere('date BETWEEN :from AND :to', { from, to })
      .execute();

    if (!trafficRows.length) return 0;

    await this.saveMarketingTrafficChunked(trafficRows);
    this.log.log(
      `Google Ads ${GOOGLE_ADS_API_VERSION}: saved ${trafficRows.length} rows (${tag}) tenant ${row.tenantId}`,
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

  /** Display name ресурса GA4 (Admin API) по уже выданному Bearer. */
  private async fetchGa4PropertyDisplayNameWithBearer(
    accessToken: string,
    numericPropertyId: string,
  ): Promise<string | null> {
    try {
      const url = `https://analyticsadmin.googleapis.com/v1beta/properties/${numericPropertyId}`;
      const res = await axios.get<{ displayName?: string }>(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
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

  /** Display name через сервисный аккаунт (классический путь). */
  private async fetchGa4PropertyDisplayName(
    serviceAccountJson: string,
    numericPropertyId: string,
  ): Promise<string | null> {
    const access = await this.googleServiceAccountAccessToken(
      serviceAccountJson,
      'https://www.googleapis.com/auth/analytics.readonly',
    );
    return this.fetchGa4PropertyDisplayNameWithBearer(access, numericPropertyId);
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
   * OAuth / service account → access token и property для GA4 Data API.
   */
  private async resolveGa4ReportingAccess(row: MarketingIntegration): Promise<{
    access: string;
    propertyId: string;
    currency: string;
  }> {
    const s = this.flattenNestedIntegrationSettings(
      this.parseSettingsObject(row.settings),
    );
    const refreshRaw = this.pickFirstNonEmptyString([
      s.refreshToken,
      s.refresh_token,
      s.oauthRefreshToken,
      s.oauth_refresh_token,
    ]);
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
    if (!propertyId) {
      throw new BadRequestException(
        'GA4: укажите propertyId (или primaryId свойства GA4, только цифры).',
      );
    }
    const scopeReadonly = 'https://www.googleapis.com/auth/analytics.readonly';
    let access: string;
    if (refreshRaw) {
      const intClientId = String(s.clientId || s.client_id || '').trim();
      const intClientSecret = String(s.clientSecret || s.client_secret || '').trim();
      const integrationOAuth =
        intClientId && intClientSecret
          ? { clientId: intClientId, clientSecret: intClientSecret }
          : undefined;
      access = await this.googleOAuthAccessToken(refreshRaw, integrationOAuth);
    } else if (jsonRaw) {
      access = await this.googleServiceAccountAccessToken(jsonRaw, scopeReadonly);
    } else {
      throw new BadRequestException(
        'GA4: подключите через «Google» (OAuth) или укажите serviceAccountJson (ключ сервисного аккаунта) в настройках интеграции.',
      );
    }
    return {
      access,
      propertyId,
      currency: String(s.currency || 'EUR').slice(0, 8) || 'EUR',
    };
  }

  /**
   * Доступ к GA4 Data API для импорта в таблицу рабочей области.
   */
  async getGa4WorkspaceReportingAccess(
    tenantId: string,
    integrationId: string,
  ): Promise<{ accessToken: string; propertyId: string; currency: string }> {
    const row = await this.integrationRepo.findOne({
      where: { id: integrationId, tenantId },
    });
    if (!row) {
      throw new NotFoundException('Интеграция маркетинга не найдена');
    }
    if (!row.isActive) {
      throw new BadRequestException('Включите интеграцию в разделе «Маркетинг»');
    }
    const prov = this.normalizeMarketingIntegrationProvider(row.provider);
    if (!this.isGa4MarketingProvider(prov)) {
      throw new BadRequestException('Нужна интеграция Google Analytics 4');
    }
    const { access, propertyId, currency } = await this.resolveGa4ReportingAccess(row);
    return { accessToken: access, propertyId, currency };
  }

  /**
   * GA4 Data API runReport — сессии и просмотры по дням с разбивкой по источнику / medium / кампании сессии.
   * dataSource: ga4_{propertyId}, чтобы несколько ресурсов GA4 не перетирали друг друга при синке.
   */
  async syncGa4Integration(row: MarketingIntegration): Promise<number> {
    const { access, propertyId, currency } = await this.resolveGa4ReportingAccess(row);
    const dataSourceTag = `ga4_${propertyId}`.slice(0, 80);
    const end = new Date();
    const start = new Date();
    start.setUTCDate(end.getUTCDate() - 30);
    const date1 = start.toISOString().slice(0, 10);
    const date2 = end.toISOString().slice(0, 10);

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
            currency,
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
      const displayName = await this.fetchGa4PropertyDisplayNameWithBearer(
        access,
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
   * Токен и путь рекламного аккаунта для Graph API — импорт Meta в таблицу рабочей области.
   */
  async getMetaAdsGraphCredentialsForWorkspace(
    tenantId: string,
    integrationId: string,
  ): Promise<{ accessToken: string; actPath: string }> {
    const row = await this.integrationRepo.findOne({
      where: { id: integrationId, tenantId },
    });
    if (!row) {
      throw new NotFoundException('Интеграция маркетинга не найдена');
    }
    if (!row.isActive) {
      throw new BadRequestException('Включите интеграцию в разделе «Маркетинг»');
    }
    const prov = this.normalizeMarketingIntegrationProvider(row.provider);
    if (!this.isMetaAdsProvider(prov)) {
      throw new BadRequestException('Нужна интеграция Meta Ads в маркетинге');
    }
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
    return { accessToken: token, actPath: `act_${accountRaw}` };
  }

  /**
   * Meta / Facebook Marketing API — дневные insights по рекламному аккаунту.
   * Нужны: access token с правами ads_read и ID счёта (только цифры или act_…).
   */
  async syncMetaAdsIntegration(row: MarketingIntegration): Promise<number> {
    const { accessToken: token, actPath } =
      await this.getMetaAdsGraphCredentialsForWorkspace(row.tenantId, row.id);
    const s = this.flattenNestedIntegrationSettings(
      this.parseSettingsObject(row.settings),
    );

    const { from: since, to: until, lookbackDays } =
      this.resolveAdvertisingSyncInclusiveUtcRange(s);

    this.log.log(
      `Meta Ads sync: integration ${row.id} window UTC ${since}..${until} (${lookbackDays}d inclusive)`,
    );

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

  async syncYandexDirectIntegration(row: MarketingIntegration): Promise<number> {
    const s = this.flattenNestedIntegrationSettings(
      this.parseSettingsObject(row.settings),
    );
    const rawToken = String(s.oauthToken || s.token || '').trim();
    if (!rawToken) {
      this.log.warn(`Yandex Direct sync skipped for integration ${row.id}: no oauthToken`);
      return 0;
    }
    const token = this.normalizeMetrikaOAuthToken(rawToken);
    const clientLogin = String(s.clientLogin || s.client_login || '').trim() || undefined;

    const { from, to, lookbackDays } = this.resolveAdvertisingSyncInclusiveUtcRange(s);
    this.log.log(
      `Yandex Direct sync: integration ${row.id} window UTC ${from}..${to} (${lookbackDays}d inclusive)`,
    );

    const currencyNorm = String(s.currency || 'RUB').trim().toUpperCase().slice(0, 8) || 'RUB';

    let report: Awaited<ReturnType<YandexDirectApiService['fetchCampaignReport']>>;
    try {
      report = await this.yandexDirect.fetchCampaignReport({ token, clientLogin }, from, to);
    } catch (e: unknown) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Яндекс.Директ: не удалось получить отчёт');
    }

    if (!report.length) {
      this.log.warn(`Yandex Direct: пустой отчёт для интеграции ${row.id}`);
      return 0;
    }

    const trafficRows: MarketingTraffic[] = report.map((r) => {
      const safeName = sanitizeTrafficText(r.campaignName) ?? r.campaignName.slice(0, 256);
      return this.trafficRepo.create({
        tenantId: row.tenantId,
        date: r.date,
        dataSource: 'yandex_direct',
        source: 'yandex',
        medium: 'cpc',
        campaign: safeName,
        sessions: r.clicks,
        clicks: r.clicks,
        leads: 0,
        projects: 0,
        cost: String(r.cost),
        revenue: '0',
        currency: currencyNorm,
        impressions: r.impressions,
      });
    });

    await this.trafficRepo
      .createQueryBuilder()
      .delete()
      .from(MarketingTraffic)
      .where('tenantId = :tenantId', { tenantId: row.tenantId })
      .andWhere('dataSource = :ds', { ds: 'yandex_direct' })
      .andWhere('date BETWEEN :from AND :to', { from, to })
      .execute();
    await this.saveMarketingTrafficChunked(trafficRows);
    this.log.log(`Yandex Direct: сохранено ${trafficRows.length} строк (по кампаниям), интеграция ${row.id}`);
    return trafficRows.length;
  }

  async syncVkAdsIntegration(row: MarketingIntegration): Promise<number> {
    const s = this.flattenNestedIntegrationSettings(
      this.parseSettingsObject(row.settings),
    );
    const clientId = String(s.clientId || s.client_id || '').trim();
    const clientSecret = String(s.clientSecret || s.client_secret || '').trim();
    if (!clientId || !clientSecret) {
      this.log.warn(`VK Ads sync skipped for integration ${row.id}: no clientId/clientSecret`);
      return 0;
    }

    const { from, to, lookbackDays } = this.resolveAdvertisingSyncInclusiveUtcRange(s);
    this.log.log(
      `VK Ads sync: integration ${row.id} window UTC ${from}..${to} (${lookbackDays}d inclusive)`,
    );

    const currencyNorm = String(s.currency || 'RUB').trim().toUpperCase().slice(0, 8) || 'RUB';

    let report: Awaited<ReturnType<VkAdsApiService['fetchCampaignReport']>>;
    try {
      report = await this.vkAds.fetchCampaignReport({ clientId, clientSecret }, from, to);
    } catch (e: unknown) {
      throw new BadRequestException(e instanceof Error ? e.message : 'VK Реклама: не удалось получить отчёт');
    }

    if (!report.length) {
      this.log.warn(`VK Ads: пустой отчёт для интеграции ${row.id}`);
      return 0;
    }

    const trafficRows: MarketingTraffic[] = report.map((r) => {
      const safeName = sanitizeTrafficText(r.campaignName) ?? r.campaignName.slice(0, 256);
      return this.trafficRepo.create({
        tenantId: row.tenantId,
        date: r.date,
        dataSource: 'vk_ads',
        source: 'vk',
        medium: 'cpc',
        campaign: safeName,
        sessions: r.clicks,
        clicks: r.clicks,
        leads: 0,
        projects: 0,
        cost: String(r.cost),
        revenue: '0',
        currency: currencyNorm,
        impressions: r.impressions,
      });
    });

    await this.trafficRepo
      .createQueryBuilder()
      .delete()
      .from(MarketingTraffic)
      .where('tenantId = :tenantId', { tenantId: row.tenantId })
      .andWhere('dataSource = :ds', { ds: 'vk_ads' })
      .andWhere('date BETWEEN :from AND :to', { from, to })
      .execute();
    await this.saveMarketingTrafficChunked(trafficRows);
    this.log.log(`VK Ads: сохранено ${trafficRows.length} строк (по кампаниям), интеграция ${row.id}`);
    return trafficRows.length;
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
      const yandexDirect = this.isYandexDirectProvider(p);
      const vkAds = this.isVkAdsProvider(p);
      if (!yandex && !ga && !meta && !yandexDirect && !vkAds) continue;
      try {
        if (yandex) await this.syncYandexMetrikaIntegration(row);
        else if (ga) await this.syncGa4Integration(row);
        else if (meta) await this.syncMetaAdsIntegration(row);
        else if (yandexDirect) await this.syncYandexDirectIntegration(row);
        else await this.syncVkAdsIntegration(row);
      } catch (e: any) {
        this.log.error(
          `Analytics sync failed [${row.provider} ${row.id}]: ${e?.message || e}`,
        );
      }
    }
  }

  // --- SEO (настройки, OAuth state, метрики) ---

  private seoOauthSecret(): string {
    return process.env.JWT_SECRET!;
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

  // --- Google Ads (маркетинг): OAuth authorization code → refresh в интеграции ---

  private googleAdsMarketingOAuthCallbackRedirectUri(): string {
    const apiBase = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    return `${apiBase}/v1/marketing/integrations/google-ads/oauth/callback`;
  }

  private sanitizeMarketingOAuthFrontendPath(raw: string | undefined): string {
    const fallback = '/integrations-hub?tab=marketing';
    const s = (raw ?? '').trim();
    if (!s) return fallback;
    if (!s.startsWith('/') || s.startsWith('//') || s.includes('://')) {
      throw new BadRequestException(
        'redirectPath должен быть относительным путём, начинающимся с /',
      );
    }
    if (s.length > 400) return fallback;
    return s;
  }

  private encodeGoogleAdsMarketingOauthState(
    inner: Omit<GoogleAdsMarketingOAuthStateDecoded, 'typ' | 'exp'>,
  ): string {
    const exp = Math.floor(Date.now() / 1000) + GOOGLE_ADS_MARKETING_OAUTH_TTL_SEC;
    const body: GoogleAdsMarketingOAuthStateDecoded = {
      typ: GOOGLE_ADS_MARKETING_OAUTH_STATE_TYP,
      exp,
      ...inner,
    };
    const payload = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
    const sig = crypto
      .createHmac('sha256', this.seoOauthSecret())
      .update(payload)
      .digest('base64url');
    return `${payload}.${sig}`;
  }

  private decodeGoogleAdsMarketingOauthState(
    state: string,
  ): GoogleAdsMarketingOAuthStateDecoded | null {
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
      ) as GoogleAdsMarketingOAuthStateDecoded;
      if (data?.typ !== GOOGLE_ADS_MARKETING_OAUTH_STATE_TYP) return null;
      if (!data?.tenantId || typeof data.redirect !== 'string') return null;
      if (data.intent !== 'create' && data.intent !== 'reconnect') return null;
      if (typeof data.exp !== 'number' || !Number.isFinite(data.exp)) return null;
      return data;
    } catch {
      return null;
    }
  }

  private assertGoogleAdsCustomerIdShape(primaryId: string): void {
    const digits = String(primaryId || '').replace(/\D/g, '');
    if (digits.length < 6 || digits.length > 15) {
      throw new BadRequestException(
        'Некорректный Customer ID: укажите идентификатор рекламного аккаунта Google Ads (цифры).',
      );
    }
  }

  /**
   * URL авторизации Google (scope adwords) для мастера подключения Google Ads в CRM.
   */
  async buildGoogleAdsMarketingOAuthAuthorizeUrl(
    tenantId: string,
    userId: string,
    dto: GoogleAdsOAuthStartDto,
  ): Promise<string> {
    const { clientId, clientSecret } =
      await this.platformSettings.getGoogleOAuthConfig();
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Google OAuth не настроен на платформе (client id / secret). Укажите в pl1 или в GOOGLE_OAUTH_CLIENT_*.',
      );
    }
    const apiBase = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    if (!apiBase) {
      throw new BadRequestException(
        'PUBLIC_API_URL не задан — без него нельзя зарегистрировать redirect_uri в Google Cloud.',
      );
    }
    const redirect = this.sanitizeMarketingOAuthFrontendPath(dto.redirectPath);

    if (dto.intent === 'reconnect') {
      const iid = dto.integrationId?.trim();
      if (!iid) {
        throw new BadRequestException('Для переподключения укажите integrationId');
      }
      const row = await this.integrationRepo.findOne({
        where: { id: iid, tenantId } as any,
      });
      if (!row || row.provider !== 'google_ads') {
        throw new NotFoundException('Интеграция Google Ads не найдена');
      }
      const state = this.encodeGoogleAdsMarketingOauthState({
        tenantId,
        userId,
        redirect,
        intent: 'reconnect',
        integrationId: iid,
      });
      return this.buildGoogleAdsMarketingOAuthAuthorizeUrlWithState(clientId, state);
    }

    const name = dto.name?.trim() || '';
    const primaryId = dto.primaryId?.trim() || '';
    if (!name) {
      throw new BadRequestException('Укажите название интеграции');
    }
    if (!primaryId) {
      throw new BadRequestException('Укажите Customer ID рекламного аккаунта');
    }
    this.assertGoogleAdsCustomerIdShape(primaryId);

    const currencyRaw = (dto.currency || 'EUR').trim().toUpperCase().slice(0, 8);
    const currency = ['EUR', 'USD', 'GBP', 'TRY'].includes(currencyRaw)
      ? currencyRaw
      : 'EUR';
    const login = dto.loginCustomerId?.trim();
    const source = dto.source?.trim();
    const medium = dto.medium?.trim();
    const accountMode =
      dto.googleAdsAccountMode === 'mcc_managed' ? 'mcc_managed' : undefined;

    const state = this.encodeGoogleAdsMarketingOauthState({
      tenantId,
      userId,
      redirect,
      intent: 'create',
      draft: {
        name,
        primaryId,
        currency,
        loginCustomerId: login || undefined,
        source: source || undefined,
        medium: medium || undefined,
        googleAdsAccountMode: accountMode,
      },
    });
    return this.buildGoogleAdsMarketingOAuthAuthorizeUrlWithState(clientId, state);
  }

  private buildGoogleAdsMarketingOAuthAuthorizeUrlWithState(
    clientId: string,
    state: string,
  ): string {
    const redirectUri = this.googleAdsMarketingOAuthCallbackRedirectUri();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/adwords',
      include_granted_scopes: 'true',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Завершение OAuth: обмен code, создание или обновление интеграции.
   * @returns относительный путь на фронт (с query googleAdsOAuth=connected|error).
   */
  async completeGoogleAdsMarketingOAuthRedirect(
    code: string,
    state: string,
  ): Promise<string> {
    const withError = (path: string) => {
      const sep = path.includes('?') ? '&' : '?';
      return `${path}${sep}googleAdsOAuth=error`;
    };
    const withOk = (path: string) => {
      const sep = path.includes('?') ? '&' : '?';
      return `${path}${sep}googleAdsOAuth=connected`;
    };

    const decoded = this.decodeGoogleAdsMarketingOauthState(state);
    if (!decoded) {
      return withError('/integrations-hub?tab=marketing');
    }
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now - 60) {
      return withError(decoded.redirect);
    }

    const redirectUri = this.googleAdsMarketingOAuthCallbackRedirectUri();
    let refreshToken: string;
    try {
      refreshToken = await this.exchangeGooglePlatformAuthorizationCode(
        code,
        redirectUri,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`Google Ads OAuth code exchange failed: ${msg}`);
      return withError(decoded.redirect);
    }

    try {
      if (decoded.intent === 'reconnect' && decoded.integrationId) {
        const row = await this.integrationRepo.findOne({
          where: { id: decoded.integrationId, tenantId: decoded.tenantId } as any,
        });
        if (!row || row.provider !== 'google_ads') {
          return withError(decoded.redirect);
        }
        const base = this.parseSettingsObject(row.settings) as Record<string, unknown>;
        this.stripPerIntegrationGoogleClientOverride(base);
        base.refreshToken = refreshToken;
        base.refresh_token = refreshToken;
        row.settings = Object.keys(base).length ? base : null;
        await this.integrationRepo.save(row);
        return withOk(decoded.redirect);
      }

      if (decoded.intent === 'create' && decoded.draft) {
        const d = decoded.draft;
        const settings: Record<string, unknown> = {
          currency: d.currency,
          refreshToken,
          refresh_token: refreshToken,
          customerId: d.primaryId.replace(/\D/g, ''),
        };
        const login = d.loginCustomerId?.replace(/\D/g, '').trim();
        if (login) settings.loginCustomerId = login;
        if (d.source) settings.source = d.source;
        if (d.medium) settings.medium = d.medium;
        if (d.googleAdsAccountMode === 'mcc_managed') {
          settings.googleAdsAccountMode = 'mcc_managed';
        }
        const dev = String(process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '').trim();
        if (dev) settings.developerToken = dev;

        await this.createMarketingIntegration(decoded.tenantId, {
          provider: 'google_ads',
          kind: 'ads',
          name: d.name,
          isActive: true,
          primaryId: d.primaryId,
          settings,
        });
        return withOk(decoded.redirect);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.error(`Google Ads OAuth finalize failed: ${msg}`);
      return withError(decoded.redirect);
    }

    return withError(decoded.redirect);
  }

  // --- GA4 (маркетинг): OAuth authorization code → refresh в интеграции ---

  private googleGa4MarketingOAuthCallbackRedirectUri(): string {
    const apiBase = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    return `${apiBase}/v1/marketing/integrations/ga4/oauth/callback`;
  }

  private encodeGa4MarketingOauthState(
    inner: Omit<Ga4MarketingOAuthStateDecoded, 'typ' | 'exp'>,
  ): string {
    const exp = Math.floor(Date.now() / 1000) + GA4_MARKETING_OAUTH_TTL_SEC;
    const body: Ga4MarketingOAuthStateDecoded = {
      typ: GA4_MARKETING_OAUTH_STATE_TYP,
      exp,
      ...inner,
    };
    const payload = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
    const sig = crypto
      .createHmac('sha256', this.seoOauthSecret())
      .update(payload)
      .digest('base64url');
    return `${payload}.${sig}`;
  }

  private decodeGa4MarketingOauthState(state: string): Ga4MarketingOAuthStateDecoded | null {
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
      ) as Ga4MarketingOAuthStateDecoded;
      if (data?.typ !== GA4_MARKETING_OAUTH_STATE_TYP) return null;
      if (!data?.tenantId || typeof data.redirect !== 'string') return null;
      if (data.intent !== 'create' && data.intent !== 'reconnect') return null;
      if (typeof data.exp !== 'number' || !Number.isFinite(data.exp)) return null;
      return data;
    } catch {
      return null;
    }
  }

  private assertGa4PropertyIdShape(primaryId: string): void {
    const digits = String(primaryId || '').replace(/\D/g, '');
    if (digits.length < 4 || digits.length > 15) {
      throw new BadRequestException(
        'Некорректный GA4 Property ID: укажите числовой идентификатор ресурса (например из URL Admin или настроек потока).',
      );
    }
  }

  async buildGa4MarketingOAuthAuthorizeUrl(
    tenantId: string,
    userId: string,
    dto: Ga4OAuthStartDto,
  ): Promise<string> {
    const { clientId, clientSecret } =
      await this.platformSettings.getGoogleOAuthConfig();
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Google OAuth не настроен на платформе (client id / secret). Укажите в pl1 или в GOOGLE_OAUTH_CLIENT_*.',
      );
    }
    const apiBase = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    if (!apiBase) {
      throw new BadRequestException(
        'PUBLIC_API_URL не задан — без него нельзя зарегистрировать redirect_uri в Google Cloud.',
      );
    }
    const redirect = this.sanitizeMarketingOAuthFrontendPath(dto.redirectPath);

    if (dto.intent === 'reconnect') {
      const iid = dto.integrationId?.trim();
      if (!iid) {
        throw new BadRequestException('Для переподключения укажите integrationId');
      }
      const row = await this.integrationRepo.findOne({
        where: { id: iid, tenantId } as any,
      });
      const prov = row ? this.normalizeMarketingIntegrationProvider(row.provider) : '';
      if (!row || !this.isGa4MarketingProvider(prov)) {
        throw new NotFoundException('Интеграция Google Analytics 4 не найдена');
      }
      const state = this.encodeGa4MarketingOauthState({
        tenantId,
        userId,
        redirect,
        intent: 'reconnect',
        integrationId: iid,
      });
      return this.buildGa4MarketingOAuthAuthorizeUrlWithState(clientId, state);
    }

    const name = dto.name?.trim() || '';
    const primaryId = dto.primaryId?.trim() || '';
    if (!name) {
      throw new BadRequestException('Укажите название интеграции');
    }
    if (!primaryId) {
      throw new BadRequestException('Укажите GA4 Property ID');
    }
    this.assertGa4PropertyIdShape(primaryId);

    const currencyRaw = (dto.currency || 'EUR').trim().toUpperCase().slice(0, 8);
    const currency = ['EUR', 'USD', 'GBP', 'TRY'].includes(currencyRaw)
      ? currencyRaw
      : 'EUR';

    const state = this.encodeGa4MarketingOauthState({
      tenantId,
      userId,
      redirect,
      intent: 'create',
      draft: {
        name,
        primaryId: primaryId.replace(/\D/g, ''),
        currency,
      },
    });
    return this.buildGa4MarketingOAuthAuthorizeUrlWithState(clientId, state);
  }

  private buildGa4MarketingOAuthAuthorizeUrlWithState(
    clientId: string,
    state: string,
  ): string {
    const redirectUri = this.googleGa4MarketingOAuthCallbackRedirectUri();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      include_granted_scopes: 'true',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * @returns относительный путь на фронт (query ga4OAuth=connected|error).
   */
  async completeGa4MarketingOAuthRedirect(code: string, state: string): Promise<string> {
    const withError = (path: string) => {
      const sep = path.includes('?') ? '&' : '?';
      return `${path}${sep}ga4OAuth=error`;
    };
    const withOk = (path: string) => {
      const sep = path.includes('?') ? '&' : '?';
      return `${path}${sep}ga4OAuth=connected`;
    };

    const decoded = this.decodeGa4MarketingOauthState(state);
    if (!decoded) {
      return withError('/integrations-hub?tab=marketing');
    }
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now - 60) {
      return withError(decoded.redirect);
    }

    const redirectUri = this.googleGa4MarketingOAuthCallbackRedirectUri();
    let refreshToken: string;
    try {
      refreshToken = await this.exchangeGooglePlatformAuthorizationCode(
        code,
        redirectUri,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`GA4 OAuth code exchange failed: ${msg}`);
      return withError(decoded.redirect);
    }

    try {
      if (decoded.intent === 'reconnect' && decoded.integrationId) {
        const row = await this.integrationRepo.findOne({
          where: { id: decoded.integrationId, tenantId: decoded.tenantId } as any,
        });
        const prov = row ? this.normalizeMarketingIntegrationProvider(row.provider) : '';
        if (!row || !this.isGa4MarketingProvider(prov)) {
          return withError(decoded.redirect);
        }
        const base = this.parseSettingsObject(row.settings) as Record<string, unknown>;
        this.stripPerIntegrationGoogleClientOverride(base);
        base.refreshToken = refreshToken;
        base.refresh_token = refreshToken;
        base.ga4AuthMode = 'oauth';
        row.settings = Object.keys(base).length ? base : null;
        await this.integrationRepo.save(row);
        return withOk(decoded.redirect);
      }

      if (decoded.intent === 'create' && decoded.draft) {
        const d = decoded.draft;
        const pid = String(d.primaryId).replace(/\D/g, '');
        const settings: Record<string, unknown> = {
          currency: d.currency,
          refreshToken,
          refresh_token: refreshToken,
          ga4AuthMode: 'oauth',
          propertyId: pid,
          ga4PropertyId: pid,
        };

        await this.createMarketingIntegration(decoded.tenantId, {
          provider: 'google_analytics',
          kind: 'analytics',
          name: d.name,
          isActive: true,
          primaryId: pid,
          settings,
        });
        return withOk(decoded.redirect);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.error(`GA4 OAuth finalize failed: ${msg}`);
      return withError(decoded.redirect);
    }

    return withError(decoded.redirect);
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

  /**
   * Обмен authorization_code на refresh_token (платформенный OAuth-клиент Google).
   * Используется GSC и мастером Google Ads в маркетинге — redirect_uri должен совпасть с тем, что в Google Cloud.
   */
  async exchangeGooglePlatformAuthorizationCode(
    code: string,
    redirectUri: string,
  ): Promise<string> {
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

  async exchangeGscCode(code: string, redirectUri: string): Promise<string> {
    return this.exchangeGooglePlatformAuthorizationCode(code, redirectUri);
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
