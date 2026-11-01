import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, In } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelPricingPeriod } from './hotel-pricing-period.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomOccupancyType } from './hotel-room-occupancy-type.entity';
import { HotelDailyMarketRate } from './hotel-daily-market-rate.entity';
import { HotelMarketGroup } from './hotel-market-group.entity';
import { HotelPromotion } from './hotel-promotion.entity';
import { parseHotelPriceListSheet, type ParsedPriceList } from './hotel-price-list-sheet.util';

const key = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const str = (n: number) => String(Math.round(n * 100) / 100);
const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
/** 2023-01-31 + 4 года → 2027-01-31 (29.02 → 28.02) */
const shiftYear = (iso: string | null, years: number) => {
  if (!iso || !years) return iso;
  const y = Number(iso.slice(0, 4)) + years;
  const md = iso.slice(5) === '02-29' && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? '02-28' : iso.slice(5);
  return `${y}-${md}`;
};
const sameSet = (a: string[] | null | undefined, b: string[]) => [...(a || [])].sort().join(',') === [...b].sort().join(',');

export interface PriceListApplyOptions {
  /** удалить периоды отеля, которых нет в файле (иначе старые периоды могут перекрывать новые) */
  replacePeriods?: boolean;
  /** очистить правки по дням (таблица «Цены и рынки») в датах файла — иначе они важнее прайса сезона */
  clearDaily?: boolean;
  /** лист книги; по умолчанию — первый с периодами */
  sheet?: string | null;
  /** завести акции раннего бронирования из блока ERKEN REZERVASYON (по умолчанию — да) */
  importPromotions?: boolean;
  /** группы рынков, для которых действуют акции листа; пусто — все */
  promoMarketGroupIds?: string[];
}

/**
 * Импорт прайс-листа сезона из Excel: периоды (PP, мин. ночей, release, пик, бюджет), категории (м², разница с
 * минимальной, свой PP на период), размещения (коэффициент / пиковый, ручные цены ячеек). Категории и размещения
 * сопоставляются по названию; новых — создаются. Без сессии: предпросмотр и применение принимают один и тот же файл.
 */
