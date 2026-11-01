import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelMarket } from './hotel-market.entity';
import { HotelMarketGroup } from './hotel-market-group.entity';
import { HotelPricingPeriod } from './hotel-pricing-period.entity';
import { HotelRoomDateOverride } from './hotel-room-date-override.entity';
import { HotelRoomOccupancyType } from './hotel-room-occupancy-type.entity';
import { HotelRoomBlock } from './hotel-room-block.entity';
import { HotelContract } from './hotel-contract.entity';
import { HotelNightlyRate, HotelRateSource } from './hotel-reservation.entity';
import { HotelsPricingService, occupancyCoefficient } from './hotels-pricing.service';
import { HotelRatePlansService, ratePlanNight, ratePlanPrepayment } from './hotel-rate-plans.service';
import { isInfant } from './hotel-occupancy.util';
import { hotelToday } from './hotel-folio.service';
import { normalizeCountry } from '../common/countries';
import { ChildRateLine, childRateLines, matchOccupancyByAges, normalizeChildAges, splitGuests } from './hotel-occupancy.util';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Регионы для автосопоставления рынка с группой рынков по странам и названию группы */
const WEST = ['DE', 'AT', 'CH', 'NL', 'BE', 'LU', 'FR', 'GB', 'IE', 'DK', 'SE', 'NO', 'FI', 'IS', 'IT', 'ES', 'PT', 'MT', 'LI', 'MC', 'US', 'CA'];
const EAST = ['RU', 'UA', 'BY', 'KZ', 'KG', 'UZ', 'TJ', 'TM', 'AM', 'AZ', 'GE', 'MD', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'RS', 'HR', 'SI', 'BA', 'ME', 'MK', 'AL', 'LT', 'LV', 'EE'];
const GROUP_HINTS: Record<'west' | 'east' | 'domestic', RegExp> = {
  west: /bat[ıi]|west|запад|western/i,
  east: /do[ğg]u|east|восто|снг|cis|eastern/i,
  domestic: /i[çc]\s*pazar|domestic|внутр|local|yerel|\(tr\)/i,
};

export interface HotelQuoteInput {
  roomTypeId: string;
  occupancyTypeId?: string | null;
  checkIn: string;
  checkOut: string;
  marketId?: string | null;
  market?: string | null;
  guestCountry?: string | null;
  contractId?: string | null;
  blockId?: string | null;
  /** Состав гостей: если размещение не выбрано явно — подбирается по взрослым + детям (возраст ≥ hotel.childMaxAge — взрослый) */
  adults?: number | null;
  childAges?: Array<number | null> | null;
  /** false — состав выведен из pax старой брони/API: нет точного размещения → как раньше, первое размещение */
  strictOccupancy?: boolean;
  /** группа рынков напрямую (выгрузка тарифа в канал) — важнее рынка/страны гостя */
  marketGroupId?: string | null;
  /** тариф (питание, корректировка, отмена, предоплата); не задан — тариф по умолчанию, у контракта/блока — без тарифа */
  ratePlanId?: string | null;
  /** false — не брать тариф по умолчанию (расчёт «чистого» прайса) */
  useDefaultRatePlan?: boolean;
}

