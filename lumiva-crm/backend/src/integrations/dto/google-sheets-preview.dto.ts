import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Тело POST /integrations/google-sheets/preview — без сохранения подключения. */
export class GoogleSheetsPreviewDto {
  @IsString()
  @MinLength(20)
  @MaxLength(128)
  spreadsheetId!: string;

  @IsString()
  @MinLength(12)
  apiToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  sheetTabName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  headerRow?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  firstDataRow?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  lastDataRow?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(100)
  maxPreviewRows?: number;
}
