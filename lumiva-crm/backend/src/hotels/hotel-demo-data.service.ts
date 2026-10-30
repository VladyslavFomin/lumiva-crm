import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { HotelReservation, type HotelReservationStatus } from './hotel-reservation.entity';
import { HotelAgency } from './hotel-agency.entity';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelMarket } from './hotel-market.entity';
import { HotelRoomUnit } from './hotel-room-unit.entity';
import { HotelContractsService, addDays, todayStr } from './hotel-contracts.service';

/** Страны гостей с весами — типичный микс курортного отеля в Турции. */
const GUEST_COUNTRIES: Array<[string, number]> = [
  ['DE', 22], ['RU', 20], ['GB', 14], ['TR', 12], ['NL', 6], ['PL', 5], ['UA', 4], ['KZ', 4], ['AT', 3], ['CH', 3], ['SE', 3], ['BE', 2], ['FR', 2],
];
const FIRST = ['Anna', 'Max', 'Olga', 'James', 'Elif', 'Sophie', 'Ivan', 'Emma', 'Mehmet', 'Lukas', 'Maria', 'Daniel', 'Aylin', 'Tom', 'Ekaterina'];
const LAST = ['Müller', 'Ivanova', 'Smith', 'Yılmaz', 'de Vries', 'Kowalski', 'Schmidt', 'Petrov', 'Brown', 'Demir', 'Wagner', 'Novak'];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const weighted = (list: Array<[string, number]>) => {
  const sum = list.reduce((s, [, w]) => s + w, 0);
  let x = Math.random() * sum;
  for (const [v, w] of list) if ((x -= w) <= 0) return v;
  return list[0][0];
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Тестовые брони для проверки аналитики: по реальным отелям/типам номеров/партнёрам тенанта,
 * со странами, контрактами и комиссией. Помечены source='demo' и удаляются одной кнопкой.
 * Пишутся напрямую в таблицу — без автоматизаций и писем гостям.
 */
@Injectable()
export class HotelDemoDataService {
  constructor(
    @InjectRepository(HotelReservation) private readonly reservations: Repository<HotelReservation>,
    @InjectRepository(HotelAgency) private readonly partners: Repository<HotelAgency>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelRoomType) private readonly roomTypes: Repository<HotelRoomType>,
    @InjectRepository(HotelMarket) private readonly markets: Repository<HotelMarket>,
    @InjectRepository(HotelRoomUnit) private readonly units: Repository<HotelRoomUnit>,
    private readonly contracts: HotelContractsService,
  ) {}

  async count(tenantId: string) {
    return { count: await this.reservations.count({ where: { tenantId, source: 'demo' } }) };
  }

  async generate(tenantId: string, opts: { hotelIds?: string[]; count?: number }) {
    const count = Math.min(500, Math.max(10, Math.round(Number(opts.count) || 120)));
    const hotels = await this.hotels.find({ where: opts.hotelIds?.length ? { tenantId, id: In(opts.hotelIds) } : { tenantId } });
    if (!hotels.length) throw new BadRequestException('Сначала добавьте отель');
    const types = await this.roomTypes.find({ where: { tenantId, hotelId: In(hotels.map((h) => h.id)) } });
    if (!types.length) throw new BadRequestException('Сначала добавьте типы номеров');
    const partners = (await this.partners.find({ where: { tenantId, status: 'active' } }));
    const markets = await this.markets.find({ where: { tenantId, hotelId: In(hotels.map((h) => h.id)) } });
    const today = todayStr();
    const rows: HotelReservation[] = [];

    // занятость по типу номера и ночи — тестовые брони не должны давать овербукинг
    const unitRows = await this.units.find({ where: { tenantId, active: true, roomTypeId: In(types.map((t) => t.id)) } });
    const capacity = new Map(types.map((t) => [t.id, unitRows.filter((u) => u.roomTypeId === t.id).length || t.quantity || 0]));
    const used = new Map<string, number>();
    const key = (rtId: string, d: string) => `${rtId}|${d}`;
    const existing = await this.reservations
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere("r.status NOT IN ('cancelled','no_show')")
      .andWhere('r.roomTypeId IN (:...ids)', { ids: types.map((t) => t.id) })
      .andWhere('r.checkOut > :from AND r.checkIn < :to', { from: addDays(today, -90), to: addDays(today, 170) })
      .getMany();
    const nightsList = (a: string, b: string) => {
      const out: string[] = [];
      for (let d = a; d < b; d = addDays(d, 1)) out.push(d);
      return out;
    };
    for (const r of existing) for (const d of nightsList(r.checkIn, r.checkOut)) used.set(key(r.roomTypeId, d), (used.get(key(r.roomTypeId, d)) || 0) + 1);
    const fits = (rtId: string, a: string, b: string) => nightsList(a, b).every((d) => (used.get(key(rtId, d)) || 0) < (capacity.get(rtId) || 0));

    for (let i = 0, attempts = 0; i < count && attempts < count * 20; attempts++) {
      const rt = pick(types);
      const partner = partners.length && Math.random() < 0.82 ? pick(partners) : null;
      const guestCountry = weighted(GUEST_COUNTRIES);
      // заезды: −90…+150 дней, бронь создана за 3–120 дней до заезда
      const checkIn = addDays(today, Math.floor(Math.random() * 240) - 90);
      const nights = [3, 4, 5, 7, 7, 7, 10, 14][Math.floor(Math.random() * 8)];
      const checkOut = addDays(checkIn, nights);
      if (!fits(rt.id, checkIn, checkOut)) continue;
      const created = new Date(`${addDays(checkIn, -(3 + Math.floor(Math.random() * 118)))}T10:00:00Z`);
      const pax = [1, 2, 2, 2, 3, 4][Math.floor(Math.random() * 6)];
      const children = pax > 2 ? pax - 2 : 0;
      const base = Number(rt.basePrice) || 120;
      const gross = round2(base * (0.85 + Math.random() * 0.4));
      const contract = partner
        ? await this.contracts.resolveForReservation(tenantId, { agencyId: partner.id, hotelId: rt.hotelId, checkIn, guestCountry })
        : null;
      const commissionPct = contract ? (contract.pricing === 'net' ? 0 : Number(contract.commissionPct)) : Number(partner?.commissionPct || 0);
      const isPast = checkOut <= today;
      const inHouse = checkIn <= today && checkOut > today;
      let status: HotelReservationStatus = isPast ? 'checked_out' : inHouse ? 'checked_in' : Math.random() < 0.85 ? 'confirmed' : 'pending';
      if (Math.random() < 0.08) status = 'cancelled';
      if (status !== 'cancelled') for (const d of nightsList(checkIn, checkOut)) used.set(key(rt.id, d), (used.get(key(rt.id, d)) || 0) + 1);
      i++;
      const roomTotal = round2(gross * nights);
      const discountPct = Math.random() < 0.2 ? 10 : 0;
      const total = round2(roomTotal * (1 - discountPct / 100));
      const commissionAmount = round2((total * commissionPct) / 100);
      const market = markets.find((m) => m.hotelId === rt.hotelId && (m.countryCodes || []).includes(guestCountry));
      rows.push(
        this.reservations.create({
          tenantId,
          hotelId: rt.hotelId,
          roomTypeId: rt.id,
          agencyId: partner?.id ?? null,
          contractId: contract?.id ?? null,
          guestName: `${pick(FIRST)} ${pick(LAST)}`,
          pax,
          children,
          guestCountry,
          saleCountry: partner?.countryCode || guestCountry,
          marketId: market?.id ?? null,
          market: market?.code ?? null,
          boardType: contract?.boardType || pick(['BB', 'HB', 'AI', 'AI', 'UAI']),
          checkIn,
          checkOut,
          costPerNight: String(round2(gross * 0.45)),
          ppPerNight: String(round2(gross / Math.max(1, pax - children))),
          grossPerNight: String(gross),
          ppTotal: String(round2((gross / Math.max(1, pax - children)) * nights)),
          roomTotal: String(roomTotal),
          discountPct: String(discountPct),
          total: String(total),
          commissionPct: String(commissionPct),
          commissionAmount: String(commissionAmount),
          netTotal: String(round2(total - commissionAmount)),
          status,
          paidStatus: status === 'cancelled' ? 'refunded' : isPast || inHouse ? 'full' : Math.random() < 0.5 ? 'partial' : 'none',
          source: 'demo',
          depositAmount: '0',
          guests: [],
          payments: [],
          checkedInAt: isPast || inHouse ? new Date(`${checkIn}T14:00:00Z`) : null,
          checkedOutAt: isPast && status !== 'cancelled' ? new Date(`${checkOut}T11:00:00Z`) : null,
          createdAt: created,
        } as Partial<HotelReservation>),
      );
    }
    await this.reservations.save(rows, { chunk: 100 });
    return { created: rows.length };
  }

  async clear(tenantId: string) {
    const res = await this.reservations.delete({ tenantId, source: 'demo' });
    return { deleted: res.affected ?? 0 };
  }
}
