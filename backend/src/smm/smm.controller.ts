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
}