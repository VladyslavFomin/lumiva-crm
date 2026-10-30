import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import { resolveUnicodePdfFont } from '../common/pdf-font.util';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomUnit } from './hotel-room-unit.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelRoomOutage } from './hotel-housekeeping.entities';
import { HotelCashShift, HotelFolioLine, HotelNightAudit } from './hotel-folio.entities';
import { folioSummary, hotelToday } from './hotel-folio.service';
import { HotelReservationsService } from './hotel-reservations.service';
import { TenantMailService } from '../mail/tenant-mail.service';

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const nightsOf = (r: Pick<HotelReservation, 'checkIn' | 'checkOut'>) =>
  Math.max(1, Math.round((Date.parse(`${r.checkOut}T00:00:00Z`) - Date.parse(`${r.checkIn}T00:00:00Z`)) / 86_400_000));
const bad = (code: string, message: string, extra: Record<string, unknown> = {}) => new BadRequestException({ code, message, ...extra });

/** Местное время отеля «HH:MM» */
function hotelClock(hotel: Pick<Hotel, 'timezone'>, now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: hotel.timezone || 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  } catch {
    return now.toISOString().slice(11, 16);
  }
}

/**
 * Какой день закрывает аудит: открытая бизнес-дата; до первого аудита — вчера, если на часах отеля утро
 * (аудит обычно запускают ночью после полуночи), иначе сегодня.
 */
export function auditDateOf(hotel: Pick<Hotel, 'timezone' | 'businessDate'>, now = new Date()) {
  if (hotel.businessDate) return hotel.businessDate;
  const today = hotelToday(hotel, now);
  return hotelClock(hotel, now) < '12:00' ? addDays(today, -1) : today;
}

export type AuditLang = 'ru' | 'en' | 'tr';
type Snapshot = {
  available: number; sold: number; comp: number; occupancyPct: number; roomRevenue: number; adr: number; revpar: number;
  extrasRevenue: number; feesRevenue: number; totalRevenue: number; arrivals: number; departures: number; noShows: number; cancellations: number;
  inHouseGuests: number; payments: Record<string, number>; paymentsTotal: number; openBalance: number; outOfOrder: number;
  byRoomType: Array<{ roomTypeId: string; name: string; available: number; sold: number; revenue: number }>;
  currency: string;
};

/** Ночной аудит (PMS-090…094) */
@Injectable()
export class HotelNightAuditService {
  private readonly log = new Logger(HotelNightAuditService.name);

