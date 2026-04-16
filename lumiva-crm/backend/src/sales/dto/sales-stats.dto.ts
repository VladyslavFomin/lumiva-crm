// src/sales/dto/sales-stats.dto.ts
import { SaleStatus } from '../sale-status.enum';

export class SalesByStatusDto {
  status: SaleStatus;
  count: number;
  amount: number;
}

export class SalesByCurrencyDto {
  currency: string;
  amount: number;
}

export class SalesStatsDto {
  totalAmount: number;
  totalCount: number;
  avgCheck: number;
  byStatus: SalesByStatusDto[];
  byCurrency: SalesByCurrencyDto[];
}