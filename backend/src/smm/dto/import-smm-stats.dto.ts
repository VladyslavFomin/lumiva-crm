// backend/src/smm/dto/import-smm-stats.dto.ts
import { IsArray, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export type SmmPlatform = 'instagram' | 'facebook' | 'vk' | 'tiktok' | 'other';

export class ImportSmmStatItemDto {
  @IsString()
  date: string; // 'YYYY-MM-DD'

  @IsIn(['instagram', 'facebook', 'vk', 'tiktok', 'other'])
  platform: SmmPlatform;

  @IsString()
  handle: string; // @lumiva.agency без @ или с @ — решим в одном стиле

  @IsInt()
  @Min(0)
  followers: number;

  @IsInt()
  @Min(0)
  impressions: number;

  @IsInt()
  @Min(0)
  reach: number;

  @IsInt()
  @Min(0)
  profileViews: number;

  @IsInt()
  @Min(0)
  likes: number;

  @IsInt()
  @Min(0)
  comments: number;

  @IsInt()
  @Min(0)
  videoViews: number;
}

export class ImportSmmStatsDto {
  @IsArray()
  items: ImportSmmStatItemDto[];
}