  constructor(
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelRoomType) private readonly roomTypes: Repository<HotelRoomType>,
    @InjectRepository(HotelRoomUnit) private readonly units: Repository<HotelRoomUnit>,
    @InjectRepository(HotelReservation) private readonly reservations: Repository<HotelReservation>,
    @InjectRepository(HotelRoomOutage) private readonly outages: Repository<HotelRoomOutage>,
    @InjectRepository(HotelFolioLine) private readonly lines: Repository<HotelFolioLine>,
    @InjectRepository(HotelCashShift) private readonly shifts: Repository<HotelCashShift>,
    @InjectRepository(HotelNightAudit) private readonly audits: Repository<HotelNightAudit>,
    private readonly reservationsService: HotelReservationsService,
    private readonly tenantMail: TenantMailService,
  ) {}

  private async hotel(tenantId: string, hotelId: string) {
    const h = await this.hotels.findOne({ where: { id: hotelId, tenantId } });
    if (!h) throw new NotFoundException('Отель не найден');
    return h;
  }

  private brief(r: HotelReservation) {
    return { id: r.id, guestName: r.guestName, checkIn: r.checkIn, checkOut: r.checkOut, status: r.status, roomUnitId: r.roomUnitId, bookingCode: r.bookingCode };
  }

  /** Проверки перед закрытием дня (PMS-091) */
  private async checksFor(tenantId: string, hotel: Hotel, day: string) {
    const base = () => this.reservations.createQueryBuilder('r').where('r.tenantId = :tenantId AND r.hotelId = :hotelId', { tenantId, hotelId: hotel.id });
    const [pendingArrivals, pendingDepartures, departedToday, openShift] = await Promise.all([
      base().andWhere('r.checkIn <= :day', { day }).andWhere('r.checkOut > :day', { day }).andWhere("r.status IN ('confirmed','pending')").orderBy('r.checkIn', 'ASC').getMany(),
      base().andWhere('r.checkOut <= :day', { day }).andWhere("r.status = 'checked_in'").orderBy('r.checkOut', 'ASC').getMany(),
      base().andWhere('r.checkOut = :day', { day }).andWhere("r.status = 'checked_out'").getMany(),
      this.shifts.findOne({ where: { tenantId, hotelId: hotel.id, status: 'open' } }),
    ]);
    const unpaidDepartures = departedToday
      .map((r) => ({ r, balance: round2(folioSummary(r, [], hotel).balance + num(r.extrasTotal)) }))
      .filter((x) => x.balance > 0.009)
      .map((x) => ({ ...this.brief(x.r), balance: x.balance }));
    return {
      pendingArrivals: pendingArrivals.map((r) => this.brief(r)),
      pendingDepartures: pendingDepartures.map((r) => this.brief(r)),
      unpaidDepartures,
      openShift: openShift ? { id: openShift.id, openedAt: openShift.openedAt } : null,
    };
  }

  async status(tenantId: string, hotelId: string) {
    const hotel = await this.hotel(tenantId, hotelId);
    const day = auditDateOf(hotel);
    const [checks, history] = await Promise.all([
      this.checksFor(tenantId, hotel, day),
      this.audits.find({ where: { tenantId, hotelId }, order: { businessDate: 'DESC' }, take: 30 }),
    ]);
    return {
      auditDate: day,
      today: hotelToday(hotel),
      canRun: day <= hotelToday(hotel),
      lastAuditDate: hotel.lastAuditDate,
      checks,
      history: history.map((a) => ({ id: a.id, businessDate: a.businessDate, mode: a.mode, completedAt: a.completedAt, snapshot: a.snapshot, reportSentAt: a.reportSentAt, checks: a.checks })),
      settings: { nightAuditAuto: hotel.nightAuditAuto, nightAuditTime: hotel.nightAuditTime, timezone: hotel.timezone, nightAuditEmails: hotel.nightAuditEmails || '', currency: hotel.currency },
    };
  }

  async saveSettings(tenantId: string, dto: { hotelId: string; nightAuditAuto?: boolean; nightAuditTime?: string; timezone?: string; nightAuditEmails?: string }) {
    const hotel = await this.hotel(tenantId, dto.hotelId);
    if (dto.nightAuditAuto !== undefined) hotel.nightAuditAuto = !!dto.nightAuditAuto;
    if (dto.nightAuditTime !== undefined) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(dto.nightAuditTime)) throw bad('HOTEL_AUDIT_BAD_TIME', 'Время в формате ЧЧ:ММ');
      hotel.nightAuditTime = dto.nightAuditTime;
    }
    if (dto.timezone !== undefined) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: dto.timezone });
      } catch {
        throw bad('HOTEL_AUDIT_BAD_TZ', 'Неизвестный часовой пояс');
      }
      hotel.timezone = dto.timezone;
    }
    if (dto.nightAuditEmails !== undefined) {
      const list = String(dto.nightAuditEmails || '').split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
      const wrong = list.find((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
      if (wrong) throw bad('HOTEL_AUDIT_BAD_EMAIL', `Неверный email: ${wrong}`);
      hotel.nightAuditEmails = list.join(', ') || null;
    }
    await this.hotels.save(hotel);
    return this.status(tenantId, hotel.id);
  }

  /** Снимок дня (PMS-092): загрузка, ADR, RevPAR, выручка (проживание, услуги, штрафы), оплаты, движение гостей */
  async snapshotFor(tenantId: string, hotel: Hotel, day: string): Promise<Snapshot> {
    const [types, units, outs, stay, closedToday, linesToday, paidToday] = await Promise.all([
      this.roomTypes.find({ where: { tenantId, hotelId: hotel.id } }),
      this.units.find({ where: { tenantId, hotelId: hotel.id, active: true } }),
      this.outages.find({ where: { tenantId, hotelId: hotel.id, kind: 'ooo' } }),
      this.reservations.createQueryBuilder('r').where('r.tenantId = :tenantId AND r.hotelId = :hotelId', { tenantId, hotelId: hotel.id })
        .andWhere('r.checkIn <= :day AND r.checkOut >= :day', { day }).andWhere("r.status IN ('checked_in','checked_out','no_show')").getMany(),
      this.reservations.createQueryBuilder('r').where('r.tenantId = :tenantId AND r.hotelId = :hotelId', { tenantId, hotelId: hotel.id })
        .andWhere("r.status IN ('cancelled','no_show')")
        .andWhere(`(to_char(r."cancelledAt" AT TIME ZONE :tz, 'YYYY-MM-DD') = :day OR to_char(r."noShowAt" AT TIME ZONE :tz, 'YYYY-MM-DD') = :day)`, { day, tz: hotel.timezone || 'Europe/Istanbul' })
        .getMany(),
      this.lines.find({ where: { tenantId, hotelId: hotel.id, serviceDate: day } }),
      this.reservations.createQueryBuilder('r').where('r.tenantId = :tenantId AND r.hotelId = :hotelId', { tenantId, hotelId: hotel.id })
        .andWhere('r.payments @> :needle::jsonb', { needle: JSON.stringify([{ date: day }]) }).getMany(),
    ]);
    const oooIds = new Set(units.filter((u) => u.housekeepingStatus === 'out_of_order' || outs.some((o) => o.roomUnitId === u.id && o.dateFrom <= day && (!o.dateTo || day < o.dateTo))).map((u) => u.id));
    const typeCount = new Map<string, number>();
    for (const u of units) if (!oooIds.has(u.id)) typeCount.set(u.roomTypeId, (typeCount.get(u.roomTypeId) || 0) + 1);
    // отели без поштучных номеров — вместимость из количества по типу
    for (const t of types) if (!units.some((u) => u.roomTypeId === t.id)) typeCount.set(t.id, t.quantity || 0);
    const sleeping = stay.filter((r) => r.checkIn <= day && r.checkOut > day && (r.status === 'checked_in' || r.status === 'checked_out'));
    const nightly = (r: HotelReservation) => num(r.total) / nightsOf(r);
    const byRoomType = types.map((t) => {
      const sold = sleeping.filter((r) => r.roomTypeId === t.id);
      return { roomTypeId: t.id, name: t.name, available: typeCount.get(t.id) || 0, sold: sold.length, revenue: round2(sold.reduce((s, r) => s + nightly(r), 0)) };
    });
    const available = byRoomType.reduce((s, x) => s + x.available, 0);
    const sold = sleeping.length;
    const comp = sleeping.filter((r) => r.isComplimentary).length;
    const roomRevenue = round2(sleeping.reduce((s, r) => s + nightly(r), 0));
    const extrasRevenue = round2(linesToday.reduce((s, l) => s + num(l.amount), 0));
    const feesRevenue = round2(closedToday.reduce((s, r) => s + num(r.cancellationFee), 0));
    const payments: Record<string, number> = {};
    for (const r of paidToday) for (const p of r.payments || []) if (p.date === day) payments[p.method] = round2((payments[p.method] || 0) + num(p.amount));
    const inHouse = sleeping.filter((r) => r.status === 'checked_in');
    const openBalance = round2(inHouse.reduce((s, r) => s + folioSummary(r, [], hotel).balance + num(r.extrasTotal), 0));
    const paidRooms = sold - comp;
    return {
      available, sold, comp,
      occupancyPct: available ? round2((sold / available) * 100) : 0,
      roomRevenue,
      adr: paidRooms > 0 ? round2(roomRevenue / paidRooms) : 0,
      revpar: available ? round2(roomRevenue / available) : 0,
      extrasRevenue, feesRevenue, totalRevenue: round2(roomRevenue + extrasRevenue + feesRevenue),
      arrivals: stay.filter((r) => r.checkIn === day && (r.status === 'checked_in' || r.status === 'checked_out')).length,
      departures: stay.filter((r) => r.checkOut === day && r.status === 'checked_out').length,
      noShows: closedToday.filter((r) => r.status === 'no_show').length,
      cancellations: closedToday.filter((r) => r.status === 'cancelled').length,
      inHouseGuests: inHouse.reduce((s, r) => s + (r.pax || 0), 0),
      payments,
      paymentsTotal: round2(Object.values(payments).reduce((s, v) => s + v, 0)),
      openBalance,
      outOfOrder: oooIds.size,
      byRoomType,
      currency: (hotel.currency || '').toUpperCase(),
    };
  }

  /**
   * Закрыть день: проверки → (по желанию) no-show незаехавших → снимок → новая бизнес-дата → отчёт на почту.
   * Незаехавшие и невыселенные гости блокируют закрытие, пока их не обработают или не выбраны авто-действия.
   */
  async run(
    tenantId: string,
    hotelId: string,
    opts: { autoNoShow?: boolean; noShowFee?: 'none' | 'first_night'; ignoreDepartures?: boolean; ignoreOpenShift?: boolean },
    actorUserId: string | null,
    mode: 'manual' | 'auto' = 'manual',
  ) {
    const hotel = await this.hotel(tenantId, hotelId);
    const day = auditDateOf(hotel);
    if (day > hotelToday(hotel)) throw bad('HOTEL_AUDIT_FUTURE', 'Этот день ещё не наступил');
    if (await this.audits.findOne({ where: { tenantId, hotelId, businessDate: day } })) throw bad('HOTEL_AUDIT_DONE', 'День уже закрыт');
    const checks = await this.checksFor(tenantId, hotel, day);
    if (checks.pendingArrivals.length && !opts.autoNoShow) {
      throw bad('HOTEL_AUDIT_PENDING_ARRIVALS', 'Есть незаехавшие гости: заселите, отмените или отметьте no-show', { list: checks.pendingArrivals });
    }
    if (checks.pendingDepartures.length && !opts.ignoreDepartures) {
      throw bad('HOTEL_AUDIT_PENDING_DEPARTURES', 'Есть гости с прошедшей датой выезда: выселите или продлите', { list: checks.pendingDepartures });
    }
    if (checks.openShift && !opts.ignoreOpenShift) throw bad('HOTEL_AUDIT_OPEN_SHIFT', 'Кассовая смена не закрыта');
    const noShowDone: string[] = [];
    const noShowFailed: Array<{ id: string; message: string }> = [];
    if (opts.autoNoShow) {
      for (const a of checks.pendingArrivals.filter((x) => x.checkIn <= day)) {
        try {
          await this.reservationsService.noShow(tenantId, a.id, { fee: opts.noShowFee === 'first_night' ? null : 0, note: 'Ночной аудит' }, actorUserId);
          noShowDone.push(a.id);
        } catch (e) {
          noShowFailed.push({ id: a.id, message: (e as Error).message });
        }
      }
    }
    const snapshot = await this.snapshotFor(tenantId, hotel, day);
    const audit = await this.audits.save(this.audits.create({
      tenantId, hotelId, businessDate: day, mode, runBy: actorUserId, completedAt: new Date(), snapshot: snapshot as any,
      checks: { ...checks, noShowDone, noShowFailed, ignoredDepartures: opts.ignoreDepartures ? checks.pendingDepartures.length : 0, options: opts } as any,
    }));
    hotel.lastAuditDate = day;
    hotel.businessDate = addDays(day, 1);
    await this.hotels.save(hotel);
    await this.sendReport(tenantId, audit.id).catch((e) => this.log.warn(`audit report not sent: ${(e as Error).message}`));
    return this.audits.findOne({ where: { id: audit.id } });
  }

  async getAudit(tenantId: string, id: string) {
    const a = await this.audits.findOne({ where: { id, tenantId } });
    if (!a) throw new NotFoundException('Аудит не найден');
    return a;
  }

  async reportPdf(tenantId: string, id: string, lang: AuditLang) {
    const a = await this.getAudit(tenantId, id);
    const hotel = await this.hotel(tenantId, a.hotelId);
    return renderAuditPdf(hotel, a, lang);
  }

  /** Отчёт GM и финансам (PMS-093) — с почты отеля; адресов нет — ничего не отправляем */
  async sendReport(tenantId: string, id: string) {
    const a = await this.getAudit(tenantId, id);
    const hotel = await this.hotel(tenantId, a.hotelId);
    const to = String(hotel.nightAuditEmails || '').split(/[,;\s]+/).filter(Boolean);
    if (!to.length) return { sent: false, reason: 'no_recipients' };
    const pdf = await renderAuditPdf(hotel, a, 'ru');
    const s = a.snapshot as unknown as Snapshot;
    await this.tenantMail.sendOrThrow(tenantId, {
      to,
      subject: `Ночной аудит ${hotel.name} — ${a.businessDate}`,
      html: `<p>${hotel.name}: день ${a.businessDate} закрыт.</p><p>Загрузка ${s.occupancyPct}% · ADR ${s.adr} ${s.currency} · RevPAR ${s.revpar} ${s.currency} · выручка ${s.totalRevenue} ${s.currency}</p>`,
      attachments: [{ filename: `night-audit-${a.businessDate}.pdf`, content: pdf.toString('base64') }],
    });
    a.reportSentAt = new Date();
    await this.audits.save(a);
    return { sent: true };
  }

  /** Крон: отели с автоаудитом, у которых наступило время и открытый день уже прошёл */
  async runDue(now = new Date()) {
    const due = await this.hotels.find({ where: { nightAuditAuto: true } });
    let ran = 0;
    for (const h of due) {
      const day = auditDateOf(h, now);
      if (day >= hotelToday(h, now) || hotelClock(h, now) < (h.nightAuditTime || '03:00')) continue;
      try {
        await this.run(h.tenantId, h.id, { autoNoShow: true, noShowFee: 'none', ignoreDepartures: true, ignoreOpenShift: true }, null, 'auto');
        ran += 1;
      } catch (e) {
        this.log.warn(`auto night audit ${h.id} ${day}: ${(e as Error).message}`);
      }
    }
    return ran;
  }
}

