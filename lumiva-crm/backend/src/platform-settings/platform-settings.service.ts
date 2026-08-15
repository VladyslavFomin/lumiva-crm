import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettings } from './platform-settings.entity';
import https from 'node:https';

import {
  CATALOG_ID_TO_ENV_SUFFIX,
  THIRD_PARTY_CATALOG_IDS,
} from '../integrations/integration-catalog.constants';

export type BillingPlanCode = 'standard' | 'professional' | 'enterprise' | 'ultimate';

export interface BillingPlanLocaleContent {
  subtitle?: string;
  description?: string;
  features?: string[];
}

export interface BillingPlanContent {
  code: BillingPlanCode;
  title: string;
  price: string;
  subtitle: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  i18n?: {
    en?: BillingPlanLocaleContent;
    tr?: BillingPlanLocaleContent;
  };
}

@Injectable()
export class PlatformSettingsService {
  constructor(
    @InjectRepository(PlatformSettings)
    private readonly repo: Repository<PlatformSettings>,
  ) {}

  async getSettings(): Promise<PlatformSettings | null> {
    return this.repo.findOne({ where: {} });
  }

  private getDefaultBillingPlans(): BillingPlanContent[] {
    return [
      {
        code: 'standard',
        title: 'Standard',
        price: 'EUR 14',
        subtitle: 'Для быстрого запуска команды',
        description:
          'Базовый контур CRM для ежедневной работы отдела продаж и маркетинга.',
        features: [
          'Лиды, контакты, компании и сделки',
          'Воронка продаж и базовая аналитика',
          'Маркетинг и UTM-метки',
          'Email шаблоны и отправки',
          'Проекты и задачи',
          'Интеграции CF7 / WooCommerce',
        ],
      },
      {
        code: 'professional',
        title: 'Professional',
        price: 'EUR 23',
        subtitle: 'Для роста и автоматизации',
        description:
          'Подходит для масштабирования и усиления управляемости процессов.',
        features: [
          'Все из Standard',
          'Автоматизации и триггерные сценарии',
          'Telegram и чат-модуль',
          'SMM и расширенные интеграции',
          'Sales pipeline + KPI аналитика',
          'Расширенные права и процессы команд',
        ],
      },
      {
        code: 'enterprise',
        title: 'Enterprise',
        price: 'EUR 40',
        subtitle: 'Для системных корпоративных команд',
        description:
          'Максимум контроля, безопасности и глубокой аналитики для руководителей.',
        features: [
          'Все из Professional',
          'Client Accounts и клиентские порталы',
          'Глубокая BI/аналитика по отделам',
          'Планирование внедрения под ваш процесс',
          'Консалтинг по оптимизации продаж',
          'Поддержка 24/7 с SLA',
        ],
        highlighted: true,
      },
      {
        code: 'ultimate',
        title: 'Ultimate',
        price: 'EUR 52',
        subtitle: 'Для сложных внедрений и масштабирования',
        description:
          'Премиальный пакет с сопровождением, консалтингом и кастомизацией.',
        features: [
          'Все из Enterprise',
          'Индивидуальная архитектура под бизнес',
          'Приоритетная техническая линия 24/7',
          'Выделенный консалтинг и roadmap',
          'Миграция и сопровождение релизов',
          'Экспертная поддержка сложных интеграций',
        ],
      },
    ];
  }

