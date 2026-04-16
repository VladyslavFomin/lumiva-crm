import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Старт OAuth GA4 (Data API) — платформенный Google OAuth client, refresh на интеграции тенанта.
 */
export class Ga4OAuthStartDto {
  @IsIn(['create', 'reconnect'])
  intent!: 'create' | 'reconnect';

  @IsOptional()
  @IsUUID('4')
  integrationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  redirectPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  primaryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}
