// src/auth/password.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { StaffUsersService } from '../staff/staff-users.service';

@Controller('auth')
export class PasswordController {
  constructor(private readonly staffUsers: StaffUsersService) {}

  @Post('set-password-by-token')
  async setPasswordByToken(
    @Body()
    body: { token: string; password: string },
  ) {
    await this.staffUsers.setPasswordByToken(body.token, body.password);
    return { ok: true };
  }
}