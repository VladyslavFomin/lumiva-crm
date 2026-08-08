import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ProductWebhookEvent } from './product-webhook.entity';

export type ProductWebhookDeliveryStatus = 'pending' | 'success' | 'failed';

/**
 * Одна попытка доставки события на вебхук — журнал + состояние ретраев (см.
 * lumiva_products_module_roadmap.md §16 «Ретраи вебхуков»). Без очереди (BullMQ/Redis не
 * гарантированно доступны в этом деплое) — ретраи через `@Cron`-свип
 * (`ProductWebhooksService.retryPendingDeliveries`), состояние живёт в этой таблице.
 */
@Entity('product_webhook_deliveries')
@Index(['tenantId', 'webhookId', 'createdAt'])
@Index(['status', 'nextAttemptAt'])
export class ProductWebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  webhookId: string;

  @Column({ type: 'varchar', length: 40 })
  event: ProductWebhookEvent;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: ProductWebhookDeliveryStatus;

  @Column({ type: 'integer', default: 0 })
  attempt: number;

  @Column({ type: 'integer', default: 5 })
  maxAttempts: number;

  @Column({ type: 'timestamptz' })
  nextAttemptAt: Date;

  @Column({ type: 'integer', nullable: true })
  lastStatusCode: number | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
