// src/currency/currency-rate.entity.ts
import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Кэш курсов валют — одна строка на базовую валюту (сейчас используется только 'EUR', но
 * структура позволяет кэшировать несколько баз). rates: { "USD": 1.08, "RUB": 99.4, ... } —
 * сколько единиц данной валюты за 1 единицу base.
 */
@Entity('currency_rates')
export class CurrencyRate {
  @PrimaryColumn({ type: 'varchar', length: 8 })
  base: string;

  @Column({ type: 'jsonb' })
  rates: Record<string, number>;

  @UpdateDateColumn({ name: 'fetchedAt', type: 'timestamptz' })
  fetchedAt: Date;
}
