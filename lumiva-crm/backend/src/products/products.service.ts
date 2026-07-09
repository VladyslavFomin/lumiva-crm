import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import ExcelJS from 'exceljs';
import { Product, type ProductImage, type ProductStatus } from './product.entity';
import { ProductCategory } from './product-category.entity';
import { ProductFieldDef, type ProductFieldType } from './product-field-def.entity';
import { ProductAttribute, type ProductAttributeValue } from './product-attribute.entity';
import { ProductVariant, type ProductVariantAttributeValues } from './product-variant.entity';
import {
  ProductStockMovement,
  type ProductStockMovementSource,
  type ProductStockMovementType,
} from './product-stock-movement.entity';
import { ProductImportSession } from './product-import-session.entity';
import {
  buildSuggestedCustomObjectFieldMapping,
  parseCsvRobust,
  parseXlsxRobust,
} from '../lib/import-spreadsheet.util';

/** Структурные колонки товара, доступные для маппинга при импорте (наравне с product_field_defs). */
const IMPORT_STRUCTURAL_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'sku', label: 'Артикул' },
  { key: 'name', label: 'Название' },
  { key: 'description', label: 'Описание' },
  { key: 'category', label: 'Категория' },
  { key: 'status', label: 'Статус' },
  { key: 'price', label: 'Цена' },
  { key: 'costPrice', label: 'Себестоимость' },
  { key: 'currency', label: 'Валюта' },
  { key: 'quantity', label: 'Количество' },
  { key: 'unit', label: 'Единица измерения' },
  { key: 'externalId', label: 'Внешний ID' },
];

const PRODUCT_FIELD_TYPES: ProductFieldType[] = [
  'text',
  'textarea',
  'number',
  'date',
  'datetime',
  'boolean',
  'select',
  'multiselect',
  'radio',
  'url',
  'media',
  'gallery',
];

const PRODUCT_STATUSES: ProductStatus[] = ['active', 'draft', 'archived', 'out_of_stock'];

type ProductListQuery = {
  status?: string;
  categoryId?: string;
  isVariable?: boolean;
  search?: string;
  sort?: string;
  order?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
};

