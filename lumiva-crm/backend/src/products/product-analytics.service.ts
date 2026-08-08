// src/products/product-analytics.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import ExcelJS from 'exceljs';
import { Product, type ProductStatus } from './product.entity';
import { ProductCategory } from './product-category.entity';
import { ProductLocation } from './product-location.entity';
import { ProductLocationStock } from './product-location-stock.entity';
import { ProductStockMovement } from './product-stock-movement.entity';
import { AnalyticsPreset } from '../sales/sales-analytics-preset.entity';
import { ProductsAnalyticsQueryDto } from './dto/products-analytics-query.dto';
import { SaveProductsAnalyticsPresetDto } from './dto/save-products-analytics-preset.dto';

const ANALYTICS_PRESET_SCOPE = 'products';

interface ByCategoryRow {
  categoryId: string | null;
  name: string;
  color: string | null;
  count: number;
  value: number;
  stockUnits: number;
}
interface ByStatusRow {
  status: ProductStatus;
  count: number;
  value: number;
}
interface ByCurrencyRow {
  currency: string;
  count: number;
  nativeValue: number;
  convertedValue: number;
}
interface ByTagRow {
  tag: string;
  count: number;
}
interface ByLocationRow {
  locationId: string;
  name: string;
  isDefault: boolean;
  productCount: number;
  stockUnits: number;
  value: number;
  lowStockCount: number;
}
interface TopProductRow {
  id: string;
  name: string;
  sku: string | null;
  currency: string;
  price: number;
  quantity: number;
  value: number;
}
interface LowStockRow {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  lowStockThreshold: number;
}
interface MovementBucket {
  period: string; // YYYY-MM
  in: number;
  out: number;
  net: number;
}
interface MarginBucket {
  bucket: string;
  count: number;
}

export interface ProductsAnalyticsResult {
  displayCurrency: string;
  filters: {
    from: string | null;
    to: string | null;
    status: string | null;
    categoryId: string | null;
    locationId: string | null;
    tag: string | null;
    search: string | null;
  };
  kpis: {
    totalProducts: number;
    activeProducts: number;
    totalCatalogValue: number;
    totalCostValue: number;
    avgMarginPct: number | null;
    totalStockUnits: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalCategories: number;
    totalWarehouses: number;
  };
  byCategory: ByCategoryRow[];
  byStatus: ByStatusRow[];
  byCurrency: ByCurrencyRow[];
  byTag: ByTagRow[];
  byLocation: ByLocationRow[];
  topProducts: TopProductRow[];
  lowStock: LowStockRow[];
  outOfStock: Array<{ id: string; name: string; sku: string | null }>;
  marginBuckets: MarginBucket[];
  stockMovementTimeline: MovementBucket[];
}

function normalizeCurrency(currency?: string | null): string {
  return (currency || 'EUR').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'EUR';
}

