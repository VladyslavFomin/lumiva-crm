import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSalePaymentLinkDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  buyerName!: string;

  @IsEmail()
  @MaxLength(255)
  buyerEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  buyerPhone?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(500)
  address!: string;

  /** iyzico (по умолчанию) или paytr, если оба подключены */
  @IsOptional()
  @IsString()
  provider?: 'iyzico' | 'paytr';
}
