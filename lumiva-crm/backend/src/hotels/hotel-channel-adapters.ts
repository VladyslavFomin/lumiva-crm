import { BadRequestException } from '@nestjs/common';

/** Что менеджер каналов отдаёт о брони — уже в нашем виде (адаптер переводит из формата провайдера) */
export interface ChannelBookingRoom {
  externalRoomTypeId: string;
  externalRatePlanId: string | null;
  amount: number;
  /** цена по ночам, если провайдер её отдаёт */
  days: Record<string, number>;
  adults: number;
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
  guest: { name: string; email: string | null; phone: string | null; country: string | null };
  notes: string | null;
  rooms: ChannelBookingRoom[];
}

export interface ChannelRemoteRoomType { id: string; title: string; rooms: number | null }
export interface ChannelRemoteRatePlan { id: string; title: string; roomTypeId: string | null; currency: string | null }
export interface ChannelAvailabilityItem { externalRoomTypeId: string; from: string; to: string; availability: number }
export interface ChannelRateItem { externalRatePlanId: string; from: string; to: string; rate: number | null; stopSell: boolean }

export interface ChannelAdapter {
  listProperties(): Promise<Array<{ id: string; title: string; currency: string | null }>>;
  listRoomTypes(propertyId: string): Promise<ChannelRemoteRoomType[]>;
  listRatePlans(propertyId: string): Promise<ChannelRemoteRatePlan[]>;
  pushAvailability(propertyId: string, items: ChannelAvailabilityItem[]): Promise<void>;
  pushRates(propertyId: string, items: ChannelRateItem[]): Promise<void>;
  fetchBookings(propertyId: string): Promise<ChannelBookingRevision[]>;
  ack(revisionId: string): Promise<void>;
}

/** Адреса Channex: только официальные хосты (ключ клиента не уходит на произвольный адрес — защита от SSRF).
 * CHANNEX_TEST_BASE_URL — для стенда с имитацией API, на проде не задаётся. */
export function channexBaseUrl(environment: string) {
  if (environment === 'test' && process.env.CHANNEX_TEST_BASE_URL) return process.env.CHANNEX_TEST_BASE_URL.replace(/\/$/, '');
  return environment === 'staging' ? 'https://staging.channex.io/api/v1' : 'https://app.channex.io/api/v1';
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const BATCH = 200;

/**
 * Channex (channex.io): один ключ — доступ к объекту, через него Booking.com, Expedia, Airbnb и другие OTA.
 * ARI: POST /availability (по типу номера), POST /restrictions (цена и стоп по тарифу); брони — лента ревизий
 * GET /booking_revisions/feed + POST /booking_revisions/:id/ack.
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
        signal: AbortSignal.timeout(20_000),
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
    if (!res.ok) {
      const detail = data?.errors ? JSON.stringify(data.errors).slice(0, 300) : text.slice(0, 300);
      throw new BadRequestException({ code: 'HOTEL_CHANNEL_ERROR', message: `Ошибка канала ${res.status}: ${detail}` });
    }
    return data as T;
  }

  async listProperties() {
    const r = await this.req('GET', '/properties?pagination[limit]=100');
    return (r?.data || []).map((p: any) => ({ id: String(p.id), title: p.attributes?.title || String(p.id), currency: p.attributes?.currency || null }));
  }

  async listRoomTypes(propertyId: string) {
    const r = await this.req('GET', `/room_types?filter[property_id]=${encodeURIComponent(propertyId)}&pagination[limit]=100`);
    return (r?.data || []).map((x: any) => ({ id: String(x.id), title: x.attributes?.title || String(x.id), rooms: x.attributes?.count_of_rooms ?? null }));
  }

  async listRatePlans(propertyId: string) {
    const r = await this.req('GET', `/rate_plans?filter[property_id]=${encodeURIComponent(propertyId)}&pagination[limit]=100`);
    return (r?.data || []).map((x: any) => ({
      id: String(x.id),
      title: x.attributes?.title || String(x.id),
      roomTypeId: x.relationships?.room_type?.data?.id ? String(x.relationships.room_type.data.id) : x.attributes?.room_type_id ? String(x.attributes.room_type_id) : null,
      currency: x.attributes?.currency || null,
    }));
  }

  async pushAvailability(propertyId: string, items: ChannelAvailabilityItem[]) {
    for (let i = 0; i < items.length; i += BATCH) {
      await this.req('POST', '/availability', {
        values: items.slice(i, i + BATCH).map((x) => ({ property_id: propertyId, room_type_id: x.externalRoomTypeId, date_from: x.from, date_to: x.to, availability: Math.max(0, Math.floor(x.availability)) })),
      });
    }
  }

  async pushRates(propertyId: string, items: ChannelRateItem[]) {
    for (let i = 0; i < items.length; i += BATCH) {
      await this.req('POST', '/restrictions', {
        values: items.slice(i, i + BATCH).map((x) => ({
          property_id: propertyId,
          rate_plan_id: x.externalRatePlanId,
          date_from: x.from,
          date_to: x.to,
          stop_sell: x.stopSell,
          ...(x.rate !== null && x.rate > 0 ? { rate: x.rate.toFixed(2) } : {}),
        })),
      });
    }
  }

  async fetchBookings(propertyId: string): Promise<ChannelBookingRevision[]> {
    const r = await this.req('GET', `/booking_revisions/feed?filter[property_id]=${encodeURIComponent(propertyId)}`);
    return (r?.data || []).map((x: any): ChannelBookingRevision => {
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
        guest: {
          name: [c.name, c.surname].filter(Boolean).join(' ').trim() || a.ota_reservation_code || 'Guest',
          email: c.mail || c.email || null,
          phone: c.phone || null,
          country: c.country ? String(c.country).slice(0, 2).toUpperCase() : null,
        },
        notes: a.notes || null,
        rooms: (a.rooms || []).map((rm: any) => ({
          externalRoomTypeId: String(rm.room_type_id || ''),
          externalRatePlanId: rm.rate_plan_id ? String(rm.rate_plan_id) : null,
          amount: num(rm.amount),
          days: Object.fromEntries(Object.entries(rm.days || {}).map(([d, v]) => [d, num(v)])),
          adults: Math.max(1, Math.round(num(rm.occupancy?.adults) || 1)),
          childAges: [
            ...(Array.isArray(rm.occupancy?.ages) ? rm.occupancy.ages.map((v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null)) : []),
          ].concat(
            Array.from({ length: Math.max(0, Math.round(num(rm.occupancy?.children)) - (Array.isArray(rm.occupancy?.ages) ? rm.occupancy.ages.length : 0)) }, () => null),
          ),
        })),
      };
    });
  }

  async ack(revisionId: string) {
    await this.req('POST', `/booking_revisions/${encodeURIComponent(revisionId)}/ack`);
  }
}
