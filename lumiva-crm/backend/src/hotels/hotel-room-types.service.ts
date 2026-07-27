import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelMarket } from './hotel-market.entity';
import { HotelRoomMarketPrice } from './hotel-room-market-price.entity';
import { HotelRoomDateOverride } from './hotel-room-date-override.entity';
import { HotelRoomOccupancyType } from './hotel-room-occupancy-type.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { normalizeNumericInput } from './hotel-number.util';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

@Injectable()
export class HotelRoomTypesService {
  constructor(
    @InjectRepository(HotelRoomType)
    private readonly repo: Repository<HotelRoomType>,
    @InjectRepository(HotelMarket)
    private readonly marketsRepo: Repository<HotelMarket>,
    @InjectRepository(HotelRoomMarketPrice)
    private readonly marketPricesRepo: Repository<HotelRoomMarketPrice>,
    @InjectRepository(HotelRoomDateOverride)
    private readonly overridesRepo: Repository<HotelRoomDateOverride>,
    @InjectRepository(HotelRoomOccupancyType)
    private readonly occupancyTypesRepo: Repository<HotelRoomOccupancyType>,
    @InjectRepository(HotelReservation)
    private readonly reservationsRepo: Repository<HotelReservation>,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
  ) {}

  /* ---------- room types ---------- */

  list(tenantId: string, hotelId: string) {
    return this.repo.find({ where: { tenantId, hotelId }, order: { createdAt: 'ASC' } });
  }

  async get(tenantId: string, id: string) {
    const rt = await this.repo.findOne({ where: { id, tenantId } });
    if (!rt) throw new NotFoundException('Тип номера не найден');
    return rt;
  }

  async create(tenantId: string, hotelId: string, dto: Partial<HotelRoomType>) {
    const existingCount = await this.repo.count({ where: { tenantId, hotelId } });
    const roomType = await this.repo.save(
      this.repo.create({
        tenantId,
        hotelId,
        name: dto.name,
        sizeM2: dto.sizeM2 ?? null,
        capacityLabel: dto.capacityLabel ?? null,
        basePrice: dto.basePrice !== undefined ? normalizeNumericInput(dto.basePrice) : '0',
        currency: dto.currency ?? 'USD',
        quantity: dto.quantity ?? 0,
        amenities: dto.amenities ?? [],
        pricingMode: dto.pricingMode ?? 'offset',
        ppNetOffset: dto.ppNetOffset !== undefined ? normalizeNumericInput(dto.ppNetOffset) : '0',
        isBaseRoomType: existingCount === 0,
      }),
    );

    await this.occupancyTypesRepo.save(
      [
        { label: 'SGL', coefficient: '1.6', paidChildCount: 0 },
        { label: '2 AD', coefficient: '2', paidChildCount: 0 },
      ].map((o, i) =>
        this.occupancyTypesRepo.create({
          tenantId,
          roomTypeId: roomType.id,
          label: o.label,
          coefficient: o.coefficient,
          paidChildCount: o.paidChildCount,
          sortOrder: i,
        }),
      ),
    );

    return roomType;
  }

