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
 * Значение ячейки с разворотом объединённых (merged) диапазонов: у не-master ячейки
 * merged-диапазона .value всегда null, реальное значение лежит в .master (см. ExcelJS —
 * характерно для отчётов вида «Nationality» на N строк с Sold/Occ%/C-In/C-Out, где
 * страна объединена по вертикали, а без разворота строки 2-4 группы остаются пустыми).
 */
function excelCellValue(cell: ExcelJS.Cell): any {
  if (cell.isMerged && cell.master && cell.master !== cell) {
    return cell.master.value;
  }
  return cell.value;
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
    out.push(excelCellToString(excelCellValue(row.getCell(c))));
  }
  return out;
}

/** "Сырое" число/процент, а не текстовая подпись — настоящие заголовки колонок почти никогда
 * не бывают голым числом (в отличие от значения метрики). Один из двух признаков ниже. */
function looksLikeRawNumber(s: string): boolean {
  return /^-?\d+([.,]\d+)?%?$/.test(s.trim());
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
  /** true, если "заголовок" на самом деле обычная строка данных (файл без реальной шапки) —
   * тогда эта же строка должна остаться в rows, а не быть съеденной как заголовки. */
  let headerless = false;
  for (let rowNum = 1; rowNum <= Math.min(sheet.rowCount, 50); rowNum++) {
    const row = sheet.getRow(rowNum);
    const labels = excelRowToCellStrings(row);
    if (labels.some((l) => l.trim() !== '')) {
      headerRowNumber = rowNum;
      while (labels.length > 0 && labels[labels.length - 1].trim() === '') {
        labels.pop();
      }
      if (!labels.length) continue;
      // Файл без реальной строки заголовков (данные начинаются сразу с первой строки): первая
      // непустая строка сама оказывается строкой данных, и её первая ячейка "съедает" реальное
      // значение под видом заголовка — конкретно так сломался реальный отчёт пользователя
      // (горизонтальный merge "Nationality" на 3 колонки + строка метрики, напр.
      // ["ALBANIA","ALBANIA","ALBANIA","Sold","621"] вместо заголовков). Ловим по двум
      // совместным признакам: одно и то же непустое значение повторяется в строке 2+ раза
      // (типично для горизонтального merge) И хотя бы одна ячейка — голое число/процент
      // (настоящие заголовки такими почти никогда не бывают). Оба сразу — редкое совпадение
      // для настоящей шапки, поэтому легитимные файлы (включая числовые заголовки колонок
      // вроде "2024") этим фолбэком не затрагиваются.
      const nonEmpty = labels.map((l) => l.trim()).filter(Boolean);
      const hasDuplicateValue = new Set(nonEmpty).size < nonEmpty.length;
      const hasRawNumber = nonEmpty.some(looksLikeRawNumber);
      if (hasDuplicateValue && hasRawNumber) {
        headerless = true;
        columns = labels.map((_, i) => `Column ${i + 1}`);
        break;
      }
      columns = makeUniqueHeaders(labels).columns;
      break;
    }
  }
  if (!columns.length) return { columns: [], rows: [], headerRowNumber: 1 };

  const width = columns.length;
  const rows: Array<Record<string, any>> = [];
  const dataStartRow = headerless ? headerRowNumber : headerRowNumber + 1;
  for (let rowNum = dataStartRow; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum);
    const obj: Record<string, any> = {};
    for (let c = 1; c <= width; c++) {
      obj[columns[c - 1]] = excelCellToString(excelCellValue(row.getCell(c)));
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

/** Локальная копия CustomObjectFieldType (custom-objects/custom-object-field.entity.ts) —
 * намеренно не импортируем оттуда, чтобы lib/ не тянул зависимость на конкретный feature-модуль
 * (этот файл уже переиспользуется products). Держать в синхроне вручную при добавлении типов поля. */
export type ImportReshapeFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'status'
  | 'select'
  | 'multiselect'
  | 'file';

export interface ImportReshapeOutputField {
  key: string;
  label: string;
  type: ImportReshapeFieldType;
  /** Варианты сырых значений label-колонки, которые матчатся на эту выходную колонку
   * (напр. ["Sold"] или ["Occ%", "Occupancy"]) — сравнение по normHeaderKey. */
  rawLabels: string[];
}

export interface ImportReshapePivotPlan {
  kind: 'pivot';
  /** Колонки, определяющие "сущность" — одна выходная строка на уникальную комбинацию значений. */
  groupKeyColumns: string[];
  /** Колонка, чьё значение указывает, какую метрику несёт строка (напр. "Sold"/"Occ%"/...). */
  pivotLabelColumn: string;
  /** Колонка со значением метрики. */
  pivotValueColumn: string;
  /** Колонки, копируемые как есть из первой строки группы (обычно = groupKeyColumns). */
  passthroughColumns: string[];
  /**
   * Итоговая подпись каждой passthrough-колонки (тот же порядок/длина, что passthroughColumns) —
   * пусть модель переиспользует подпись уже существующего поля таблицы (напр. "Name"), если оно
   * явно подходит, чтобы данные сразу легли в него, а не создавали параллельное поле с сырым
   * (часто бессмысленным — см. header-detection edge case) именем исходной колонки.
   */
  passthroughLabels: string[];
  /**
   * Считается детерминированно из реальных данных ({@link buildImportReshapeOutputFields}) —
   * НЕ заполняется моделью напрямую. Модель один раз слепила несколько разных меток
   * (rawLabels: ["Sold","C/In","C/Out"]) в одно выходное поле, из-за чего значения одной
   * метки молча затёрли другую — раз распознавание СПИСКА меток тривиально и 100%-точно
   * вычисляется из данных, этому больше не доверяем LLM. Модель отвечает только за структуру
   * (какая колонка чем является), а не за перечисление/типизацию самих меток.
   */
  outputFields: ImportReshapeOutputField[];
}

/** "direct" — файл уже плоский (1 строка файла = 1 запись), реструктуризация не нужна. */
export type ImportReshapePlan = { kind: 'direct' } | ImportReshapePivotPlan;

function slugifyReshapeFieldKey(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '_')
    .replace(/^_+|_+$/g, '');
  return base || 'field';
}

/**
 * Строит outputFields детерминированно из ВСЕХ строк файла (не из LLM-сэмпла) — один выходной
 * field на каждое различное значение pivotLabelColumn, в порядке первого появления. Гарантирует
 * 100%-точный список меток (модель может видеть только первые ~60 строк и не заметить редкую
 * метку, а объединение разных меток моделью в одно поле уже ловилось на реальных данных — см.
 * комментарий у ImportReshapePivotPlan.outputFields) и корректный тип (number, только если
 * реально ВСЕ значения этой метки по всему файлу выглядят как голые числа/проценты).
 */
export function buildImportReshapeOutputFields(
  rows: Array<Record<string, any>>,
  pivotLabelColumn: string,
  pivotValueColumn: string,
): ImportReshapeOutputField[] {
  const valuesByLabel = new Map<string, string[]>();
  const order: string[] = [];
  for (const row of rows) {
    const rawLabel = String(row[pivotLabelColumn] ?? '').trim();
    if (!rawLabel) continue;
    if (!valuesByLabel.has(rawLabel)) {
      valuesByLabel.set(rawLabel, []);
      order.push(rawLabel);
    }
    valuesByLabel.get(rawLabel)!.push(String(row[pivotValueColumn] ?? ''));
  }
  if (!order.length || order.length > 40) {
    throw new BadRequestException(
      order.length
        ? `Колонка меток содержит слишком много разных значений (${order.length}) — похоже, ИИ выбрал не ту колонку.`
        : 'В выбранной ИИ колонке меток нет значений.',
    );
  }
  const usedKeys = new Set<string>();
  return order.map((rawLabel) => {
    const values = valuesByLabel.get(rawLabel)!;
    const nonEmpty = values.filter((v) => v.trim());
    const type: ImportReshapeFieldType =
      nonEmpty.length > 0 && nonEmpty.every((v) => looksLikeRawNumber(v)) ? 'number' : 'text';
    let key = slugifyReshapeFieldKey(rawLabel);
    let n = 2;
    while (usedKeys.has(key)) key = `${slugifyReshapeFieldKey(rawLabel)}_${n++}`;
    usedKeys.add(key);
    return { key, label: rawLabel, type, rawLabels: [rawLabel] };
  });
}

/**
 * Детерминированно применяет план реструктуризации (спроектированный LLM по сэмплу строк) ко
 * ВСЕМ строкам файла — числа и группировка никогда не проходят через модель, только структура.
 * Нужен для отчётов вида "Nationality (merged на 4 строки) / Sold / Occ% / C-In / C-Out", где
 * построчный импорт 1:1 иначe дублирует сущность на каждую метрику вместо одной записи с колонками.
 */
export function applyImportReshapePlan(
  columns: string[],
  rows: Array<Record<string, any>>,
  plan: ImportReshapePivotPlan,
): { columns: string[]; rows: Array<Record<string, any>> } {
  const columnSet = new Set(columns);
  const missing = [
    ...plan.groupKeyColumns,
    plan.pivotLabelColumn,
    plan.pivotValueColumn,
    ...plan.passthroughColumns,
  ].filter((c) => !columnSet.has(c));
  if (missing.length) {
    throw new BadRequestException(
      `ИИ сослался на несуществующие колонки файла: ${Array.from(new Set(missing)).join(', ')}`,
    );
  }
  if (!plan.outputFields.length || plan.outputFields.length > 40) {
    throw new BadRequestException('ИИ вернул некорректное число итоговых колонок (0 или больше 40).');
  }
  // Подписи passthrough-колонок — если модель не прислала ровно столько же подписей, сколько
  // колонок, откатываемся на исходные имена (не блокируем разбор из-за необязательного поля).
  const passthroughLabels =
    plan.passthroughLabels.length === plan.passthroughColumns.length
      ? plan.passthroughLabels
      : plan.passthroughColumns;

  // Локальная копия outputFields — сюда же на лету добавляются колонки для непойманных label-ов,
  // чтобы данные не терялись, если план модели неполный.
  const outputFields: ImportReshapeOutputField[] = plan.outputFields.map((f) => ({ ...f }));
  const findFieldForLabel = (rawLabel: string): ImportReshapeOutputField => {
    const norm = normHeaderKey(rawLabel);
    const existing = outputFields.find((f) => f.rawLabels.some((l) => normHeaderKey(l) === norm));
    if (existing) return existing;
    const usedKeys = new Set(outputFields.map((f) => f.key));
    let key = slugifyReshapeFieldKey(rawLabel);
    let n = 2;
    while (usedKeys.has(key)) key = `${slugifyReshapeFieldKey(rawLabel)}_${n++}`;
    const created: ImportReshapeOutputField = {
      key,
      label: rawLabel.trim() || key,
      type: 'text',
      rawLabels: [rawLabel],
    };
    outputFields.push(created);
    return created;
  };

  // Forward-fill groupKeyColumns — защита от CSV-экспорта того же merged-отчёта, где merge не
  // сохраняется вовсе и колонка группы пустая на всех строках кроме первой в группе.
  const lastGroupValues: Record<string, any> = {};
  const filledRows = rows.map((row) => {
    const out = { ...row };
    for (const col of plan.groupKeyColumns) {
      const v = out[col];
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        lastGroupValues[col] = v;
      } else {
        out[col] = lastGroupValues[col] ?? out[col];
      }
    }
    return out;
  });

  const outputRows: Array<Record<string, any>> = [];
  let currentGroupKey: string | null = null;
  let currentRow: Record<string, any> | null = null;

  for (const row of filledRows) {
    const groupKey = plan.groupKeyColumns.map((c) => String(row[c] ?? '').trim()).join('\u0001');
    if (groupKey !== currentGroupKey || currentRow === null) {
      currentGroupKey = groupKey;
      currentRow = {};
      for (const col of plan.passthroughColumns) currentRow[col] = row[col];
      outputRows.push(currentRow);
    }
    const rawLabel = String(row[plan.pivotLabelColumn] ?? '').trim();
    if (!rawLabel) continue;
    const field = findFieldForLabel(rawLabel);
    currentRow![field.key] = row[plan.pivotValueColumn];
  }

  // Дедуп финальных заголовков (тем же способом, что и обычный парсинг файла) — план модели
  // теоретически может предложить label, совпадающий с passthrough-колонкой или другим полем.
  const rawLabels = [...passthroughLabels, ...outputFields.map((f) => f.label)];
  const { columns: uniqueColumns } = makeUniqueHeaders(rawLabels);

  return {
    columns: uniqueColumns,
    rows: outputRows.map((r) => {
      const out: Record<string, any> = {};
      uniqueColumns.forEach((col, i) => {
        if (i < plan.passthroughColumns.length) {
          out[col] = r[plan.passthroughColumns[i]];
        } else {
          out[col] = r[outputFields[i - plan.passthroughColumns.length].key] ?? '';
        }
      });
      return out;
    }),
  };
}

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
