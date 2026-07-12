import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ProductWebhookEvent =
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'product.stock_changed'
  | 'product.published';

/**
 * Исходящий вебхук: при событии по товару шлём подписанный POST на `url` — чтобы внешний сайт
 * получал изменения сразу, а не только опросом `/public/catalog` (см.
 * lumiva_products_module_roadmap.md §15). По образцу существующих исходящих интеграций
 * (`TeamsWebhookService`/`SlackWebhookService`) — прямой `axios.post` с таймаутом, без очереди.
 */
@Entity('product_webhooks')
@Index(['tenantId', 'isActive'])
export class ProductWebhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  /** null — подписка на все сайты тенанта; иначе — конкретный `Site.id`. */
  @Column({ type: 'uuid', nullable: true })
  siteId: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 2048 })
  url: string;

  /** Секрет для HMAC-подписи тела запроса (заголовок X-Lumiva-Signature). */
  @Column({ type: 'varchar', length: 128 })
  secret: string;

  @Column({ type: 'jsonb' })
  events: ProductWebhookEvent[];

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastTriggeredAt: Date | null;

  @Column({ type: 'integer', nullable: true })
  lastStatusCode: number | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
