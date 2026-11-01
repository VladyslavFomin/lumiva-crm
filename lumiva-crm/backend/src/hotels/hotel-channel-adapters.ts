import { BadRequestException } from '@nestjs/common';
import type { HotelChannelRatePlanMeta } from './hotel-channel.entities';

/** Что менеджер каналов отдаёт о брони — уже в нашем виде (адаптер переводит из формата провайдера) */
export interface ChannelBookingRoom {
  /** null — тип номера / тариф в канале не сопоставлен с объектом */
  externalRoomTypeId: string | null;
  externalRatePlanId: string | null;
  amount: number;
  /** цена по ночам, если провайдер её отдаёт */
  days: Record<string, number>;
  adults: number;
  /** возрасты детей; младенцы канала — возраст 0 (бесплатно, нужна кроватка) */
  childAges: Array<number | null>;
}

export interface ChannelBookingRevision {
  /** id ревизии — подтверждаем (ack) после успешной записи */
  revisionId: string;
  /** id брони в канале — один и тот же у new/modified/cancelled */
  bookingId: string;
  status: 'new' | 'modified' | 'cancelled';
  arrival: string;
  departure: string;
  otaName: string | null;
  otaCode: string | null;
  currency: string | null;
  amount: number;
  /** комиссия OTA по брони (сумма) */
  otaCommission: number;
  /** кто берёт оплату: property — отель, ota — сама OTA (Expedia Collect, Booking Payments) */
  paymentCollect: 'property' | 'ota' | null;
  paymentType: string | null;
  guest: { name: string; email: string | null; phone: string | null; country: string | null };
  notes: string | null;
  rooms: ChannelBookingRoom[];
}

export interface ChannelRemoteRoomType { id: string; title: string; rooms: number | null }
export interface ChannelRemoteRatePlan extends HotelChannelRatePlanMeta { id: string; title: string; roomTypeId: string | null; currency: string | null }
export interface ChannelAvailabilityItem { externalRoomTypeId: string; from: string; to: string; availability: number }

/** Цена и ограничения тарифа на диапазон дат (включительно) */
export interface ChannelRateItem {
  externalRatePlanId: string;
  from: string;
  to: string;
  /** цена за номер (per_room); null — не отправлять цену (производный тариф или стоп) */
  rate: number | null;
  /** цены по числу гостей (per_person) */
  rates?: Array<{ occupancy: number; rate: number }>;
  stopSell: boolean;
  minStayArrival: number;
  maxStay: number;
  closedToArrival: boolean;
  closedToDeparture: boolean;
}

/** Отклонённое каналом значение (ответ 200 с meta.warnings): по чему его узнать и что не так */
export interface ChannelWarning {
  externalId: string | null;
  from: string | null;
  to: string | null;
  message: string;
}

export interface ChannelPushResult { taskIds: string[]; warnings: ChannelWarning[]; calls: number }

export interface ChannelAdapter {
  listProperties(): Promise<Array<{ id: string; title: string; currency: string | null; timezone: string | null }>>;
  listRoomTypes(propertyId: string): Promise<ChannelRemoteRoomType[]>;
  listRatePlans(propertyId: string): Promise<ChannelRemoteRatePlan[]>;
  pushAvailability(propertyId: string, items: ChannelAvailabilityItem[]): Promise<ChannelPushResult>;
  pushRates(propertyId: string, items: ChannelRateItem[]): Promise<ChannelPushResult>;
  fetchBookings(propertyId: string): Promise<ChannelBookingRevision[]>;
  ack(revisionId: string): Promise<void>;
  createWebhook(propertyId: string, callbackUrl: string, secret: string): Promise<string>;
  deleteWebhook(webhookId: string): Promise<void>;
}

/** Адреса Channex: только официальные хосты (ключ клиента не уходит на произвольный адрес — защита от SSRF).
 * CHANNEX_TEST_BASE_URL — для стенда с имитацией API, на проде не задаётся. */
