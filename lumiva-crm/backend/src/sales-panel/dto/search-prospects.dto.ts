import { IsBooleanString, IsOptional, IsString, MinLength } from 'class-validator';

export class SearchProspectsDto {
  @IsString()
  @MinLength(1)
  city: string;

  @IsString()
  @MinLength(1)
  businessType: string;

  @IsOptional()
  @IsString()
  pageToken?: string;

  /** Re-fetch Place Details even if we already have a cached (non-stale) copy. */
  @IsOptional()
  @IsBooleanString()
  refresh?: string;
}
