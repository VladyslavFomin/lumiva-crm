import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import type { InstagramAccountSettings } from './instagram-account.entity';
import { InstagramCrmService } from './instagram-crm.service';

@Controller('instagram-crm')
export class InstagramCrmController {
  constructor(private readonly svc: InstagramCrmService) {}

  /** Возврат из Facebook Login — без JWT, тенант берётся из подписанного state. */
  @Get('oauth/callback')
  async oauthCallback(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    return res.redirect(await this.svc.handleOAuthCallback(code, state, error));
  }

  @Get('oauth/start')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('instagram', 'write')
  start(@CurrentUser() user: CurrentUserPayload) {
    return this.svc.getAuthUrl(user.tenantId);
  }

  @Get('accounts')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('instagram', 'read')
  accounts(@CurrentUser() user: CurrentUserPayload) {
    return this.svc.listAccounts(user.tenantId);
  }

  @Patch('accounts/:id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('instagram', 'write')
  updateAccount(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: InstagramAccountSettings,
  ) {
    return this.svc.updateSettings(user.tenantId, id, body || {});
  }

  @Delete('accounts/:id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('instagram', 'write')
  disconnect(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.disconnect(user.tenantId, id);
  }

  @Get('contacts')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('instagram', 'read')
  contacts(
    @CurrentUser() user: CurrentUserPayload,
    @Query('search') search?: string,
    @Query('accountId') accountId?: string,
    @Query('leadId') leadId?: string,
  ) {
    return this.svc.findContacts(user.tenantId, { search, accountId, leadId });
  }

  @Post('contacts/:id/read')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('instagram', 'read')
  async read(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.svc.markRead(user.tenantId, id);
    return { success: true };
  }

  @Post('contacts/:id/create-lead')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('instagram', 'write')
  createLead(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.createLeadForContact(user.tenantId, id);
  }

  @Get('messages')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('instagram', 'read')
  messages(
    @CurrentUser() user: CurrentUserPayload,
    @Query('contactId', new ParseUUIDPipe()) contactId: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findMessages(user.tenantId, contactId, limit ? parseInt(limit, 10) || 200 : 200);
  }

  @Post('send')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('instagram', 'write')
  send(@CurrentUser() user: CurrentUserPayload, @Body() body: { contactId?: string; text?: string }) {
    return this.svc.send(user.tenantId, String(body?.contactId || ''), String(body?.text || ''));
  }
}
