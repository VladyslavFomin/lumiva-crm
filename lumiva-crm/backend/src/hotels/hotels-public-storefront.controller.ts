import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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

  @Post(':clientKey/reservations/:id/test-payment')
  testPayment(@Param('clientKey') clientKey: string, @Param('id') id: string) {
    return this.service.testPayment(clientKey, id);
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
