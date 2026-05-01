import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateWorkspaceAreaDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(48)
  iconKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  iconColor?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsObject()
  meta?: Record<string, any> | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
