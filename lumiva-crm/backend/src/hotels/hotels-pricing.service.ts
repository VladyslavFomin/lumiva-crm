import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { HotelMarketGroup } from './hotel-market-group.entity';
import { HotelPricingPeriod } from './hotel-pricing-period.entity';
import { HotelDailyMarketRate } from './hotel-daily-market-rate.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomOccupancyType } from './hotel-room-occupancy-type.entity';
import { HotelRoomStopSaleDate } from './hotel-room-stop-sale-date.entity';
import { Hotel } from './hotel.entity';
import { normalizeNumericInput } from './hotel-number.util';

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
        };
      }),
    }));
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
    if (dto.budgetPP !== undefined) row.budgetPP = normalizeNumericInput(dto.budgetPP);
    if (dto.ppAvg !== undefined) row.ppAvg = normalizeNumericInput(dto.ppAvg);
    if (dto.grossPP !== undefined) row.grossPP = normalizeNumericInput(dto.grossPP);
    if (dto.discountPct !== undefined) row.discountPct = normalizeNumericInput(dto.discountPct);
    row.netPP = String(round2(toNum(row.grossPP) * (1 - toNum(row.discountPct) / 100)));
    return this.ratesRepo.save(row);
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
  async getRoomPricing(tenantId: string, hotelId: string, roomTypeId: string) {
    const hotel = await this.hotelsRepo.findOne({ where: { id: hotelId, tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    const roomType = await this.roomTypesRepo.findOne({ where: { id: roomTypeId, tenantId } });
    if (!roomType) throw new NotFoundException('Тип номера не найден');

    const baseRoomType = await this.roomTypesRepo.findOne({
      where: { tenantId, hotelId, isBaseRoomType: true },
    });
    const groups = await this.marketGroupsRepo.find({ where: { tenantId, hotelId } });
    const referenceMarketGroupId = hotel.referenceMarketGroupId || groups[0]?.id || null;

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

    const offset = toNum(roomType.ppNetOffset);
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
        const override = occ.periodOverrides?.[p.id];
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
        pricesByPeriod,
        overriddenPeriods,
      };
    });

    return {
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
}
