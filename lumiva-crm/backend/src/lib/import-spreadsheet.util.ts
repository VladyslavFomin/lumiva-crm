/**
 * RFC 4180–style CSV splitting (quoted fields, escaped quotes).
 * + delimiter detection with counts outside quotes
 * + duplicate header disambiguation for stable row objects
 */

import ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';

function excelCellToString(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text.trim();
    if (typeof value.result === 'string' || typeof value.result === 'number') {
      return String(value.result).trim();
    }
    if (Array.isArray(value.richText)) {
      return value.richText.map((chunk: any) => String(chunk?.text || '')).join('').trim();
    }
  }
  return String(value).trim();
}

/**
 * Читает строку Excel колонка 1..row.cellCount подряд (включая пустые ячейки), чтобы не
 * терять сдвиг колонок из-за пустой первой ячейки в шапке.
 */
function excelRowToCellStrings(row: ExcelJS.Row): string[] {
  const n = row.cellCount;
  if (!n || n < 1) return [];
  const out: string[] = [];
  for (let c = 1; c <= n; c++) {
    out.push(excelCellToString(row.getCell(c).value));
  }
  return out;
}

/**
 * Реальный парсер .xlsx (ExcelJS, только современный zip-based формат — легаси бинарный .xls
 * не поддерживается никакой версией ExcelJS). Общий для custom-objects и products, чтобы не
 * дублировать ~60 строк парсинга в каждом модуле.
 */
export async function parseXlsxRobust(buffer: Buffer): Promise<{
  columns: string[];
  rows: Array<Record<string, any>>;
  headerRowNumber: number;
}> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as any);
  } catch {
    throw new BadRequestException(
      'Не удалось прочитать этот Excel-файл. Поддерживается только современный формат .xlsx (старый бинарный .xls — нет). Пересохраните файл как .xlsx или CSV и попробуйте снова.',
    );
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) return { columns: [], rows: [], headerRowNumber: 1 };

  let headerRowNumber = 1;
  let columns: string[] = [];
  for (let rowNum = 1; rowNum <= Math.min(sheet.rowCount, 50); rowNum++) {
    const row = sheet.getRow(rowNum);
    const labels = excelRowToCellStrings(row);
    if (labels.some((l) => l.trim() !== '')) {
      headerRowNumber = rowNum;
      while (labels.length > 0 && labels[labels.length - 1].trim() === '') {
        labels.pop();
      }
      if (!labels.length) continue;
      columns = makeUniqueHeaders(labels).columns;
      break;
    }
  }
  if (!columns.length) return { columns: [], rows: [], headerRowNumber: 1 };

  const width = columns.length;
  const rows: Array<Record<string, any>> = [];
  for (let rowNum = headerRowNumber + 1; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum);
    const obj: Record<string, any> = {};
    for (let c = 1; c <= width; c++) {
      obj[columns[c - 1]] = excelCellToString(row.getCell(c).value);
    }
    const hasData = Object.values(obj).some((v) => String(v ?? '').trim() !== '');
    if (hasData) rows.push(obj);
  }
  return { columns, rows, headerRowNumber };
}

export function countDelimitersOutsideQuotes(line: string, delim: string): number {
  let n = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') i++;
        else inQuotes = false;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delim) n++;
    }
  }
  return n;
}

export function detectDelimiter(headerLine: string): ',' | ';' | '\t' {
  const comma = countDelimitersOutsideQuotes(headerLine, ',');
  const semi = countDelimitersOutsideQuotes(headerLine, ';');
  const tab = countDelimitersOutsideQuotes(headerLine, '\t');
  if (tab > comma && tab > semi) return '\t';
  if (semi > comma) return ';';
  return ',';
}

export function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur.trim());
  return out;
}

/** Strip BOM, lowercase, collapse spaces/underscores for comparison */
export function normHeaderKey(s: string): string {
  return s
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '_');
}

/**
 * When the same header appears twice, Excel/Sheets often export duplicate names;
 * object keys would overwrite — suffix with " (2)", " (3)", ...
 */
export function makeUniqueHeaders(raw: string[]): {
  columns: string[];
  duplicateCount: number;
} {
  const seen = new Map<string, number>();
  let duplicateCount = 0;
  const columns: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    let base = raw[i].trim();
    if (!base) base = `Column ${i + 1}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    if (n === 0) {
      columns.push(base);
    } else {
      duplicateCount += 1;
      columns.push(`${base} (${n + 1})`);
    }
  }
  return { columns, duplicateCount };
}

export interface ParsedCsvTable {
  columns: string[];
  rows: Record<string, string>[];
  headerRowNumber: number;
  duplicateHeaderCount: number;
}

export function parseCsvRobust(content: string): ParsedCsvTable {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (!lines.length) {
    return { columns: [], rows: [], headerRowNumber: 1, duplicateHeaderCount: 0 };
  }

  const headerLine = lines[0];
  const delimiter = detectDelimiter(headerLine);
  const headerCells = splitCsvLine(headerLine, delimiter).map((c) =>
    c.replace(/^"|"$/g, '').trim(),
  );
  const { columns, duplicateCount } = makeUniqueHeaders(headerCells);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delimiter).map((c) =>
      c.replace(/^"|"$/g, '').trim(),
    );
    const row: Record<string, string> = {};
    for (let idx = 0; idx < columns.length; idx++) {
      row[columns[idx]] = cells[idx] ?? '';
    }
    rows.push(row);
  }

  return {
    columns,
    rows,
    headerRowNumber: 1,
    duplicateHeaderCount: duplicateCount,
  };
}

export type CustomObjectFieldLike = { key: string; label: string };

/**
 * Strict mapping: normalized key/label equality only (no greedy substring includes).
 */
export function buildSuggestedCustomObjectFieldMapping(
  columns: string[],
  fields: CustomObjectFieldLike[],
): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  const cols = columns.map((raw) => ({
    raw,
    nk: normHeaderKey(raw),
  }));

  for (const field of fields) {
    const keyK = normHeaderKey(field.key);
    const labelK = normHeaderKey(field.label);
    const hit = cols.find((c) => c.nk === keyK || c.nk === labelK);
    map[field.key] = hit ? hit.raw : null;
  }
  return map;
}
