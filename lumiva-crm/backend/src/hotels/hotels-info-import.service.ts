import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import ExcelJS from 'exceljs';
import { normHeaderKey } from '../lib/import-spreadsheet.util';
import { Hotel } from './hotel.entity';
import { HotelsService } from './hotels.service';
import { HotelFactsheetItem, HotelFactsheetItemKind } from './hotel-factsheet-item.entity';
import { HotelsFactsheetService } from './hotels-factsheet.service';
import { HotelInfoImportSession, HotelInfoImportItemRow } from './hotel-info-import-session.entity';

/** Тот же список полей и подписей, что и HOTEL_INFO_FIELDS на фронтенде (HotelDetailPage.tsx) —
 * держим в синхроне вручную, т.к. подписи используются как заголовки при экспорте. Подписи и
 * синонимы подобраны по реальному фактшиту отеля (не выдуманы) — все поля текстовые, т.к.
 * реальные факты почти всегда описаны свободным текстом ("Домашние животные не принимаются...",
 * "7 лифтов в главном корпусе"), а не чистым да/нет. */
export const HOTEL_INFO_FIELD_DEFS: Array<{ key: string; label: string; type: 'text'; synonyms?: string[] }> = [
  { key: 'yearOpened', label: 'Год открытия', type: 'text' },
  { key: 'lastRenovation', label: 'Последняя реновация', type: 'text' },
  { key: 'category', label: 'Категория', type: 'text' },
  { key: 'concept', label: 'Концепция', type: 'text' },
  { key: 'heatingCooling', label: 'Отопление и охлаждение', type: 'text' },
  { key: 'totalAreaM2', label: 'Общая площадь', type: 'text', synonyms: ['Общая площадь, м²', 'Общая площадь m2'] },
  { key: 'investor', label: 'Инвестор', type: 'text' },
  { key: 'accessibility', label: 'Для гостей с ограниченными возможностями', type: 'text', synonyms: ['Подходит для гостей с ОВ'] },
  { key: 'conferenceHalls', label: 'Конференц-залы', type: 'text' },
  { key: 'parking', label: 'Парковка', type: 'text' },
  { key: 'creditCards', label: 'Кредитные карты', type: 'text' },
  { key: 'elevators', label: 'Лифт', type: 'text', synonyms: ['Количество лифтов'] },
  { key: 'petsHookahPolicy', label: 'Домашние животные/Кальян', type: 'text', synonyms: ['Домашние животные', 'Кальян'] },
  { key: 'phone1', label: 'Телефон', type: 'text', synonyms: ['Телефон 1'] },
  { key: 'phone2', label: 'Телефон 2', type: 'text' },
  { key: 'email1', label: 'Эл. Почта 1', type: 'text' },
  { key: 'email2', label: 'Эл. Почта 2', type: 'text' },
  { key: 'website', label: 'Веб сайт', type: 'text', synonyms: ['Веб-сайт'] },
  { key: 'airportDistance', label: 'Аэропорт', type: 'text', synonyms: ['Расстояние до аэропорта'] },
  { key: 'cityCenterDistance', label: 'Центр города', type: 'text', synonyms: ['Расстояние до центра города'] },
  { key: 'nearestTown', label: 'Ближайший населённый пункт', type: 'text' },
  { key: 'transport', label: 'Транспорт', type: 'text' },
  { key: 'buildingsCount', label: 'Количество зданий', type: 'text' },
  { key: 'floorsCount', label: 'Количество этажей', type: 'text' },
  { key: 'roomsBreakdown', label: 'Количество номеров', type: 'text', synonyms: ['Количество номеров (по корпусам)'] },
  { key: 'bedsBreakdown', label: 'Количество кроватей', type: 'text', synonyms: ['Количество кроватей (по корпусам)'] },
  { key: 'disabledAccessRooms', label: 'Номера для гостей с ОВ', type: 'text' },
  { key: 'beachDescription', label: 'Расположение пляжа', type: 'text', synonyms: ['Описание пляжа'] },
  { key: 'beachLength', label: 'Протяжённость пляжа', type: 'text' },
  { key: 'poolsDescription', label: 'Бассейны (названия, площадь)', type: 'text' },
];

