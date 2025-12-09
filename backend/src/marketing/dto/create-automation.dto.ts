import { IsBoolean, IsOptional, IsString, MaxLength, IsUrl } from 'class-validator';

export class CreateAutomationDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  type?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(255)
  webhookUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  meta?: any;
}