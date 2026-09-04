// src/leads/dto/convert-lead.dto.ts
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConvertLeadDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  telegram?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  linkedin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  size?: string;

  @IsOptional()
  @IsBoolean()
  markWon?: boolean;
}
