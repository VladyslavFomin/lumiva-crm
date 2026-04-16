// src/auth/dto/set-password.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SetPasswordDto {
  @IsString()
  clientKey: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}