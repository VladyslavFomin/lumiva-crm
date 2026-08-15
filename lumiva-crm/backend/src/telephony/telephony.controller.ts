// src/telephony/telephony.controller.ts
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { TelephonyService } from './telephony.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { TelephonyAddonGuard } from './telephony-addon.guard';

@Controller('telephony')
@UseGuards(JwtAuthGuard, TelephonyAddonGuard, RbacGuard)
export class TelephonyController {
  constructor(private readonly telephony: TelephonyService) {}

  @Get('config')
  @RequirePermission('telephony', 'read')
  async getConfig(@CurrentUser() user: CurrentUserPayload) {
    const config = await this.telephony.getConfig(user.tenantId);
    if (!config) return null;
    const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    return {
      ...config,
      authToken: config.authToken ? '••••••••' : null,
      inboundWebhookUrl: base ? `${base}/v1/webhooks/telephony/inbound/${user.tenantId}` : null,
    };
  }

  @Patch('config')
  @RequirePermission('telephony', 'write')
  async saveConfig(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { accountSid?: string; authToken?: string; voiceNumber?: string; forwardToNumbers?: string[]; isEnabled?: boolean },
  ) {
    return this.telephony.saveConfig(user.tenantId, body);
  }

  @Delete('config')
  @RequirePermission('telephony', 'write')
  async deleteConfig(@CurrentUser() user: CurrentUserPayload) {
    await this.telephony.deleteConfig(user.tenantId);
    return { success: true };
  }

  @Post('calls')
  @RequirePermission('telephony', 'write')
  async initiateCall(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { to: string; leadId?: string },
  ) {
    return this.telephony.initiateCall(user.tenantId, user.userId ?? user.id ?? user.sub, body.to, body.leadId);
  }

  @Get('calls')
  @RequirePermission('telephony', 'read')
  async findCalls(
    @CurrentUser() user: CurrentUserPayload,
    @Query('search') search?: string,
    @Query('tag') tag?: string,
    @Query('leadId') leadId?: string,
    @Query('direction') direction?: 'inbound' | 'outbound' | 'missed',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.telephony.findCalls(user.tenantId, {
      search, tag, linkedLeadId: leadId, direction,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('calls/:id/recording')
  @RequirePermission('telephony', 'read')
  async getRecording(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const { buffer, contentType } = await this.telephony.fetchRecordingAudio(user.tenantId, id);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  }

  @Patch('calls/:id/tags')
  @RequirePermission('telephony', 'write')
  async updateTags(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { tags: string[] },
  ) {
    return this.telephony.updateTags(user.tenantId, id, body.tags || []);
  }

  @Get('stats')
  @RequirePermission('telephony', 'read')
  async getStats(@CurrentUser() user: CurrentUserPayload, @Query('days') days?: string) {
    return this.telephony.getStats(user.tenantId, days ? parseInt(days, 10) : undefined);
  }
}