  private sanitizeBillingPlans(input: unknown): BillingPlanContent[] {
    const fallback = this.getDefaultBillingPlans();
    if (!Array.isArray(input)) return fallback;
    const validCodes: BillingPlanCode[] = ['standard', 'professional', 'enterprise', 'ultimate'];
    const emptyPlan = (code: BillingPlanCode): BillingPlanContent => ({
      code,
      title: fallback.find((f) => f.code === code)?.title || code,
      price: '',
      subtitle: '',
      description: '',
      features: [],
      highlighted: false,
      i18n: {
        en: {},
        tr: {},
      },
    });
    const items = input
      .map((raw) => {
        if (!raw || typeof raw !== 'object') return null;
        const src = raw as Record<string, unknown>;
        const code = String(src.code || '') as BillingPlanCode;
        if (!validCodes.includes(code)) return null;
        const features = Array.isArray(src.features)
          ? src.features.map((f) => String(f || '').trim()).filter(Boolean)
          : [];
        const i18nRaw = (src.i18n && typeof src.i18n === 'object'
          ? src.i18n
          : {}) as Record<string, unknown>;
        const sanitizeLocale = (localeKey: 'en' | 'tr') => {
          const rawLocale = (i18nRaw[localeKey] && typeof i18nRaw[localeKey] === 'object'
            ? i18nRaw[localeKey]
            : {}) as Record<string, unknown>;
          const localeFeatures = Array.isArray(rawLocale.features)
            ? rawLocale.features.map((f) => String(f || '').trim()).filter(Boolean)
            : [];
          const locale: BillingPlanLocaleContent = {
            subtitle: String(rawLocale.subtitle || '').trim() || undefined,
            description: String(rawLocale.description || '').trim() || undefined,
            features: localeFeatures.length ? localeFeatures : undefined,
          };
          return locale;
        };
        return {
          code,
          title: String(src.title || '').trim() || fallback.find((f) => f.code === code)?.title || code,
          price: String(src.price || '').trim(),
          subtitle: String(src.subtitle || '').trim(),
          description: String(src.description || '').trim(),
          features,
          highlighted: typeof src.highlighted === 'boolean' ? src.highlighted : false,
          i18n: {
            en: sanitizeLocale('en'),
            tr: sanitizeLocale('tr'),
          },
        } as BillingPlanContent;
      })
      .filter(Boolean) as BillingPlanContent[];

    if (!items.length) return fallback;
    return validCodes.map((code) => items.find((i) => i.code === code) || emptyPlan(code));
  }

  async getBillingPlans(): Promise<BillingPlanContent[]> {
    const current = await this.getSettings();
    return this.sanitizeBillingPlans(current?.billingPlans);
  }

  async getBillingHealth() {
    const current = await this.getSettings();
    const prices = {
      standard: (current?.stripePriceStandard || '').trim(),
      professional: (current?.stripePriceProfessional || '').trim(),
      enterprise: (current?.stripePriceEnterprise || '').trim(),
      ultimate: (current?.stripePriceUltimate || '').trim(),
    };
    const priceChecks = Object.entries(prices).map(([code, value]) => ({
      code,
      configured: Boolean(value),
      validFormat: value.startsWith('price_'),
      value: value ? `${value.slice(0, 12)}...` : '',
    }));
    const missing: string[] = [];
    if (!(current?.stripeSecretKey || '').trim()) missing.push('stripeSecretKey');
    if (!(current?.stripeWebhookSecret || '').trim()) missing.push('stripeWebhookSecret');
    priceChecks.forEach((p) => {
      if (!p.configured || !p.validFormat) missing.push(`stripePrice.${p.code}`);
    });
    const plans = await this.getBillingPlans();
    return {
      configured: missing.length === 0,
      missing,
      prices: priceChecks,
      hasPublishableKey: Boolean((current?.stripePublishableKey || '').trim()),
      hasPlanContent: plans.length > 0,
      updatedAt: current?.updatedAt || null,
    };
  }

  async getTelegramConfig(): Promise<{ token: string | null; chatId: string | null }> {
    const current = await this.getSettings();
    const token =
      current?.telegramBotToken?.trim() ||
      process.env.TELEGRAM_BOT_TOKEN?.trim() ||
      null;
    const chatId =
      current?.telegramChatId?.trim() ||
      process.env.TELEGRAM_CHAT_ID?.trim() ||
      null;
    return { token, chatId };
  }

  async getGoogleOAuthConfig(): Promise<{ clientId: string | null; clientSecret: string | null }> {
    const current = await this.getSettings();
    const clientId =
      current?.googleOauthClientId?.trim() ||
      process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
      null;
    const clientSecret =
      current?.googleOauthClientSecret?.trim() ||
      process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ||
      null;
    return { clientId, clientSecret };
  }

  async getMetaOAuthConfig(): Promise<{ appId: string | null; appSecret: string | null }> {
    const current = await this.getSettings();
    const appId =
      current?.metaOauthAppId?.trim() ||
      process.env.META_OAUTH_APP_ID?.trim() ||
      null;
    const appSecret =
      current?.metaOauthAppSecret?.trim() ||
      process.env.META_OAUTH_APP_SECRET?.trim() ||
      null;
    return { appId, appSecret };
  }

  async getVkOAuthConfig(): Promise<{ clientId: string | null; clientSecret: string | null }> {
    const current = await this.getSettings();
    const clientId =
      current?.vkOauthClientId?.trim() ||
      process.env.VK_OAUTH_CLIENT_ID?.trim() ||
      null;
    const clientSecret =
      current?.vkOauthClientSecret?.trim() ||
      process.env.VK_OAUTH_CLIENT_SECRET?.trim() ||
      null;
    return { clientId, clientSecret };
  }

