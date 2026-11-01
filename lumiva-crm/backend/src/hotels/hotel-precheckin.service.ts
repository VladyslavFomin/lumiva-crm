import { BadRequestException, GoneException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { randomBytes, randomUUID } from 'crypto';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelReservation, HotelReservationGuest } from './hotel-reservation.entity';
import { HotelExtraService } from './hotel-folio.entities';
import { HotelGuestProfile, HOTEL_GUEST_PREFERENCES } from './hotel-guest-profile.entity';
import { HotelPrecheckin, HotelUpsellKind, HotelUpsellRequest } from './hotel-precheckin.entities';
import { HotelReservationsService } from './hotel-reservations.service';
import { HotelRateEngineService } from './hotel-rate-engine.service';
import { HotelAvailabilityService } from './hotel-availability.service';
import { HotelFolioService, hotelToday } from './hotel-folio.service';
import { TenantMailService } from '../mail/tenant-mail.service';
import { tenantFrontend } from '../common/tenant-branding.util';
import { normalizeCountry } from '../common/countries';
import { scanIdDocument } from '../ai/id-document-scan.util';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const bad = (code: string, message: string) => new BadRequestException({ code, message });
const nightsOf = (r: Pick<HotelReservation, 'checkIn' | 'checkOut'>) => Math.max(1, Math.round((Date.parse(`${r.checkOut}T00:00:00Z`) - Date.parse(`${r.checkIn}T00:00:00Z`)) / 86400000));
const OPEN = ['confirmed', 'pending'];
const MAX_SCANS = 12;
const esc = (v: string) => String(v || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));

export interface HotelUpsellOffer {
  kind: HotelUpsellKind;
  /** upgrade — тип номера; extra — услуга каталога */
  roomTypeId?: string;
  extraServiceId?: string;
  name: string;
  description: string | null;
  /** доплата за всё проживание (апгрейд, ранний / поздний) или цена за единицу (услуга) */
  amount: number;
  unit: 'stay' | 'night' | 'person';
  /** сколько единиц по умолчанию (за ночь — ночей, за гостя — гостей) */
  quantity: number;
}

/** Онлайн-регистрация до заезда и допродажи: ссылка гостю, паспорта в состав брони, заявки на апгрейд / услуги */
@Injectable()
export class HotelPrecheckinService {
  private readonly log = new Logger(HotelPrecheckinService.name);

  constructor(
    @InjectRepository(HotelPrecheckin) private readonly pre: Repository<HotelPrecheckin>,
    @InjectRepository(HotelUpsellRequest) private readonly upsells: Repository<HotelUpsellRequest>,
    @InjectRepository(HotelReservation) private readonly reservations: Repository<HotelReservation>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelRoomType) private readonly roomTypes: Repository<HotelRoomType>,
    @InjectRepository(HotelExtraService) private readonly extras: Repository<HotelExtraService>,
    @InjectRepository(HotelGuestProfile) private readonly profiles: Repository<HotelGuestProfile>,
    private readonly res: HotelReservationsService,
    private readonly rates: HotelRateEngineService,
    private readonly availability: HotelAvailabilityService,
    private readonly folio: HotelFolioService,
    private readonly tenantMail: TenantMailService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /** Ссылка брони: создаётся один раз, токен — 32 случайных байта (не угадать по номеру брони) */
  async ensure(tenantId: string, reservationId: string) {
    const r = await this.reservations.findOne({ where: { id: reservationId, tenantId } });
    if (!r) throw new NotFoundException('Бронь не найдена');
    let p = await this.pre.findOne({ where: { tenantId, reservationId } });
    if (!p) p = await this.pre.save(this.pre.create({ tenantId, hotelId: r.hotelId, reservationId, token: randomBytes(24).toString('base64url'), status: 'new', preferences: [] }));
    return { p, r };
  }

  private async url(tenantId: string, token: string) {
    return `${await tenantFrontend((sql, params) => this.pre.manager.query(sql, params), tenantId)}/c/${token}`;
  }

