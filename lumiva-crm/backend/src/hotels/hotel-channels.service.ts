import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomOccupancyType } from './hotel-room-occupancy-type.entity';
import { HotelMarketGroup } from './hotel-market-group.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelRoomDateOverride } from './hotel-room-date-override.entity';
import { HotelRoomStopSaleDate } from './hotel-room-stop-sale-date.entity';
import { HotelChannelConnection, HotelChannelLog, HotelChannelMapping, HotelChannelSettings } from './hotel-channel.entities';
import { ChannelAdapter, ChannelAvailabilityItem, ChannelBookingRevision, ChannelRateItem, ChannexAdapter, channexBaseUrl } from './hotel-channel-adapters';
import { HotelContractsService } from './hotel-contracts.service';
import { HotelAvailabilityService } from './hotel-availability.service';
import { HotelRateEngineService } from './hotel-rate-engine.service';
import { HotelReservationsService } from './hotel-reservations.service';
import { HotelLiveService } from './hotel-live.service';
import { decryptSecret, encryptSecret, maskSecret } from '../hotel-reputation/reputation-crypto.util';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const todayUtc = () => new Date().toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Соседние дни с одинаковым значением → один диапазон date_from..date_to (включительно) */
function ranges<T>(dates: string[], valueOf: (d: string) => T, same: (a: T, b: T) => boolean) {
  const out: Array<{ from: string; to: string; value: T }> = [];
  for (const d of dates) {
    const v = valueOf(d);
    const last = out[out.length - 1];
    if (last && same(last.value, v) && addDays(last.to, 1) === d) last.to = d;
    else out.push({ from: d, to: d, value: v });
  }
  return out;
}

/**
 * Менеджер каналов (PMS ↔ OTA через channel manager):
 * — выгрузка наличия (свободно − OOO − резерв) и цен по датам из нашего прайса (тот же расчёт, что у брони);
 *   дней без цены не продаём (stop_sell), а не отдаём 0;
 * — загрузка броней из ленты ревизий: новая → бронь, изменённая → правка, отменённая → отмена; подтверждение (ack)
 *   только после успешной записи — иначе ревизия придёт снова;
 * — изменения броней/OOO у нас помечают отель «грязным», наличие уходит в канал в течение минуты.
 */
@Injectable()
export class HotelChannelsService implements OnModuleInit {
  private readonly log = new Logger(HotelChannelsService.name);
  /** отели, у которых поменялась занятость — выгрузить наличие при ближайшем проходе */
  private readonly dirty = new Map<string, { tenantId: string; hotelId: string }>();

