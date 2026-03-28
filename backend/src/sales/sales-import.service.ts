// src/sales/sales-import.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesImportSession } from './sales-import-session.entity';
import { Sale } from './sale.entity';
import { SalesChannel } from '../sales-channels/sales-channel.entity';
import { parseCsvRobust } from '../lib/import-spreadsheet.util';

// Те же ключи, что и на фронте (ImportSystemField)
export type ImportSystemField = string;

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
  errors?: Array<{
    row: number;
    reason: string;
  }>;
}

// Простейший XML-парсер для импорта:
// 1) находит повторяющийся "row" тег (item/order/row/etc.)
// 2) собирает поля из прямых дочерних тегов
function parseXml(content: string): { columns: string[]; rows: Record<string, string>[] } {
  const cleaned = content
    .replace(/<\?xml[^>]*\?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

  const hasSales = /<sales[^>]*>/i.test(cleaned);
  const hasSale = /<sale[^>]*>/i.test(cleaned);
  const hasChannel = /<channel[^>]*>/i.test(cleaned);
  const hasItem = /<item[^>]*>/i.test(cleaned);
  const hasNamespaces = /<\w+:\w+/i.test(cleaned);

  const openTagRe = /<([a-zA-Z0-9_:\-]+)(\s[^>]*?)?>/g;
  const counts = new Map<string, number>();

  let m: RegExpExecArray | null;
  while ((m = openTagRe.exec(cleaned))) {
    const tag = m[1];
    const full = m[0];
    if (full.startsWith('</') || full.endsWith('/>')) continue;
    counts.set(tag, (counts.get(tag) || 0) + 1);
  }

  const ignore = new Set([
    'rss',
    'channel',
    'items',
    'itemList',
    'root',
    'head',
    'meta',
  ]);
  const preferred = ['item', 'order', 'row', 'record', 'sale', 'transaction', 'entry', 'product'];

  let rowTag: string | null = null;
  let rowCount = 0;

  if (hasSales && hasSale) {
    rowTag = 'sale';
  } else if (hasChannel && hasItem) {
    rowTag = 'item';
  } else if (hasNamespaces) {
    throw new BadRequestException(
      'XML не соответствует формату импорта продаж. Ожидается <sales><sale>...</sale></sales>.',
    );
  }

  for (const tag of preferred) {
    const c = counts.get(tag) || 0;
    if (c > rowCount) {
      rowTag = tag;
      rowCount = c;
    }
  }

  if (!rowTag) {
    for (const [tag, c] of counts.entries()) {
      if (ignore.has(tag)) continue;
      if (c > rowCount) {
        rowTag = tag;
        rowCount = c;
      }
    }
  }

  if (!rowTag || rowCount <= 1) {
    throw new BadRequestException('Не удалось определить записи в XML');
  }

  const rowRe = new RegExp(`<${rowTag}[^>]*>([\\s\\S]*?)</${rowTag}>`, 'g');
  const columnsSet = new Set<string>();
  const rows: Record<string, string>[] = [];

  const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').trim();
  const extractDirectTags = (block: string) => {
    const result: Record<string, string> = {};
    const fieldRe = /<([a-zA-Z0-9_:\-]+)(\s[^>]*?)?>([\s\S]*?)<\/\1>/g;
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = fieldRe.exec(block))) {
      const tag = fieldMatch[1];
      const value = stripTags(fieldMatch[3]);
      result[tag] = value;
    }
    return result;
  };

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(cleaned))) {
    const block = rowMatch[1];
    const row: Record<string, string> = {};

    if (rowTag === 'sale') {
      const direct = extractDirectTags(block);
      Object.entries(direct).forEach(([key, value]) => {
        if (key === 'buyer' || key === 'product') return;
        row[key] = value ?? '';
        columnsSet.add(key);
      });

      const buyerMatch = block.match(/<buyer[^>]*>([\s\S]*?)<\/buyer>/i);
      if (buyerMatch) {
        const buyer = extractDirectTags(buyerMatch[1]);
        Object.entries(buyer).forEach(([key, value]) => {
          const col = `buyer.${key}`;
          row[col] = value ?? '';
          columnsSet.add(col);
        });
      }

      const productMatch = block.match(/<product[^>]*>([\s\S]*?)<\/product>/i);
      if (productMatch) {
        const product = extractDirectTags(productMatch[1]);
        Object.entries(product).forEach(([key, value]) => {
          const col = `product.${key}`;
          row[col] = value ?? '';
          columnsSet.add(col);
        });
      }
    } else {
      const fieldRe = /<([a-zA-Z0-9_:\-]+)(\s[^>]*?)?>([\s\S]*?)<\/\1>/g;
      let fieldMatch: RegExpExecArray | null;
      while ((fieldMatch = fieldRe.exec(block))) {
        const tag = fieldMatch[1];
        if (tag === rowTag) continue;
        const value = stripTags(fieldMatch[3]);
        if (!row[tag]) {
          row[tag] = value;
        } else if (value) {
          row[tag] = `${row[tag]}; ${value}`;
        }
        columnsSet.add(tag);
      }
    }

    const selfClosingRe = /<([a-zA-Z0-9_:\-]+)(\s[^>]*?)?\/>/g;
    let scMatch: RegExpExecArray | null;
    while ((scMatch = selfClosingRe.exec(block))) {
      const tag = scMatch[1];
      if (tag === rowTag) continue;
      if (!row[tag]) row[tag] = '';
      columnsSet.add(tag);
    }

    rows.push(row);
  }

  const columns = Array.from(columnsSet);
  if (!columns.length || !rows.length) {
    throw new BadRequestException('Не удалось определить колонки в XML');
  }

  return { columns, rows };
}