  /**
   * Для CRM: есть ли у платформы OAuth client id+secret для интеграции (БД или env).
   * Секреты не возвращаются — только флаги.
   */
  async getIntegrationOauthReadinessMap(): Promise<Record<string, { oauthReady: boolean }>> {
    const current = await this.getSettings();
    const fromDb =
      current?.integrationOAuthApps && typeof current.integrationOAuthApps === 'object'
        ? current.integrationOAuthApps
        : {};

    const google = await this.getGoogleOAuthConfig();
    const platformGoogleOauthReady = Boolean(
      google.clientId && google.clientSecret,
    );
    const metaCfg = await this.getMetaOAuthConfig();
    const platformMetaOauthReady = Boolean(metaCfg.appId && metaCfg.appSecret);
    const platformMicrosoftOauthReady = Boolean(
      (process.env.MICROSOFT_OAUTH_CLIENT_ID || process.env.OUTLOOK_OAUTH_CLIENT_ID || '').trim() &&
        (process.env.MICROSOFT_OAUTH_CLIENT_SECRET || process.env.OUTLOOK_OAUTH_CLIENT_SECRET || '').trim(),
    );

    const googleCatalogIds = new Set([
      'google_ads',
      'google_sheets',
      'google_calendar',
    ]);

    const out: Record<string, { oauthReady: boolean }> = {};
    for (const catalogId of THIRD_PARTY_CATALOG_IDS) {
      const row = fromDb[catalogId] as
        | { clientId?: string | null; clientSecret?: string | null }
        | undefined;
      const envSuffix = CATALOG_ID_TO_ENV_SUFFIX[catalogId] || catalogId.toUpperCase();
      const envId = process.env[`INTEGRATION_OAUTH_${envSuffix}_CLIENT_ID`]?.trim() || null;
      const envSecret =
        process.env[`INTEGRATION_OAUTH_${envSuffix}_CLIENT_SECRET`]?.trim() || null;
      const clientId = (row?.clientId && String(row.clientId).trim()) || envId;
      const clientSecret =
        (row?.clientSecret && String(row.clientSecret).trim()) || envSecret;
      let oauthReady = Boolean(clientId && clientSecret);
      if (googleCatalogIds.has(catalogId)) {
        oauthReady = oauthReady || platformGoogleOauthReady;
      }
      if (catalogId === 'meta_ads') {
        oauthReady = oauthReady || platformMetaOauthReady;
      }
      if (catalogId === 'outlook') {
        oauthReady = oauthReady || platformMicrosoftOauthReady;
      }
      out[catalogId] = { oauthReady };
    }
    return out;
  }

