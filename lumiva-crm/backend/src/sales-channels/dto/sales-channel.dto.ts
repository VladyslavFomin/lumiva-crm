// src/sales-channels/dto/sales-channel.dto.ts
import type { SalesChannelType } from '../sales-channel.entity';

export class SalesChannelDto {
  id: string;
  name: string;
  type: SalesChannelType;

  integrationId: string | null;
  integrationName: string | null;

  // когда канал появился (можно createdAt)
  connectedAt: Date;

  isEnabled: boolean;
  isDeleted: boolean;

  // агрегаты из интеграции
  totalSalesCount: number;
  totalSalesAmount: number;
  currency: string;

  lastSyncAt: Date | null;
  lastSyncStatus: string;
  lastError: string | null;

  /** Хвост API ключа (consumerKey), маскированный типо *****abcd */
  apiKeyTail?: string | null;
}