function parseContent(
  content: string,
): { columns: string[]; rows: Record<string, string>[] } {
  const trimmed = content.trim();
  if (trimmed.startsWith('<')) {
    return parseXml(content);
  }
  const t = parseCsvRobust(content);
  return { columns: t.columns, rows: t.rows };
}

// Авто-маппинг: точное совпадение, затем только границы token (_ .), без includes для коротких имён
function buildSuggestedMapping(
  columns: string[],
): Record<string, string | null> {
  const map: Record<string, string | null> = {};

  const norm = (s: string) => s.toLowerCase().trim();

  const findCol = (...candidates: string[]): string | null => {
    const colsNorm = columns.map((c) => ({ raw: c, norm: norm(c) }));
    for (const cand of candidates) {
      const cNorm = norm(cand);
      if (!cNorm) continue;
      const exact = colsNorm.find((c) => c.norm === cNorm);
      if (exact) return exact.raw;
    }
    for (const cand of candidates) {
      const cNorm = norm(cand);
      if (cNorm.length < 3) continue;
      const hit = colsNorm.find(
        (c) =>
          c.norm.startsWith(`${cNorm}_`) ||
          c.norm.startsWith(`${cNorm}.`) ||
          c.norm.endsWith(`_${cNorm}`) ||
          c.norm.endsWith(`.${cNorm}`),
      );
      if (hit) return hit.raw;
    }
    return null;
  };

  map['orderId'] = findCol('externalId', 'orderId', 'order', 'id', 'Заказ');
  map['productId'] = findCol('product.id', 'productId', 'product_id', 'ID продукта');
  map['purchaseDate'] = findCol(
    'saleDate',
    'createdAt',
    'date',
    'purchase_date',
    'Дата',
    'Дата покупки',
  );
  map['updatedAt'] = findCol('updatedAt', 'date_updated', 'Дата изменения');
  map['status'] = findCol('status', 'Статус');
  map['amount'] = findCol('amount', 'total', 'sum', 'Стоимость');
  map['channel'] = findCol('channelName', 'channel', 'Канал');
  map['integration'] = findCol('integration', 'Интеграция');
  map['customerName'] = findCol(
    'buyer.name',
    'customer',
    'client',
    'name',
    'Имя',
    'Клиент',
    'Агент',
  );
  map['managerName'] = findCol('managerName', 'manager', 'Ответственный менеджер');
  map['productName'] = findCol('product.name', 'product', 'Название продукта');
  map['quantity'] = findCol('qty', 'quantity', 'Количество');
  map['type'] = findCol('type', 'Тип');
  map['category'] = findCol('category', 'Категория');
  map['size'] = findCol('size', 'Размер');
  map['color'] = findCol('color', 'Цвет');
  map['productUrl'] = findCol('product.url', 'url', 'link', 'Ссылка');
  map['currency'] = findCol('currency', 'Валюта');
  map['country'] = findCol('buyer.country', 'country', 'Страна', 'market');

  return map;
}

