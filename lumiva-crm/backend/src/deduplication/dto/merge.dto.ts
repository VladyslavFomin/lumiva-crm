import { IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';
import { DedupEntityType } from '../duplicate-pair.entity';

export class MergeDto {
  @IsEnum(['contact', 'lead', 'company', 'sale', 'segment'])
  entityType: DedupEntityType;

  @IsUUID()
  winnerId: string;

  @IsUUID()
  loserId: string;

  /** Карта: fieldName → 'winner' | 'loser' (какое значение брать) */
  @IsOptional()
  @IsObject()
  fieldMap?: Record<string, 'winner' | 'loser'>;
}
