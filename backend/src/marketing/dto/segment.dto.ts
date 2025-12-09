// backend/src/marketing/dto/segment.dto.ts
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSegmentDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  // статусы лидов (raw-коды: new / in_progress / waiting / won / lost / ...)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  leadStatuses?: string[];

  // источник лида (Lead.source)
  @IsOptional()
  @IsString()
  source?: string;

  // страна (Lead.country, например RU, TR, DE)
  @IsOptional()
  @IsString()
  country?: string;

  // менеджер (Lead.assignedTo)
  @IsOptional()
  @IsString()
  manager?: string;

  // диапазон по дате создания лида, YYYY-MM-DD
  @IsOptional()
  @IsString()
  createdFrom?: string;

  @IsOptional()
  @IsString()
  createdTo?: string;
}

export class SegmentDto {
  id: string;
  name: string;
  description: string | null;
  leadStatuses: string[] | null;
  source: string | null;
  country: string | null;
  manager: string | null;
  createdFrom: string | null;
  createdTo: string | null;
  lastMatchedCount: number;
  lastRunAt: string | null;
  createdAt: string;
}