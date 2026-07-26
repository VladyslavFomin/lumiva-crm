import ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';
import { detectDelimiter, splitCsvLine, makeUniqueHeaders, normHeaderKey } from '../lib/import-spreadsheet.util';
import { normalizeNumericInput } from './hotel-number.util';

/** Real hotel pricing spreadsheets use multi-row headers (a group/period label row followed
 * by the actual field-name row) instead of the single-header-row shape every other import in
 * this codebase assumes — so this file has its own raw-grid reader rather than reusing
 * parseXlsxRobust/parseCsvRobust (which pick the first non-blank row as "the" header). */

const DATE_SYNONYMS = ['tarih', 'date', 'дата'];

/** Excel stores a percentage-formatted cell's underlying value as the fraction (35% displayed
 * → 0.35 stored) — reading `cell.value` directly and stringifying it verbatim silently turns a
 * "35% discount" into "0.35", which then gets treated as a 0.35% discount downstream. Detected
 * via the cell's own numFmt (e.g. "0%", "0.00%"), never guessed from context, so it only ever
 * fires for cells Excel itself actually formatted as a percentage. */
function cellToString(value: any, numFmt?: string): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (numFmt && numFmt.includes('%')) return String(value * 100);
    return String(value).trim();
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text.trim();
    if (typeof value.result === 'number') {
      return numFmt && numFmt.includes('%') ? String(value.result * 100) : String(value.result).trim();
    }
    if (typeof value.result === 'string') return value.result.trim();
    if (Array.isArray(value.richText)) {
      return value.richText.map((chunk: any) => String(chunk?.text || '')).join('').trim();
    }
  }
  return String(value).trim();
}

async function readXlsxRawRows(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as any);
  } catch {
    throw new BadRequestException(
      'Не удалось прочитать этот Excel-файл. Поддерживается только современный формат .xlsx. Пересохраните файл как .xlsx или CSV.',
    );
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows: string[][] = [];
  for (let rowNum = 1; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum);
    const n = row.cellCount;
    const cells: string[] = [];
    for (let c = 1; c <= n; c++) {
      const cell = row.getCell(c);
      cells.push(cellToString(cell.value, cell.numFmt));
    }
    rows.push(cells);
  }
  return rows;
}

function readCsvRawRows(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];
  const delimiter = detectDelimiter(lines[0]);
  return lines.map((l) => splitCsvLine(l, delimiter).map((c) => c.replace(/^"|"$/g, '').trim()));
}

async function readRawRows(file: { buffer: Buffer; originalname?: string }): Promise<string[][]> {
  const filename = (file.originalname || '').toLowerCase();
  return filename.endsWith('.xlsx') || filename.endsWith('.xls')
    ? readXlsxRawRows(file.buffer)
    : readCsvRawRows(file.buffer.toString('utf-8'));
}

/** Strips currency symbols and normalizes the decimal separator — real sheets mix currencies per
 * market group (İngiltere uses £, others €) and leave some cells blank, both of which must never
 * reach Postgres as a raw numeric literal verbatim. Thin wrapper over normalizeNumericInput. */
export function parseMoney(raw: string): string {
  return normalizeNumericInput(raw);
}

