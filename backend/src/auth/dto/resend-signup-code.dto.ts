import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ResendSignupCodeDto {
  @IsString()
  @IsNotEmpty()
  clientKey: string;

  @IsEmail()
  email: string;
}
