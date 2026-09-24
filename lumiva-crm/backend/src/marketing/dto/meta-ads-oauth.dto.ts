import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class MetaAdsOAuthStartDto {
  /** Путь на фронте после OAuth (только относительный). */
  @IsOptional()
  @IsString()
  @MaxLength(400)
  redirectPath?: string;
}

export class MetaAdsAccountPickDto {
  /** ID рекламного аккаунта (цифры, с префиксом act_ или без). */
  @IsString()
  @MaxLength(40)
  id: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}

export class MetaAdsConnectDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => MetaAdsAccountPickDto)
  accounts: MetaAdsAccountPickDto[];
}
