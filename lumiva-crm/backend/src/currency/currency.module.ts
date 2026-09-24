// src/currency/currency.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrencyRate } from './currency-rate.entity';
import { CurrencyRatesService } from './currency-rates.service';

@Module({
  imports: [TypeOrmModule.forFeature([CurrencyRate])],
  providers: [CurrencyRatesService],
  exports: [CurrencyRatesService],
})
export class CurrencyModule {}
