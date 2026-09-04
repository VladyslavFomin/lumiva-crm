import { IsString, IsOptional, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateProjectTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  value: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;
}
