import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateProjectTableDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
