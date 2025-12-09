import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

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

  @IsOptional()
  settings?: any;
}