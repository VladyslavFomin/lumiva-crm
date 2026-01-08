import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCcpTransferDto {
  @IsNumber()
  fromUserId!: number;

  @IsNumber()
  toUserId!: number;

  // ✅ number|string -> string
  @Transform(({ value }) => (value === undefined || value === null ? '' : String(value)))
  @IsString()
  @MaxLength(64)
  amount!: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : String(value)))
  @IsString()
  @MaxLength(64)
  rate?: string;

  @IsOptional()
  @IsIn(['EUR', 'USD'])
  fromCurrency?: 'EUR' | 'USD';

  @IsOptional()
  @IsIn(['EUR', 'USD'])
  toCurrency?: 'EUR' | 'USD';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  desc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  date?: string;

  // ✅ WP post_status (publish/draft) — если нужно
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : String(value)))
  @IsString()
  @MaxLength(64)
  status?: string;

  // ✅ бизнес-статус
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : String(value)))
  @IsString()
  @MaxLength(64)
  ccpStatus?: string; // Done / In progress / Rejected
}