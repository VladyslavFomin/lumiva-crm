import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCustomObjectRecordDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalId?: string;

  @IsObject()
  values: Record<string, any>;

  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;
}

