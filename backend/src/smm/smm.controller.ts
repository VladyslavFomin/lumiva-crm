// src/smm/smm.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.interface';

import { SmmService, type ImportSmmStatItem } from './smm.service';

@Controller('smm')
export class SmmController {
  constructor(private readonly smmService: SmmService) {}

  // -------- UI: профили --------

  @Get('profiles')
  @UseGuards(JwtAuthGuard)
  async listProfiles(@CurrentUser() user: CurrentUserPayload) {
    return this.smmService.listProfilesWithLastStat(user.tenantId);
  }

  @Post('profiles')
  @UseGuards(JwtAuthGuard)
  async createProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      platform: 'instagram' | 'facebook' | 'vk' | 'tiktok' | 'other';
      handle: string;
      url?: string;
      note?: string;
    },
  ) {
    return this.smmService.createProfile(user.tenantId, body);
  }

  @Delete('profiles/:id')
  @UseGuards(JwtAuthGuard)
  async deleteProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.smmService.deleteProfile(user.tenantId, id);
    return { success: true };
  }

  // -------- UI: сводка по статам --------

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(
    @CurrentUser() user: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const stats = await this.smmService.getStatsForTenant(
      user.tenantId,
      from,
      to,
    );

    return {
      from: from ?? null,
      to: to ?? null,
      items: stats.map((s) => ({
        date: s.date,
        platform: s.profile?.platform ?? 'other',
        profileId: s.profileId,
        followers: s.followers,
        impressions: s.impressions,
        reach: s.reach,
        profileViews: s.profileViews,
        likes: s.likes,
        comments: s.comments,
        videoViews: s.videoViews,
      })),
    };
  }

  // -------- ETL: импорт из n8n --------
  // вызывается без JWT, только по X-Api-Token

  @Post('stats/import')
  @UseGuards(ApiTokenGuard)
  async importStats(
    @Req() req: Request,
    @Body()
    body: {
      items: ImportSmmStatItem[];
    },
  ) {
    const tenantId = (req as any).tenantId as string;
    const items = Array.isArray(body.items) ? body.items : [];
    await this.smmService.importStats(tenantId, items);
    return { success: true, imported: items.length };
  }

  // -------- META OAUTH --------

  @Get('meta/auth-url')
  @UseGuards(JwtAuthGuard)
  async getMetaAuthUrl(
    @CurrentUser() user: CurrentUserPayload,
    @Query('redirect') redirect?: string,
  ) {
    return this.smmService.getMetaAuthUrl(user.tenantId, redirect);
  }

  @Get('meta/callback')
  async metaCallback(
    @Res() res: any,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ) {
    const redirectUrl = await this.smmService.handleMetaCallback(code, state);
    return res.redirect(redirectUrl);
  }

  @Get('meta/assets')
  @UseGuards(JwtAuthGuard)
  async listMetaAssets(@CurrentUser() user: CurrentUserPayload) {
    return this.smmService.listMetaAssets(user.tenantId);
  }

  @Get('meta/debug')
  @UseGuards(JwtAuthGuard)
  async debugMeta(@CurrentUser() user: CurrentUserPayload) {
    return this.smmService.debugMeta(user.tenantId);
  }

  @Post('meta/sync')
  @UseGuards(JwtAuthGuard)
  async syncMeta(
    @CurrentUser() user: CurrentUserPayload,
    @Query('days') days?: string,
  ) {
    const parsed = days ? Number(days) : 1;
    if (parsed && parsed > 1) {
      return this.smmService.syncMetaProfilesRange(user.tenantId, parsed);
    }
    return this.smmService.syncMetaProfiles(user.tenantId);
  }

  @Post('meta/connect')
  @UseGuards(JwtAuthGuard)
  async connectMetaProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      platform: 'facebook' | 'instagram';
      pageId?: string;
      igUserId?: string;
    },
  ) {
    return this.smmService.connectMetaProfile(user.tenantId, body);
  }

  // -------- VK OAUTH --------

  @Get('vk/auth-url')
  @UseGuards(JwtAuthGuard)
  async getVkAuthUrl(
    @CurrentUser() user: CurrentUserPayload,
    @Query('redirect') redirect?: string,
  ) {
    return this.smmService.getVkAuthUrl(user.tenantId, redirect);
  }

  @Get('vk/callback')
  async vkCallback(
    @Res() res: any,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ) {
    const redirectUrl = await this.smmService.handleVkCallback(code, state);
    return res.redirect(redirectUrl);
  }

  @Get('vk/assets')
  @UseGuards(JwtAuthGuard)
  async listVkAssets(@CurrentUser() user: CurrentUserPayload) {
    return this.smmService.listVkAssets(user.tenantId);
  }

  @Post('vk/connect')
  @UseGuards(JwtAuthGuard)
  async connectVkGroup(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: { groupId?: number; screenName?: string },
  ) {
    return this.smmService.connectVkGroup(user.tenantId, body);
  }

  @Post('vk/sync')
  @UseGuards(JwtAuthGuard)
  async syncVk(
    @CurrentUser() user: CurrentUserPayload,
    @Query('days') days?: string,
  ) {
    const parsed = days ? Number(days) : 1;
    if (parsed && parsed > 1) {
      return this.smmService.syncVkProfilesRange(user.tenantId, parsed);
    }
    return this.smmService.syncVkProfiles(user.tenantId);
  }
}
