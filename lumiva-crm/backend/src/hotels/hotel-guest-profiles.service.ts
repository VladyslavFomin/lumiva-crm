import { mergeLoyaltyMembers } from './hotel-loyalty-merge.util';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { HotelGuestProfile, HOTEL_GUEST_PREFERENCES } from './hotel-guest-profile.entity';
import { HotelReservation, HotelReservationGuest } from './hotel-reservation.entity';
import { normalizeCountry } from '../common/countries';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const bad = (code: string, message: string) => new BadRequestException({ code, message });
const STAY = `'checked_in','checked_out'`;

/** Ключи сопоставления — одинаково для профиля и для данных брони */
export const guestKeys = {
  email: (v: unknown) => {
    const s = String(v ?? '').trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s.slice(0, 200) : null;
  },
  /**
   * последние 9 цифр: «+90 532 111 22 33» = «0532 111 22 33», «+48 600 100 200» = «600 100 200» (национальные номера
   * бывают 9- и 10-значными, код страны и ведущий 0 отбрасываются); меньше 7 цифр — не телефон
   */
  phone: (v: unknown) => {
    const d = String(v ?? '').replace(/\D/g, '');
    return d.length >= 7 ? d.slice(-9) : null;
  },
  document: (v: unknown) => {
    const s = String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return s.length >= 5 ? s.slice(0, 40) : null;
  },
  /** имя без регистра, диакритики и порядка слов: «Çağrı YILMAZ» = «yilmaz cagri» */
  name: (v: unknown) =>
    String(v ?? '')
      .toLocaleLowerCase('tr')
      .replace(/ı/g, 'i')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zа-яё0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(' ')
      .slice(0, 200),
};

