import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { HotelMarketGroup } from './hotel-market-group.entity';
import { HotelPricingPeriod } from './hotel-pricing-period.entity';
import { HotelDailyMarketRate } from './hotel-daily-market-rate.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomOccupancyType } from './hotel-room-occupancy-type.entity';
import { HotelRoomStopSaleDate } from './hotel-room-stop-sale-date.entity';
import { Hotel } from './hotel.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { HotelMarket } from './hotel-market.entity';
import { normalizeNumericInput } from './hotel-number.util';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';

function toNum(v: string | number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class HotelsPricingService {
  constructor(
    @InjectRepository(Hotel)
    private readonly hotelsRepo: Repository<Hotel>,
    @InjectRepository(HotelMarketGroup)
    private readonly marketGroupsRepo: Repository<HotelMarketGroup>,
    @InjectRepository(HotelPricingPeriod)
    private readonly periodsRepo: Repository<HotelPricingPeriod>,
    @InjectRepository(HotelDailyMarketRate)
    private readonly ratesRepo: Repository<HotelDailyMarketRate>,
    @InjectRepository(HotelRoomType)
    private readonly roomTypesRepo: Repository<HotelRoomType>,
    @InjectRepository(HotelRoomOccupancyType)
    private readonly occupancyTypesRepo: Repository<HotelRoomOccupancyType>,
    @InjectRepository(HotelRoomStopSaleDate)
    private readonly stopSaleDatesRepo: Repository<HotelRoomStopSaleDate>,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
    @InjectRepository(HotelReservation)
    private readonly reservationsRepo: Repository<HotelReservation>,
    @InjectRepository(HotelMarket)
    private readonly marketsRepo: Repository<HotelMarket>,
  ) {}

  /* ---------- stop-sale dates (Цены и рынки — точечный стоп на дату) ---------- */

  async listStopSaleDates(tenantId: string, roomTypeId: string, dates: string[]): Promise<string[]> {
    if (!dates.length) return [];
    const rows = await this.stopSaleDatesRepo.find({
      where: { tenantId, roomTypeId, date: In(dates) },
    });
    return rows.map((r) => r.date);
  }

  async setStopSaleDate(tenantId: string, roomTypeId: string, date: string, stopped: boolean) {
    if (stopped) {
      const existing = await this.stopSaleDatesRepo.findOne({ where: { tenantId, roomTypeId, date } });
      if (!existing) {
        await this.stopSaleDatesRepo.save(
          this.stopSaleDatesRepo.create({ tenantId, roomTypeId, date }),
        );
      }
    } else {
      await this.stopSaleDatesRepo.delete({ tenantId, roomTypeId, date });
    }
    try {
      await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_STOP_SALE_SET, {
        entityType: 'hotel_room_type',
        entityId: roomTypeId,
        date,
        stopped,
      });
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }
    return { date, stopped };
  }

  /* ---------- market groups ---------- */

  listMarketGroups(tenantId: string, hotelId: string) {
    return this.marketGroupsRepo.find({ where: { tenantId, hotelId }, order: { sortOrder: 'ASC' } });
  }

  async createMarketGroup(tenantId: string, hotelId: string, name: string) {
    const count = await this.marketGroupsRepo.count({ where: { tenantId, hotelId } });
    return this.marketGroupsRepo.save(
      this.marketGroupsRepo.create({ tenantId, hotelId, name, sortOrder: count }),
    );
  }

  async updateMarketGroup(tenantId: string, id: string, name: string) {
    const row = await this.marketGroupsRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Группа рынков не найдена');
    row.name = name;
    return this.marketGroupsRepo.save(row);
  }

  async removeMarketGroup(tenantId: string, id: string) {
    const row = await this.marketGroupsRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Группа рынков не найдена');
    await this.marketGroupsRepo.remove(row);

    // Hotel.referenceMarketGroupId anchors every room-pricing calculation to this group — a
    // stale id left pointing at a now-deleted group silently zeroes out pricing (no daily rates
    // will ever match it) instead of erroring, so repoint it to another remaining group.
    const hotel = await this.hotelsRepo.findOne({ where: { id: row.hotelId, tenantId } });
    if (hotel && hotel.referenceMarketGroupId === id) {
      const nextGroup = await this.marketGroupsRepo.findOne({
        where: { tenantId, hotelId: row.hotelId },
        order: { sortOrder: 'ASC' },
      });
      hotel.referenceMarketGroupId = nextGroup?.id || null;
      await this.hotelsRepo.save(hotel);
    }

    return { ok: true };
  }

  /* ---------- pricing periods (display filter chips) ---------- */

  listPeriods(tenantId: string, hotelId: string) {
    return this.periodsRepo.find({ where: { tenantId, hotelId }, order: { startDate: 'ASC' } });
  }

  createPeriod(tenantId: string, hotelId: string, dto: { startDate: string; endDate: string }) {
    return this.periodsRepo.save(
      this.periodsRepo.create({
        tenantId,
        hotelId,
        startDate: dto.startDate,
        endDate: dto.endDate,
      }),
    );
  }

  async updatePeriod(tenantId: string, id: string, dto: { startDate?: string; endDate?: string }) {
    const row = await this.periodsRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Период не найден');
    Object.assign(row, dto);
    return this.periodsRepo.save(row);
  }

  async removePeriod(tenantId: string, id: string) {
    const row = await this.periodsRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Период не найден');
    await this.periodsRepo.remove(row);
    return { ok: true };
  }

  /* ---------- daily market rates (Bütçe/PP Ort./Brüt/İndirim/Net) ---------- */

  async getDailyRates(tenantId: string, roomTypeId: string, dates: string[]) {
    if (!dates.length) return [];
    const roomType = await this.roomTypesRepo.findOne({ where: { id: roomTypeId, tenantId } });
    if (!roomType) throw new NotFoundException('Тип номера не найден');
    const groups = await this.marketGroupsRepo.find({
      where: { tenantId, hotelId: roomType.hotelId },
      order: { sortOrder: 'ASC' },
    });
    const rows = await this.ratesRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.roomTypeId = :roomTypeId', { roomTypeId })
      .andWhere('r.date IN (:...dates)', { dates })
      .getMany();
    const byKey = new Map(rows.map((r) => [`${r.marketGroupId}|${r.date}`, r]));
    const actual = await this.actualPP(tenantId, roomType, groups, dates);

    return dates.map((date) => ({
      date,
      groups: groups.map((g) => {
        const row = byKey.get(`${g.id}|${date}`);
        return {
          marketGroupId: g.id,
          marketGroupName: g.name,
          budgetPP: row?.budgetPP ?? '0',
          ppAvg: row?.ppAvg ?? '0',
          grossPP: row?.grossPP ?? '0',
          discountPct: row?.discountPct ?? '0',
          netPP: row?.netPP ?? '0',
          /** PP Ort. по факту: средняя цена на человека за ночь по броням этой даты (null — броней нет) */
          ppActual: actual.get(`${g.id}|${date}`)?.avg ?? null,
          ppActualCount: actual.get(`${g.id}|${date}`)?.count ?? 0,
        };
      }),
    }));
  }

  /**
   * Фактическая PP по броням: для каждой ночи брони этого типа номера — цена ночи (по прайсу или ставка брони,
   * со скидкой брони) ÷ коэффициент её размещения, в группу рынка брони (рынок → группа, иначе опорная).
   * Отменённые, no-show и бесплатные не считаются.
   */
  private async actualPP(tenantId: string, roomType: HotelRoomType, groups: HotelMarketGroup[], dates: string[]) {
    const out = new Map<string, { avg: number; count: number }>();
    if (!dates.length || !groups.length) return out;
    const sorted = [...dates].sort();
    const [hotel, markets, occTypes, list] = await Promise.all([
      this.hotelsRepo.findOne({ where: { id: roomType.hotelId, tenantId } }),
      this.marketsRepo.find({ where: { tenantId, hotelId: roomType.hotelId } }),
      this.occupancyTypesRepo.find({ where: { tenantId, roomTypeId: roomType.id } }),
      this.reservationsRepo
        .createQueryBuilder('r')
        .where('r.tenantId = :tenantId AND r.roomTypeId = :roomTypeId', { tenantId, roomTypeId: roomType.id })
        .andWhere(`r.status NOT IN ('cancelled','no_show')`)
        .andWhere('r.isComplimentary = false')
        .andWhere('r.checkIn <= :to AND r.checkOut > :from', { from: sorted[0], to: sorted[sorted.length - 1] })
        .getMany(),
    ]);
    const refId = hotel?.referenceMarketGroupId && groups.some((g) => g.id === hotel.referenceMarketGroupId) ? hotel.referenceMarketGroupId : groups[0].id;
    const want = new Set(dates);
    const acc = new Map<string, { sum: number; count: number }>();
    for (const r of list) {
      const market = markets.find((m) => m.id === r.marketId) || (r.market ? markets.find((m) => m.code === r.market) : undefined);
      const groupId = market?.marketGroupId && groups.some((g) => g.id === market.marketGroupId) ? market.marketGroupId : refId;
      const occ = occTypes.find((o) => o.id === r.occupancyTypeId);
      const coef = occ ? toNum(occ.coefficient) : Math.max(1, (r.pax || 1) - (r.children || 0));
      if (!(coef > 0)) continue;
      const disc = 1 - toNum(r.discountPct) / 100;
      for (let d = new Date(`${r.checkIn}T00:00:00Z`); d.toISOString().slice(0, 10) < r.checkOut; d.setUTCDate(d.getUTCDate() + 1)) {
        const date = d.toISOString().slice(0, 10);
        if (!want.has(date)) continue;
        const night = r.nightlyRates?.find((n) => n.date === date);
        // у ночей из прайса есть PP взрослого (дети по политике в нём не участвуют), иначе — цена ночи ÷ коэффициент
        const pp = (night?.pp ? toNum(night.pp) : (night ? toNum(night.price) : toNum(r.grossPerNight)) / coef) * disc;
        if (!(pp > 0)) continue;
        const key = `${groupId}|${date}`;
        const a = acc.get(key) || { sum: 0, count: 0 };
        a.sum += pp;
        a.count += 1;
        acc.set(key, a);
      }
    }
    for (const [k, a] of acc) out.set(k, { avg: round2(a.sum / a.count), count: a.count });
    return out;
  }

  async upsertDailyRate(
    tenantId: string,
    roomTypeId: string,
    marketGroupId: string,
    date: string,
    dto: { budgetPP?: string; ppAvg?: string; grossPP?: string; discountPct?: string },
  ) {
    let row = await this.ratesRepo.findOne({ where: { tenantId, roomTypeId, marketGroupId, date } });
    if (!row) {
      row = this.ratesRepo.create({ tenantId, roomTypeId, marketGroupId, date });
    }
    const previousNetPP = row.netPP;
    if (dto.budgetPP !== undefined) row.budgetPP = normalizeNumericInput(dto.budgetPP);
    if (dto.ppAvg !== undefined) row.ppAvg = normalizeNumericInput(dto.ppAvg);
    if (dto.grossPP !== undefined) row.grossPP = normalizeNumericInput(dto.grossPP);
    if (dto.discountPct !== undefined) row.discountPct = normalizeNumericInput(dto.discountPct);
    row.netPP = String(round2(toNum(row.grossPP) * (1 - toNum(row.discountPct) / 100)));
    const saved = await this.ratesRepo.save(row);

    if (previousNetPP !== saved.netPP) {
      try {
        await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_PRICE_CHANGED, {
          entityType: 'hotel_daily_rate',
          entityId: saved.id,
          roomTypeId,
          marketGroupId,
          date,
          previousNetPP,
          newNetPP: saved.netPP,
        });
      } catch (error) {
        console.error('Failed to trigger automation:', error);
      }
    }
    return saved;
  }

  /** «Заполнить диапазон»: одни и те же Bütçe/PP Ort./Brüt/İndirim на все даты from..to (по выбранным дням недели)
   * для выбранных групп рынков. Пустое поле не трогается. Net пересчитывается. */
  async bulkFillDailyRates(
    tenantId: string,
    roomTypeId: string,
    dto: { marketGroupIds?: string[]; from?: string; to?: string; weekdays?: number[]; budgetPP?: string; ppAvg?: string; grossPP?: string; discountPct?: string },
  ) {
    const roomType = await this.roomTypesRepo.findOne({ where: { id: roomTypeId, tenantId } });
    if (!roomType) throw new NotFoundException('Тип номера не найден');
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (!iso.test(dto.from || '') || !iso.test(dto.to || '') || dto.to! < dto.from!) {
      throw new BadRequestException({ code: 'HOTEL_BULK_BAD_RANGE', message: 'Неверный диапазон дат' });
    }
    const fields = (['budgetPP', 'ppAvg', 'grossPP', 'discountPct'] as const).filter((f) => dto[f] !== undefined && dto[f] !== null && String(dto[f]).trim() !== '');
    if (!fields.length) throw new BadRequestException({ code: 'HOTEL_BULK_NO_FIELDS', message: 'Не задано ни одного значения' });
    const discount = dto.discountPct !== undefined && String(dto.discountPct).trim() !== '' ? toNum(normalizeNumericInput(String(dto.discountPct))) : null;
    if (discount !== null && (discount < 0 || discount > 100)) throw new BadRequestException({ code: 'HOTEL_BULK_BAD_DISCOUNT', message: 'Скидка должна быть от 0 до 100%' });
    const groups = await this.marketGroupsRepo.find({ where: { tenantId, hotelId: roomType.hotelId } });
    const groupIds = (dto.marketGroupIds || []).filter((id) => groups.some((g) => g.id === id));
    if (!groupIds.length) throw new BadRequestException({ code: 'HOTEL_MARKET_GROUP_NOT_FOUND', message: 'Группа рынков не найдена' });
    const weekdays = (dto.weekdays || []).filter((w) => w >= 1 && w <= 7);
    const dates: string[] = [];
    for (let d = new Date(`${dto.from}T00:00:00Z`); d.toISOString().slice(0, 10) <= dto.to!; d.setUTCDate(d.getUTCDate() + 1)) {
      const isoDow = ((d.getUTCDay() + 6) % 7) + 1;
      if (!weekdays.length || weekdays.includes(isoDow)) dates.push(d.toISOString().slice(0, 10));
      if (dates.length > 731) throw new BadRequestException({ code: 'HOTEL_BULK_RANGE_TOO_LONG', message: 'Не больше 2 лет за раз' });
    }
    if (!dates.length) return { updated: 0 };
    const existing = await this.ratesRepo.find({ where: { tenantId, roomTypeId, marketGroupId: In(groupIds), date: In(dates) } });
    const byKey = new Map(existing.map((r) => [`${r.marketGroupId}|${r.date}`, r]));
    const toSave: HotelDailyMarketRate[] = [];
    for (const g of groupIds) {
      for (const date of dates) {
        const row = byKey.get(`${g}|${date}`) || this.ratesRepo.create({ tenantId, roomTypeId, marketGroupId: g, date });
        for (const f of fields) row[f] = normalizeNumericInput(String(dto[f]));
        row.netPP = String(round2(toNum(row.grossPP) * (1 - toNum(row.discountPct) / 100)));
        toSave.push(row);
      }
    }
    await this.ratesRepo.save(toSave, { chunk: 500 });
    try {
      await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_PRICE_CHANGED, {
        entityType: 'hotel_daily_rate_bulk',
        entityId: roomTypeId,
        roomTypeId,
        marketGroupIds: groupIds,
        from: dto.from,
        to: dto.to,
        count: toSave.length,
      });
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }
    return { updated: toSave.length };
  }

  /** Средний Net PP за диапазон дат для заданного типа номера + группы рынков —
   * используется как referenceNetPP для расчёта «Цены с размещением». */
  private async averageNetPP(
    tenantId: string,
    roomTypeId: string,
    marketGroupId: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const rows = await this.ratesRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.roomTypeId = :roomTypeId', { roomTypeId })
      .andWhere('r.marketGroupId = :marketGroupId', { marketGroupId })
      .andWhere('r.date >= :startDate', { startDate })
      .andWhere('r.date <= :endDate', { endDate })
      .andWhere('r.netPP > 0')
      .getMany();
    if (!rows.length) return 0;
    return rows.reduce((s, r) => s + toNum(r.netPP), 0) / rows.length;
  }

  /** «Быстрая информация о цене» в настройках отеля: для каждого периода — та же прайсовая
   * (не фактическая) средняя Net PP базового типа номера на referenceMarketGroupId, что
   * getRoomPricing уже считает как referenceNetPP — вынесено отдельно, чтобы Settings не тянул
   * данные конкретного типа номера ради одного числа на период. */
  async getPeriodPriceSummary(tenantId: string, hotelId: string) {
    const hotel = await this.hotelsRepo.findOne({ where: { id: hotelId, tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    const baseRoomType = await this.roomTypesRepo.findOne({
      where: { tenantId, hotelId, isBaseRoomType: true },
    });
    const groups = await this.marketGroupsRepo.find({ where: { tenantId, hotelId } });
    const referenceMarketGroupId = hotel.referenceMarketGroupId || groups[0]?.id || null;
    const periods = await this.periodsRepo.find({ where: { tenantId, hotelId }, order: { startDate: 'ASC' } });

    const rows = await Promise.all(
      periods.map(async (p) => ({
        periodId: p.id,
        startDate: p.startDate,
        endDate: p.endDate,
        avgNetPP:
          baseRoomType && referenceMarketGroupId
            ? round2(await this.averageNetPP(tenantId, baseRoomType.id, referenceMarketGroupId, p.startDate, p.endDate))
            : 0,
      })),
    );
    return { currency: 'EUR', rows };
  }

  /** «Цены с размещением»: для каждого периода считает referenceNetPP (среднее Net PP
   * базового типа номера отеля за период на referenceMarketGroupId), затем цену для
   * каждой строки размещения этого типа номера = (referenceNetPP + offset) * coef,
   * либо coef * referenceNetPP для pricingMode='fixed_rate'. */
  /**
   * Цены с размещением по периодам. marketGroupId — посчитать по дневным ценам этой группы рынков (рынок гостя);
   * по умолчанию — опорная группа отеля. Ручные цены периода (periodOverrides) заданы для опорной группы
   * и применяются только к ней.
   */
  async getRoomPricing(tenantId: string, hotelId: string, roomTypeId: string, marketGroupId?: string | null) {
    const hotel = await this.hotelsRepo.findOne({ where: { id: hotelId, tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    const roomType = await this.roomTypesRepo.findOne({ where: { id: roomTypeId, tenantId } });
    if (!roomType) throw new NotFoundException('Тип номера не найден');

    const baseRoomType = await this.roomTypesRepo.findOne({
      where: { tenantId, hotelId, isBaseRoomType: true },
    });
    const groups = await this.marketGroupsRepo.find({ where: { tenantId, hotelId } });
    const hotelReferenceGroupId = hotel.referenceMarketGroupId || groups[0]?.id || null;
    const referenceMarketGroupId = marketGroupId && groups.some((g) => g.id === marketGroupId) ? marketGroupId : hotelReferenceGroupId;
    const isReferenceGroup = referenceMarketGroupId === hotelReferenceGroupId;

    const periods = await this.periodsRepo.find({ where: { tenantId, hotelId }, order: { startDate: 'ASC' } });
    const occupancyTypes = await this.occupancyTypesRepo.find({
      where: { tenantId, roomTypeId },
      order: { sortOrder: 'ASC' },
    });

    // Rounded once here and reused everywhere below (both the displayed base and every
    // occupancy-row price derive from this same rounded number) — averaging raw daily netPP
    // values and only rounding for *display* while multiplying with the unrounded average
    // internally made the shown numbers un-reproducible by hand (e.g. a displayed "105.57"
    // base + a displayed "+5.00" offset wouldn't multiply out to the displayed row price to
    // the cent, because the real base secretly wasn't exactly 105.57).
    const referenceNetPPByPeriod: Record<string, number> = {};
    for (const p of periods) {
      referenceNetPPByPeriod[p.id] =
        baseRoomType && referenceMarketGroupId
          ? round2(
              await this.averageNetPP(
                tenantId,
                baseRoomType.id,
                referenceMarketGroupId,
                p.startDate,
                p.endDate,
              ),
            )
          : 0;
    }

    const offset = roomType.isBaseRoomType ? 0 : toNum(roomType.ppNetOffset);
    // The base actually multiplied by each occupancy coefficient — referenceNetPP + offset for
    // 'offset' rooms (this IS "PP Net + разница"), or just referenceNetPP for 'fixed_rate' rooms
    // (offset doesn't apply there, the coefficient itself is the rate).
    const effectiveBasePPByPeriod: Record<string, number> = {};
    for (const p of periods) {
      const referenceNetPP = referenceNetPPByPeriod[p.id];
      effectiveBasePPByPeriod[p.id] =
        roomType.pricingMode === 'fixed_rate' ? referenceNetPP : round2(referenceNetPP + offset);
    }

    const rows = occupancyTypes.map((occ) => {
      const coef = toNum(occ.coefficient);
      const pricesByPeriod: Record<string, number> = {};
      const overriddenPeriods: string[] = [];
      for (const p of periods) {
        const override = isReferenceGroup ? occ.periodOverrides?.[p.id] : undefined;
        if (override !== undefined && override !== null && override !== '') {
          pricesByPeriod[p.id] = round2(toNum(override));
          overriddenPeriods.push(p.id);
          continue;
        }
        pricesByPeriod[p.id] = round2(effectiveBasePPByPeriod[p.id] * coef);
      }
      return {
        id: occ.id,
        label: occ.label,
        coefficient: occ.coefficient,
        paidChildCount: occ.paidChildCount,
        adults: occ.adults,
        children: occ.children,
        pricesByPeriod,
        overriddenPeriods,
      };
    });

    return {
      marketGroupId: referenceMarketGroupId,
      isReferenceGroup,
      roomType: {
        id: roomType.id,
        name: roomType.name,
        pricingMode: roomType.pricingMode,
        ppNetOffset: roomType.ppNetOffset,
        isBaseRoomType: roomType.isBaseRoomType,
      },
      periods: periods.map((p) => ({
        id: p.id,
        startDate: p.startDate,
        endDate: p.endDate,
        referenceNetPP: referenceNetPPByPeriod[p.id],
        effectiveBasePP: effectiveBasePPByPeriod[p.id],
      })),
      occupancyRows: rows,
    };
  }

  /**
   * Прайс по каждой ночи — то, что видно в таблице «Цены по рынкам продаж» на эту дату (без усреднения за период):
   *   ручная цена периода для размещения (только опорная группа) →
   *   собственный Net этого типа номера на дату × коэффициент (если тип не базовый и Net заполнен) →
   *   (Net базового типа на дату + разница типа) × коэффициент (fixed_rate: Net × коэффициент).
   * Сначала группа рынка гостя; если у неё на дату нет Net — опорная группа (fallback=true).
   * Разница у самого базового типа не применяется — он и есть точка отсчёта.
   */
  async dailyPrices(
    tenantId: string,
    hotel: Hotel,
    roomType: HotelRoomType,
    occ: HotelRoomOccupancyType | null,
    marketGroupId: string | null,
    dates: string[],
  ): Promise<Map<string, { price: number; pp: number; groupId: string; fallback: boolean; own: boolean }>> {
    const out = new Map<string, { price: number; pp: number; groupId: string; fallback: boolean; own: boolean }>();
    if (!occ || !dates.length) return out;
    const [groups, baseRoomType, periods] = await Promise.all([
      this.marketGroupsRepo.find({ where: { tenantId, hotelId: hotel.id } }),
      this.roomTypesRepo.findOne({ where: { tenantId, hotelId: hotel.id, isBaseRoomType: true } }),
      this.periodsRepo.find({ where: { tenantId, hotelId: hotel.id } }),
    ]);
    const refId = hotel.referenceMarketGroupId && groups.some((g) => g.id === hotel.referenceMarketGroupId) ? hotel.referenceMarketGroupId : groups[0]?.id || null;
    const guestId = marketGroupId && groups.some((g) => g.id === marketGroupId) ? marketGroupId : refId;
    const order = [guestId, refId].filter((g, i, a): g is string => !!g && a.indexOf(g) === i);
    if (!order.length) return out;
    const base = baseRoomType || roomType;
    const isBase = base.id === roomType.id;
    const rows = await this.ratesRepo.find({
      where: { tenantId, roomTypeId: In([...new Set([roomType.id, base.id])]), marketGroupId: In(order), date: In(dates) },
    });
    const net = new Map(rows.map((r) => [`${r.roomTypeId}|${r.marketGroupId}|${r.date}`, toNum(r.netPP)]));
    const coef = toNum(occ.coefficient);
    const offset = isBase ? 0 : toNum(roomType.ppNetOffset);
    for (const d of dates) {
      for (const g of order) {
        const fallback = g !== guestId;
        if (g === refId) {
          const period = periods.find((p) => d >= p.startDate && d <= p.endDate);
          const ov = period ? occ.periodOverrides?.[period.id] : undefined;
          if (ov !== undefined && ov !== null && ov !== '' && toNum(ov) > 0) {
            out.set(d, { price: round2(toNum(ov)), pp: coef > 0 ? round2(toNum(ov) / coef) : round2(toNum(ov)), groupId: g, fallback, own: false });
            break;
          }
        }
        const own = isBase ? 0 : net.get(`${roomType.id}|${g}|${d}`) || 0;
        if (own > 0) {
          out.set(d, { price: round2(own * coef), pp: own, groupId: g, fallback, own: true });
          break;
        }
        const baseNet = net.get(`${base.id}|${g}|${d}`) || 0;
        if (baseNet > 0) {
          const pp = roomType.pricingMode === 'fixed_rate' ? baseNet : baseNet + offset;
          out.set(d, { price: round2(pp * coef), pp: roomType.pricingMode === 'fixed_rate' ? baseNet : pp, groupId: g, fallback, own: false });
          break;
        }
      }
    }
    return out;
  }

  /** Price lookup for the reservation form's auto-fill — reuses getRoomPricing's already-computed
   * per-period/per-occupancy-row prices rather than recomputing the coefficient/override logic.
   * Looks up the period containing checkIn (the common case); if checkOut falls in a different
   * period, still returns that period's price but flags spansMultiplePeriods so the UI can warn
   * staff to double-check rather than silently mis-pricing a season-boundary stay. */
  async getReservationPrice(
    tenantId: string,
    roomTypeId: string,
    occupancyTypeId: string,
    checkIn: string,
    checkOut: string,
  ): Promise<{ pricePerNight: number | null; periodId: string | null; spansMultiplePeriods: boolean }> {
    const roomType = await this.roomTypesRepo.findOne({ where: { id: roomTypeId, tenantId } });
    if (!roomType) throw new NotFoundException('Тип номера не найден');

    const pricing = await this.getRoomPricing(tenantId, roomType.hotelId, roomTypeId);
    const checkInPeriod = pricing.periods.find((p) => checkIn >= p.startDate && checkIn <= p.endDate);
    if (!checkInPeriod) return { pricePerNight: null, periodId: null, spansMultiplePeriods: false };

    const row = pricing.occupancyRows.find((r) => r.id === occupancyTypeId);
    if (!row) return { pricePerNight: null, periodId: checkInPeriod.id, spansMultiplePeriods: false };

    const checkOutPeriod = pricing.periods.find((p) => checkOut >= p.startDate && checkOut <= p.endDate);
    const spansMultiplePeriods = !checkOutPeriod || checkOutPeriod.id !== checkInPeriod.id;

    return {
      pricePerNight: row.pricesByPeriod[checkInPeriod.id] ?? null,
      periodId: checkInPeriod.id,
      spansMultiplePeriods,
    };
  }
}
