import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, In } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelPricingPeriod } from './hotel-pricing-period.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelRoomOccupancyType } from './hotel-room-occupancy-type.entity';
import { HotelDailyMarketRate } from './hotel-daily-market-rate.entity';
import { parseHotelPriceListSheet, type ParsedPriceList } from './hotel-price-list-sheet.util';

const key = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const str = (n: number) => String(Math.round(n * 100) / 100);

export interface PriceListApplyOptions {
  /** удалить периоды отеля, которых нет в файле (иначе старые периоды могут перекрывать новые) */
  replacePeriods?: boolean;
  /** очистить правки по дням (таблица «Цены и рынки») в датах файла — иначе они важнее прайса сезона */
  clearDaily?: boolean;
  /** лист книги; по умолчанию — первый с периодами */
  sheet?: string | null;
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
    return { periods, roomTypes, occs, periodMatch, stale, roomMatch, from, to, matchedIds, dailyDays };
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
      warnings: parsed.warnings,
    };
  }

  async apply(tenantId: string, hotelId: string, file: any, opts: PriceListApplyOptions) {
    const { hotel, parsed } = await this.load(tenantId, hotelId, file, opts.sheet);
    const replacePeriods = opts.replacePeriods !== false;
    const clearDaily = opts.clearDaily !== false;
    return this.dataSource.transaction(async (m) => {
      const p = await this.plan(m, tenantId, hotel, parsed);
      const result = { periodsCreated: 0, periodsUpdated: 0, periodsRemoved: 0, roomTypesCreated: [] as string[], roomTypesUpdated: 0, rowsCreated: 0, rowsUpdated: 0, overrides: 0, dailyCleared: 0 };

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
      return result;
    });
  }
}
