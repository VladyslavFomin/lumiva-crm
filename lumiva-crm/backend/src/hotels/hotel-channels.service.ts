import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { randomBytes, timingSafeEqual } from 'crypto';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomOccupancyType } from './hotel-room-occupancy-type.entity';
import { HotelMarketGroup } from './hotel-market-group.entity';
import { HotelReservation, HotelNightlyRate } from './hotel-reservation.entity';
import { HotelAgency } from './hotel-agency.entity';
import { HotelRatePlan } from './hotel-rate-plan.entity';
import {
  HotelChannelAriState,
  HotelChannelConnection,
  HotelChannelLog,
  HotelChannelMapping,
  HotelChannelRatePlanMeta,
  HotelChannelSettings,
} from './hotel-channel.entities';
import {
  ChannelAdapter,
  ChannelAvailabilityItem,
  ChannelBookingRevision,
  ChannelRateItem,
  ChannelRateLimitError,
  ChannelWarning,
  ChannexAdapter,
  channexBaseUrl,
} from './hotel-channel-adapters';
import { HotelReservationsService } from './hotel-reservations.service';
import { HotelLiveService } from './hotel-live.service';
import { HotelAriService, AriPriceRequest, AriRestrictions, addDaysIso } from './hotel-ari.service';
import { matchOccupancyByAges } from './hotel-occupancy.util';
import { hotelToday } from './hotel-folio.service';
import { decryptSecret, encryptSecret, maskSecret } from '../hotel-reputation/reputation-crypto.util';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (n: number) => Math.round(n * 100) / 100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Channex: 10 вызовов ARI в минуту на объект для каждого из двух эндпоинтов — держим запас */
const CALLS_PER_MINUTE = 8;
/** проверка изменений цен и ограничений (уходят только изменения) */
const RATES_CHECK_MS = 5 * 60_000;
/** полная выгрузка — раз в сутки, ночью по времени отеля */
const FULL_SYNC_HOURS = [2, 3, 4];
const FULL_SYNC_MIN_GAP_MS = 20 * 3600_000;
const DEFAULT_PUSH_DAYS = 500;

type AvailValue = { a: number };
/** r — цена за номер; rs — цены по числу гостей «occ:price»; s — стоп; msa/max — ночей; cta/ctd — закрыто на заезд/выезд */
type RateValue = { r: number | null; rs: string | null; s: boolean; msa: number; max: number; cta: boolean; ctd: boolean };

const sameAvail = (a: AvailValue, b: AvailValue) => a.a === b.a;
const sameRate = (a: RateValue, b: RateValue) => a.r === b.r && a.rs === b.rs && a.s === b.s && a.msa === b.msa && a.max === b.max && a.cta === b.cta && a.ctd === b.ctd;

/** Изменённые дни → диапазоны: только подряд идущие даты с одинаковым значением */
function toRanges<T>(dates: string[], valueOf: (d: string) => T, same: (a: T, b: T) => boolean) {
  const out: Array<{ from: string; to: string; value: T }> = [];
  for (const d of dates) {
    const v = valueOf(d);
    const last = out[out.length - 1];
    if (last && same(last.value, v) && addDaysIso(last.to, 1) === d) last.to = d;
    else out.push({ from: d, to: d, value: v });
  }
  return out;
}

/** Предупреждение канала касается диапазона from..to этого внешнего id */
const warned = (ws: ChannelWarning[], externalId: string, from: string, to: string) =>
  ws.some((w) => (!w.externalId || w.externalId === externalId) && (!w.from || !w.to || (w.from <= to && w.to >= from)));

export interface ChannelSyncResult {
  mode: 'delta' | 'full';
  availability: number;
  rates: number;
  calls: number;
  taskIds: string[];
  warnings: ChannelWarning[];
  /** вызов пропущен из-за лимита частоты — уйдёт в следующий проход */
  deferred: Array<'availability' | 'rates'>;
}

/**
 * Менеджер каналов (PMS ↔ OTA через Channex) по правилам сертификации:
 * — ARI считается тем же сервисом, что календарь ограничений (HotelAriService); в канал уходят только изменения
 *   относительно последнего принятого каналом значения (hotel_channel_ari_state), одним вызовом на эндпоинт;
 *   полная выгрузка — раз в сутки ночью по времени отеля или кнопкой;
 * — не больше 8 вызовов в минуту на эндпоинт объекта; после ошибки — пауза 1→2→4…15 минут (429 — минута);
 * — значения из meta.warnings не считаются отправленными и уйдут снова;
 * — брони: лента неподтверждённых ревизий (вебхук booking — сразу, иначе раз в 5 минут), ack после записи;
 *   OTA становится партнёром брони, комиссия OTA — комиссией брони, оплата через OTA — в счёт партнёра.
 */
@Injectable()
export class HotelChannelsService implements OnModuleInit {
  private readonly log = new Logger(HotelChannelsService.name);
  /** отели, у которых поменялась занятость — наличие уходит при ближайшем проходе */
  private readonly dirtyAvail = new Map<string, { tenantId: string; hotelId: string }>();
  /** отели, у которых поменялись цены / ограничения — проверка без ожидания 5 минут */
  private readonly dirtyRates = new Set<string>();
  /** вызовы ARI по объекту и эндпоинту за последнюю минуту */
  private readonly calls = new Map<string, number[]>();
  /** подключения, по которым идёт обмен (кнопка и планировщик не пересекаются) */
  private readonly running = new Set<string>();
  /** вебхук: загрузка броней «как можно скорее» без параллельных проходов */
  private readonly pullQueued = new Set<string>();

