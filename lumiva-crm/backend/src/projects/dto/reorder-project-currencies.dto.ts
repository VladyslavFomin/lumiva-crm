import { IsArray, IsUUID } from 'class-validator';

export class ReorderProjectCurrenciesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  orderedIds: string[];
}
