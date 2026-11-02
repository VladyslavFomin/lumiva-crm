import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { HotelRatePlansService } from './hotel-rate-plans.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelReservation } from './hotel-reservation.entity';
import { TenantsService } from '../tenants/tenants.service';
import { HotelsPricingService } from './hotels-pricing.service';
import { HotelAvailabilityService } from './hotel-availability.service';
import { HotelRoomTypesService } from './hotel-room-types.service';
import { HotelsGalleryService } from './hotels-gallery.service';
import { HotelReservationsService } from './hotel-reservations.service';
import { HotelPaymentLinksService } from './hotel-payment-links.service';

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

/**
 * Публичный (без авторизации) поиск/бронирование отелей для тестовой витрины на pl1 — см.
 * текущий план "Test storefront". Тенант резолвится по `Tenant.clientKey`, как и в остальных
 * public/* контроллерах этого раунда. Вся математика цены/доступности переиспользуется из
 * существующих сервисов (HotelsPricingService/HotelAvailabilityService) — здесь только
 * оркестрация под анонимный доступ.
 */
@Injectable()
export class HotelsPublicStorefrontService {
  constructor(
    @InjectRepository(Hotel)
    private readonly hotelRepo: Repository<Hotel>,
    @InjectRepository(HotelRoomType)
    private readonly roomTypeRepo: Repository<HotelRoomType>,
    @InjectRepository(HotelReservation)
    private readonly reservationRepo: Repository<HotelReservation>,
    private readonly tenants: TenantsService,
    private readonly pricing: HotelsPricingService,
    private readonly availability: HotelAvailabilityService,
    private readonly roomTypesService: HotelRoomTypesService,
    private readonly gallery: HotelsGalleryService,
    private readonly reservations: HotelReservationsService,
    private readonly payLinks: HotelPaymentLinksService,
    private readonly ratePlans: HotelRatePlansService,
  ) {}

  async resolveTenantId(clientKey: string): Promise<string> {
    const tenant = await this.tenants.findByClientKey(clientKey);
    if (!tenant) throw new NotFoundException('Не найдено');
    return tenant.id;
  }

  async listHotels(clientKey: string) {
    const tenantId = await this.resolveTenantId(clientKey);
    const hotels = await this.hotelRepo.find({ where: { tenantId, status: 'active' }, order: { name: 'ASC' } });
    return hotels.map((h) => ({
      id: h.id,
      name: h.name,
      city: h.city,
      country: h.country,
      stars: h.stars,
      currency: h.currency,
      description: h.description,
      coverPhotoUrl: h.coverPhotoUrl,
    }));
  }