export interface HotelQuote {
  nights: HotelNightlyRate[];
  total: number;
  average: number;
  /** средняя сезонная цена (PP/ночь в карточке) — до календаря */
  seasonAverage: number;
  /** средняя цена на человека за ночь (price ÷ коэффициент размещения) */
  ppAverage: number;
  occupancyTypeId: string | null;
  /** состав, по которому подобрано размещение (дети старше childMaxAge — уже среди взрослых) */
  /** infants — дети младше 2 лет: бесплатно, нужна детская кроватка */
  guests: { adults: number; children: number; grown: number; infants: number; childMaxAge: number } | null;
  /** доплаты за детей по детской политике (доля цены взрослого) — пусто, если дети входят в размещение */
  childLines: ChildRateLine[];
  childPolicySource: 'contract' | 'hotel' | null;
  marketId: string | null;
  marketGroupId: string | null;
  /** группа подобрана автоматически (у рынка не задана) */
  marketGroupGuessed: boolean;
  /** всегда 'season': плоская цена рынка больше не участвует (поле оставлено для старых клиентов API) */
  priority: 'season' | 'market';
  /** тариф расчёта и предоплата по нему (сумма и срок) */
  ratePlan: { id: string; code: string; name: string; boardType: string; refundable: boolean } | null;
  prepayment: { amount: number; dueDate: string | null } | null;
  currency: string;
  /** min_stay / max_stay / release — условия заезда (value — ночей / дней release); closed_arrival / closed_departure — дата закрыта
   * на заезд / выезд; below_budget — PP ночи ниже бюджета */
  warnings: Array<{ code: 'no_price' | 'blocked' | 'group_fallback' | 'no_occupancy' | 'min_stay' | 'max_stay' | 'closed_arrival' | 'closed_departure' | 'release' | 'below_budget'; dates: string[]; value?: number }>;
}

/**
 * Единый расчёт цены брони по ночам. Порядок на каждую ночь:
 * блок → контракт партнёра → цена календаря на дату → прайс по группе рынка гостя (правка по дням, иначе прайс сезона:
 * PP периода + разница категории ± рынок × коэффициент, см. HotelsPricingService.dailyPrices) → базовая цена номера;
 * скидка календаря на дату — сверху (кроме цен партнёра, они уже договорные). Плоская цена рынка в расчёт не идёт.
 */
@Injectable()
export class HotelRateEngineService {
  constructor(
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
    @InjectRepository(HotelRoomType) private readonly roomTypes: Repository<HotelRoomType>,
    @InjectRepository(HotelMarket) private readonly markets: Repository<HotelMarket>,
    @InjectRepository(HotelMarketGroup) private readonly groups: Repository<HotelMarketGroup>,
    @InjectRepository(HotelPricingPeriod) private readonly periods: Repository<HotelPricingPeriod>,
    @InjectRepository(HotelRoomDateOverride) private readonly overrides: Repository<HotelRoomDateOverride>,
    @InjectRepository(HotelRoomOccupancyType) private readonly occupancy: Repository<HotelRoomOccupancyType>,
    @InjectRepository(HotelRoomBlock) private readonly blocks: Repository<HotelRoomBlock>,
    @InjectRepository(HotelContract) private readonly contracts: Repository<HotelContract>,
    private readonly pricing: HotelsPricingService,
    private readonly ratePlans: HotelRatePlansService,
  ) {}

  /** Группа рынков по странам рынка и названию группы: Batı Avrupa ↔ DE/GB…, Doğu Avrupa ↔ RU/UA…, İç Pazar ↔ страна отеля */
  guessGroup(market: Pick<HotelMarket, 'countryCodes' | 'code' | 'name'>, groups: HotelMarketGroup[], hotelCountry: string | null): HotelMarketGroup | null {
    if (!groups.length) return null;
    const home = normalizeCountry(hotelCountry || '') || 'TR';
    const codes = (market.countryCodes || []).map((c) => c.toUpperCase());
    if (!codes.length && /^[a-z]{2}$/i.test(market.code)) codes.push(market.code.toUpperCase());
    const score = { west: 0, east: 0, domestic: 0 };
    for (const c of codes) {
      if (c === home) score.domestic += 1;
      else if (WEST.includes(c)) score.west += 1;
      else if (EAST.includes(c)) score.east += 1;
    }
    const region = (Object.keys(score) as Array<keyof typeof score>).sort((a, b) => score[b] - score[a])[0];
    if (!score[region]) return null;
    return groups.find((g) => GROUP_HINTS[region].test(g.name)) || null;
  }

