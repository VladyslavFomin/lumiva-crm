import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCustomObjectRecordDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalId?: string;

  @IsOptional()
  @IsObject()
  values?: Record<string, any>;

  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;
}

