import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelMarket } from './hotel-market.entity';
import { HotelRoomMarketPrice } from './hotel-room-market-price.entity';

function esc(s: string | number | boolean | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Публичная (без входа в CRM) лента номеров/цен отеля по секретному токену в URL — для
 * партнёров/каналов, которым нужен машиночитаемый список без доступа к самой CRM. */
@Injectable()
export class HotelFeedService {
  constructor(
    @InjectRepository(Hotel)
    private readonly hotelsRepo: Repository<Hotel>,
    @InjectRepository(HotelRoomType)
    private readonly roomTypesRepo: Repository<HotelRoomType>,
    @InjectRepository(HotelMarket)
    private readonly marketsRepo: Repository<HotelMarket>,
    @InjectRepository(HotelRoomMarketPrice)
    private readonly marketPricesRepo: Repository<HotelRoomMarketPrice>,
  ) {}

  private async buildFeedData(hotelId: string, token: string) {
    const hotel = await this.hotelsRepo.findOne({ where: { id: hotelId } });
    // Одна и та же ошибка на "нет отеля" и "неверный токен" — не палим существование отеля.
    if (!hotel || !hotel.feedToken || hotel.feedToken !== token) {
      throw new NotFoundException('Feed not found');
    }

    const roomTypes = await this.roomTypesRepo.find({ where: { tenantId: hotel.tenantId, hotelId } });
    const markets = await this.marketsRepo.find({ where: { tenantId: hotel.tenantId, hotelId } });
    const marketById = new Map(markets.map((m) => [m.id, m]));
    const roomTypeIds = roomTypes.map((r) => r.id);
    const marketPrices = roomTypeIds.length
      ? await this.marketPricesRepo.find({ where: { roomTypeId: In(roomTypeIds) } })
      : [];
    const pricesByRoom = new Map<string, Array<{ marketCode: string; marketName: string; price: string }>>();
    for (const mp of marketPrices) {
      const m = marketById.get(mp.marketId);
      if (!m) continue;
      const list = pricesByRoom.get(mp.roomTypeId) || [];
      list.push({ marketCode: m.code, marketName: m.name, price: mp.price });
      pricesByRoom.set(mp.roomTypeId, list);
    }

    return {
      hotel: {
        id: hotel.id,
        name: hotel.name,
        city: hotel.city,
        country: hotel.country,
        stars: hotel.stars,
        currency: hotel.currency,
      },
      generatedAt: new Date().toISOString(),
      roomTypes: roomTypes.map((r) => ({
        id: r.id,
        name: r.name,
        sizeM2: r.sizeM2,
        capacityLabel: r.capacityLabel,
        basePrice: r.basePrice,
        currency: r.currency,
        quantity: r.quantity,
        amenities: r.amenities,
        stopSale: r.stopSale,
        marketPrices: pricesByRoom.get(r.id) || [],
      })),
    };
  }

  getFeedJson(hotelId: string, token: string) {
    return this.buildFeedData(hotelId, token);
  }

  async getFeedXml(hotelId: string, token: string): Promise<string> {
    const data = await this.buildFeedData(hotelId, token);
    const roomsXml = data.roomTypes
      .map(
        (r) => `
    <room>
      <id>${esc(r.id)}</id>
      <name>${esc(r.name)}</name>
      <sizeM2>${esc(r.sizeM2)}</sizeM2>
      <capacity>${esc(r.capacityLabel)}</capacity>
      <basePrice currency="${esc(r.currency)}">${esc(r.basePrice)}</basePrice>
      <quantity>${r.quantity}</quantity>
      <stopSale>${r.stopSale}</stopSale>
      <amenities>${r.amenities.map((a) => `<amenity>${esc(a)}</amenity>`).join('')}</amenities>
      <marketPrices>${r.marketPrices
        .map((mp) => `<price market="${esc(mp.marketCode)}" name="${esc(mp.marketName)}">${esc(mp.price)}</price>`)
        .join('')}</marketPrices>
    </room>`,
      )
      .join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<hotel id="${esc(data.hotel.id)}" currency="${esc(data.hotel.currency)}">
  <name>${esc(data.hotel.name)}</name>
  <city>${esc(data.hotel.city)}</city>
  <country>${esc(data.hotel.country)}</country>
  <stars>${data.hotel.stars}</stars>
  <generatedAt>${esc(data.generatedAt)}</generatedAt>
  <rooms>${roomsXml}
  </rooms>
</hotel>`;
  }
}
