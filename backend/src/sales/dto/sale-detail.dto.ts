// src/sales/dto/sale-detail.dto.ts
import { IntegrationKind } from '../../integrations/integration-kind.enum';

/**
 * Детальная информация о продаже / заказе.
 * Сделано максимально универсально:
 *  - sale: плоский объект со всеми колонками из таблицы Sale
 *  - meta: распарсенный JSON (если есть sale.metaJson)
 *  - channel / integration: короткая информация о канале и интеграции
 */
export class SaleDetailDto {
  id: string;

  // Краткая информация о канале
  channel: {
    id: string;
    name: string;
    type: string;
  } | null;

  // Краткая информация об интеграции / источнике
  integration: {
    id: string;
    name: string;
    kind: IntegrationKind;
  } | null;

  // Все поля заказа (как есть в entity)
  sale: Record<string, any>;

  // Дополнительные данные (metaJson / payload)
  meta: Record<string, any> | null;
}