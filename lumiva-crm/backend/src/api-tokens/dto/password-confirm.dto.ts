import { IsString, MinLength } from 'class-validator';

export class PasswordConfirmDto {
  @IsString()
  @MinLength(1, { message: 'password_required' })
  password!: string;
}
