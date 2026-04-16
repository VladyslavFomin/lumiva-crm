import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { CustomObjectViewType } from '../custom-object-view.entity';

export class CreateCustomObjectViewDto {
  @IsIn(['table', 'kanban', 'calendar'] satisfies CustomObjectViewType[])
  type: CustomObjectViewType;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

