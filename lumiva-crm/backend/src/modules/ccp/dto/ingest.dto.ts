import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export type CcpIngestType = 'client.upsert' | 'txn.upsert' | 'transfer.upsert';

export class CcpIngestDto {
  @IsIn(['client.upsert', 'txn.upsert', 'transfer.upsert'])
  type: CcpIngestType;

  @IsOptional()
  @IsString()
  source?: string; // wp

  @IsOptional()
  @IsString()
  site?: string; // https://site.com/

  @IsOptional()
  @IsString()
  ts?: string; // ISO

  // тут payload разный для каждого типа — поэтому any, но хотя бы проверим что это object
  @IsObject()
  data: any;
}