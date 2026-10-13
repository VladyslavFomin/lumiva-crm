import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { Hotel } from '../hotels/hotel.entity';
import { TelegramBot } from '../telegram-crm/telegram-bot.entity';
import { HotelBrand, HotelReputationSettings, HotelReviewSource } from './reputation.entities';
import {
  ALERT_KINDS,
  REPUTATION_PLATFORMS,
  REPLY_MODE,
  ReputationConfig,
  ReputationPlatform,
  Recipients,
  mergeConfig,
} from './reputation.constants';
import { decryptSecret, encryptSecret, maskSecret } from './reputation-crypto.util';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clampNum = (v: unknown, min: number, max: number, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

/** Настройки модуля отзывов, бренды и привязка отелей к площадкам. */
@Injectable()
export class ReputationSettingsService {
  constructor(
    @InjectRepository(HotelReputationSettings) private readonly settingsRepo: Repository<HotelReputationSettings>,
    @InjectRepository(HotelBrand) private readonly brands: Repository<HotelBrand>,
    @InjectRepository(HotelReviewSource) private readonly sources: Repository<HotelReviewSource>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(TelegramBot) private readonly bots: Repository<TelegramBot>,
  ) {}

  // ---------------------------------------------------------------- конфиг

  async row(tenantId: string): Promise<HotelReputationSettings> {
    let s = await this.settingsRepo.findOne({ where: { tenantId } });
    if (!s) {
      s = await this.settingsRepo.save(
        this.settingsRepo.create({ tenantId, config: {}, secrets: {}, pushToken: randomBytes(24).toString('hex') }),
      );
    }
    if (!s.pushToken) {
      s.pushToken = randomBytes(24).toString('hex');
      await this.settingsRepo.save(s);
    }
    return s;
  }

  async config(tenantId: string): Promise<ReputationConfig> {
    return mergeConfig((await this.row(tenantId)).config);
  }

  async secret(tenantId: string, name: 'apifyToken' | 'googleRefreshToken'): Promise<string | null> {
    return decryptSecret((await this.row(tenantId)).secrets?.[name]);
  }

  async setSecret(tenantId: string, name: 'apifyToken' | 'googleRefreshToken', value: string | null) {
    const s = await this.row(tenantId);
    const secrets = { ...(s.secrets || {}) };
    if (value) secrets[name] = encryptSecret(value);
    else delete secrets[name];
    s.secrets = secrets;
    await this.settingsRepo.save(s);
  }

  async patchConfig(tenantId: string, patch: Partial<ReputationConfig>) {
    const s = await this.row(tenantId);
    s.config = { ...(s.config || {}), ...patch };
    await this.settingsRepo.save(s);
  }

  /** Тенант по токену push-эндпоинта (Pub/Sub шлёт без авторизации CRM). */
  async tenantByPushToken(token: string): Promise<string | null> {
    if (!token || token.length < 20) return null;
    const s = await this.settingsRepo.findOne({ where: { pushToken: token } });
    return s?.tenantId ?? null;
  }

  async tenantsWithModule(): Promise<string[]> {
    const rows = await this.sources.createQueryBuilder('s').select('DISTINCT s.tenantId', 'tenantId').where('s.active = true').getRawMany();
    return rows.map((r) => r.tenantId);
  }

  async publicSettings(tenantId: string) {
    const s = await this.row(tenantId);
    const cfg = mergeConfig(s.config);
    const bot = cfg.telegramBotId ? await this.bots.findOne({ where: { id: cfg.telegramBotId, tenantId } as any }) : null;
    const allBots = await this.bots.find({ where: { tenantId } as any });
    const apiBase = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    return {
      config: cfg,
      apifyToken: maskSecret(s.secrets?.apifyToken),
      googleConnected: !!s.secrets?.googleRefreshToken,
      pushEndpoint: apiBase ? `${apiBase}/v1/public/hotel-reputation/google-push/${s.pushToken}` : null,
      telegramBots: allBots.map((b) => ({
        id: b.id,
        name: b.botName || (b.botUsername ? `@${b.botUsername}` : b.id),
        recipients: (((b as any).meta?.recipients as any[]) || []).map((r) => ({ id: r.id, name: r.staffUserName || r.telegramUsername || r.telegramChatId })),
      })),
      telegramBotOk: !!bot,
    };
  }

  /** Сохранение настроек из UI — с проверкой и обрезкой всех значений. */
  async updateSettings(tenantId: string, body: any) {
    const s = await this.row(tenantId);
    const cur = mergeConfig(s.config);
    const b = body || {};
    if (b.thresholds) {
      const t = b.thresholds;
      cur.thresholds = {
        negativeBelow: clampNum(t.negativeBelow, 1, 10, cur.thresholds.negativeBelow),
        noReplyHours: clampNum(t.noReplyHours, 1, 720, cur.thresholds.noReplyHours),
        ratingDropPoints: clampNum(t.ratingDropPoints, 0.05, 5, cur.thresholds.ratingDropPoints),
        topicRepeatCount: Math.round(clampNum(t.topicRepeatCount, 2, 50, cur.thresholds.topicRepeatCount)),
        topicRepeatDays: Math.round(clampNum(t.topicRepeatDays, 1, 60, cur.thresholds.topicRepeatDays)),
        staleDays: Math.round(clampNum(t.staleDays, 1, 60, cur.thresholds.staleDays)),
        countDriftPct: clampNum(t.countDriftPct, 0.1, 50, cur.thresholds.countDriftPct),
      };
    }
    if (b.alerts) for (const k of ALERT_KINDS) if (k in b.alerts) cur.alerts[k] = !!b.alerts[k];
    if (b.schedule) {
      const sc = b.schedule;
      cur.schedule = {
        holidaycheckMinutes: Math.round(clampNum(sc.holidaycheckMinutes, 15, 1440, cur.schedule.holidaycheckMinutes)),
        apifyHours: Math.round(clampNum(sc.apifyHours, 1, 168, cur.schedule.apifyHours)),
        otelpuanHours: Math.round(clampNum(sc.otelpuanHours, 1, 168, cur.schedule.otelpuanHours)),
        offSeason: sc.offSeason !== undefined ? !!sc.offSeason : cur.schedule.offSeason,
        maxPerRun: Math.round(clampNum(sc.maxPerRun, 5, 500, cur.schedule.maxPerRun)),
        firstLoadMax: Math.round(clampNum(sc.firstLoadMax, 10, 20000, cur.schedule.firstLoadMax)),
        maxConcurrentRuns: Math.round(clampNum(sc.maxConcurrentRuns, 1, 100, cur.schedule.maxConcurrentRuns)),
      };
    }
    if (b.translateTo === 'ru' || b.translateTo === 'en') cur.translateTo = b.translateTo;
    if (b.telegramBotId !== undefined) {
      const id = b.telegramBotId ? String(b.telegramBotId) : null;
      if (id && !(await this.bots.findOne({ where: { id, tenantId } as any }))) throw new BadRequestException('Telegram bot not found');
      cur.telegramBotId = id;
    }
    if (b.recipients) {
      const clean = (r: any): Recipients => ({
        emails: [...new Set((Array.isArray(r?.emails) ? r.emails : []).map((e: any) => String(e).trim().toLowerCase()).filter((e: string) => EMAIL_RE.test(e)))].slice(0, 20) as string[],
        telegram: (Array.isArray(r?.telegram) ? r.telegram : []).map(String).slice(0, 20),
        userIds: (Array.isArray(r?.userIds) ? r.userIds : []).map(String).slice(0, 50),
      });
      if (b.recipients.developer) cur.recipients.developer = clean(b.recipients.developer);
      if (b.recipients.brands) for (const [k, v] of Object.entries(b.recipients.brands)) cur.recipients.brands[k] = clean(v);
      if (b.recipients.hotels) for (const [k, v] of Object.entries(b.recipients.hotels)) cur.recipients.hotels[k] = clean(v);
    }
    if (b.signatures) for (const [k, v] of Object.entries(b.signatures)) cur.signatures[k] = String(v || '').slice(0, 200);
    if (b.apifyActors) {
      for (const [k, v] of Object.entries(b.apifyActors as Record<string, any>)) {
        if (!REPUTATION_PLATFORMS.includes(k as any)) continue;
        const input = String(v?.input ?? cur.apifyActors[k]?.input ?? '');
        // шаблон должен оставаться валидным JSON после подстановки
        try {
          JSON.parse(input.replace(/\{\{url\}\}/g, 'x').replace(/\{\{since\}\}/g, '2026-01-01').replace(/\{\{max\}\}/g, '10'));
        } catch {
          throw new BadRequestException(`Apify input for ${k} is not valid JSON`);
        }
        const prev = cur.apifyActors[k];
        cur.apifyActors[k] = {
          primary: String(v?.primary ?? '').trim().slice(0, 200),
          fallback: String(v?.fallback ?? '').trim().slice(0, 200),
          input: input.slice(0, 4000),
          everyHours: Math.round(clampNum(v?.everyHours, 1, 24 * 31, prev?.everyHours ?? 24)),
          firstLoadMax: Math.round(clampNum(v?.firstLoadMax, 10, 20000, prev?.firstLoadMax ?? 300)),
          maxPerRun: Math.round(clampNum(v?.maxPerRun, 5, 1000, prev?.maxPerRun ?? 20)),
        };
      }
    }
    if (b.google && b.google.pubsubTopic !== undefined) {
      const topic = String(b.google.pubsubTopic || '').trim();
      if (topic && !/^projects\/[^/]+\/topics\/[^/]+$/.test(topic)) throw new BadRequestException('Pub/Sub topic must look like projects/<project>/topics/<topic>');
      cur.google.pubsubTopic = topic || null;
    }
    if (b.google && b.google.accountName !== undefined) cur.google.accountName = b.google.accountName ? String(b.google.accountName) : null;
    if (b.holidaycheck) {
      const h = b.holidaycheck;
      cur.holidaycheck = {
        replyUrlTemplate: String(h.replyUrlTemplate ?? cur.holidaycheck.replyUrlTemplate).trim().slice(0, 500),
        method: h.method === 'PUT' ? 'PUT' : 'POST',
        authHeader: String(h.authHeader ?? cur.holidaycheck.authHeader).trim().slice(0, 60) || 'Authorization',
        authPrefix: String(h.authPrefix ?? cur.holidaycheck.authPrefix).slice(0, 30),
        bodyField: String(h.bodyField ?? cur.holidaycheck.bodyField).trim().slice(0, 60) || 'text',
      };
      if (cur.holidaycheck.replyUrlTemplate && !/^https:\/\//.test(cur.holidaycheck.replyUrlTemplate)) {
        throw new BadRequestException('HolidayCheck reply URL must start with https://');
      }
    }
    if (Array.isArray(b.topicsExtra)) {
      cur.topicsExtra = b.topicsExtra
        .map((x: any) => ({
          key: String(x?.key || x?.label || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 38),
          label: String(x?.label || '').trim().slice(0, 60),
        }))
        .filter((x: any) => x.key && x.label)
        .slice(0, 40);
    }
    if (b.monthlyReport) cur.monthlyReport = { enabled: !!b.monthlyReport.enabled };
    if (b.historyFrom !== undefined) {
      const v = b.historyFrom ? String(b.historyFrom).slice(0, 10) : null;
      if (v && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v)))) throw new BadRequestException('historyFrom must be YYYY-MM-DD');
      cur.historyFrom = v;
    }
    s.config = cur;
    await this.settingsRepo.save(s);
    if (b.apifyToken !== undefined) await this.setSecret(tenantId, 'apifyToken', b.apifyToken ? String(b.apifyToken).trim() : null);
    return this.publicSettings(tenantId);
  }

  // ---------------------------------------------------------------- бренды

  async listBrands(tenantId: string) {
    return this.brands.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
  }

  async saveBrand(tenantId: string, id: string | null, body: { name?: string; color?: string | null }) {
    const name = String(body?.name || '').trim().slice(0, 120);
    if (!name) throw new BadRequestException('Brand name is required');
    const color = body?.color && /^#[0-9a-f]{3,8}$/i.test(body.color) ? body.color : null;
    if (id) {
      const b = await this.brands.findOne({ where: { id, tenantId } });
      if (!b) throw new NotFoundException('Brand not found');
      b.name = name;
      b.color = color;
      return this.brands.save(b);
    }
    return this.brands.save(this.brands.create({ tenantId, name, color }));
  }

  async removeBrand(tenantId: string, id: string) {
    const b = await this.brands.findOne({ where: { id, tenantId } });
    if (!b) throw new NotFoundException('Brand not found');
    await this.hotels.update({ tenantId, brandId: id } as any, { brandId: null } as any);
    await this.brands.delete({ id });
    return { ok: true };
  }

  async setHotelBrand(tenantId: string, hotelId: string, brandId: string | null) {
    const h = await this.hotels.findOne({ where: { id: hotelId, tenantId } });
    if (!h) throw new NotFoundException('Hotel not found');
    if (brandId && !(await this.brands.findOne({ where: { id: brandId, tenantId } }))) throw new NotFoundException('Brand not found');
    await this.hotels.update({ id: hotelId }, { brandId } as any);
    return { ok: true };
  }

  // ---------------------------------------------------------------- площадки отеля

  sourcePublic(s: HotelReviewSource) {
    return {
      id: s.id,
      hotelId: s.hotelId,
      platform: s.platform,
      externalId: s.externalId,
      url: s.url,
      apiKey: maskSecret(s.apiKeyEnc),
      active: s.active,
      lastSyncAt: s.lastSyncAt?.toISOString() ?? null,
      lastSuccessAt: s.lastSuccessAt?.toISOString() ?? null,
      lastNewAt: s.lastNewAt?.toISOString() ?? null,
      lastError: s.lastError,
      platformRating: s.platformRating != null ? Number(s.platformRating) : null,
      platformCount: s.platformCount,
      useFallback: s.useFallback,
      backfillMax: s.backfillMax,
      replyMode: REPLY_MODE[s.platform],
    };
  }

  async listHotelsWithSources(tenantId: string) {
    const [hotels, sources, brands] = await Promise.all([
      this.hotels.find({ where: { tenantId }, order: { name: 'ASC' } }),
      this.sources.find({ where: { tenantId } }),
      this.listBrands(tenantId),
    ]);
    return {
      brands,
      hotels: hotels.map((h) => ({
        id: h.id,
        name: h.name,
        city: h.city,
        brandId: h.brandId,
        sources: sources.filter((s) => s.hotelId === h.id).map((s) => this.sourcePublic(s)),
      })),
    };
  }

  async upsertSource(
    tenantId: string,
    hotelId: string,
    platform: string,
    body: { url?: string | null; externalId?: string | null; apiKey?: string | null; active?: boolean },
  ) {
    if (!REPUTATION_PLATFORMS.includes(platform as any)) throw new BadRequestException('Unknown platform');
    const hotel = await this.hotels.findOne({ where: { id: hotelId, tenantId } });
    if (!hotel) throw new NotFoundException('Hotel not found');
    let s = await this.sources.findOne({ where: { hotelId, platform: platform as ReputationPlatform } });
    if (!s) s = this.sources.create({ tenantId, hotelId, platform: platform as ReputationPlatform, active: true });
    if (body.url !== undefined) {
      const url = body.url ? String(body.url).trim() : null;
      if (url && !/^https?:\/\//i.test(url)) throw new BadRequestException('URL must start with http(s)://');
      s.url = url ? url.slice(0, 2000) : null;
      // HolidayCheck: UUID отеля прямо в URL — пригодится для API
      if (platform === 'holidaycheck' && url && !s.externalId) {
        const m = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(url);
        if (m) s.externalId = m[0];
      }
    }
    if (body.externalId !== undefined) s.externalId = body.externalId ? String(body.externalId).trim().slice(0, 300) : null;
    if (body.apiKey !== undefined) s.apiKeyEnc = body.apiKey ? encryptSecret(String(body.apiKey).trim()) : null;
    if (body.active !== undefined) s.active = !!body.active;
    s = await this.sources.save(s);
    return this.sourcePublic(s);
  }

  async removeSource(tenantId: string, id: string) {
    const s = await this.sources.findOne({ where: { id, tenantId } });
    if (!s) throw new NotFoundException('Source not found');
    await this.sources.delete({ id });
    return { ok: true };
  }

  sourceApiKey(s: HotelReviewSource): string | null {
    return decryptSecret(s.apiKeyEnc);
  }

  async hotelsByIds(tenantId: string, ids: string[]) {
    return ids.length ? this.hotels.find({ where: { tenantId, id: In(ids) } }) : [];
  }
}
