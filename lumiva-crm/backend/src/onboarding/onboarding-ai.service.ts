import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { resolveTenantAiOverrideFromRepo } from '../ai/tenant-ai-override.util';
import { isComponentAllowedByPlan } from '../tenants/plan-entitlements';
import type { BookingBusinessType } from '../bookings/booking-project.entity';

type AiOpenAiService = import('../ai/ai-openai.service').AiOpenAiService;
type AiQuotaService = import('../ai/ai-quota.service').AiQuotaService;
type CustomFieldsService = import('../custom-fields/custom-fields.service').CustomFieldsService;
type ProductsService = import('../products/products.service').ProductsService;
type BookingsCatalogService = import('../bookings/bookings-catalog.service').BookingsCatalogService;
type BookingsProjectsService = import('../bookings/bookings-projects.service').BookingsProjectsService;

const CURRENCIES = ['EUR', 'TRY', 'RUB', 'USD', 'GBP', 'UAH', 'KZT', 'AED'] as const;
const BOOKING_TYPES: BookingBusinessType[] = ['salon', 'restaurant', 'fitness', 'consultation', 'rental'];
const FIELD_TYPES = ['text', 'number', 'date', 'select', 'boolean'] as const;
const CHANNELS = ['whatsapp', 'instagram', 'telegram', 'website', 'email', 'phone', 'google_reviews', 'booking_sites'] as const;
const LANG_NAME: Record<string, string> = { ru: 'Russian', en: 'English', tr: 'Turkish' };

export type OnboardingAiPlan = {
  /** Короткое название вида бизнеса на языке интерфейса — для заголовка плана */
  businessKind: string;
  summary: string;
  currency: (typeof CURRENCIES)[number] | null;
  /** Вертикаль модуля «Бронирования»; null — бизнесу запись по времени не нужна */
  bookingType: BookingBusinessType | null;
  /** Услуги/товары: с bookingType — услуги бронирований, иначе — товары каталога */
  services: Array<{ name: string; price: number | null; durationMinutes: number | null }>;
  leadFields: Array<{ label: string; type: (typeof FIELD_TYPES)[number]; options: string[] }>;
  channels: Array<(typeof CHANNELS)[number]>;
  /** Что тариф/компоненты тенанта позволяют применить */
  allowed: { products: boolean; bookings: boolean };
};

export type OnboardingAiApplyInput = {
  plan: OnboardingAiPlan;
  apply: { currency?: boolean; booking?: boolean; services?: number[]; leadFields?: number[] };
};

export type OnboardingAiApplyResult = Array<{ item: string; ok: boolean; error?: string }>;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

/** Ключ доп. поля из названия: латиница/цифры, кириллица и турецкие буквы транслитерируются. */
function fieldKey(label: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
    п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya',
    ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
  };
  const s = label.toLowerCase().split('').map((c) => map[c] ?? c).join('').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `ai_${s || 'field'}`.slice(0, 60);
}

/**
 * ИИ-настройка CRM при регистрации: из пары фраз о бизнесе — план из реальных объектов CRM
 * (валюта, вертикаль бронирований, услуги/товары, доп. поля лида, каналы для подключения).
 * Ничего не применяется без выбора пользователя; применение идемпотентно (повторы пропускаются).
 */
@Injectable()
export class OnboardingAiService {
  private readonly log = new Logger(OnboardingAiService.name);

  constructor(
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(IntegrationConnection) private readonly integrations: Repository<IntegrationConnection>,
    private readonly moduleRef: ModuleRef,
  ) {}

  private get<T>(path: string, name: string): T {
    return this.moduleRef.get(require(path)[name], { strict: false });
  }

  private async allowed(tenantId: string): Promise<OnboardingAiPlan['allowed']> {
    const t = await this.tenants.findOne({ where: { id: tenantId } });
    const on = (k: string) => {
      const v = t?.enabledComponents?.[k];
      return typeof v === 'boolean' ? v : isComponentAllowedByPlan(k, t?.plan || '');
    };
    return { products: on('products'), bookings: on('bookings') };
  }

