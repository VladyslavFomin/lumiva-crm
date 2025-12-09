// src/integrations/dto/create-integration-connection.dto.ts
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { INTEGRATION_KINDS, type IntegrationKind } from '../integration-kind.enum';

export class CreateIntegrationConnectionDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsIn(INTEGRATION_KINDS as readonly string[])
  kind!: IntegrationKind;

  @IsOptional()
  @IsUUID()
  channelId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string | null;

  // Конфиг (apiUrl, consumerKey, consumerSecret, ...)
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  // по умолчанию включено
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}