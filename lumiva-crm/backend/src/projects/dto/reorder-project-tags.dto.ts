import { IsArray, IsUUID } from 'class-validator';

export class ReorderProjectTagsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  orderedIds: string[];
}