const AL: Record<AuditLang, Record<string, string>> = {
  ru: { title: 'Ночной аудит', day: 'Бизнес-день', occ: 'Загрузка', adr: 'ADR', revpar: 'RevPAR', rooms: 'Номеров продано / доступно', comp: 'из них бесплатно', ooo: 'Не работает',
    rev: 'Выручка', room: 'Проживание', extras: 'Доп. услуги', fees: 'Штрафы (отмены, no-show)', total: 'Итого', moves: 'Движение гостей', arr: 'Заезды', dep: 'Выезды', ns: 'No-show', canc: 'Отмены',
    inh: 'Гостей в отеле', pay: 'Оплаты за день', open: 'Неоплачено у проживающих', byType: 'По типам номеров', type: 'Тип', sold: 'Продано', avail: 'Доступно', revenue: 'Выручка',
    mode: 'Режим', auto: 'автоматически', manual: 'вручную', cash: 'Наличные', card: 'Карта', bank_transfer: 'Перевод', other: 'Другое', none: 'нет' },
  en: { title: 'Night audit', day: 'Business day', occ: 'Occupancy', adr: 'ADR', revpar: 'RevPAR', rooms: 'Rooms sold / available', comp: 'of them complimentary', ooo: 'Out of order',
    rev: 'Revenue', room: 'Accommodation', extras: 'Extras', fees: 'Fees (cancellations, no-shows)', total: 'Total', moves: 'Guest movement', arr: 'Arrivals', dep: 'Departures', ns: 'No-shows', canc: 'Cancellations',
    inh: 'Guests in house', pay: 'Payments of the day', open: 'Open balance of in-house guests', byType: 'By room type', type: 'Type', sold: 'Sold', avail: 'Available', revenue: 'Revenue',
    mode: 'Mode', auto: 'automatic', manual: 'manual', cash: 'Cash', card: 'Card', bank_transfer: 'Bank transfer', other: 'Other', none: 'none' },
  tr: { title: 'Gece denetimi', day: 'İş günü', occ: 'Doluluk', adr: 'ADR', revpar: 'RevPAR', rooms: 'Satılan / müsait oda', comp: 'bunların ücretsizi', ooo: 'Arızalı',
    rev: 'Gelir', room: 'Konaklama', extras: 'Ek hizmetler', fees: 'Cezalar (iptal, no-show)', total: 'Toplam', moves: 'Misafir hareketi', arr: 'Girişler', dep: 'Çıkışlar', ns: 'No-show', canc: 'İptaller',
    inh: 'Oteldeki misafir', pay: 'Günün ödemeleri', open: 'Konaklayanların açık bakiyesi', byType: 'Oda tiplerine göre', type: 'Tip', sold: 'Satılan', avail: 'Müsait', revenue: 'Gelir',
    mode: 'Mod', auto: 'otomatik', manual: 'manuel', cash: 'Nakit', card: 'Kart', bank_transfer: 'Havale', other: 'Diğer', none: 'yok' },
};