export function parseSheetDate(raw: string): string | null {
  const s = (raw || '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const eu = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/.exec(s);
  if (eu) return `${eu[3]}-${eu[2].padStart(2, '0')}-${eu[1].padStart(2, '0')}`;
  return null;
}

/* ============================================================
   1) Daily market-rate sheet ("Цены и рынки") — group-label row
      above the field-name row (Tarih/Bütçe/PP Ort./Brüt/İndirim/Net,
      repeated per market group), flattened into single combined
      column names ("<Group> <Field>") so the existing name-based
      findColumn() matching in hotels-pricing-import.service.ts
      keeps working unchanged.
   ============================================================ */

export interface FlattenedSheet {
  columns: string[];
  rows: Array<Record<string, string>>;
  /** Distinct group names actually seen in the header (carry-forward), so the caller can
   * auto-create any HotelMarketGroup that doesn't exist yet instead of silently dropping data. */
  groupNames: string[];
}

export async function parseHotelDailyPricingSheet(
  file: { buffer: Buffer; originalname?: string },
): Promise<FlattenedSheet> {
  const rawRows = await readRawRows(file);
  if (!rawRows.length) return { columns: [], rows: [], groupNames: [] };

  const limit = Math.min(rawRows.length, 10);
  let headerIdx = -1;
  for (let i = 0; i < limit; i++) {
    if (rawRows[i].some((c) => DATE_SYNONYMS.includes(normHeaderKey(c)))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new BadRequestException('Не найдена колонка с датой (Tarih/Дата/Date) в первых 10 строках файла');
  }

  const headerRow = rawRows[headerIdx];
  const groupRow = headerIdx > 0 ? rawRows[headerIdx - 1] : [];
  const width = Math.max(headerRow.length, groupRow.length);

  // Find the date column first — the backward carry-forward scan for group names must never
  // cross it, otherwise a hotel-name title sitting in the same header row directly above the
  // date column (common in real sheets) gets misread as the group name for the first data
  // column after it.
  let dateColIdx = -1;
  for (let i = 0; i < width; i++) {
    if (DATE_SYNONYMS.includes(normHeaderKey((headerRow[i] || '').trim()))) {
      dateColIdx = i;
      break;
    }
  }

  const groupNamesSeen = new Set<string>();
  const rawColumnNames: string[] = [];
  for (let i = 0; i < width; i++) {
    const fieldRaw = (headerRow[i] || '').trim();
    if (!fieldRaw) {
      rawColumnNames.push('');
      continue;
    }
    if (i === dateColIdx) {
      rawColumnNames.push('Date');
      continue;
    }
    let groupName = '';
    for (let j = i; j > dateColIdx; j--) {
      const v = (groupRow[j] || '').trim();
      if (v) {
        groupName = v;
        break;
      }
    }
    if (groupName) groupNamesSeen.add(groupName);
    rawColumnNames.push(groupName ? `${groupName} ${fieldRaw}` : fieldRaw);
  }

  const { columns } = makeUniqueHeaders(rawColumnNames.map((c, i) => c || `Column ${i + 1}`));

  const rows: Array<Record<string, string>> = [];
  for (let r = headerIdx + 1; r < rawRows.length; r++) {
    const dataRow = rawRows[r];
    const obj: Record<string, string> = {};
    for (let i = 0; i < width; i++) obj[columns[i]] = (dataRow[i] || '').trim();
    const hasData = Object.values(obj).some((v) => v !== '');
    if (!hasData) continue; // blank separator row — skip, keep scanning
    // Real sheets end the actual date rows and then have a legend/notes section below
    // (currency codes, market names, free text) — none of that has a parseable date in the
    // date column, so treat the first such row as the end of data rather than trying every
    // remaining row and reporting a wall of "can't parse date" errors at apply time.
    if (!parseSheetDate(obj['Date'] || '')) break;
    rows.push(obj);
  }

  return { columns, rows, groupNames: Array.from(groupNamesSeen) };
}

/* ============================================================
   2) Room-pricing sheet ("Цены с размещением") — a period-start
      row immediately followed by a period-end row (both all-dates
      from some column K onward), then a flat stack of occupancy
      rows (one row per accommodation type, values per period
      column). "PP in DBL"-style reference rows are skipped — that
      base value comes from "Цены и рынки"/computed, not imported,
      per the product decision that these stay separate.
   ============================================================ */

export interface ParsedRoomPricingSheet {
  periods: Array<{ startDate: string; endDate: string }>;
  occupancyRows: Array<{ label: string; values: string[] }>;
}

function isPpReferenceRowLabel(label: string): boolean {
  const nk = normHeaderKey(label);
  return nk.includes('pp_in_dbl') || nk.includes('pp_net') || (nk.includes('pp') && nk.includes('dbl'));
}

export async function parseHotelRoomPricingSheet(
  file: { buffer: Buffer; originalname?: string },
): Promise<ParsedRoomPricingSheet> {
  const rawRows = await readRawRows(file);
  if (!rawRows.length) return { periods: [], occupancyRows: [] };

  const limit = Math.min(rawRows.length - 1, 20);
  let startRowIdx = -1;
  let periodCols: number[] = [];

  for (let i = 0; i < limit; i++) {
    const row = rawRows[i];
    const nextRow = rawRows[i + 1];
    const cols: number[] = [];
    for (let c = 0; c < Math.max(row.length, nextRow.length); c++) {
      const a = parseSheetDate(row[c] || '');
      const b = parseSheetDate(nextRow[c] || '');
      if (a && b && new Date(b) >= new Date(a)) cols.push(c);
    }
    // At least 1 aligned date-pair column (hotels with a single active period are valid too).
    if (cols.length >= 1) {
      startRowIdx = i;
      periodCols = cols;
      break;
    }
  }

  if (startRowIdx === -1) {
    throw new BadRequestException(
      'Не найдены строки с датами начала/конца периодов (две идущие подряд строки с датами по колонкам)',
    );
  }

  const startRow = rawRows[startRowIdx];
  const endRow = rawRows[startRowIdx + 1];
  const periods = periodCols.map((c) => ({
    startDate: parseSheetDate(startRow[c] || '')!,
    endDate: parseSheetDate(endRow[c] || '')!,
  }));

  const occupancyRows: Array<{ label: string; values: string[] }> = [];
  for (let r = startRowIdx + 2; r < rawRows.length; r++) {
    const row = rawRows[r];
    const label = (row[0] || '').trim();
    if (!label) continue; // section separators / blank rows with no row label
    const values = periodCols.map((c) => (row[c] || '').trim());
    const hasAnyValue = values.some((v) => v !== '');
    if (!hasAnyValue) continue; // pure label/section-header row (e.g. "LUXLAND"), no data
    if (isPpReferenceRowLabel(label)) continue; // base PP row — comes from "Цены и рынки", skip
    occupancyRows.push({ label, values: values.map(parseMoney) });
  }

  return { periods, occupancyRows };
}
