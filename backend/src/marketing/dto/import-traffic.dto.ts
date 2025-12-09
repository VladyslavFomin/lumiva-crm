// backend/src/marketing/dto/import-traffic.dto.ts
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ImportTrafficItemDto {
  @IsDateString()
  date: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  @MaxLength(128)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  medium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  campaign?: string;

  @IsInt()
  sessions: number;

  @IsOptional()
  @IsInt()
  clicks?: number;

  @IsOptional()
  @IsInt()
  leads?: number;

  @IsNumber()
  cost: number;

  @IsOptional()
  @IsNumber()
  revenue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}

export class ImportTrafficDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTrafficItemDto)
  @IsNotEmpty()
  items: ImportTrafficItemDto[];
}