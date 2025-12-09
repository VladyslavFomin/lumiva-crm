// src/integrations/dto/update-integration-connection.dto.ts
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  INTEGRATION_KINDS,
  type IntegrationKind,
} from '../integration-kind.enum';

export class UpdateIntegrationConnectionDto {
  /**
   * Новое имя интеграции (опционально)
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  /**
   * Тип интеграции — менять обычно не требуется
   * (но оставляем возможность)
   */
  @IsOptional()
  @IsString()
  @IsIn(INTEGRATION_KINDS as readonly string[])
  kind?: IntegrationKind;

  /**
   * Привязка к каналу продаж
   * Может быть:
   *  - UUID канала
   *  - null → отключить и пересоздать канал
   *  - undefined → не изменять
   */
  @IsOptional()
  @IsUUID()
  channelId?: string | null;

  /**
   * Описание интеграции
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string | null;

  /**
   * Конфигурация адаптера (URL, ключи)
   * Если undefined — не менять
   * Если {} — заменить на пустой объект
   * Если null — удалить configJson
   */
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  /**
   * Включена/выключена интеграция
   */
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  /**
   * Мягкое удаление
   */
  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;
}