  async plan(tenantId: string, userId: string | null, description: string, lang: string): Promise<OnboardingAiPlan> {
    const text = str(description, 2000);
    if (text.length < 10) throw new BadRequestException({ code: 'TOO_SHORT', message: 'Describe the business in a sentence or two' });

    const override = await resolveTenantAiOverrideFromRepo(this.integrations, tenantId);
    const byok = !!override;
    const quota = this.get<AiQuotaService>('../ai/ai-quota.service', 'AiQuotaService');
    if (!byok && (await quota.getQuotaSnapshot(tenantId)).totalAvailableCents <= 0) {
      throw new BadRequestException({ code: 'AI_QUOTA_EXCEEDED', message: 'AI quota is empty' });
    }

    const out = LANG_NAME[lang] || 'English';
    const prompt = [
      'You set up a CRM for a new small business. From the owner\'s description, reply with JSON only:',
      '{"businessKind":"","summary":"","currency":"EUR|TRY|RUB|USD|GBP|UAH|KZT|AED|null",',
      '"bookingType":"salon|restaurant|fitness|consultation|rental|null",',
      '"services":[{"name":"","price":number|null,"durationMinutes":number|null}],',
      '"leadFields":[{"label":"","type":"text|number|date|select|boolean","options":[]}],',
      '"channels":["whatsapp|instagram|telegram|website|email|phone|google_reviews|booking_sites"]}',
      `Rules: write businessKind (2-4 words), summary (one sentence: what the CRM will help with), service names and field labels in ${out}. `,
      'currency — only if the country/city or currency is clear from the text, else null. ',
      'bookingType — only if clients book a time slot, table, class or item (salon/beauty/clinic → salon or consultation, ',
      'restaurant/cafe → restaurant, gym/yoga/studio → fitness, lawyer/tutor/consultant/doctor → consultation, cars/boats/equipment → rental); ',
      'hotels and shops → null. ',
      'services — up to 8 main services or products the business clearly sells; price only if stated, never invent prices. ',
      'leadFields — up to 4 extra fields a manager needs on an incoming request for THIS business (e.g. check-in date, number of guests, budget, car model); ',
      'do not include name, phone, email, source or status — the CRM already has them. ',
      'channels — where their clients most likely write or find them (only the listed values). ',
      `Owner's description: """${text}"""`,
    ].join('');

    const oai = this.get<AiOpenAiService>('../ai/ai-openai.service', 'AiOpenAiService');
    const { message, usage } = await oai
      .chatCompletionWithConfig(
        {
          messages: [{ role: 'user', content: prompt }],
          temperatureOverride: 0.2,
          jsonMode: true,
          ...(byok ? {} : { modelOverride: 'gpt-4o-mini' }),
        },
        override,
      )
      .catch((e) => {
        // сбой платформенного ключа (биллинг/лимиты платформы) клиенту не показываем — только свой ключ
        if (byok) throw e;
        this.log.warn(`tenant ${tenantId}: onboarding AI provider failed: ${(e as Error).message}`);
        throw new BadRequestException({ code: 'AI_UNAVAILABLE', message: 'AI is temporarily unavailable' });
      });
    if (!byok) {
      const cents = oai.estimateCostCents(usage.prompt_tokens || 0, usage.completion_tokens || 0, 0.15, 0.6);
      await quota
        .chargeCents(tenantId, cents, { userId: userId || undefined, kind: 'chat', model: 'gpt-4o-mini', promptTokens: usage.prompt_tokens || 0, completionTokens: usage.completion_tokens || 0 })
        .catch((e) => this.log.warn(`tenant ${tenantId}: onboarding AI charge failed: ${(e as Error).message}`));
    }

    let raw: Record<string, any>;
    try {
      raw = JSON.parse(String(message.content || '{}'));
    } catch {
      throw new BadRequestException({ code: 'AI_PROVIDER_ERROR', message: 'Unreadable model response' });
    }
    const allowed = await this.allowed(tenantId);
    const bookingType = BOOKING_TYPES.includes(raw.bookingType) ? (raw.bookingType as BookingBusinessType) : null;
    const seenFields = new Set<string>();
    return {
      businessKind: str(raw.businessKind, 60),
      summary: str(raw.summary, 300),
      currency: (CURRENCIES as readonly string[]).includes(String(raw.currency).toUpperCase())
        ? (String(raw.currency).toUpperCase() as OnboardingAiPlan['currency'])
        : null,
      bookingType,
      services: (Array.isArray(raw.services) ? raw.services : [])
        .map((s: any) => ({ name: str(s?.name, 120), price: num(s?.price), durationMinutes: num(s?.durationMinutes) }))
        .filter((s: { name: string }) => s.name)
        .slice(0, 8),
      leadFields: (Array.isArray(raw.leadFields) ? raw.leadFields : [])
        .map((f: any) => {
          const type = (FIELD_TYPES as readonly string[]).includes(f?.type) ? f.type : 'text';
          const options = Array.isArray(f?.options) ? f.options.map((o: unknown) => str(o, 60)).filter(Boolean).slice(0, 12) : [];
          return { label: str(f?.label, 80), type: type === 'select' && !options.length ? 'text' : type, options: type === 'select' ? options : [] };
        })
        .filter((f: { label: string }) => {
          const k = fieldKey(f.label);
          if (!f.label || seenFields.has(k)) return false;
          seenFields.add(k);
          return true;
        })
        .slice(0, 4),
      channels: [...new Set((Array.isArray(raw.channels) ? raw.channels : []).filter((c: string) => (CHANNELS as readonly string[]).includes(c)))] as OnboardingAiPlan['channels'],
      allowed,
    };
  }