@Injectable()
export class HotelsPriceListImportService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private async load(tenantId: string, hotelId: string, file: any, sheet?: string | null) {
    if (!/^[0-9a-f-]{36}$/i.test(hotelId || '')) throw new BadRequestException({ code: 'HOTEL_PRICELIST_NO_HOTEL', message: 'Не выбран отель' });
    if (!file?.buffer) throw new BadRequestException({ code: 'HOTEL_PRICELIST_NO_FILE', message: 'Файл не передан' });
    const hotel = await this.dataSource.getRepository(Hotel).findOne({ where: { id: hotelId, tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    const parsed = await parseHotelPriceListSheet(file, sheet);
    return { hotel, parsed };
  }

  private async plan(m: EntityManager, tenantId: string, hotel: Hotel, parsed: ParsedPriceList) {
    const [periods, roomTypes] = await Promise.all([
      m.find(HotelPricingPeriod, { where: { tenantId, hotelId: hotel.id }, order: { startDate: 'ASC' } }),
      m.find(HotelRoomType, { where: { tenantId, hotelId: hotel.id } }),
    ]);
    const occs = roomTypes.length ? await m.find(HotelRoomOccupancyType, { where: { tenantId, roomTypeId: In(roomTypes.map((r) => r.id)) } }) : [];
    const periodMatch = parsed.periods.map((p) => periods.find((x) => x.startDate === p.startDate && x.endDate === p.endDate) || null);
    const stale = periods.filter((x) => !periodMatch.some((p) => p?.id === x.id));
    const roomMatch = parsed.categories.map((c) => roomTypes.find((r) => key(r.name) === key(c.name)) || null);
    const from = parsed.periods.reduce((a, p) => (p.startDate < a ? p.startDate : a), parsed.periods[0].startDate);
    const to = parsed.periods.reduce((a, p) => (p.endDate > a ? p.endDate : a), parsed.periods[0].endDate);
    const matchedIds = roomMatch.filter((r): r is HotelRoomType => !!r).map((r) => r.id);
    const dailyDays = matchedIds.length
      ? await m.count(HotelDailyMarketRate, { where: { tenantId, roomTypeId: In(matchedIds), date: Between(from, to) } })
      : 0;
    const promos = parsed.earlyBooking.length ? await m.find(HotelPromotion, { where: { tenantId, hotelId: hotel.id, origin: 'import', type: 'early_booking' } }) : [];
    return { periods, roomTypes, occs, periodMatch, stale, roomMatch, from, to, matchedIds, dailyDays, promos };
  }

  async preview(tenantId: string, hotelId: string, file: any, sheet?: string | null) {
    const { hotel, parsed } = await this.load(tenantId, hotelId, file, sheet);
    const p = await this.plan(this.dataSource.manager, tenantId, hotel, parsed);
    const hotelCurrency = (hotel.currency || 'EUR').toUpperCase();
    return {
      sheet: parsed.sheet,
      sheets: parsed.sheets,
      currency: parsed.currency,
      hotelCurrency,
      currencyMismatch: !!parsed.currency && parsed.currency !== hotelCurrency,
      periods: parsed.periods.map((x, i) => ({ ...x, exists: !!p.periodMatch[i] })),
      categories: parsed.categories.map((c, i) => {
        const existing = p.roomMatch[i];
        const existingRows = existing ? p.occs.filter((o) => o.roomTypeId === existing.id) : [];
        return {
          name: c.name,
          area: c.area,
          sizeM2: c.sizeM2,
          isBase: c.isBase,
          offset: c.offset,
          ownPeriods: Object.keys(c.periodPP).length,
          pp: c.pp,
          exists: !!existing,
          rows: c.rows.map((r) => ({
            label: r.label,
            coefficient: r.coefficient,
            peakCoefficient: r.peakCoefficient,
            adults: r.adults,
            children: r.children,
            infants: r.infants,
            overrides: Object.keys(r.overrides).length,
            exists: existingRows.some((o) => key(o.label) === key(r.label)),
          })),
        };
      }),
      stalePeriods: p.stale.map((x) => ({ id: x.id, startDate: x.startDate, endDate: x.endDate })),
      dailyDays: p.dailyDays,
      // раннее бронирование: окна дат как в файле; exists — такая акция уже заведена прошлым импортом (обновится)
      earlyBooking: parsed.earlyBooking.map((e) => ({
        ...e,
        roomTypeKnown: !e.roomType || parsed.categories.some((c) => key(c.name) === key(e.roomType!)) || p.roomTypes.some((r) => key(r.name) === key(e.roomType!)),
        exists: p.promos.some((x) => x.bookFrom === e.bookFrom && x.bookTo === e.bookTo && x.stayFrom === e.stayFrom && x.stayTo === e.stayTo),
      })),
      warnings: parsed.warnings,
    };
  }

  /**
   * Раннее бронирование листа → акции отеля (вид early_booking, скидка на ночи периода проживания, суммируется с
   * другими акциями — как «EB ile kümüle» в контрактах). Совпадение по окнам дат и группам рынков — обновление.
   */
  private async applyEarlyBooking(
    m: EntityManager,
    tenantId: string,
    hotel: Hotel,
    parsed: ParsedPriceList,
    existing: HotelPromotion[],
    groupIdsRaw: string[],
    result: { promotionsCreated: number; promotionsUpdated: number; promotionsSkipped: number },
  ) {
    const groupIds = [...new Set(groupIdsRaw.filter((x) => /^[0-9a-f-]{36}$/i.test(x)))];
    if (groupIds.length) {
      const found = await m.count(HotelMarketGroup, { where: { tenantId, hotelId: hotel.id, id: In(groupIds) } });
      if (found !== groupIds.length) throw new BadRequestException({ code: 'HOTEL_PROMO_SCOPE', message: 'Группа рынков не из этого отеля' });
    }
    const roomTypes = await m.find(HotelRoomType, { where: { tenantId, hotelId: hotel.id } });
    let order = await m.count(HotelPromotion, { where: { tenantId, hotelId: hotel.id } });
    for (const e of parsed.earlyBooking) {
      const rt = e.roomType ? roomTypes.find((r) => key(r.name) === key(e.roomType!)) : null;
      if (e.roomType && !rt) {
        result.promotionsSkipped++;
        continue;
      }
      const roomTypeIds = rt ? [rt.id] : [];
      let row = existing.find((x) => x.bookFrom === e.bookFrom && x.bookTo === e.bookTo && x.stayFrom === e.stayFrom && x.stayTo === e.stayTo && sameSet(x.marketGroupIds, groupIds) && sameSet(x.roomTypeIds, roomTypeIds));
      if (row) result.promotionsUpdated++;
      else {
        row = m.create(HotelPromotion, { tenantId, hotelId: hotel.id, type: 'early_booking', origin: 'import', sortOrder: order++, marketGroupIds: groupIds, roomTypeIds, ratePlanIds: [], sellDirect: true, sellWebsite: true, active: true, freeNights: 0, minNights: 1, stayRule: 'nights', combinable: true });
        existing.push(row);
        result.promotionsCreated++;
      }
      row.name = `EB ${e.discountPct}%${e.bookFrom ? ` · ${dmy(e.bookFrom)}–` : ' · ≤ '}${e.bookTo ? dmy(e.bookTo) : ''}`.slice(0, 120);
      row.bookFrom = e.bookFrom;
      row.bookTo = e.bookTo;
      row.stayFrom = e.stayFrom;
      row.stayTo = e.stayTo;
      row.discountPct = str(e.discountPct);
      row.prepaymentPct = str(e.prepaymentPct);
      row.prepaymentDueDate = e.prepaymentPct > 0 ? e.prepaymentDueDate : null;
      // нет даты оплаты в файле — сразу при бронировании
      row.prepaymentDueDays = e.prepaymentPct > 0 && !e.prepaymentDueDate ? 0 : null;
      row.description = e.listDate ? `List: ${dmy(e.listDate)}` : row.description ?? null;
      await m.save(row);
    }
  }

  /**
   * Сопоставление рыночного листа с прайсом отеля: периоды — по датам (совпадают или перекрываются больше чем наполовину),
   * если ни один не совпал и периодов столько же — по порядку (лист прошлого года); категории — по названию.
   */
  private async marketPlan(m: EntityManager, tenantId: string, hotel: Hotel, parsed: ParsedPriceList) {
    const [periods, roomTypes] = await Promise.all([
      m.find(HotelPricingPeriod, { where: { tenantId, hotelId: hotel.id }, order: { startDate: 'ASC' } }),
      m.find(HotelRoomType, { where: { tenantId, hotelId: hotel.id } }),
    ]);
    if (!periods.length) throw new BadRequestException({ code: 'HOTEL_MARKET_NO_BASE', message: 'Сначала импортируйте базовый прайс сезона — рынок считается от его периодов' });
    const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) + 1;
    const overlap = (p: HotelPricingPeriod, x: { startDate: string; endDate: string }) => {
      const from = p.startDate > x.startDate ? p.startDate : x.startDate;
      const to = p.endDate < x.endDate ? p.endDate : x.endDate;
      return to >= from ? days(from, to) : 0;
    };
    let mode: 'dates' | 'order' = 'dates';
    let map = periods.map((p) => {
      const best = parsed.periods.map((x, i) => ({ i, o: overlap(p, x) })).sort((a, b) => b.o - a.o)[0];
      return best && best.o * 2 > days(p.startDate, p.endDate) ? best.i : -1;
    });
    if (map.every((i) => i < 0) && parsed.periods.length === periods.length) {
      mode = 'order';
      map = periods.map((_, i) => i);
    }
    const roomMatch = parsed.categories.map((c) => roomTypes.find((r) => key(r.name) === key(c.name)) || null);
    return { periods, roomTypes, map, mode, roomMatch };
  }

  /** Предпросмотр рыночного листа: периоды, PP минимальной категории по периодам, категории с другой разницей, EB, валюта */
  async previewMarket(tenantId: string, hotelId: string, file: any, sheet: string | null, groupId: string | null) {
    const { hotel, parsed } = await this.load(tenantId, hotelId, file, sheet);
    const p = await this.marketPlan(this.dataSource.manager, tenantId, hotel, parsed);
    const group = groupId ? await this.dataSource.getRepository(HotelMarketGroup).findOne({ where: { id: groupId, tenantId, hotelId: hotel.id } }) : null;
    const base = parsed.categories.find((c) => c.isBase);
    const hotelCurrency = (hotel.currency || 'EUR').toUpperCase();
    return {
      sheet: parsed.sheet,
      sheets: parsed.sheets,
      currency: parsed.currency,
      hotelCurrency,
      currencyMismatch: !!parsed.currency && parsed.currency !== hotelCurrency,
      mode: p.mode,
      referenceGroupId: await this.referenceGroupId(this.dataSource.manager, tenantId, hotel),
      group: group ? { id: group.id, name: group.name, importedSheet: group.importedSheet, importedAt: group.importedAt } : null,
      periods: p.periods.map((hp, i) => ({ id: hp.id, startDate: hp.startDate, endDate: hp.endDate, basePP: Number(hp.ppBase), sheet: p.map[i] >= 0 ? parsed.periods[p.map[i]] : null })),
      unusedSheetPeriods: parsed.periods.filter((_, i) => !p.map.includes(i)).map((x) => ({ startDate: x.startDate, endDate: x.endDate })),
      categories: parsed.categories.map((c, i) => {
        const rt = p.roomMatch[i];
        const hotelDiff = rt ? (rt.isBaseRoomType ? 0 : Number(rt.ppNetOffset) || 0) : null;
        const own = p.periods.filter((hp, j) => {
          const si = p.map[j];
          if (si < 0 || !rt) return false;
          const pp = c.pp[si];
          const bpp = base?.pp[si];
          return !!pp && !!bpp && Math.abs(pp - bpp - (hotelDiff ?? 0)) > 0.005 && !(rt.periodPP?.[hp.id]);
        }).length;
        return { name: c.name, roomTypeId: rt?.id ?? null, isBase: c.isBase, sheetOffset: c.offset, hotelOffset: hotelDiff, ownPeriods: own };
      }),
      earlyBooking: parsed.earlyBooking,
      warnings: parsed.warnings,
    };
  }

  /**
   * Рыночный лист → цены группы рынков: PP минимальной категории на период (periodPP), свой PP категорий, где разница в
   * рынке другая (roomPP), всё в валюте отеля по курсу. Раннее бронирование листа — акции этой группы.
   */
  async applyMarket(tenantId: string, hotelId: string, file: any, opts: { sheet?: string | null; groupId?: string | null; newGroupName?: string | null; fxRate?: number | null; importPromotions?: boolean }) {
    const { hotel, parsed } = await this.load(tenantId, hotelId, file, opts.sheet);
    const hotelCurrency = (hotel.currency || 'EUR').toUpperCase();
    const mismatch = !!parsed.currency && parsed.currency !== hotelCurrency;
    const fx = mismatch ? Number(opts.fxRate) : 1;
    if (mismatch && !(fx > 0 && fx < 100000)) {
      throw new BadRequestException({ code: 'HOTEL_MARKET_FX', message: `Лист в ${parsed.currency}, отель в ${hotelCurrency} — укажите курс` });
    }
    return this.dataSource.transaction(async (m) => {
      const p = await this.marketPlan(m, tenantId, hotel, parsed);
      if (p.map.every((i) => i < 0)) {
        throw new BadRequestException({ code: 'HOTEL_MARKET_PERIODS', message: 'Периоды листа не совпадают с прайсом отеля ни по датам, ни по количеству' });
      }
      const repo = m.getRepository(HotelMarketGroup);
      let group: HotelMarketGroup | null = null;
      // цены опорной группы — это базовый прайс; рынок — всегда отдельная группа
      const refId = await this.referenceGroupId(m, tenantId, hotel);
      if (opts.groupId && opts.groupId === refId) {
        throw new BadRequestException({ code: 'HOTEL_MARKET_REFERENCE', message: 'Это опорная группа — её цены и есть базовый прайс. Выберите другую группу или создайте новую' });
      }
      if (!refId) {
        // групп ещё нет: первая группа станет опорной — заводим её под базовый прайс, рынок пойдёт второй
        const c = String(hotel.country || '').toUpperCase();
        const ref = await repo.save(repo.create({ tenantId, hotelId: hotel.id, name: c === 'TR' || /türk|turk/i.test(c) ? 'Baz fiyat' : /^(RU|BY|KZ|UA)$/.test(c) || /росс/i.test(c) ? 'Базовый прайс' : 'Base price', sortOrder: 0, adjustmentPct: '0', periodPP: {}, roomPP: {} }));
        await m.update(Hotel, { id: hotel.id, tenantId }, { referenceMarketGroupId: ref.id } as any);
      }
      if (opts.groupId) {
        group = await repo.findOne({ where: { id: opts.groupId, tenantId, hotelId: hotel.id } });
        if (!group) throw new BadRequestException({ code: 'HOTEL_PROMO_SCOPE', message: 'Группа рынков не из этого отеля' });
      } else {
        const name = String(opts.newGroupName || parsed.sheet || '').trim().slice(0, 255);
        if (!name) throw new BadRequestException({ code: 'HOTEL_MARKET_GROUP', message: 'Выберите группу рынков или введите название новой' });
        group = await repo.findOne({ where: { tenantId, hotelId: hotel.id, name } });
        if (!group) {
          const count = await repo.count({ where: { tenantId, hotelId: hotel.id } });
          group = repo.create({ tenantId, hotelId: hotel.id, name, sortOrder: count, adjustmentPct: '0', periodPP: {}, roomPP: {} });
        }
      }
      const base = parsed.categories.find((c) => c.isBase);
      const conv = (v: number) => str(v * fx);
      // PP группы — минимальная категория листа; периоды листа без пары не трогаем
      const periodPP: Record<string, string> = { ...(group.periodPP || {}) };
      const roomPP: Record<string, Record<string, string>> = { ...(group.roomPP || {}) };
      let periodsSet = 0;
      let roomCells = 0;
      p.periods.forEach((hp, j) => {
        const si = p.map[j];
        if (si < 0) return;
        const bpp = base?.pp[si] ?? parsed.periods[si].ppBase;
        if (bpp > 0) {
          periodPP[hp.id] = conv(bpp);
          periodsSet++;
        }
        parsed.categories.forEach((c, ci) => {
          const rt = p.roomMatch[ci];
          if (!rt) return;
          const pp = c.pp[si];
          const hotelDiff = rt.isBaseRoomType ? 0 : Number(rt.ppNetOffset) || 0;
          const own = rt.periodPP?.[hp.id] ? Number(rt.periodPP[hp.id]) - Number(hp.ppBase) : null;
          // сравниваем в валюте отеля: «+3 £» после курса — уже не «+3 €» прайса
          const expected = bpp * fx + (own ?? hotelDiff);
          const cell = { ...(roomPP[rt.id] || {}) };
          if (pp && bpp && Math.abs(pp * fx - expected) > 0.005) {
            cell[hp.id] = conv(pp);
            roomCells++;
          } else {
            delete cell[hp.id];
          }
          roomPP[rt.id] = cell;
        });
      });
      group.periodPP = periodPP;
      group.roomPP = Object.fromEntries(Object.entries(roomPP).filter(([, v]) => Object.keys(v).length));
      group.sourceCurrency = mismatch ? parsed.currency : null;
      group.fxRate = mismatch ? String(fx) : null;
      group.importedSheet = (parsed.sheet || '').slice(0, 100) || null;
      group.importedAt = new Date();
      group = await repo.save(group);
      const result = { groupId: group.id, groupName: group.name, periods: periodsSet, roomCells, mode: p.mode, promotionsCreated: 0, promotionsUpdated: 0, promotionsSkipped: 0 };
      if (opts.importPromotions !== false && parsed.earlyBooking.length) {
        const existing = await m.find(HotelPromotion, { where: { tenantId, hotelId: hotel.id, origin: 'import', type: 'early_booking' } });
        // окна EB листа прошлого года при сопоставлении «по порядку» сдвигаем на разницу лет
        const shift = p.mode === 'order' ? Number(p.periods[0].startDate.slice(0, 4)) - Number(parsed.periods[p.map[0]].startDate.slice(0, 4)) : 0;
        const moved: ParsedPriceList = shift ? { ...parsed, earlyBooking: parsed.earlyBooking.map((e) => ({ ...e, bookFrom: shiftYear(e.bookFrom, shift), bookTo: shiftYear(e.bookTo, shift), stayFrom: shiftYear(e.stayFrom, shift), stayTo: shiftYear(e.stayTo, shift), prepaymentDueDate: shiftYear(e.prepaymentDueDate, shift), listDate: shiftYear(e.listDate, shift) })) } : parsed;
        await this.applyEarlyBooking(m, tenantId, hotel, moved, existing, [group.id], result);
      }
      return result;
    });
  }

  /** Опорная группа рынков: заданная у отеля, иначе первая (как в расчёте цены) */
  private async referenceGroupId(m: EntityManager, tenantId: string, hotel: Hotel): Promise<string | null> {
    const groups = await m.find(HotelMarketGroup, { where: { tenantId, hotelId: hotel.id }, order: { sortOrder: 'ASC', createdAt: 'ASC' } as any });
    const ref = (hotel as any).referenceMarketGroupId;
    return ref && groups.some((g) => g.id === ref) ? ref : groups[0]?.id ?? null;
  }

  async apply(tenantId: string, hotelId: string, file: any, opts: PriceListApplyOptions) {
    const { hotel, parsed } = await this.load(tenantId, hotelId, file, opts.sheet);
    const replacePeriods = opts.replacePeriods !== false;
    const clearDaily = opts.clearDaily !== false;
    return this.dataSource.transaction(async (m) => {
      const p = await this.plan(m, tenantId, hotel, parsed);
      const result = { periodsCreated: 0, periodsUpdated: 0, periodsRemoved: 0, roomTypesCreated: [] as string[], roomTypesUpdated: 0, rowsCreated: 0, rowsUpdated: 0, overrides: 0, dailyCleared: 0, promotionsCreated: 0, promotionsUpdated: 0, promotionsSkipped: 0 };

      // периоды
      const periodIds: string[] = [];
      for (let i = 0; i < parsed.periods.length; i++) {
        const x = parsed.periods[i];
        const row = p.periodMatch[i] || m.create(HotelPricingPeriod, { tenantId, hotelId: hotel.id, startDate: x.startDate, endDate: x.endDate });
        if (p.periodMatch[i]) result.periodsUpdated++;
        else result.periodsCreated++;
        row.ppBase = str(x.ppBase);
        if (x.minNights !== null) row.minNights = Math.max(1, Math.min(60, x.minNights));
        if (x.releaseDays !== null) row.releaseDays = Math.max(0, Math.min(365, x.releaseDays));
        if (x.budgetPP !== null) row.budgetPP = str(x.budgetPP);
        row.isPeak = x.isPeak;
        periodIds.push((await m.save(row)).id);
      }
      if (replacePeriods && p.stale.length) {
        await m.remove(p.stale);
        result.periodsRemoved = p.stale.length;
      }
      const dropKeys = new Set([...periodIds, ...(replacePeriods ? p.stale.map((x) => x.id) : [])]);
      const keep = (o: Record<string, string> | null | undefined) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !dropKeys.has(k)));

      // категории
      const touched: string[] = [];
      let baseId: string | null = null;
      for (let i = 0; i < parsed.categories.length; i++) {
        const c = parsed.categories[i];
        let rt = p.roomMatch[i];
        if (!rt) {
          rt = m.create(HotelRoomType, {
            tenantId,
            hotelId: hotel.id,
            name: c.name,
            currency: (parsed.currency || hotel.currency || 'EUR').toUpperCase(),
            basePrice: '0',
            quantity: 0,
            amenities: [],
            infoFields: {},
            isBaseRoomType: false,
          });
          result.roomTypesCreated.push(c.name);
        } else {
          result.roomTypesUpdated++;
        }
        if (c.sizeM2 !== null) rt.sizeM2 = str(c.sizeM2);
        if (c.area) rt.infoFields = { ...(rt.infoFields || {}), area: c.area };
        rt.pricingMode = 'offset';
        rt.ppNetOffset = str(c.offset);
        const own = keep(rt.periodPP);
        for (const [idx, v] of Object.entries(c.periodPP)) own[periodIds[Number(idx)]] = str(v);
        rt.periodPP = own;
        rt = await m.save(rt);
        touched.push(rt.id);
        if (c.isBase) baseId = rt.id;

        // размещения
        const existing = p.occs.filter((o) => o.roomTypeId === rt!.id);
        for (let j = 0; j < c.rows.length; j++) {
          const r = c.rows[j];
          let occ = existing.find((o) => key(o.label) === key(r.label));
          if (!occ) {
            occ = m.create(HotelRoomOccupancyType, { tenantId, roomTypeId: rt.id, label: r.label, paidChildCount: 0, adults: r.adults, children: r.children, infants: r.infants, periodOverrides: {} });
            result.rowsCreated++;
          } else {
            result.rowsUpdated++;
            if (occ.adults === null) {
              occ.adults = r.adults;
              occ.children = r.children;
            }
            occ.infants = r.infants;
          }
          occ.coefficient = str(r.coefficient);
          occ.peakCoefficient = r.peakCoefficient !== null ? str(r.peakCoefficient) : null;
          occ.sortOrder = j;
          const ov = keep(occ.periodOverrides);
          for (const [idx, v] of Object.entries(r.overrides)) {
            ov[periodIds[Number(idx)]] = str(v);
            result.overrides++;
          }
          occ.periodOverrides = ov;
          await m.save(occ);
        }
      }
      // минимальная категория файла — базовая (ровно одна на отель)
      if (baseId) {
        await m.update(HotelRoomType, { tenantId, hotelId: hotel.id, isBaseRoomType: true }, { isBaseRoomType: false });
        await m.update(HotelRoomType, { id: baseId, tenantId }, { isBaseRoomType: true });
      }
      if (clearDaily && touched.length) {
        const del = await m.delete(HotelDailyMarketRate, { tenantId, roomTypeId: In(touched), date: Between(p.from, p.to) });
        result.dailyCleared = del.affected || 0;
      }
      if (opts.importPromotions !== false && parsed.earlyBooking.length) await this.applyEarlyBooking(m, tenantId, hotel, parsed, p.promos, opts.promoMarketGroupIds || [], result);
      return result;
    });
  }
}
