// backend/src/modules/ccp/dto/create-txn.dto.ts
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateCcpTxnDto {
  // ✅ ВАЖНО: если включён ValidationPipe({ transform:true }) — это гарантированно даст number
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? value : Number(value)))
  @IsInt()
  @Min(1)
  wpUserId!: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : String(value)))
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : String(value)))
  @IsString()
  @MaxLength(4000)
  desc?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : String(value)))
  @IsString()
  @MaxLength(32)
  date?: string; // YYYY-MM-DD

  // ===== Вариант A: amount + currency (как сейчас у тебя во фронте createTxn) =====

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : String(value).toUpperCase()))
  @IsIn(['EUR', 'USD'])
  currency?: 'EUR' | 'USD';

  // ✅ принимаем number|string, но храним как string
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : String(value)))
  @IsString()
  @MaxLength(64)
  amount?: string;

  // ===== Вариант B: прямые spendEur/spendUsd (если вдруг придут) =====
  // (не мешает варианту A; backend может выбрать приоритет)

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : String(value)))
  @IsString()
  @MaxLength(64)
  spendEur?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : String(value)))
  @IsString()
  @MaxLength(64)
  spendUsd?: string;

  // ===== статусы =====

  // ✅ WP post_status (publish/draft/...)
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
  ccpStatus?: string; // Done / In progress / Rejected / Insufficient funds
}