  async link(tenantId: string, reservationId: string) {
    const { p } = await this.ensure(tenantId, reservationId);
    return { token: p.token, url: await this.url(tenantId, p.token), status: p.status, sentAt: p.sentAt, completedAt: p.completedAt };
  }

  /** Письмо гостю со ссылкой — с почты отеля (TenantMailService), на языке гостя */
  async send(tenantId: string, reservationId: string) {
    const { p, r } = await this.ensure(tenantId, reservationId);
    if (!OPEN.includes(r.status)) throw bad('HOTEL_PRECHECKIN_CLOSED', 'Бронь уже не ожидает заезда');
    if (!r.guestEmail) throw bad('HOTEL_PRECHECKIN_NO_EMAIL', 'У брони нет email гостя');
    const hotel = await this.hotels.findOne({ where: { id: r.hotelId, tenantId } });
    const url = await this.url(tenantId, p.token);
    const lang = HotelReservationsService.guestLang(r.guestCountry);
    const name = hotel?.name || '';
    const T = {
      ru: { s: `Онлайн-регистрация — ${name}`, h: `Здравствуйте, ${esc(r.guestName)}!`, b: `Ждём вас ${r.checkIn}. Заполните данные гостей заранее — на ресепшене останется только получить ключ. Здесь же можно заказать ранний заезд, трансфер или номер получше.`, c: 'Пройти регистрацию' },
      en: { s: `Online check-in — ${name}`, h: `Dear ${esc(r.guestName)},`, b: `We look forward to welcoming you on ${r.checkIn}. Fill in the guest details in advance and just pick up your key at reception. You can also request early check-in, a transfer or a better room.`, c: 'Check in online' },
      tr: { s: `Online check-in — ${name}`, h: `Sayın ${esc(r.guestName)},`, b: `${r.checkIn} tarihinde sizi bekliyoruz. Misafir bilgilerini önceden doldurun, resepsiyonda yalnızca anahtarınızı alın. Erken giriş, transfer veya daha iyi bir oda da talep edebilirsiniz.`, c: 'Online check-in yap' },
    }[lang];
    await this.tenantMail.sendOrThrow(tenantId, {
      to: r.guestEmail,
      subject: T.s,
      html: `<p>${T.h}</p><p>${T.b}</p><p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#222;color:#fff;border-radius:8px;text-decoration:none">${T.c}</a></p><p style="color:#888;font-size:12px">${url}</p>`,
    });
    p.status = p.status === 'completed' ? 'completed' : p.status === 'opened' ? 'opened' : 'sent';
    p.sentAt = new Date();
    p.sentTo = r.guestEmail;
    await this.pre.save(p);
    return { ok: true, sentTo: r.guestEmail };
  }