  constructor(
    @InjectRepository(HotelChannelConnection) private readonly connections: Repository<HotelChannelConnection>,
    @InjectRepository(HotelChannelMapping) private readonly mappings: Repository<HotelChannelMapping>,
    @InjectRepository(HotelChannelLog) private readonly logs: Repository<HotelChannelLog>,
    @InjectRepository(HotelChannelAriState) private readonly states: Repository<HotelChannelAriState>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelRoomType) private readonly roomTypes: Repository<HotelRoomType>,
    @InjectRepository(HotelRoomOccupancyType) private readonly occupancy: Repository<HotelRoomOccupancyType>,
    @InjectRepository(HotelMarketGroup) private readonly groups: Repository<HotelMarketGroup>,
    @InjectRepository(HotelReservation) private readonly reservationsRepo: Repository<HotelReservation>,
    @InjectRepository(HotelAgency) private readonly agencies: Repository<HotelAgency>,
    @InjectRepository(HotelRatePlan) private readonly ratePlans: Repository<HotelRatePlan>,
    private readonly ari: HotelAriService,
    private readonly reservations: HotelReservationsService,
    private readonly live: HotelLiveService,
  ) {}

  onModuleInit() {
    this.live.onEvent((tenantId, e) => {
      if (e.type === 'changed' && (e.entity === 'reservation' || e.entity === 'outage' || e.entity === 'unit') && e.hotelId) {
        this.dirtyAvail.set(`${tenantId}|${e.hotelId}`, { tenantId, hotelId: e.hotelId });
      }
    });
  }

  /** Цены или ограничения отеля поменялись (календарь, прайс) — проверить изменения при ближайшем проходе */
  markRatesDirty(tenantId: string, hotelId: string) {
    this.dirtyRates.add(`${tenantId}|${hotelId}`);
  }

  adapterFor(c: HotelChannelConnection): ChannelAdapter {
    const key = decryptSecret(c.apiKeyEnc);
    if (!key) throw new BadRequestException({ code: 'HOTEL_CHANNEL_NO_KEY', message: 'Не задан ключ API канала' });
    return new ChannexAdapter(key, channexBaseUrl(c.environment));
  }

  private view(c: HotelChannelConnection, mappings: HotelChannelMapping[] = []) {
    const { apiKeyEnc, webhookSecretEnc, ...rest } = c;
    return {
      ...rest,
      apiKeyMasked: maskSecret(apiKeyEnc),
      webhookActive: !!c.webhookId,
      pausedUntil: c.backoffUntil && c.backoffUntil > new Date() ? c.backoffUntil : null,
      mappings,
    };
  }

  private async get(tenantId: string, id: string) {
    const c = await this.connections.findOne({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Подключение не найдено');
    return c;
  }

  private async addLog(c: HotelChannelConnection, kind: HotelChannelLog['kind'], ok: boolean, message: string, details?: Record<string, unknown>) {
    await this.logs.save(this.logs.create({ tenantId: c.tenantId, connectionId: c.id, kind, ok, message: message.slice(0, 2000), details: details ?? null }));
  }

  async list(tenantId: string, hotelId?: string) {
    const list = await this.connections.find({ where: { tenantId, ...(hotelId ? { hotelId } : {}) }, order: { createdAt: 'ASC' } });
    const maps = list.length ? await this.mappings.find({ where: { tenantId, connectionId: In(list.map((c) => c.id)) } }) : [];
    return list.map((c) => this.view(c, maps.filter((m) => m.connectionId === c.id)));
  }

  /** Новое подключение или замена ключа: ключ проверяется запросом к каналу до сохранения */
  async connect(tenantId: string, dto: { hotelId?: string; provider?: string; apiKey?: string; environment?: string; externalPropertyId?: string }) {
    const hotel = await this.hotels.findOne({ where: { id: dto.hotelId || '', tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    if (dto.provider && dto.provider !== 'channex') throw new BadRequestException({ code: 'HOTEL_CHANNEL_PROVIDER', message: 'Неизвестный менеджер каналов' });
    const environment = dto.environment === 'staging' ? 'staging' : dto.environment === 'test' && process.env.CHANNEX_TEST_BASE_URL ? 'test' : 'production';
    let c = await this.connections.findOne({ where: { tenantId, hotelId: hotel.id, provider: 'channex' } });
    const apiKey = String(dto.apiKey || '').trim();
    if (!c && !apiKey) throw new BadRequestException({ code: 'HOTEL_CHANNEL_NO_KEY', message: 'Укажите ключ API канала' });
    const probe = new ChannexAdapter(apiKey || decryptSecret(c?.apiKeyEnc) || '', channexBaseUrl(environment));
    const properties = await probe.listProperties();
    const prop = dto.externalPropertyId ? properties.find((p) => p.id === dto.externalPropertyId) : properties.length === 1 ? properties[0] : null;
    if (dto.externalPropertyId && !prop) throw new BadRequestException({ code: 'HOTEL_CHANNEL_PROPERTY', message: 'Объект не найден в канале' });
    const propertyChanged = !!c && !!prop && c.externalPropertyId !== prop.id;
    c = c || this.connections.create({ tenantId, hotelId: hotel.id, provider: 'channex', settings: { pushDays: DEFAULT_PUSH_DAYS, reserveRooms: 0 } });
    c.environment = environment;
    if (apiKey) c.apiKeyEnc = encryptSecret(apiKey);
    if (prop) {
      c.externalPropertyId = prop.id;
      c.externalPropertyName = prop.title;
    }
    c.status = 'active';
    c.lastError = null;
    c.failCount = 0;
    c.backoffUntil = null;
    const saved = await this.connections.save(c);
    if (propertyChanged || apiKey) await this.resetState(saved);
    await this.addLog(saved, 'test', true, `Ключ принят, объектов в канале: ${properties.length}`);
    if (saved.externalPropertyId) await this.ensureWebhook(saved).catch(() => undefined);
    return { connection: this.view(saved), properties };
  }

  async update(tenantId: string, id: string, dto: { status?: string; settings?: HotelChannelSettings; externalPropertyId?: string }) {
    const c = await this.get(tenantId, id);
    if (dto.status === 'paused' || dto.status === 'active') {
      c.status = dto.status;
      if (dto.status === 'active') {
        c.failCount = 0;
        c.backoffUntil = null;
      }
    }
    if (dto.settings) {
      c.settings = {
        pushDays: Math.min(500, Math.max(7, Math.round(Number(dto.settings.pushDays ?? c.settings.pushDays ?? DEFAULT_PUSH_DAYS)))),
        reserveRooms: Math.min(50, Math.max(0, Math.round(Number(dto.settings.reserveRooms ?? c.settings.reserveRooms ?? 0)))),
      };
      this.markRatesDirty(c.tenantId, c.hotelId);
      this.dirtyAvail.set(`${c.tenantId}|${c.hotelId}`, { tenantId: c.tenantId, hotelId: c.hotelId });
    }
    if (dto.externalPropertyId !== undefined && dto.externalPropertyId !== c.externalPropertyId) {
      const props = await this.adapterFor(c).listProperties();
      const p = props.find((x) => x.id === dto.externalPropertyId);
      if (!p) throw new BadRequestException({ code: 'HOTEL_CHANNEL_PROPERTY', message: 'Объект не найден в канале' });
      await this.dropWebhook(c);
      c.externalPropertyId = p.id;
      c.externalPropertyName = p.title;
      await this.resetState(c);
    }
    const saved = await this.connections.save(c);
    if (saved.externalPropertyId && !saved.webhookId) await this.ensureWebhook(saved).catch(() => undefined);
    return this.view(saved);
  }

  async remove(tenantId: string, id: string) {
    const c = await this.get(tenantId, id);
    await this.dropWebhook(c);
    await this.connections.remove(c);
    return { ok: true };
  }

  /* ---------- вебхук броней ---------- */

  private webhookUrl(c: HotelChannelConnection) {
    const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    return base ? `${base}/v1/public/hotel-channels/${c.id}/webhook` : null;
  }

  /** Регистрирует вебхук броней в канале (если ещё нет); без PUBLIC_API_URL — только опрос ленты */
  async ensureWebhook(c: HotelChannelConnection) {
    if (c.webhookId || !c.externalPropertyId) return c;
    const url = this.webhookUrl(c);
    if (!url) return c;
    const secret = randomBytes(24).toString('hex');
    try {
      c.webhookId = await this.adapterFor(c).createWebhook(c.externalPropertyId, url, secret);
      c.webhookSecretEnc = encryptSecret(secret);
      await this.connections.save(c);
      await this.addLog(c, 'test', true, 'Вебхук броней включён: брони из канала приходят сразу');
    } catch (e) {
      await this.addLog(c, 'test', false, `Вебхук не включён (брони — опросом раз в 5 минут): ${(e as any)?.response?.message || (e as Error).message}`);
    }
    return c;
  }

  private async dropWebhook(c: HotelChannelConnection) {
    if (!c.webhookId) return;
    try {
      await this.adapterFor(c).deleteWebhook(c.webhookId);
    } catch (e) {
      this.log.warn(`channel webhook delete ${c.id}: ${(e as Error).message}`);
    }
    c.webhookId = null;
    c.webhookSecretEnc = null;
  }

  async toggleWebhook(tenantId: string, id: string, on: boolean) {
    const c = await this.get(tenantId, id);
    if (on) {
      if (!this.webhookUrl(c)) throw new BadRequestException({ code: 'HOTEL_CHANNEL_WEBHOOK_URL', message: 'На сервере не задан публичный адрес API' });
      await this.ensureWebhook(c);
      if (!c.webhookId) throw new BadRequestException({ code: 'HOTEL_CHANNEL_WEBHOOK', message: 'Канал не принял вебхук — см. журнал' });
    } else {
      await this.dropWebhook(c);
      await this.connections.save(c);
      await this.addLog(c, 'test', true, 'Вебхук броней выключен: брони — опросом раз в 5 минут');
    }
    return this.view(c);
  }

  /**
   * Вызов от канала. Секрет — в заголовке X-Channex-Webhook-Secret (сравнение за постоянное время). Тело не доверяем:
   * событие booking — только сигнал забрать ленту ревизий (ответ сразу, загрузка — в фоне).
   */
  async webhook(connectionId: string, secret: string | undefined, body: any) {
    if (!/^[0-9a-f-]{36}$/i.test(connectionId)) throw new NotFoundException();
    const c = await this.connections.findOne({ where: { id: connectionId } });
    const expected = c?.webhookSecretEnc ? decryptSecret(c.webhookSecretEnc) : null;
    const got = Buffer.from(String(secret || ''));
    const exp = Buffer.from(String(expected || ''));
    if (!c || !expected || got.length !== exp.length || !timingSafeEqual(got, exp)) throw new NotFoundException();
    const event = String(body?.event || '');
    if (/^booking|non_acked_booking/.test(event)) {
      if (event === 'booking_unmapped_room' || event === 'booking_unmapped_rate') {
        await this.addLog(c, 'booking', false, `Канал: бронь в несопоставленный ${event === 'booking_unmapped_room' ? 'тип номера' : 'тариф'} — сопоставьте и загрузите брони`, { event });
      }
      this.pullSoon(c.tenantId, c.id);
    } else if (event === 'sync_error' || event === 'rate_error') {
      await this.addLog(c, 'push', false, `Канал сообщил об ошибке синхронизации (${event})`, { payload: body?.payload ?? null });
    }
    return { ok: true };
  }

  private pullSoon(tenantId: string, id: string) {
    if (this.pullQueued.has(id)) return;
    this.pullQueued.add(id);
    setTimeout(() => {
      this.pull(tenantId, id)
        .catch((e) => this.log.warn(`channel webhook pull ${id}: ${(e as Error).message}`))
        .finally(() => this.pullQueued.delete(id));
    }, 1500);
  }

  /* ---------- сопоставление ---------- */

  /** Типы номеров и тарифы объекта в канале — для сопоставления */
  async remote(tenantId: string, id: string) {
    const c = await this.get(tenantId, id);
    const a = this.adapterFor(c);
    if (!c.externalPropertyId) return { properties: await a.listProperties(), roomTypes: [], ratePlans: [] };
    const [properties, roomTypes, ratePlans] = await Promise.all([a.listProperties(), a.listRoomTypes(c.externalPropertyId), a.listRatePlans(c.externalPropertyId)]);
    return { properties, roomTypes, ratePlans };
  }

  /**
   * Сопоставления заменяются целиком; тип номера, размещение и группа — только этого отеля. Режим тарифа (за номер /
   * за человека, производный) читается из канала тут же — от него зависит, что отправлять.
   */
  async saveMappings(tenantId: string, id: string, rows: Array<Partial<HotelChannelMapping>>) {
    const c = await this.get(tenantId, id);
    const [types, groups, ourPlans] = await Promise.all([
      this.roomTypes.find({ where: { tenantId, hotelId: c.hotelId } }),
      this.groups.find({ where: { tenantId, hotelId: c.hotelId } }),
      this.ratePlans.find({ where: { tenantId, hotelId: c.hotelId } }),
    ]);
    const occ = types.length ? await this.occupancy.find({ where: { tenantId, roomTypeId: In(types.map((t) => t.id)) } }) : [];
    let plans: Array<HotelChannelRatePlanMeta & { id: string; roomTypeId: string | null }> = [];
    if (c.externalPropertyId && (rows || []).some((r) => r.externalRatePlanId)) {
      plans = await this.adapterFor(c).listRatePlans(c.externalPropertyId);
    }
    const seenPlans = new Set<string>();
    const clean = (Array.isArray(rows) ? rows : []).slice(0, 200).map((r) => {
      const rt = types.find((t) => t.id === r.roomTypeId);
      if (!rt) throw new BadRequestException({ code: 'HOTEL_CHANNEL_MAPPING', message: 'Тип номера не из этого отеля' });
      const ext = String(r.externalRoomTypeId || '').trim();
      if (!ext) throw new BadRequestException({ code: 'HOTEL_CHANNEL_MAPPING', message: 'Не выбран тип номера в канале' });
      const planId = r.externalRatePlanId ? String(r.externalRatePlanId).slice(0, 80) : null;
      if (planId && r.active !== false) {
        if (seenPlans.has(planId)) throw new BadRequestException({ code: 'HOTEL_CHANNEL_MAPPING_DUP', message: 'Один тариф канала сопоставлен дважды' });
        seenPlans.add(planId);
      }
      const plan = planId ? plans.find((p) => p.id === planId) : null;
      if (planId && plans.length && !plan) throw new BadRequestException({ code: 'HOTEL_CHANNEL_MAPPING', message: 'Тариф не найден в канале' });
      if (plan?.roomTypeId && plan.roomTypeId !== ext) throw new BadRequestException({ code: 'HOTEL_CHANNEL_MAPPING_PLAN', message: 'Тариф канала относится к другому типу номера' });
      const o = r.occupancyTypeId ? occ.find((x) => x.id === r.occupancyTypeId && x.roomTypeId === rt.id) : null;
      const our = r.ratePlanId ? ourPlans.find((x) => x.id === r.ratePlanId) : null;
      if (r.ratePlanId && !our) throw new BadRequestException({ code: 'HOTEL_CHANNEL_MAPPING', message: 'Наш тариф не из этого отеля' });
      if (our?.roomTypeIds?.length && !our.roomTypeIds.includes(rt.id)) throw new BadRequestException({ code: 'HOTEL_RATE_PLAN_ROOM', message: 'Наш тариф не действует для этого типа номера' });
      return this.mappings.create({
        tenantId,
        connectionId: c.id,
        roomTypeId: rt.id,
        occupancyTypeId: o?.id ?? null,
        marketGroupId: r.marketGroupId && groups.some((g) => g.id === r.marketGroupId) ? r.marketGroupId : null,
        externalRoomTypeId: ext.slice(0, 80),
        externalRatePlanId: planId,
        ratePlanId: planId ? our?.id ?? null : null,
        externalName: r.externalName ? String(r.externalName).slice(0, 255) : null,
        active: r.active !== false,
        ratePlanMeta: plan ? { sellMode: plan.sellMode, rateMode: plan.rateMode, occupancies: plan.occupancies } : null,
      });
    });
    await this.mappings.delete({ tenantId, connectionId: c.id });
    await this.mappings.save(clean);
    // сопоставление поменялось — следующая выгрузка сравнивает с нуля (все значения уйдут)
    await this.resetState(c);
    this.markRatesDirty(c.tenantId, c.hotelId);
    this.dirtyAvail.set(`${c.tenantId}|${c.hotelId}`, { tenantId: c.tenantId, hotelId: c.hotelId });
    return this.mappings.find({ where: { tenantId, connectionId: c.id } });
  }

  async logsOf(tenantId: string, id: string) {
    await this.get(tenantId, id);
    return this.logs.find({ where: { tenantId, connectionId: id }, order: { createdAt: 'DESC' }, take: 100 });
  }

  /** Сколько значений по дням уже принято каналом и когда — для экрана подключения */
  async stateOf(tenantId: string, id: string) {
    const c = await this.get(tenantId, id);
    const rows = await this.states
      .createQueryBuilder('s')
      .select('s.kind', 'kind')
      .addSelect('COUNT(*)', 'n')
      .addSelect('MAX(s.sentAt)', 'last')
      .addSelect('MAX(s.date)', 'until')
      .where('s.connectionId = :id', { id: c.id })
      .groupBy('s.kind')
      .getRawMany<{ kind: string; n: string; last: Date; until: string }>();
    const of = (k: string) => {
      const r = rows.find((x) => x.kind === k);
      return r ? { values: Number(r.n), lastSentAt: r.last, until: typeof r.until === 'string' ? r.until.slice(0, 10) : new Date(r.until).toISOString().slice(0, 10) } : { values: 0, lastSentAt: null, until: null };
    };
    return { availability: of('avail'), rates: of('rate'), lastFullSyncAt: c.lastFullSyncAt, lastDeltaAt: c.lastDeltaAt };
  }

  private async resetState(c: HotelChannelConnection) {
    if (c.id) await this.states.delete({ connectionId: c.id });
  }

  /* ---------- ARI: что должно быть в канале ---------- */

  /**
   * Желаемое состояние канала на pushDays дней от сегодняшней даты отеля: наличие по типу номера канала (свободно − резерв),
   * цена и ограничения по тарифу канала. Тариф «за человека» — цены по числу гостей из опций тарифа; производный тариф —
   * только ограничения (цену считает канал). Нет цены у ручного тарифа — стоп-продажа, а не 0.
   */
  async desired(c: HotelChannelConnection) {
    const hotel = await this.hotels.findOne({ where: { id: c.hotelId, tenantId: c.tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    const maps = await this.mappings.find({ where: { tenantId: c.tenantId, connectionId: c.id, active: true } });
    const start = hotelToday(hotel);
    const days = Math.min(500, Math.max(7, c.settings?.pushDays || DEFAULT_PUSH_DAYS));
    const dates = Array.from({ length: days }, (_, i) => addDaysIso(start, i));
    const avail = new Map<string, Map<string, AvailValue>>();
    const rates = new Map<string, Map<string, RateValue>>();
    if (!maps.length) return { dates, avail, rates };

    const reserve = Math.max(0, c.settings?.reserveRooms || 0);
    const roomIds = [...new Set(maps.map((m) => m.roomTypeId))];
    const occTypes = await this.occupancy.find({ where: { tenantId: c.tenantId, roomTypeId: In(roomIds) }, order: { sortOrder: 'ASC' } });

    // цены: per_room — по размещению сопоставления; per_person — по каждому числу гостей из опций тарифа
    const priceReq: AriPriceRequest[] = [];
    const planOcc = new Map<string, Array<{ occupancy: number; key: string }>>();
    for (const m of maps) {
      if (!m.externalRatePlanId) continue;
      const meta = m.ratePlanMeta;
      if (meta && meta.rateMode !== 'manual') continue;
      if (meta?.sellMode === 'per_person' && meta.occupancies.length) {
        const list: Array<{ occupancy: number; key: string }> = [];
        for (const n of meta.occupancies) {
          const o = matchOccupancyByAges(occTypes.filter((x) => x.roomTypeId === m.roomTypeId), n, []);
          if (!o) continue;
          const key = `${m.id}|${n}`;
          priceReq.push({ key, roomTypeId: m.roomTypeId, occupancyTypeId: o.id, marketGroupId: m.marketGroupId, ratePlanId: m.ratePlanId });
          list.push({ occupancy: n, key });
        }
        planOcc.set(m.id, list);
      } else {
        priceReq.push({ key: m.id, roomTypeId: m.roomTypeId, occupancyTypeId: m.occupancyTypeId, adults: m.occupancyTypeId ? null : 2, marketGroupId: m.marketGroupId, ratePlanId: m.ratePlanId });
      }
    }
    const snap = await this.ari.snapshot(c.tenantId, hotel, roomIds, dates, priceReq);
    const planIds = [...new Set(maps.map((m) => m.ratePlanId).filter((x): x is string => !!x))];
    const ourPlans = planIds.length ? await this.ratePlans.find({ where: { tenantId: c.tenantId, id: In(planIds) } }) : [];

    // наличие: тип номера канала может быть сопоставлен с одним нашим — берём первое сопоставление
    for (const m of maps) {
      if (avail.has(m.externalRoomTypeId)) continue;
      const free = snap.free.get(m.roomTypeId);
      const map = new Map<string, AvailValue>();
      for (const d of dates) map.set(d, { a: Math.max(0, (free?.get(d) ?? 0) - reserve) });
      avail.set(m.externalRoomTypeId, map);
    }

    for (const m of maps) {
      if (!m.externalRatePlanId || rates.has(m.externalRatePlanId)) continue;
      const restr = snap.restrictions.get(m.roomTypeId);
      const meta = m.ratePlanMeta;
      const derived = !!meta && meta.rateMode !== 'manual';
      const map = new Map<string, RateValue>();
      for (const d of dates) {
        const r: AriRestrictions = restr?.get(d) || { stop: false, closedToArrival: false, closedToDeparture: false, minStay: 1, maxStay: 0 };
        let price: number | null = null;
        let rs: string | null = null;
        if (!derived) {
          const occList = planOcc.get(m.id);
          if (occList) {
            const pairs = occList.map((x) => ({ occupancy: x.occupancy, rate: snap.prices.get(x.key)?.get(d) ?? null })).filter((x): x is { occupancy: number; rate: number } => !!x.rate && x.rate > 0);
            rs = pairs.length ? pairs.map((x) => `${x.occupancy}:${x.rate.toFixed(2)}`).join(',') : null;
          } else {
            price = snap.prices.get(m.id)?.get(d) ?? null;
          }
        }
        const noPrice = !derived && !(price && price > 0) && !rs;
        // минимум ночей — строже из периода / календаря и нашего тарифа; выключенный тариф не продаётся
        const our = m.ratePlanId ? ourPlans.find((x) => x.id === m.ratePlanId) : null;
        const msa = Math.max(r.minStay, our?.minNights || 1);
        map.set(d, { r: price && price > 0 ? price : null, rs, s: r.stop || noPrice || (!!our && !our.active), msa, max: r.maxStay, cta: r.closedToArrival, ctd: r.closedToDeparture });
      }
      rates.set(m.externalRatePlanId, map);
    }
    return { dates, avail, rates };
  }

  /* ---------- выгрузка ---------- */

  private allowCall(propertyId: string, endpoint: 'avail' | 'rate') {
    const key = `${propertyId}|${endpoint}`;
    const now = Date.now();
    const list = (this.calls.get(key) || []).filter((t) => now - t < 60_000);
    this.calls.set(key, list);
    return list.length < CALLS_PER_MINUTE;
  }

  private noteCall(propertyId: string, endpoint: 'avail' | 'rate', n: number) {
    const key = `${propertyId}|${endpoint}`;
    const list = this.calls.get(key) || [];
    for (let i = 0; i < n; i++) list.push(Date.now());
    this.calls.set(key, list);
  }

  /**
   * Синхронизация с каналом. delta — только отличия от принятого каналом; full — всё окно заново (раз в сутки / кнопка).
   * scope 'availability' — только наличие (после изменения броней).
   */
  async sync(c: HotelChannelConnection, mode: 'delta' | 'full', scope: 'all' | 'availability' = 'all'): Promise<ChannelSyncResult> {
    if (!c.externalPropertyId) throw new BadRequestException({ code: 'HOTEL_CHANNEL_PROPERTY', message: 'Выберите объект в канале' });
    if (this.running.has(c.id)) throw new BadRequestException({ code: 'HOTEL_CHANNEL_BUSY', message: 'Обмен с каналом уже идёт — повторите через минуту' });
    this.running.add(c.id);
    const res: ChannelSyncResult = { mode, availability: 0, rates: 0, calls: 0, taskIds: [], warnings: [], deferred: [] };
    try {
      const want = await this.desired(c);
      const start = want.dates[0];
      await this.states.delete({ connectionId: c.id, date: LessThan(start) });
      const prev = await this.states.find({ where: { connectionId: c.id } });
      const prevMap = new Map(prev.map((s) => [`${s.kind}|${s.externalId}|${s.date}`, s.value]));
      // сопоставление убрали — его состояние больше не нужно
      const staleIds = prev.filter((s) => (s.kind === 'avail' ? !want.avail.has(s.externalId) : !want.rates.has(s.externalId))).map((s) => s.id);
      for (let i = 0; i < staleIds.length; i += 1000) await this.states.delete({ id: In(staleIds.slice(i, i + 1000)) });

      const a = this.adapterFor(c);
      const propertyId = c.externalPropertyId;
      const accepted: Array<{ kind: 'avail' | 'rate'; externalId: string; date: string; value: Record<string, unknown> }> = [];

      // наличие
      const availItems: ChannelAvailabilityItem[] = [];
      const availSent: Array<{ externalId: string; from: string; to: string; dates: string[] }> = [];
      for (const [ext, map] of want.avail) {
        const changed = want.dates.filter((d) => mode === 'full' || !prevMap.has(`avail|${ext}|${d}`) || !sameAvail(prevMap.get(`avail|${ext}|${d}`) as AvailValue, map.get(d)!));
        for (const r of toRanges(changed, (d) => map.get(d)!, sameAvail)) {
          availItems.push({ externalRoomTypeId: ext, from: r.from, to: r.to, availability: r.value.a });
          availSent.push({ externalId: ext, from: r.from, to: r.to, dates: changed.filter((d) => d >= r.from && d <= r.to) });
        }
      }
      if (availItems.length) {
        if (!this.allowCall(propertyId, 'avail')) res.deferred.push('availability');
        else {
          const r = await a.pushAvailability(propertyId, availItems);
          this.noteCall(propertyId, 'avail', r.calls);
          res.calls += r.calls;
          res.taskIds.push(...r.taskIds);
          res.warnings.push(...r.warnings);
          res.availability = availItems.length;
          for (const s of availSent) {
            if (warned(r.warnings, s.externalId, s.from, s.to)) continue;
            for (const d of s.dates) accepted.push({ kind: 'avail', externalId: s.externalId, date: d, value: want.avail.get(s.externalId)!.get(d)! });
          }
        }
      }

      // цены и ограничения
      if (scope === 'all') {
        const rateItems: ChannelRateItem[] = [];
        const rateSent: Array<{ externalId: string; from: string; to: string; dates: string[] }> = [];
        for (const [ext, map] of want.rates) {
          const changed = want.dates.filter((d) => mode === 'full' || !prevMap.has(`rate|${ext}|${d}`) || !sameRate(prevMap.get(`rate|${ext}|${d}`) as RateValue, map.get(d)!));
          for (const r of toRanges(changed, (d) => map.get(d)!, sameRate)) {
            const v = r.value;
            rateItems.push({
              externalRatePlanId: ext,
              from: r.from,
              to: r.to,
              rate: v.s ? null : v.r,
              rates: !v.s && v.rs ? v.rs.split(',').map((p) => ({ occupancy: Number(p.split(':')[0]), rate: Number(p.split(':')[1]) })) : undefined,
              stopSell: v.s,
              minStayArrival: v.msa,
              maxStay: v.max,
              closedToArrival: v.cta,
              closedToDeparture: v.ctd,
            });
            rateSent.push({ externalId: ext, from: r.from, to: r.to, dates: changed.filter((d) => d >= r.from && d <= r.to) });
          }
        }
        if (rateItems.length) {
          if (!this.allowCall(propertyId, 'rate')) res.deferred.push('rates');
          else {
            const r = await a.pushRates(propertyId, rateItems);
            this.noteCall(propertyId, 'rate', r.calls);
            res.calls += r.calls;
            res.taskIds.push(...r.taskIds);
            res.warnings.push(...r.warnings);
            res.rates = rateItems.length;
            for (const s of rateSent) {
              if (warned(r.warnings, s.externalId, s.from, s.to)) continue;
              for (const d of s.dates) accepted.push({ kind: 'rate', externalId: s.externalId, date: d, value: want.rates.get(s.externalId)!.get(d)! });
            }
          }
        }
      }

      // принятые каналом значения — новое «последнее отправленное»
      const now = new Date();
      for (let i = 0; i < accepted.length; i += 1000) {
        await this.states
          .createQueryBuilder()
          .insert()
          .into(HotelChannelAriState)
          .values(accepted.slice(i, i + 1000).map((x) => ({ tenantId: c.tenantId, connectionId: c.id, kind: x.kind, externalId: x.externalId, date: x.date, value: x.value as any, sentAt: now })))
          .orUpdate(['value', 'sentAt'], ['connectionId', 'kind', 'externalId', 'date'])
          .execute();
      }

      c.lastPushAt = res.calls ? now : c.lastPushAt;
      if (scope === 'all' && !res.deferred.includes('rates')) c.lastDeltaAt = now;
      if (mode === 'full' && !res.deferred.length) c.lastFullSyncAt = now;
      c.lastError = res.warnings.length ? `Канал отклонил значений: ${res.warnings.length} — ${res.warnings[0].message}` : null;
      c.failCount = 0;
      c.backoffUntil = null;
      if (c.status === 'error') c.status = 'active';
      await this.connections.save(c);
      if (res.calls || res.warnings.length || res.deferred.length) {
        const parts = [
          mode === 'full' ? `Полная выгрузка на ${want.dates.length} дн.` : 'Изменения',
          `наличие ${res.availability}`,
          scope === 'all' ? `цены и ограничения ${res.rates}` : null,
          `вызовов ${res.calls}`,
          res.deferred.length ? `отложено из-за лимита: ${res.deferred.join(', ')}` : null,
          res.warnings.length ? `отклонено каналом: ${res.warnings.length}` : null,
        ].filter(Boolean);
        await this.addLog(c, 'push', !res.warnings.length, parts.join(' · '), { taskIds: res.taskIds, warnings: res.warnings.slice(0, 50), mode, scope });
      }
      return res;
    } catch (e) {
      await this.fail(c, 'push', e);
      throw e;
    } finally {
      this.running.delete(c.id);
    }
  }

  /** Кнопка «Отправить»: изменения (по умолчанию) или полная выгрузка */
  async push(tenantId: string, id: string, full = false) {
    const c = await this.get(tenantId, id);
    if (c.backoffUntil && c.backoffUntil > new Date() && !full) {
      throw new BadRequestException({ code: 'HOTEL_CHANNEL_PAUSED', message: 'Обмен на паузе после ошибки канала — дождитесь окончания паузы' });
    }
    // идёт фоновый обмен — дождаться его (до минуты), а не отказывать
    for (let i = 0; i < 120 && this.running.has(c.id); i++) await sleep(500);
    return this.sync(await this.get(tenantId, id), full ? 'full' : 'delta');
  }

  private async fail(c: HotelChannelConnection, kind: HotelChannelLog['kind'], e: unknown) {
    const msg = (e as any)?.response?.message || (e as Error).message || String(e);
    c.lastError = String(msg).slice(0, 1000);
    c.status = 'error';
    c.failCount = (c.failCount || 0) + 1;
    const pauseMs = e instanceof ChannelRateLimitError ? 60_000 : Math.min(15, 2 ** Math.max(0, c.failCount - 1)) * 60_000;
    c.backoffUntil = new Date(Date.now() + pauseMs);
    await this.connections.save(c);
    await this.addLog(c, kind, false, String(msg), { pauseMinutes: Math.round(pauseMs / 60_000) });
  }

  /* ---------- брони ---------- */

  /** Загрузка броней из канала. Ошибка одной брони не останавливает остальные; неподтверждённая придёт снова. */
  async pull(tenantId: string, id: string) {
    const c = await this.get(tenantId, id);
    if (!c.externalPropertyId) throw new BadRequestException({ code: 'HOTEL_CHANNEL_PROPERTY', message: 'Выберите объект в канале' });
    const a = this.adapterFor(c);
    let revisions: ChannelBookingRevision[];
    try {
      revisions = await a.fetchBookings(c.externalPropertyId);
    } catch (e) {
      await this.fail(c, 'pull', e);
      throw e;
    }
    const maps = await this.mappings.find({ where: { tenantId, connectionId: c.id } });
    let created = 0, modified = 0, cancelled = 0, failed = 0;
    for (const rev of revisions) {
      try {
        const r = await this.applyRevision(c, rev, maps);
        created += r.created;
        modified += r.modified;
        cancelled += r.cancelled;
        await a.ack(rev.revisionId);
      } catch (e) {
        failed++;
        await this.addLog(c, 'booking', false, `${rev.otaName || ''} ${rev.otaCode || rev.bookingId}: ${(e as any)?.response?.message || (e as Error).message}`, { bookingId: rev.bookingId, revisionId: rev.revisionId, status: rev.status });
      }
    }
    c.lastPullAt = new Date();
    if (!failed && c.status === 'error' && !(c.backoffUntil && c.backoffUntil > new Date())) {
      c.lastError = null;
      c.status = 'active';
    }
    await this.connections.save(c);
    if (revisions.length) await this.addLog(c, 'pull', failed === 0, `Броней из канала: новых ${created}, изменено ${modified}, отменено ${cancelled}${failed ? `, ошибок ${failed}` : ''}`);
    return { revisions: revisions.length, created, modified, cancelled, failed };
  }

  /** OTA брони — партнёр с типом «OTA» (создаётся при первой брони); на нём копятся брони, комиссия и выписки */
  private async otaAgency(tenantId: string, otaName: string | null) {
    const name = (otaName || '').trim().slice(0, 255);
    if (!name) return null;
    const found = await this.agencies
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('LOWER(a.name) = LOWER(:name)', { name })
      .getOne();
    if (found) return found;
    return this.agencies.save(this.agencies.create({ tenantId, name, type: 'ota', status: 'active', commissionPct: '0', paymentTerms: 'prepayment', notes: 'Создан автоматически по брони из менеджера каналов' }));
  }

  /** Одна ревизия: по комнате брони — своя бронь у нас (id брони канала + номер комнаты) */
  private async applyRevision(c: HotelChannelConnection, rev: ChannelBookingRevision, maps: HotelChannelMapping[]) {
    const out = { created: 0, modified: 0, cancelled: 0 };
    if (!ISO.test(rev.arrival) || !ISO.test(rev.departure) || rev.departure <= rev.arrival) throw new Error('неверные даты брони');
    const existing = await this.reservationsRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId AND r.channelConnectionId = :cid', { tenantId: c.tenantId, cid: c.id })
      .andWhere('(r.channelBookingId = :b OR r.channelBookingId LIKE :pref)', { b: rev.bookingId, pref: `${rev.bookingId}#%` })
      .getMany();
    const cancel = async (r: HotelReservation, why: string) => {
      if (r.status === 'cancelled') return;
      await this.reservations.update(c.tenantId, r.id, { status: 'cancelled', notes: [r.notes, why].filter(Boolean).join('\n') }, null, { skipValidation: true, allowClosed: true });
      out.cancelled++;
    };
    if (rev.status === 'cancelled') {
      for (const r of existing) await cancel(r, `Отменено в канале ${rev.otaName || ''}`.trim());
      return out;
    }
    const nights = Math.round((Date.parse(rev.departure) - Date.parse(rev.arrival)) / 86_400_000);
    const rooms = rev.rooms.length ? rev.rooms : [{ externalRoomTypeId: null, externalRatePlanId: null, amount: rev.amount, days: {}, adults: 1, childAges: [] }];
    // ключ номера брони стабилен между ревизиями: «B» у брони на один номер, «B#n» — на несколько; если номеров стало
    // меньше или больше, уже существующие ключи сохраняются (иначе изменение отменило бы бронь и создало новую)
    const hasKey = (k: string) => existing.some((r) => r.channelBookingId === k);
    const keyFor = (i: number) => {
      const hash = `${rev.bookingId}#${i + 1}`;
      if (hasKey(hash)) return hash;
      if (i === 0 && hasKey(rev.bookingId)) return rev.bookingId;
      return rooms.length > 1 || existing.some((r) => (r.channelBookingId || '').startsWith(`${rev.bookingId}#`)) ? hash : rev.bookingId;
    };
    // сначала проверяем все комнаты — бронь из нескольких номеров не должна записаться наполовину
    const plan = rooms.map((room, i) => {
      const map =
        (room.externalRatePlanId && maps.find((m) => m.externalRatePlanId === room.externalRatePlanId)) ||
        (room.externalRoomTypeId && maps.find((m) => m.externalRoomTypeId === room.externalRoomTypeId)) ||
        null;
      if (!map) throw new Error(`номер ${i + 1}: тип номера / тариф канала ${room.externalRoomTypeId || room.externalRatePlanId || '—'} не сопоставлен`);
      return { room, map, key: keyFor(i) };
    });
    const agency = await this.otaAgency(c.tenantId, rev.otaName);
    const commissionPct = rev.otaCommission > 0 && rev.amount > 0 ? round2((rev.otaCommission / rev.amount) * 100) : null;

    for (const { room, map, key } of plan) {
      const amount = room.amount || (rooms.length === 1 ? rev.amount : 0);
      // цена по ночам из канала — итог брони совпадает с суммой OTA до копейки
      const dayEntries = Object.entries(room.days).filter(([d]) => ISO.test(d) && d >= rev.arrival && d < rev.departure).sort(([x], [y]) => x.localeCompare(y));
      const channelNights: HotelNightlyRate[] | undefined = dayEntries.length === nights ? dayEntries.map(([date, price]) => ({ date, price: round2(price), source: 'channel' })) : undefined;
      const dto = {
        hotelId: c.hotelId,
        roomTypeId: map.roomTypeId,
        guestName: rev.guest.name,
        guestEmail: rev.guest.email,
        guestPhone: rev.guest.phone,
        guestCountry: rev.guest.country,
        checkIn: rev.arrival,
        checkOut: rev.departure,
        adults: room.adults,
        childAges: room.childAges,
        priceMode: 'manual' as const,
        grossPerNight: String(round2(nights > 0 ? amount / nights : amount)),
        ppPerNight: '0',
        discountPct: '0',
        agencyId: agency?.id ?? null,
        ...(commissionPct !== null ? { commissionPct: String(commissionPct) } : {}),
        accommodationFolio: agency && rev.paymentCollect === 'ota' ? ('partner' as const) : ('guest' as const),
        paymentCollect: rev.paymentCollect,
        channelPaymentType: rev.paymentType,
        notes: [rev.otaName && `${rev.otaName}${rev.otaCode ? ` · ${rev.otaCode}` : ''}`, rev.paymentCollect === 'ota' ? 'Оплата через OTA' : null, rev.notes].filter(Boolean).join('\n') || null,
      };
      const cur = existing.find((r) => r.channelBookingId === key);
      if (cur) {
        await this.reservations.update(c.tenantId, cur.id, { ...dto, ...(cur.status === 'cancelled' ? { status: 'confirmed' as const } : {}) } as any, null, { skipValidation: true, allowClosed: true, channelNights });
        out.modified++;
      } else {
        // бронь из канала — уже факт продажи: создаём даже при овербукинге (его покажет шахматка)
        const saved = await this.reservations.create(
          c.tenantId,
          { ...dto, status: 'confirmed', source: 'channel', channelConnectionId: c.id, channelBookingId: key, otaName: rev.otaName, otaCode: rev.otaCode } as any,
          null,
          { skipValidation: true, channelNights },
        );
        if (!saved) throw new Error('бронь не создана');
        out.created++;
      }
    }
    // в изменённой брони стало меньше номеров — лишние отменяем
    const keys = new Set(plan.map((p) => p.key));
    for (const r of existing) if (!keys.has(r.channelBookingId || '')) await cancel(r, `Номер убран из брони в канале ${rev.otaName || ''}`.trim());
    return out;
  }

  /* ---------- планировщик ---------- */

  /** Брони из каналов — раз в 5 минут (запасной путь к вебхуку) */
  async pullAllDue() {
    const list = await this.connections.find({ where: { status: In(['active', 'error']) } });
    let n = 0;
    for (const c of list) {
      if (!c.externalPropertyId) continue;
      try {
        const r = await this.pull(c.tenantId, c.id);
        n += r.created + r.modified + r.cancelled;
      } catch (e) {
        this.log.warn(`channel pull ${c.id}: ${(e as Error).message}`);
      }
    }
    return n;
  }

  /**
   * Каждую минуту: по каждому подключению (не на паузе) — полная выгрузка ночью раз в сутки, иначе изменения цен /
   * ограничений раз в 5 минут или сразу после правки, иначе наличие, если поменялась занятость. Между объектами — пауза.
   */
  async tick(now = new Date()) {
    const list = await this.connections.find({ where: { status: In(['active', 'error']) } });
    const hotels = list.length ? await this.hotels.find({ where: { id: In([...new Set(list.map((c) => c.hotelId))]) } }) : [];
    const availDirty = new Set(this.dirtyAvail.keys());
    const ratesDirty = new Set(this.dirtyRates);
    this.dirtyAvail.clear();
    this.dirtyRates.clear();
    let synced = 0;
    for (const c of list) {
      if (!c.externalPropertyId) continue;
      const key = `${c.tenantId}|${c.hotelId}`;
      if (c.backoffUntil && c.backoffUntil > now) {
        // на паузе: отметки «изменилось» не теряем
        if (availDirty.has(key)) this.dirtyAvail.set(key, { tenantId: c.tenantId, hotelId: c.hotelId });
        if (ratesDirty.has(key)) this.dirtyRates.add(key);
        continue;
      }
      const hotel = hotels.find((h) => h.id === c.hotelId);
      const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: hotel?.timezone || 'Europe/Istanbul', hour: '2-digit', hourCycle: 'h23' }).format(now));
      const fullDue = FULL_SYNC_HOURS.includes(hour) && (!c.lastFullSyncAt || now.getTime() - c.lastFullSyncAt.getTime() > FULL_SYNC_MIN_GAP_MS);
      const ratesDue = ratesDirty.has(key) || !c.lastDeltaAt || now.getTime() - c.lastDeltaAt.getTime() >= RATES_CHECK_MS;
      const availDue = availDirty.has(key);
      if (!fullDue && !ratesDue && !availDue) continue;
      try {
        const r = await this.sync(c, fullDue ? 'full' : 'delta', fullDue || ratesDue ? 'all' : 'availability');
        // отложено лимитом — повторить в следующую минуту
        if (r.deferred.includes('availability')) this.dirtyAvail.set(key, { tenantId: c.tenantId, hotelId: c.hotelId });
        if (r.deferred.includes('rates')) this.dirtyRates.add(key);
        if (r.calls) {
          synced++;
          await sleep(3000);
        }
      } catch (e) {
        if (availDue) this.dirtyAvail.set(key, { tenantId: c.tenantId, hotelId: c.hotelId });
        this.log.warn(`channel sync ${c.id}: ${(e as Error).message}`);
      }
    }
    return synced;
  }

  /** Журнал не растёт бесконечно: старше 30 дней — удаляем */
  async cleanupLogs() {
    await this.logs.delete({ createdAt: LessThan(new Date(Date.now() - 30 * 86_400_000)) });
  }
}