  async updateSettings(payload: {
    telegramBotToken?: string | null;
    telegramChatId?: string | null;
    googleOauthClientId?: string | null;
    googleOauthClientSecret?: string | null;
    metaOauthAppId?: string | null;
    metaOauthAppSecret?: string | null;
    vkOauthClientId?: string | null;
    vkOauthClientSecret?: string | null;
    stripeSecretKey?: string | null;
    stripePublishableKey?: string | null;
    stripeWebhookSecret?: string | null;
    stripePriceStandard?: string | null;
    stripePriceProfessional?: string | null;
    stripePriceEnterprise?: string | null;
    stripePriceUltimate?: string | null;
    billingPlans?: BillingPlanContent[] | null;
    openAiApiKey?: string | null;
    openAiBaseUrl?: string | null;
    openAiModel?: string | null;
    openAiImageModel?: string | null;
    aiPriceInputPerMtokUsd?: string | null;
    aiPriceOutputPerMtokUsd?: string | null;
    aiImageCostCents?: number | null;
    stripePriceAiCredits?: string | null;
    stripePriceStoragePack?: string | null;
    stripePriceTelephonyAddon?: string | null;
    aiCreditsPackAmountCents?: number | null;
    storagePackBytes?: string | null;
    integrationOAuthApps?: Record<
      string,
      { clientId?: string | null; clientSecret?: string | null }
    > | null;
  }) {
    let current = await this.getSettings();
    if (!current) {
      current = this.repo.create({
        telegramBotToken: payload.telegramBotToken ?? null,
        telegramChatId: payload.telegramChatId ?? null,
        googleOauthClientId: payload.googleOauthClientId ?? null,
        googleOauthClientSecret: payload.googleOauthClientSecret ?? null,
        metaOauthAppId: payload.metaOauthAppId ?? null,
        metaOauthAppSecret: payload.metaOauthAppSecret ?? null,
        vkOauthClientId: payload.vkOauthClientId ?? null,
        vkOauthClientSecret: payload.vkOauthClientSecret ?? null,
        stripeSecretKey: payload.stripeSecretKey ?? null,
        stripePublishableKey: payload.stripePublishableKey ?? null,
        stripeWebhookSecret: payload.stripeWebhookSecret ?? null,
        stripePriceStandard: payload.stripePriceStandard ?? null,
        stripePriceProfessional: payload.stripePriceProfessional ?? null,
        stripePriceEnterprise: payload.stripePriceEnterprise ?? null,
        stripePriceUltimate: payload.stripePriceUltimate ?? null,
        billingPlans: this.sanitizeBillingPlans(payload.billingPlans),
        openAiApiKey: payload.openAiApiKey ?? null,
        openAiBaseUrl: payload.openAiBaseUrl ?? null,
        openAiModel: payload.openAiModel ?? null,
        openAiImageModel: payload.openAiImageModel ?? null,
        aiPriceInputPerMtokUsd: payload.aiPriceInputPerMtokUsd ?? null,
        aiPriceOutputPerMtokUsd: payload.aiPriceOutputPerMtokUsd ?? null,
        aiImageCostCents: payload.aiImageCostCents ?? null,
        stripePriceAiCredits: payload.stripePriceAiCredits ?? null,
        stripePriceStoragePack: payload.stripePriceStoragePack ?? null,
        stripePriceTelephonyAddon: payload.stripePriceTelephonyAddon ?? null,
        aiCreditsPackAmountCents: payload.aiCreditsPackAmountCents ?? null,
        storagePackBytes: payload.storagePackBytes ?? null,
        integrationOAuthApps: payload.integrationOAuthApps ?? null,
      });
    } else {
      if (payload.telegramBotToken !== undefined) {
        current.telegramBotToken = payload.telegramBotToken;
      }
      if (payload.telegramChatId !== undefined) {
        current.telegramChatId = payload.telegramChatId;
      }
      if (payload.googleOauthClientId !== undefined) {
        current.googleOauthClientId = payload.googleOauthClientId;
      }
      if (payload.googleOauthClientSecret !== undefined) {
        current.googleOauthClientSecret = payload.googleOauthClientSecret;
      }
      if (payload.metaOauthAppId !== undefined) {
        current.metaOauthAppId = payload.metaOauthAppId;
      }
      if (payload.metaOauthAppSecret !== undefined) {
        current.metaOauthAppSecret = payload.metaOauthAppSecret;
      }
      if (payload.vkOauthClientId !== undefined) {
        current.vkOauthClientId = payload.vkOauthClientId;
      }
      if (payload.vkOauthClientSecret !== undefined) {
        current.vkOauthClientSecret = payload.vkOauthClientSecret;
      }
      if (payload.stripeSecretKey !== undefined) {
        current.stripeSecretKey = payload.stripeSecretKey;
      }
      if (payload.stripePublishableKey !== undefined) {
        current.stripePublishableKey = payload.stripePublishableKey;
      }
      if (payload.stripeWebhookSecret !== undefined) {
        current.stripeWebhookSecret = payload.stripeWebhookSecret;
      }
      if (payload.stripePriceStandard !== undefined) {
        current.stripePriceStandard = payload.stripePriceStandard;
      }
      if (payload.stripePriceProfessional !== undefined) {
        current.stripePriceProfessional = payload.stripePriceProfessional;
      }
      if (payload.stripePriceEnterprise !== undefined) {
        current.stripePriceEnterprise = payload.stripePriceEnterprise;
      }
      if (payload.stripePriceUltimate !== undefined) {
        current.stripePriceUltimate = payload.stripePriceUltimate;
      }
      if (payload.billingPlans !== undefined) {
        current.billingPlans = payload.billingPlans ? this.sanitizeBillingPlans(payload.billingPlans) : null;
      }
      if (payload.openAiApiKey !== undefined) current.openAiApiKey = payload.openAiApiKey;
      if (payload.openAiBaseUrl !== undefined) current.openAiBaseUrl = payload.openAiBaseUrl;
      if (payload.openAiModel !== undefined) current.openAiModel = payload.openAiModel;
      if (payload.openAiImageModel !== undefined) current.openAiImageModel = payload.openAiImageModel;
      if (payload.aiPriceInputPerMtokUsd !== undefined) {
        current.aiPriceInputPerMtokUsd = payload.aiPriceInputPerMtokUsd;
      }
      if (payload.aiPriceOutputPerMtokUsd !== undefined) {
        current.aiPriceOutputPerMtokUsd = payload.aiPriceOutputPerMtokUsd;
      }
      if (payload.aiImageCostCents !== undefined) current.aiImageCostCents = payload.aiImageCostCents;
      if (payload.stripePriceAiCredits !== undefined) {
        current.stripePriceAiCredits = payload.stripePriceAiCredits;
      }
      if (payload.stripePriceStoragePack !== undefined) {
        current.stripePriceStoragePack = payload.stripePriceStoragePack;
      }
      if (payload.stripePriceTelephonyAddon !== undefined) {
        current.stripePriceTelephonyAddon = payload.stripePriceTelephonyAddon;
      }
      if (payload.aiCreditsPackAmountCents !== undefined) {
        current.aiCreditsPackAmountCents = payload.aiCreditsPackAmountCents;
      }
      if (payload.storagePackBytes !== undefined) current.storagePackBytes = payload.storagePackBytes;
      if (payload.integrationOAuthApps !== undefined) {
        current.integrationOAuthApps = payload.integrationOAuthApps;
      }
    }
    return this.repo.save(current);
  }

