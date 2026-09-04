import { IsString, IsOptional, IsInt, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateProjectTagDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  value?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;

  @IsOptional()
  @IsInt()
  order?: number;
}