  /** Заезды окна с состоянием онлайн-регистрации и заявок */
  async list(tenantId: string, q: { hotelId: string; from?: string; to?: string }) {
    const hotel = await this.hotels.findOne({ where: { id: q.hotelId, tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    const today = hotelToday(hotel);
    const from = q.from && ISO.test(q.from) ? q.from : today;
    const to = q.to && ISO.test(q.to) ? q.to : new Date(Date.parse(`${from}T00:00:00Z`) + 14 * 86400000).toISOString().slice(0, 10);
    const rows = await this.reservations
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId AND r.hotelId = :hotelId', { tenantId, hotelId: hotel.id })
      .andWhere('r.status IN (:...st)', { st: OPEN })
      .andWhere('r.checkIn >= :from AND r.checkIn <= :to', { from, to })
      .andWhere('r.roomingPending = false')
      .orderBy('r.checkIn', 'ASC')
      .addOrderBy('r.guestName', 'ASC')
      .take(500)
      .getMany();
    const ids = rows.map((r) => r.id);
    const [pres, reqs, types] = await Promise.all([
      ids.length ? this.pre.find({ where: { tenantId, reservationId: In(ids) } }) : Promise.resolve([]),
      ids.length ? this.upsells.find({ where: { tenantId, reservationId: In(ids) } }) : Promise.resolve([]),
      this.roomTypes.find({ where: { tenantId, hotelId: hotel.id } }),
    ]);
    const filled = (r: HotelReservation) => (r.guests || []).filter((g) => g.fullName && (g.passportNumber || g.tcKimlikNo) && g.birthDate).length;
    return {
      from, to, autoDays: hotel.precheckinAutoDays, upgrades: hotel.precheckinUpgrades,
      items: rows.map((r) => {
        const p = pres.find((x) => x.reservationId === r.id);
        const rq = reqs.filter((x) => x.reservationId === r.id);
        return {
          reservationId: r.id, guestName: r.guestName, guestEmail: r.guestEmail, checkIn: r.checkIn, checkOut: r.checkOut, pax: r.pax,
          roomTypeName: types.find((t) => t.id === r.roomTypeId)?.name || '', guestsFilled: filled(r),
          status: p?.status || null, sentAt: p?.sentAt || null, completedAt: p?.completedAt || null, eta: p?.eta || null, flight: p?.flight || null,
          needTransfer: !!p?.needTransfer, requestsText: p?.requests || null,
          upsells: { requested: rq.filter((x) => x.status === 'requested').length, approved: rq.filter((x) => x.status === 'approved').length },
        };
      }),
    };
  }

  /** Что предложить гостю: апгрейд на дороже типы (доплата по прайсу), ранний / поздний по процентам отеля, услуги «онлайн» */
  async offers(tenantId: string, r: HotelReservation, hotel: Hotel): Promise<HotelUpsellOffer[]> {
    const out: HotelUpsellOffer[] = [];
    const nights = nightsOf(r);
    if (hotel.precheckinUpgrades && !r.contractId && !r.blockId && r.source !== 'channel') {
      const types = await this.roomTypes.find({ where: { tenantId, hotelId: hotel.id } });
      const ages = r.childAges?.length ? r.childAges : [];
      const adults = Math.max(1, (r.pax || 1) - ages.length);
      for (const t of types.filter((x) => x.id !== r.roomTypeId)) {
        const avail = await this.availability.checkAvailability({ tenantId, roomTypeId: t.id, checkIn: r.checkIn, checkOut: r.checkOut });
        if (!avail.ok) continue;
        const q = await this.rates
          .quote(tenantId, { roomTypeId: t.id, checkIn: r.checkIn, checkOut: r.checkOut, adults, childAges: ages, strictOccupancy: true, ratePlanId: r.ratePlanId, useDefaultRatePlan: false, promotions: r.promotionsOff ? 'none' : 'auto', bookedAt: r.createdAt, marketId: r.marketId, guestCountry: r.guestCountry })
          .catch(() => null);
        if (!q || q.warnings.some((w) => ['no_price', 'no_occupancy', 'blocked', 'closed_arrival', 'closed_departure'].includes(w.code))) continue;
        const diff = round2(q.total - num(r.total));
        if (diff > 0) out.push({ kind: 'upgrade', roomTypeId: t.id, name: t.name, description: (t.infoFields as any)?.area || null, amount: diff, unit: 'stay', quantity: 1 });
      }
      out.sort((a, b) => a.amount - b.amount);
    }
    const nightly = num(r.total) / nights;
    for (const [kind, pct] of [['early_checkin', hotel.earlyCheckInFeePct], ['late_checkout', hotel.lateCheckOutFeePct]] as const) {
      const flag = kind === 'early_checkin' ? r.earlyCheckIn : r.lateCheckOut;
      if (flag || !(num(pct) > 0) || !(nightly > 0)) continue;
      out.push({ kind, name: kind, description: kind === 'early_checkin' ? hotel.checkInTime || null : hotel.checkOutTime || null, amount: round2((nightly * num(pct)) / 100), unit: 'stay', quantity: 1 });
    }
    const list = await this.extras.find({ where: { tenantId, hotelId: hotel.id, active: true, sellOnline: true }, order: { sortOrder: 'ASC', name: 'ASC' } });
    for (const e of list) {
      const unit = e.priceMode === 'per_night' ? 'night' : e.priceMode === 'per_person' ? 'person' : 'stay';
      out.push({ kind: 'extra', extraServiceId: e.id, name: e.name, description: e.description, amount: round2(num(e.price)), unit, quantity: unit === 'night' ? nights : unit === 'person' ? Math.max(1, r.pax || 1) : 1 });
    }
    return out;
  }

  private async byToken(token: string) {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token || '')) throw new NotFoundException('Ссылка не найдена');
    const p = await this.pre.findOne({ where: { token } });
    if (!p) throw new NotFoundException('Ссылка не найдена');
    const r = await this.reservations.findOne({ where: { id: p.reservationId, tenantId: p.tenantId } });
    if (!r) throw new NotFoundException('Ссылка не найдена');
    if (!OPEN.includes(r.status)) throw new GoneException({ code: 'HOTEL_PRECHECKIN_CLOSED', message: r.status === 'checked_in' ? 'Вы уже заселены' : 'Бронь закрыта' });
    const hotel = await this.hotels.findOne({ where: { id: r.hotelId, tenantId: p.tenantId } });
    if (!hotel) throw new NotFoundException('Ссылка не найдена');
    return { p, r, hotel };
  }

  /** Публичная страница: отель, бронь, гости (что уже заполнено), предложения, свои заявки */
  async publicGet(token: string) {
    const { p, r, hotel } = await this.byToken(token);
    if (!p.openedAt) {
      p.openedAt = new Date();
      if (p.status !== 'completed') p.status = 'opened';
      await this.pre.save(p);
    }
    const rt = await this.roomTypes.findOne({ where: { id: r.roomTypeId, tenantId: p.tenantId } });
    const reqs = await this.upsells.find({ where: { tenantId: p.tenantId, reservationId: r.id }, order: { createdAt: 'ASC' } });
    const ages = r.childAges || [];
    return {
      hotel: { name: hotel.name, city: hotel.city, address: hotel.address || null, country: hotel.country, checkInTime: hotel.checkInTime, checkOutTime: hotel.checkOutTime, currency: (hotel.currency || '').toUpperCase(), coverPhotoUrl: hotel.coverPhotoUrl, childMaxAge: Number(hotel.childMaxAge) || 12 },
      reservation: { code: r.bookingCode || r.id.slice(0, 8).toUpperCase(), guestName: r.guestName, checkIn: r.checkIn, checkOut: r.checkOut, nights: nightsOf(r), roomTypeName: rt?.name || '', pax: r.pax, adults: Math.max(1, (r.pax || 1) - ages.length), childAges: ages, boardType: r.boardType, total: num(r.total), guestCountry: r.guestCountry },
      guests: (r.guests || []).map((g) => ({ id: g.id, fullName: g.fullName, birthDate: g.birthDate || '', gender: g.gender || '', nationalityCode: g.nationalityCode || null, documentType: g.documentType || '', passportNumber: g.passportNumber || '', passportExpiry: g.passportExpiry || '', tcKimlikNo: g.tcKimlikNo || '' })),
      status: p.status,
      completedAt: p.completedAt,
      arrival: { eta: p.eta, flight: p.flight, needTransfer: p.needTransfer, requests: p.requests, preferences: p.preferences, consent: p.consent },
      offers: await this.offers(p.tenantId, r, hotel),
      requests: reqs.map((x) => ({ id: x.id, kind: x.kind, name: x.name, amount: num(x.amount), quantity: num(x.quantity), status: x.status })),
      preferences: HOTEL_GUEST_PREFERENCES,
      scansLeft: Math.max(0, MAX_SCANS - p.scanCount),
    };
  }

  /**
   * Гость отправил регистрацию: состав (паспорта) — в бронь (журнал KBS и профили гостей подхватят), прибытие и
   * пожелания — в регистрацию, предпочтения — в профиль контакта, выбранные предложения — заявками отелю.
   */
  async publicSubmit(token: string, dto: any) {
    const { p, r, hotel } = await this.byToken(token);
    if (!dto?.consent) throw bad('HOTEL_PRECHECKIN_CONSENT', 'Нужно согласие на обработку данных');
    const rawGuests = Array.isArray(dto.guests) ? dto.guests.slice(0, 12) : [];
    if (!rawGuests.length || !String(rawGuests[0]?.fullName || '').trim()) throw bad('HOTEL_PRECHECKIN_GUESTS', 'Укажите хотя бы основного гостя');
    const s = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
    const date = (v: unknown) => {
      const x = s(v, 10);
      if (!x) return '';
      if (!ISO.test(x) || Number.isNaN(Date.parse(`${x}T00:00:00Z`))) throw bad('HOTEL_PRECHECKIN_DATE', 'Неверная дата');
      return x;
    };
    const prev = r.guests || [];
    const guests: HotelReservationGuest[] = rawGuests.map((g: any, i: number) => {
      const old = prev.find((x) => x.id === g?.id) || prev[i];
      const birth = date(g?.birthDate);
      const age = birth ? Math.floor((Date.parse(`${r.checkIn}T00:00:00Z`) - Date.parse(`${birth}T00:00:00Z`)) / (365.25 * 86400000)) : null;
      const nat = normalizeCountry(g?.nationalityCode || '') || null;
      return {
        ...(old || {}),
        id: old?.id || randomUUID(),
        fullName: s(g?.fullName, 200),
        citizenship: nat || old?.citizenship || '',
        nationalityCode: nat,
        birthDate: birth,
        age: age !== null && age >= 0 ? String(age) : old?.age || '',
        gender: g?.gender === 'M' || g?.gender === 'F' ? g.gender : '',
        documentType: ['passport', 'id_card', 'other'].includes(g?.documentType) ? g.documentType : '',
        passportNumber: s(g?.passportNumber, 40),
        passportExpiry: date(g?.passportExpiry),
        tcKimlikNo: /^\d{11}$/.test(s(g?.tcKimlikNo, 11)) ? s(g?.tcKimlikNo, 11) : old?.tcKimlikNo || '',
        note: old?.note ?? null,
      } as HotelReservationGuest;
    }).filter((g: HotelReservationGuest) => g.fullName);
    // паспорт истекает до выезда — гость должен знать до приезда
    const expired = guests.find((g) => g.passportExpiry && g.passportExpiry < r.checkOut);
    if (expired) throw bad('HOTEL_PRECHECKIN_DOC_EXPIRED', `Документ гостя ${expired.fullName} истекает до выезда`);
    await this.res.update(p.tenantId, r.id, { guests } as any, null, { quiet: true });

    const eta = s(dto.eta, 5);
    p.eta = /^([01]\d|2[0-3]):[0-5]\d$/.test(eta) ? eta : null;
    p.flight = s(dto.flight, 40) || null;
    p.needTransfer = !!dto.needTransfer;
    p.requests = s(dto.requests, 2000) || null;
    p.preferences = [...new Set((Array.isArray(dto.preferences) ? dto.preferences : []).filter((x: string) => (HOTEL_GUEST_PREFERENCES as readonly string[]).includes(x)))] as string[];
    p.consent = true;
    p.language = ['ru', 'en', 'tr'].includes(dto.language) ? dto.language : p.language;
    p.status = 'completed';
    p.completedAt = new Date();
    await this.pre.save(p);

    // предпочтения — в профиль гостя-контакта (не затирая уже известные)
    const fresh = await this.reservations.findOne({ where: { id: r.id, tenantId: p.tenantId } });
    if (fresh?.guestProfileId && p.preferences.length) {
      const prof = await this.profiles.findOne({ where: { id: fresh.guestProfileId, tenantId: p.tenantId } });
      if (prof && !prof.anonymizedAt) {
        prof.preferences = [...new Set([...(prof.preferences || []), ...p.preferences])];
        await this.profiles.save(prof);
      }
    }

    // заявки на допродажу: цену берём из предложений сервера, не из запроса
    const wanted = Array.isArray(dto.upsells) ? dto.upsells.slice(0, 20) : [];
    if (wanted.length) {
      const offers = await this.offers(p.tenantId, fresh || r, hotel);
      const existing = await this.upsells.find({ where: { tenantId: p.tenantId, reservationId: r.id, status: 'requested' } });
      for (const w of wanted) {
        const o = offers.find((x) => x.kind === w?.kind && (x.kind === 'upgrade' ? x.roomTypeId === w.roomTypeId : x.kind === 'extra' ? x.extraServiceId === w.extraServiceId : true));
        if (!o) continue;
        const qty = o.kind === 'extra' ? Math.min(99, Math.max(1, Math.round(num(w.quantity) || o.quantity))) : 1;
        const same = existing.find((x) => x.kind === o.kind && (o.kind !== 'upgrade' || x.roomTypeId === o.roomTypeId) && (o.kind !== 'extra' || x.extraServiceId === o.extraServiceId));
        if (o.kind === 'upgrade') {
          // апгрейд — один: прежняя заявка на другой тип снимается
          for (const x of existing.filter((e) => e.kind === 'upgrade' && e.roomTypeId !== o.roomTypeId)) await this.upsells.delete({ id: x.id });
        }
        const row = same || this.upsells.create({ tenantId: p.tenantId, hotelId: r.hotelId, reservationId: r.id, kind: o.kind, roomTypeId: o.roomTypeId || null, extraServiceId: o.extraServiceId || null, status: 'requested' });
        row.name = o.name.slice(0, 255);
        row.quantity = String(qty);
        row.amount = String(round2(o.amount * (o.kind === 'extra' ? qty : 1)));
        await this.upsells.save(row);
      }
    }
    return this.publicGet(token);
  }

  /** Гость снимает свою заявку, пока отель её не подтвердил */
  async publicCancelRequest(token: string, id: string) {
    const { p, r } = await this.byToken(token);
    const row = await this.upsells.findOne({ where: { id, tenantId: p.tenantId, reservationId: r.id } });
    if (!row) throw new NotFoundException('Заявка не найдена');
    if (row.status !== 'requested') throw bad('HOTEL_UPSELL_DECIDED', 'Отель уже ответил на эту заявку');
    await this.upsells.delete({ id: row.id });
    return this.publicGet(token);
  }

  /** Фото паспорта по ссылке — распознавание с лимитом на ссылку (вызов ИИ за счёт отеля) */
  async publicScan(token: string, file: any, lang: string) {
    const { p } = await this.byToken(token);
    if (p.scanCount >= MAX_SCANS) throw bad('HOTEL_PRECHECKIN_SCAN_LIMIT', 'Лимит распознаваний исчерпан — введите данные вручную');
    p.scanCount++;
    await this.pre.save(p);
    return scanIdDocument(this.moduleRef, p.tenantId, null, file, ['ru', 'en', 'tr'].includes(lang) ? lang : 'en');
  }

  async requests(tenantId: string, q: { hotelId: string; status?: string }) {
    const where: any = { tenantId, hotelId: q.hotelId };
    if (q.status && ['requested', 'approved', 'declined'].includes(q.status)) where.status = q.status;
    const rows = await this.upsells.find({ where, order: { createdAt: 'DESC' }, take: 300 });
    const res = rows.length ? await this.reservations.find({ where: { tenantId, id: In([...new Set(rows.map((x) => x.reservationId))]) } }) : [];
    return rows.map((x) => {
      const r = res.find((y) => y.id === x.reservationId);
      return { ...x, amount: num(x.amount), quantity: num(x.quantity), guestName: r?.guestName || '', checkIn: r?.checkIn || null, checkOut: r?.checkOut || null, reservationStatus: r?.status || null };
    });
  }

  /**
   * Решение по заявке. Апгрейд — смена типа номера с пересчётом цены и проверкой мест; ранний заезд / поздний выезд —
   * отметка в брони и начисление в фолио по согласованной цене; услуга — начисление в фолио.
   */
  async decide(tenantId: string, id: string, approve: boolean, actor: string | null, note?: string) {
    const row = await this.upsells.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Заявка не найдена');
    if (row.status !== 'requested') throw bad('HOTEL_UPSELL_DECIDED', 'По заявке уже есть решение');
    const r = await this.reservations.findOne({ where: { id: row.reservationId, tenantId } });
    if (!r || (!OPEN.includes(r.status) && r.status !== 'checked_in')) throw bad('HOTEL_PRECHECKIN_CLOSED', 'Бронь закрыта');
    if (approve) {
      if (row.kind === 'upgrade') {
        if (r.status === 'checked_in') throw bad('HOTEL_UPSELL_IN_HOUSE', 'Гость уже заселён — переселите через шахматку');
        const before = num(r.total);
        const updated = await this.res.update(tenantId, r.id, { roomTypeId: row.roomTypeId, roomUnitId: null, occupancyTypeId: null, priceMode: 'auto' } as any, actor);
        row.amount = String(round2(num(updated.total) - before));
      } else if (row.kind === 'early_checkin' || row.kind === 'late_checkout') {
        await this.res.update(tenantId, r.id, row.kind === 'early_checkin' ? { earlyCheckIn: true } : { lateCheckOut: true } as any, actor, { quiet: true });
        const line = await this.folio.postLine(tenantId, r.id, { kind: row.kind, description: row.name, quantity: 1, unitPrice: row.amount }, actor);
        row.folioLineId = line.id;
      } else {
        const qty = num(row.quantity) || 1;
        const line = await this.folio.postLine(tenantId, r.id, { kind: 'extra', extraServiceId: row.extraServiceId, description: row.name, quantity: qty, unitPrice: String(round2(num(row.amount) / qty)) }, actor);
        row.folioLineId = line.id;
      }
    }
    row.status = approve ? 'approved' : 'declined';
    row.decidedBy = actor;
    row.decidedAt = new Date();
    row.note = String(note || '').trim().slice(0, 1000) || null;
    return this.upsells.save(row);
  }

  async settings(tenantId: string, hotelId: string, dto: { precheckinAutoDays?: number | null; precheckinUpgrades?: boolean }) {
    const hotel = await this.hotels.findOne({ where: { id: hotelId, tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    if (dto.precheckinAutoDays !== undefined) {
      const d = dto.precheckinAutoDays === null || (dto.precheckinAutoDays as any) === '' ? null : Math.round(num(dto.precheckinAutoDays));
      if (d !== null && (d < 1 || d > 30)) throw bad('HOTEL_PRECHECKIN_DAYS', 'Отправлять — за 1–30 дней до заезда');
      hotel.precheckinAutoDays = d;
    }
    if (dto.precheckinUpgrades !== undefined) hotel.precheckinUpgrades = !!dto.precheckinUpgrades;
    await this.hotels.save(hotel);
    return { precheckinAutoDays: hotel.precheckinAutoDays, precheckinUpgrades: hotel.precheckinUpgrades };
  }

  /** Автоотправка: отели с «за N дней», брони с заездом через N дней по времени отеля, email есть, письмо ещё не уходило */
  async autoSend(): Promise<number> {
    const hotels = await this.hotels.find({ where: { precheckinAutoDays: Not(IsNull()) } });
    let sent = 0;
    for (const h of hotels) {
      if (!h.precheckinAutoDays) continue;
      const day = new Date(Date.parse(`${hotelToday(h)}T00:00:00Z`) + h.precheckinAutoDays * 86400000).toISOString().slice(0, 10);
      const rows = await this.reservations.find({ where: { tenantId: h.tenantId, hotelId: h.id, checkIn: day, status: In(OPEN) as any, roomingPending: false } });
      for (const r of rows) {
        if (!r.guestEmail) continue;
        const p = await this.pre.findOne({ where: { tenantId: h.tenantId, reservationId: r.id } });
        if (p?.sentAt || p?.status === 'completed') continue;
        try {
          await this.send(h.tenantId, r.id);
          sent++;
        } catch (e) {
          this.log.warn(`precheckin auto-send ${r.id}: ${(e as Error).message}`);
        }
      }
    }
    return sent;
  }
}
