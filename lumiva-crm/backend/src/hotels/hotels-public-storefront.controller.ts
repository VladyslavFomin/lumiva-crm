import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { HotelsPublicStorefrontService } from './hotels-public-storefront.service';

@Controller('public/hotels')
export class HotelsPublicStorefrontController {
  constructor(private readonly service: HotelsPublicStorefrontService) {}

  @Get(':clientKey/hotels')
  listHotels(@Param('clientKey') clientKey: string) {
    return this.service.listHotels(clientKey);
  }

  @Get(':clientKey/search')
  search(
    @Param('clientKey') clientKey: string,
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
    @Query('pax') pax?: string,
  ) {
    return this.service.search(clientKey, checkIn, checkOut, pax ? Number(pax) : undefined);
  }

  @Get(':clientKey/hotels/:hotelId')
  getHotel(@Param('clientKey') clientKey: string, @Param('hotelId') hotelId: string) {
    return this.service.getHotel(clientKey, hotelId);
  }

  @Post(':clientKey/reservations')
  createReservation(@Param('clientKey') clientKey: string, @Body() dto: any) {
    return this.service.createReservation(clientKey, dto);
  }

  /** Онлайн-оплата брони с сайта: ссылка на страницу оплаты (предоплата по тарифу или вся сумма) */
  @Post(':clientKey/reservations/:id/pay')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  pay(@Param('clientKey') clientKey: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.payLink(clientKey, id);
  }

  @Get(':clientKey/reservations/lookup')
  lookupReservation(
    @Param('clientKey') clientKey: string,
    @Query('code') code: string,
    @Query('email') email: string,
  ) {
    return this.service.lookupReservation(clientKey, code, email);
  }
}