  async sendStripeTest() {
    const current = await this.getSettings();
    const key = current?.stripeSecretKey?.trim() || process.env.STRIPE_SECRET_KEY?.trim() || null;
    if (!key || !key.startsWith('sk_')) {
      throw new Error('Stripe secret key is not configured');
    }
    return { ok: true };
  }

  async sendTelegramTest(message?: string) {
    const text =
      message?.trim() ||
      '✅ Тестовое уведомление от Lumiva Platform. Telegram подключен.';
    const sent = await this.sendTelegramMessage(text);
    if (!sent.ok) {
      throw new Error('Telegram is not configured');
    }
    return { ok: true };
  }

  async sendTelegramMessage(
    text: string,
    options?: { replyMarkup?: Record<string, unknown> },
  ): Promise<{ ok: boolean; messageId?: number }> {
    const { chatId } = await this.getTelegramConfig();
    if (!chatId) return { ok: false };
    return this.sendTelegramMessageToChat(chatId, text, options);
  }

  async sendTelegramMessageToChat(
    chatId: string,
    text: string,
    options?: { replyMarkup?: Record<string, unknown> },
  ): Promise<{ ok: boolean; messageId?: number }> {
    const { token } = await this.getTelegramConfig();
    if (!token) return { ok: false };

    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text,
    };
    if (options?.replyMarkup) {
      payload.reply_markup = options.replyMarkup;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await this.postJson(url, payload);

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Telegram API error: ${response.status} ${response.body}`);
    }

    try {
      const parsed = JSON.parse(response.body) as any;
      const messageId = parsed?.result?.message_id as number | undefined;
      return { ok: true, messageId };
    } catch {
      return { ok: true };
    }
  }

  async editTelegramMessage(
    chatId: string,
    messageId: number,
    text: string,
  ): Promise<void> {
    const { token } = await this.getTelegramConfig();
    if (!token) {
      throw new Error('Telegram is not configured');
    }
    const url = `https://api.telegram.org/bot${token}/editMessageText`;
    const response = await this.postJson(url, {
      chat_id: chatId,
      message_id: messageId,
      text,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Telegram API error: ${response.status} ${response.body}`);
    }
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string) {
    const { token } = await this.getTelegramConfig();
    if (!token) {
      throw new Error('Telegram is not configured');
    }
    const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
    const payload: Record<string, unknown> = { callback_query_id: callbackQueryId };
    if (text) payload.text = text;
    const response = await this.postJson(url, payload);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Telegram API error: ${response.status} ${response.body}`);
    }
  }
  private postJson(url: string, payload: Record<string, unknown>) {
    return new Promise<{ status: number; body: string }>((resolve, reject) => {
      const data = JSON.stringify(payload);
      const target = new URL(url);

      const req = https.request(
        {
          method: 'POST',
          hostname: target.hostname,
          path: `${target.pathname}${target.search}`,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
          },
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            resolve({ status: res.statusCode || 0, body });
          });
        },
      );

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }
}