export function renderAuditPdf(hotel: Hotel, audit: HotelNightAudit, lang: AuditLang): Promise<Buffer> {
  const t = AL[lang] || AL.ru;
  const s = audit.snapshot as unknown as Snapshot;
  const loc = lang === 'en' ? 'en-US' : lang === 'tr' ? 'tr-TR' : 'ru-RU';
  const m = (n: number) => `${Number(n || 0).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${s.currency || ''}`.trim();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    const font = resolveUnicodePdfFont();
    if (font) doc.font(font);
    const row = (label: string, value: string, bold = false) => {
      doc.fontSize(bold ? 11.5 : 10.5).fillColor('#111').text(label, 48, doc.y, { continued: true, width: 360 });
      doc.text(value, { align: 'right' });
    };
    const head = (x: string) => {
      doc.moveDown(0.8);
      doc.fontSize(12).fillColor('#111').text(x, 48, doc.y, { underline: true });
      doc.moveDown(0.3);
    };
    doc.fontSize(18).text(hotel.name);
    doc.fontSize(10).fillColor('#666').text(`${t.title} · ${t.day}: ${audit.businessDate} · ${t.mode}: ${audit.mode === 'auto' ? t.auto : t.manual}`);
    head(t.occ);
    row(t.occ, `${s.occupancyPct}%`, true);
    row(t.rooms, `${s.sold} / ${s.available}${s.comp ? ` (${t.comp}: ${s.comp})` : ''}`);
    row(t.adr, m(s.adr));
    row(t.revpar, m(s.revpar));
    if (s.outOfOrder) row(t.ooo, String(s.outOfOrder));
    head(t.rev);
    row(t.room, m(s.roomRevenue));
    row(t.extras, m(s.extrasRevenue));
    row(t.fees, m(s.feesRevenue));
    row(t.total, m(s.totalRevenue), true);
    head(t.moves);
    row(t.arr, String(s.arrivals));
    row(t.dep, String(s.departures));
    row(t.ns, String(s.noShows));
    row(t.canc, String(s.cancellations));
    row(t.inh, String(s.inHouseGuests));
    head(t.pay);
    const pays = Object.entries(s.payments || {});
    if (!pays.length) row('—', t.none);
    for (const [k, v] of pays) row(t[k] || k, m(v));
    row(t.total, m(s.paymentsTotal), true);
    row(t.open, m(s.openBalance));
    if (s.byRoomType?.length) {
      head(t.byType);
      for (const x of s.byRoomType) row(x.name, `${x.sold} / ${x.available} · ${m(x.revenue)}`);
    }
    doc.end();
  });
}
