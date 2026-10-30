import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { In, IsNull, MoreThan, Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelRoomUnit } from './hotel-room-unit.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { HOTEL_ISSUE_CATEGORIES } from './hotel-housekeeping.entities';
import { HotelHousekeepingService } from './hotel-housekeeping.service';
import {
  HOTEL_GUEST_HK_CATEGORIES,
  HOTEL_GUEST_REQUEST_CATEGORIES,
  HotelGuestRequest,
  HotelGuestRequestCategory,
  HotelGuestRequestStatus,
} from './hotel-guest-care.entity';

const bad = (code: string, message: string) => new BadRequestException({ code, message });
const digits = (v: string | null | undefined) => String(v || '').replace(/\D/g, '');
/** Один и тот же номер телефона в разных записях (+90 532…, 0532…): сравниваем последние 10 цифр */
const samePhone = (a: string, b: string) => a.length >= 7 && b.length >= 7 && a.slice(-10) === b.slice(-10);
const PUBLIC_LIMIT_PER_HOUR = 6;

/**
 * Guest Care: заявки гостей из QR-кода в номере (публичная страница без входа) и из WhatsApp проживающих.
 * Бытовые (полотенца, уборка, принадлежности, минибар) — в уборку; техническая — сразу неисправность для техников.
 */
