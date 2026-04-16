// src/custom-fields/dto/update-custom-field.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomFieldDto } from './create-custom-field.dto';

export class UpdateCustomFieldDto extends PartialType(CreateCustomFieldDto) {
  // Нельзя менять key и entityType после создания
}