/** Более терпимая нормализация, чем normHeaderKey из общей утилиты (та не трогает дефисы/ё) —
 * нужна отдельно, т.к. реальные фактшиты пишут одно и то же по-разному ("Веб-сайт" / "Веб сайт",
 * "населённый" / "населенный"). */
function normLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function matchFieldDef(rawLabel: string): (typeof HOTEL_INFO_FIELD_DEFS)[number] | undefined {
  const norm = normLabel(rawLabel);
  const exact = HOTEL_INFO_FIELD_DEFS.find((f) => [f.label, ...(f.synonyms || [])].some((l) => normLabel(l) === norm));
  if (exact) return exact;
  // Многие фактшиты вписывают название города прямо в подпись ("Аэропорт Анталья",
  // "Центр города Анталья") — точное совпадение подписи невозможно, ловим по началу строки.
  if (norm.startsWith('аэропорт')) return HOTEL_INFO_FIELD_DEFS.find((f) => f.key === 'airportDistance');
  if (norm.startsWith('центр города')) return HOTEL_INFO_FIELD_DEFS.find((f) => f.key === 'cityCenterDistance');
  return undefined;
}

const GENERAL_SHEET = 'Общая информация';

const BLOCK_SHEETS: Array<{
  kind: HotelFactsheetItemKind;
  sheet: string;
  columns: Array<{ col: string; field: 'name' | 'description' | 'hours' | 'paid' | `extra.${string}` }>;
}> = [
  {
    kind: 'restaurant',
    sheet: 'Рестораны',
    columns: [
      { col: 'Название', field: 'name' },
      { col: 'Питание', field: 'extra.mealType' },
      { col: 'Описание', field: 'description' },
      { col: 'Часы работы', field: 'hours' },
    ],
  },
  {
    kind: 'bar',
    sheet: 'Бары',
    columns: [
      { col: 'Название', field: 'name' },
      { col: 'Описание', field: 'description' },
      { col: 'Часы работы', field: 'hours' },
    ],
  },
  {
    kind: 'pool',
    sheet: 'Бассейны',
    columns: [
      { col: 'Название', field: 'name' },
      { col: 'Площадь', field: 'extra.areaM2' },
      { col: 'Глубина', field: 'extra.depth' },
      { col: 'Описание', field: 'description' },
      { col: 'Часы работы', field: 'hours' },
    ],
  },
  {
    kind: 'miniclub',
    sheet: 'Мини-клуб',
    columns: [
      { col: 'Название', field: 'name' },
      { col: 'Активности', field: 'description' },
      { col: 'Часы работы', field: 'hours' },
    ],
  },
  {
    kind: 'service',
    sheet: 'Услуги',
    columns: [
      { col: 'Название', field: 'name' },
      { col: 'Описание', field: 'description' },
      { col: 'Платно', field: 'paid' },
    ],
  },
];

function cellToString(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text.trim();
    if (typeof value.result === 'string' || typeof value.result === 'number') return String(value.result).trim();
    if (Array.isArray(value.richText)) return value.richText.map((c: any) => String(c?.text || '')).join('').trim();
  }
  return String(value).trim();
}

function parseBool(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  return ['да', 'yes', 'true', '1', 'есть', 'подходит'].includes(v);
}

/** Простая таблица "заголовок в первой непустой строке + данные ниже", применённая к уже
 * выбранному листу (parseXlsxRobust из общей утилиты всегда берёт только worksheets[0]). */