  async update(tenantId: string, id: string, dto: Partial<HotelRoomType>) {
    const rt = await this.get(tenantId, id);
    const previousBasePrice = rt.basePrice;
    const previousOffset = rt.ppNetOffset;
    const previousStopSale = rt.stopSale;

    const normalized = { ...dto };
    if (normalized.basePrice !== undefined) normalized.basePrice = normalizeNumericInput(normalized.basePrice);
    if (normalized.ppNetOffset !== undefined) normalized.ppNetOffset = normalizeNumericInput(normalized.ppNetOffset);
    Object.assign(rt, normalized);
    const saved = await this.repo.save(rt);

    try {
      if (saved.basePrice !== previousBasePrice || saved.ppNetOffset !== previousOffset) {
        await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_PRICE_CHANGED, {
          entityType: 'hotel_room_type',
          entityId: id,
          roomType: saved,
        });
      }
      if (saved.stopSale !== previousStopSale) {
        await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_STOP_SALE_SET, {
          entityType: 'hotel_room_type',
          entityId: id,
          roomType: saved,
          stopped: saved.stopSale,
        });
      }
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }

    return saved;
  }

  async remove(tenantId: string, id: string) {
    const rt = await this.get(tenantId, id);
    // Deleting a room type cascades to its reservations at the DB level (FK ON DELETE CASCADE) —
    // that would silently wipe real guest booking history, so block it here instead and make the
    // user consciously deal with those reservations first (cancel or reassign to another room type).
    const reservationCount = await this.reservationsRepo.count({
      where: { tenantId, roomTypeId: id },
    });
    if (reservationCount > 0) {
      throw new BadRequestException(
        `Нельзя удалить тип номера — с ним связано ${reservationCount} брон${reservationCount === 1 ? 'ь' : 'ей'}. Сначала отмените или перенесите эти брони на другой тип номера.`,
      );
    }
    const wasBase = rt.isBaseRoomType;
    await this.repo.remove(rt);
    if (wasBase) {
      // The room-pricing engine (HotelsPricingService.getRoomPricing) anchors every price to
      // whichever room type has isBaseRoomType=true — losing that silently zeroes out pricing
      // for every remaining room type instead of erroring, so promote the next one automatically.
      const nextBase = await this.repo.findOne({
        where: { tenantId, hotelId: rt.hotelId },
        order: { createdAt: 'ASC' },
      });
      if (nextBase) {
        nextBase.isBaseRoomType = true;
        await this.repo.save(nextBase);
      }
    }
    return { ok: true };
  }

  async updateInfoFields(tenantId: string, id: string, infoFields: Record<string, string | boolean>) {
    const rt = await this.get(tenantId, id);
    rt.infoFields = { ...rt.infoFields, ...infoFields };
    return this.repo.save(rt);
  }

  async setCoverFromUpload(tenantId: string, id: string, filename: string) {
    const rt = await this.get(tenantId, id);
    rt.coverPhotoUrl = `/v1/uploads/hotels/${tenantId}/room-types/${id}/${filename}`;
    return this.repo.save(rt);
  }

  /* ---------- flat markets (Рынки и цены) ---------- */

  listMarkets(tenantId: string, hotelId: string) {
    return this.marketsRepo.find({ where: { tenantId, hotelId }, order: { createdAt: 'ASC' } });
  }

  createMarket(tenantId: string, hotelId: string, dto: { code: string; name: string }) {
    return this.marketsRepo.save(
      this.marketsRepo.create({ tenantId, hotelId, code: dto.code, name: dto.name }),
    );
  }

  async updateMarket(tenantId: string, id: string, dto: { code?: string; name?: string }) {
    const market = await this.marketsRepo.findOne({ where: { id, tenantId } });
    if (!market) throw new NotFoundException('Рынок не найден');
    if (dto.code !== undefined) market.code = dto.code;
    if (dto.name !== undefined) market.name = dto.name;
    return this.marketsRepo.save(market);
  }

  async removeMarket(tenantId: string, id: string) {
    const market = await this.marketsRepo.findOne({ where: { id, tenantId } });
    if (!market) throw new NotFoundException('Рынок не найден');
    await this.marketsRepo.remove(market);
    return { ok: true };
  }

  async listMarketPrices(tenantId: string, roomTypeId: string) {
    const [markets, prices] = await Promise.all([
      this.marketsRepo.find({ where: { tenantId } }),
      this.marketPricesRepo.find({ where: { tenantId, roomTypeId } }),
    ]);
    const priceByMarket = new Map(prices.map((p) => [p.marketId, p]));
    return markets
      .filter((m) => prices.some((p) => p.marketId === m.id) || true)
      .map((m) => ({
        marketId: m.id,
        code: m.code,
        name: m.name,
        price: priceByMarket.get(m.id)?.price ?? '0',
      }));
  }

  async upsertMarketPrice(tenantId: string, roomTypeId: string, marketId: string, price: string) {
    const normalizedPrice = normalizeNumericInput(price);
    let row = await this.marketPricesRepo.findOne({ where: { tenantId, roomTypeId, marketId } });
    const previousPrice = row?.price;
    if (!row) {
      row = this.marketPricesRepo.create({ tenantId, roomTypeId, marketId, price: normalizedPrice });
    } else {
      row.price = normalizedPrice;
    }
    const saved = await this.marketPricesRepo.save(row);

    if (previousPrice !== saved.price) {
      try {
        await this.automationsService.triggerAutomation(tenantId, TriggerEvent.HOTEL_PRICE_CHANGED, {
          entityType: 'hotel_room_market_price',
          entityId: saved.id,
          roomTypeId,
          marketId,
          price: saved.price,
        });
      } catch (error) {
        console.error('Failed to trigger automation:', error);
      }
    }
    return saved;
  }

  /* ---------- date overrides (Календарь цен / Календарь номеров) ---------- */

  listDateOverrides(tenantId: string, roomTypeId: string, from: string, to: string) {
    return this.overridesRepo
      .createQueryBuilder('o')
      .where('o.tenantId = :tenantId', { tenantId })
      .andWhere('o.roomTypeId = :roomTypeId', { roomTypeId })
      .andWhere('o.date >= :from', { from })
      .andWhere('o.date <= :to', { to })
      .getMany();
  }

  async upsertDateOverride(
    tenantId: string,
    roomTypeId: string,
    date: string,
    dto: { price?: string | null; blocked?: boolean; discountPct?: string; minNights?: number },
  ) {
    let row = await this.overridesRepo.findOne({ where: { tenantId, roomTypeId, date } });
    if (!row) {
      row = this.overridesRepo.create({ tenantId, roomTypeId, date });
    }
    if (dto.price !== undefined) row.price = dto.price === null ? null : normalizeNumericInput(dto.price);
    if (dto.blocked !== undefined) row.blocked = dto.blocked;
    if (dto.discountPct !== undefined) row.discountPct = normalizeNumericInput(dto.discountPct);
    if (dto.minNights !== undefined) row.minNights = dto.minNights;
    return this.overridesRepo.save(row);
  }

  async getMonthFillStats(tenantId: string, roomTypeId: string, year: number, month: number) {
    const rt = await this.get(tenantId, roomTypeId);
    const total = rt.quantity || 0;
    const from = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
    const to = new Date(Date.UTC(year, month, daysInMonth(year, month))).toISOString().slice(0, 10);

    const reservations = await this.reservationsRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.roomTypeId = :roomTypeId', { roomTypeId })
      .andWhere('r.status != :cancelled', { cancelled: 'cancelled' })
      .andWhere('r.checkIn <= :to', { to })
      .andWhere('r.checkOut > :from', { from })
      .getMany();

    // room-nights booked within this month, clamped to the month's date range
    let bookedNights = 0;
    for (const r of reservations) {
      const start = r.checkIn < from ? from : r.checkIn;
      const end = r.checkOut > to ? to : r.checkOut;
      const nights = Math.max(
        0,
        Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000),
      );
      bookedNights += nights;
    }
    const capacityNights = total * daysInMonth(year, month);
    const occupancyPct = capacityNights > 0 ? Math.round((bookedNights / capacityNights) * 100) : 0;
    const occupied = total > 0 ? Math.round((bookedNights / daysInMonth(year, month)) * 10) / 10 : 0;
    return {
      total,
      occupied,
      free: Math.max(0, Math.round((total - occupied) * 10) / 10),
      occupancyPct,
    };
  }

  /* ---------- occupancy types (Цены с размещением) ---------- */

  listOccupancyTypes(tenantId: string, roomTypeId: string) {
    return this.occupancyTypesRepo.find({
      where: { tenantId, roomTypeId },
      order: { sortOrder: 'ASC' },
    });
  }

  createOccupancyType(tenantId: string, roomTypeId: string, dto: Partial<HotelRoomOccupancyType>) {
    return this.occupancyTypesRepo.save(
      this.occupancyTypesRepo.create({
        tenantId,
        roomTypeId,
        label: dto.label ?? 'Новое размещение',
        coefficient: dto.coefficient !== undefined ? normalizeNumericInput(dto.coefficient) : '1',
        paidChildCount: dto.paidChildCount ?? 0,
        sortOrder: dto.sortOrder ?? 0,
      }),
    );
  }

  async updateOccupancyType(tenantId: string, id: string, dto: Partial<HotelRoomOccupancyType>) {
    const row = await this.occupancyTypesRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Строка размещения не найдена');
    const normalized = { ...dto };
    if (normalized.coefficient !== undefined) normalized.coefficient = normalizeNumericInput(normalized.coefficient);
    Object.assign(row, normalized);
    return this.occupancyTypesRepo.save(row);
  }

  async removeOccupancyType(tenantId: string, id: string) {
    const row = await this.occupancyTypesRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Строка размещения не найдена');
    await this.occupancyTypesRepo.remove(row);
    return { ok: true };
  }

  /** Ручное переопределение цены для конкретной пары (размещение, период) — реальные
   * прайс-листы отелей почти всегда содержат точечные правки поверх формулы коэффициента.
   * price=null/'' удаляет override, возвращая ячейку к вычисленному по формуле значению. */
  async setOccupancyOverride(tenantId: string, id: string, periodId: string, price: string | null) {
    const row = await this.occupancyTypesRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Строка размещения не найдена');
    const overrides = { ...(row.periodOverrides || {}) };
    if (price === null || price === '') {
      delete overrides[periodId];
    } else {
      overrides[periodId] = normalizeNumericInput(price);
    }
    row.periodOverrides = overrides;
    return this.occupancyTypesRepo.save(row);
  }
}
