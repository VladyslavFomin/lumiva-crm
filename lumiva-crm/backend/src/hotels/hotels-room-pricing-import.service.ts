import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parseHotelRoomPricingSheet } from './hotel-pricing-sheet.util';
import { HotelRoomPricingImportSession } from './hotel-room-pricing-import-session.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelPricingPeriod } from './hotel-pricing-period.entity';
import { HotelRoomOccupancyType } from './hotel-room-occupancy-type.entity';
import { HotelRoomTypesService } from './hotel-room-types.service';

export interface HotelRoomPricingImportApplyResult {
  cellsSet: number;
  errors: Array<{ row: number; message: string }>;
  total: number;
  occupancyRowsCreated: string[];
}

@Injectable()
export class HotelsRoomPricingImportService {
  constructor(
    @InjectRepository(HotelRoomPricingImportSession)
    private readonly sessions: Repository<HotelRoomPricingImportSession>,
    @InjectRepository(HotelRoomType)
    private readonly roomTypesRepo: Repository<HotelRoomType>,
    @InjectRepository(HotelPricingPeriod)
    private readonly periodsRepo: Repository<HotelPricingPeriod>,
    @InjectRepository(HotelRoomOccupancyType)
    private readonly occupancyTypesRepo: Repository<HotelRoomOccupancyType>,
    private readonly roomTypesService: HotelRoomTypesService,
  ) {}

  async previewImport(
    tenantId: string,
    file: { buffer: Buffer; originalname?: string; mimetype?: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Нужен файл');
    const parsed = await parseHotelRoomPricingSheet(file);
    if (!parsed.periods.length) {
      throw new BadRequestException(
        'Не найдены периоды (две идущие подряд строки с датами начала/конца по колонкам)',
      );
    }
    if (!parsed.occupancyRows.length) {
      throw new BadRequestException('Не найдены строки размещения после строк с периодами');
    }

    const session = await this.sessions.save(
      this.sessions.create({
        tenantId,
        originalFileName: file.originalname || null,
        periods: parsed.periods,
        occupancyRows: parsed.occupancyRows,
        status: 'preview',
      }),
    );

    return {
      importId: session.id,
      periods: session.periods,
      occupancyLabels: session.occupancyRows.map((r) => r.label),
      totalRows: session.occupancyRows.length,
    };
  }

  async applyImport(
    tenantId: string,
    dto: { importId: string; hotelId: string; roomTypeId: string },
  ): Promise<HotelRoomPricingImportApplyResult> {
    const session = await this.sessions.findOne({ where: { id: dto.importId, tenantId } });
    if (!session) throw new NotFoundException('Сессия импорта не найдена');
    if (session.status === 'applied') {
      throw new BadRequestException('Этот файл уже был импортирован');
    }
    const roomType = await this.roomTypesRepo.findOne({
      where: { id: dto.roomTypeId, tenantId, hotelId: dto.hotelId },
    });
    if (!roomType) throw new NotFoundException('Тип номера не найден');

    const existingPeriods = await this.periodsRepo.find({ where: { tenantId, hotelId: dto.hotelId } });
    const periodByRange = new Map(existingPeriods.map((p) => [`${p.startDate}|${p.endDate}`, p]));
    const matchedPeriodIds = session.periods.map(
      (p) => periodByRange.get(`${p.startDate}|${p.endDate}`)?.id || null,
    );

    let occupancyTypes = await this.occupancyTypesRepo.find({
      where: { tenantId, roomTypeId: dto.roomTypeId },
      order: { sortOrder: 'ASC' },
    });
    const occupancyByLabel = new Map(
      occupancyTypes.map((o) => [o.label.trim().toLowerCase(), o]),
    );

    let cellsSet = 0;
    const occupancyRowsCreated: string[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    session.periods.forEach((p, idx) => {
      if (!matchedPeriodIds[idx]) {
        errors.push({
          row: 0,
          message: `Период ${p.startDate}–${p.endDate} не найден среди периодов этого отеля (создайте его на странице «Цены и рынки»)`,
        });
      }
    });

    for (let i = 0; i < session.occupancyRows.length; i++) {
      const occRow = session.occupancyRows[i];
      const key = occRow.label.trim().toLowerCase();
      let occupancyType = occupancyByLabel.get(key);
      if (!occupancyType) {
        // Real price sheets routinely list occupancy/placement rows that haven't been set up
        // in the CRM yet — auto-create the row (matching the market-group auto-create pattern
        // in the daily-rate import) rather than silently rejecting the whole row.
        occupancyType = await this.roomTypesService.createOccupancyType(tenantId, dto.roomTypeId, {
          label: occRow.label,
          sortOrder: occupancyTypes.length,
        });
        occupancyTypes = [...occupancyTypes, occupancyType];
        occupancyByLabel.set(key, occupancyType);
        occupancyRowsCreated.push(occRow.label);
      }
      for (let p = 0; p < occRow.values.length; p++) {
        const periodId = matchedPeriodIds[p];
        const value = occRow.values[p];
        if (!periodId || !value || value === '0') continue;
        try {
          await this.roomTypesService.setOccupancyOverride(tenantId, occupancyType.id, periodId, value);
          cellsSet++;
        } catch (err: any) {
          errors.push({ row: i + 1, message: err?.message || 'Неизвестная ошибка' });
        }
      }
    }

    session.status = 'applied';
    await this.sessions.save(session);

    return { cellsSet, errors, total: session.occupancyRows.length, occupancyRowsCreated };
  }
}