@Injectable()
export class HotelGuestCareService {
  constructor(
    @InjectRepository(HotelGuestRequest) private readonly requests: Repository<HotelGuestRequest>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelRoomUnit) private readonly units: Repository<HotelRoomUnit>,
    @InjectRepository(HotelReservation) private readonly reservations: Repository<HotelReservation>,
    private readonly housekeeping: HotelHousekeepingService,
  ) {}

  private async hotel(tenantId: string, id: string) {
    const h = await this.hotels.findOne({ where: { id, tenantId } });
    if (!h) throw new NotFoundException('Отель не найден');
    return h;
  }

  /** Ссылки QR по номерам отеля; недостающие токены создаются */
  async qrLinks(tenantId: string, hotelId: string) {
    const h = await this.hotel(tenantId, hotelId);
    const list = await this.units.find({ where: { tenantId, hotelId: h.id, active: true }, order: { label: 'ASC' } });
    const missing = list.filter((u) => !u.guestToken);
    for (const u of missing) u.guestToken = randomBytes(12).toString('base64url');
    if (missing.length) await this.units.save(missing);
    return list.map((u) => ({ roomUnitId: u.id, label: u.label, floor: u.floor, token: u.guestToken as string }));
  }

  /** Новый токен номера — старый QR перестаёт работать (например, наклейку сорвали и унесли) */
  async rotateToken(tenantId: string, roomUnitId: string) {
    const u = await this.units.findOne({ where: { id: roomUnitId, tenantId } });
    if (!u) throw new NotFoundException('Номер не найден');
    u.guestToken = randomBytes(12).toString('base64url');
    await this.units.save(u);
    return { roomUnitId: u.id, token: u.guestToken };
  }

  private async byToken(token: string) {
    if (!/^[A-Za-z0-9_-]{8,40}$/.test(token || '')) throw new NotFoundException('Ссылка недействительна');
    const unit = await this.units.findOne({ where: { guestToken: token, active: true } });
    if (!unit) throw new NotFoundException('Ссылка недействительна');
    const hotel = await this.hotels.findOne({ where: { id: unit.hotelId, tenantId: unit.tenantId } });
    if (!hotel) throw new NotFoundException('Ссылка недействительна');
    return { unit, hotel };
  }

  /** Публично: отель и номер (без данных гостя) */
  async publicInfo(token: string) {
    const { unit, hotel } = await this.byToken(token);
    return { hotelName: hotel.name, room: unit.label, country: hotel.country || null, maintenance: HOTEL_ISSUE_CATEGORIES };
  }

  private async nextNumber(tenantId: string, hotelId: string) {
    const r = await this.requests.createQueryBuilder('g').select('MAX(g.number)', 'm').where('g.tenantId = :tenantId AND g.hotelId = :hotelId', { tenantId, hotelId }).getRawOne();
    return (Number(r?.m) || 0) + 1;
  }

  private async inHouse(tenantId: string, roomUnitId: string) {
    return this.reservations.findOne({ where: { tenantId, roomUnitId, status: 'checked_in' }, order: { checkIn: 'DESC' } });
  }

  /** Публично: заявка из QR. Не больше 6 в час с одного номера — от спама и случайных повторов */
  async publicCreate(token: string, dto: { category?: string; subcategory?: string; text?: string; guestName?: string; lang?: string }) {
    const { unit, hotel } = await this.byToken(token);
    const category = String(dto.category || '') as HotelGuestRequestCategory;
    if (!(HOTEL_GUEST_REQUEST_CATEGORIES as readonly string[]).includes(category) || category === 'message') throw bad('HOTEL_GUEST_REQUEST_CATEGORY', 'Выберите, что нужно');
    const text = String(dto.text || '').trim().slice(0, 1000) || null;
    if ((category === 'other' || category === 'noise') && !text) throw bad('HOTEL_GUEST_REQUEST_TEXT', 'Опишите, что нужно');
    const recent = await this.requests.count({ where: { tenantId: unit.tenantId, roomUnitId: unit.id, source: 'qr', createdAt: MoreThan(new Date(Date.now() - 3600_000)) } });
    if (recent >= PUBLIC_LIMIT_PER_HOUR) throw bad('HOTEL_GUEST_REQUEST_LIMIT', 'Слишком много заявок — позвоните на ресепшн');
    const res = await this.inHouse(unit.tenantId, unit.id);
    const req = await this.create(unit.tenantId, hotel, {
      roomUnitId: unit.id,
      reservationId: res?.id ?? null,
      source: 'qr',
      category,
      subcategory: dto.subcategory ? String(dto.subcategory).slice(0, 24) : null,
      text,
      guestName: String(dto.guestName || '').trim().slice(0, 120) || res?.guestName || null,
      guestPhone: null,
      lang: ['ru', 'en', 'tr', 'de'].includes(String(dto.lang)) ? String(dto.lang) : null,
    });
    return { number: req.number, category: req.category };
  }

  private async create(tenantId: string, hotel: Hotel, d: Omit<HotelGuestRequest, 'id' | 'tenantId' | 'hotelId' | 'number' | 'status' | 'assigneeUserId' | 'maintenanceIssueId' | 'staffNote' | 'startedAt' | 'doneAt' | 'createdAt' | 'updatedAt'>) {
    const row = await this.requests.save(this.requests.create({ ...d, tenantId, hotelId: hotel.id, number: await this.nextNumber(tenantId, hotel.id), status: 'new' }));
    // техническая — сразу неисправность для техников (срочно, если гость в номере)
    if (row.category === 'maintenance') {
      const cat = (HOTEL_ISSUE_CATEGORIES as readonly string[]).includes(String(row.subcategory)) ? row.subcategory : 'other';
      const { issue } = await this.housekeeping.createIssue(tenantId, {
        hotelId: hotel.id,
        roomUnitId: row.roomUnitId,
        category: cat || 'other',
        priority: row.reservationId ? 'high' : 'normal',
        description: `Заявка гостя №${row.number}${row.text ? `: ${row.text}` : ''}`,
      }, null);
      row.maintenanceIssueId = issue.id;
      await this.requests.save(row);
    }
    return row;
  }

  /** Сотрудник записывает заявку со слов гостя (звонок на ресепшн) */
  async staffCreate(tenantId: string, dto: { hotelId?: string; roomUnitId?: string | null; category?: string; subcategory?: string; text?: string }) {
    const hotel = await this.hotel(tenantId, dto.hotelId || '');
    const category = String(dto.category || '') as HotelGuestRequestCategory;
    if (!(HOTEL_GUEST_REQUEST_CATEGORIES as readonly string[]).includes(category)) throw bad('HOTEL_GUEST_REQUEST_CATEGORY', 'Выберите, что нужно');
    let unit: HotelRoomUnit | null = null;
    if (dto.roomUnitId) {
      unit = await this.units.findOne({ where: { id: dto.roomUnitId, tenantId, hotelId: hotel.id } });
      if (!unit) throw bad('HOTEL_HK_UNIT_NOT_FOUND', 'Номер не из этого отеля');
    }
    const res = unit ? await this.inHouse(tenantId, unit.id) : null;
    return this.create(tenantId, hotel, {
      roomUnitId: unit?.id ?? null,
      reservationId: res?.id ?? null,
      source: 'staff',
      category,
      subcategory: dto.subcategory ? String(dto.subcategory).slice(0, 24) : null,
      text: String(dto.text || '').trim().slice(0, 1000) || null,
      guestName: res?.guestName ?? null,
      guestPhone: null,
      lang: null,
    });
  }

  async list(tenantId: string, q: { hotelId?: string; status?: string; days?: number }) {
    const since = new Date(Date.now() - Math.min(60, Math.max(1, Number(q.days) || 7)) * 86_400_000);
    const where: any = { tenantId, createdAt: MoreThan(since) };
    if (q.hotelId) where.hotelId = q.hotelId;
    if (q.status === 'open') where.status = In(['new', 'in_progress']);
    else if (q.status) where.status = q.status;
    const rows = await this.requests.find({ where, order: { createdAt: 'DESC' }, take: 300 });
    const unitIds = [...new Set(rows.map((r) => r.roomUnitId).filter(Boolean))] as string[];
    const units = unitIds.length ? await this.units.find({ where: { tenantId, id: In(unitIds) } }) : [];
    const label = new Map(units.map((u) => [u.id, u.label]));
    const staff = await this.housekeeping.staff(tenantId);
    return { requests: rows.map((r) => ({ ...r, room: r.roomUnitId ? label.get(r.roomUnitId) || null : null })), staff };
  }

  /** Горничная: бытовые заявки — свои и никому не назначенные, открытые */
  async mine(tenantId: string, userId: string) {
    const rows = await this.requests.find({
      where: [
        { tenantId, status: In(['new', 'in_progress']), category: In(HOTEL_GUEST_HK_CATEGORIES), assigneeUserId: userId },
        { tenantId, status: In(['new', 'in_progress']), category: In(HOTEL_GUEST_HK_CATEGORIES), assigneeUserId: IsNull() },
      ],
      order: { createdAt: 'ASC' },
      take: 100,
    });
    const unitIds = [...new Set(rows.map((r) => r.roomUnitId).filter(Boolean))] as string[];
    const units = unitIds.length ? await this.units.find({ where: { tenantId, id: In(unitIds) } }) : [];
    const label = new Map(units.map((u) => [u.id, u.label]));
    return rows.map((r) => ({ ...r, room: r.roomUnitId ? label.get(r.roomUnitId) || null : null }));
  }

  async update(tenantId: string, id: string, dto: { status?: string; assigneeUserId?: string | null; staffNote?: string | null }, actorUserId?: string | null) {
    const r = await this.requests.findOne({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Заявка не найдена');
    if (dto.assigneeUserId !== undefined) {
      if (dto.assigneeUserId && !(await this.housekeeping.staff(tenantId)).some((s) => s.id === dto.assigneeUserId)) throw bad('HOTEL_HK_STAFF_NOT_FOUND', 'Сотрудник не найден');
      r.assigneeUserId = dto.assigneeUserId || null;
    }
    if (dto.staffNote !== undefined) r.staffNote = String(dto.staffNote || '').trim().slice(0, 1000) || null;
    const st = dto.status as HotelGuestRequestStatus | undefined;
    if (st && ['new', 'in_progress', 'done', 'cancelled'].includes(st) && st !== r.status) {
      r.status = st;
      if (st === 'in_progress') { r.startedAt = r.startedAt || new Date(); if (!r.assigneeUserId && actorUserId) r.assigneeUserId = actorUserId; }
      if (st === 'done' || st === 'cancelled') r.doneAt = new Date();
      if (st === 'new') { r.startedAt = null; r.doneAt = null; }
    }
    return this.requests.save(r);
  }

  /**
   * WhatsApp проживающего гостя (номер совпал с телефоном заселённой брони) → заявка «сообщение».
   * Несколько сообщений подряд — в одну открытую заявку (не плодим карточки на «спасибо» и уточнения).
   */
  async onWhatsappMessage(tenantId: string, fromDigits: string, text: string | null) {
    const from = digits(fromDigits);
    if (!from || !text) return null;
    const hotels = await this.hotels.find({ where: { tenantId, guestCareWhatsapp: true } });
    if (!hotels.length) return null;
    const inHouse = await this.reservations.find({ where: { tenantId, status: 'checked_in', hotelId: In(hotels.map((h) => h.id)) } });
    const res = inHouse.find((r) => samePhone(digits(r.guestPhone), from));
    if (!res) return null;
    const open = await this.requests.findOne({
      where: { tenantId, reservationId: res.id, source: 'whatsapp', status: 'new', createdAt: MoreThan(new Date(Date.now() - 30 * 60_000)) },
      order: { createdAt: 'DESC' },
    });
    const clean = text.trim().slice(0, 1000);
    if (open) {
      open.text = `${open.text || ''}\n${clean}`.trim().slice(0, 4000);
      return this.requests.save(open);
    }
    const hotel = hotels.find((h) => h.id === res.hotelId)!;
    return this.create(tenantId, hotel, {
      roomUnitId: res.roomUnitId,
      reservationId: res.id,
      source: 'whatsapp',
      category: 'message',
      subcategory: null,
      text: clean,
      guestName: res.guestName,
      guestPhone: res.guestPhone,
      lang: null,
    });
  }
}
