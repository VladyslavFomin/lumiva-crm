import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normHeaderKey } from '../lib/import-spreadsheet.util';
import { parseHotelDailyPricingSheet, parseSheetDate, parseMoney } from './hotel-pricing-sheet.util';
import { HotelPricingImportSession } from './hotel-pricing-import-session.entity';
import { HotelRoomType } from './hotel-room-type.entity';
import { HotelMarketGroup } from './hotel-market-group.entity';
import { HotelsPricingService } from './hotels-pricing.service';

const DATE_SYNONYMS = ['tarih', 'дата', 'date'];
const BUDGET_SYNONYMS = ['butce', 'bütçe', 'budget', 'себестоимость'];
const GROSS_SYNONYMS = ['brut', 'brüt', 'gross', 'brutto'];
const DISCOUNT_SYNONYMS = ['indirim', 'İndirim', 'discount', 'скидка'];

/** Колонки уже приходят из parseHotelDailyPricingSheet как "<Имя группы> Bütçe" / "... Brüt" /
 * "... İndirim" (после разворачивания двухстрочной шапки листа), сопоставление —
 * по вхождению нормализованного имени группы + ключевого слова поля. */
function findColumn(columns: string[], groupName: string, keywordSynonyms: string[]): string | null {
  const normGroup = normHeaderKey(groupName);
  const hit = columns.find((c) => {
    const nc = normHeaderKey(c);
    return nc.includes(normGroup) && keywordSynonyms.some((k) => nc.includes(normHeaderKey(k)));
  });
  return hit || null;
}

@Injectable()
export class HotelsPricingImportService {
  constructor(
    @InjectRepository(HotelPricingImportSession)
    private readonly sessions: Repository<HotelPricingImportSession>,
    @InjectRepository(HotelRoomType)
    private readonly roomTypesRepo: Repository<HotelRoomType>,
    @InjectRepository(HotelMarketGroup)
    private readonly marketGroupsRepo: Repository<HotelMarketGroup>,
    private readonly pricing: HotelsPricingService,
  ) {}

  async previewImport(
    tenantId: string,
    file: { buffer: Buffer; originalname?: string; mimetype?: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Нужен файл');
    const parsed = await parseHotelDailyPricingSheet(file);
    if (!parsed.columns.length) {
      throw new BadRequestException(
        'Не удалось найти колонки — проверьте, что в файле есть строка с датой (Tarih/Дата/Date).',
      );
    }

    const dateColumn = parsed.columns.find((c) => DATE_SYNONYMS.includes(normHeaderKey(c))) || null;
    const suggestedMapping: Record<string, string | null> = { date: dateColumn };

    const session = await this.sessions.save(
      this.sessions.create({
        tenantId,
        originalFileName: file.originalname || null,
        columns: parsed.columns,
        rows: parsed.rows,
        sample: parsed.rows.slice(0, 20),
        totalRows: parsed.rows.length,
        suggestedMapping,
        groupNames: parsed.groupNames,
        status: 'preview',
      }),
    );

    return {
      importId: session.id,
      columns: session.columns,
      sample: session.sample,
      totalRows: session.totalRows,
      suggestedMapping,
      groupNames: session.groupNames,
    };
  }

  async applyImport(
    tenantId: string,
    dto: { importId: string; hotelId: string; roomTypeId: string; dateColumn?: string },
  ) {
    const session = await this.sessions.findOne({ where: { id: dto.importId, tenantId } });
    if (!session) throw new NotFoundException('Сессия импорта не найдена');
    if (session.status === 'applied') {
      throw new BadRequestException('Этот файл уже был импортирован');
    }
    const roomType = await this.roomTypesRepo.findOne({
      where: { id: dto.roomTypeId, tenantId, hotelId: dto.hotelId },
    });
    if (!roomType) throw new NotFoundException('Тип номера не найден');

    let groups = await this.marketGroupsRepo.find({ where: { tenantId, hotelId: dto.hotelId } });
    const existingNames = new Set(groups.map((g) => g.name.trim().toLowerCase()));
    const missing = (session.groupNames || []).filter((n) => !existingNames.has(n.trim().toLowerCase()));
    if (missing.length) {
      const created = await this.marketGroupsRepo.save(
        missing.map((name, i) =>
          this.marketGroupsRepo.create({
            tenantId,
            hotelId: dto.hotelId,
            name,
            sortOrder: groups.length + i,
          }),
        ),
      );
      groups = [...groups, ...created];
    }

    const dateColumn =
      dto.dateColumn ||
      session.columns.find((c) => DATE_SYNONYMS.includes(normHeaderKey(c))) ||
      null;
    if (!dateColumn) {
      throw new BadRequestException('Не найдена колонка с датой (Tarih/Дата/Date)');
    }

    const groupColumns = groups.map((g) => ({
      group: g,
      budgetCol: findColumn(session.columns, g.name, BUDGET_SYNONYMS),
      grossCol: findColumn(session.columns, g.name, GROSS_SYNONYMS),
      discountCol: findColumn(session.columns, g.name, DISCOUNT_SYNONYMS),
    }));

    let created = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < session.rows.length; i++) {
      const row = session.rows[i];
      const dateRaw = String(row[dateColumn] ?? '').trim();
      const date = parseSheetDate(dateRaw);
      if (!date) {
        errors.push({ row: i + 1, message: `Не удалось распознать дату: "${dateRaw}"` });
        continue;
      }
      for (const gc of groupColumns) {
        if (!gc.budgetCol && !gc.grossCol && !gc.discountCol) continue;
        try {
          await this.pricing.upsertDailyRate(tenantId, roomType.id, gc.group.id, date, {
            budgetPP: gc.budgetCol ? parseMoney(String(row[gc.budgetCol] ?? '')) : undefined,
            grossPP: gc.grossCol ? parseMoney(String(row[gc.grossCol] ?? '')) : undefined,
            discountPct: gc.discountCol ? parseMoney(String(row[gc.discountCol] ?? '')) : undefined,
          });
          created++;
        } catch (err: any) {
          errors.push({
            row: i + 1,
            message: `${gc.group.name}: ${err?.message || 'Неизвестная ошибка'}`,
          });
        }
      }
    }

    session.status = 'applied';
    await this.sessions.save(session);

    return { created, errors, total: session.rows.length, groupsCreated: missing };
  }
}
