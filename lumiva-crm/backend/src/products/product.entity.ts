import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProductCategory } from './product-category.entity';

export type ProductStatus = 'active' | 'draft' | 'archived' | 'out_of_stock';

export interface ProductImage {
  url: string;
  isCover?: boolean;
}

export interface ProductDimensions {
  length?: number;
  width?: number;
  height?: number;
  unit?: 'cm' | 'in';
}

export interface ProductPriceTier {
  minQty: number;
  price: number;
}

export interface ProductBundleItem {
  productId: string;
  quantity: number;
}

export interface ProductTranslation {
  name?: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
}

export interface ProductPriceInCurrency {
  currency: string;
  price: number;
}

@Entity('products')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'categoryId'])
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'sku'], { unique: true, where: '"sku" IS NOT NULL' })
@Index(['tenantId', 'barcode'], { unique: true, where: '"barcode" IS NOT NULL' })
@Index(['tenantId', 'slug'], { unique: true, where: '"slug" IS NOT NULL' })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sku: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => ProductCategory, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category: ProductCategory | null;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: ProductStatus;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  price: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  costPrice: string | null;

  @Column({ type: 'char', length: 3, default: 'EUR' })
  currency: string;

  /** "Вариативный товар" — если true, реальные остатки/цены живут на ProductVariant. */
  @Column({ type: 'boolean', default: false })
  isVariable: boolean;

  /** ProductAttribute.id[] участвующие в вариациях этого товара (только если isVariable). */
  @Column({ type: 'jsonb', nullable: true })
  variantAttributeIds: string[] | null;

  /**
   * Остаток. Для невариативного товара — реальный редактируемый остаток (меняется только
   * через ProductStockMovement). Для вариативного — денормализованная сумма остатков всех
   * активных вариантов, пересчитывается сервисом, не редактируется напрямую.
   */
  @Column({ type: 'integer', default: 0 })
  quantity: number;

  @Column({ type: 'integer', nullable: true })
  lowStockThreshold: number | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  unit: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  images: ProductImage[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalId: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  customFields: Record<string, unknown>;

  /* ---------------------------------------------------------------- SEO */

  @Column({ type: 'varchar', length: 255, nullable: true })
  slug: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  metaTitle: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  metaDescription: string | null;

  /* ---------------------------------------------------------- shipping */

  @Column({ type: 'numeric', precision: 10, scale: 3, nullable: true })
  weight: string | null;

  @Column({ type: 'jsonb', nullable: true })
  dimensions: ProductDimensions | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  barcode: string | null;

  /* ------------------------------------------------------- merchandising */

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  tags: string[];

  @Column({ type: 'jsonb', nullable: true })
  relatedProductIds: string[] | null;

  /** Переводы name/description/SEO по локали, напр. { en: {...}, tr: {...} }. */
  @Column({ type: 'jsonb', nullable: true })
  translations: Record<string, ProductTranslation> | null;

  /* -------------------------------------------------------------- pricing */

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  salePrice: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  saleStartAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  saleEndAt: Date | null;

  /** Оптовые пороги цены — [{minQty, price}], отсортировано по возрастанию minQty. */
  @Column({ type: 'jsonb', nullable: true })
  priceTiers: ProductPriceTier[] | null;

  /* -------------------------------------------------------------- bundle */

  @Column({ type: 'boolean', default: false })
  isBundle: boolean;

  @Column({ type: 'jsonb', nullable: true })
  bundleItems: ProductBundleItem[] | null;

  /* -------------------------------------------------------------- visibility/currency */

  /** Публичная витрина без API-токена (`/public/catalog/:clientKey/products`) — опт-ин. */
  @Column({ type: 'boolean', default: false })
  isPubliclyVisible: boolean;

  /**
   * Доп. цены в других валютах — `price`/`currency` остаются «основной» ценой (обратная
   * совместимость со всем кодом, который их читает); `prices` — чисто аддитивный список
   * override-ов на случай мультивалютной витрины/прайс-листа.
   */
  @Column({ type: 'jsonb', nullable: true })
  prices: ProductPriceInCurrency[] | null;

  /**
   * На каких сайтах тенанта (см. `Site`) показывать товар в публичном каталоге/фидах.
   * `null` — на всех сайтах тенанта (дефолт, обратная совместимость с уже включённым
   * `isPubliclyVisible`); непустой массив — только на перечисленных.
   */
  @Column({ type: 'jsonb', nullable: true })
  siteIds: string[] | null;

  /* ------------------------------------------------------- publication moderation */

  /** Кто/когда запросил публикацию в каталог — см. §products_publish в roadmap. */
  @Column({ type: 'timestamptz', nullable: true })
  publicationRequestedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  publicationRequestedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  publicationApprovedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  publicationApprovedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  publicationRejectedAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  publicationRejectionReason: string | null;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
