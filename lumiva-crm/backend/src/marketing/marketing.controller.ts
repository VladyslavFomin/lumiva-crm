// src/marketing/marketing.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.interface';

import { MarketingService } from './marketing.service';
import { CreateUtmTemplateDto, UpdateUtmTemplateDto } from './dto/utm-template.dto';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { CreateSegmentBodyDto } from './dto/create-segment-body.dto';
import { CreateMarketingIntegrationDto } from './dto/create-marketing-integration.dto';
import { UpdateMarketingIntegrationDto } from './dto/update-marketing-integration.dto';
import { GoogleAdsOAuthStartDto } from './dto/google-ads-oauth-start.dto';
import { Ga4OAuthStartDto } from './dto/ga4-oauth-start.dto';

@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  private requireTenant(user: CurrentUserPayload): string {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }
    return user.tenantId;
  }

  // --- Traffic ---

  @Get('traffic')
  @UseGuards(JwtAuthGuard)
  async getTraffic(
    @CurrentUser() user: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('dataSource') dataSource?: string,
    @Query('itemsLimit') itemsLimitRaw?: string,
  ) {
    const tenantId = this.requireTenant(user);
    const parsed = parseInt(String(itemsLimitRaw ?? '').trim(), 10);
    const itemsLimit = Number.isFinite(parsed)
      ? Math.min(80_000, Math.max(2_000, parsed))
      : 14_000;
    return this.marketing.getTrafficChannelsStats(
      tenantId,
      from?.trim() || undefined,
      to?.trim() || undefined,
      dataSource?.trim() || undefined,
      itemsLimit,
    );
  }

  @Get('traffic/daily')
  @UseGuards(JwtAuthGuard)
  async getTrafficDaily(
    @CurrentUser() user: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('dataSource') dataSource?: string,
    @Query('onlyUnattributed') onlyUnattributedRaw?: string,
  ) {
    const onlyUnattributed =
      onlyUnattributedRaw === '1' ||
      onlyUnattributedRaw === 'true' ||
      onlyUnattributedRaw === 'yes';
    return this.marketing.getTrafficDailySeries(
      this.requireTenant(user),
      from?.trim() || undefined,
      to?.trim() || undefined,
      dataSource?.trim() || undefined,
      onlyUnattributed,
    );
  }

  @Get('traffic/by-country')
  @UseGuards(JwtAuthGuard)
  async getTrafficByCountry(
    @CurrentUser() user: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('dataSource') dataSource?: string,
    @Query('onlyUnattributed') onlyUnattributedRaw?: string,
  ) {
    const onlyUnattributed =
      onlyUnattributedRaw === '1' ||
      onlyUnattributedRaw === 'true' ||
      onlyUnattributedRaw === 'yes';
    return this.marketing.getTrafficByCountry(
      this.requireTenant(user),
      from?.trim() || undefined,
      to?.trim() || undefined,
      dataSource?.trim() || undefined,
      onlyUnattributed,
    );
  }

  @Post('traffic/import')
  @UseGuards(ApiTokenGuard)
  async importTraffic(@Req() req: Request, @Body() body: { items: any[] }) {
    const tenantId = (req as any).tenantId as string;
    return this.marketing.importTraffic(tenantId, body);
  }

  /**
   * Lumiva Wizard / CRM Connector (WordPress): заголовок X-Api-Token + тело { items: [...] }.
   * Документировано в плагине как /v1/marketing/leads/cf7.
   */
  @Post('leads/cf7')
  @UseGuards(ApiTokenGuard)
  async importCf7Wordpress(@Req() req: Request, @Body() body: { items?: unknown[] }) {
    const tenantId = (req as any).tenantId as string;
    return this.marketing.importCf7WordpressLeads(tenantId, body);
  }

  // --- UTM ---
  // Канон: utm-templates. Алиасы: utms/templates, utms — для мобильных клиентов и старых сборок фронта.

  @Get(['utm-templates', 'utms/templates', 'utms'])
  @UseGuards(JwtAuthGuard)
  listUtms(@CurrentUser() user: CurrentUserPayload) {
    return this.marketing.listUtmTemplates(this.requireTenant(user));
  }

  @Post(['utm-templates', 'utms/templates'])
  @UseGuards(JwtAuthGuard)
  createUtm(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateUtmTemplateDto,
  ) {
    return this.marketing.createUtmTemplate(this.requireTenant(user), dto);
  }

  @Patch(['utm-templates/:id', 'utms/templates/:id'])
  @UseGuards(JwtAuthGuard)
  updateUtm(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUtmTemplateDto,
  ) {
    return this.marketing.updateUtmTemplate(this.requireTenant(user), id, dto);
  }

  @Delete(['utm-templates/:id', 'utms/templates/:id'])
  @UseGuards(JwtAuthGuard)
  deleteUtm(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.marketing.deleteUtmTemplate(this.requireTenant(user), id);
  }

  /**
   * Раньше часть клиентов дергала /marketing/campaigns — маршрута не было (404).
   * Пустой список, чтобы не валить экраны; кампании в CRM пока ведутся иначе.
   */
  @Get('campaigns')
  @UseGuards(JwtAuthGuard)
  listCampaignsLegacy(@CurrentUser() user: CurrentUserPayload) {
    this.requireTenant(user);
    return [];
  }

  // --- Automations ---

  @Get('automations')
  @UseGuards(JwtAuthGuard)
  listAutomations(@CurrentUser() user: CurrentUserPayload) {
    return this.marketing.listAutomations(this.requireTenant(user));
  }

  @Post('automations')
  @UseGuards(JwtAuthGuard)
  createAutomation(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateAutomationDto,
  ) {
    return this.marketing.createAutomation(this.requireTenant(user), dto);
  }

  @Patch('automations/:id')
  @UseGuards(JwtAuthGuard)
  updateAutomation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    return this.marketing.updateAutomation(this.requireTenant(user), id, dto);
  }

  @Delete('automations/:id')
  @UseGuards(JwtAuthGuard)
  deleteAutomation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.marketing.deleteAutomation(this.requireTenant(user), id);
  }

  // --- Segments ---

  @Get('segments/ads-presets')
  @UseGuards(JwtAuthGuard)
  listAdsTrafficPresets(@CurrentUser() user: CurrentUserPayload) {
    return this.marketing.listAdsTrafficPresets(this.requireTenant(user));
  }

  @Get('segments')
  @UseGuards(JwtAuthGuard)
  listSegments(@CurrentUser() user: CurrentUserPayload) {
    return this.marketing.listSegments(this.requireTenant(user));
  }

  @Post('segments')
  @UseGuards(JwtAuthGuard)
  createSegment(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: CreateSegmentBodyDto,
  ) {
    return this.marketing.createSegment(this.requireTenant(user), body);
  }

  @Post('segments/:id/run')
  @UseGuards(JwtAuthGuard)
  runSegment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.marketing.runSegment(this.requireTenant(user), id);
  }

  // --- Интеграции маркетинга ---

  @Get('integrations/setup-hints')
  @UseGuards(JwtAuthGuard)
  marketingIntegrationSetupHints(@CurrentUser() user: CurrentUserPayload) {
    this.requireTenant(user);
    return this.marketing.getMarketingIntegrationSetupHints();
  }

  @Post('integrations/google-ads/oauth/start')
  @UseGuards(JwtAuthGuard)
  async googleAdsMarketingOauthStart(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: GoogleAdsOAuthStartDto,
  ) {
    const tenantId = this.requireTenant(user);
    const url = await this.marketing.buildGoogleAdsMarketingOAuthAuthorizeUrl(
      tenantId,
      user.userId,
      body,
    );
    return { url };
  }

  /**
   * Публичный callback Google (без JWT): целостность сессии через подписанный state.
   * Зарегистрируйте redirect URI в Google Cloud:
   * `{PUBLIC_API_URL}/v1/marketing/integrations/google-ads/oauth/callback`
   */
  @Get('integrations/google-ads/oauth/callback')
  async googleAdsMarketingOauthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Res() res: Response,
  ) {
    const frontend = (
      process.env.FRONTEND_URL || 'https://crm.lumiva.agency'
    ).replace(/\/$/, '');
    const fail = () =>
      res.redirect(
        `${frontend}/integrations-hub?tab=marketing&googleAdsOAuth=error`,
      );
    if (oauthError || !code?.trim() || !state?.trim()) {
      return fail();
    }
    try {
      const path = await this.marketing.completeGoogleAdsMarketingOAuthRedirect(
        code.trim(),
        state.trim(),
      );
      const rel = path.startsWith('/') ? path : `/${path}`;
      return res.redirect(`${frontend}${rel}`);
    } catch {
      return fail();
    }
  }

  @Post('integrations/ga4/oauth/start')
  @UseGuards(JwtAuthGuard)
  async ga4MarketingOauthStart(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: Ga4OAuthStartDto,
  ) {
    const tenantId = this.requireTenant(user);
    const url = await this.marketing.buildGa4MarketingOAuthAuthorizeUrl(
      tenantId,
      user.userId,
      body,
    );
    return { url };
  }

  /**
   * Callback GA4 OAuth (scope analytics.readonly). Зарегистрируйте в Google Cloud:
   * `{PUBLIC_API_URL}/v1/marketing/integrations/ga4/oauth/callback`
   */
  @Get('integrations/ga4/oauth/callback')
  async ga4MarketingOauthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Res() res: Response,
  ) {
    const frontend = (
      process.env.FRONTEND_URL || 'https://crm.lumiva.agency'
    ).replace(/\/$/, '');
    const fail = () =>
      res.redirect(`${frontend}/integrations-hub?tab=marketing&ga4OAuth=error`);
    if (oauthError || !code?.trim() || !state?.trim()) {
      return fail();
    }
    try {
      const path = await this.marketing.completeGa4MarketingOAuthRedirect(
        code.trim(),
        state.trim(),
      );
      const rel = path.startsWith('/') ? path : `/${path}`;
      return res.redirect(`${frontend}${rel}`);
    } catch {
      return fail();
    }
  }

  @Get('integrations')
  @UseGuards(JwtAuthGuard)
  listIntegrations(@CurrentUser() user: CurrentUserPayload) {
    return this.marketing.listMarketingIntegrations(this.requireTenant(user));
  }

  @Post('integrations')
  @UseGuards(JwtAuthGuard)
  createIntegration(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateMarketingIntegrationDto,
  ) {
    return this.marketing.createMarketingIntegration(this.requireTenant(user), dto);
  }

  @Patch('integrations/:id')
  @UseGuards(JwtAuthGuard)
  updateIntegration(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMarketingIntegrationDto,
  ) {
    return this.marketing.updateMarketingIntegration(
      this.requireTenant(user),
      id,
      dto,
    );
  }

  @Delete('integrations/:id')
  @UseGuards(JwtAuthGuard)
  deleteIntegration(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.marketing.deleteMarketingIntegration(this.requireTenant(user), id);
  }

  /** Курсы EUR/GBP/TRY/RUB для пересчёта расходов в отчётах маркетинга (Frankfurter / ECB). */
  @Get('fx-rates')
  @UseGuards(JwtAuthGuard)
  marketingFxRates(
    @Query('display') display?: string,
    @Query('force') forceRaw?: string,
  ) {
    const force = forceRaw === '1' || forceRaw === 'true' || forceRaw === 'yes';
    return this.marketing.getMarketingFxRates(display?.trim() || 'EUR', { force });
  }

  @Post('integrations/:id/sync')
  @UseGuards(JwtAuthGuard)
  async syncIntegration(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rowsSaved = await this.marketing.syncMarketingIntegrationById(
      this.requireTenant(user),
      id,
    );
    res.setHeader('X-Marketing-Sync-Rows', String(rowsSaved));
    const message = `Синхронизировано строк: ${rowsSaved}`;
    // Дублируем поля + готовая строка: внешние оболочки (pl1, виджеты) часто показывают только t('…{{count}}') без count.
    return {
      ok: true as const,
      rowsSaved,
      rows_saved: rowsSaved,
      syncedRows: rowsSaved,
      message,
      syncSummary: message,
    };
  }

  // --- Google Ads (ручной запуск из UI) ---

  @Post('sync/google-ads')
  @UseGuards(JwtAuthGuard)
  async syncGoogleAds(@CurrentUser() user: CurrentUserPayload) {
    const tenantId = this.requireTenant(user);
    await this.marketing.syncGoogleAdsForTenant(tenantId);
    return { ok: true };
  }

  // --- SEO ---

  @Get('seo/settings')
  @UseGuards(JwtAuthGuard)
  seoSettings(@CurrentUser() user: CurrentUserPayload) {
    return this.marketing.getSeoSettingsPublic(this.requireTenant(user));
  }

  @Patch('seo/settings')
  @UseGuards(JwtAuthGuard)
  patchSeoSettings(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: Partial<{
      gscPropertyUrl: string | null;
      pageSpeedApiKey: string | null;
      pageSpeedUrl: string | null;
      pageSpeedStrategy: string;
    }>,
  ) {
    return this.marketing.patchSeoSettings(this.requireTenant(user), body);
  }

  @Get('seo/google/auth-url')
  @UseGuards(JwtAuthGuard)
  async gscAuthUrl(
    @CurrentUser() user: CurrentUserPayload,
    @Query('redirect') redirect?: string,
  ) {
    const tenantId = this.requireTenant(user);
    const url = await this.marketing.buildGscAuthUrlAsync(
      tenantId,
      redirect?.trim() || '/app/marketing/seo',
    );
    return { url };
  }

  @Get('seo/google/callback')
  async gscCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') oauthError: string | undefined,
    @Res() res: Response,
  ) {
    const frontend = (
      process.env.FRONTEND_URL || 'https://crm.lumiva.agency'
    ).replace(/\/$/, '');
    const fail = (path = '/app/marketing/seo') =>
      res.redirect(`${frontend}${path}?seo=error`);

    if (oauthError || !code || !state) {
      return fail();
    }

    const decoded = this.marketing.decodeGscOauthState(state);
    if (!decoded) {
      return fail();
    }

    const apiBase = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
    if (!apiBase) {
      return fail();
    }
    const redirectUri = `${apiBase}/v1/marketing/seo/google/callback`;

    try {
      const refreshToken = await this.marketing.exchangeGscCode(
        code,
        redirectUri,
      );
      await this.marketing.saveGscRefreshToken(decoded.tenantId, refreshToken);
      const path = decoded.redirect?.startsWith('/')
        ? decoded.redirect
        : `/${decoded.redirect || 'app/marketing/seo'}`;
      return res.redirect(`${frontend}${path}?seo=connected`);
    } catch {
      return fail();
    }
  }

  @Get('seo/metrics')
  @UseGuards(JwtAuthGuard)
  seoMetrics(
    @CurrentUser() user: CurrentUserPayload,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('compare') compare?: string,
  ) {
    return this.marketing.getSeoMetrics(
      this.requireTenant(user),
      dateFrom,
      dateTo,
      compare === '1' || compare === 'true',
    );
  }

  @Post('seo/sync')
  @UseGuards(JwtAuthGuard)
  seoSync(
    @CurrentUser() user: CurrentUserPayload,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('compare') compare?: string,
  ) {
    return this.marketing.syncSeo(
      this.requireTenant(user),
      dateFrom,
      dateTo,
      compare === '1' || compare === 'true',
    );
  }
}