  /** Первая строка размещения (по sortOrder) используется как "цена от" в результатах поиска —
   * тестовой витрине не нужно показывать все варианты размещения на карточке результата. */
  async search(clientKey: string, checkIn: string, checkOut: string, pax?: number) {
    if (!checkIn || !checkOut) throw new BadRequestException('checkIn и checkOut обязательны');
    const tenantId = await this.resolveTenantId(clientKey);
    const hotels = await this.hotelRepo.find({ where: { tenantId, status: 'active' } });
    const nights = nightsBetween(checkIn, checkOut);

    const results: Array<{
      hotelId: string;
      hotelName: string;
      city: string | null;
      stars: number;
      coverPhotoUrl: string | null;
      roomTypeId: string;
      roomTypeName: string;
      currency: string;
      pricePerNight: number;
      nights: number;
      total: number;
      ratePlan: { code: string; name: string; boardType: string; refundable: boolean } | null;
      prepayment: { amount: number; dueDate: string | null } | null;
      /** цена без акций (зачёркнутая) и названия акций — только если акция сработала */
      totalBeforePromo: number | null;
      promotions: string[];
    }> = [];

    for (const hotel of hotels) {
      const roomTypes = await this.roomTypeRepo.find({ where: { tenantId, hotelId: hotel.id } });
      for (const roomType of roomTypes) {
        if (pax && roomType.quantity <= 0) continue;
        const check = await this.availability.checkAvailability({ tenantId, roomTypeId: roomType.id, checkIn, checkOut });
        if (!check.ok) continue;

        const occupancyRows = await this.roomTypesService.listOccupancyTypes(tenantId, roomType.id);
        const firstOccupancy = occupancyRows[0];
        if (!firstOccupancy) continue;

        // тот же расчёт по ночам, что и у брони (сезоны, календарь, скидки дат); ночь без цены — не продаём
        // на сайте — тариф, который продаётся на сайте (по умолчанию, если он такой); нет — чистый прайс
        const plan = await this.ratePlans.websitePlan(tenantId, hotel.id, roomType.id);
        const quote = await this.reservations.quote(tenantId, { roomTypeId: roomType.id, occupancyTypeId: firstOccupancy.id, checkIn, checkOut, ratePlanId: plan?.id ?? null, useDefaultRatePlan: false, promotions: 'auto', salesChannel: 'website' }).catch(() => null);
        if (quote && plan && quote.warnings.some((w) => w.code === 'min_stay')) continue;
        if (!quote || quote.warnings.some((w) => w.code === 'no_price' || w.code === 'blocked')) continue;

        results.push({
          hotelId: hotel.id,
          hotelName: hotel.name,
          city: hotel.city,
          stars: hotel.stars,
          coverPhotoUrl: hotel.coverPhotoUrl,
          roomTypeId: roomType.id,
          roomTypeName: roomType.name,
          currency: hotel.currency,
          pricePerNight: quote.average,
          nights,
          total: quote.total,
          ratePlan: quote.ratePlan ? { code: quote.ratePlan.code, name: quote.ratePlan.name, boardType: quote.ratePlan.boardType, refundable: quote.ratePlan.refundable } : null,
          prepayment: quote.prepayment && quote.prepayment.amount > 0 ? quote.prepayment : null,
          totalBeforePromo: quote.promoDiscount > 0 ? quote.totalBeforePromo : null,
          promotions: quote.promotions.map((p) => p.name),
        });
      }
    }
    return results;
  }

  async getHotel(clientKey: string, hotelId: string) {
    const tenantId = await this.resolveTenantId(clientKey);
    const hotel = await this.hotelRepo.findOne({ where: { id: hotelId, tenantId, status: 'active' } });
    if (!hotel) throw new NotFoundException('Отель не найден');

    const roomTypes = await this.roomTypeRepo.find({ where: { tenantId, hotelId } });
    const roomTypesWithOccupancy = await Promise.all(
      roomTypes.map(async (rt) => ({
        id: rt.id,
        name: rt.name,
        sizeM2: rt.sizeM2,
        capacityLabel: rt.capacityLabel,
        amenities: rt.amenities,
        coverPhotoUrl: rt.coverPhotoUrl,
        occupancyTypes: (await this.roomTypesService.listOccupancyTypes(tenantId, rt.id)).map((o) => ({
          id: o.id,
          label: o.label,
        })),
      })),
    );

    const photos = await this.gallery.listPhotos(tenantId, hotelId);

    return {
      id: hotel.id,
      name: hotel.name,
      city: hotel.city,
      country: hotel.country,
      stars: hotel.stars,
      currency: hotel.currency,
      address: hotel.address,
      description: hotel.description,
      checkInTime: hotel.checkInTime,
      checkOutTime: hotel.checkOutTime,
      coverPhotoUrl: hotel.coverPhotoUrl,
      roomTypes: roomTypesWithOccupancy,
      photos: photos.map((p) => ({ id: p.id, url: p.url })),
    };
  }

