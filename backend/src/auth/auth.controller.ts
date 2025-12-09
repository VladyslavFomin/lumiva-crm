// backend/src/auth/auth.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { StaffUsersService } from '../staff/staff-users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly staffUsers: StaffUsersService,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /auth/set-password
   * Вариант 1: { token, password }  — через reset/invite токен
   * Вариант 2: { email, clientKey, password } — по ссылке из письма
   */
  @Post('set-password')
  async setPassword(
    @Body()
    body: {
      token?: string;
      email?: string;
      clientKey?: string;
      password?: string;
    },
  ) {
    const { token, email, clientKey, password } = body;

    if (!password) {
      throw new BadRequestException('password обязателен');
    }

    if (password.length < 8) {
      throw new BadRequestException(
        'Пароль должен быть не короче 8 символов',
      );
    }

    if (token) {
      // сценарий с reset/invite-токеном
      await this.staffUsers.completePasswordResetWithToken(token, password);
      return { ok: true };
    }

    if (!email || !clientKey) {
      throw new BadRequestException(
        'Нужен либо token, либо связка email + clientKey',
      );
    }

    await this.authService.setPasswordForEmailAndClient(
      email,
      clientKey,
      password,
    );

    return { ok: true };
  }
}