function parseSheetTable(sheet: ExcelJS.Worksheet): { columns: string[]; rows: Array<Record<string, string>> } {
  let headerRowNumber = 0;
  let columns: string[] = [];
  for (let rowNum = 1; rowNum <= Math.min(sheet.rowCount, 20); rowNum++) {
    const row = sheet.getRow(rowNum);
    const labels: string[] = [];
    for (let c = 1; c <= row.cellCount; c++) labels.push(cellToString(row.getCell(c).value));
    if (labels.some((l) => l !== '')) {
      headerRowNumber = rowNum;
      while (labels.length && labels[labels.length - 1] === '') labels.pop();
      columns = labels;
      break;
    }
  }
  if (!columns.length) return { columns: [], rows: [] };
  const rows: Array<Record<string, string>> = [];
  for (let rowNum = headerRowNumber + 1; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum);
    const obj: Record<string, string> = {};
    for (let c = 0; c < columns.length; c++) obj[columns[c]] = cellToString(row.getCell(c + 1).value);
    if (Object.values(obj).some((v) => v !== '')) rows.push(obj);
  }
  return { columns, rows };
}

function findSheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet | undefined {
  const target = normHeaderKey(name);
  return workbook.worksheets.find((s) => normHeaderKey(s.name) === target);
}

/** Читает весь лист построчно и берёт пары (подпись, значение) на каждой паре соседних колонок
 * (1&2, 3&4, 5&6, ...) — реальные фактшиты кладут по 2 (иногда больше) пары "поле/значение" в
 * одну строку рядом друг с другом, а не одну пару на строку с отдельной строкой-заголовком. */
function scanLabelValuePairs(sheet: ExcelJS.Worksheet): Array<{ label: string; value: string }> {
  const pairs: Array<{ label: string; value: string }> = [];
  for (let rowNum = 1; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum);
    const n = row.cellCount;
    for (let c = 1; c + 1 <= n; c += 2) {
      const label = cellToString(row.getCell(c).value);
      const value = cellToString(row.getCell(c + 1).value);
      if (label && value) pairs.push({ label, value });
    }
  }
  return pairs;
}

@Injectable()
export class HotelsInfoImportService {
  constructor(
    @InjectRepository(HotelInfoImportSession)
    private readonly sessions: Repository<HotelInfoImportSession>,
    @InjectRepository(Hotel)
    private readonly hotelsRepo: Repository<Hotel>,
    @InjectRepository(HotelFactsheetItem)
    private readonly itemsRepo: Repository<HotelFactsheetItem>,
    private readonly hotels: HotelsService,
    private readonly factsheet: HotelsFactsheetService,
  ) {}

  /* ---------- export ---------- */

