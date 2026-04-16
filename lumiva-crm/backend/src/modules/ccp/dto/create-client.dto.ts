import { IsEmail, IsNumber, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CreateCcpClientMetaDto {
  @IsOptional()
  @IsNumber()
  ccp_acc_eur_balance?: number;

  @IsOptional()
  @IsNumber()
  ccp_acc_usd_balance?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ccp_acc_eur_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ccp_acc_usd_number?: string;
}

export class CreateCcpClientDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsString()
  @MaxLength(255)
  password: string;

  @IsOptional()
  @IsNumber()
  balanceEur?: number;

  @IsOptional()
  @IsNumber()
  balanceUsd?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CreateCcpClientMetaDto)
  meta?: CreateCcpClientMetaDto;
}
