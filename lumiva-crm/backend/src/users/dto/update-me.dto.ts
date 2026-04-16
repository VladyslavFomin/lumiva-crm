// src/users/dto/update-me.dto.ts
import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  /** Полный https URL или загруженный файл `/v1/uploads/...` */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(/^https?:\/\/\S+$|^\/v1\/uploads\/\S+$/, {
    message: 'avatarUrl: https://… или /v1/uploads/…',
  })
  avatarUrl?: string;
}