  async exportHotelInfo(tenantId: string, hotelId: string) {
    const hotel = await this.hotelsRepo.findOne({ where: { id: hotelId, tenantId } });
    if (!hotel) throw new NotFoundException('Отель не найден');
    const items = await this.itemsRepo.find({ where: { tenantId, hotelId }, order: { kind: 'ASC', sortOrder: 'ASC' } });

    const workbook = new ExcelJS.Workbook();
    const general = workbook.addWorksheet(GENERAL_SHEET);
    general.addRow(['Поле', 'Значение']);
    for (const f of HOTEL_INFO_FIELD_DEFS) {
      general.addRow([f.label, hotel.infoFields?.[f.key] ?? '']);
    }

    for (const block of BLOCK_SHEETS) {
      const sheet = workbook.addWorksheet(block.sheet);
      sheet.addRow(block.columns.map((c) => c.col));
      for (const item of items.filter((i) => i.kind === block.kind)) {
        sheet.addRow(
          block.columns.map((c) => {
            if (c.field === 'name') return item.name;
            if (c.field === 'description') return item.description || '';
            if (c.field === 'hours') return item.hours || '';
            if (c.field === 'paid') return item.paid ? 'Да' : 'Нет';
            const extraKey = c.field.slice('extra.'.length);
            return item.extra?.[extraKey] || '';
          }),
        );
      }
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      filename: `${hotel.name.replace(/[^\p{L}\p{N}]+/gu, '_')}-info.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /* ---------- import: preview ---------- */

  async previewImport(tenantId: string, file: { buffer: Buffer; originalname?: string } | undefined) {
    if (!file) throw new BadRequestException('Нужен файл');
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(file.buffer as any);
    } catch {
      throw new BadRequestException(
        'Не удалось прочитать этот Excel-файл. Поддерживается только формат .xlsx.',
      );
    }

    const infoFields: Record<string, string> = {};
    const unmatchedLabelSet = new Set<string>();
    // Пробуем лист "Общая информация" (наш собственный экспорт), иначе — первый лист файла
    // (реальные фактшиты обычно кладут всё на один лист без такого явного названия).
    const generalSheet = findSheet(workbook, GENERAL_SHEET) || workbook.worksheets[0];
    if (generalSheet) {
      for (const { label, value } of scanLabelValuePairs(generalSheet)) {
        const def = matchFieldDef(label);
        if (!def) {
          unmatchedLabelSet.add(label);
          continue;
        }
        infoFields[def.key] = value;
      }
    }
    const unmatchedLabels = Array.from(unmatchedLabelSet);

    const items: HotelInfoImportItemRow[] = [];
    for (const block of BLOCK_SHEETS) {
      const sheet = findSheet(workbook, block.sheet);
      if (!sheet) continue;
      const { rows } = parseSheetTable(sheet);
      const colByNorm = new Map(block.columns.map((c) => [normHeaderKey(c.col), c]));
      for (const row of rows) {
        const item: HotelInfoImportItemRow = {
          kind: block.kind,
          name: '',
          description: null,
          hours: null,
          paid: null,
          extra: {},
        };
        for (const [rawCol, rawVal] of Object.entries(row)) {
          const def = colByNorm.get(normHeaderKey(rawCol));
          if (!def) continue;
          const val = (rawVal || '').trim();
          if (def.field === 'name') item.name = val;
          else if (def.field === 'description') item.description = val || null;
          else if (def.field === 'hours') item.hours = val || null;
          else if (def.field === 'paid') item.paid = val ? parseBool(val) : null;
          else item.extra[def.field.slice('extra.'.length)] = val;
        }
        if (item.name) items.push(item);
      }
    }

    const session = await this.sessions.save(
      this.sessions.create({
        tenantId,
        originalFileName: file.originalname || null,
        infoFields,
        items,
        unmatchedLabels,
        status: 'preview',
      }),
    );

    return {
      importId: session.id,
      infoFieldsCount: Object.keys(infoFields).length,
      itemCounts: BLOCK_SHEETS.reduce<Record<string, number>>((acc, b) => {
        acc[b.kind] = items.filter((i) => i.kind === b.kind).length;
        return acc;
      }, {}),
      unmatchedLabels,
      totalItems: items.length,
    };
  }

  /* ---------- import: apply ---------- */

  async applyImport(tenantId: string, dto: { importId: string; hotelId: string }) {
    const session = await this.sessions.findOne({ where: { id: dto.importId, tenantId } });
    if (!session) throw new NotFoundException('Сессия импорта не найдена');
    if (session.status === 'applied') throw new BadRequestException('Этот файл уже был импортирован');

    if (Object.keys(session.infoFields).length) {
      await this.hotels.updateInfoFields(tenantId, dto.hotelId, session.infoFields);
    }
    let itemsCreated = 0;
    for (const item of session.items) {
      await this.factsheet.createItem(tenantId, dto.hotelId, {
        kind: item.kind as HotelFactsheetItemKind,
        name: item.name,
        description: item.description,
        hours: item.hours,
        paid: item.paid,
        extra: item.extra,
      });
      itemsCreated++;
    }

    session.status = 'applied';
    await this.sessions.save(session);

    return { infoFieldsUpdated: Object.keys(session.infoFields).length, itemsCreated };
  }
}