export function channexBaseUrl(environment: string) {
  if (environment === 'test' && process.env.CHANNEX_TEST_BASE_URL) return process.env.CHANNEX_TEST_BASE_URL.replace(/\/$/, '');
  return environment === 'staging' ? 'https://staging.channex.io/api/v1' : 'https://app.channex.io/api/v1';
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
/** Channex принимает до 10 МБ в одном вызове — режем только если тело больше ~9 МБ */
const MAX_BODY = 9 * 1024 * 1024;
/** лента ревизий: максимум 100 за страницу; за один проход — не больше 10 страниц */
const FEED_LIMIT = 100;
const FEED_PAGES = 10;

/** Ошибка лимита запросов канала (429) — сервис ставит обмен с объектом на паузу */
export class ChannelRateLimitError extends BadRequestException {
  constructor() {
    super({ code: 'HOTEL_CHANNEL_RATE_LIMIT', message: 'Канал ограничил частоту запросов (429) — обмен приостановлен на минуту' });
  }
}

/** Значения → куски, каждый не больше MAX_BODY байт в JSON */
function chunkBySize<T>(values: T[]): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let size = 20;
  for (const v of values) {
    const s = JSON.stringify(v).length + 1;
    if (cur.length && size + s > MAX_BODY) {
      out.push(cur);
      cur = [];
      size = 20;
    }
    cur.push(v);
    size += s;
  }
  if (cur.length) out.push(cur);
  return out;
}

function warningText(w: any): string {
  const src = w?.warning ?? w?.errors ?? w?.error ?? w;
  if (typeof src === 'string') return src;
  if (src && typeof src === 'object') {
    return Object.entries(src)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join('; ')
      .slice(0, 300);
  }
  return 'отклонено каналом';
}

/**
 * Channex (channex.io): один ключ — доступ к объекту, через него Booking.com, Expedia, Airbnb и другие OTA.
 * ARI: POST /availability (по типу номера), POST /restrictions (цена и ограничения по тарифу) — одним вызовом на выгрузку,
 * частичные ошибки приходят в meta.warnings при 200. Брони — лента неподтверждённых ревизий GET /booking_revisions/feed
 * + POST /booking_revisions/:id/ack; вебхук события booking — сигнал забрать ленту сразу.
 */
export class ChannexAdapter implements ChannelAdapter {
  constructor(private readonly apiKey: string, private readonly base: string) {}

