import { IsOptional, IsString, MaxLength } from 'class-validator';

/** PATCH — все поля опциональны */
export class UpdateUtmTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  channelType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmMedium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  utmContent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  utmTerm?: string;
}

export class CreateUtmTemplateDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  channelType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmMedium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  utmContent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  utmTerm?: string;
}

/** Создание ссылки с метками (хранилище ссылок). */
export class CreateUtmLinkDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @IsString()
  @MaxLength(512)
  baseUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  channelType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmMedium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  utmContent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  utmTerm?: string;
}
