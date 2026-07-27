import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelMarketGroup } from './hotel-market-group.entity';
import { HotelMarket } from './hotel-market.entity';
import { HotelReservation } from './hotel-reservation.entity';

const DEFAULT_MARKET_GROUPS = ['Batı Avrupa', 'Doğu Avrupa', 'İç Pazar (TR)'];
const OCCUPIED_STATUSES = ['confirmed', 'pending', 'checked_in'];
const REVENUE_STATUSES = ['confirmed', 'pending', 'checked_in', 'checked_out'];

function toNum(v: string | number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

@Injectable()
export class HotelsService {
  constructor(
    @InjectRepository(Hotel)
    private readonly repo: Repository<Hotel>,
    @InjectRepository(HotelRoomType)
    private readonly roomTypesRepo: Repository<HotelRoomType>,
    @InjectRepository(HotelMarketGroup)
    private readonly marketGroupsRepo: Repository<HotelMarketGroup>,
    @InjectRepository(HotelMarket)
    private readonly marketsRepo: Repository<HotelMarket>,
    @InjectRepository(HotelReservation)
    private readonly reservationsRepo: Repository<HotelReservation>,
  ) {}

  async list(tenantId: string) {
    const hotels = await this.repo.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
    return Promise.all(hotels.map((h) => this.enrich(tenantId, h)));
  }

  async get(tenantId: string, id: string) {
    const hotel = await this.repo.findOne({ where: { id, tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    return this.enrich(tenantId, hotel);
  }

  async create(tenantId: string, dto: Partial<Hotel>) {
    const hotel = await this.repo.save(
      this.repo.create({
        tenantId,
        name: dto.name,
        city: dto.city ?? null,
        country: dto.country ?? null,
        stars: dto.stars ?? 5,
        currency: dto.currency ?? 'USD',
        address: dto.address ?? null,
        description: dto.description ?? null,
        status: dto.status ?? 'draft',
        checkInTime: dto.checkInTime ?? '14:00',
        checkOutTime: dto.checkOutTime ?? '12:00',
      }),
    );

    // Seed default market groups (Batı Avrupa/Doğu Avrupa/İç Pazar) — editable/addable later.
    const groups = await this.marketGroupsRepo.save(
      DEFAULT_MARKET_GROUPS.map((name, i) =>
        this.marketGroupsRepo.create({ tenantId, hotelId: hotel.id, name, sortOrder: i }),
      ),
    );
    hotel.referenceMarketGroupId = groups[0]?.id ?? null;
    await this.repo.save(hotel);

    // Seed default flat markets (TR/DE/RU/UK) for the "Рынки и цены" tab.
    await this.marketsRepo.save(
      [
        { code: 'tr', name: 'Внутренний рынок (TR)' },
        { code: 'de', name: 'Германия' },
        { code: 'ru', name: 'СНГ' },
        { code: 'uk', name: 'Великобритания' },
      ].map((m) => this.marketsRepo.create({ tenantId, hotelId: hotel.id, ...m })),
    );

    return this.enrich(tenantId, hotel);
  }

  async update(tenantId: string, id: string, dto: Partial<Hotel>) {
    const hotel = await this.repo.findOne({ where: { id, tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    Object.assign(hotel, dto);
    await this.repo.save(hotel);
    return this.enrich(tenantId, hotel);
  }

  async updateInfoFields(tenantId: string, id: string, infoFields: Record<string, string | boolean>) {
    const hotel = await this.repo.findOne({ where: { id, tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    hotel.infoFields = { ...hotel.infoFields, ...infoFields };
    await this.repo.save(hotel);
    return this.enrich(tenantId, hotel);
  }

  async setCoverFromUpload(tenantId: string, id: string, filename: string) {
    const hotel = await this.repo.findOne({ where: { id, tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    hotel.coverPhotoUrl = `/v1/uploads/hotels/${tenantId}/${id}/${filename}`;
    await this.repo.save(hotel);
    return this.enrich(tenantId, hotel);
  }

  async getOrCreateFeedToken(tenantId: string, id: string) {
    const hotel = await this.repo.findOne({ where: { id, tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    if (!hotel.feedToken) {
      hotel.feedToken = randomBytes(24).toString('hex');
      await this.repo.save(hotel);
    }
    return { token: hotel.feedToken };
  }

  async regenerateFeedToken(tenantId: string, id: string) {
    const hotel = await this.repo.findOne({ where: { id, tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    hotel.feedToken = randomBytes(24).toString('hex');
    await this.repo.save(hotel);
    return { token: hotel.feedToken };
  }

  async remove(tenantId: string, id: string) {
    const hotel = await this.repo.findOne({ where: { id, tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    // Deleting a hotel cascades through room types straight to reservations at the DB level
    // (FK ON DELETE CASCADE both hops) — bypasses the per-room-type reservation guard entirely,
    // so check here too rather than silently wiping guest booking history for the whole hotel.
    const reservationCount = await this.reservationsRepo.count({ where: { tenantId, hotelId: id } });
    if (reservationCount > 0) {
      throw new BadRequestException(
        `Нельзя удалить отель — с ним связано ${reservationCount} брон${reservationCount === 1 ? 'ь' : 'ей'}. Сначала отмените или перенесите эти брони.`,
      );
    }
    await this.repo.remove(hotel);
    return { ok: true };
  }

  private async enrich(tenantId: string, hotel: Hotel) {
    const roomTypes = await this.roomTypesRepo.find({ where: { tenantId, hotelId: hotel.id } });
    const totalRooms = roomTypes.reduce((s, r) => s + (r.quantity || 0), 0);
    const roomTypeIds = roomTypes.map((r) => r.id);
    const marketsCount = await this.marketsRepo.count({ where: { tenantId, hotelId: hotel.id } });

    let occupancyToday = 0;
    let adr = 0;
    if (roomTypeIds.length) {
      const today = new Date().toISOString().slice(0, 10);
      const reservations = await this.reservationsRepo
        .createQueryBuilder('r')
        .where('r.tenantId = :tenantId', { tenantId })
        .andWhere('r.hotelId = :hotelId', { hotelId: hotel.id })
        .getMany();

      const occupiedToday = reservations.filter(
        (r) => OCCUPIED_STATUSES.includes(r.status) && r.checkIn <= today && r.checkOut > today,
      ).length;
      occupancyToday = totalRooms > 0 ? Math.round((occupiedToday / totalRooms) * 100) : 0;

      const revenueRows = reservations.filter((r) => REVENUE_STATUSES.includes(r.status));
      const totalNights = revenueRows.reduce(
        (s, r) => s + nightsBetween(r.checkIn, r.checkOut),
        0,
      );
      const totalRoomRevenue = revenueRows.reduce((s, r) => s + toNum(r.roomTotal), 0);
      adr = totalNights > 0 ? Math.round(totalRoomRevenue / totalNights) : 0;
    }

    return {
      ...hotel,
      roomsCount: totalRooms,
      roomTypesCount: roomTypes.length,
      marketsCount,
      occupancyToday,
      adr,
    };
  }

  async getOverviewKpis(tenantId: string) {
    const hotels = await this.repo.find({ where: { tenantId } });
    const roomTypes = await this.roomTypesRepo.find({ where: { tenantId } });
    const totalRooms = roomTypes.reduce((s, r) => s + (r.quantity || 0), 0);

    const today = new Date().toISOString().slice(0, 10);
    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

    const reservations = await this.reservationsRepo.find({ where: { tenantId } });
    const occupiedToday = reservations.filter(
      (r) => OCCUPIED_STATUSES.includes(r.status) && r.checkIn <= today && r.checkOut > today,
    ).length;
    const occupancyToday = totalRooms > 0 ? Math.round((occupiedToday / totalRooms) * 100) : 0;

    const revenueRows = reservations.filter((r) => REVENUE_STATUSES.includes(r.status));
    const totalNights = revenueRows.reduce((s, r) => s + nightsBetween(r.checkIn, r.checkOut), 0);
    const totalRoomRevenue = revenueRows.reduce((s, r) => s + toNum(r.roomTotal), 0);
    const adr = totalNights > 0 ? Math.round(totalRoomRevenue / totalNights) : 0;

    const last30 = reservations.filter(
      (r) => REVENUE_STATUSES.includes(r.status) && r.createdAt.toISOString().slice(0, 10) >= since30,
    );
    const bookings30d = last30.length;
    const revenue30d = Math.round(last30.reduce((s, r) => s + toNum(r.total), 0));

    return {
      hotelsCount: hotels.length,
      roomsCount: totalRooms,
      occupancyToday,
      adr,
      bookings30d,
      revenue30d,
    };
  }
}
