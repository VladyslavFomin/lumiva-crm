import { Allow, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMarketingIntegrationDto {
  @IsString()
  @MaxLength(80)
  provider: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  kind?: string;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  primaryId?: string;

  /**
   * Дублируем JSON сюда: даже если вложенный `settings` потерялся (whitelist/прокси/старый клиент),
   * это поле явно в DTO и сохранится в settings.serviceAccountJson.
   */
  @IsOptional()
  @IsString()
  ga4ServiceAccountJson?: string;

  /** @Allow без @IsObject — иначе часть клиентов/прокси может сломать валидацию вложенного объекта. */
  @IsOptional()
  @Allow()
  settings?: Record<string, unknown>;
}