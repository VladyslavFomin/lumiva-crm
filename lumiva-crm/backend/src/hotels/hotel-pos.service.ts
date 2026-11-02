import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelRoomUnit } from './hotel-room-unit.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelExtraService } from './hotel-folio.entities';
import { HOTEL_POS_KINDS, HotelPosCheck, HotelPosKind, HotelPosLine, HotelPosOutlet } from './hotel-pos.entities';
import { HotelFolioService, businessDateOf } from './hotel-folio.service';
import { normalizeNumericInput } from './hotel-number.util';

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const bad = (code: string, message: string) => new BadRequestException({ code, message });
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const AI_BOARDS = ['AI', 'UAI'];
const PAY = ['cash', 'card', 'other'];

/**
 * Неоплаченные доп. начисления гостя (точки продаж, услуги): всё, что сверх проживания, минус оплаты сверх суммы
 * проживания. Лимит считаем по ним: неоплаченное проживание (гарантия, оплата при выезде) не должно блокировать кофе в баре.
 */
const extrasOwed = (r: HotelReservation) => {
  const paid = (r.payments || []).reduce((s, p) => s + num(p.amount), 0);
  return round2(Math.max(0, num(r.extrasTotal) - Math.max(0, paid - num(r.total))));
};

/**
 * Точки продаж: чек на номер заселённого гостя — строками фолио (позиции «всё включено» у гостя AI/UAI — 0 к оплате),
 * лимит начислений на номер, оплата на месте без номера, сторно, отчёт по точкам.
 */
@Injectable()
export class HotelPosService {
  constructor(
    @InjectRepository(HotelPosOutlet) private readonly outlets: Repository<HotelPosOutlet>,
    @InjectRepository(HotelPosCheck) private readonly checks: Repository<HotelPosCheck>,
    @InjectRepository(HotelExtraService) private readonly extras: Repository<HotelExtraService>,
    @InjectRepository(HotelReservation) private readonly reservations: Repository<HotelReservation>,
    @InjectRepository(HotelRoomUnit) private readonly units: Repository<HotelRoomUnit>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    private readonly folio: HotelFolioService,
  ) {}

  private async hotel(tenantId: string, hotelId: string) {
    const h = await this.hotels.findOne({ where: { id: hotelId, tenantId } });
    if (!h) throw new NotFoundException('Отель не найден');
    return h;
  }