@Injectable()
export class ProductsService {
  private readonly log = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(ProductCategory) private readonly categories: Repository<ProductCategory>,
    @InjectRepository(ProductFieldDef) private readonly fieldDefs: Repository<ProductFieldDef>,
    @InjectRepository(ProductAttribute) private readonly attributes: Repository<ProductAttribute>,
    @InjectRepository(ProductVariant) private readonly variants: Repository<ProductVariant>,
    @InjectRepository(ProductStockMovement)
    private readonly movements: Repository<ProductStockMovement>,
    @InjectRepository(ProductImportSession)
    private readonly importSessions: Repository<ProductImportSession>,
  ) {}

  /* ------------------------------------------------------------------ utils */

  private slugify(input: string): string {
    return (
      String(input || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 160) || 'item'
    );
  }

  private cleanString(value: unknown, fallback = '', max = 255): string {
    const raw = value == null ? '' : String(value).trim();
    return (raw || fallback).slice(0, max);
  }

  private async uniqueCategorySlug(tenantId: string, base: string, excludeId?: string) {
    let candidate = this.slugify(base);
    let i = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const found = await this.categories.findOne({ where: { tenantId, slug: candidate } });
      if (!found || found.id === excludeId) return candidate;
      candidate = `${this.slugify(base)}-${i++}`;
    }
  }

  private async uniqueAttributeSlug(tenantId: string, base: string, excludeId?: string) {
    let candidate = this.slugify(base);
    let i = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const found = await this.attributes.findOne({ where: { tenantId, slug: candidate } });
      if (!found || found.id === excludeId) return candidate;
      candidate = `${this.slugify(base)}-${i++}`;
    }
  }

  private async uniqueFieldKey(tenantId: string, base: string, excludeId?: string) {
    const normalized = this.slugify(base).replace(/-/g, '_');
    let candidate = normalized || 'field';
    let i = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const found = await this.fieldDefs.findOne({ where: { tenantId, key: candidate } });
      if (!found || found.id === excludeId) return candidate;
      candidate = `${normalized}_${i++}`;
    }
  }

  /* ------------------------------------------------------------------ categories */

  async listCategories(tenantId: string) {
    return this.categories.find({ where: { tenantId }, order: { order: 'ASC', name: 'ASC' } });
  }

  async createCategory(
    tenantId: string,
    dto: { name: string; slug?: string; order?: number },
  ) {
    const name = this.cleanString(dto.name, '', 160);
    if (!name) throw new BadRequestException('Название категории обязательно');
    const slug = await this.uniqueCategorySlug(tenantId, dto.slug || name);
    const category = this.categories.create({
      tenantId,
      name,
      slug,
      order: Number.isFinite(Number(dto.order)) ? Number(dto.order) : 0,
    });
    return this.categories.save(category);
  }

  async updateCategory(
    tenantId: string,
    id: string,
    dto: { name?: string; slug?: string; order?: number; isActive?: boolean },
  ) {
    const category = await this.categories.findOne({ where: { tenantId, id } });
    if (!category) throw new NotFoundException('Категория не найдена');
    if (dto.name !== undefined) category.name = this.cleanString(dto.name, category.name, 160);
    if (dto.slug !== undefined) {
      category.slug = await this.uniqueCategorySlug(tenantId, dto.slug, category.id);
    }
    if (dto.order !== undefined) category.order = Number(dto.order) || 0;
    if (dto.isActive !== undefined) category.isActive = Boolean(dto.isActive);
    return this.categories.save(category);
  }

  async deleteCategory(tenantId: string, id: string) {
    const category = await this.categories.findOne({ where: { tenantId, id } });
    if (!category) throw new NotFoundException('Категория не найдена');
    await this.products.update({ tenantId, categoryId: id }, { categoryId: null });
    await this.categories.remove(category);
    return { ok: true };
  }

  /* ------------------------------------------------------------------ field defs */

  async listFieldDefs(tenantId: string) {
    return this.fieldDefs.find({ where: { tenantId }, order: { order: 'ASC', createdAt: 'ASC' } });
  }

  async createFieldDef(
    tenantId: string,
    dto: {
      key?: string;
      label: string;
      type: string;
      required?: boolean;
      options?: Array<{ value: string; label: string }>;
      settings?: Record<string, unknown>;
      width?: string;
      description?: string;
      showInList?: boolean;
      showInQuickEdit?: boolean;
    },
  ) {
    const label = this.cleanString(dto.label, '', 200);
    if (!label) throw new BadRequestException('Название поля обязательно');
    const type = String(dto.type || '') as ProductFieldType;
    if (!PRODUCT_FIELD_TYPES.includes(type)) {
      throw new BadRequestException(`Недопустимый тип поля: ${dto.type}`);
    }
    const key = await this.uniqueFieldKey(tenantId, dto.key || label);
    const count = await this.fieldDefs.count({ where: { tenantId } });
    const field = this.fieldDefs.create({
      tenantId,
      key,
      label,
      type,
      required: Boolean(dto.required),
      options: this.normalizeOptions(dto.options, type),
      settings: dto.settings && typeof dto.settings === 'object' ? dto.settings : null,
      width: (['25', '50', '75', '100'].includes(String(dto.width)) ? dto.width : '100') as any,
      description: dto.description ? this.cleanString(dto.description, '', 2000) : null,
      order: count,
      showInList: dto.showInList !== false,
      showInQuickEdit: Boolean(dto.showInQuickEdit),
    });
    return this.fieldDefs.save(field);
  }

  private normalizeOptions(
    options: Array<{ value: string; label: string }> | undefined,
    type: ProductFieldType,
  ): Array<{ value: string; label: string }> | null {
    if (!['select', 'multiselect', 'radio'].includes(type)) return null;
    if (!Array.isArray(options)) return [];
    return options
      .filter((o) => o && typeof o === 'object')
      .map((o) => ({
        value: this.cleanString((o as any).value, '', 200),
        label: this.cleanString((o as any).label, (o as any).value, 200),
      }))
      .filter((o) => o.value);
  }

  async updateFieldDef(
    tenantId: string,
    id: string,
    dto: {
      label?: string;
      required?: boolean;
      options?: Array<{ value: string; label: string }>;
      settings?: Record<string, unknown>;
      width?: string;
      description?: string;
      showInList?: boolean;
      showInQuickEdit?: boolean;
      isActive?: boolean;
    },
  ) {
    const field = await this.fieldDefs.findOne({ where: { tenantId, id } });
    if (!field) throw new NotFoundException('Поле не найдено');
    if (dto.label !== undefined) field.label = this.cleanString(dto.label, field.label, 200);
    if (dto.required !== undefined) field.required = Boolean(dto.required);
    if (dto.options !== undefined) field.options = this.normalizeOptions(dto.options, field.type);
    if (dto.settings !== undefined) {
      field.settings = dto.settings && typeof dto.settings === 'object' ? dto.settings : null;
    }
    if (dto.width !== undefined && ['25', '50', '75', '100'].includes(String(dto.width))) {
      field.width = dto.width as any;
    }
    if (dto.description !== undefined) {
      field.description = dto.description ? this.cleanString(dto.description, '', 2000) : null;
    }
    if (dto.showInList !== undefined) field.showInList = Boolean(dto.showInList);
    if (dto.showInQuickEdit !== undefined) field.showInQuickEdit = Boolean(dto.showInQuickEdit);
    if (dto.isActive !== undefined) field.isActive = Boolean(dto.isActive);
    return this.fieldDefs.save(field);
  }

  async deleteFieldDef(tenantId: string, id: string) {
    const field = await this.fieldDefs.findOne({ where: { tenantId, id } });
    if (!field) throw new NotFoundException('Поле не найдено');
    await this.fieldDefs.remove(field);
    return { ok: true };
  }

  async reorderFieldDefs(tenantId: string, orderedIds: string[]) {
    const fields = await this.fieldDefs.find({ where: { tenantId, id: In(orderedIds) } });
    const byId = new Map(fields.map((f) => [f.id, f]));
    const updates: ProductFieldDef[] = [];
    orderedIds.forEach((id, index) => {
      const field = byId.get(id);
      if (field && field.order !== index) {
        field.order = index;
        updates.push(field);
      }
    });
    if (updates.length) await this.fieldDefs.save(updates);
    return this.listFieldDefs(tenantId);
  }

  /**
   * Обязательность/типы/допустимые options — валидация кастомных полей товара по
   * product_field_defs. Аналог normalizeRecordValues() из custom-objects.service.ts.
   */
  async normalizeCustomFieldValues(
    tenantId: string,
    input: Record<string, unknown> | null | undefined,
  ): Promise<Record<string, unknown>> {
    const fields = await this.listFieldDefs(tenantId);
    const raw = input && typeof input === 'object' ? input : {};
    const out: Record<string, unknown> = {};
    for (const field of fields) {
      if (!field.isActive) continue;
      const value = (raw as Record<string, unknown>)[field.key];
      if (value == null || value === '') {
        if (field.required) {
          throw new BadRequestException(`Поле «${field.label}» обязательно`);
        }
        continue;
      }
      switch (field.type) {
        case 'number': {
          const n = Number(value);
          if (!Number.isFinite(n)) throw new BadRequestException(`Поле «${field.label}»: ожидалось число`);
          out[field.key] = n;
          break;
        }
        case 'boolean':
          out[field.key] = Boolean(value);
          break;
        case 'multiselect': {
          const arr = Array.isArray(value) ? value.map(String) : [String(value)];
          const allowed = new Set((field.options || []).map((o) => o.value));
          out[field.key] = arr.filter((v) => allowed.has(v));
          break;
        }
        case 'select':
        case 'radio': {
          const allowed = new Set((field.options || []).map((o) => o.value));
          const v = String(value);
          if (allowed.size && !allowed.has(v)) {
            throw new BadRequestException(`Поле «${field.label}»: недопустимое значение`);
          }
          out[field.key] = v;
          break;
        }
        case 'gallery':
          out[field.key] = Array.isArray(value) ? value : [value];
          break;
        default:
          out[field.key] = value;
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ attributes */

  async listAttributes(tenantId: string) {
    return this.attributes.find({ where: { tenantId }, order: { order: 'ASC', name: 'ASC' } });
  }

  async createAttribute(tenantId: string, dto: { name: string; slug?: string }) {
    const name = this.cleanString(dto.name, '', 120);
    if (!name) throw new BadRequestException('Название атрибута обязательно');
    const slug = await this.uniqueAttributeSlug(tenantId, dto.slug || name);
    const attribute = this.attributes.create({ tenantId, name, slug, values: [] });
    return this.attributes.save(attribute);
  }

  async updateAttribute(
    tenantId: string,
    id: string,
    dto: { name?: string; order?: number; isActive?: boolean },
  ) {
    const attribute = await this.attributes.findOne({ where: { tenantId, id } });
    if (!attribute) throw new NotFoundException('Атрибут не найден');
    if (dto.name !== undefined) attribute.name = this.cleanString(dto.name, attribute.name, 120);
    if (dto.order !== undefined) attribute.order = Number(dto.order) || 0;
    if (dto.isActive !== undefined) attribute.isActive = Boolean(dto.isActive);
    return this.attributes.save(attribute);
  }

  async deleteAttribute(tenantId: string, id: string) {
    const attribute = await this.attributes.findOne({ where: { tenantId, id } });
    if (!attribute) throw new NotFoundException('Атрибут не найден');
    await this.attributes.remove(attribute);
    return { ok: true };
  }

  async addAttributeValue(
    tenantId: string,
    id: string,
    dto: { value: string; label?: string; colorHex?: string },
  ) {
    const attribute = await this.attributes.findOne({ where: { tenantId, id } });
    if (!attribute) throw new NotFoundException('Атрибут не найден');
    const value = this.cleanString(dto.value, '', 120);
    if (!value) throw new BadRequestException('Значение обязательно');
    const entry: ProductAttributeValue = {
      id: `${this.slugify(value)}-${Math.random().toString(36).slice(2, 8)}`,
      value,
      label: this.cleanString(dto.label, value, 120),
      colorHex: dto.colorHex ? this.cleanString(dto.colorHex, '', 20) : undefined,
    };
    attribute.values = [...(attribute.values || []), entry];
    return this.attributes.save(attribute);
  }

  async removeAttributeValue(tenantId: string, id: string, valueId: string) {
    const attribute = await this.attributes.findOne({ where: { tenantId, id } });
    if (!attribute) throw new NotFoundException('Атрибут не найден');
    attribute.values = (attribute.values || []).filter((v) => v.id !== valueId);
    return this.attributes.save(attribute);
  }

  /* ------------------------------------------------------------------ products */

  async listProducts(tenantId: string, query: ProductListQuery) {
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const page = Math.max(1, Number(query.page) || 1);
    const qb = this.products
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.isDeleted = false');
    if (query.status && PRODUCT_STATUSES.includes(query.status as ProductStatus)) {
      qb.andWhere('p.status = :status', { status: query.status });
    }
    if (query.categoryId) qb.andWhere('p.categoryId = :categoryId', { categoryId: query.categoryId });
    if (query.isVariable !== undefined) qb.andWhere('p.isVariable = :isVariable', { isVariable: query.isVariable });
    if (query.search) {
      qb.andWhere('(p.name ILIKE :s OR p.sku ILIKE :s)', { s: `%${query.search}%` });
    }
    const sortable: Record<string, string> = {
      name: 'p.name',
      price: 'p.price',
      quantity: 'p.quantity',
      createdAt: 'p.createdAt',
    };
    const sortCol = sortable[query.sort || ''] || 'p.createdAt';
    qb.orderBy(sortCol, query.order === 'ASC' ? 'ASC' : 'DESC');
    qb.skip((page - 1) * limit).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async getProduct(tenantId: string, id: string) {
    const product = await this.products.findOne({ where: { tenantId, id, isDeleted: false } });
    if (!product) throw new NotFoundException('Товар не найден');
    const productVariants = product.isVariable
      ? await this.variants.find({ where: { tenantId, productId: id }, order: { createdAt: 'ASC' } })
      : [];
    return { product, variants: productVariants };
  }

  private async assertUniqueSku(tenantId: string, sku: string | null, excludeId?: string) {
    if (!sku) return;
    const where: FindOptionsWhere<Product> = { tenantId, sku };
    const existing = await this.products.findOne({ where });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException(`Товар с артикулом «${sku}» уже существует`);
    }
  }

  async createProduct(
    tenantId: string,
    dto: {
      name: string;
      sku?: string | null;
      description?: string | null;
      categoryId?: string | null;
      status?: string;
      price?: number;
      costPrice?: number | null;
      currency?: string;
      unit?: string | null;
      lowStockThreshold?: number | null;
      images?: ProductImage[];
      quantity?: number;
      isVariable?: boolean;
      variantAttributeIds?: string[];
      customFields?: Record<string, unknown>;
      externalId?: string | null;
    },
  ) {
    const name = this.cleanString(dto.name, '', 255);
    if (!name) throw new BadRequestException('Название товара обязательно');
    const sku = dto.sku ? this.cleanString(dto.sku, '', 64) : null;
    await this.assertUniqueSku(tenantId, sku);
    const customFields = await this.normalizeCustomFieldValues(tenantId, dto.customFields);
    const product = this.products.create({
      tenantId,
      name,
      sku,
      description: dto.description ? this.cleanString(dto.description, '', 8000) : null,
      categoryId: dto.categoryId || null,
      status: (PRODUCT_STATUSES.includes(dto.status as ProductStatus) ? dto.status : 'active') as ProductStatus,
      price: String(Number(dto.price) || 0),
      costPrice: dto.costPrice != null ? String(Number(dto.costPrice)) : null,
      currency: this.cleanString(dto.currency, 'EUR', 3).toUpperCase(),
      unit: dto.unit ? this.cleanString(dto.unit, '', 32) : null,
      lowStockThreshold: dto.lowStockThreshold != null ? Number(dto.lowStockThreshold) : null,
      images: Array.isArray(dto.images) ? dto.images : [],
      isVariable: Boolean(dto.isVariable),
      variantAttributeIds: Boolean(dto.isVariable) && Array.isArray(dto.variantAttributeIds)
        ? dto.variantAttributeIds
        : null,
      quantity: Boolean(dto.isVariable) ? 0 : Math.max(0, Number(dto.quantity) || 0),
      customFields,
      externalId: dto.externalId ? this.cleanString(dto.externalId, '', 255) : null,
    });
    const saved = await this.products.save(product);
    if (!saved.isVariable && saved.quantity > 0) {
      await this.recordStockMovement(tenantId, {
        productId: saved.id,
        variantId: null,
        type: 'in',
        quantityDelta: saved.quantity,
        reason: 'Начальный остаток при создании товара',
        userId: null,
        source: 'manual',
      });
    }
    return saved;
  }

  async updateProduct(
    tenantId: string,
    id: string,
    dto: Partial<{
      name: string;
      sku: string | null;
      description: string | null;
      categoryId: string | null;
      status: string;
      price: number;
      costPrice: number | null;
      currency: string;
      unit: string | null;
      lowStockThreshold: number | null;
      images: ProductImage[];
      isVariable: boolean;
      variantAttributeIds: string[];
      customFields: Record<string, unknown>;
      externalId: string | null;
    }>,
  ) {
    const product = await this.products.findOne({ where: { tenantId, id, isDeleted: false } });
    if (!product) throw new NotFoundException('Товар не найден');
    if (dto.name !== undefined) product.name = this.cleanString(dto.name, product.name, 255);
    if (dto.sku !== undefined) {
      const sku = dto.sku ? this.cleanString(dto.sku, '', 64) : null;
      await this.assertUniqueSku(tenantId, sku, id);
      product.sku = sku;
    }
    if (dto.description !== undefined) {
      product.description = dto.description ? this.cleanString(dto.description, '', 8000) : null;
    }
    if (dto.categoryId !== undefined) product.categoryId = dto.categoryId || null;
    if (dto.status !== undefined && PRODUCT_STATUSES.includes(dto.status as ProductStatus)) {
      product.status = dto.status as ProductStatus;
    }
    if (dto.price !== undefined) product.price = String(Number(dto.price) || 0);
    if (dto.costPrice !== undefined) {
      product.costPrice = dto.costPrice != null ? String(Number(dto.costPrice)) : null;
    }
    if (dto.currency !== undefined) product.currency = this.cleanString(dto.currency, product.currency, 3).toUpperCase();
    if (dto.unit !== undefined) product.unit = dto.unit ? this.cleanString(dto.unit, '', 32) : null;
    if (dto.lowStockThreshold !== undefined) {
      product.lowStockThreshold = dto.lowStockThreshold != null ? Number(dto.lowStockThreshold) : null;
    }
    if (dto.images !== undefined) product.images = Array.isArray(dto.images) ? dto.images : [];
    if (dto.isVariable !== undefined) product.isVariable = Boolean(dto.isVariable);
    if (dto.variantAttributeIds !== undefined) {
      product.variantAttributeIds = product.isVariable && Array.isArray(dto.variantAttributeIds)
        ? dto.variantAttributeIds
        : null;
    }
    if (dto.customFields !== undefined) {
      product.customFields = await this.normalizeCustomFieldValues(tenantId, dto.customFields);
    }
    if (dto.externalId !== undefined) {
      product.externalId = dto.externalId ? this.cleanString(dto.externalId, '', 255) : null;
    }
    return this.products.save(product);
  }

  async deleteProduct(tenantId: string, id: string) {
    const product = await this.products.findOne({ where: { tenantId, id, isDeleted: false } });
    if (!product) throw new NotFoundException('Товар не найден');
    product.isDeleted = true;
    await this.products.save(product);
    return { ok: true };
  }

  async duplicateProduct(tenantId: string, id: string) {
    const { product, variants: srcVariants } = await this.getProduct(tenantId, id);
    const copy = this.products.create({
      ...product,
      id: undefined,
      sku: null,
      name: `${product.name} (копия)`,
      externalId: null,
      quantity: product.isVariable ? 0 : 0,
      createdAt: undefined,
      updatedAt: undefined,
    });
    const saved = await this.products.save(copy);
    for (const v of srcVariants) {
      await this.variants.save(
        this.variants.create({
          tenantId,
          productId: saved.id,
          attributeValues: v.attributeValues,
          sku: null,
          quantity: 0,
          priceOverride: v.priceOverride,
          images: v.images,
          isActive: v.isActive,
        }),
      );
    }
    return this.getProduct(tenantId, saved.id);
  }

  /* ------------------------------------------------------------------ variants */

  private async recalcProductQuantity(tenantId: string, productId: string) {
    const activeVariants = await this.variants.find({
      where: { tenantId, productId, isActive: true },
    });
    const total = activeVariants.reduce((sum, v) => sum + (v.quantity || 0), 0);
    await this.products.update({ tenantId, id: productId }, { quantity: total });
  }

  async listVariants(tenantId: string, productId: string) {
    return this.variants.find({ where: { tenantId, productId }, order: { createdAt: 'ASC' } });
  }

  /** Декартово произведение значений выбранных атрибутов → недостающие ProductVariant. */
  async generateVariants(tenantId: string, productId: string, attributeIds: string[]) {
    const product = await this.products.findOne({ where: { tenantId, id: productId, isDeleted: false } });
    if (!product) throw new NotFoundException('Товар не найден');
    if (!Array.isArray(attributeIds) || !attributeIds.length) {
      throw new BadRequestException('Нужно выбрать хотя бы один атрибут');
    }
    const attrs = await this.attributes.find({ where: { tenantId, id: In(attributeIds) } });
    if (attrs.length !== attributeIds.length) {
      throw new BadRequestException('Один или несколько атрибутов не найдены');
    }
    let combos: ProductVariantAttributeValues[] = [{}];
    for (const attr of attrs) {
      const values = attr.values || [];
      if (!values.length) continue;
      const next: ProductVariantAttributeValues[] = [];
      for (const combo of combos) {
        for (const v of values) {
          next.push({ ...combo, [attr.id]: v.id });
        }
      }
      combos = next;
    }
    const existing = await this.variants.find({ where: { tenantId, productId } });
    const existingKeys = new Set(existing.map((v) => JSON.stringify(v.attributeValues)));
    const created: ProductVariant[] = [];
    for (const combo of combos) {
      const key = JSON.stringify(combo);
      if (existingKeys.has(key)) continue;
      created.push(
        this.variants.create({
          tenantId,
          productId,
          attributeValues: combo,
          sku: null,
          quantity: 0,
          priceOverride: null,
          images: null,
          isActive: true,
        }),
      );
    }
    if (created.length) await this.variants.save(created);
    product.isVariable = true;
    product.variantAttributeIds = attributeIds;
    await this.products.save(product);
    await this.recalcProductQuantity(tenantId, productId);
    return this.listVariants(tenantId, productId);
  }

  async updateVariant(
    tenantId: string,
    productId: string,
    variantId: string,
    dto: { sku?: string | null; priceOverride?: number | null; images?: ProductImage[] | null; isActive?: boolean },
  ) {
    const variant = await this.variants.findOne({ where: { tenantId, productId, id: variantId } });
    if (!variant) throw new NotFoundException('Вариант не найден');
    if (dto.sku !== undefined) {
      const sku = dto.sku ? this.cleanString(dto.sku, '', 64) : null;
      if (sku) {
        const clash = await this.variants.findOne({ where: { tenantId, sku } });
        if (clash && clash.id !== variantId) {
          throw new BadRequestException(`Вариант с артикулом «${sku}» уже существует`);
        }
      }
      variant.sku = sku;
    }
    if (dto.priceOverride !== undefined) {
      variant.priceOverride = dto.priceOverride != null ? String(Number(dto.priceOverride)) : null;
    }
    if (dto.images !== undefined) variant.images = dto.images;
    if (dto.isActive !== undefined) variant.isActive = Boolean(dto.isActive);
    const saved = await this.variants.save(variant);
    await this.recalcProductQuantity(tenantId, productId);
    return saved;
  }

  async deleteVariant(tenantId: string, productId: string, variantId: string) {
    const variant = await this.variants.findOne({ where: { tenantId, productId, id: variantId } });
    if (!variant) throw new NotFoundException('Вариант не найден');
    await this.variants.remove(variant);
    await this.recalcProductQuantity(tenantId, productId);
    return { ok: true };
  }

  /* ------------------------------------------------------------------ stock */

  private async recordStockMovement(
    tenantId: string,
    input: {
      productId: string;
      variantId: string | null;
      type: ProductStockMovementType;
      quantityDelta: number;
      reason?: string | null;
      userId?: string | null;
      source?: ProductStockMovementSource;
    },
  ) {
    let resultingQuantity: number;
    if (input.variantId) {
      const variant = await this.variants.findOne({ where: { tenantId, id: input.variantId } });
      if (!variant) throw new NotFoundException('Вариант не найден');
      resultingQuantity = Math.max(0, (variant.quantity || 0) + input.quantityDelta);
      variant.quantity = resultingQuantity;
      await this.variants.save(variant);
      await this.recalcProductQuantity(tenantId, input.productId);
    } else {
      const product = await this.products.findOne({ where: { tenantId, id: input.productId } });
      if (!product) throw new NotFoundException('Товар не найден');
      if (product.isVariable) {
        throw new BadRequestException('У вариативного товара остаток редактируется на уровне варианта');
      }
      resultingQuantity = Math.max(0, (product.quantity || 0) + input.quantityDelta);
      product.quantity = resultingQuantity;
      await this.products.save(product);
    }
    const movement = this.movements.create({
      tenantId,
      productId: input.productId,
      variantId: input.variantId,
      type: input.type,
      quantityDelta: input.quantityDelta,
      resultingQuantity,
      reason: input.reason ? this.cleanString(input.reason, '', 2000) : null,
      userId: input.userId || null,
      source: input.source || 'manual',
    });
    return this.movements.save(movement);
  }

  async adjustStock(
    tenantId: string,
    userId: string | null,
    input: {
      productId: string;
      variantId?: string | null;
      delta: number;
      reason?: string;
      source?: ProductStockMovementSource;
    },
  ) {
    const delta = Number(input.delta);
    if (!Number.isFinite(delta) || delta === 0) {
      throw new BadRequestException('Величина корректировки обязательна и не может быть нулём');
    }
    return this.recordStockMovement(tenantId, {
      productId: input.productId,
      variantId: input.variantId || null,
      type: delta > 0 ? 'in' : 'adjustment',
      quantityDelta: delta,
      reason: input.reason,
      userId,
      source: input.source || 'manual',
    });
  }

  /** Плоский список товар×вариант с остатками — данные для раздела «Склад». */
  async listStock(
    tenantId: string,
    query: { search?: string; categoryId?: string; lowStockOnly?: boolean },
  ) {
    const products = await this.products.find({
      where: { tenantId, isDeleted: false, ...(query.categoryId ? { categoryId: query.categoryId } : {}) },
      order: { name: 'ASC' },
    });
    const filtered = query.search
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(query.search!.toLowerCase()) ||
            (p.sku || '').toLowerCase().includes(query.search!.toLowerCase()),
        )
      : products;
    const variableIds = filtered.filter((p) => p.isVariable).map((p) => p.id);
    const allVariants = variableIds.length
      ? await this.variants.find({ where: { tenantId, productId: In(variableIds) } })
      : [];
    const variantsByProduct = new Map<string, ProductVariant[]>();
    for (const v of allVariants) {
      const arr = variantsByProduct.get(v.productId) || [];
      arr.push(v);
      variantsByProduct.set(v.productId, arr);
    }
    const attrIds = [...new Set(allVariants.flatMap((v) => Object.keys(v.attributeValues || {})))];
    const attrs = attrIds.length
      ? await this.attributes.find({ where: { tenantId, id: In(attrIds) } })
      : [];
    const attrById = new Map(attrs.map((a) => [a.id, a]));

    const describeVariant = (v: ProductVariant): string => {
      const parts = Object.entries(v.attributeValues || {}).map(([attrId, valueId]) => {
        const attr = attrById.get(attrId);
        const value = attr?.values.find((val) => val.id === valueId);
        return value?.label || value?.value || '?';
      });
      return parts.join(' / ') || '—';
    };

    const rows: Array<{
      productId: string;
      productName: string;
      sku: string | null;
      variantId: string | null;
      variantLabel: string | null;
      quantity: number;
      lowStockThreshold: number | null;
      isLow: boolean;
    }> = [];
    for (const p of filtered) {
      const productVariants = variantsByProduct.get(p.id) || [];
      if (p.isVariable && productVariants.length) {
        for (const v of productVariants) {
          rows.push({
            productId: p.id,
            productName: p.name,
            sku: v.sku,
            variantId: v.id,
            variantLabel: describeVariant(v),
            quantity: v.quantity,
            lowStockThreshold: p.lowStockThreshold,
            isLow: p.lowStockThreshold != null && v.quantity <= p.lowStockThreshold,
          });
        }
      } else {
        rows.push({
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          variantId: null,
          variantLabel: null,
          quantity: p.quantity,
          lowStockThreshold: p.lowStockThreshold,
          isLow: p.lowStockThreshold != null && p.quantity <= p.lowStockThreshold,
        });
      }
    }
    return query.lowStockOnly ? rows.filter((r) => r.isLow) : rows;
  }

  async listStockMovements(
    tenantId: string,
    query: { productId?: string; variantId?: string; limit?: number },
  ) {
    const where: FindOptionsWhere<ProductStockMovement> = { tenantId };
    if (query.productId) where.productId = query.productId;
    if (query.variantId) where.variantId = query.variantId;
    return this.movements.find({
      where,
      order: { createdAt: 'DESC' },
      take: Math.min(200, Math.max(1, Number(query.limit) || 50)),
    });
  }

  /* ------------------------------------------------------------------ import/export */

  async previewImport(
    tenantId: string,
    file: { buffer: Buffer; originalname?: string; mimetype?: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Нужен файл');
    const filename = (file.originalname || '').toLowerCase();
    let parsed: { columns: string[]; rows: Array<Record<string, any>> };
    if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      parsed = await parseXlsxRobust(file.buffer);
    } else {
      parsed = parseCsvRobust(file.buffer.toString('utf-8'));
    }
    if (!parsed.columns.length) {
      throw new BadRequestException(
        'Не удалось найти колонки — проверьте, что в первой строке есть заголовки.',
      );
    }
    const fieldDefs = await this.listFieldDefs(tenantId);
    const mappableFields = [
      ...IMPORT_STRUCTURAL_FIELDS,
      ...fieldDefs.filter((f) => f.isActive).map((f) => ({ key: f.key, label: f.label })),
    ];
    const suggestedMapping = buildSuggestedCustomObjectFieldMapping(parsed.columns, mappableFields);
    const session = await this.importSessions.save(
      this.importSessions.create({
        tenantId,
        originalFileName: file.originalname || null,
        columns: parsed.columns,
        rows: parsed.rows,
        sample: parsed.rows.slice(0, 20),
        totalRows: parsed.rows.length,
        suggestedMapping,
        status: 'preview',
      }),
    );
    return {
      importId: session.id,
      columns: session.columns,
      sample: session.sample,
      totalRows: session.totalRows,
      suggestedMapping,
      mappableFields,
    };
  }

  /**
   * Применение импорта: upsert по sku (приоритет) либо externalId. Товары, для которых не
   * нашлось совпадения, создаются заново; остаток меняется только через recordStockMovement,
   * а не прямым UPDATE — как и везде в этом сервисе.
   */
  async applyImport(
    tenantId: string,
    dto: {
      importId: string;
      mapping: Record<string, string | null>;
      updateExisting?: boolean;
    },
  ) {
    const session = await this.importSessions.findOne({ where: { id: dto.importId, tenantId } });
    if (!session) throw new NotFoundException('Сессия импорта не найдена');
    if (session.status === 'applied') {
      throw new BadRequestException('Этот файл уже был импортирован');
    }
    const mapping = dto.mapping || {};
    const fieldDefs = await this.listFieldDefs(tenantId);
    const categories = await this.listCategories(tenantId);
    const categoryByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]));
    const updateExisting = dto.updateExisting !== false;

    let created = 0;
    let updatedCount = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < session.rows.length; i++) {
      const row = session.rows[i];
      const get = (key: string): string => {
        const col = mapping[key];
        if (!col) return '';
        return String(row[col] ?? '').trim();
      };
      try {
        const name = get('name');
        if (!name) {
          errors.push({ row: i + 1, message: 'Не указано название товара' });
          continue;
        }
        const sku = get('sku') || null;
        const externalId = get('externalId') || null;

        const customFields: Record<string, unknown> = {};
        for (const field of fieldDefs) {
          const col = mapping[field.key];
          if (!col) continue;
          const raw = row[col];
          if (raw === undefined || raw === null || raw === '') continue;
          customFields[field.key] = raw;
        }

        let categoryId: string | null = null;
        const categoryName = get('category');
        if (categoryName) {
          const existing = categoryByName.get(categoryName.toLowerCase());
          if (existing) {
            categoryId = existing.id;
          } else {
            const createdCategory = await this.createCategory(tenantId, { name: categoryName });
            categoryByName.set(categoryName.toLowerCase(), createdCategory);
            categoryId = createdCategory.id;
          }
        }

        const priceRaw = get('price');
        const price = priceRaw ? Number(priceRaw.replace(',', '.')) : undefined;
        const costPriceRaw = get('costPrice');
        const costPrice = costPriceRaw ? Number(costPriceRaw.replace(',', '.')) : undefined;
        const quantityRaw = get('quantity');
        const status = get('status');
        const currency = get('currency');
        const unit = get('unit');
        const description = get('description');

        let existing: Product | null = null;
        if (sku) existing = await this.products.findOne({ where: { tenantId, sku, isDeleted: false } });
        if (!existing && externalId) {
          existing = await this.products.findOne({ where: { tenantId, externalId, isDeleted: false } });
        }

        if (existing) {
          if (!updateExisting) continue;
          await this.updateProduct(tenantId, existing.id, {
            name,
            description: description || undefined,
            categoryId: categoryId ?? undefined,
            status: status || undefined,
            price,
            costPrice,
            currency: currency || undefined,
            unit: unit || undefined,
            customFields: Object.keys(customFields).length ? customFields : undefined,
            externalId: externalId ?? undefined,
          });
          if (quantityRaw && !existing.isVariable) {
            const delta = Number(quantityRaw) - existing.quantity;
            if (Number.isFinite(delta) && delta !== 0) {
              await this.recordStockMovement(tenantId, {
                productId: existing.id,
                variantId: null,
                type: delta > 0 ? 'in' : 'adjustment',
                quantityDelta: delta,
                reason: 'Импорт из файла',
                userId: null,
                source: 'import',
              });
            }
          }
          updatedCount++;
        } else {
          await this.createProduct(tenantId, {
            name,
            sku,
            description: description || null,
            categoryId,
            status: status || undefined,
            price: price ?? 0,
            costPrice: costPrice ?? null,
            currency: currency || undefined,
            unit: unit || null,
            quantity: quantityRaw ? Number(quantityRaw) : 0,
            customFields,
            externalId,
          });
          created++;
        }
      } catch (err: any) {
        errors.push({ row: i + 1, message: err?.message || 'Неизвестная ошибка' });
      }
    }

    session.status = 'applied';
    await this.importSessions.save(session);

    return { created, updated: updatedCount, errors, total: session.rows.length };
  }

  /**
   * Экспорт: xlsx (по умолчанию) или csv. Для вариативных товаров — одна строка на вариант,
   * колонки = структурные поля + активные product_field_defs.
   */
  async exportProducts(
    tenantId: string,
    query: { format?: 'xlsx' | 'csv'; status?: string; categoryId?: string },
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const format = query.format === 'csv' ? 'csv' : 'xlsx';
    const { items } = await this.listProducts(tenantId, {
      status: query.status,
      categoryId: query.categoryId,
      limit: 100000,
      page: 1,
    });
    const categories = await this.listCategories(tenantId);
    const categoryById = new Map(categories.map((c) => [c.id, c.name]));
    const fieldDefs = (await this.listFieldDefs(tenantId)).filter((f) => f.isActive);

    const productIds = items.map((p) => p.id);
    const allVariants = productIds.length
      ? await this.variants.find({ where: { tenantId, productId: In(productIds) } })
      : [];
    const variantsByProduct = new Map<string, ProductVariant[]>();
    for (const v of allVariants) {
      const arr = variantsByProduct.get(v.productId) || [];
      arr.push(v);
      variantsByProduct.set(v.productId, arr);
    }
    const attrIds = [...new Set(allVariants.flatMap((v) => Object.keys(v.attributeValues || {})))];
    const attrs = attrIds.length
      ? await this.attributes.find({ where: { tenantId, id: In(attrIds) } })
      : [];
    const attrById = new Map(attrs.map((a) => [a.id, a]));
    const describeVariant = (v: ProductVariant): string => {
      const parts = Object.entries(v.attributeValues || {}).map(([attrId, valueId]) => {
        const attr = attrById.get(attrId);
        const value = attr?.values.find((val) => val.id === valueId);
        return value?.label || value?.value || '?';
      });
      return parts.join(' / ');
    };

    const headers = [
      'Артикул',
      'Название',
      'Описание',
      'Категория',
      'Статус',
      'Цена',
      'Себестоимость',
      'Валюта',
      'Количество',
      'Единица измерения',
      'Вариант',
      'Внешний ID',
      ...fieldDefs.map((f) => f.label),
    ];

    const rows: string[][] = [];
    for (const p of items) {
      const productVariants = variantsByProduct.get(p.id) || [];
      const customCells = fieldDefs.map((f) => {
        const v = p.customFields?.[f.key];
        if (v == null) return '';
        return Array.isArray(v) ? v.join(', ') : String(v);
      });
      if (p.isVariable && productVariants.length) {
        for (const v of productVariants) {
          rows.push([
            v.sku || '',
            p.name,
            p.description || '',
            p.categoryId ? categoryById.get(p.categoryId) || '' : '',
            p.status,
            String(v.priceOverride ?? p.price),
            p.costPrice ?? '',
            p.currency,
            String(v.quantity),
            p.unit || '',
            describeVariant(v),
            p.externalId || '',
            ...customCells,
          ]);
        }
      } else {
        rows.push([
          p.sku || '',
          p.name,
          p.description || '',
          p.categoryId ? categoryById.get(p.categoryId) || '' : '',
          p.status,
          String(p.price),
          p.costPrice ?? '',
          p.currency,
          String(p.quantity),
          p.unit || '',
          '',
          p.externalId || '',
          ...customCells,
        ]);
      }
    }

    if (format === 'csv') {
      const escapeCell = (cell: string) => {
        if (/[",;\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
        return cell;
      };
      const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(';'));
      return {
        buffer: Buffer.from('﻿' + lines.join('\n'), 'utf-8'),
        filename: `products-${Date.now()}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Товары');
    sheet.addRow(headers);
    for (const row of rows) sheet.addRow(row);
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((col) => {
      col.width = 22;
    });
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      filename: `products-${Date.now()}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /* ------------------------------------------------------------------ public API */

  async listPublicProducts(tenantId: string) {
    const { items } = await this.listProducts(tenantId, { status: 'active', limit: 1000, page: 1 });
    const productIds = items.map((p) => p.id);
    const allVariants = productIds.length
      ? await this.variants.find({ where: { tenantId, productId: In(productIds), isActive: true } })
      : [];
    const variantsByProduct = new Map<string, ProductVariant[]>();
    for (const v of allVariants) {
      const arr = variantsByProduct.get(v.productId) || [];
      arr.push(v);
      variantsByProduct.set(v.productId, arr);
    }
    return items.map((p) => ({
      ...p,
      variants: p.isVariable ? variantsByProduct.get(p.id) || [] : undefined,
    }));
  }

  async getPublicProduct(tenantId: string, externalIdOrSku: string) {
    const product =
      (await this.products.findOne({
        where: { tenantId, sku: externalIdOrSku, isDeleted: false },
      })) ||
      (await this.products.findOne({
        where: { tenantId, externalId: externalIdOrSku, isDeleted: false },
      }));
    if (!product) throw new NotFoundException('Товар не найден');
    return this.getProduct(tenantId, product.id);
  }

  /**
   * Апсерт товара с внешнего сайта по sku/externalId (и его вариантов, если переданы).
   * Идемпотентность как у custom-objects ingest: idempotencyKey просто сохраняется в записи,
   * реальная дедупликация обеспечивается апсертом по sku/externalId.
   */
  async ingestPublicProduct(
    tenantId: string,
    body: any,
    idempotencyKey?: string,
  ): Promise<{ ok: true; productId: string; created: boolean }> {
    const sku = body?.sku ? this.cleanString(body.sku, '', 64) : null;
    const externalId = body?.externalId ? this.cleanString(body.externalId, '', 255) : null;
    if (!sku && !externalId) {
      throw new BadRequestException('Нужен sku или externalId для сопоставления товара');
    }
    let existing: Product | null = null;
    if (sku) existing = await this.products.findOne({ where: { tenantId, sku, isDeleted: false } });
    if (!existing && externalId) {
      existing = await this.products.findOne({ where: { tenantId, externalId, isDeleted: false } });
    }

    const patch = {
      name: body?.name,
      description: body?.description,
      categoryId: body?.categoryId,
      status: body?.status,
      price: body?.price,
      costPrice: body?.costPrice,
      currency: body?.currency,
      unit: body?.unit,
      lowStockThreshold: body?.lowStockThreshold,
      images: body?.images,
      customFields: body?.customFields,
      externalId: externalId ?? undefined,
    };

    let product: Product;
    let created = false;
    if (existing) {
      product = await this.updateProduct(tenantId, existing.id, patch);
    } else {
      product = await this.createProduct(tenantId, {
        ...patch,
        name: this.cleanString(body?.name, sku || externalId || 'Товар', 255),
        sku,
        externalId,
        quantity: body?.quantity != null ? Number(body.quantity) : 0,
      });
      created = true;
    }

    if (Array.isArray(body?.variants)) {
      for (const v of body.variants) {
        const variantSku = v?.sku ? this.cleanString(v.sku, '', 64) : null;
        if (!variantSku) continue;
        const existingVariant = await this.variants.findOne({
          where: { tenantId, sku: variantSku },
        });
        if (existingVariant) {
          if (v.priceOverride !== undefined) {
            existingVariant.priceOverride =
              v.priceOverride != null ? String(Number(v.priceOverride)) : null;
            await this.variants.save(existingVariant);
          }
          if (v.quantity !== undefined) {
            const delta = Number(v.quantity) - existingVariant.quantity;
            if (Number.isFinite(delta) && delta !== 0) {
              await this.recordStockMovement(tenantId, {
                productId: product.id,
                variantId: existingVariant.id,
                type: delta > 0 ? 'in' : 'adjustment',
                quantityDelta: delta,
                reason: `Импорт с внешнего сайта${idempotencyKey ? ` (${idempotencyKey})` : ''}`,
                userId: null,
                source: 'public_api',
              });
            }
          }
        }
      }
    }

    return { ok: true, productId: product.id, created };
  }

  /** Точечное обновление остатка по sku товара/варианта — для «заказ оформлен → списать N». */
  async adjustStockPublic(
    tenantId: string,
    body: { sku?: string; variantSku?: string; delta?: number; absolute?: number },
  ) {
    const sku = body.variantSku || body.sku;
    if (!sku) throw new BadRequestException('Нужен sku или variantSku');

    let productId: string;
    let variantId: string | null = null;
    let currentQuantity: number;

    if (body.variantSku) {
      const variant = await this.variants.findOne({ where: { tenantId, sku: body.variantSku } });
      if (!variant) throw new NotFoundException('Вариант с таким SKU не найден');
      productId = variant.productId;
      variantId = variant.id;
      currentQuantity = variant.quantity;
    } else {
      const product = await this.products.findOne({
        where: { tenantId, sku: body.sku, isDeleted: false },
      });
      if (!product) throw new NotFoundException('Товар с таким SKU не найден');
      productId = product.id;
      currentQuantity = product.quantity;
    }

    let delta: number;
    if (body.absolute !== undefined) {
      delta = Number(body.absolute) - currentQuantity;
    } else if (body.delta !== undefined) {
      delta = Number(body.delta);
    } else {
      throw new BadRequestException('Нужен delta или absolute');
    }
    if (!Number.isFinite(delta) || delta === 0) {
      return { ok: true, unchanged: true };
    }

    await this.recordStockMovement(tenantId, {
      productId,
      variantId,
      type: delta > 0 ? 'in' : 'adjustment',
      quantityDelta: delta,
      reason: 'Обновление остатка с внешнего сайта',
      userId: null,
      source: 'public_api',
    });
    return { ok: true };
  }
}
