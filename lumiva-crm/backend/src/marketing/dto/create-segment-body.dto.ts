import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Одна строка из отчёта Google/Meta (marketing_traffic) для сегмента лидов по UTM */
export class TrafficPresetFilterDto {
  @IsString()
  @MaxLength(80)
  @Matches(/^(meta_ads|google_ads(_\d{6,15})?)$/, {
    message: 'trafficPreset.dataSource invalid',
  })
  dataSource: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  source?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  medium?: string | null;

  @IsString()
  @MaxLength(256)
  campaign: string;
}

export class LeadSegmentFiltersDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  statuses?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sources?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  managers?: string[];

  @IsOptional()
  @IsString()
  createdFrom?: string;

  @IsOptional()
  @IsString()
  createdTo?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrafficPresetFilterDto)
  trafficPresets?: TrafficPresetFilterDto[];
}

export class CreateSegmentBodyDto {
  @IsString()
  @MaxLength(32)
  entityType: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LeadSegmentFiltersDto)
  filters?: LeadSegmentFiltersDto;
}
