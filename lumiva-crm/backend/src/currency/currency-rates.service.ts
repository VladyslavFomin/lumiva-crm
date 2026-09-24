// src/currency/currency-rates.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrencyRate } from './currency-rate.entity';

const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000; // 12 часов
const BASE = 'EUR';

/**
 * Курсы валют для конвертации сумм лидов/проектов (у каждого своя currency) в основную
 * валюту тенанта (tenant.primaryCurrency), вместо простого суммирования вперемешку.
 * Источник — open.er-api.com (бесплатный, без ключа), кэшируется в БД на REFRESH_AFTER_MS,
 * чтобы не дёргать внешний API на каждый запрос аналитики.
 */
@Injectable()
export class CurrencyRatesService {
  private readonly logger = new Logger(CurrencyRatesService.name);
  private inFlight: Promise<Record<string, number>> | null = null;

  constructor(
    @InjectRepository(CurrencyRate)
    private readonly repo: Repository<CurrencyRate>,
  ) {}

  /** Публичный доступ к сырым курсам (base=EUR) — для расчётов, где нужно сконвертировать
   * много сумм за один запрос без повторных обращений к БД/внешнему API на каждую сумму. */
  async getRates(): Promise<Record<string, number>> {
    return this.getRatesEurBase();
  }

  convertWithRates(amount: number, from: string, to: string, rates: Record<string, number>): number {
    if (!amount) return 0;
    if (from === to) return amount;
    const fromRate = from === BASE ? 1 : rates[from.toUpperCase()] || 1;
    const toRate = to === BASE ? 1 : rates[to.toUpperCase()] || 1;
    return (amount / fromRate) * toRate;
  }

  convertMapToSingleWithRates(byCurrency: Record<string, number>, to: string, rates: Record<string, number>): number {
    let sum = 0;
    for (const [cur, amount] of Object.entries(byCurrency)) {
      sum += this.convertWithRates(amount, cur, to, rates);
    }
    return Math.round(sum * 100) / 100;
  }

  private async getRatesEurBase(): Promise<Record<string, number>> {
    const cached = await this.repo.findOne({ where: { base: BASE } });
    const isFresh = cached && Date.now() - new Date(cached.fetchedAt).getTime() < REFRESH_AFTER_MS;
    if (isFresh) return cached.rates;

    if (this.inFlight) return this.inFlight;

    this.inFlight = this.fetchAndCache(cached?.rates || null);
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  private async fetchAndCache(fallback: Record<string, number> | null): Promise<Record<string, number>> {
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${BASE}`);
      if (!res.ok) throw new Error(`FX API вернул ${res.status}`);
      const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
      if (data.result !== 'success' || !data.rates) throw new Error('FX API: неожиданный формат ответа');

      await this.repo.save(this.repo.create({ base: BASE, rates: data.rates }));
      return data.rates;
    } catch (e) {
      this.logger.warn(`Не удалось обновить курсы валют: ${(e as Error).message}`);
      if (fallback) return fallback;
      // Совсем без курсов (первый запуск + API недоступен) — конвертация 1:1, лучше, чем упасть.
      return {};
    }
  }

  /** Сколько stored единиц currency за 1 EUR. Неизвестная валюта → 1 (конвертация 1:1). */
  async rateFromEur(currency: string): Promise<number> {
    if (currency === BASE) return 1;
    const rates = await this.getRatesEurBase();
    return rates[currency.toUpperCase()] || 1;
  }

  async convert(amount: number, from: string, to: string): Promise<number> {
    if (!amount) return 0;
    if (from === to) return amount;
    const rates = await this.getRatesEurBase();
    const fromRate = from === BASE ? 1 : rates[from.toUpperCase()] || 1;
    const toRate = to === BASE ? 1 : rates[to.toUpperCase()] || 1;
    const amountInEur = amount / fromRate;
    return amountInEur * toRate;
  }

  /** Сумма разных валют → одно число в целевой валюте (по курсу), с округлением до копеек. */
  async convertMapToSingle(byCurrency: Record<string, number>, to: string): Promise<number> {
    let sum = 0;
    for (const [cur, amount] of Object.entries(byCurrency)) {
      sum += await this.convert(amount, cur, to);
    }
    return Math.round(sum * 100) / 100;
  }
}