  async apply(tenantId: string, role: string, input: OnboardingAiApplyInput): Promise<OnboardingAiApplyResult> {
    if (!['owner', 'admin'].includes(String(role || '').toLowerCase())) {
      throw new ForbiddenException({ code: 'OWNER_ONLY', message: 'Only the owner or an admin can apply the setup' });
    }
    const plan = input?.plan;
    const apply = input?.apply || {};
    if (!plan || typeof plan !== 'object') throw new BadRequestException('plan is required');
    const allowed = await this.allowed(tenantId);
    const results: OnboardingAiApplyResult = [];
    const run = async (item: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
        results.push({ item, ok: true });
      } catch (e) {
        results.push({ item, ok: false, error: String((e as Error)?.message || e).slice(0, 200) });
      }
    };

    const currency = (CURRENCIES as readonly string[]).includes(String(plan.currency)) ? String(plan.currency) : null;
    if (apply.currency && currency) {
      await run(`currency:${currency}`, () => this.tenants.update({ id: tenantId }, { primaryCurrency: currency }));
    }
    const tenant = await this.tenants.findOne({ where: { id: tenantId }, select: ['id', 'primaryCurrency'] });
    const cur = (currency && apply.currency ? currency : tenant?.primaryCurrency) || 'EUR';

    const bookingType = BOOKING_TYPES.includes(plan.bookingType as BookingBusinessType) ? (plan.bookingType as BookingBusinessType) : null;
    const asBookingServices = !!bookingType && allowed.bookings;
    if (apply.booking && bookingType && allowed.bookings) {
      const projects = this.get<BookingsProjectsService>('../bookings/bookings-projects.service', 'BookingsProjectsService');
      await run(`booking:${bookingType}`, () => projects.updateSettings(tenantId, { businessType: bookingType }));
    }

    const services = (Array.isArray(plan.services) ? plan.services : []).slice(0, 8);
    const pickedServices = (apply.services || []).filter((i) => Number.isInteger(i) && services[i]);
    if (pickedServices.length) {
      if (asBookingServices) {
        const catalog = this.get<BookingsCatalogService>('../bookings/bookings-catalog.service', 'BookingsCatalogService');
        const existing = new Set((await catalog.listServices(tenantId)).map((s) => s.name.trim().toLowerCase()));
        for (const i of pickedServices) {
          const s = services[i];
          const name = str(s.name, 120);
          if (!name || existing.has(name.toLowerCase())) continue;
          await run(`service:${name}`, () =>
            catalog.createService(tenantId, {
              name,
              durationMinutes: Math.min(600, Math.max(5, Math.round(num(s.durationMinutes) || 60))),
              price: String(num(s.price) ?? 0),
              currency: cur,
              active: true,
            }),
          );
        }
      } else if (allowed.products) {
        const products = this.get<ProductsService>('../products/products.service', 'ProductsService');
        for (const i of pickedServices) {
          const s = services[i];
          const name = str(s.name, 120);
          if (!name) continue;
          await run(`product:${name}`, () => products.createProduct(tenantId, { name, price: num(s.price) ?? 0, currency: cur, status: 'active' }));
        }
      }
    }

    const fields = (Array.isArray(plan.leadFields) ? plan.leadFields : []).slice(0, 4);
    const pickedFields = (apply.leadFields || []).filter((i) => Number.isInteger(i) && fields[i]);
    if (pickedFields.length) {
      const cf = this.get<CustomFieldsService>('../custom-fields/custom-fields.service', 'CustomFieldsService');
      const existingKeys = new Set((await cf.findAll(tenantId, 'lead')).map((f) => f.key));
      for (const i of pickedFields) {
        const f = fields[i];
        const label = str(f.label, 80);
        if (!label || existingKeys.has(fieldKey(label))) continue;
        const type = (FIELD_TYPES as readonly string[]).includes(f.type) ? f.type : 'text';
        const options = type === 'select' ? (f.options || []).map((o) => str(o, 60)).filter(Boolean).slice(0, 12) : [];
        await run(`field:${label}`, () =>
          cf.create(tenantId, {
            entityType: 'lead',
            key: fieldKey(label),
            label,
            type: (type === 'select' && !options.length ? 'text' : type) as any,
            ...(options.length ? { options: options.map((o) => ({ value: o, label: o })) } : {}),
          } as any),
        );
      }
    }

    this.log.log(`tenant ${tenantId}: AI setup applied ${results.filter((r) => r.ok).length}/${results.length}`);
    return results;
  }
}
