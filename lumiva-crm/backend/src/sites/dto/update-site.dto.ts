import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSiteDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  /**
   * Частичное обновление переопределений модулей WordPress (ключи как в MODULE_KEYS).
   */
  @IsOptional()
  @IsObject()
  enabledModules?: Record<string, unknown>;
}
