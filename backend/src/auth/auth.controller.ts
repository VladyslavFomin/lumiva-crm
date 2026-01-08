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
   * Только через reset/invite токен: { token, password }
   */
  @Post('set-password')
  async setPassword(
    @Body()
    body: {
      token?: string;
      password?: string;
    },
  ) {
    const { token, password } = body;

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

    throw new BadRequestException('Требуется токен сброса/инвайта');
  }

  /**
   * Публичный запрос на письмо для сброса пароля.
   * Body: { clientKey, email }
   */
  @Post('request-reset')
  async requestReset(
    @Body() body: { clientKey?: string; email?: string },
  ) {
    if (!body.clientKey || !body.email) {
      throw new BadRequestException('clientKey и email обязательны');
    }
    await this.authService.requestPasswordReset(body.clientKey, body.email);
    return { ok: true };
  }
}