  async listOutlets(tenantId: string, hotelId: string) {
    const list = await this.outlets.find({ where: { tenantId, hotelId }, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
    const items = list.length ? await this.extras.find({ where: { tenantId, hotelId, outletId: In(list.map((o) => o.id)) }, order: { sortOrder: 'ASC', name: 'ASC' } }) : [];
    const h = await this.hotel(tenantId, hotelId);
    // бизнес-дата отеля (по его часовому поясу и ночному аудиту) — чеки пишутся на неё, а не на дату браузера
    return { outlets: list.map((o) => ({ ...o, items: items.filter((i) => i.outletId === o.id) })), creditLimit: h.posCreditLimit === null ? null : num(h.posCreditLimit), currency: (h.currency || '').toUpperCase(), businessDate: businessDateOf(h), shiftOpen: !!(await this.folio.openShiftOf(tenantId, hotelId)) };
  }

  async saveOutlet(tenantId: string, dto: { hotelId?: string; name?: string; kind?: string; active?: boolean; sortOrder?: number }, id?: string) {
    const row = id ? await this.outlets.findOne({ where: { id, tenantId } }) : this.outlets.create({ tenantId, hotelId: (await this.hotel(tenantId, String(dto.hotelId || ''))).id, kind: 'restaurant', active: true });
    if (!row) throw new NotFoundException('Точка не найдена');
    if (dto.name !== undefined) row.name = String(dto.name || '').trim().slice(0, 120);
    if (!row.name) throw bad('HOTEL_POS_NAME', 'Укажите название точки');
    if (dto.kind !== undefined) row.kind = ((HOTEL_POS_KINDS as readonly string[]).includes(String(dto.kind)) ? dto.kind : 'other') as HotelPosKind;
    if (dto.active !== undefined) row.active = !!dto.active;
    if (dto.sortOrder !== undefined) row.sortOrder = Math.round(num(dto.sortOrder));
    if (!id) row.sortOrder = await this.outlets.count({ where: { tenantId, hotelId: row.hotelId } });
    return this.outlets.save(row);
  }

  /** Точка с чеками только выключается (история продаж остаётся) */
  async removeOutlet(tenantId: string, id: string) {
    const row = await this.outlets.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Точка не найдена');
    if (await this.checks.count({ where: { tenantId, outletId: id } })) throw bad('HOTEL_POS_IN_USE', 'По точке есть чеки — выключите её вместо удаления');
    await this.outlets.remove(row);
    return { ok: true };
  }

  async setCreditLimit(tenantId: string, hotelId: string, limit: number | string | null) {
    const h = await this.hotel(tenantId, hotelId);
    const v = limit === null || limit === '' ? null : num(normalizeNumericInput(limit as any));
    if (v !== null && v < 0) throw bad('HOTEL_POS_LIMIT', 'Лимит не может быть отрицательным');
    h.posCreditLimit = v === null ? null : String(round2(v));
    await this.hotels.save(h);
    return { creditLimit: v };
  }

  /** Кому начислить: заселённые гости по номеру комнаты или имени — с питанием, долгом и лимитом */
  async inHouse(tenantId: string, hotelId: string, q: string) {
    const h = await this.hotel(tenantId, hotelId);
    const s = String(q || '').trim().toLowerCase();
    const rows = await this.reservations.find({ where: { tenantId, hotelId, status: 'checked_in' }, order: { guestName: 'ASC' }, take: 500 });
    const units = rows.length ? await this.units.find({ where: { tenantId, id: In(rows.map((r) => r.roomUnitId).filter((x): x is string => !!x)) } }) : [];
    const limit = h.posCreditLimit === null ? null : num(h.posCreditLimit);
    const hits = rows
      .map((r) => ({ r, label: units.find((u) => u.id === r.roomUnitId)?.label || null }))
      .filter((x) => !s || (x.label || '').toLowerCase().startsWith(s) || x.r.guestName.toLowerCase().includes(s))
      .slice(0, 20);
    return hits.map(({ r, label }) => ({ reservationId: r.id, guestName: r.guestName, roomLabel: label, boardType: r.boardType, allInclusive: AI_BOARDS.includes(String(r.boardType || '').toUpperCase()), pax: r.pax, checkOut: r.checkOut, extrasOwed: extrasOwed(r), creditLimit: limit }));
  }

  /**
   * Чек: позиции — только из этой точки, цена — из каталога (не из запроса). На номер — гость должен жить в отеле;
   * «всё включено» у гостя AI/UAI — к оплате 0; лимит — по долгу счёта гостя. Без номера — способ оплаты обязателен.
   */
  async createCheck(tenantId: string, dto: { outletId: string; lines: Array<{ extraServiceId: string; quantity: number }>; reservationId?: string | null; paymentMethod?: string | null; note?: string; overrideLimit?: boolean }, actor: string | null) {
    const outlet = await this.outlets.findOne({ where: { id: dto?.outletId, tenantId } });
    if (!outlet || !outlet.active) throw bad('HOTEL_POS_OUTLET', 'Точка продаж не найдена или выключена');
    const hotel = await this.hotel(tenantId, outlet.hotelId);
    const want = (Array.isArray(dto.lines) ? dto.lines : []).filter((l) => l && num(l.quantity) > 0).slice(0, 100);
    if (!want.length) throw bad('HOTEL_POS_EMPTY', 'Добавьте позиции в чек');
    const items = await this.extras.find({ where: { tenantId, outletId: outlet.id, active: true, id: In(want.map((l) => l.extraServiceId)) } });
    let res: HotelReservation | null = null;
    if (dto.reservationId) {
      res = await this.reservations.findOne({ where: { id: dto.reservationId, tenantId, hotelId: hotel.id } });
      if (!res || res.status !== 'checked_in') throw bad('HOTEL_POS_NOT_IN_HOUSE', 'На номер можно начислить только заселённому гостю');
    } else if (!PAY.includes(String(dto.paymentMethod))) {
      throw bad('HOTEL_POS_PAYMENT', 'Выберите номер гостя или способ оплаты');
    }
    const ai = !!res && AI_BOARDS.includes(String(res.boardType || '').toUpperCase());
    const lines: HotelPosLine[] = want.map((w) => {
      const it = items.find((i) => i.id === w.extraServiceId);
      if (!it) throw bad('HOTEL_POS_ITEM', 'Позиция не из этой точки или выключена');
      const qty = Math.min(999, Math.max(0.01, round2(num(w.quantity))));
      const included = ai && it.aiIncluded;
      return { extraServiceId: it.id, name: it.name, quantity: qty, unitPrice: round2(num(it.price)), amount: included ? 0 : round2(qty * num(it.price)), included };
    });
    const total = round2(lines.reduce((s, l) => s + l.amount, 0));
    const includedValue = round2(lines.filter((l) => l.included).reduce((s, l) => s + l.quantity * l.unitPrice, 0));
    if (!res && !(total > 0)) throw bad('HOTEL_POS_ZERO', 'Сумма чека — ноль');
    if (res && total > 0 && hotel.posCreditLimit !== null && !dto.overrideLimit) {
      const owed = round2(extrasOwed(res) + total);
      if (owed > num(hotel.posCreditLimit)) throw new BadRequestException({ code: 'HOTEL_POS_LIMIT', message: `Превышен лимит начислений на номер (${num(hotel.posCreditLimit)})`, owed, limit: num(hotel.posCreditLimit) });
    }
    const unit = res?.roomUnitId ? await this.units.findOne({ where: { id: res.roomUnitId, tenantId } }) : null;
    const [{ n }] = await this.checks.manager.query(`SELECT coalesce(max(number), 0)::int + 1 AS n FROM hotel_pos_checks WHERE "outletId" = $1`, [outlet.id]);
    // оплата на месте — деньги в кассе открытой смены (как платёж брони); без смены продаём, но в Z-отчёт не попадёт
    const shift = res ? null : await this.folio.openShiftOf(tenantId, hotel.id);
    const folioLineIds: string[] = [];
    if (res) {
      // по строке на позицию: в счёте гостя видно, что именно; «всё включено» в счёт не идёт
      for (const l of lines.filter((x) => x.amount > 0)) {
        const fl = await this.folio.postLine(tenantId, res.id, { kind: outlet.kind === 'minibar' ? 'minibar' : 'extra', extraServiceId: l.extraServiceId, description: `${outlet.name} #${n} · ${l.name}`, quantity: l.quantity, unitPrice: l.unitPrice }, actor);
        folioLineIds.push(fl.id);
      }
    }
    return this.checks.save(this.checks.create({
      tenantId, hotelId: hotel.id, outletId: outlet.id, number: n, businessDate: businessDateOf(hotel), reservationId: res?.id ?? null,
      roomLabel: unit?.label ?? null, guestName: res?.guestName ?? null, paymentMethod: res ? null : String(dto.paymentMethod), shiftId: shift?.id ?? null, lines,
      total: String(total), includedValue: String(includedValue), folioLineIds, status: 'posted', note: String(dto.note || '').trim().slice(0, 500) || null, createdBy: actor,
    }));
  }

  /** Сторно чека: начисления в счёте гостя сторнируются, чек помечается */
  async voidCheck(tenantId: string, id: string, reason: string, actor: string | null) {
    const c = await this.checks.findOne({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Чек не найден');
    if (c.status === 'voided') throw bad('HOTEL_POS_VOIDED', 'Чек уже сторнирован');
    const why = String(reason || '').trim();
    if (!why) throw bad('HOTEL_POS_REASON', 'Укажите причину сторно');
    // деньги за оплату на месте возвращаются из кассы: смена продажи, пока открыта, иначе — текущая открытая смена
    let voidShiftId: string | null = null;
    if (c.shiftId) {
      const open = await this.folio.openShiftOf(tenantId, c.hotelId);
      if (!open) throw bad('HOTEL_POS_VOID_NO_SHIFT', 'Смена этого чека закрыта — откройте смену, возврат денег пройдёт через неё');
      voidShiftId = open.id;
    }
    if (c.reservationId) for (const lid of c.folioLineIds || []) await this.folio.voidLine(tenantId, c.reservationId, lid, `POS #${c.number}: ${why}`, actor);
    c.status = 'voided';
    c.voidShiftId = voidShiftId;
    c.voidReason = why.slice(0, 500);
    c.voidedBy = actor;
    c.voidedAt = new Date();
    return this.checks.save(c);
  }

  async listChecks(tenantId: string, q: { hotelId: string; outletId?: string; date?: string }) {
    const where: any = { tenantId, hotelId: q.hotelId };
    if (q.outletId) where.outletId = q.outletId;
    if (q.date && ISO.test(q.date)) where.businessDate = q.date;
    return this.checks.find({ where, order: { createdAt: 'DESC' }, take: 200 });
  }

  /** Отчёт по точкам за период: на номер, на месте по способам оплаты, «всё включено» (стоимость), сторно */
  async report(tenantId: string, q: { hotelId: string; from: string; to: string }) {
    if (!ISO.test(q.from || '') || !ISO.test(q.to || '') || q.to < q.from) throw bad('HOTEL_POS_DATES', 'Неверный период');
    const rows = await this.checks.manager.query(
      `SELECT o.id, o.name, o.kind,
              count(c.*) FILTER (WHERE c.status = 'posted')::int AS checks,
              coalesce(sum(c.total::numeric) FILTER (WHERE c.status = 'posted' AND c."reservationId" IS NOT NULL), 0) AS room,
              coalesce(sum(c.total::numeric) FILTER (WHERE c.status = 'posted' AND c."paymentMethod" = 'cash'), 0) AS cash,
              coalesce(sum(c.total::numeric) FILTER (WHERE c.status = 'posted' AND c."paymentMethod" = 'card'), 0) AS card,
              coalesce(sum(c.total::numeric) FILTER (WHERE c.status = 'posted' AND c."paymentMethod" = 'other'), 0) AS other,
              coalesce(sum(c."includedValue"::numeric) FILTER (WHERE c.status = 'posted'), 0) AS included,
              count(c.*) FILTER (WHERE c.status = 'voided')::int AS voided
         FROM hotel_pos_outlets o
         LEFT JOIN hotel_pos_checks c ON c."outletId" = o.id AND c."businessDate" BETWEEN $3 AND $4
        WHERE o."tenantId" = $1 AND o."hotelId" = $2
        GROUP BY o.id, o.name, o.kind, o."sortOrder" ORDER BY o."sortOrder"`,
      [tenantId, q.hotelId, q.from, q.to],
    );
    return rows.map((r: any) => {
      const x = { room: num(r.room), cash: num(r.cash), card: num(r.card), other: num(r.other) };
      return { outletId: r.id, name: r.name, kind: r.kind, checks: r.checks, voided: r.voided, ...x, included: num(r.included), total: round2(x.room + x.cash + x.card + x.other) };
    });
  }
}
