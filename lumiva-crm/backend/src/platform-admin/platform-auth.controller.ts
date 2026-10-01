// src/platform-admin/platform-auth.controller.ts
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { PlatformAuthService } from './platform-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly authService: PlatformAuthService) {}

  @Post('login')
  @Throttle({ short: { limit: 3, ttl: 1000 }, medium: { limit: 10, ttl: 60000 }, long: { limit: 30, ttl: 900000 } })
  @HttpCode(HttpStatus.CREATED) // 201, как у тебя
  async login(@Body() dto: AdminLoginDto) {
    return this.authService.login(dto.email, dto.password);
  }
}