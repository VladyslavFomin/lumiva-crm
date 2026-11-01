import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelPromotionsService, HotelPromotionInput } from './hotel-promotions.service';
import { HotelRateEngineService } from './hotel-rate-engine.service';
import { promotionBlockers } from './hotel-promotions.util';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Акции отеля (раннее бронирование, горящие, спецпредложения, длительное проживание) и проверка на примере брони */
@Controller('hotels/promotions')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelPromotionsController {
  constructor(private readonly promos: HotelPromotionsService, private readonly rates: HotelRateEngineService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload, @Query('hotelId', new ParseUUIDPipe()) hotelId: string) {
    return this.promos.list(user.tenantId, hotelId);
  }

  /**
   * Пример брони: цена с акциями и без, и по каждой акции отеля — сработала ли и что помешало
   * (окно брони, дни до заезда, ночи, период, рынок, номер, тариф, канал продаж).
   */
  @Post('check')
  async check(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: { hotelId: string; roomTypeId: string; checkIn: string; checkOut: string; bookedOn?: string; marketGroupId?: string | null; ratePlanId?: string | null; adults?: number; salesChannel?: 'direct' | 'website' },
  ) {
    if (!dto?.hotelId || !dto.roomTypeId) throw new BadRequestException({ code: 'HOTEL_PROMO_CHECK', message: 'Выберите отель и тип номера' });
    if (dto.bookedOn && !ISO.test(dto.bookedOn)) throw new BadRequestException({ code: 'HOTEL_PROMO_DATE', message: 'Неверная дата брони' });
    const salesChannel = dto.salesChannel === 'website' ? 'website' : 'direct';
    const base = {
      roomTypeId: dto.roomTypeId,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      marketGroupId: dto.marketGroupId || null,
      ratePlanId: dto.ratePlanId && dto.ratePlanId !== 'none' ? dto.ratePlanId : null,
      useDefaultRatePlan: dto.ratePlanId !== 'none',
      adults: dto.adults && dto.adults > 0 ? Math.round(dto.adults) : undefined,
      strictOccupancy: false,
      salesChannel,
      bookedAt: dto.bookedOn ? `${dto.bookedOn}T12:00:00Z` : null,
    } as const;
    const quote = await this.rates.quote(user.tenantId, { ...base, promotions: 'auto' });
    if (quote.hotelId !== dto.hotelId) throw new BadRequestException({ code: 'HOTEL_PROMO_CHECK', message: 'Тип номера не из этого отеля' });
    const list = await this.promos.list(user.tenantId, dto.hotelId);
    const dates = quote.nights.map((n) => n.date);
    const ctx = { checkIn: dto.checkIn, checkOut: dto.checkOut, bookedOn: quote.bookedOn, roomTypeId: dto.roomTypeId, marketGroupId: quote.marketGroupId, ratePlanId: quote.ratePlan?.id ?? null, salesChannel } as const;
    return {
      total: quote.total,
      totalBeforePromo: quote.totalBeforePromo,
      promoDiscount: quote.promoDiscount,
      currency: quote.currency,
      prepayment: quote.prepayment,
      ratePlan: quote.ratePlan,
      nights: quote.nights,
      warnings: quote.warnings,
      promotions: list.map((p) => {
        const hit = quote.promotions.find((a) => a.id === p.id);
        const blockers = hit ? [] : promotionBlockers(p, ctx, dates);
        // подошла по условиям, но проиграла более выгодной несуммируемой
        return { id: p.id, name: p.name, type: p.type, applied: !!hit, amount: hit?.amount ?? 0, blockers: !hit && !blockers.length ? ['not_best'] : blockers };
      }),
    };
  }

  @Post()
  @RequirePermission('hotels_manage_pricing', 'write')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: HotelPromotionInput & { hotelId?: string }) {
    return this.promos.create(user.tenantId, { ...(dto || {}), origin: 'manual' });
  }

  @Patch(':id')
  @RequirePermission('hotels_manage_pricing', 'write')
  update(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: HotelPromotionInput) {
    const { origin: _o, ...rest } = dto || {};
    return this.promos.update(user.tenantId, id, rest);
  }

  @Delete(':id')
  @RequirePermission('hotels_manage_pricing', 'delete')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.promos.remove(user.tenantId, id);
  }
}