@Injectable()
export class ProductsAnalyticsService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(ProductCategory) private readonly categories: Repository<ProductCategory>,
    @InjectRepository(ProductLocation) private readonly locations: Repository<ProductLocation>,
    @InjectRepository(ProductLocationStock)
    private readonly locationStock: Repository<ProductLocationStock>,
    @InjectRepository(ProductStockMovement)
    private readonly movements: Repository<ProductStockMovement>,
    @InjectRepository(AnalyticsPreset) private readonly presets: Repository<AnalyticsPreset>,
  ) {}

  async getAnalytics(
    tenantId: string,
    query: ProductsAnalyticsQueryDto,
  ): Promise<ProductsAnalyticsResult> {
    const { from, to, status, categoryId, locationId, tag, search } = query;
    const displayCurrency = normalizeCurrency(query.displayCurrency);

    let rateMap: Record<string, number> = {};
    if (query.rates) {
      try {
        rateMap = JSON.parse(query.rates);
      } catch {
        rateMap = {};
      }
    }
    // В отличие от продаж (которые обнуляют сумму без курса), тут при отсутствии курса
    // оставляем сумму как есть — молчаливое обнуление реальных остатков/цен товара хуже,
    // чем небольшая неточность конвертации для редкой валюты, отсутствующей в ответе ECB.
    const convert = (amount: number, currency: string): number => {
      const c = normalizeCurrency(currency);
      if (c === displayCurrency) return amount;
      const rate = rateMap[c];
      return rate && Number.isFinite(rate) && rate > 0 ? amount * rate : amount;
    };

    const qb = this.products
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.isDeleted = false');
    if (status) qb.andWhere('p.status = :status', { status });
    if (categoryId) qb.andWhere('p.categoryId = :categoryId', { categoryId });
    // Фильтр по складу сужает набор товаров до тех, что числятся на этом складе (через
    // product_location_stock) — сами величины (quantity/value) остаются денормализованной
    // суммой по всем локациям, как и везде в модуле (см. ProductLocationStock.entity.ts).
    // Без этого EXISTS фильтр "Склад" в UI молчаливо не влиял бы ни на что, кроме панелей
    // "По складам"/"Движение остатков".
    if (locationId) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM product_location_stock pls WHERE pls."productId" = p.id AND pls."locationId" = :locationId AND pls."tenantId" = :tenantId)',
        { locationId, tenantId },
      );
    }
    if (tag?.trim()) qb.andWhere('p.tags @> :tagJson::jsonb', { tagJson: JSON.stringify([tag.trim()]) });
    if (search?.trim()) {
      const pattern = `%${search.trim()}%`;
      qb.andWhere('(p.name ILIKE :pattern OR p.sku ILIKE :pattern)', { pattern });
    }
    if (from) qb.andWhere('p.createdAt >= :from', { from: `${from}T00:00:00.000Z` });
    if (to) qb.andWhere('p.createdAt <= :to', { to: `${to}T23:59:59.999Z` });

    const rows = await qb
      .select([
        'p.id',
        'p.name',
        'p.sku',
        'p.status',
        'p.price',
        'p.costPrice',
        'p.currency',
        'p.quantity',
        'p.lowStockThreshold',
        'p.categoryId',
        'p.tags',
      ])
      .getMany();

    const categoryList = await this.categories.find({ where: { tenantId } });
    const categoryById = new Map(categoryList.map((c) => [c.id, c]));

    const byCategoryMap = new Map<string, ByCategoryRow>();
    const byStatusMap = new Map<string, ByStatusRow>();
    const byCurrencyMap = new Map<string, ByCurrencyRow>();
    const byTagMap = new Map<string, number>();
    const marginBucketMap = new Map<string, number>();
    const MARGIN_BUCKET_ORDER = ['Без себестоимости', '<0%', '0–10%', '10–25%', '25–50%', '50%+'];
    for (const b of MARGIN_BUCKET_ORDER) marginBucketMap.set(b, 0);

    let totalCatalogValue = 0;
    let totalCostValue = 0;
    let totalStockUnits = 0;
    let activeProducts = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let marginSum = 0;
    let marginCount = 0;
    const lowStock: LowStockRow[] = [];
    const outOfStock: Array<{ id: string; name: string; sku: string | null }> = [];
    const scored: TopProductRow[] = [];

    for (const p of rows) {
      const price = Number(p.price) || 0;
      const costPrice = p.costPrice !== null && p.costPrice !== undefined ? Number(p.costPrice) : null;
      const quantity = Number(p.quantity) || 0;
      const currency = normalizeCurrency(p.currency);
      const nativeValue = price * quantity;
      const convertedValue = convert(nativeValue, currency);
      const nativeCost = costPrice !== null ? costPrice * quantity : 0;

      totalCatalogValue += convertedValue;
      totalCostValue += convert(nativeCost, currency);
      totalStockUnits += quantity;
      if (p.status === 'active') activeProducts += 1;

      const catKey = p.categoryId || '__none__';
      const cat = categoryById.get(p.categoryId || '');
      const catRow =
        byCategoryMap.get(catKey) ||
        ({
          categoryId: p.categoryId || null,
          name: cat?.name || 'Без категории',
          color: cat?.color || null,
          count: 0,
          value: 0,
          stockUnits: 0,
        } satisfies ByCategoryRow);
      catRow.count += 1;
      catRow.value += convertedValue;
      catRow.stockUnits += quantity;
      byCategoryMap.set(catKey, catRow);

      const statusRow =
        byStatusMap.get(p.status) || ({ status: p.status, count: 0, value: 0 } satisfies ByStatusRow);
      statusRow.count += 1;
      statusRow.value += convertedValue;
      byStatusMap.set(p.status, statusRow);

      const currRow =
        byCurrencyMap.get(currency) ||
        ({ currency, count: 0, nativeValue: 0, convertedValue: 0 } satisfies ByCurrencyRow);
      currRow.count += 1;
      currRow.nativeValue += nativeValue;
      currRow.convertedValue += convertedValue;
      byCurrencyMap.set(currency, currRow);

      for (const t of p.tags || []) {
        const key = String(t).trim();
        if (!key) continue;
        byTagMap.set(key, (byTagMap.get(key) || 0) + 1);
      }

      if (costPrice !== null && price > 0) {
        const marginPct = ((price - costPrice) / price) * 100;
        marginSum += marginPct;
        marginCount += 1;
        const bucket =
          marginPct < 0 ? '<0%' : marginPct < 10 ? '0–10%' : marginPct < 25 ? '10–25%' : marginPct < 50 ? '25–50%' : '50%+';
        marginBucketMap.set(bucket, (marginBucketMap.get(bucket) || 0) + 1);
      } else {
        marginBucketMap.set('Без себестоимости', (marginBucketMap.get('Без себестоимости') || 0) + 1);
      }

      if (quantity <= 0) {
        outOfStockCount += 1;
        if (outOfStock.length < 30) outOfStock.push({ id: p.id, name: p.name, sku: p.sku });
      } else if (p.lowStockThreshold !== null && p.lowStockThreshold !== undefined && quantity <= p.lowStockThreshold) {
        lowStockCount += 1;
        lowStock.push({ id: p.id, name: p.name, sku: p.sku, quantity, lowStockThreshold: p.lowStockThreshold });
      }

      scored.push({ id: p.id, name: p.name, sku: p.sku, currency, price, quantity, value: convertedValue });
    }

    lowStock.sort((a, b) => a.quantity - b.quantity);
    scored.sort((a, b) => b.value - a.value);

    const locationRowsResult = await this.buildByLocation(tenantId, locationId, convert);

    const stockMovementTimeline = await this.buildMovementTimeline(tenantId, { from, to, locationId });

    return {
      displayCurrency,
      filters: {
        from: from || null,
        to: to || null,
        status: status || null,
        categoryId: categoryId || null,
        locationId: locationId || null,
        tag: tag || null,
        search: search || null,
      },
      kpis: {
        totalProducts: rows.length,
        activeProducts,
        totalCatalogValue,
        totalCostValue,
        avgMarginPct: marginCount > 0 ? marginSum / marginCount : null,
        totalStockUnits,
        lowStockCount,
        outOfStockCount,
        totalCategories: byCategoryMap.size,
        totalWarehouses: locationRowsResult.length,
      },
      byCategory: Array.from(byCategoryMap.values()).sort((a, b) => b.value - a.value),
      byStatus: Array.from(byStatusMap.values()),
      byCurrency: Array.from(byCurrencyMap.values()).sort((a, b) => b.convertedValue - a.convertedValue),
      byTag: Array.from(byTagMap.entries())
        .map(([tagName, count]) => ({ tag: tagName, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 30),
      byLocation: locationRowsResult,
      topProducts: scored.slice(0, 10),
      lowStock: lowStock.slice(0, 30),
      outOfStock,
      marginBuckets: MARGIN_BUCKET_ORDER.map((bucket) => ({ bucket, count: marginBucketMap.get(bucket) || 0 })),
      stockMovementTimeline,
    };
  }

  private async buildByLocation(
    tenantId: string,
    locationIdFilter: string | undefined,
    convert: (amount: number, currency: string) => number,
  ): Promise<ByLocationRow[]> {
    const locationList = await this.locations.find({ where: { tenantId }, order: { isDefault: 'DESC', name: 'ASC' } });
    const filtered = locationIdFilter ? locationList.filter((l) => l.id === locationIdFilter) : locationList;
    if (filtered.length === 0) return [];

    const stockRows = await this.locationStock
      .createQueryBuilder('ls')
      .innerJoin(Product, 'p', 'p.id = ls.productId')
      .where('ls.tenantId = :tenantId', { tenantId })
      .andWhere('p.isDeleted = false')
      .select([
        'ls.locationId AS "locationId"',
        'ls.productId AS "productId"',
        'ls.quantity AS "quantity"',
        'p.price AS "price"',
        'p.currency AS "currency"',
        'p.lowStockThreshold AS "lowStockThreshold"',
      ])
      .getRawMany<{
        locationId: string;
        productId: string;
        quantity: number;
        price: string;
        currency: string;
        lowStockThreshold: number | null;
      }>();

    const agg = new Map<string, { productIds: Set<string>; stockUnits: number; value: number; lowStockCount: number }>();
    for (const r of stockRows) {
      const entry = agg.get(r.locationId) || {
        productIds: new Set<string>(),
        stockUnits: 0,
        value: 0,
        lowStockCount: 0,
      };
      const qty = Number(r.quantity) || 0;
      const price = Number(r.price) || 0;
      if (qty > 0) entry.productIds.add(r.productId);
      entry.stockUnits += qty;
      entry.value += convert(qty * price, r.currency);
      if (r.lowStockThreshold !== null && r.lowStockThreshold !== undefined && qty > 0 && qty <= r.lowStockThreshold) {
        entry.lowStockCount += 1;
      }
      agg.set(r.locationId, entry);
    }

    return filtered.map((loc) => {
      const entry = agg.get(loc.id);
      return {
        locationId: loc.id,
        name: loc.name,
        isDefault: loc.isDefault,
        productCount: entry?.productIds.size || 0,
        stockUnits: entry?.stockUnits || 0,
        value: entry?.value || 0,
        lowStockCount: entry?.lowStockCount || 0,
      };
    });
  }

  private async buildMovementTimeline(
    tenantId: string,
    opts: { from?: string; to?: string; locationId?: string },
  ): Promise<MovementBucket[]> {
    const to = opts.to ? new Date(`${opts.to}T23:59:59.999Z`) : new Date();
    const from = opts.from
      ? new Date(`${opts.from}T00:00:00.000Z`)
      : new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 11, 1));

    const qb = this.movements
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId })
      .andWhere('m.createdAt >= :from', { from })
      .andWhere('m.createdAt <= :to', { to });
    if (opts.locationId) qb.andWhere('m.locationId = :locationId', { locationId: opts.locationId });

    const rows = await qb.select(['m.quantityDelta', 'm.createdAt']).getMany();

    const buckets = new Map<string, MovementBucket>();
    for (const r of rows) {
      const d = new Date(r.createdAt);
      const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const bucket = buckets.get(period) || { period, in: 0, out: 0, net: 0 };
      const delta = Number(r.quantityDelta) || 0;
      if (delta > 0) bucket.in += delta;
      else bucket.out += Math.abs(delta);
      bucket.net += delta;
      buckets.set(period, bucket);
    }
    return Array.from(buckets.values()).sort((a, b) => a.period.localeCompare(b.period));
  }

  async exportAnalytics(
    tenantId: string,
    query: ProductsAnalyticsQueryDto,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const data = await this.getAnalytics(tenantId, query);
    const workbook = new ExcelJS.Workbook();

    const summary = workbook.addWorksheet('Сводка');
    summary.addRow(['Показатель', 'Значение']);
    summary.addRow(['Всего товаров', data.kpis.totalProducts]);
    summary.addRow(['Активных товаров', data.kpis.activeProducts]);
    summary.addRow([`Стоимость каталога (${data.displayCurrency})`, Number(data.kpis.totalCatalogValue.toFixed(2))]);
    summary.addRow([`Себестоимость каталога (${data.displayCurrency})`, Number(data.kpis.totalCostValue.toFixed(2))]);
    summary.addRow(['Средняя маржа, %', data.kpis.avgMarginPct !== null ? Number(data.kpis.avgMarginPct.toFixed(1)) : '—']);
    summary.addRow(['Остаток, шт.', data.kpis.totalStockUnits]);
    summary.addRow(['Заканчивается', data.kpis.lowStockCount]);
    summary.addRow(['Нет в наличии', data.kpis.outOfStockCount]);
    summary.addRow(['Категорий', data.kpis.totalCategories]);
    summary.addRow(['Складов', data.kpis.totalWarehouses]);
    summary.getRow(1).font = { bold: true };
    summary.columns.forEach((c) => (c.width = 30));

    const catSheet = workbook.addWorksheet('По категориям');
    catSheet.addRow(['Категория', 'Товаров', `Стоимость (${data.displayCurrency})`, 'Остаток, шт.']);
    for (const r of data.byCategory) catSheet.addRow([r.name, r.count, Number(r.value.toFixed(2)), r.stockUnits]);
    catSheet.getRow(1).font = { bold: true };
    catSheet.columns.forEach((c) => (c.width = 24));

    const currSheet = workbook.addWorksheet('По валютам');
    currSheet.addRow(['Валюта', 'Товаров', 'Сумма (нативная)', `Сумма (${data.displayCurrency})`]);
    for (const r of data.byCurrency) currSheet.addRow([r.currency, r.count, Number(r.nativeValue.toFixed(2)), Number(r.convertedValue.toFixed(2))]);
    currSheet.getRow(1).font = { bold: true };
    currSheet.columns.forEach((c) => (c.width = 22));

    const whSheet = workbook.addWorksheet('По складам');
    whSheet.addRow(['Склад', 'Товаров', 'Остаток, шт.', `Стоимость (${data.displayCurrency})`, 'Заканчивается']);
    for (const r of data.byLocation) whSheet.addRow([r.name, r.productCount, r.stockUnits, Number(r.value.toFixed(2)), r.lowStockCount]);
    whSheet.getRow(1).font = { bold: true };
    whSheet.columns.forEach((c) => (c.width = 22));

    const topSheet = workbook.addWorksheet('Топ товаров');
    topSheet.addRow(['Товар', 'Артикул', `Стоимость (${data.displayCurrency})`, 'Остаток, шт.']);
    for (const r of data.topProducts) topSheet.addRow([r.name, r.sku || '—', Number(r.value.toFixed(2)), r.quantity]);
    topSheet.getRow(1).font = { bold: true };
    topSheet.columns.forEach((c) => (c.width = 26));

    const lowSheet = workbook.addWorksheet('Заканчиваются');
    lowSheet.addRow(['Товар', 'Артикул', 'Остаток, шт.', 'Порог']);
    for (const r of data.lowStock) lowSheet.addRow([r.name, r.sku || '—', r.quantity, r.lowStockThreshold]);
    lowSheet.getRow(1).font = { bold: true };
    lowSheet.columns.forEach((c) => (c.width = 26));

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      filename: `products-analytics-${Date.now()}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /* ------------------------------------------------------------------ presets */

  async getPreset(tenantId: string, userId?: string | null) {
    const where: any = { tenantId, scope: ANALYTICS_PRESET_SCOPE };
    where.userId = userId ? userId : IsNull();
    const preset = await this.presets.findOne({ where });
    return preset?.payload ?? null;
  }

  async savePreset(tenantId: string, userId: string | null, dto: SaveProductsAnalyticsPresetDto) {
    const where: any = { tenantId, scope: ANALYTICS_PRESET_SCOPE };
    where.userId = userId ? userId : IsNull();
    let preset = await this.presets.findOne({ where });
    if (!preset) {
      preset = this.presets.create({ tenantId, userId, scope: ANALYTICS_PRESET_SCOPE, payload: dto.payload });
    } else {
      preset.payload = dto.payload;
    }
    await this.presets.save(preset);
    return preset.payload;
  }
}
