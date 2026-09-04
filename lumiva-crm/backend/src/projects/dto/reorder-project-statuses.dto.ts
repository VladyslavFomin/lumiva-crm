import { IsArray, IsUUID } from 'class-validator';

export class ReorderProjectStatusesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  orderedIds: string[];
}
