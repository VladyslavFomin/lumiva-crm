// src/marketing/marketing.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Param,
  Delete,
  Patch,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.interface';

import { MarketingService } from './marketing.service';
import { ImportTrafficDto } from './dto/import-traffic.dto';
import { CreateUtmTemplateDto } from './dto/utm-template.dto';
import { CreateMarketingIntegrationDto } from './dto/create-marketing-integration.dto';
import { CreateAutomationDto } from './dto/create-automation.dto';

@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  // ===== ТРАФИК (UI, JWT) =====
  @Get('traffic')
  @UseGuards(JwtAuthGuard)
  async getTraffic(
    @CurrentUser() user: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.marketingService.getTrafficForTenant(
      user.tenantId,
      from,
      to,
    );
  }

  // ===== ИМПОРТ ТРАФИКА (n8n / GA4) — ТОЛЬКО ПО API-TOKEN =====
  @Post('traffic/import')
  @UseGuards(ApiTokenGuard)
  async importTraffic(
    @Req() req: Request,
    @Body() dto: ImportTrafficDto,
  ) {
    const tenantId = (req as any).tenantId as string;
    return this.marketingService.importTraffic(tenantId, dto);
  }

  // ===== UTM ТЕМПЛЕЙТЫ (JWT) =====
  @Get('utms/templates')
  @UseGuards(JwtAuthGuard)
  async listUtmTemplates(@CurrentUser() user: CurrentUserPayload) {
    return this.marketingService.listUtmTemplates(user.tenantId);
  }

  @Post('utms/templates')
  @UseGuards(JwtAuthGuard)
  async createUtmTemplate(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateUtmTemplateDto,
  ) {
    return this.marketingService.createUtmTemplate(user.tenantId, dto);
  }

  @Delete('utms/templates/:id')
  @UseGuards(JwtAuthGuard)
  async deleteUtmTemplate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.marketingService.deleteUtmTemplate(user.tenantId, id);
    return { success: true };
  }

  // ===== ИНТЕГРАЦИИ (JWT) =====
  @Get('integrations')
  @UseGuards(JwtAuthGuard)
  async listIntegrations(@CurrentUser() user: CurrentUserPayload) {
    return this.marketingService.listIntegrations(user.tenantId);
  }

  @Post('integrations')
  @UseGuards(JwtAuthGuard)
  async createIntegration(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateMarketingIntegrationDto,
  ) {
    return this.marketingService.createIntegration(user.tenantId, dto);
  }

  @Patch('integrations/:id')
  @UseGuards(JwtAuthGuard)
  async updateIntegration(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: Partial<CreateMarketingIntegrationDto>,
  ) {
    return this.marketingService.updateIntegration(
      user.tenantId,
      id,
      dto,
    );
  }

  @Post('integrations/:id/sync')
  @UseGuards(JwtAuthGuard)
  async syncIntegration(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.marketingService.syncIntegration(user.tenantId, id, from, to);
  }

  @Delete('integrations/:id')
  @UseGuards(JwtAuthGuard)
  async deleteIntegration(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.marketingService.deleteIntegration(user.tenantId, id);
    return { success: true };
  }

  // ===== АВТОМАТИЗАЦИИ (JWT) =====
  @Get('automations')
  @UseGuards(JwtAuthGuard)
  async listAutomations(@CurrentUser() user: CurrentUserPayload) {
    return this.marketingService.listAutomations(user.tenantId);
  }

  @Post('automations')
  @UseGuards(JwtAuthGuard)
  async createAutomation(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateAutomationDto,
  ) {
    return this.marketingService.createAutomation(
      user.tenantId,
      dto,
    );
  }

  @Patch('automations/:id')
  @UseGuards(JwtAuthGuard)
  async updateAutomation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: Partial<CreateAutomationDto>,
  ) {
    return this.marketingService.updateAutomation(
      user.tenantId,
      id,
      dto,
    );
  }

  @Delete('automations/:id')
  @UseGuards(JwtAuthGuard)
  async deleteAutomation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.marketingService.deleteAutomation(user.tenantId, id);
    return { success: true };
  }

  // ===== СЕГМЕНТЫ (пока заглушка, но под JWT) =====
  @Get('segments')
  @UseGuards(JwtAuthGuard)
  async getSegments(@CurrentUser() user: CurrentUserPayload) {
    return this.marketingService.getSegmentsForTenant(user.tenantId);
  }

  @Post('segments')
  @UseGuards(JwtAuthGuard)
  async createSegment() {
    return { ok: true };
  }

  @Post('segments/:id/run')
  @UseGuards(JwtAuthGuard)
  async runSegment() {
    return { ok: true, count: 0 };
  }

  // ===== SEO SETTINGS / METRICS =====
  @Get('seo/settings')
  @UseGuards(JwtAuthGuard)
  async getSeoSettings(@CurrentUser() user: CurrentUserPayload) {
    return this.marketingService.getSeoSettings(user.tenantId);
  }

  @Patch('seo/settings')
  @UseGuards(JwtAuthGuard)
  async updateSeoSettings(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      gscPropertyUrl?: string | null;
      pageSpeedApiKey?: string | null;
      pageSpeedUrl?: string | null;
      pageSpeedStrategy?: string | null;
    },
  ) {
    return this.marketingService.updateSeoSettings(user.tenantId, body);
  }

  @Get('seo/metrics')
  @UseGuards(JwtAuthGuard)
  async getSeoMetrics(
    @CurrentUser() user: CurrentUserPayload,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('compare') compare?: string,
  ) {
    return this.marketingService.getSeoMetrics(user.tenantId, {
      dateFrom,
      dateTo,
      compare: compare === '1' || compare === 'true',
    });
  }

  @Post('seo/sync')
  @UseGuards(JwtAuthGuard)
  async syncSeo(
    @CurrentUser() user: CurrentUserPayload,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('compare') compare?: string,
    @Body() body?: { dateFrom?: string; dateTo?: string; compare?: boolean },
  ) {
    const payload = body || {};
    return this.marketingService.syncSeoMetrics(user.tenantId, {
      dateFrom: payload.dateFrom || dateFrom,
      dateTo: payload.dateTo || dateTo,
      compare: typeof payload.compare === 'boolean'
        ? payload.compare
        : compare === '1' || compare === 'true',
    });
  }

  @Get('seo/google/auth-url')
  @UseGuards(JwtAuthGuard)
  async getGoogleAuthUrl(
    @CurrentUser() user: CurrentUserPayload,
    @Query('redirect') redirect?: string,
  ) {
    return this.marketingService.getGoogleAuthUrl(user.tenantId, redirect);
  }

  @Get('seo/google/callback')
  async googleCallback(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ) {
    const redirectUrl = await this.marketingService.handleGoogleCallback(code, state);
    return res.redirect(redirectUrl);
  }
}