  /** Сохранить автосопоставление всем рынкам отеля без группы; возвращает, что сопоставлено */
  async autoMapGroups(tenantId: string, hotelId: string) {
    const hotel = await this.hotels.findOne({ where: { id: hotelId, tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    const [markets, groups] = await Promise.all([
      this.markets.find({ where: { tenantId, hotelId } }),
      this.groups.find({ where: { tenantId, hotelId } }),
    ]);
    const mapped: Array<{ marketId: string; marketGroupId: string }> = [];
    for (const m of markets) {
      if (m.marketGroupId && groups.some((g) => g.id === m.marketGroupId)) continue;
      const g = this.guessGroup(m, groups, hotel.country);
      if (!g) continue;
      m.marketGroupId = g.id;
      mapped.push({ marketId: m.id, marketGroupId: g.id });
    }
    if (mapped.length) await this.markets.save(markets.filter((m) => mapped.some((x) => x.marketId === m.id)));
    return { mapped: mapped.length, unmapped: markets.filter((m) => !m.marketGroupId).length };
  }

  async quote(tenantId: string, input: HotelQuoteInput): Promise<HotelQuote> {
    if (!ISO.test(input.checkIn || '') || !ISO.test(input.checkOut || '') || input.checkOut <= input.checkIn) {
      throw new BadRequestException({ code: 'HOTEL_QUOTE_BAD_DATES', message: 'Неверные даты' });
    }
    const roomType = await this.roomTypes.findOne({ where: { id: input.roomTypeId, tenantId } });
    if (!roomType) throw new NotFoundException('Тип номера не найден');
    const hotel = await this.hotels.findOne({ where: { id: roomType.hotelId, tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    const dates: string[] = [];
    for (let d = input.checkIn; d < input.checkOut; d = addDays(d, 1)) dates.push(d);
    if (dates.length > 366) throw new BadRequestException({ code: 'HOTEL_QUOTE_RANGE', message: 'Слишком длинный период' });

    const [markets, groups, occTypes, overrides, block, contract] = await Promise.all([
      this.markets.find({ where: { tenantId, hotelId: hotel.id } }),
      this.groups.find({ where: { tenantId, hotelId: hotel.id } }),
      this.occupancy.find({ where: { tenantId, roomTypeId: roomType.id }, order: { sortOrder: 'ASC' } }),
      // включая дату выезда — там может стоять «закрыто на выезд»
      this.overrides.find({ where: { tenantId, roomTypeId: roomType.id, date: Between(input.checkIn, input.checkOut) } }),
      input.blockId ? this.blocks.findOne({ where: { id: input.blockId, tenantId } }) : Promise.resolve(null),
      input.contractId ? this.contracts.findOne({ where: { id: input.contractId, tenantId } }) : Promise.resolve(null),
    ]);

    // рынок: явный → по коду → по стране гостя
    const country = normalizeCountry(input.guestCountry || '') || null;
    const market =
      (input.marketId && markets.find((m) => m.id === input.marketId)) ||
      (input.market && markets.find((m) => m.code === input.market)) ||
      (country && markets.find((m) => (m.countryCodes || []).includes(country))) ||
      null;
    const directGroup = input.marketGroupId && groups.some((g) => g.id === input.marketGroupId) ? input.marketGroupId : null;
    let marketGroupId: string | null = directGroup || (market?.marketGroupId && groups.some((g) => g.id === market.marketGroupId) ? market.marketGroupId : null);
    let guessed = false;
    if (market && !marketGroupId) {
      const g = this.guessGroup(market, groups, hotel.country);
      if (g) { marketGroupId = g.id; guessed = true; }
    }
    // размещение: явно выбранное → по составу гостей → (старые вызовы без состава) первое
    let occ = occTypes.find((o) => o.id === input.occupancyTypeId) || null;
    let guests: HotelQuote['guests'] = null;
    let noOccupancy = false;
    // детская политика: контракта партнёра, иначе отеля; есть — дети доплачиваются по полосам, размещение — по взрослым
    const childPolicy = contract?.childPolicy?.length ? contract.childPolicy : hotel.childPolicy || [];
    const policySource: HotelQuote['childPolicySource'] = contract?.childPolicy?.length ? 'contract' : hotel.childPolicy?.length ? 'hotel' : null;
    let childLines: ChildRateLine[] = [];
    const adultsIn = Math.round(Number(input.adults) || 0);
    if (adultsIn > 0) {
      const childMaxAge = Number(hotel.childMaxAge) || 12;
      const ages = normalizeChildAges(input.childAges);
      const split = splitGuests(adultsIn, ages, childMaxAge);
      guests = { ...split, childMaxAge };
      const kids = ages.filter((a) => a === null || a < childMaxAge);
      const byPolicy = childPolicy.length > 0 && split.children > 0 && (!occ || !occ.children);
      if (byPolicy) childLines = childRateLines(childPolicy, kids);
      if (!occ) {
        occ = matchOccupancyByAges(occTypes, split.adults, byPolicy ? [] : kids);
        if (!occ && input.strictOccupancy === false) occ = occTypes[0] || null;
        noOccupancy = !occ && input.strictOccupancy !== false;
      }
    } else if (!occ) {
      occ = occTypes[0] || null;
    }

    // прайс по каждой ночи: правки по дням → прайс сезона по группе рынка гостя, иначе опорная
    const [daily, periods] = await Promise.all([
      this.pricing.dailyPrices(tenantId, hotel, roomType, occ, marketGroupId, dates),
      this.periods.find({ where: { tenantId, hotelId: hotel.id }, order: { startDate: 'ASC' } }),
    ]);
    const seasonPrice = (d: string) => daily.get(d) || null;
    const periodOf = (d: string) => periods.find((p) => d >= p.startDate && d <= p.endDate) || null;
    // условия заезда: минимум ночей (период и календарь — что строже), release, закрыто на заезд / выезд, максимум ночей
    const arrival = periodOf(input.checkIn);
    const arrOv = overrides.find((o) => o.date === input.checkIn);
    const depOv = overrides.find((o) => o.date === input.checkOut);
    const stayRule: HotelQuote['warnings'] = [];
    const minStay = Math.max(arrival?.minNights || 1, arrOv?.minNights || 1);
    if (minStay > 1 && dates.length < minStay) stayRule.push({ code: 'min_stay', dates: [input.checkIn], value: minStay });
    if (arrOv?.maxNights && dates.length > arrOv.maxNights) stayRule.push({ code: 'max_stay', dates: [input.checkIn], value: arrOv.maxNights });
    if (arrOv?.closedToArrival) stayRule.push({ code: 'closed_arrival', dates: [input.checkIn] });
    if (depOv?.closedToDeparture) stayRule.push({ code: 'closed_departure', dates: [input.checkOut] });
    if (arrival && arrival.releaseDays > 0) {
      const today = new Date().toISOString().slice(0, 10);
      if (addDays(today, arrival.releaseDays) > input.checkIn) stayRule.push({ code: 'release', dates: [input.checkIn], value: arrival.releaseDays });
    }

    const base = num(roomType.basePrice);
    const blockRate = block && block.roomTypeId === roomType.id ? num(block.ratePerNight) : 0;
    const contractRate = contract ? num(contract.rooms?.find((l) => l.roomTypeId === roomType.id)?.rate) : 0;
    const ovByDate = new Map(overrides.map((o) => [o.date, o]));

    // тариф: у цен контракта и блока свои условия — тариф к ним не применяется
    const plan = blockRate > 0 || contractRate > 0 || (!input.ratePlanId && input.useDefaultRatePlan === false)
      ? null
      : await this.ratePlans.resolve(tenantId, hotel.id, roomType.id, input.ratePlanId || null);
    // питание по тарифу — за взрослых и платящих детей (младенцы до 2 лет бесплатно)
    const agesIn = normalizeChildAges(input.childAges);
    const boardGuests = guests
      ? { adults: guests.adults, children: agesIn.filter((a) => (a === null || a < guests!.childMaxAge) && !isInfant(a)).length }
      : { adults: occ?.adults ?? 2, children: occ?.children || 0 };
    if (plan && plan.minNights > 1 && dates.length < plan.minNights) {
      const cur = stayRule.find((w) => w.code === 'min_stay');
      if (cur) cur.value = Math.max(cur.value || 1, plan.minNights);
      else stayRule.push({ code: 'min_stay', dates: [input.checkIn], value: plan.minNights });
    }

    const nights: HotelNightlyRate[] = [];
    const seasonVals: number[] = [];
    const warn = { no_price: [] as string[], blocked: [] as string[], group_fallback: [] as string[], below_budget: [] as string[] };
    for (const d of dates) {
      const ov = ovByDate.get(d);
      let price = 0;
      let source: HotelRateSource = 'base';
      let discountPct = 0;
      const season = seasonPrice(d);
      if (season) seasonVals.push(season.price);
      if (blockRate > 0) {
        price = blockRate;
        source = 'block';
      } else if (contractRate > 0) {
        price = contractRate;
        source = 'contract';
      } else {
        if (ov?.blocked) warn.blocked.push(d);
        if (ov?.price && num(ov.price) > 0) {
          price = num(ov.price);
          source = 'calendar';
        } else {
          // цена рынка = прайс сезона по группе рынка гостя (± надбавка группы); нет прайса — базовая цена номера
          const order: Array<[HotelRateSource, number]> = [['season', season?.price || 0], ['base', base]];
          const hit = order.find(([, v]) => v > 0);
          if (hit) [source, price] = hit;
          if (source === 'season' && season?.fallback) warn.group_fallback.push(d);
        }
        discountPct = num(ov?.discountPct);
        if (discountPct > 0 && price > 0) price = price * (1 - discountPct / 100);
      }
      if (!(price > 0)) warn.no_price.push(d);
      const coef = occ ? occupancyCoefficient(occ, periodOf(d)) : 0;
      const ppNight = source === 'season' && season ? season.pp * (discountPct > 0 ? 1 - discountPct / 100 : 1) : coef > 0 ? price / coef : price;
      // тариф: корректировка цены номера (PP — в той же пропорции) + питание за ночь
      let boardAmount = 0;
      let ppPlan = ppNight;
      if (plan && price > 0) {
        const rp = ratePlanNight(price, plan, boardGuests);
        ppPlan = ppNight * (rp.room / price);
        boardAmount = rp.board;
        price = rp.price;
      }
      if (season?.budget && price > 0 && source !== 'block' && source !== 'contract' && ppPlan < season.budget - 0.005) warn.below_budget.push(d);
      // дети по политике: доля цены взрослого (PP) за каждого
      const childAmount = price > 0 && childLines.length ? ppPlan * childLines.reduce((s, c) => s + c.share, 0) : 0;
      nights.push({
        date: d,
        price: round2(price + childAmount),
        source,
        pp: round2(ppPlan),
        ...(discountPct > 0 ? { discountPct } : {}),
        ...(childLines.length ? { childAmount: round2(childAmount) } : {}),
        ...(boardAmount ? { boardAmount: round2(boardAmount) } : {}),
      });
    }
    const total = round2(nights.reduce((s, n) => s + n.price, 0));
    const prepayment = plan ? ratePlanPrepayment(plan, { total, nights: nights.map((n) => n.price), checkIn: input.checkIn, bookedOn: hotelToday(hotel) }) : null;
    return {
      nights,
      total,
      average: round2(total / nights.length),
      seasonAverage: seasonVals.length ? round2(seasonVals.reduce((s, v) => s + v, 0) / seasonVals.length) : 0,
      ppAverage: round2(nights.reduce((s, n) => s + (n.pp || 0), 0) / nights.length),
      occupancyTypeId: occ?.id ?? null,
      guests,
      childLines,
      childPolicySource: childLines.length ? policySource : null,
      marketId: market?.id ?? null,
      marketGroupId,
      marketGroupGuessed: guessed,
      priority: 'season',
      ratePlan: plan ? { id: plan.id, code: plan.code, name: plan.name, boardType: plan.boardType, refundable: plan.refundable } : null,
      prepayment,
      currency: (hotel.currency || '').toUpperCase(),
      warnings: [
        ...(noOccupancy ? [{ code: 'no_occupancy' as const, dates: [] }] : []),
        ...stayRule,
        ...(Object.keys(warn) as Array<keyof typeof warn>).filter((k) => warn[k].length).map((code) => ({ code, dates: warn[code] })),
      ],
    };
  }
}
