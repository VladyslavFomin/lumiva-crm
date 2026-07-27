import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HotelFeedService } from './hotel-feed.service';

/** Публичный, без JWT/RBAC — доступ контролируется только совпадением токена в URL с
 * Hotel.feedToken (см. HotelFeedService.buildFeedData). Тот же стиль, что PublicEmbedController. */
@Controller('public/hotel-feed')
export class HotelFeedController {
  constructor(private readonly feed: HotelFeedService) {}

  @Get(':hotelId/:token/json')
  getJson(@Param('hotelId') hotelId: string, @Param('token') token: string) {
    return this.feed.getFeedJson(hotelId, token);
  }

  @Get(':hotelId/:token/xml')
  async getXml(
    @Param('hotelId') hotelId: string,
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const xml = await this.feed.getFeedXml(hotelId, token);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  }
}