@Injectable()
export class SalesImportService {
  constructor(
    @InjectRepository(SalesImportSession)
    private readonly sessionRepo: Repository<SalesImportSession>,
    @InjectRepository(Sale)
    private readonly salesRepo: Repository<Sale>,
    @InjectRepository(SalesChannel)
    private readonly channelsRepo: Repository<SalesChannel>,
  ) {}

  async preview(file: any): Promise<ImportPreviewResponse> {
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }

    const originalName = file.originalname || null;
    const ext = (originalName || '').toLowerCase();

    const raw = file.buffer.toString('utf-8');
    const { columns, rows } = parseContent(raw);

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

  async apply(
    payload: ImportApplyPayload,
    tenantId: string | null,
  ): Promise<ImportApplyResult> {
    const session = await this.sessionRepo.findOne({
      where: { id: payload.importId },
    });

    if (!session) {
      throw new NotFoundException('Сессия импорта не найдена');
    }

    if (!tenantId) {
      throw new BadRequestException('Не удалось определить tenantId');
    }

    const { columns, rawContent } = session;
    const { rows } = parseContent(rawContent);

    const baseKeys = new Set<string>([
      'orderId',
      'productId',
      'purchaseDate',
      'updatedAt',
      'status',
      'amount',
      'channel',
      'integration',
      'customerName',
      'country',
      'managerName',
      'productName',
      'productUrl',
      'quantity',
      'type',
      'category',
      'size',
      'color',
      'currency',
    ]);

    const getValue = (row: Record<string, string>, key: string | null) =>
      key ? row[key] ?? '' : '';

    const toNumber = (raw: string) => {
      if (!raw) return null;
      const cleaned = raw.toString().replace(',', '.').replace(/[^\d.-]/g, '');
      const val = Number(cleaned);
      return Number.isFinite(val) ? val : null;
    };

    const toDate = (raw: string) => {
      if (!raw) return null;
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const isUuid = (raw: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        raw,
      );

    const errors: Array<{ row: number; reason: string }> = [];
    let created = 0;
    let skipped = 0;

    const normalizeChannelName = (name: string) =>
      name.trim().replace(/\s+/g, ' ');

    const getOrCreateChannelId = async (name: string, currencyRaw?: string) => {
      const cleanName = normalizeChannelName(name);
      const existing = await this.channelsRepo.findOne({
        where: { tenantId, name: cleanName, isDeleted: false } as any,
      });
      if (existing) return existing.id;
      const createdChannel = this.channelsRepo.create({
        tenantId,
        name: cleanName,
        type: 'other',
        isEnabled: true,
        isDeleted: false,
        currency: currencyRaw || 'EUR',
      });
      const saved = await this.channelsRepo.save(createdChannel);
      return saved.id;
    };

    const fileChannelName = session.originalFileName
      ? session.originalFileName.replace(/\.[^/.]+$/, '')
      : null;

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const mapping = payload.fieldMapping || {};

      const orderId = getValue(row, mapping['orderId'] || null);
      const productId = getValue(row, mapping['productId'] || null);
      const purchaseDate = getValue(row, mapping['purchaseDate'] || null);
      const status = getValue(row, mapping['status'] || null);
      const amountRaw = getValue(row, mapping['amount'] || null);
      const channelRaw = getValue(row, mapping['channel'] || null);
      const integrationRaw = getValue(row, mapping['integration'] || null);
      const customerName = getValue(row, mapping['customerName'] || null);
      const country = getValue(row, mapping['country'] || null);
      const managerName = getValue(row, mapping['managerName'] || null);
      const productName = getValue(row, mapping['productName'] || null);
      const productUrl = getValue(row, mapping['productUrl'] || null);
      const quantityRaw = getValue(row, mapping['quantity'] || null);
      const type = getValue(row, mapping['type'] || null);
      const category = getValue(row, mapping['category'] || null);
      const size = getValue(row, mapping['size'] || null);
      const color = getValue(row, mapping['color'] || null);
      const currency = getValue(row, mapping['currency'] || null);

      const amountValue = toNumber(amountRaw);
      const purchaseDateValue = toDate(purchaseDate);

      if (!purchaseDateValue) {
        skipped += 1;
        errors.push({
          row: index + 1,
          reason: 'Отсутствует дата покупки',
        });
        continue;
      }

      if (amountRaw && amountValue === null) {
        skipped += 1;
        errors.push({
          row: index + 1,
          reason: 'Неверная сумма',
        });
        continue;
      }

      if (!amountRaw) {
        skipped += 1;
        errors.push({
          row: index + 1,
          reason: 'Отсутствует стоимость',
        });
        continue;
      }

      let resolvedChannelId: string | null = null;
      if (payload.channelId) {
        resolvedChannelId = payload.channelId;
      } else if (channelRaw && isUuid(channelRaw)) {
        resolvedChannelId = channelRaw;
      } else if (channelRaw) {
        resolvedChannelId = await getOrCreateChannelId(channelRaw, currency);
      } else if (fileChannelName) {
        resolvedChannelId = await getOrCreateChannelId(fileChannelName, currency);
      }

      const sale = this.salesRepo.create({
        tenantId,
        externalId: orderId || null,
        saleDate: purchaseDateValue,
        guestName: customerName || null,
        managerName: managerName || null,
        hotel: productName || null,
        market: country || null,
        amount: amountValue ?? 0,
        currency: currency || 'EUR',
        status: (status || 'other') as any,
        agentName: null,
        notes: null,
        channelId: resolvedChannelId,
      });

      const customFields: Record<string, any> = {};
      Object.entries(mapping).forEach(([crmField, fileCol]) => {
        if (!fileCol) return;
        if (baseKeys.has(crmField)) return;
        const value = row[fileCol];
        if (value !== undefined && value !== '') {
          customFields[crmField] = value;
        }
      });

      if (productId) customFields['productId'] = productId;
      if (productUrl) customFields['productUrl'] = productUrl;
      if (integrationRaw) customFields['integration'] = integrationRaw;
      if (channelRaw && !sale.channelId) customFields['channel'] = channelRaw;
      if (quantityRaw) customFields['quantity'] = quantityRaw;
      if (type) customFields['type'] = type;
      if (category) customFields['category'] = category;
      if (size) customFields['size'] = size;
      if (color) customFields['color'] = color;

      sale.customFields = Object.keys(customFields).length
        ? customFields
        : null;
      sale.rawPayload = {
        importId: payload.importId,
        row,
        columns,
      };

      await this.salesRepo.save(sale);
      created += 1;
    }

    session.status = 'applied';
    await this.sessionRepo.save(session);

    return {
      ok: true,
      created,
      skipped,
      message:
        errors.length > 0
          ? `Импорт завершен с ошибками. Успешно: ${created}, пропущено: ${skipped}.`
          : 'Импорт завершен. Продажи сохранены.',
      errors: errors.length > 0 ? errors.slice(0, 200) : undefined,
    };
  }
}
