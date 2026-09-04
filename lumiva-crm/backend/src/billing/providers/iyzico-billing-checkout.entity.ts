import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Короткоживущая таблица-связка token → {tenantId, plan, period} для платформенного биллинга
 * через iyzico. iyzico возвращает в callback только token, а не наши метаданные — поэтому,
 * в точности как payments.service.ts делает для Sale-платежей (Payment.token), мы сохраняем
 * эту связку сами при создании чекаута и вычитываем при обработке callback, а не полагаемся
 * на то, что iyzico эхом вернёт conversationId, заданный при инициализации (не подтверждено).
 */
@Entity('iyzico_billing_checkouts')
export class IyzicoBillingCheckout {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  token: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 32 })
  plan: string;

  @Column({ type: 'varchar', length: 16 })
  period: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
