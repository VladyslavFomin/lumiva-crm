import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { AccountService } from './account.service';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  // ---------- сессии ----------

  @Get('sessions')
  listSessions(@CurrentUser() user: CurrentUserPayload) {
    return this.accountService.listSessions(user.tenantId, user.userId!, user.sessionId);
  }

  @Delete('sessions/:id')
  revokeSession(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.accountService.revokeSession(user.tenantId, user.userId!, user.name || user.email || null, id);
  }

  @Post('sessions/revoke-others')
  revokeOtherSessions(@CurrentUser() user: CurrentUserPayload) {
    if (!user.sessionId) throw new BadRequestException('No current session');
    return this.accountService.revokeOtherSessions(user.tenantId, user.userId!, user.name || user.email || null, user.sessionId);
  }

  // ---------- журнал безопасности ----------

  @Get('security-log')
  getSecurityLog(@CurrentUser() user: CurrentUserPayload) {
    return this.accountService.getSecurityLog(user.tenantId, user.userId!);
  }

  // ---------- API-ключи (сводка) ----------

  @Get('api-tokens-summary')
  getApiTokensSummary(@CurrentUser() user: CurrentUserPayload) {
    return this.accountService.getApiTokensSummary(user.tenantId);
  }

  // ---------- предпочтения ----------

  @Patch('preferences')
  updatePreferences(@CurrentUser() user: CurrentUserPayload, @Body() body: Record<string, any>) {
    return this.accountService.updatePreferences(user.userId!, body || {});
  }

  // ---------- 2FA ----------

  @Post('2fa/setup')
  setup2FA(@CurrentUser() user: CurrentUserPayload) {
    return this.accountService.setup2FA(user.userId!, user.email || '');
  }

  @Post('2fa/verify')
  verify2FA(@CurrentUser() user: CurrentUserPayload, @Body() body: { code?: string }) {
    if (!body.code) throw new BadRequestException('code обязателен');
    return this.accountService.verify2FASetup(user.tenantId, user.userId!, user.name || user.email || null, body.code);
  }

  @Post('2fa/disable')
  disable2FA(@CurrentUser() user: CurrentUserPayload, @Body() body: { password?: string }) {
    if (!body.password) throw new BadRequestException('password обязателен');
    return this.accountService.disable2FA(user.tenantId, user.userId!, user.name || user.email || null, body.password);
  }

  @Post('2fa/backup-codes/regenerate')
  regenerateBackupCodes(@CurrentUser() user: CurrentUserPayload, @Body() body: { password?: string }) {
    if (!body.password) throw new BadRequestException('password обязателен');
    return this.accountService.regenerateBackupCodes(user.tenantId, user.userId!, user.name || user.email || null, body.password);
  }

  // ---------- экспорт данных ----------

  @Get('export')
  async exportData(@CurrentUser() user: CurrentUserPayload, @Res() res: Response) {
    const data = await this.accountService.exportMyData(user.tenantId, user.userId!);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="lumiva-account-data.json"');
    res.send(JSON.stringify(data, null, 2));
  }

  // ---------- опасная зона ----------

  @Post('transfer-ownership')
  transferOwnership(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { targetStaffUserId?: string; password?: string },
  ) {
    if (!body.targetStaffUserId || !body.password) {
      throw new BadRequestException('targetStaffUserId и password обязательны');
    }
    return this.accountService.transferOwnership(
      user.tenantId,
      user.userId!,
      user.name || user.email || null,
      body.targetStaffUserId,
      body.password,
    );
  }

  @Post('delete-account')
  deleteAccount(@CurrentUser() user: CurrentUserPayload, @Body() body: { password?: string }) {
    if (!body.password) throw new BadRequestException('password обязателен');
    return this.accountService.deleteMyAccount(user.tenantId, user.userId!, user.name || user.email || null, body.password);
  }
}