  private async req<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        method,
        headers: { 'user-api-key': this.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(60_000),
      });
    } catch (e) {
      throw new BadRequestException({ code: 'HOTEL_CHANNEL_UNREACHABLE', message: `Канал недоступен: ${(e as Error).message}` });
    }
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 300) }; }
    if (res.status === 401 || res.status === 403) {
      throw new BadRequestException({ code: 'HOTEL_CHANNEL_AUTH', message: 'Канал отклонил ключ API' });
    }
    if (res.status === 429) throw new ChannelRateLimitError();
    if (!res.ok) {
      const detail = data?.errors ? JSON.stringify(data.errors).slice(0, 300) : text.slice(0, 300);
      throw new BadRequestException({ code: 'HOTEL_CHANNEL_ERROR', message: `Ошибка канала ${res.status}: ${detail}` });
    }
    return data as T;
  }

  /** Все страницы списка (pagination[page] с 1, limit до 100) */
  private async all(path: string): Promise<any[]> {
    const out: any[] = [];
    for (let page = 1; page <= 20; page++) {
      const sep = path.includes('?') ? '&' : '?';
      const r = await this.req('GET', `${path}${sep}pagination[page]=${page}&pagination[limit]=100`);
      const rows = r?.data || [];
      out.push(...rows);
      const total = num(r?.meta?.total);
      if (!rows.length || rows.length < 100 || (total && out.length >= total)) break;
    }
    return out;
  }

  async listProperties() {
    return (await this.all('/properties')).map((p: any) => ({
      id: String(p.id),
      title: p.attributes?.title || String(p.id),
      currency: p.attributes?.currency || null,
      timezone: p.attributes?.timezone || null,
    }));
  }

  async listRoomTypes(propertyId: string) {
    return (await this.all(`/room_types?filter[property_id]=${encodeURIComponent(propertyId)}`)).map((x: any) => ({
      id: String(x.id),
      title: x.attributes?.title || String(x.id),
      rooms: x.attributes?.count_of_rooms ?? null,
    }));
  }

  async listRatePlans(propertyId: string) {
    return (await this.all(`/rate_plans?filter[property_id]=${encodeURIComponent(propertyId)}`)).map((x: any): ChannelRemoteRatePlan => {
      const a = x.attributes || {};
      const occupancies = (Array.isArray(a.options) ? a.options : [])
        .map((o: any) => Math.round(num(o?.occupancy)))
        .filter((n: number) => n > 0)
        .sort((p: number, q: number) => p - q);
      return {
        id: String(x.id),
        title: a.title || String(x.id),
        roomTypeId: x.relationships?.room_type?.data?.id ? String(x.relationships.room_type.data.id) : a.room_type_id ? String(a.room_type_id) : null,
        currency: a.currency || null,
        sellMode: a.sell_mode === 'per_person' ? 'per_person' : 'per_room',
        rateMode: ['derived', 'auto', 'cascade'].includes(a.rate_mode) ? a.rate_mode : 'manual',
        occupancies: [...new Set<number>(occupancies)],
      };
    });
  }

  private parseWarnings(r: any, idField: 'rate_plan_id' | 'room_type_id'): ChannelWarning[] {
    const list = Array.isArray(r?.meta?.warnings) ? r.meta.warnings : [];
    return list.map((w: any) => ({
      externalId: w?.[idField] ? String(w[idField]) : null,
      from: w?.date_from ? String(w.date_from).slice(0, 10) : w?.date ? String(w.date).slice(0, 10) : null,
      to: w?.date_to ? String(w.date_to).slice(0, 10) : w?.date ? String(w.date).slice(0, 10) : null,
      message: warningText(w),
    }));
  }

  async pushAvailability(propertyId: string, items: ChannelAvailabilityItem[]): Promise<ChannelPushResult> {
    const values = items.map((x) => ({
      property_id: propertyId,
      room_type_id: x.externalRoomTypeId,
      ...(x.from === x.to ? { date: x.from } : { date_from: x.from, date_to: x.to }),
      availability: Math.max(0, Math.floor(x.availability)),
    }));
    const res: ChannelPushResult = { taskIds: [], warnings: [], calls: 0 };
    for (const chunk of chunkBySize(values)) {
      const r = await this.req('POST', '/availability', { values: chunk });
      res.calls++;
      for (const d of r?.data || []) if (d?.id) res.taskIds.push(String(d.id));
      res.warnings.push(...this.parseWarnings(r, 'room_type_id'));
    }
    return res;
  }

  async pushRates(propertyId: string, items: ChannelRateItem[]): Promise<ChannelPushResult> {
    const values = items.map((x) => ({
      property_id: propertyId,
      rate_plan_id: x.externalRatePlanId,
      ...(x.from === x.to ? { date: x.from } : { date_from: x.from, date_to: x.to }),
      ...(x.rates?.length ? { rates: x.rates.map((r) => ({ occupancy: r.occupancy, rate: r.rate.toFixed(2) })) } : x.rate !== null && x.rate > 0 ? { rate: x.rate.toFixed(2) } : {}),
      stop_sell: x.stopSell,
      min_stay_arrival: Math.max(1, Math.round(x.minStayArrival)),
      max_stay: Math.max(0, Math.round(x.maxStay)),
      closed_to_arrival: x.closedToArrival,
      closed_to_departure: x.closedToDeparture,
    }));
    const res: ChannelPushResult = { taskIds: [], warnings: [], calls: 0 };
    for (const chunk of chunkBySize(values)) {
      const r = await this.req('POST', '/restrictions', { values: chunk });
      res.calls++;
      for (const d of r?.data || []) if (d?.id) res.taskIds.push(String(d.id));
      res.warnings.push(...this.parseWarnings(r, 'rate_plan_id'));
    }
    return res;
  }

  /** Неподтверждённые ревизии, старые первыми; страницы по 100 — пока лента не опустеет */
  async fetchBookings(propertyId: string): Promise<ChannelBookingRevision[]> {
    const out: ChannelBookingRevision[] = [];
    const seen = new Set<string>();
    for (let page = 1; page <= FEED_PAGES; page++) {
      const r = await this.req(
        'GET',
        `/booking_revisions/feed?filter[property_id]=${encodeURIComponent(propertyId)}&order[inserted_at]=asc&pagination[page]=${page}&pagination[limit]=${FEED_LIMIT}`,
      );
      const rows = r?.data || [];
      for (const x of rows) {
        const rev = this.mapRevision(x);
        if (seen.has(rev.revisionId)) continue;
        seen.add(rev.revisionId);
        out.push(rev);
      }
      const total = num(r?.meta?.total);
      if (rows.length < FEED_LIMIT || (total && out.length >= total)) break;
    }
    return out;
  }

  private mapRevision(x: any): ChannelBookingRevision {
    const a = x.attributes || {};
    const c = a.customer || {};
    return {
      revisionId: String(x.id),
      bookingId: String(a.booking_id || x.id),
      status: a.status === 'cancelled' ? 'cancelled' : a.status === 'modified' ? 'modified' : 'new',
      arrival: String(a.arrival_date || '').slice(0, 10),
      departure: String(a.departure_date || '').slice(0, 10),
      otaName: a.ota_name || null,
      otaCode: a.ota_reservation_code || null,
      currency: a.currency || null,
      amount: num(a.amount),
      otaCommission: num(a.ota_commission),
      paymentCollect: a.payment_collect === 'ota' ? 'ota' : a.payment_collect === 'property' ? 'property' : null,
      paymentType: a.payment_type ? String(a.payment_type).slice(0, 16) : null,
      guest: {
        name: [c.name, c.surname].filter(Boolean).join(' ').trim() || a.ota_reservation_code || 'Guest',
        email: c.mail || c.email || null,
        phone: c.phone || null,
        country: c.country ? String(c.country).slice(0, 2).toUpperCase() : null,
      },
      notes: a.notes || null,
      rooms: (a.rooms || []).map((rm: any) => {
        const occ = rm.occupancy || {};
        const ages: Array<number | null> = Array.isArray(occ.ages) ? occ.ages.map((v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null)) : [];
        const children = Math.max(0, Math.round(num(occ.children)));
        const infants = Math.max(0, Math.round(num(occ.infants)));
        return {
          externalRoomTypeId: rm.room_type_id ? String(rm.room_type_id) : null,
          externalRatePlanId: rm.rate_plan_id ? String(rm.rate_plan_id) : null,
          amount: num(rm.amount),
          days: Object.fromEntries(Object.entries(rm.days || {}).map(([d, v]) => [String(d).slice(0, 10), num(v)])),
          adults: Math.max(1, Math.round(num(occ.adults) || 1)),
          childAges: [
            ...ages.slice(0, children),
            ...Array.from({ length: Math.max(0, children - ages.length) }, () => null),
            ...Array.from({ length: infants }, () => 0),
          ],
        };
      }),
    };
  }

  async ack(revisionId: string) {
    await this.req('POST', `/booking_revisions/${encodeURIComponent(revisionId)}/ack`);
  }

  async createWebhook(propertyId: string, callbackUrl: string, secret: string) {
    const r = await this.req('POST', '/webhooks', {
      webhook: {
        property_id: propertyId,
        callback_url: callbackUrl,
        event_mask: 'booking;booking_unmapped_room;booking_unmapped_rate;non_acked_booking;sync_error;rate_error',
        headers: { 'X-Channex-Webhook-Secret': secret },
        is_active: true,
        send_data: false,
      },
    });
    const id = r?.data?.id;
    if (!id) throw new BadRequestException({ code: 'HOTEL_CHANNEL_ERROR', message: 'Канал не вернул id вебхука' });
    return String(id);
  }

  async deleteWebhook(webhookId: string) {
    await this.req('DELETE', `/webhooks/${encodeURIComponent(webhookId)}`);
  }
}
