import { IsString, IsOptional, IsBoolean, IsInt, Matches, MaxLength } from 'class-validator';

export class UpdateProjectCurrencyDto {
  // См. CreateProjectCurrencyDto — crm_projects.currency это character(3).
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9]{3}$/)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  label?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsInt()
  order?: number;
}
