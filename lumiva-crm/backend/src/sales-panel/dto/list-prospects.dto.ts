import { IsBooleanString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { SalesOutreachStatus } from '../sales-prospect.entity';

export class ListProspectsDto {
  @IsOptional()
  @IsIn(['not_contacted', 'sent', 'replied', 'skipped'])
  status?: SalesOutreachStatus;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBooleanString()
  hasWebsite?: string;

  @IsOptional()
  @IsBooleanString()
  hasEmail?: string;

  @IsOptional()
  @IsBooleanString()
  hasPhone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