  constructor(
    @InjectRepository(HotelChannelConnection) private readonly connections: Repository<HotelChannelConnection>,
    @InjectRepository(HotelChannelMapping) private readonly mappings: Repository<HotelChannelMapping>,
    @InjectRepository(HotelChannelLog) private readonly logs: Repository<HotelChannelLog>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelRoomType) private readonly roomTypes: Repository<HotelRoomType>,
    @InjectRepository(HotelRoomOccupancyType) private readonly occupancy: Repository<HotelRoomOccupancyType>,
    @InjectRepository(HotelMarketGroup) private readonly groups: Repository<HotelMarketGroup>,
    @InjectRepository(HotelReservation) private readonly reservationsRepo: Repository<HotelReservation>,
    @InjectRepository(HotelRoomDateOverride) private readonly overrides: Repository<HotelRoomDateOverride>,
    @InjectRepository(HotelRoomStopSaleDate) private readonly stopDates: Repository<HotelRoomStopSaleDate>,
    private readonly contracts: HotelContractsService,
    private readonly availability: HotelAvailabilityService,
    private readonly rates: HotelRateEngineService,
    private readonly reservations: HotelReservationsService,
    private readonly live: HotelLiveService,
  ) {}

  onModuleInit() {
    this.live.onEvent((tenantId, e) => {
      if (e.type === 'changed' && (e.entity === 'reservation' || e.entity === 'outage') && e.hotelId) {
        this.dirty.set(`${tenantId}|${e.hotelId}`, { tenantId, hotelId: e.hotelId });
      }
    });
  }

  adapterFor(c: HotelChannelConnection): ChannelAdapter {
    const key = decryptSecret(c.apiKeyEnc);
    if (!key) throw new BadRequestException({ code: 'HOTEL_CHANNEL_NO_KEY', message: 'Не задан ключ API канала' });
    return new ChannexAdapter(key, channexBaseUrl(c.environment));
  }

  private view(c: HotelChannelConnection, mappings: HotelChannelMapping[] = []) {
    const { apiKeyEnc, ...rest } = c;
    return { ...rest, apiKeyMasked: maskSecret(apiKeyEnc), mappings };
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
    c = c || this.connections.create({ tenantId, hotelId: hotel.id, provider: 'channex', settings: { pushDays: 365, reserveRooms: 0 } });
    c.environment = environment;
    if (apiKey) c.apiKeyEnc = encryptSecret(apiKey);
    if (prop) { c.externalPropertyId = prop.id; c.externalPropertyName = prop.title; }
    c.status = 'active';
    c.lastError = null;
    const saved = await this.connections.save(c);
    await this.addLog(saved, 'test', true, `Ключ принят, объектов в канале: ${properties.length}`);
    return { connection: this.view(saved), properties };
  }

  async update(tenantId: string, id: string, dto: { status?: string; settings?: HotelChannelSettings; externalPropertyId?: string }) {
    const c = await this.get(tenantId, id);
    if (dto.status === 'paused' || dto.status === 'active') c.status = dto.status;
    if (dto.settings) {
      c.settings = {
        pushDays: Math.min(365, Math.max(7, Math.round(Number(dto.settings.pushDays ?? c.settings.pushDays ?? 365)))),
        reserveRooms: Math.min(50, Math.max(0, Math.round(Number(dto.settings.reserveRooms ?? c.settings.reserveRooms ?? 0)))),
      };
    }
    if (dto.externalPropertyId !== undefined) {
      const props = await this.adapterFor(c).listProperties();
      const p = props.find((x) => x.id === dto.externalPropertyId);
      if (!p) throw new BadRequestException({ code: 'HOTEL_CHANNEL_PROPERTY', message: 'Объект не найден в канале' });
      c.externalPropertyId = p.id;
      c.externalPropertyName = p.title;
    }
    return this.view(await this.connections.save(c));
  }

  async remove(tenantId: string, id: string) {
    const c = await this.get(tenantId, id);
    await this.connections.remove(c);
    return { ok: true };
  }

  /** Типы номеров и тарифы объекта в канале — для сопоставления */
  async remote(tenantId: string, id: string) {
    const c = await this.get(tenantId, id);
    const a = this.adapterFor(c);
    // объект ещё не выбран (в аккаунте их несколько) — отдаём список объектов для выбора
    if (!c.externalPropertyId) return { properties: await a.listProperties(), roomTypes: [], ratePlans: [] };
    const [properties, roomTypes, ratePlans] = await Promise.all([a.listProperties(), a.listRoomTypes(c.externalPropertyId), a.listRatePlans(c.externalPropertyId)]);
    return { properties, roomTypes, ratePlans };
  }

  /** Сопоставления заменяются целиком; тип номера, размещение и группа — только этого отеля */
  async saveMappings(tenantId: string, id: string, rows: Array<Partial<HotelChannelMapping>>) {
    const c = await this.get(tenantId, id);
    const [types, groups] = await Promise.all([
      this.roomTypes.find({ where: { tenantId, hotelId: c.hotelId } }),
      this.groups.find({ where: { tenantId, hotelId: c.hotelId } }),
    ]);
    const occ = types.length ? await this.occupancy.find({ where: { tenantId, roomTypeId: In(types.map((t) => t.id)) } }) : [];
    const clean = (Array.isArray(rows) ? rows : []).slice(0, 100).map((r) => {
      const rt = types.find((t) => t.id === r.roomTypeId);
      if (!rt) throw new BadRequestException({ code: 'HOTEL_CHANNEL_MAPPING', message: 'Тип номера не из этого отеля' });
      const ext = String(r.externalRoomTypeId || '').trim();
      if (!ext) throw new BadRequestException({ code: 'HOTEL_CHANNEL_MAPPING', message: 'Не выбран тип номера в канале' });
      const o = r.occupancyTypeId ? occ.find((x) => x.id === r.occupancyTypeId && x.roomTypeId === rt.id) : null;
      return this.mappings.create({
        tenantId,
        connectionId: c.id,
        roomTypeId: rt.id,
        occupancyTypeId: o?.id ?? null,
        marketGroupId: r.marketGroupId && groups.some((g) => g.id === r.marketGroupId) ? r.marketGroupId : null,
        externalRoomTypeId: ext.slice(0, 80),
        externalRatePlanId: r.externalRatePlanId ? String(r.externalRatePlanId).slice(0, 80) : null,
        externalName: r.externalName ? String(r.externalName).slice(0, 255) : null,
        active: r.active !== false,
      });
    });
    await this.mappings.delete({ tenantId, connectionId: c.id });
    await this.mappings.save(clean);
    return this.mappings.find({ where: { tenantId, connectionId: c.id } });
  }

  async logsOf(tenantId: string, id: string) {
    await this.get(tenantId, id);
    return this.logs.find({ where: { tenantId, connectionId: id }, order: { createdAt: 'DESC' }, take: 100 });
  }

  /**
   * Что уйдёт в канал на даты: наличие по типу номера канала (свободно по квотам/блокам − OOO − резерв, минимум 0)
   * и цена по тарифу канала (наш прайс по размещению/группе, как у брони). Без цены или со стопом — stop_sell.
   */
  async buildAri(c: HotelChannelConnection, onlyAvailability = false) {
    const maps = (await this.mappings.find({ where: { tenantId: c.tenantId, connectionId: c.id, active: true } })) || [];
    if (!maps.length) return { availability: [] as ChannelAvailabilityItem[], rates: [] as ChannelRateItem[], dates: 0 };
    const start = todayUtc();
    const days = Math.min(365, Math.max(7, c.settings?.pushDays || 365));
    const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
    const reserve = Math.max(0, c.settings?.reserveRooms || 0);

    // свободно по дням: тот же расчёт, что «Квоты и блоки» (продано, держат блоки и гарантированные квоты), окнами по 120 ночей
    const free = new Map<string, number>();
    for (let i = 0; i < dates.length; i += 120) {
      const from = dates[i];
      const to = addDays(dates[Math.min(dates.length - 1, i + 119)], 1);
      const inv = await this.contracts.inventory(c.tenantId, c.hotelId, from, to);
      for (const row of inv.rows) for (const d of row.days) free.set(`${row.roomTypeId}|${d.date}`, d.free);
    }
    const typeIds = [...new Set(maps.map((m) => m.roomTypeId))];
    const types = await this.roomTypes.find({ where: { tenantId: c.tenantId, id: In(typeIds) } });
    const ooo = new Map<string, (d: string) => number>();
    for (const t of types) ooo.set(t.id, await this.availability.oooCounter(c.tenantId, t.id, start, addDays(start, days), true));

    // тип номера канала может быть сопоставлен с одним нашим — наличие берём по первому сопоставлению
    const availability: ChannelAvailabilityItem[] = [];
    const seenExt = new Set<string>();
    for (const m of maps) {
      if (seenExt.has(m.externalRoomTypeId)) continue;
      seenExt.add(m.externalRoomTypeId);
      const avail = (d: string) => Math.max(0, (free.get(`${m.roomTypeId}|${d}`) ?? 0) - (ooo.get(m.roomTypeId)?.(d) ?? 0) - reserve);
      for (const r of ranges(dates, avail, (a, b) => a === b)) availability.push({ externalRoomTypeId: m.externalRoomTypeId, from: r.from, to: r.to, availability: r.value });
    }
    if (onlyAvailability) return { availability, rates: [] as ChannelRateItem[], dates: dates.length };

    const rates: ChannelRateItem[] = [];
    for (const m of maps) {
      if (!m.externalRatePlanId) continue;
      const rt = types.find((t) => t.id === m.roomTypeId);
      const [stops, ovs] = await Promise.all([
        this.stopDates.find({ where: { tenantId: c.tenantId, roomTypeId: m.roomTypeId } }),
        this.overrides.find({ where: { tenantId: c.tenantId, roomTypeId: m.roomTypeId, blocked: true } }),
      ]);
      const stopSet = new Set([...stops.map((s) => s.date), ...ovs.map((o) => o.date)]);
      const q = await this.rates.quote(c.tenantId, {
        roomTypeId: m.roomTypeId,
        occupancyTypeId: m.occupancyTypeId,
        checkIn: start,
        checkOut: addDays(start, days),
        marketGroupId: m.marketGroupId,
      });
      const priceOf = new Map(q.nights.map((n) => [n.date, n.price]));
      const val = (d: string) => {
        const p = round2(priceOf.get(d) || 0);
        return { rate: p > 0 ? p : null, stop: !!rt?.stopSale || stopSet.has(d) || !(p > 0) };
      };
      for (const r of ranges(dates, val, (a, b) => a.rate === b.rate && a.stop === b.stop)) {
        rates.push({ externalRatePlanId: m.externalRatePlanId, from: r.from, to: r.to, rate: r.value.rate, stopSell: r.value.stop });
      }
    }
    return { availability, rates, dates: dates.length };
  }

  /** Выгрузка в канал: всё (цены + наличие) или только наличие (после изменения броней) */
  async push(tenantId: string, id: string, onlyAvailability = false) {
    const c = await this.get(tenantId, id);
    if (!c.externalPropertyId) throw new BadRequestException({ code: 'HOTEL_CHANNEL_PROPERTY', message: 'Выберите объект в канале' });
    try {
      const ari = await this.buildAri(c, onlyAvailability);
      const a = this.adapterFor(c);
      if (ari.availability.length) await a.pushAvailability(c.externalPropertyId, ari.availability);
      if (ari.rates.length) await a.pushRates(c.externalPropertyId, ari.rates);
      c.lastPushAt = new Date();
      c.lastError = null;
      if (c.status === 'error') c.status = 'active';
      await this.connections.save(c);
      const stops = ari.rates.filter((r) => r.stopSell).length;
      await this.addLog(c, 'push', true, onlyAvailability ? `Наличие: ${ari.availability.length} диапазонов` : `Цены и наличие на ${ari.dates} дн.: наличие ${ari.availability.length}, цены ${ari.rates.length} диапазонов (стоп/без цены: ${stops})`);
      return { ok: true, availability: ari.availability.length, rates: ari.rates.length, stops };
    } catch (e) {
      await this.fail(c, 'push', e);
      throw e;
    }
  }

  private async fail(c: HotelChannelConnection, kind: HotelChannelLog['kind'], e: unknown) {
    const msg = (e as any)?.response?.message || (e as Error).message || String(e);
    c.lastError = String(msg).slice(0, 1000);
    c.status = 'error';
    await this.connections.save(c);
    await this.addLog(c, kind, false, String(msg));
  }

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
        created += r.created; modified += r.modified; cancelled += r.cancelled;
        await a.ack(rev.revisionId);
      } catch (e) {
        failed++;
        await this.addLog(c, 'booking', false, `${rev.otaName || ''} ${rev.otaCode || rev.bookingId}: ${(e as any)?.response?.message || (e as Error).message}`, { bookingId: rev.bookingId, status: rev.status });
      }
    }
    c.lastPullAt = new Date();
    if (!failed) { c.lastError = null; if (c.status === 'error') c.status = 'active'; }
    await this.connections.save(c);
    if (revisions.length) await this.addLog(c, 'pull', failed === 0, `Броней из канала: новых ${created}, изменено ${modified}, отменено ${cancelled}${failed ? `, ошибок ${failed}` : ''}`);
    return { revisions: revisions.length, created, modified, cancelled, failed };
  }

  /** Одна ревизия: по комнате брони — своя бронь у нас (id брони канала + номер комнаты) */
  private async applyRevision(c: HotelChannelConnection, rev: ChannelBookingRevision, maps: HotelChannelMapping[]) {
    const out = { created: 0, modified: 0, cancelled: 0 };
    if (!ISO.test(rev.arrival) || !ISO.test(rev.departure) || rev.departure <= rev.arrival) throw new Error('неверные даты брони');
    const existing = await this.reservationsRepo.find({ where: { tenantId: c.tenantId, channelConnectionId: c.id, channelBookingId: In([rev.bookingId, ...rev.rooms.map((_, i) => `${rev.bookingId}#${i + 1}`)]) } });
    if (rev.status === 'cancelled') {
      for (const r of existing) {
        if (r.status === 'cancelled') continue;
        await this.reservations.update(c.tenantId, r.id, { status: 'cancelled', notes: [r.notes, `Отменено в канале ${rev.otaName || ''}`.trim()].filter(Boolean).join('\n') }, null, { skipValidation: true, allowClosed: true });
        out.cancelled++;
      }
      return out;
    }
    const nights = Math.round((Date.parse(rev.departure) - Date.parse(rev.arrival)) / 86_400_000);
    const rooms = rev.rooms.length ? rev.rooms : [{ externalRoomTypeId: '', externalRatePlanId: null, amount: rev.amount, days: {}, adults: 1, childAges: [] }];
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const bookingKey = rooms.length > 1 ? `${rev.bookingId}#${i + 1}` : rev.bookingId;
      const map = maps.find((m) => m.externalRoomTypeId === room.externalRoomTypeId && (!room.externalRatePlanId || !m.externalRatePlanId || m.externalRatePlanId === room.externalRatePlanId))
        || maps.find((m) => m.externalRoomTypeId === room.externalRoomTypeId);
      if (!map) throw new Error(`тип номера канала ${room.externalRoomTypeId || '—'} не сопоставлен`);
      const amount = room.amount || (rooms.length === 1 ? rev.amount : 0);
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
        notes: [rev.otaName && `${rev.otaName}${rev.otaCode ? ` · ${rev.otaCode}` : ''}`, rev.notes].filter(Boolean).join('\n') || null,
      };
      const cur = existing.find((r) => r.channelBookingId === bookingKey);
      if (cur) {
        await this.reservations.update(c.tenantId, cur.id, { ...dto, ...(cur.status === 'cancelled' ? { status: 'confirmed' as const } : {}) }, null, { skipValidation: true, allowClosed: true });
        out.modified++;
      } else {
        // бронь из канала — уже факт продажи: создаём даже при овербукинге (его покажет шахматка)
        const saved = await this.reservations.create(c.tenantId, { ...dto, status: 'confirmed', source: 'channel', channelConnectionId: c.id, channelBookingId: bookingKey, otaName: rev.otaName, otaCode: rev.otaCode }, null, { skipValidation: true });
        if (!saved) throw new Error('бронь не создана');
        out.created++;
      }
    }
    return out;
  }

  /** Планировщик: брони из каналов каждые 5 минут */
  async pullAllDue() {
    const list = await this.connections.find({ where: { status: In(['active', 'error']) } });
    let n = 0;
    for (const c of list) {
      if (!c.externalPropertyId) continue;
      try { const r = await this.pull(c.tenantId, c.id); n += r.created + r.modified + r.cancelled; } catch (e) { this.log.warn(`channel pull ${c.id}: ${(e as Error).message}`); }
    }
    return n;
  }

  /** Планировщик: наличие отелей, где поменялась занятость (раз в минуту) */
  async pushDirty() {
    const items = [...this.dirty.values()];
    this.dirty.clear();
    let n = 0;
    for (const it of items) {
      const list = await this.connections.find({ where: { tenantId: it.tenantId, hotelId: it.hotelId, status: In(['active', 'error']) } });
      for (const c of list) {
        if (!c.externalPropertyId) continue;
        try { await this.push(c.tenantId, c.id, true); n++; } catch (e) { this.log.warn(`channel availability ${c.id}: ${(e as Error).message}`); }
      }
    }
    return n;
  }

  /** Планировщик: полная выгрузка цен и наличия (раз в 30 минут) */
  async pushAllFull() {
    const list = await this.connections.find({ where: { status: In(['active', 'error']) } });
    for (const c of list) {
      if (!c.externalPropertyId) continue;
      try { await this.push(c.tenantId, c.id); } catch (e) { this.log.warn(`channel push ${c.id}: ${(e as Error).message}`); }
    }
  }

  /** Журнал не растёт бесконечно: старше 30 дней — удаляем */
  async cleanupLogs() {
    await this.logs.delete({ createdAt: LessThan(new Date(Date.now() - 30 * 86_400_000)) });
  }
}