const isoDate = (v: unknown): string | null => {
  const s = String(v ?? '').slice(0, 10);
  if (!ISO.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
};

interface GuestData {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  documentExpiry?: string | null;
}

export interface HotelGuestStats {
  stays: number;
  nights: number;
  bookings: number;
  cancelled: number;
  /** выручка по валютам отелей: { EUR: 1200, TRY: 45000 } — сеть может работать в разных валютах */
  revenue: Record<string, number>;
  lastStay: string | null;
  nextStay: string | null;
}

export type HotelGuestProfileInput = Partial<Pick<HotelGuestProfile,
  'fullName' | 'email' | 'phone' | 'country' | 'language' | 'birthDate' | 'gender' | 'documentType' | 'documentNumber' | 'documentExpiry' |
  'vip' | 'blacklisted' | 'blacklistReason' | 'preferences' | 'allergies' | 'notes' | 'marketingConsent'>>;

/**
 * Профили гостей: автоматическое сопоставление с бронями (контакт брони — по email / телефону, гости из состава —
 * по документу, имени контакта, имени + дате рождения), карточка с историей проживаний, дубли и слияние, анонимизация.
 */
@Injectable()
export class HotelGuestProfilesService {
  constructor(
    @InjectRepository(HotelGuestProfile) private readonly profiles: Repository<HotelGuestProfile>,
    @InjectRepository(HotelReservation) private readonly reservations: Repository<HotelReservation>,
  ) {}

  private applyKeys(p: HotelGuestProfile) {
    p.emailKey = guestKeys.email(p.email);
    p.phoneKey = guestKeys.phone(p.phone);
    p.documentKey = guestKeys.document(p.documentNumber);
    p.nameKey = guestKeys.name(p.fullName) || '-';
    return p;
  }

  /** Дополнить пустые поля профиля данными из брони (ручные правки профиля не перезаписываются; срок документа — более поздний) */
  private enrich(p: HotelGuestProfile, d: GuestData): boolean {
    if (p.anonymizedAt) return false;
    let changed = false;
    const fill = <K extends keyof HotelGuestProfile>(k: K, v: HotelGuestProfile[K] | null | undefined) => {
      if (v !== null && v !== undefined && v !== '' && (p[k] === null || p[k] === undefined || (p[k] as unknown) === '')) {
        p[k] = v as HotelGuestProfile[K];
        changed = true;
      }
    };
    fill('email', guestKeys.email(d.email) ? String(d.email).trim().slice(0, 200) : null);
    fill('phone', guestKeys.phone(d.phone) ? String(d.phone).trim().slice(0, 40) : null);
    fill('country', normalizeCountry(d.country || '') || null);
    fill('birthDate', isoDate(d.birthDate));
    fill('gender', d.gender === 'M' || d.gender === 'F' ? d.gender : null);
    if (guestKeys.document(d.documentNumber)) {
      fill('documentNumber', String(d.documentNumber).trim().slice(0, 40));
      fill('documentType', ['passport', 'id_card', 'other'].includes(String(d.documentType)) ? (d.documentType as HotelGuestProfile['documentType']) : null);
      const exp = isoDate(d.documentExpiry);
      if (exp && guestKeys.document(d.documentNumber) === p.documentKey && (!p.documentExpiry || exp > p.documentExpiry)) {
        p.documentExpiry = exp;
        changed = true;
      }
    }
    if (changed) this.applyKeys(p);
    return changed;
  }

  private build(tenantId: string, d: GuestData): HotelGuestProfile {
    const p = this.profiles.create({
      tenantId,
      fullName: String(d.fullName || '').trim().slice(0, 200) || '—',
      email: null, phone: null, country: null, language: null, birthDate: null, gender: null,
      documentType: null, documentNumber: null, documentExpiry: null, vip: false, blacklisted: false,
      blacklistReason: null, preferences: [], allergies: null, notes: null, marketingConsent: false, anonymizedAt: null,
    });
    this.applyKeys(p);
    this.enrich(p, d);
    return this.applyKeys(p);
  }

  /** Профиль по сильным ключам: документ → email → телефон (без анонимизированных) */
  private async findStrong(tenantId: string, d: GuestData): Promise<HotelGuestProfile | null> {
    const doc = guestKeys.document(d.documentNumber);
    const email = guestKeys.email(d.email);
    const phone = guestKeys.phone(d.phone);
    for (const [col, v] of [['documentKey', doc], ['emailKey', email], ['phoneKey', phone]] as const) {
      if (!v) continue;
      const hit = await this.profiles.findOne({ where: { tenantId, [col]: v, anonymizedAt: IsNull() } as any, order: { createdAt: 'ASC' } });
      if (hit) return hit;
    }
    return null;
  }

  /** Контакт брони → профиль: найден по ключам — дополняем, нет — создаём (без email/телефона — тоже, дубли покажет поиск дублей) */
  private async contactProfile(tenantId: string, r: HotelReservation, current: HotelGuestProfile | null, rematch: boolean): Promise<HotelGuestProfile | null> {
    const d: GuestData = { fullName: r.guestName, email: r.guestEmail, phone: r.guestPhone, country: r.guestCountry };
    if (!String(r.guestName || '').trim()) return current;
    if (current && !rematch) {
      if (this.enrich(current, d)) await this.profiles.save(current);
      return current;
    }
    const hit = await this.findStrong(tenantId, d);
    if (hit) {
      if (this.enrich(hit, d)) await this.profiles.save(hit);
      return hit;
    }
    // контакт сменился на другого человека (email / телефон не совпадают с текущим профилем) — новый профиль
    const conflicts = current && (
      (guestKeys.email(d.email) && current.emailKey && current.emailKey !== guestKeys.email(d.email)) ||
      (guestKeys.phone(d.phone) && current.phoneKey && current.phoneKey !== guestKeys.phone(d.phone)) ||
      (guestKeys.name(d.fullName) !== current.nameKey && !guestKeys.email(d.email) && !guestKeys.phone(d.phone))
    );
    if (current && !conflicts) {
      if (this.enrich(current, d)) await this.profiles.save(current);
      return current;
    }
    return this.profiles.save(this.build(tenantId, d));
  }

  /** Гость из состава брони → профиль: документ → это контакт брони (то же имя) → имя + дата рождения → новый, если есть документ или дата рождения */
  private async manifestProfile(tenantId: string, g: HotelReservationGuest, contact: HotelGuestProfile | null): Promise<HotelGuestProfile | null> {
    const d: GuestData = {
      fullName: g.fullName,
      country: g.nationalityCode || null,
      birthDate: g.birthDate || null,
      gender: g.gender || null,
      documentType: g.documentType || null,
      documentNumber: g.passportNumber || g.tcKimlikNo || null,
      documentExpiry: g.passportExpiry || null,
    };
    if (!String(g.fullName || '').trim()) return null;
    if (g.profileId) {
      const p = await this.profiles.findOne({ where: { id: g.profileId, tenantId } });
      if (p) {
        if (this.enrich(p, d)) await this.profiles.save(p);
        return p;
      }
    }
    const doc = guestKeys.document(d.documentNumber);
    if (doc) {
      const hit = await this.profiles.findOne({ where: { tenantId, documentKey: doc, anonymizedAt: IsNull() }, order: { createdAt: 'ASC' } });
      if (hit) {
        if (this.enrich(hit, d)) await this.profiles.save(hit);
        return hit;
      }
    }
    const nameKey = guestKeys.name(g.fullName);
    if (contact && contact.nameKey === nameKey && (!doc || !contact.documentKey || contact.documentKey === doc)) {
      if (this.enrich(contact, d)) await this.profiles.save(contact);
      return contact;
    }
    const birth = isoDate(d.birthDate);
    if (birth) {
      const hit = await this.profiles.findOne({ where: { tenantId, nameKey, birthDate: birth, anonymizedAt: IsNull() } });
      if (hit) {
        if (this.enrich(hit, d)) await this.profiles.save(hit);
        return hit;
      }
    }
    if (!doc && !birth) return null;
    return this.profiles.save(this.build(tenantId, d));
  }

  /**
   * Сопоставить бронь с профилями. profileId — выбран в форме явно (null — отвязать и подобрать заново);
   * contactChanged — у брони сменились имя / email / телефон контакта.
   */
  async syncReservation(tenantId: string, reservationId: string, opts: { profileId?: string | null; contactChanged?: boolean } = {}) {
    const r = await this.reservations.findOne({ where: { id: reservationId, tenantId } });
    if (!r) return null;
    let contact: HotelGuestProfile | null = null;
    if (opts.profileId) {
      contact = await this.profiles.findOne({ where: { id: opts.profileId, tenantId } });
      if (!contact) throw bad('HOTEL_GUEST_NOT_FOUND', 'Профиль гостя не найден');
      if (this.enrich(contact, { fullName: r.guestName, email: r.guestEmail, phone: r.guestPhone, country: r.guestCountry })) await this.profiles.save(contact);
    } else {
      const current = r.guestProfileId && opts.profileId !== null ? await this.profiles.findOne({ where: { id: r.guestProfileId, tenantId } }) : null;
      contact = await this.contactProfile(tenantId, r, current, opts.profileId === null || !!opts.contactChanged || !current);
    }
    let guestsChanged = false;
    const guests = (r.guests || []).map((g) => ({ ...g }));
    for (const g of guests) {
      const p = await this.manifestProfile(tenantId, g, contact);
      const id = p?.id ?? g.profileId ?? null;
      if ((g.profileId ?? null) !== id) {
        g.profileId = id;
        guestsChanged = true;
      }
    }
    const patch: Partial<HotelReservation> = {};
    if ((r.guestProfileId ?? null) !== (contact?.id ?? null)) patch.guestProfileId = contact?.id ?? null;
    if (guestsChanged) patch.guests = guests;
    if (Object.keys(patch).length) await this.reservations.update({ id: r.id, tenantId }, patch as any);
    return { guestProfileId: contact?.id ?? null, guests, contact };
  }

  /** Собрать профили из броней без профиля (пачкой); remaining > 0 — вызвать ещё раз */
  async backfill(tenantId: string, limit = 300) {
    const rows = await this.reservations.find({ where: { tenantId, guestProfileId: IsNull() }, select: ['id'], order: { createdAt: 'ASC' }, take: Math.min(1000, Math.max(1, limit)) });
    let linked = 0;
    for (const r of rows) {
      const res = await this.syncReservation(tenantId, r.id).catch(() => null);
      if (res?.guestProfileId) linked++;
    }
    // брони без имени контакта не сопоставить — не считаем их «оставшимися», иначе цикл не закончится
    const remaining = await this.reservations
      .createQueryBuilder('r')
      .where('r."tenantId" = :tenantId AND r."guestProfileId" IS NULL', { tenantId })
      .andWhere(`coalesce(trim(r."guestName"), '') <> ''`)
      .getCount();
    return { processed: rows.length, linked, remaining: rows.length < limit ? 0 : remaining };
  }

  /** Статистика по профилям одним проходом: контакт брони + гость из состава (одна бронь на профиль — один раз) */
  private statsSql(where: string) {
    return `
      WITH links AS (
        SELECT r."guestProfileId" AS pid, r.id, r.status, r."checkIn", r."checkOut", r.total, r."hotelId"
          FROM hotel_reservations r WHERE r."tenantId" = $1 AND r."guestProfileId" IS NOT NULL ${where}
        UNION
        SELECT (g->>'profileId')::uuid, r.id, r.status, r."checkIn", r."checkOut", r.total, r."hotelId"
          FROM hotel_reservations r, jsonb_array_elements(r.guests) g
         WHERE r."tenantId" = $1 AND jsonb_typeof(r.guests) = 'array' AND coalesce(g->>'profileId', '') ~ '^[0-9a-f-]{36}$' ${where}
      ), cur AS (
        SELECT l.pid, upper(coalesce(h.currency, '')) AS cur,
               count(*) FILTER (WHERE l.status IN (${STAY})) AS stays,
               coalesce(sum(l."checkOut" - l."checkIn") FILTER (WHERE l.status IN (${STAY})), 0) AS nights,
               coalesce(sum(l.total::numeric) FILTER (WHERE l.status IN (${STAY})), 0) AS revenue,
               count(*) AS bookings,
               count(*) FILTER (WHERE l.status IN ('cancelled','no_show')) AS cancelled,
               max(l."checkOut") FILTER (WHERE l.status IN (${STAY})) AS last_stay,
               min(l."checkIn") FILTER (WHERE l.status IN ('confirmed','pending') AND l."checkIn" >= current_date) AS next_stay
          FROM links l LEFT JOIN hotels h ON h.id = l."hotelId"
         GROUP BY l.pid, upper(coalesce(h.currency, ''))
      )
      SELECT pid, sum(stays)::int AS stays, sum(nights)::int AS nights, sum(bookings)::int AS bookings, sum(cancelled)::int AS cancelled,
             coalesce(jsonb_object_agg(cur, round(revenue, 2)) FILTER (WHERE revenue > 0), '{}'::jsonb) AS revenue,
             max(last_stay)::text AS last_stay, min(next_stay)::text AS next_stay
        FROM cur GROUP BY pid`;
  }

  private toStats(row: any): HotelGuestStats {
    const revenue: Record<string, number> = {};
    for (const [k, v] of Object.entries(row?.revenue || {})) revenue[k || '—'] = Number(v);
    return {
      stays: Number(row?.stays || 0), nights: Number(row?.nights || 0), bookings: Number(row?.bookings || 0), cancelled: Number(row?.cancelled || 0),
      revenue, lastStay: row?.last_stay || null, nextStay: row?.next_stay || null,
    };
  }

  async statsFor(tenantId: string, ids: string[]): Promise<Map<string, HotelGuestStats>> {
    const out = new Map<string, HotelGuestStats>();
    if (!ids.length) return out;
    const rows = await this.profiles.manager.query(`SELECT * FROM (${this.statsSql('')}) s WHERE s.pid = ANY($2::uuid[])`, [tenantId, ids]);
    for (const r of rows) out.set(r.pid, this.toStats(r));
    return out;
  }

  /** Список: поиск по имени / email / телефону / документу, фильтры, сортировка; статистика — по броням */
  async list(tenantId: string, q: { search?: string; filter?: string; country?: string; sort?: string; page?: number; pageSize?: number }) {
    const pageSize = Math.min(100, Math.max(10, Math.round(Number(q.pageSize) || 50)));
    const page = Math.max(1, Math.round(Number(q.page) || 1));
    const params: unknown[] = [tenantId];
    const cond: string[] = ['p."tenantId" = $1'];
    const s = String(q.search || '').trim();
    if (s) {
      const parts: string[] = [];
      params.push(`%${guestKeys.name(s)}%`);
      parts.push(`p."nameKey" LIKE $${params.length}`);
      params.push(`%${s.toLowerCase()}%`);
      parts.push(`lower(coalesce(p.email,'')) LIKE $${params.length}`);
      const ph = guestKeys.phone(s);
      if (ph) { params.push(`%${ph}%`); parts.push(`p."phoneKey" LIKE $${params.length}`); }
      const doc = guestKeys.document(s);
      if (doc) { params.push(doc); parts.push(`p."documentKey" = $${params.length}`); }
      // «яйлмаз джан» → ищем каждое слово в имени
      const words = guestKeys.name(s).split(' ').filter((w) => w.length >= 2);
      if (words.length > 1) {
        const w = words.map((x) => { params.push(`%${x}%`); return `p."nameKey" LIKE $${params.length}`; });
        parts.push(`(${w.join(' AND ')})`);
      }
      cond.push(`(${parts.join(' OR ')})`);
    }
    const country = normalizeCountry(q.country || '');
    if (country) { params.push(country); cond.push(`p.country = $${params.length}`); }
    const f = q.filter || 'all';
    if (f === 'vip') cond.push('p.vip = true');
    if (f === 'blacklist') cond.push('p.blacklisted = true');
    if (f === 'repeat') cond.push('coalesce(st.stays, 0) >= 2');
    if (f === 'upcoming') cond.push('st.next_stay IS NOT NULL');
    if (f === 'inhouse') cond.push(`EXISTS (SELECT 1 FROM hotel_reservations r WHERE r."tenantId" = $1 AND r.status = 'checked_in' AND (r."guestProfileId" = p.id OR r.guests @> jsonb_build_array(jsonb_build_object('profileId', p.id::text))))`);
    const order = q.sort === 'name' ? 'p."fullName" ASC' : q.sort === 'stays' ? 'coalesce(st.stays,0) DESC, p."fullName" ASC' : q.sort === 'next' ? 'st.next_stay ASC NULLS LAST, p."fullName"' : 'greatest(st.last_stay, st.next_stay, p."updatedAt"::date::text) DESC NULLS LAST';
    const base = `FROM hotel_guest_profiles p LEFT JOIN (${this.statsSql('')}) st ON st.pid = p.id WHERE ${cond.join(' AND ')}`;
    const [{ count }] = await this.profiles.manager.query(`SELECT count(*)::int AS count ${base}`, params);
    const rows = await this.profiles.manager.query(
      `SELECT p.*, st.stays, st.nights, st.bookings, st.cancelled, st.revenue, st.last_stay, st.next_stay ${base} ORDER BY ${order} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      params,
    );
    const [totals] = await this.profiles.manager.query(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE vip)::int AS vip, count(*) FILTER (WHERE blacklisted)::int AS blacklisted,
              count(*) FILTER (WHERE coalesce(st.stays,0) >= 2)::int AS repeat, count(*) FILTER (WHERE st.next_stay IS NOT NULL)::int AS upcoming
         FROM hotel_guest_profiles p LEFT JOIN (${this.statsSql('')}) st ON st.pid = p.id WHERE p."tenantId" = $1`,
      [tenantId],
    );
    const unlinked = await this.reservations.count({ where: { tenantId, guestProfileId: IsNull() } });
    return {
      items: rows.map((r: any) => {
        const { stays, nights, bookings, cancelled, revenue, last_stay, next_stay, ...p } = r;
        return { ...p, stats: this.toStats({ stays, nights, bookings, cancelled, revenue, last_stay, next_stay }) };
      }),
      total: count,
      page,
      pageSize,
      counts: totals,
      unlinked,
    };
  }

  async get(tenantId: string, id: string) {
    const p = await this.profiles.findOne({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Профиль гостя не найден');
    const stats = (await this.statsFor(tenantId, [id])).get(id) || this.toStats(null);
    const stays = await this.profiles.manager.query(
      `SELECT r.id, r."hotelId", h.name AS "hotelName", h.currency, r."roomTypeId", rt.name AS "roomTypeName", u.label AS "roomNumber",
              r."checkIn"::text AS "checkIn", r."checkOut"::text AS "checkOut", r.status, r.total, r.pax, r."guestName", r.source,
              (r."guestProfileId" = $2) AS "isContact", r."createdAt"
         FROM hotel_reservations r
         LEFT JOIN hotels h ON h.id = r."hotelId"
         LEFT JOIN hotel_room_types rt ON rt.id = r."roomTypeId"
         LEFT JOIN hotel_room_units u ON u.id = r."roomUnitId"
        WHERE r."tenantId" = $1 AND (r."guestProfileId" = $2 OR r.guests @> jsonb_build_array(jsonb_build_object('profileId', $2::text)))
        ORDER BY r."checkIn" DESC LIMIT 200`,
      [tenantId, id],
    );
    return { ...p, stats, stays, duplicates: await this.duplicatesOf(tenantId, p) };
  }

  /** Для формы брони: подсказки по имени / email / телефону / документу */
  async lookup(tenantId: string, q: string) {
    const s = String(q || '').trim();
    if (s.length < 2) return [];
    const res = await this.list(tenantId, { search: s, pageSize: 10, sort: 'recent' });
    return res.items.slice(0, 8);
  }

  private async clean(tenantId: string, dto: HotelGuestProfileInput, current?: HotelGuestProfile): Promise<Partial<HotelGuestProfile>> {
    const out: Partial<HotelGuestProfile> = {};
    const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n) || null;
    if (dto.fullName !== undefined) {
      const n = str(dto.fullName, 200);
      if (!n) throw bad('HOTEL_GUEST_NAME', 'Укажите имя гостя');
      out.fullName = n;
    }
    if (dto.email !== undefined) {
      const e = str(dto.email, 200);
      if (e && !guestKeys.email(e)) throw bad('HOTEL_GUEST_EMAIL', 'Неверный email');
      out.email = e;
    }
    if (dto.phone !== undefined) {
      const ph = str(dto.phone, 40);
      if (ph && !guestKeys.phone(ph)) throw bad('HOTEL_GUEST_PHONE', 'Неверный телефон');
      out.phone = ph;
    }
    if (dto.country !== undefined) out.country = normalizeCountry(dto.country || '') || null;
    if (dto.language !== undefined) out.language = ['ru', 'en', 'tr', 'de', 'uk', 'ar', 'fr', 'es', 'it', 'pl', 'nl'].includes(String(dto.language)) ? String(dto.language) : null;
    for (const k of ['birthDate', 'documentExpiry'] as const) {
      if (dto[k] === undefined) continue;
      if (dto[k] && !isoDate(dto[k])) throw bad('HOTEL_GUEST_DATE', 'Неверная дата');
      out[k] = isoDate(dto[k]);
    }
    if (dto.gender !== undefined) out.gender = dto.gender === 'M' || dto.gender === 'F' ? dto.gender : null;
    if (dto.documentType !== undefined) out.documentType = ['passport', 'id_card', 'other'].includes(String(dto.documentType)) ? dto.documentType : null;
    if (dto.documentNumber !== undefined) out.documentNumber = str(dto.documentNumber, 40);
    if (dto.vip !== undefined) out.vip = !!dto.vip;
    if (dto.blacklisted !== undefined) out.blacklisted = !!dto.blacklisted;
    if (dto.blacklistReason !== undefined) out.blacklistReason = str(dto.blacklistReason, 1000);
    if ((out.blacklisted ?? current?.blacklisted) && !(out.blacklistReason ?? current?.blacklistReason)) {
      throw bad('HOTEL_GUEST_BLACKLIST_REASON', 'Укажите причину чёрного списка');
    }
    if (out.blacklisted === false) out.blacklistReason = null;
    if (dto.preferences !== undefined) {
      out.preferences = [...new Set((Array.isArray(dto.preferences) ? dto.preferences : []).filter((x) => (HOTEL_GUEST_PREFERENCES as readonly string[]).includes(String(x))))];
    }
    if (dto.allergies !== undefined) out.allergies = str(dto.allergies, 1000);
    if (dto.notes !== undefined) out.notes = str(dto.notes, 4000);
    if (dto.marketingConsent !== undefined) out.marketingConsent = !!dto.marketingConsent;
    // тот же документ у другого профиля — это дубль, а не новый гость
    const doc = guestKeys.document(out.documentNumber ?? current?.documentNumber);
    if (out.documentNumber !== undefined && doc) {
      const dup = await this.profiles.findOne({ where: { tenantId, documentKey: doc, anonymizedAt: IsNull() } });
      if (dup && dup.id !== current?.id) throw bad('HOTEL_GUEST_DOC_DUP', `Документ уже есть у гостя «${dup.fullName}» — объедините профили`);
    }
    return out;
  }

  async create(tenantId: string, dto: HotelGuestProfileInput) {
    if (!dto.fullName) throw bad('HOTEL_GUEST_NAME', 'Укажите имя гостя');
    const fields = await this.clean(tenantId, dto);
    const p = this.build(tenantId, { fullName: fields.fullName });
    Object.assign(p, fields);
    return this.profiles.save(this.applyKeys(p));
  }

  async update(tenantId: string, id: string, dto: HotelGuestProfileInput) {
    const p = await this.profiles.findOne({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Профиль гостя не найден');
    if (p.anonymizedAt) throw bad('HOTEL_GUEST_ANONYMIZED', 'Профиль анонимизирован — данные не редактируются');
    Object.assign(p, await this.clean(tenantId, dto, p));
    return this.profiles.save(this.applyKeys(p));
  }

  /** Возможные дубли одного профиля: тот же документ / email / телефон, то же имя + дата рождения, то же имя */
  private async duplicatesOf(tenantId: string, p: HotelGuestProfile) {
    if (p.anonymizedAt) return [];
    const rows: Array<HotelGuestProfile & { reason: string }> = await this.profiles.manager.query(
      `SELECT x.*, CASE
          WHEN x."documentKey" IS NOT NULL AND x."documentKey" = $3 THEN 'document'
          WHEN x."emailKey" IS NOT NULL AND x."emailKey" = $4 THEN 'email'
          WHEN x."phoneKey" IS NOT NULL AND x."phoneKey" = $5 THEN 'phone'
          WHEN x."birthDate" IS NOT NULL AND x."birthDate" = $7::date AND x."nameKey" = $6 THEN 'name_birth'
          ELSE 'name' END AS reason
         FROM hotel_guest_profiles x
        WHERE x."tenantId" = $1 AND x.id <> $2 AND x."anonymizedAt" IS NULL
          AND ((x."documentKey" IS NOT NULL AND x."documentKey" = $3) OR (x."emailKey" IS NOT NULL AND x."emailKey" = $4)
            OR (x."phoneKey" IS NOT NULL AND x."phoneKey" = $5) OR (x."nameKey" = $6 AND length($6) > 4))
        LIMIT 20`,
      [tenantId, p.id, p.documentKey, p.emailKey, p.phoneKey, p.nameKey, p.birthDate],
    );
    return rows.map((r) => ({ id: r.id, fullName: r.fullName, email: r.email, phone: r.phone, country: r.country, birthDate: r.birthDate, documentNumber: r.documentNumber, reason: r.reason }));
  }

  /** Группы вероятных дублей по всей базе: сильные (документ / email / телефон / имя + дата рождения) и слабые (только имя) */
  async duplicates(tenantId: string) {
    const groups: Array<{ reason: string; key: string; profiles: any[] }> = [];
    const seen = new Set<string>();
    for (const [reason, expr] of [['document', '"documentKey"'], ['email', '"emailKey"'], ['phone', '"phoneKey"'], ['name_birth', `"nameKey" || '|' || "birthDate"::text`], ['name', '"nameKey"']] as const) {
      const rows = await this.profiles.manager.query(
        `SELECT ${expr} AS k, array_agg(id ORDER BY "createdAt") AS ids FROM hotel_guest_profiles
          WHERE "tenantId" = $1 AND "anonymizedAt" IS NULL AND ${expr} IS NOT NULL ${reason === 'name' ? `AND length("nameKey") > 4 AND "nameKey" LIKE '% %'` : ''}
          GROUP BY 1 HAVING count(*) > 1 ORDER BY count(*) DESC LIMIT 100`,
        [tenantId],
      );
      for (const r of rows) {
        // та же группа уже найдена более сильным признаком — не показываем второй раз
        const sig = [...r.ids].sort().join(',');
        if (seen.has(sig)) continue;
        seen.add(sig);
        groups.push({ reason, key: String(r.k), profiles: r.ids });
      }
    }
    const allIds = [...new Set(groups.flatMap((g) => g.profiles))];
    const profiles = allIds.length ? await this.profiles.find({ where: { tenantId, id: In(allIds) } }) : [];
    const stats = await this.statsFor(tenantId, allIds);
    return groups.slice(0, 100).map((g) => ({
      reason: g.reason,
      profiles: g.profiles.map((id) => {
        const p = profiles.find((x) => x.id === id);
        return p ? { id: p.id, fullName: p.fullName, email: p.email, phone: p.phone, country: p.country, birthDate: p.birthDate, documentNumber: p.documentNumber, vip: p.vip, blacklisted: p.blacklisted, createdAt: p.createdAt, stats: stats.get(id) || this.toStats(null) } : null;
      }).filter(Boolean),
    }));
  }

  /**
   * Слияние: брони и гости из состава переходят к основному профилю, пустые поля дополняются, предпочтения объединяются,
   * VIP / чёрный список — если был у любого. Объединённые профили удаляются.
   */
  async merge(tenantId: string, targetId: string, sourceIds: string[]) {
    const ids = [...new Set((sourceIds || []).filter((x) => typeof x === 'string' && x !== targetId))];
    if (!ids.length) throw bad('HOTEL_GUEST_MERGE_EMPTY', 'Выберите профили для объединения');
    if (ids.length > 20) throw bad('HOTEL_GUEST_MERGE_MANY', 'Не больше 20 профилей за раз');
    return this.profiles.manager.transaction(async (m) => {
      const target = await m.findOne(HotelGuestProfile, { where: { id: targetId, tenantId } });
      if (!target) throw new NotFoundException('Профиль гостя не найден');
      if (target.anonymizedAt) throw bad('HOTEL_GUEST_ANONYMIZED', 'Анонимизированный профиль нельзя сделать основным');
      const sources = await m.find(HotelGuestProfile, { where: { tenantId, id: In(ids) } });
      if (sources.length !== ids.length) throw bad('HOTEL_GUEST_NOT_FOUND', 'Профиль гостя не найден');
      for (const s of sources) {
        for (const k of ['email', 'phone', 'country', 'language', 'birthDate', 'gender', 'documentType', 'documentNumber', 'documentExpiry', 'allergies'] as const) {
          if ((target[k] === null || target[k] === undefined || (target[k] as unknown) === '') && s[k]) (target as any)[k] = s[k];
        }
        target.vip = target.vip || s.vip;
        if (s.blacklisted && !target.blacklisted) {
          target.blacklisted = true;
          target.blacklistReason = s.blacklistReason;
        }
        target.marketingConsent = target.marketingConsent || s.marketingConsent;
        target.preferences = [...new Set([...(target.preferences || []), ...(s.preferences || [])])];
        if (s.notes && !(target.notes || '').includes(s.notes)) target.notes = [target.notes, s.notes].filter(Boolean).join('\n').slice(0, 4000);
      }
      this.applyKeys(target);
      await m.update(HotelReservation, { tenantId, guestProfileId: In(ids) }, { guestProfileId: target.id });
      const withGuests: HotelReservation[] = await m.query(
        `SELECT id, guests FROM hotel_reservations WHERE "tenantId" = $1 AND EXISTS (SELECT 1 FROM jsonb_array_elements(guests) g WHERE g->>'profileId' = ANY($2::text[]))`,
        [tenantId, ids],
      );
      for (const r of withGuests) {
        const guests = (r.guests || []).map((g) => (g.profileId && ids.includes(g.profileId) ? { ...g, profileId: target.id } : g));
        await m.update(HotelReservation, { id: r.id, tenantId }, { guests } as any);
      }
      // участие в программах лояльности — на основной профиль ДО удаления (иначе каскад сотрёт баллы)
      await mergeLoyaltyMembers(m, tenantId, target.id, ids);
      await m.remove(sources);
      await m.save(target);
      return { id: target.id, merged: sources.length, reservations: withGuests.length };
    });
  }

  /** KVKK / GDPR: стереть персональные данные профиля; брони (бухгалтерские документы) остаются как есть */
  async anonymize(tenantId: string, id: string) {
    const p = await this.profiles.findOne({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Профиль гостя не найден');
    Object.assign(p, {
      fullName: `Guest ${p.id.slice(0, 8)}`, email: null, phone: null, birthDate: null, gender: null, documentType: null,
      documentNumber: null, documentExpiry: null, allergies: null, notes: null, preferences: [], marketingConsent: false,
      blacklistReason: p.blacklisted ? 'anonymized' : null, anonymizedAt: new Date(),
    });
    return this.profiles.save(this.applyKeys(p));
  }

  /** Сводки многих профилей сразу (экран «Сегодня») */
  async briefMany(tenantId: string, ids: string[]) {
    const out: Record<string, { id: string; fullName: string; vip: boolean; blacklisted: boolean; blacklistReason: string | null; preferences: string[]; allergies: string | null; stays: number }> = {};
    if (!ids.length) return out;
    const [list, stats] = await Promise.all([this.profiles.find({ where: { tenantId, id: In(ids) } }), this.statsFor(tenantId, ids)]);
    for (const p of list) out[p.id] = { id: p.id, fullName: p.fullName, vip: p.vip, blacklisted: p.blacklisted, blacklistReason: p.blacklistReason, preferences: p.preferences, allergies: p.allergies, stays: stats.get(p.id)?.stays || 0 };
    return out;
  }

  /** Короткая сводка для карточки брони и стойки: VIP, чёрный список, предпочтения, сколько раз был */
  async brief(tenantId: string, id: string | null | undefined) {
    if (!id) return null;
    const p = await this.profiles.findOne({ where: { id, tenantId } });
    if (!p) return null;
    const stats = (await this.statsFor(tenantId, [id])).get(id) || this.toStats(null);
    return { id: p.id, fullName: p.fullName, vip: p.vip, blacklisted: p.blacklisted, blacklistReason: p.blacklistReason, preferences: p.preferences, allergies: p.allergies, notes: p.notes, stats };
  }
}
