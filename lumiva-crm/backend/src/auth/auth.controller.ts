// backend/src/auth/auth.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { StaffUsersService } from '../staff/staff-users.service';
import { VerifySignupCodeDto } from './dto/verify-signup-code.dto';
import { ResendSignupCodeDto } from './dto/resend-signup-code.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly staffUsers: StaffUsersService,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req);
  }

  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('verify-signup-code')
  async verifySignupCode(
    @Body() dto: VerifySignupCodeDto,
    @Req() req: Request,
  ) {
    return this.authService.verifySignupCode(dto, req);
  }

  @Post('resend-signup-code')
  async resendSignupCode(@Body() dto: ResendSignupCodeDto) {
    return this.authService.resendSignupCode(dto);
  }

  /**
   * POST /auth/verify-2fa — второй шаг логина, когда login() вернул { twoFactorRequired: true }.
   * Body: { challengeToken, code } — code принимает и 6-значный TOTP, и резервный код.
   */
  @Post('verify-2fa')
  async verifyTwoFactor(
    @Body() body: { challengeToken?: string; code?: string },
    @Req() req: Request,
  ) {
    if (!body.challengeToken || !body.code) {
      throw new BadRequestException('challengeToken и code обязательны');
    }
    return this.authService.verifyTwoFactorLogin(body.challengeToken, body.code, req);
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
