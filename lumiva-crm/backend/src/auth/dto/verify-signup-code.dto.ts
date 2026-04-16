import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifySignupCodeDto {
  @IsString()
  @IsNotEmpty()
  clientKey: string;

  @IsEmail()
  email: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}
