import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class WooWorkspaceImportDto {
  @IsArray()
  @IsString({ each: true })
  enabledWooColumns!: string[];

  @IsObject()
  wooColumnToFieldKey!: Record<string, string>;

  @IsOptional()
  @IsString()
  statusFieldKey?: string | null;

  @IsOptional()
  @IsIn(['full', 'aggregate'])
  importMode?: 'full' | 'aggregate';

  @ValidateIf((o: WooWorkspaceImportDto) => o.importMode === 'aggregate')
  @IsArray()
  @IsString({ each: true })
  aggregateGroupBySourceKeys?: string[];
}

/** Тело POST /integrations/:id/sync — опционально вместо query customObjectId */
export class SyncIntegrationDto {
  @IsOptional()
  @IsUUID()
  customObjectId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WooWorkspaceImportDto)
  wooWorkspaceImport?: WooWorkspaceImportDto;

  /** Тот же формат колонок/маппинга, что и у Woo — для импорта insights Meta Ads в таблицу. */
  @IsOptional()
  @ValidateNested()
  @Type(() => WooWorkspaceImportDto)
  metaAdsWorkspaceImport?: WooWorkspaceImportDto;

  /** Импорт строк GA4 (маркетинг) в таблицу рабочей области. */
  @IsOptional()
  @ValidateNested()
  @Type(() => WooWorkspaceImportDto)
  ga4WorkspaceImport?: WooWorkspaceImportDto;
}