  private async generateBookingCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = `RES-${randomBytes(4).toString('hex').toUpperCase()}`;
      const existing = await this.reservationRepo.findOne({ where: { bookingCode: code } });
      if (!existing) return code;
    }
    throw new Error('Не удалось сгенерировать уникальный код брони');
  }

  async createReservation(
    clientKey: string,
    dto: {
      hotelId: string;
      roomTypeId: string;
      occupancyTypeId: string;
      checkIn: string;
      checkOut: string;
      guestName: string;
      guestEmail: string;
      guestPhone?: string;
      pax?: number;
      notes?: string;
    },
  ) {
    const tenantId = await this.resolveTenantId(clientKey);
    return this.createReservationForTenant(tenantId, dto);
  }

  /** Та же логика, что createReservation, но без clientKey→tenantId резолва — для вызывающих,
   * у кого tenantId уже есть (например embed-forms.service.ts's submit()). */
  async createReservationForTenant(
    tenantId: string,
    dto: {
      hotelId: string;
      roomTypeId: string;
      occupancyTypeId: string;
      checkIn: string;
      checkOut: string;
      guestName: string;
      guestEmail: string;
      guestPhone?: string;
      pax?: number;
      notes?: string;
    },
  ) {
    if (!dto.hotelId || !dto.roomTypeId || !dto.occupancyTypeId || !dto.checkIn || !dto.checkOut) {
      throw new BadRequestException('Не заполнены обязательные поля');
    }
    if (!dto.guestName?.trim() || !dto.guestEmail?.trim()) {
      throw new BadRequestException('Укажите имя и email гостя');
    }

    // Цена всегда считается на сервере прайсом по ночам (priceMode=auto) — витрина не доверяет клиенту сумму брони.

    const bookingCode = await this.generateBookingCode();
    const plan = await this.ratePlans.websitePlan(tenantId, dto.hotelId, dto.roomTypeId);
    const reservation = await this.reservations.create(
      tenantId,
      {
        hotelId: dto.hotelId,
        roomTypeId: dto.roomTypeId,
        occupancyTypeId: dto.occupancyTypeId,
        checkIn: dto.checkIn,
        checkOut: dto.checkOut,
        guestName: dto.guestName,
        guestEmail: dto.guestEmail,
        guestPhone: dto.guestPhone ?? null,
        pax: dto.pax ?? 1,
        priceMode: 'auto',
        status: 'pending',
        source: 'website',
        ratePlanId: plan?.id ?? 'none',
        notes: dto.notes ?? null,
        bookingCode,
      },
      null,
    );

    const hotel = await this.hotelRepo.findOne({ where: { id: dto.hotelId, tenantId } });
    return { id: reservation.id, bookingCode: reservation.bookingCode, total: reservation.total, currency: hotel?.currency ?? 'USD' };
  }

  /**
   * Раньше здесь была «тестовая оплата» без проверки — любой, кто знал id брони, мог отметить её оплаченной.
   * Теперь — настоящий запрос оплаты через подключённую платёжную систему (HotelPaymentLinksService).
   */
  async payLink(clientKey: string, reservationId: string) {
    const tenantId = await this.resolveTenantId(clientKey);
    const q = await this.payLinks.forWebsite(tenantId, reservationId);
    return { url: q.url, amount: q.amount, currency: q.currency, kind: q.kind };
  }

  async lookupReservation(clientKey: string, code: string, email: string) {
    const tenantId = await this.resolveTenantId(clientKey);
    const reservation = await this.reservationRepo.findOne({ where: { tenantId, bookingCode: code } });
    if (!reservation || reservation.guestEmail?.toLowerCase() !== email.trim().toLowerCase()) {
      throw new NotFoundException('Бронь не найдена');
    }
    const [hotel, roomType] = await Promise.all([
      this.hotelRepo.findOne({ where: { id: reservation.hotelId, tenantId } }),
      this.roomTypeRepo.findOne({ where: { id: reservation.roomTypeId, tenantId } }),
    ]);
    return {
      bookingCode: reservation.bookingCode,
      hotelName: hotel?.name ?? null,
      roomTypeName: roomType?.name ?? null,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      guestName: reservation.guestName,
      pax: reservation.pax,
      total: reservation.total,
      currency: hotel?.currency ?? 'USD',
      status: reservation.status,
      paidStatus: reservation.paidStatus,
    };
  }
}
