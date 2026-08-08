import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, IsNull, Not, Repository } from 'typeorm';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import {
  Product,
  type ProductBundleItem,
  type ProductDimensions,
  type ProductImage,
  type ProductPriceInCurrency,
  type ProductPriceTier,
  type ProductStatus,
  type ProductTranslation,
} from './product.entity';
import { ProductCategory } from './product-category.entity';
import { ProductFieldDef, type ProductFieldType, type ProductRepeaterRow } from './product-field-def.entity';
import { ProductAttribute, type ProductAttributeValue } from './product-attribute.entity';
import { ProductVariant, type ProductVariantAttributeValues } from './product-variant.entity';
import {
  ProductStockMovement,
  type ProductStockMovementSource,
  type ProductStockMovementType,
} from './product-stock-movement.entity';
import { ProductImportSession } from './product-import-session.entity';
import { ProductChangeLog } from './product-change-log.entity';
import { ProductLocation } from './product-location.entity';
import { ProductLocationStock } from './product-location-stock.entity';
import { ProductWebhooksService } from './product-webhooks.service';
import { StaffUser } from '../staff/staff-user.entity';
import { User } from '../users/user.entity';
import { Tenant } from '../tenants/tenant.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { SitesService } from '../sites/sites.service';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';
import type { Site } from '../sites/site.entity';
import {
  buildSuggestedCustomObjectFieldMapping,
  parseCsvRobust,
  parseXlsxRobust,
} from '../lib/import-spreadsheet.util';
import { resolveUnicodePdfFont } from '../common/pdf-font.util';

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
  { key: 'barcode', label: 'Штрихкод' },
  { key: 'tags', label: 'Теги' },
  { key: 'weight', label: 'Вес' },
  { key: 'dimensionsLength', label: 'Длина' },
  { key: 'dimensionsWidth', label: 'Ширина' },
  { key: 'dimensionsHeight', label: 'Высота' },
  { key: 'slug', label: 'Slug (URL)' },
  { key: 'metaTitle', label: 'SEO: заголовок' },
  { key: 'metaDescription', label: 'SEO: описание' },
  { key: 'prices', label: 'Цены в валютах' },
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
  'wysiwyg',
  'colorpicker',
  'relation',
  'repeater',
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
    @InjectRepository(ProductChangeLog)
    private readonly changeLogs: Repository<ProductChangeLog>,
    @InjectRepository(ProductLocation)
    private readonly locations: Repository<ProductLocation>,
    @InjectRepository(ProductLocationStock)
    private readonly locationStock: Repository<ProductLocationStock>,
    @InjectRepository(StaffUser)
    private readonly staffUsers: Repository<StaffUser>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    private readonly notifications: NotificationsService,
    private readonly sites: SitesService,
    private readonly webhooksDispatcher: ProductWebhooksService,
    private readonly automationsService: AutomationsService,
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

  /** Категории с подсчётом активных товаров — для дерева категорий и KPI. */
  async listCategoriesWithCounts(tenantId: string) {
    const [categories, counts] = await Promise.all([
      this.listCategories(tenantId),
      this.products
        .createQueryBuilder('p')
        .select('p.categoryId', 'categoryId')
        .addSelect('COUNT(*)', 'count')
        .where('p.tenantId = :tenantId', { tenantId })
        .andWhere('p.isDeleted = false')
        .groupBy('p.categoryId')
        .getRawMany<{ categoryId: string | null; count: string }>(),
    ]);
    const countByCategory = new Map(counts.map((c) => [c.categoryId, Number(c.count)]));
    const uncategorizedCount = countByCategory.get(null as unknown as string) || 0;
    return {
      categories: categories.map((c) => ({ ...c, productCount: countByCategory.get(c.id) || 0 })),
      uncategorizedCount,
    };
  }

  private normalizeColor(value: unknown, fallback = '#222222'): string {
    const raw = this.cleanString(value, '', 20);
    return /^#[0-9a-fA-F]{3,8}$/.test(raw) ? raw : fallback;
  }

  async createCategory(
    tenantId: string,
    dto: { name: string; slug?: string; order?: number; parentId?: string | null; color?: string },
  ) {
    const name = this.cleanString(dto.name, '', 160);
    if (!name) throw new BadRequestException('Название категории обязательно');
    const slug = await this.uniqueCategorySlug(tenantId, dto.slug || name);
    let parentId: string | null = null;
    if (dto.parentId) {
      const parent = await this.categories.findOne({ where: { tenantId, id: dto.parentId } });
      if (!parent) throw new BadRequestException('Родительская категория не найдена');
      parentId = parent.id;
    }
    const category = this.categories.create({
      tenantId,
      name,
      slug,
      parentId,
      color: this.normalizeColor(dto.color),
      order: Number.isFinite(Number(dto.order)) ? Number(dto.order) : 0,
    });
    return this.categories.save(category);
  }

  async updateCategory(
    tenantId: string,
    id: string,
    dto: {
      name?: string;
      slug?: string;
      order?: number;
      isActive?: boolean;
      parentId?: string | null;
      color?: string;
    },
  ) {
    const category = await this.categories.findOne({ where: { tenantId, id } });
    if (!category) throw new NotFoundException('Категория не найдена');
    if (dto.name !== undefined) category.name = this.cleanString(dto.name, category.name, 160);
    if (dto.slug !== undefined) {
      category.slug = await this.uniqueCategorySlug(tenantId, dto.slug, category.id);
    }
    if (dto.parentId !== undefined) {
      if (!dto.parentId) {
        category.parentId = null;
      } else {
        if (dto.parentId === id) {
          throw new BadRequestException('Категория не может быть родителем самой себя');
        }
        const parent = await this.categories.findOne({ where: { tenantId, id: dto.parentId } });
        if (!parent) throw new BadRequestException('Родительская категория не найдена');
        category.parentId = parent.id;
      }
    }
    if (dto.color !== undefined) category.color = this.normalizeColor(dto.color, category.color);
    if (dto.order !== undefined) category.order = Number(dto.order) || 0;
    if (dto.isActive !== undefined) category.isActive = Boolean(dto.isActive);
    return this.categories.save(category);
  }

  async deleteCategory(tenantId: string, id: string) {
    const category = await this.categories.findOne({ where: { tenantId, id } });
    if (!category) throw new NotFoundException('Категория не найдена');
    await this.products.update({ tenantId, categoryId: id }, { categoryId: null });
    await this.categories.update({ tenantId, parentId: id }, { parentId: null });
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
      group?: string;
      required?: boolean;
      options?: Array<{ value: string; label: string }>;
      settings?: Record<string, unknown>;
      width?: string;
      description?: string;
      showInList?: boolean;
      showInQuickEdit?: boolean;
      showInFilters?: boolean;
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
      group: dto.group ? this.cleanString(dto.group, '', 120) : null,
      required: Boolean(dto.required),
      options: this.normalizeOptions(dto.options, type),
      settings: dto.settings && typeof dto.settings === 'object' ? dto.settings : null,
      width: (['25', '50', '75', '100'].includes(String(dto.width)) ? dto.width : '100') as any,
      description: dto.description ? this.cleanString(dto.description, '', 2000) : null,
      order: count,
      showInList: dto.showInList !== false,
      showInQuickEdit: Boolean(dto.showInQuickEdit),
      showInFilters: Boolean(dto.showInFilters),
    });
    return this.fieldDefs.save(field);
  }

  /** Список уникальных названий групп полей (для UI-подсказок при создании новой группы). */
  async listFieldGroups(tenantId: string): Promise<string[]> {
    const fields = await this.listFieldDefs(tenantId);
    return [...new Set(fields.map((f) => f.group).filter((g): g is string => !!g))];
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
      type?: string;
      group?: string | null;
      required?: boolean;
      options?: Array<{ value: string; label: string }>;
      settings?: Record<string, unknown>;
      width?: string;
      description?: string;
      showInList?: boolean;
      showInQuickEdit?: boolean;
      showInFilters?: boolean;
      isActive?: boolean;
    },
  ) {
    const field = await this.fieldDefs.findOne({ where: { tenantId, id } });
    if (!field) throw new NotFoundException('Поле не найдено');
    if (dto.label !== undefined) field.label = this.cleanString(dto.label, field.label, 200);
    if (dto.type !== undefined && PRODUCT_FIELD_TYPES.includes(dto.type as ProductFieldType)) {
      field.type = dto.type as ProductFieldType;
    }
    if (dto.group !== undefined) field.group = dto.group ? this.cleanString(dto.group, '', 120) : null;
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
    if (dto.showInFilters !== undefined) field.showInFilters = Boolean(dto.showInFilters);
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
        case 'media': {
          const img = this.normalizeImageValue(value);
          if (!img && field.required) {
            throw new BadRequestException(`Поле «${field.label}» обязательно`);
          }
          if (img) out[field.key] = img;
          break;
        }
        case 'gallery': {
          const arr = (Array.isArray(value) ? value : [value])
            .map((v) => this.normalizeImageValue(v))
            .filter((v): v is ProductImage => !!v);
          out[field.key] = arr;
          break;
        }
        case 'wysiwyg':
          out[field.key] = String(value);
          break;
        case 'colorpicker': {
          const hex = this.cleanString(value, '', 20);
          if (!/^#[0-9a-fA-F]{3,8}$/.test(hex)) {
            throw new BadRequestException(`Поле «${field.label}»: ожидался цвет в формате HEX`);
          }
          out[field.key] = hex;
          break;
        }
        case 'relation': {
          const multiple = Boolean((field.settings as any)?.multiple);
          const ids = (Array.isArray(value) ? value : [value]).map((v) => this.cleanString(v, '', 64)).filter(Boolean);
          out[field.key] = multiple ? ids : ids[0] || null;
          break;
        }
        case 'repeater': {
          const subFields = Array.isArray((field.settings as any)?.subFields)
            ? ((field.settings as any).subFields as Array<{ key: string; type?: string }>)
            : [];
          const subKeys = new Set(subFields.map((s) => s.key));
          const rows = Array.isArray(value) ? value : [];
          out[field.key] = rows
            .filter((row) => row && typeof row === 'object')
            .map((row) => {
              const clean: ProductRepeaterRow = {};
              for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
                if (subKeys.size && !subKeys.has(k)) continue;
                if (v == null || v === '') continue;
                const subField = subFields.find((s) => s.key === k);
                clean[k] = subField?.type === 'number' ? Number(v) : String(v);
              }
              return clean;
            });
          break;
        }
        default:
          out[field.key] = value;
      }
    }
    return out;
  }

  /** Приводит значение поля типа media/gallery к { url } — принимает объект {url}, строку-URL или null. */
  private normalizeImageValue(value: unknown): ProductImage | null {
    if (!value) return null;
    if (typeof value === 'string') {
      const url = value.trim();
      return url ? { url } : null;
    }
    if (typeof value === 'object' && typeof (value as any).url === 'string') {
      const url = String((value as any).url).trim();
      return url ? { url } : null;
    }
    return null;
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
    // Без этой проверки удаление атрибута оставляло бы варианты товара со ссылкой на
    // несуществующий attributeId — describeVariant() на фронтенде рисовал бы "?" вместо
    // названия атрибута, без возможности исправить это иначе как удалением/пересозданием
    // варианта. См. lumiva_products_module_roadmap.md — та же категория бага, что и с
    // генерацией вариантов у пустого атрибута.
    // ВАЖНО: join на products с фильтром isDeleted=false — deleteProduct() мягкий (isDeleted),
    // варианты удалённых товаров никуда не деваются из БД; без этого фильтра атрибут навсегда
    // "завис" бы как используемый после удаления единственного товара, который на него ссылался.
    const inUse = await this.variants
      .createQueryBuilder('v')
      .innerJoin(Product, 'p', 'p.id = v.productId')
      .where('v.tenantId = :tenantId', { tenantId })
      .andWhere('p.isDeleted = false')
      .andWhere('jsonb_exists(v.attributeValues, :attrId)', { attrId: id })
      .getCount();
    if (inUse > 0) {
      throw new BadRequestException(
        `Атрибут «${attribute.name}» используется в вариантах товара — сначала удалите эти варианты или уберите атрибут из вариаций товара`,
      );
    }
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
    const inUse = await this.variants
      .createQueryBuilder('v')
      .innerJoin(Product, 'p', 'p.id = v.productId')
      .where('v.tenantId = :tenantId', { tenantId })
      .andWhere('p.isDeleted = false')
      .andWhere('v.attributeValues ->> :attrId = :valueId', { attrId: id, valueId })
      .getCount();
    if (inUse > 0) {
      throw new BadRequestException(
        'Это значение используется в вариантах товара — сначала удалите эти варианты или смените их атрибуты',
      );
    }
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

  private async assertUniqueBarcode(tenantId: string, barcode: string | null, excludeId?: string) {
    if (!barcode) return;
    const existing = await this.products.findOne({ where: { tenantId, barcode } });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException(`Товар со штрихкодом «${barcode}» уже существует`);
    }
  }

  private async uniqueProductSlug(tenantId: string, base: string, excludeId?: string): Promise<string> {
    let candidate = this.slugify(base);
    let i = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const found = await this.products.findOne({ where: { tenantId, slug: candidate } });
      if (!found || found.id === excludeId) return candidate;
      candidate = `${this.slugify(base)}-${i++}`;
    }
  }

  private normalizeDimensions(value: unknown): ProductDimensions | null {
    if (!value || typeof value !== 'object') return null;
    const v = value as Record<string, unknown>;
    const num = (x: unknown) => (x != null && Number.isFinite(Number(x)) ? Number(x) : undefined);
    const dims: ProductDimensions = {
      length: num(v.length),
      width: num(v.width),
      height: num(v.height),
      unit: v.unit === 'in' ? 'in' : 'cm',
    };
    if (dims.length == null && dims.width == null && dims.height == null) return null;
    return dims;
  }

  private normalizePriceTiers(value: unknown): ProductPriceTier[] | null {
    if (!Array.isArray(value)) return null;
    const tiers = value
      .map((t) => {
        const minQty = Number((t as any)?.minQty);
        const price = Number((t as any)?.price);
        if (!Number.isFinite(minQty) || minQty <= 0 || !Number.isFinite(price) || price < 0) return null;
        return { minQty, price };
      })
      .filter((t): t is ProductPriceTier => !!t)
      .sort((a, b) => a.minQty - b.minQty);
    return tiers.length ? tiers : null;
  }

  /** Мультивалютные override-цены — `{currency, price}[]`, уникальные валюты, только >=0. */
  private normalizePrices(value: unknown): ProductPriceInCurrency[] | null {
    if (!Array.isArray(value)) return null;
    const byCurrency = new Map<string, number>();
    for (const p of value) {
      const currency = this.cleanString((p as any)?.currency, '', 3).toUpperCase();
      const price = Number((p as any)?.price);
      if (!currency || currency.length !== 3 || !Number.isFinite(price) || price < 0) continue;
      byCurrency.set(currency, price);
    }
    if (!byCurrency.size) return null;
    return [...byCurrency.entries()].map(([currency, price]) => ({ currency, price }));
  }

  /** `null` — товар виден на всех сайтах тенанта; иначе — только на перечисленных `Site.id`. */
  private async normalizeSiteIds(tenantId: string, value: unknown): Promise<string[] | null> {
    if (!Array.isArray(value) || !value.length) return null;
    const requested = new Set(value.filter((v): v is string => typeof v === 'string' && !!v));
    if (!requested.size) return null;
    const tenantSites = await this.sites.findAllForTenant(tenantId);
    const validIds = new Set(tenantSites.map((s) => s.id));
    const filtered = [...requested].filter((id) => validIds.has(id));
    return filtered.length ? filtered : null;
  }

  private normalizeBundleItems(value: unknown): ProductBundleItem[] | null {
    if (!Array.isArray(value)) return null;
    const items = value
      .map((b) => {
        const productId = this.cleanString((b as any)?.productId, '', 64);
        const quantity = Number((b as any)?.quantity);
        if (!productId || !Number.isFinite(quantity) || quantity <= 0) return null;
        return { productId, quantity };
      })
      .filter((b): b is ProductBundleItem => !!b);
    return items.length ? items : null;
  }

  private normalizeTranslations(value: unknown): Record<string, ProductTranslation> | null {
    if (!value || typeof value !== 'object') return null;
    const out: Record<string, ProductTranslation> = {};
    for (const [locale, t] of Object.entries(value as Record<string, unknown>)) {
      if (!t || typeof t !== 'object') continue;
      const tt = t as Record<string, unknown>;
      const entry: ProductTranslation = {};
      if (tt.name) entry.name = this.cleanString(tt.name, '', 255);
      if (tt.description) entry.description = this.cleanString(tt.description, '', 8000);
      if (tt.metaTitle) entry.metaTitle = this.cleanString(tt.metaTitle, '', 255);
      if (tt.metaDescription) entry.metaDescription = this.cleanString(tt.metaDescription, '', 500);
      if (Object.keys(entry).length) out[locale.slice(0, 8)] = entry;
    }
    return Object.keys(out).length ? out : null;
  }

  private async writeChangeLog(
    tenantId: string,
    productId: string,
    userId: string | null,
    changes: Array<{ field: string; oldValue: unknown; newValue: unknown }>,
  ) {
    const rows = changes
      .filter((c) => String(c.oldValue ?? '') !== String(c.newValue ?? ''))
      .map((c) =>
        this.changeLogs.create({
          tenantId,
          productId,
          field: c.field,
          oldValue: c.oldValue == null ? null : String(c.oldValue),
          newValue: c.newValue == null ? null : String(c.newValue),
          userId,
        }),
      );
    if (rows.length) await this.changeLogs.save(rows);
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
      slug?: string | null;
      metaTitle?: string | null;
      metaDescription?: string | null;
      weight?: number | null;
      dimensions?: unknown;
      barcode?: string | null;
      tags?: string[];
      relatedProductIds?: string[];
      translations?: unknown;
      salePrice?: number | null;
      saleStartAt?: string | null;
      saleEndAt?: string | null;
      priceTiers?: unknown;
      isBundle?: boolean;
      bundleItems?: unknown;
      prices?: unknown;
      siteIds?: string[];
    },
  ) {
    const name = this.cleanString(dto.name, '', 255);
    if (!name) throw new BadRequestException('Название товара обязательно');
    const sku = dto.sku ? this.cleanString(dto.sku, '', 64) : null;
    await this.assertUniqueSku(tenantId, sku);
    const barcode = dto.barcode ? this.cleanString(dto.barcode, '', 64) : null;
    await this.assertUniqueBarcode(tenantId, barcode);
    const slug = await this.uniqueProductSlug(tenantId, dto.slug || name);
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
      slug,
      metaTitle: dto.metaTitle ? this.cleanString(dto.metaTitle, '', 255) : null,
      metaDescription: dto.metaDescription ? this.cleanString(dto.metaDescription, '', 500) : null,
      weight: dto.weight != null ? String(Number(dto.weight)) : null,
      dimensions: this.normalizeDimensions(dto.dimensions),
      barcode,
      tags: Array.isArray(dto.tags) ? dto.tags.map((t) => this.cleanString(t, '', 60)).filter(Boolean) : [],
      relatedProductIds: Array.isArray(dto.relatedProductIds) ? dto.relatedProductIds.filter(Boolean) : null,
      translations: this.normalizeTranslations(dto.translations),
      salePrice: dto.salePrice != null ? String(Number(dto.salePrice)) : null,
      saleStartAt: dto.saleStartAt ? new Date(dto.saleStartAt) : null,
      saleEndAt: dto.saleEndAt ? new Date(dto.saleEndAt) : null,
      priceTiers: this.normalizePriceTiers(dto.priceTiers),
      isBundle: Boolean(dto.isBundle),
      bundleItems: Boolean(dto.isBundle) ? this.normalizeBundleItems(dto.bundleItems) : null,
      prices: this.normalizePrices(dto.prices),
      siteIds: await this.normalizeSiteIds(tenantId, dto.siteIds),
    });
    const saved = await this.products.save(product);
    this.webhooksDispatcher.dispatch(tenantId, 'product.created', { productId: saved.id, sku: saved.sku, name: saved.name }).catch(() => {});
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
      slug: string | null;
      metaTitle: string | null;
      metaDescription: string | null;
      weight: number | null;
      dimensions: unknown;
      barcode: string | null;
      tags: string[];
      relatedProductIds: string[];
      translations: unknown;
      salePrice: number | null;
      saleStartAt: string | null;
      saleEndAt: string | null;
      priceTiers: unknown;
      isBundle: boolean;
      bundleItems: unknown;
      prices: unknown;
      siteIds: string[];
    }>,
    userId: string | null = null,
  ) {
    const product = await this.products.findOne({ where: { tenantId, id, isDeleted: false } });
    if (!product) throw new NotFoundException('Товар не найден');

    const before = {
      price: product.price,
      costPrice: product.costPrice,
      status: product.status,
      sku: product.sku,
      barcode: product.barcode,
    };

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
    if (dto.slug !== undefined) {
      product.slug = await this.uniqueProductSlug(tenantId, dto.slug || product.name, id);
    }
    if (dto.metaTitle !== undefined) {
      product.metaTitle = dto.metaTitle ? this.cleanString(dto.metaTitle, '', 255) : null;
    }
    if (dto.metaDescription !== undefined) {
      product.metaDescription = dto.metaDescription ? this.cleanString(dto.metaDescription, '', 500) : null;
    }
    if (dto.weight !== undefined) {
      product.weight = dto.weight != null ? String(Number(dto.weight)) : null;
    }
    if (dto.dimensions !== undefined) product.dimensions = this.normalizeDimensions(dto.dimensions);
    if (dto.barcode !== undefined) {
      const barcode = dto.barcode ? this.cleanString(dto.barcode, '', 64) : null;
      await this.assertUniqueBarcode(tenantId, barcode, id);
      product.barcode = barcode;
    }
    if (dto.tags !== undefined) {
      product.tags = Array.isArray(dto.tags) ? dto.tags.map((t) => this.cleanString(t, '', 60)).filter(Boolean) : [];
    }
    if (dto.relatedProductIds !== undefined) {
      product.relatedProductIds = Array.isArray(dto.relatedProductIds)
        ? dto.relatedProductIds.filter(Boolean)
        : null;
    }
    if (dto.translations !== undefined) product.translations = this.normalizeTranslations(dto.translations);
    if (dto.salePrice !== undefined) {
      product.salePrice = dto.salePrice != null ? String(Number(dto.salePrice)) : null;
    }
    if (dto.saleStartAt !== undefined) product.saleStartAt = dto.saleStartAt ? new Date(dto.saleStartAt) : null;
    if (dto.saleEndAt !== undefined) product.saleEndAt = dto.saleEndAt ? new Date(dto.saleEndAt) : null;
    if (dto.priceTiers !== undefined) product.priceTiers = this.normalizePriceTiers(dto.priceTiers);
    if (dto.isBundle !== undefined) product.isBundle = Boolean(dto.isBundle);
    if (dto.bundleItems !== undefined) {
      product.bundleItems = product.isBundle ? this.normalizeBundleItems(dto.bundleItems) : null;
    }
    if (dto.prices !== undefined) product.prices = this.normalizePrices(dto.prices);
    if (dto.siteIds !== undefined) product.siteIds = await this.normalizeSiteIds(tenantId, dto.siteIds);

    const saved = await this.products.save(product);

    await this.writeChangeLog(tenantId, id, userId, [
      { field: 'price', oldValue: before.price, newValue: saved.price },
      { field: 'costPrice', oldValue: before.costPrice, newValue: saved.costPrice },
      { field: 'status', oldValue: before.status, newValue: saved.status },
      { field: 'sku', oldValue: before.sku, newValue: saved.sku },
      { field: 'barcode', oldValue: before.barcode, newValue: saved.barcode },
    ]);

    if (before.price !== saved.price || before.costPrice !== saved.costPrice) {
      try {
        await this.automationsService.triggerAutomation(tenantId, TriggerEvent.PRODUCT_PRICE_CHANGED, {
          entityType: 'product',
          entityId: saved.id,
          product: saved,
          oldPrice: before.price,
          newPrice: saved.price,
        });
      } catch (error) {
        this.log.error('Failed to trigger PRODUCT_PRICE_CHANGED automation:', error);
      }
    }

    if (before.status !== saved.status) {
      try {
        await this.automationsService.triggerAutomation(tenantId, TriggerEvent.PRODUCT_STATUS_CHANGED, {
          entityType: 'product',
          entityId: saved.id,
          product: saved,
          oldStatus: before.status,
          newStatus: saved.status,
        });
      } catch (error) {
        this.log.error('Failed to trigger PRODUCT_STATUS_CHANGED automation:', error);
      }
    }

    this.webhooksDispatcher
      .dispatch(tenantId, 'product.updated', { productId: saved.id, sku: saved.sku, name: saved.name })
      .catch(() => {});

    return saved;
  }

  /* ------------------------------------------------------------------ publication moderation */

  /** Очередь модерации: запросы на публикацию, которые ещё не одобрены. */
  async listPublicationQueue(tenantId: string) {
    return this.products.find({
      where: { tenantId, isDeleted: false, isPubliclyVisible: false, publicationRequestedAt: Not(IsNull()) },
      order: { publicationRequestedAt: 'ASC' },
    });
  }

  /**
   * Обычный редактор не может напрямую включить `isPubliclyVisible` (см.
   * lumiva_products_module_roadmap.md §15, пункт 4) — только запросить публикацию. Подтверждает
   * её отдельно тот, у кого есть `products_publish`.
   */
  async requestPublication(tenantId: string, productId: string, userId: string | null) {
    const product = await this.products.findOne({ where: { tenantId, id: productId, isDeleted: false } });
    if (!product) throw new NotFoundException('Товар не найден');
    if (product.isPubliclyVisible) {
      throw new BadRequestException('Товар уже опубликован в каталоге');
    }
    product.publicationRequestedAt = new Date();
    product.publicationRequestedBy = userId;
    product.publicationRejectedAt = null;
    product.publicationRejectionReason = null;
    const saved = await this.products.save(product);

    const reviewers = await this.staffUsers.find({
      where: { tenantId, isActive: true, role: In(['owner', 'manager']) },
    });
    const emails = new Set(
      reviewers.map((s) => s.email?.trim().toLowerCase()).filter((e): e is string => !!e),
    );
    if (emails.size) {
      const tenantUsers = await this.users.find({ where: { tenantId } });
      const userIds = tenantUsers.filter((u) => emails.has(u.email?.trim().toLowerCase())).map((u) => u.id);
      if (userIds.length) {
        await this.notifications.create(
          tenantId,
          userIds,
          'Запрос на публикацию товара',
          `${saved.name}${saved.sku ? ` (${saved.sku})` : ''} — запрошена публикация в публичный каталог`,
          { type: 'product.publication_requested', productId: saved.id, link: `/products/${saved.id}` },
        );
      }
    }
    return saved;
  }

  async approvePublication(tenantId: string, productId: string, userId: string | null) {
    const product = await this.products.findOne({ where: { tenantId, id: productId, isDeleted: false } });
    if (!product) throw new NotFoundException('Товар не найден');
    product.isPubliclyVisible = true;
    product.publicationApprovedAt = new Date();
    product.publicationApprovedBy = userId;
    product.publicationRequestedAt = null;
    product.publicationRequestedBy = null;
    product.publicationRejectedAt = null;
    product.publicationRejectionReason = null;
    const saved = await this.products.save(product);
    this.webhooksDispatcher
      .dispatch(tenantId, 'product.published', { productId: saved.id, sku: saved.sku, name: saved.name })
      .catch(() => {});
    return saved;
  }

  async rejectPublication(tenantId: string, productId: string, reason: string | null) {
    const product = await this.products.findOne({ where: { tenantId, id: productId, isDeleted: false } });
    if (!product) throw new NotFoundException('Товар не найден');
    product.publicationRejectedAt = new Date();
    product.publicationRejectionReason = reason ? this.cleanString(reason, '', 500) : null;
    product.publicationRequestedAt = null;
    product.publicationRequestedBy = null;
    return this.products.save(product);
  }

  /** Прямое снятие с публикации — не требует запроса, только `products_publish`. */
  async unpublish(tenantId: string, productId: string) {
    const product = await this.products.findOne({ where: { tenantId, id: productId, isDeleted: false } });
    if (!product) throw new NotFoundException('Товар не найден');
    product.isPubliclyVisible = false;
    product.publicationApprovedAt = null;
    product.publicationApprovedBy = null;
    return this.products.save(product);
  }

  async listChangeLogs(tenantId: string, productId: string, limit = 50) {
    return this.changeLogs.find({
      where: { tenantId, productId },
      order: { createdAt: 'DESC' },
      take: Math.min(200, Math.max(1, limit)),
    });
  }

  /** Массовое обновление категории/статуса/тегов у выбранных товаров. */
  async bulkUpdateProducts(
    tenantId: string,
    dto: {
      productIds: string[];
      categoryId?: string | null;
      status?: string;
      tagsToAdd?: string[];
      tagsToRemove?: string[];
    },
  ) {
    const ids = Array.isArray(dto.productIds) ? dto.productIds.filter(Boolean) : [];
    if (!ids.length) throw new BadRequestException('Нужно выбрать хотя бы один товар');
    const products = await this.products.find({ where: { tenantId, id: In(ids), isDeleted: false } });
    const toAdd = (dto.tagsToAdd || []).map((t) => this.cleanString(t, '', 60)).filter(Boolean);
    const toRemove = new Set((dto.tagsToRemove || []).map((t) => this.cleanString(t, '', 60)).filter(Boolean));
    for (const p of products) {
      if (dto.categoryId !== undefined) p.categoryId = dto.categoryId || null;
      if (dto.status !== undefined && PRODUCT_STATUSES.includes(dto.status as ProductStatus)) {
        p.status = dto.status as ProductStatus;
      }
      if (toAdd.length || toRemove.size) {
        const set = new Set(p.tags || []);
        for (const t of toAdd) set.add(t);
        for (const t of toRemove) set.delete(t);
        p.tags = [...set];
      }
    }
    await this.products.save(products);
    return { updated: products.length };
  }

  async deleteProduct(tenantId: string, id: string) {
    const product = await this.products.findOne({ where: { tenantId, id, isDeleted: false } });
    if (!product) throw new NotFoundException('Товар не найден');
    product.isDeleted = true;
    await this.products.save(product);
    this.webhooksDispatcher
      .dispatch(tenantId, 'product.deleted', { productId: product.id, sku: product.sku, name: product.name })
      .catch(() => {});
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
    // Атрибут без значений (только что созданный, но ещё не заполненный, напр. «Размер» без
    // S/M/L) молча выпадал бы из декартова произведения ниже — при всех пустых атрибутах это
    // раньше создавало один-единственный "призрачный" вариант с attributeValues:{} (в UI
    // отображался как комбинация "—"), что выглядело как баг. Явная ошибка вместо этого.
    const emptyAttrs = attrs.filter((a) => !(a.values || []).length);
    if (emptyAttrs.length) {
      throw new BadRequestException(
        `У атрибута${emptyAttrs.length > 1 ? 'ов' : ''} ${emptyAttrs.map((a) => `«${a.name}»`).join(', ')} нет значений — добавьте их перед генерацией вариантов`,
      );
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
    await this.locationStock.delete({ tenantId, variantId });
    await this.recalcProductQuantity(tenantId, productId);
    return { ok: true };
  }

  /* ------------------------------------------------------------------ stock */

  /** Уведомляет владельца/менеджеров, когда остаток пересекает порог «мало на складе» сверху вниз. */
  private async notifyLowStock(
    tenantId: string,
    product: Product,
    previousQuantity: number,
    newQuantity: number,
  ): Promise<void> {
    const threshold = product.lowStockThreshold;
    if (threshold == null) return;
    if (!(previousQuantity > threshold && newQuantity <= threshold)) return;

    const staff = await this.staffUsers.find({ where: { tenantId, isActive: true, role: In(['owner', 'manager']) } });
    const emails = new Set(
      staff.map((s) => s.email?.trim().toLowerCase()).filter((e): e is string => !!e),
    );
    if (!emails.size) return;
    const tenantUsers = await this.users.find({ where: { tenantId } });
    const userIds = tenantUsers.filter((u) => emails.has(u.email?.trim().toLowerCase())).map((u) => u.id);
    if (!userIds.length) return;

    const isOut = newQuantity === 0;
    const title = isOut ? 'Товар закончился' : 'Низкий остаток товара';
    const body = `${product.name}${product.sku ? ` (${product.sku})` : ''}: остаток ${newQuantity} (порог ${threshold})`;
    await this.notifications.create(tenantId, userIds, title, body, {
      type: isOut ? 'product.out_of_stock' : 'product.low_stock',
      productId: product.id,
      link: `/products/${product.id}`,
    });

    try {
      await this.automationsService.triggerAutomation(tenantId, TriggerEvent.PRODUCT_STOCK_LOW, {
        entityType: 'product',
        entityId: product.id,
        product,
        previousQuantity,
        newQuantity,
        threshold,
        isOut,
      });
    } catch (error) {
      this.log.error('Failed to trigger PRODUCT_STOCK_LOW automation:', error);
    }
  }

  /** Находит дефолтный склад тенанта, создаёт при отсутствии (тенанты, заведённые до §12.2). */
  private async getOrCreateDefaultLocation(tenantId: string): Promise<ProductLocation> {
    const existing = await this.locations.findOne({ where: { tenantId, isDefault: true } });
    if (existing) return existing;
    return this.locations.save(
      this.locations.create({
        tenantId,
        name: 'Основной склад',
        code: 'MAIN',
        isDefault: true,
        isActive: true,
      }),
    );
  }

  /**
   * Любое изменение остатка идёт через этот метод: пишет строку в product_location_stock
   * (источник истины ПО СКЛАДУ), пересчитывает денормализованную сумму на Product/ProductVariant
   * и журналирует движение. `resultingQuantity` в самом движении — остаток НА ЭТОМ СКЛАДЕ после
   * операции (не общий по товару) — так движение остаётся осмысленным при нескольких складах;
   * при единственном (дефолтном) складе оба числа совпадают.
   */
  private async recordStockMovement(
    tenantId: string,
    input: {
      productId: string;
      variantId: string | null;
      locationId?: string | null;
      type: ProductStockMovementType;
      quantityDelta: number;
      reason?: string | null;
      userId?: string | null;
      source?: ProductStockMovementSource;
      relatedMovementId?: string | null;
    },
  ) {
    const location = input.locationId
      ? await this.locations.findOne({ where: { tenantId, id: input.locationId } })
      : await this.getOrCreateDefaultLocation(tenantId);
    if (!location) throw new NotFoundException('Склад не найден');

    const rows = await this.locationStock.find({
      where: {
        tenantId,
        productId: input.productId,
        variantId: input.variantId === null ? IsNull() : input.variantId,
      },
    });
    const previousTotal = rows.reduce((sum, r) => sum + (r.quantity || 0), 0);
    let row = rows.find((r) => r.locationId === location.id) || null;
    const previousAtLocation = row?.quantity || 0;
    const resultingAtLocation = Math.max(0, previousAtLocation + input.quantityDelta);
    if (row) {
      row.quantity = resultingAtLocation;
      await this.locationStock.save(row);
    } else {
      row = await this.locationStock.save(
        this.locationStock.create({
          tenantId,
          productId: input.productId,
          variantId: input.variantId,
          locationId: location.id,
          quantity: resultingAtLocation,
        }),
      );
    }
    const resultingTotal = previousTotal - previousAtLocation + resultingAtLocation;

    let productForNotify: Product | null = null;
    if (input.variantId) {
      const variant = await this.variants.findOne({ where: { tenantId, id: input.variantId } });
      if (!variant) throw new NotFoundException('Вариант не найден');
      await this.variants.update({ tenantId, id: input.variantId }, { quantity: resultingTotal });
      await this.recalcProductQuantity(tenantId, input.productId);
      productForNotify = await this.products.findOne({ where: { tenantId, id: input.productId } });
    } else {
      const product = await this.products.findOne({ where: { tenantId, id: input.productId } });
      if (!product) throw new NotFoundException('Товар не найден');
      if (product.isVariable) {
        throw new BadRequestException('У вариативного товара остаток редактируется на уровне варианта');
      }
      product.quantity = resultingTotal;
      await this.products.save(product);
      productForNotify = product;
    }
    if (productForNotify && input.quantityDelta < 0) {
      this.notifyLowStock(tenantId, productForNotify, previousTotal, resultingTotal).catch(() => {});
    }
    const movement = this.movements.create({
      tenantId,
      productId: input.productId,
      variantId: input.variantId,
      locationId: location.id,
      relatedMovementId: input.relatedMovementId || null,
      type: input.type,
      quantityDelta: input.quantityDelta,
      resultingQuantity: resultingAtLocation,
      reason: input.reason ? this.cleanString(input.reason, '', 2000) : null,
      userId: input.userId || null,
      source: input.source || 'manual',
    });
    const savedMovement = await this.movements.save(movement);
    if (productForNotify) {
      this.webhooksDispatcher
        .dispatch(tenantId, 'product.stock_changed', {
          productId: input.productId,
          variantId: input.variantId,
          sku: productForNotify.sku,
          name: productForNotify.name,
          quantityDelta: input.quantityDelta,
          resultingQuantity: resultingAtLocation,
        })
        .catch(() => {});
    }
    return savedMovement;
  }

  /** Перемещение остатка между двумя складами — пара движений transfer_out/transfer_in. */
  async transferStock(
    tenantId: string,
    userId: string | null,
    input: {
      productId: string;
      variantId?: string | null;
      fromLocationId: string;
      toLocationId: string;
      quantity: number;
      reason?: string;
    },
  ) {
    const quantity = Number(input.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('Количество для перемещения должно быть положительным');
    }
    if (input.fromLocationId === input.toLocationId) {
      throw new BadRequestException('Склад отправления и назначения совпадают');
    }
    const [fromLocation, toLocation] = await Promise.all([
      this.locations.findOne({ where: { tenantId, id: input.fromLocationId } }),
      this.locations.findOne({ where: { tenantId, id: input.toLocationId } }),
    ]);
    if (!fromLocation || !toLocation) throw new NotFoundException('Склад не найден');

    const variantId = input.variantId || null;
    const availableAtSource = await this.locationStock.findOne({
      where: {
        tenantId,
        productId: input.productId,
        variantId: variantId === null ? IsNull() : variantId,
        locationId: fromLocation.id,
      },
    });
    if ((availableAtSource?.quantity || 0) < quantity) {
      throw new BadRequestException('Недостаточно остатка на складе отправления для перемещения');
    }

    const reason = input.reason
      ? this.cleanString(input.reason, '', 2000)
      : `Перемещение: ${fromLocation.name} → ${toLocation.name}`;

    const outMovement = await this.recordStockMovement(tenantId, {
      productId: input.productId,
      variantId,
      locationId: fromLocation.id,
      type: 'transfer_out',
      quantityDelta: -quantity,
      reason,
      userId,
      source: 'manual',
    });
    const inMovement = await this.recordStockMovement(tenantId, {
      productId: input.productId,
      variantId,
      locationId: toLocation.id,
      type: 'transfer_in',
      quantityDelta: quantity,
      reason,
      userId,
      source: 'manual',
      relatedMovementId: outMovement.id,
    });
    await this.movements.update({ id: outMovement.id }, { relatedMovementId: inMovement.id });
    return { ok: true, outMovementId: outMovement.id, inMovementId: inMovement.id };
  }

  /* ------------------------------------------------------------------ locations */

  async listLocations(tenantId: string) {
    await this.getOrCreateDefaultLocation(tenantId);
    return this.locations.find({ where: { tenantId }, order: { isDefault: 'DESC', name: 'ASC' } });
  }

  async createLocation(tenantId: string, dto: { name: string; code?: string | null }) {
    const name = this.cleanString(dto.name, '', 255);
    if (!name) throw new BadRequestException('Название склада обязательно');
    const loc = this.locations.create({
      tenantId,
      name,
      code: dto.code ? this.cleanString(dto.code, '', 32) : null,
      isDefault: false,
      isActive: true,
    });
    return this.locations.save(loc);
  }

  async updateLocation(
    tenantId: string,
    id: string,
    dto: { name?: string; code?: string | null; isActive?: boolean; isDefault?: boolean },
  ) {
    const loc = await this.locations.findOne({ where: { tenantId, id } });
    if (!loc) throw new NotFoundException('Склад не найден');
    if (dto.name !== undefined) {
      const name = this.cleanString(dto.name, '', 255);
      if (!name) throw new BadRequestException('Название склада обязательно');
      loc.name = name;
    }
    if (dto.code !== undefined) loc.code = dto.code ? this.cleanString(dto.code, '', 32) : null;
    if (dto.isActive !== undefined) {
      if (loc.isDefault && !dto.isActive) {
        throw new BadRequestException('Нельзя деактивировать склад по умолчанию');
      }
      loc.isActive = Boolean(dto.isActive);
    }
    if (dto.isDefault === true && !loc.isDefault) {
      await this.locations.update({ tenantId, isDefault: true }, { isDefault: false });
      loc.isDefault = true;
      loc.isActive = true;
    }
    return this.locations.save(loc);
  }

  async deleteLocation(tenantId: string, id: string) {
    const loc = await this.locations.findOne({ where: { tenantId, id } });
    if (!loc) throw new NotFoundException('Склад не найден');
    if (loc.isDefault) throw new BadRequestException('Нельзя удалить склад по умолчанию');
    const stockRows = await this.locationStock.find({ where: { tenantId, locationId: id } });
    if (stockRows.some((r) => r.quantity !== 0)) {
      throw new BadRequestException(
        'На складе есть остаток — перенесите его на другой склад перед удалением',
      );
    }
    if (stockRows.length) await this.locationStock.remove(stockRows);
    await this.locations.remove(loc);
    return { ok: true };
  }

  async adjustStock(
    tenantId: string,
    userId: string | null,
    input: {
      productId: string;
      variantId?: string | null;
      locationId?: string | null;
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
      locationId: input.locationId || null,
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
    query: { search?: string; categoryId?: string; lowStockOnly?: boolean; locationId?: string },
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

    // Разбивка остатка по складам — нужна и для фильтра по конкретному складу, и для
    // бейджа «на N складах» при просмотре «по всем».
    const locations = await this.locations.find({ where: { tenantId } });
    const locationById = new Map(locations.map((l) => [l.id, l]));
    const productIds = filtered.map((p) => p.id);
    const stockRows = productIds.length
      ? await this.locationStock.find({ where: { tenantId, productId: In(productIds) } })
      : [];
    const stockByKey = new Map<string, Array<{ locationId: string; locationName: string; quantity: number }>>();
    for (const r of stockRows) {
      const key = `${r.productId}:${r.variantId || ''}`;
      const arr = stockByKey.get(key) || [];
      arr.push({
        locationId: r.locationId,
        locationName: locationById.get(r.locationId)?.name || '—',
        quantity: r.quantity,
      });
      stockByKey.set(key, arr);
    }
    const quantityAt = (productId: string, variantId: string | null, fallback: number): number => {
      if (!query.locationId) return fallback;
      const arr = stockByKey.get(`${productId}:${variantId || ''}`) || [];
      return arr.find((r) => r.locationId === query.locationId)?.quantity || 0;
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
      locations: Array<{ locationId: string; locationName: string; quantity: number }>;
    }> = [];
    for (const p of filtered) {
      const productVariants = variantsByProduct.get(p.id) || [];
      if (p.isVariable && productVariants.length) {
        for (const v of productVariants) {
          const quantity = quantityAt(p.id, v.id, v.quantity);
          rows.push({
            productId: p.id,
            productName: p.name,
            sku: v.sku,
            variantId: v.id,
            variantLabel: describeVariant(v),
            quantity,
            lowStockThreshold: p.lowStockThreshold,
            isLow: p.lowStockThreshold != null && quantity <= p.lowStockThreshold,
            locations: stockByKey.get(`${p.id}:${v.id}`) || [],
          });
        }
      } else {
        const quantity = quantityAt(p.id, null, p.quantity);
        rows.push({
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          variantId: null,
          variantLabel: null,
          quantity,
          lowStockThreshold: p.lowStockThreshold,
          isLow: p.lowStockThreshold != null && quantity <= p.lowStockThreshold,
          locations: stockByKey.get(`${p.id}:`) || [],
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
    const mappedColumns = new Set(Object.values(suggestedMapping).filter((v): v is string => !!v));
    const unmatchedColumns = parsed.columns.filter((c) => !mappedColumns.has(c));
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
      // Колонки без пары — при применении импорта на них автоматически заведутся новые
      // кастомные текстовые поля (см. applyImport), чтобы данные не терялись.
      unmatchedColumns,
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
      /**
       * Явный список «колонка файла → новое кастомное поле», подтверждённый пользователем на
       * экране маппинга (см. ProductImportPage.tsx — строки «Новое поле» с чекбоксом и
       * редактируемым названием). Если не передан — старое поведение: автоматически заводим
       * поле для каждой несопоставленной колонки файла, взяв название колонки как есть.
       */
      newFields?: Array<{ column: string; label: string }>;
    },
  ) {
    const session = await this.importSessions.findOne({ where: { id: dto.importId, tenantId } });
    if (!session) throw new NotFoundException('Сессия импорта не найдена');
    if (session.status === 'applied') {
      throw new BadRequestException('Этот файл уже был импортирован');
    }
    const mapping = { ...(dto.mapping || {}) };
    const fieldDefs = await this.listFieldDefs(tenantId);
    const categories = await this.listCategories(tenantId);
    const categoryByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]));
    const updateExisting = dto.updateExisting !== false;

    // Колонки файла, на которые не сослалось ни одно поле в маппинге (ни структурное, ни
    // существующее кастомное) — заводим как новые текстовые кастомные поля, чтобы их данные не
    // терялись при импорте (см. lumiva_products_module_roadmap.md §8). Если пользователь явно
    // подтвердил список на экране маппинга (`dto.newFields`) — используем его (с его же
    // названиями, можно было переименовать/исключить лишние); иначе — старое поведение.
    const mappedColumns = new Set(Object.values(mapping).filter((v): v is string => !!v));
    const toCreate = dto.newFields
      ? dto.newFields.filter((f) => f.column && f.label?.trim())
      : session.columns.filter((c) => !mappedColumns.has(c)).map((c) => ({ column: c, label: c }));
    const createdFieldLabels: string[] = [];
    for (const { column, label } of toCreate) {
      const newField = await this.createFieldDef(tenantId, { label, type: 'text' });
      fieldDefs.push(newField);
      mapping[newField.key] = column;
      createdFieldLabels.push(newField.label);
    }

    // Мультивалютные цены "обратным" импортом — каждая отдельная колонка файла сопоставлена
    // не единому полю, а конкретной валюте (ключ маппинга вида `extraPrice:USD`), в отличие от
    // структурного поля `prices`, которое ждёт одну колонку с уже собранной строкой
    // "USD:19.99,TRY:650". Оба способа совместимы — их результаты просто объединяются построчно
    // (см. lumiva_products_module_roadmap.md §16 «Импорт мультивалютных цен»).
    const extraPriceColumns = Object.entries(mapping)
      .map(([key, column]) => {
        const m = /^extraPrice:([A-Z]{3})$/.exec(key);
        return m && column ? { currency: m[1], column } : null;
      })
      .filter((v): v is { currency: string; column: string } => !!v);

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
        const barcode = get('barcode');
        const tagsRaw = get('tags');
        const tags = tagsRaw
          ? tagsRaw.split(/[,;]/).map((v) => v.trim()).filter(Boolean)
          : undefined;
        const weightRaw = get('weight');
        const weight = weightRaw ? Number(weightRaw.replace(',', '.')) : undefined;
        const dimLengthRaw = get('dimensionsLength');
        const dimWidthRaw = get('dimensionsWidth');
        const dimHeightRaw = get('dimensionsHeight');
        const dimensions =
          dimLengthRaw || dimWidthRaw || dimHeightRaw
            ? {
                length: dimLengthRaw ? Number(dimLengthRaw.replace(',', '.')) : undefined,
                width: dimWidthRaw ? Number(dimWidthRaw.replace(',', '.')) : undefined,
                height: dimHeightRaw ? Number(dimHeightRaw.replace(',', '.')) : undefined,
              }
            : undefined;
        const slug = get('slug');
        const metaTitle = get('metaTitle');
        const metaDescription = get('metaDescription');
        const pricesRaw = get('prices');
        const pricesFromCombinedColumn = pricesRaw
          ? pricesRaw
              .split(',')
              .map((pair) => {
                const [currency, priceStr] = pair.split(':').map((s) => s.trim());
                const priceVal = Number((priceStr || '').replace(',', '.'));
                return currency && Number.isFinite(priceVal) ? { currency, price: priceVal } : null;
              })
              .filter((p): p is { currency: string; price: number } => !!p)
          : [];
        const pricesFromExtraColumns = extraPriceColumns
          .map(({ currency, column }) => {
            const raw = String(row[column] ?? '').trim();
            const priceVal = Number(raw.replace(',', '.'));
            return raw && Number.isFinite(priceVal) ? { currency, price: priceVal } : null;
          })
          .filter((p): p is { currency: string; price: number } => !!p);
        // extraPrice-колонки перекрывают combined-строку при совпадении валюты (явное
        // сопоставление колонки надёжнее, чем часть комбинированной строки).
        const mergedPrices = new Map(pricesFromCombinedColumn.map((p) => [p.currency, p]));
        for (const p of pricesFromExtraColumns) mergedPrices.set(p.currency, p);
        const prices = mergedPrices.size ? Array.from(mergedPrices.values()) : undefined;

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
            barcode: barcode || undefined,
            tags,
            weight,
            dimensions,
            slug: slug || undefined,
            metaTitle: metaTitle || undefined,
            metaDescription: metaDescription || undefined,
            prices,
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
            barcode: barcode || null,
            tags,
            weight,
            dimensions,
            slug: slug || undefined,
            metaTitle: metaTitle || null,
            metaDescription: metaDescription || null,
            prices,
          });
          created++;
        }
      } catch (err: any) {
        errors.push({ row: i + 1, message: err?.message || 'Неизвестная ошибка' });
      }
    }

    session.status = 'applied';
    await this.importSessions.save(session);

    return { created, updated: updatedCount, errors, total: session.rows.length, createdFieldLabels };
  }

  /**
   * Экспорт: xlsx (по умолчанию) или csv. Для вариативных товаров — одна строка на вариант,
   * колонки = структурные поля + активные product_field_defs.
   */
  async exportProducts(
    tenantId: string,
    query: { format?: 'xlsx' | 'csv' | 'pdf'; status?: string; categoryId?: string },
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const format = query.format === 'csv' ? 'csv' : query.format === 'pdf' ? 'pdf' : 'xlsx';
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
      'Штрихкод',
      'Теги',
      'Вес',
      'Длина',
      'Ширина',
      'Высота',
      'Slug (URL)',
      'SEO: заголовок',
      'SEO: описание',
      'Цены в валютах',
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
            p.barcode || '',
            (p.tags || []).join(', '),
            p.weight != null ? String(p.weight) : '',
            p.dimensions?.length != null ? String(p.dimensions.length) : '',
            p.dimensions?.width != null ? String(p.dimensions.width) : '',
            p.dimensions?.height != null ? String(p.dimensions.height) : '',
            p.slug || '',
            p.metaTitle || '',
            p.metaDescription || '',
            (p.prices || []).map((pr) => `${pr.currency}:${pr.price}`).join(', '),
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
          p.barcode || '',
          (p.tags || []).join(', '),
          p.weight != null ? String(p.weight) : '',
          p.dimensions?.length != null ? String(p.dimensions.length) : '',
          p.dimensions?.width != null ? String(p.dimensions.width) : '',
          p.dimensions?.height != null ? String(p.dimensions.height) : '',
          p.slug || '',
          p.metaTitle || '',
          p.metaDescription || '',
          (p.prices || []).map((pr) => `${pr.currency}:${pr.price}`).join(', '),
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

    if (format === 'pdf') {
      const buffer = await this.renderPriceListPdf(tenantId, items, categoryById);
      return {
        buffer,
        filename: `price-list-${Date.now()}.pdf`,
        contentType: 'application/pdf',
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

  /** Прайс-лист PDF: Название / Артикул / Категория / Цена / Остаток, постранично. */
  private async renderPriceListPdf(
    tenantId: string,
    items: Product[],
    categoryById: Map<string, string>,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', autoFirstPage: true });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const fontPath = resolveUnicodePdfFont();
      if (fontPath) {
        doc.font(fontPath);
      }

      doc.fontSize(18).text('Прайс-лист', { align: 'left' });
      doc.fontSize(9).fillColor('#888').text(new Date().toLocaleDateString('ru-RU'));
      doc.moveDown(1);
      doc.fillColor('#000');

      const colX = { name: 40, sku: 280, cat: 360, price: 470, qty: 530 };
      const rowHeader = () => {
        doc.fontSize(9).fillColor('#888');
        doc.text('Название', colX.name, doc.y, { continued: false });
        doc.text('Артикул', colX.sku, doc.y - doc.currentLineHeight());
        doc.text('Категория', colX.cat, doc.y - doc.currentLineHeight());
        doc.text('Цена', colX.price, doc.y - doc.currentLineHeight());
        doc.text('Остаток', colX.qty, doc.y - doc.currentLineHeight());
        doc.moveDown(0.5);
        doc.fillColor('#000');
        doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#ddd').stroke();
        doc.moveDown(0.3);
      };
      rowHeader();

      doc.fontSize(9);
      for (const p of items) {
        if (doc.y > 780) {
          doc.addPage();
          rowHeader();
        }
        const y = doc.y;
        doc.text(p.name, colX.name, y, { width: 230 });
        doc.text(p.sku || '—', colX.sku, y, { width: 70 });
        doc.text(p.categoryId ? categoryById.get(p.categoryId) || '—' : '—', colX.cat, y, { width: 100 });
        doc.text(`${p.price} ${p.currency}`, colX.price, y, { width: 55 });
        doc.text(String(p.quantity), colX.qty, y, { width: 40 });
        doc.moveDown(0.6);
      }
      doc.end();
    });
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

  /* ------------------------------------------------------------ public catalog (без токена) */

  /** Резолвит tenantId по публичному `Tenant.clientKey` — как на странице логина. */
  private async resolveTenantByClientKey(clientKey: string): Promise<string> {
    const tenant = await this.tenants.findOne({ where: { clientKey } });
    if (!tenant) throw new NotFoundException('Каталог не найден');
    return tenant.id;
  }

  /**
   * Убирает поля, которые не должны утекать в анонимную витрину без токена. `customFields`
   * намеренно оставлены — это как раз то, что клиент показывает на карточке товара на внешнем
   * сайте (см. раздел 1 ТЗ, «Функции» и т.п.); `costPrice` (закупочная цена/маржа) — никогда.
   */
  private stripForPublicCatalog(product: Product) {
    const { costPrice, ...rest } = product;
    return rest;
  }

  /** Товар виден на сайте `siteId`, если `siteIds` не задан (все сайты) либо содержит его. */
  private matchesSite(product: Product, siteId?: string | null): boolean {
    if (!siteId) return true;
    return !product.siteIds || product.siteIds.includes(siteId);
  }

  async listPublicCatalog(clientKey: string, siteId?: string) {
    const tenantId = await this.resolveTenantByClientKey(clientKey);
    const items = (
      await this.products.find({
        where: { tenantId, isDeleted: false, status: 'active', isPubliclyVisible: true },
        order: { name: 'ASC' },
      })
    ).filter((p) => this.matchesSite(p, siteId));
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
      ...this.stripForPublicCatalog(p),
      variants: p.isVariable ? variantsByProduct.get(p.id) || [] : undefined,
    }));
  }

  async getPublicCatalogProduct(clientKey: string, externalIdOrSku: string, siteId?: string) {
    const tenantId = await this.resolveTenantByClientKey(clientKey);
    const product =
      (await this.products.findOne({
        where: { tenantId, sku: externalIdOrSku, isDeleted: false, status: 'active', isPubliclyVisible: true },
      })) ||
      (await this.products.findOne({
        where: { tenantId, externalId: externalIdOrSku, isDeleted: false, status: 'active', isPubliclyVisible: true },
      }));
    if (!product || !this.matchesSite(product, siteId)) throw new NotFoundException('Товар не найден');
    const productVariants = product.isVariable
      ? await this.variants.find({ where: { tenantId, productId: product.id, isActive: true } })
      : [];
    return { product: this.stripForPublicCatalog(product), variants: productVariants };
  }

  /* ------------------------------------------------------------------------------ feeds */

  private async resolveSiteByToken(siteToken: string): Promise<Site> {
    const site = await this.sites.findByApiToken(siteToken);
    if (!site) throw new NotFoundException('Сайт не найден');
    return site;
  }

  private async listFeedProducts(site: Site): Promise<Product[]> {
    return (
      await this.products.find({
        where: { tenantId: site.tenantId, isDeleted: false, status: 'active', isPubliclyVisible: true },
        order: { name: 'ASC' },
      })
    ).filter((p) => this.matchesSite(p, site.id));
  }

  private feedProductUrl(site: Site, product: Product): string {
    const base = /^https?:\/\//.test(site.domain) ? site.domain.replace(/\/$/, '') : `https://${site.domain}`;
    return `${base}/product/${product.slug || product.id}`;
  }

  private xmlEscape(value: string): string {
    return String(value ?? '').replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '&':
          return '&amp;';
        case "'":
          return '&apos;';
        default:
          return '&quot;';
      }
    });
  }

  private csvEscape(value: string): string {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  }

  private feedPrice(product: Product): { currency: string; price: number } {
    return { currency: product.currency, price: Number(product.price) };
  }

  /** Google Merchant Center product feed (RSS 2.0 + g: namespace). */
  async generateGoogleMerchantFeed(siteToken: string): Promise<string> {
    const site = await this.resolveSiteByToken(siteToken);
    const items = await this.listFeedProducts(site);
    const rows = items
      .map((p) => {
        const { currency, price } = this.feedPrice(p);
        const cover = p.images?.find((i) => i.isCover) || p.images?.[0];
        const availability = p.quantity > 0 ? 'in_stock' : 'out_of_stock';
        return `    <item>
      <g:id>${this.xmlEscape(p.sku || p.id)}</g:id>
      <title>${this.xmlEscape(p.name)}</title>
      <description>${this.xmlEscape(p.description || p.name)}</description>
      <link>${this.xmlEscape(this.feedProductUrl(site, p))}</link>
      ${cover ? `<g:image_link>${this.xmlEscape(cover.url)}</g:image_link>` : ''}
      <g:availability>${availability}</g:availability>
      <g:price>${price.toFixed(2)} ${currency}</g:price>
      <g:condition>new</g:condition>
      ${p.barcode ? `<g:gtin>${this.xmlEscape(p.barcode)}</g:gtin>` : ''}
    </item>`;
      })
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${this.xmlEscape(site.name || site.domain)}</title>
    <link>${this.xmlEscape(site.domain)}</link>
    <description>Lumiva CRM product feed</description>
${rows}
  </channel>
</rss>`;
  }

  /** CSV в формате, совместимом с импортёром товаров WooCommerce. */
  async generateWooCommerceFeed(siteToken: string): Promise<string> {
    const site = await this.resolveSiteByToken(siteToken);
    const items = await this.listFeedProducts(site);
    const categories = await this.listCategories(site.tenantId);
    const categoryById = new Map(categories.map((c) => [c.id, c.name]));
    const headers = [
      'Type',
      'SKU',
      'Name',
      'Published',
      'Short description',
      'Description',
      'Regular price',
      'Sale price',
      'Categories',
      'Images',
      'In stock?',
      'Stock',
    ];
    const rows = items.map((p) => [
      p.isVariable ? 'variable' : 'simple',
      p.sku || '',
      p.name,
      '1',
      p.description ? p.description.slice(0, 160) : '',
      p.description || '',
      String(p.price),
      p.salePrice || '',
      p.categoryId ? categoryById.get(p.categoryId) || '' : '',
      (p.images || []).map((i) => i.url).join(', '),
      p.quantity > 0 ? '1' : '0',
      String(p.quantity),
    ]);
    const lines = [headers, ...rows].map((r) => r.map((c) => this.csvEscape(String(c))).join(','));
    return lines.join('\n');
  }

  /** Простой JSON-фид для headless-витрин/собственных интеграций. */
  async generateJsonFeed(siteToken: string) {
    const site = await this.resolveSiteByToken(siteToken);
    const items = await this.listFeedProducts(site);
    return {
      site: { domain: site.domain, name: site.name || site.domain },
      generatedAt: new Date().toISOString(),
      products: items.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        price: Number(p.price),
        currency: p.currency,
        prices: p.prices || [],
        salePrice: p.salePrice != null ? Number(p.salePrice) : null,
        quantity: p.quantity,
        images: p.images || [],
        barcode: p.barcode,
        tags: p.tags || [],
        url: this.feedProductUrl(site, p),
      })),
    };
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
      barcode: body?.barcode,
      tags: body?.tags,
      weight: body?.weight,
      dimensions: body?.dimensions,
      slug: body?.slug,
      metaTitle: body?.metaTitle,
      metaDescription: body?.metaDescription,
      translations: body?.translations,
      salePrice: body?.salePrice,
      saleStartAt: body?.saleStartAt,
      saleEndAt: body?.saleEndAt,
      priceTiers: body?.priceTiers,
      relatedProductIds: body?.relatedProductIds,
      prices: body?.prices,
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
          let variantChanged = false;
          if (v.priceOverride !== undefined) {
            existingVariant.priceOverride =
              v.priceOverride != null ? String(Number(v.priceOverride)) : null;
            variantChanged = true;
          }
          if (v.images !== undefined) {
            existingVariant.images = Array.isArray(v.images) ? v.images : null;
            variantChanged = true;
          }
          if (variantChanged) {
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
