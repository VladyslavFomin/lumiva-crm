// src/sales/sales-import.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesImportSession } from './sales-import-session.entity';


// Те же ключи, что и на фронте (ImportSystemField)
export type ImportSystemField =
  | 'purchaseDate'
  | 'customerName'
  | 'quantity'
  | 'type'
  | 'category'
  | 'size'
  | 'color'
  | 'url'
  | 'currency'
  | 'country';

export interface ImportPreviewResponse {
  importId: string;
  columns: string[];
  sample: Record<string, string>[];
  totalRows: number;
  suggestedMapping: Record<string, string | null>;
}

export interface ImportApplyPayload {
  importId: string;
  channelId?: string;
  fieldMapping: Record<ImportSystemField, string | null>;
}

export interface ImportApplyResult {
  ok: boolean;
  created: number;
  skipped: number;
  message?: string;
}

// Простенький CSV-парсер
function parseCsv(content: string): { columns: string[]; rows: Record<string, string>[] } {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (!lines.length) {
    return { columns: [], rows: [] };
  }

  const headerLine = lines[0];

  // Определяем разделитель: ; или ,
  const countComma = (headerLine.match(/,/g) || []).length;
  const countSemi = (headerLine.match(/;/g) || []).length;
  const delimiter = countSemi > countComma ? ';' : ',';

  const splitLine = (line: string): string[] =>
    line
      .split(delimiter)
      .map((cell) => cell.replace(/^"|"$/g, '').trim());

  const columns = splitLine(headerLine).filter((c) => c.length > 0);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const row: Record<string, string> = {};
    columns.forEach((col, idx) => {
      row[col] = cells[idx] ?? '';
    });
    rows.push(row);
  }

  return { columns, rows };
}

// Грубый авто-маппинг по названию колонок
function buildSuggestedMapping(
  columns: string[],
): Record<string, string | null> {
  const map: Record<string, string | null> = {};

  const norm = (s: string) => s.toLowerCase().trim();

  const findCol = (...candidates: string[]): string | null => {
    const colsNorm = columns.map((c) => ({ raw: c, norm: norm(c) }));
    for (const cand of candidates) {
      const cNorm = norm(cand);
      const exact = colsNorm.find((c) => c.norm === cNorm);
      if (exact) return exact.raw;
    }
    for (const cand of candidates) {
      const cNorm = norm(cand);
      const partial = colsNorm.find((c) => c.norm.includes(cNorm));
      if (partial) return partial.raw;
    }
    return null;
  };

  map['purchaseDate'] = findCol('date', 'purchase_date', 'Дата', 'Дата покупки');
  map['customerName'] = findCol('name', 'customer', 'client', 'Имя', 'Клиент', 'Агент');
  map['quantity'] = findCol('qty', 'quantity', 'Количество');
  map['type'] = findCol('type', 'Тип');
  map['category'] = findCol('category', 'Категория');
  map['size'] = findCol('size', 'Размер');
  map['color'] = findCol('color', 'Цвет');
  map['url'] = findCol('url', 'link', 'Ссылка');
  map['currency'] = findCol('currency', 'Валюта');
  map['country'] = findCol('country', 'Страна', 'market');

  return map;
}

@Injectable()
export class SalesImportService {
  constructor(
    @InjectRepository(SalesImportSession)
    private readonly sessionRepo: Repository<SalesImportSession>,
  ) {}

  async preview(file: any): Promise<ImportPreviewResponse> {
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }

    const originalName = file.originalname || null;
    const ext = (originalName || '').toLowerCase();

    if (ext.endsWith('.xml')) {
      // Можно потом реализовать XML, пока честно говорим, что не умеем
      throw new BadRequestException(
        'Предпросмотр XML пока не реализован. Пожалуйста, используйте CSV.',
      );
    }

    const raw = file.buffer.toString('utf-8');
    const { columns, rows } = parseCsv(raw);

    if (!columns.length) {
      throw new BadRequestException('Не удалось определить колонки в файле');
    }

    const totalRows = rows.length;
    const sample = rows.slice(0, 20);
    const suggestedMapping = buildSuggestedMapping(columns);

    const session = this.sessionRepo.create({
      originalFileName: originalName,
      rawContent: raw,
      columns,
      sample,
      totalRows,
      suggestedMapping,
      status: 'preview',
    });

    const saved = await this.sessionRepo.save(session);

    return {
      importId: saved.id,
      columns,
      sample,
      totalRows,
      suggestedMapping,
    };
  }

  async apply(payload: ImportApplyPayload): Promise<ImportApplyResult> {
    const session = await this.sessionRepo.findOne({
      where: { id: payload.importId },
    });

    if (!session) {
      throw new NotFoundException('Сессия импорта не найдена');
    }

    const { columns, rawContent } = session;
    const { rows } = parseCsv(rawContent);

    // Здесь должен быть реальный импорт в сущность Sale.
    // Пока делаем заглушку, чтобы фронт уже работал.
    const total = rows.length;
    const created = 0; // TODO: когда появится логика создания Sale
    const skipped = total; // пока "пропускаем" всё

    session.status = 'applied';
    await this.sessionRepo.save(session);

    return {
      ok: true,
      created,
      skipped,
      message:
        'Импорт-флоу выполнен (MVP). Логика записи продаж в базу будет добавлена позже.',
    };
  }
}