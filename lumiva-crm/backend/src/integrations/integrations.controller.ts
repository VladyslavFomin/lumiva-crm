// src/integrations/integrations.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import {
  IntegrationsService,
  type GoogleCalendarEventSnapshotDto,
  type IntegrationConnectionDto,
} from './integrations.service';

import { CreateIntegrationConnectionDto } from './dto/create-integration-connection.dto';
import { UpdateIntegrationConnectionDto } from './dto/update-integration-connection.dto';

import { IntegrationRegistryService } from './integration-registry.service';
import type { IntegrationKind } from './integration-kind.enum';
import type { TestConnectionResult, SyncResult } from './sales-integration.adapter';
import { WooWorkspacePreviewDto } from './dto/woo-workspace-preview.dto';
import { SyncIntegrationDto } from './dto/sync-integration.dto';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { IntegrationHubCatalogService } from './catalog/integration-hub-catalog.service';
import type { IntegrationHubCatalogEntry } from './catalog/integration-hub.types';
import { GoogleSheetsSyncService } from './google-sheets/google-sheets-sync.service';
import { GoogleSheetsPreviewDto } from './dto/google-sheets-preview.dto';
import type {
  GoogleSheetsPreviewResult,
} from './google-sheets/google-sheets-sync.service';
import { GoogleCalendarOAuthStartDto } from './dto/google-calendar-oauth-start.dto';
import { GoogleCalendarOAuthService } from './google-calendar/google-calendar-oauth.service';
import { OutlookCalendarOAuthStartDto } from './dto/outlook-calendar-oauth-start.dto';
import { OutlookCalendarOAuthService } from './outlook/outlook-calendar-oauth.service';
import { SlackOAuthService } from './slack/slack-oauth.service';
import { HubspotOAuthService } from './hubspot/hubspot-oauth.service';
import { MailchimpOAuthService } from './mailchimp/mailchimp-oauth.service';
import { JiraOAuthService } from './jira/jira-oauth.service';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly svc: IntegrationsService,
    private readonly registry: IntegrationRegistryService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly integrationHubCatalog: IntegrationHubCatalogService,
    private readonly googleSheetsSync: GoogleSheetsSyncService,
    private readonly googleCalendarOAuth: GoogleCalendarOAuthService,
    private readonly outlookCalendarOAuth: OutlookCalendarOAuthService,
    private readonly slackOAuth: SlackOAuthService,
    private readonly hubspotOAuth: HubspotOAuthService,
    private readonly mailchimpOAuth: MailchimpOAuthService,
    private readonly jiraOAuth: JiraOAuthService,
  ) {}

  /**
   * Список всех подключений интеграций ТОЛЬКО своего tenant
   * GET /v1/integrations
   */
  @Get()
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'read')
  async list(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<IntegrationConnectionDto[]> {
    return this.svc.findAllForTenant(user.tenantId);
  }

  /**
   * Список доступных адаптеров (WooCommerce и др.)
   * GET /v1/integrations/adapters
   */
  @Get('adapters')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'read')
  async listAdapters(): Promise<{ kind: IntegrationKind; label: string }[]> {
    return this.registry.listAdapters();
  }

  /**
   * Готовность OAuth-приложений платформы по каталогу (без секретов).
   * GET /v1/integrations/oauth-readiness
   */
  @Get('oauth-readiness')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'read')
  async oauthReadiness(): Promise<Record<string, { oauthReady: boolean }>> {
    return this.platformSettings.getIntegrationOauthReadinessMap();
  }

  /**
   * Каталог интеграций для CRM-хаба: модули и возможности (без секретов).
   * GET /v1/integrations/hub/catalog
   */
  @Get('hub/catalog')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'read')
  async getHubCatalog(): Promise<IntegrationHubCatalogEntry[]> {
    return this.integrationHubCatalog.getCatalog();
  }

  /**
   * Превью строк Google Sheets для настройки импорта (без сохранения подключения).
   * POST /v1/integrations/google-sheets/preview
   */
  @Post('google-sheets/preview')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'write')
  async previewGoogleSheets(
    @Body() dto: GoogleSheetsPreviewDto,
  ): Promise<GoogleSheetsPreviewResult> {
    return this.googleSheetsSync.previewSheet(dto);
  }

  /**
   * Превью Meta Ads из интеграции «Маркетинг» (не из каталога Автоматизаций).
   * POST /v1/integrations/marketing/:marketingId/meta-ads-workspace-preview
   */
  @Post('marketing/:marketingId/meta-ads-workspace-preview')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'write')
  async metaAdsWorkspacePreviewFromMarketing(
    @CurrentUser() user: CurrentUserPayload,
    @Param('marketingId') marketingId: string,
    @Body() body: WooWorkspacePreviewDto,
  ) {
    return this.svc.previewMetaAdsWorkspaceImportFromMarketing(
      user.tenantId,
      marketingId,
      body.customObjectId,
    );
  }

  /**
   * Импорт Meta Ads в таблицу из интеграции «Маркетинг».
   * POST /v1/integrations/marketing/:marketingId/meta-ads-workspace-sync
   */
  @Post('marketing/:marketingId/meta-ads-workspace-sync')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'write')
  async metaAdsWorkspaceSyncFromMarketing(
    @CurrentUser() user: CurrentUserPayload,
    @Param('marketingId') marketingId: string,
    @Body() body: SyncIntegrationDto,
  ) {
    const customObjectId = body?.customObjectId?.trim() || '';
    if (!body?.metaAdsWorkspaceImport) {
      throw new BadRequestException('Укажите metaAdsWorkspaceImport');
    }
    return this.svc.syncMetaAdsWorkspaceImportFromMarketing(
      user.tenantId,
      marketingId,
      customObjectId,
      body.metaAdsWorkspaceImport,
    );
  }

  /**
   * Превью GA4 из интеграции «Маркетинг».
   * POST /v1/integrations/marketing/:marketingId/ga4-workspace-preview
   */
  @Post('marketing/:marketingId/ga4-workspace-preview')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'write')
  async ga4WorkspacePreviewFromMarketing(
    @CurrentUser() user: CurrentUserPayload,
    @Param('marketingId') marketingId: string,
    @Body() body: WooWorkspacePreviewDto,
  ) {
    return this.svc.previewGa4WorkspaceImportFromMarketing(
      user.tenantId,
      marketingId,
      body.customObjectId,
    );
  }

  /**
   * Импорт GA4 в таблицу из интеграции «Маркетинг».
   * POST /v1/integrations/marketing/:marketingId/ga4-workspace-sync
   */
  @Post('marketing/:marketingId/ga4-workspace-sync')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'write')
  async ga4WorkspaceSyncFromMarketing(
    @CurrentUser() user: CurrentUserPayload,
    @Param('marketingId') marketingId: string,
    @Body() body: SyncIntegrationDto,
  ) {
    const customObjectId = body?.customObjectId?.trim() || '';
    if (!body?.ga4WorkspaceImport) {
      throw new BadRequestException('Укажите ga4WorkspaceImport');
    }
    return this.svc.syncGa4WorkspaceImportFromMarketing(
      user.tenantId,
      marketingId,
      customObjectId,
      body.ga4WorkspaceImport,
    );
  }

  /**
   * Создать подключение (в рамках своего tenant)
   * POST /v1/integrations
   */
  @Post()
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'write')
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateIntegrationConnectionDto,
  ): Promise<IntegrationConnectionDto> {
    return this.svc.createForTenant(user.tenantId, dto);
  }

  /**
   * OAuth Google Calendar (scope calendar.events). Зарегистрируйте redirect в Google Cloud:
   * `{PUBLIC_API_URL}/v1/integrations/google-calendar/oauth/callback`
   */
  @Post('google-calendar/oauth/start')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'write')
  async googleCalendarOauthStart(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: GoogleCalendarOAuthStartDto,
  ): Promise<{ url: string }> {
    const tenantId = user.tenantId;
    if (!tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }
    const uid = String(user.userId || user.id || user.sub || '').trim();
    if (!uid) {
      throw new BadRequestException('No user id in auth payload');
    }
    const url = await this.googleCalendarOAuth.buildAuthorizeUrl(tenantId, uid, body);
    return { url };
  }

  /**
   * Публичный callback Google (без JWT): целостность через подписанный state.
   */
  @Get('google-calendar/oauth/callback')
  async googleCalendarOauthCallback(
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
        `${frontend}/integrations-hub?tab=connections&googleCalendarOAuth=error`,
      );
    if (oauthError || !code?.trim() || !state?.trim()) {
      return fail();
    }
    try {
      const path = await this.googleCalendarOAuth.completeRedirect(
        code.trim(),
        state.trim(),
      );
      const rel = path.startsWith('/') ? path : `/${path}`;
      return res.redirect(`${frontend}${rel}`);
    } catch {
      return fail();
    }
  }

  /**
   * OAuth Outlook / Microsoft 365 Calendar (scope Calendars.ReadWrite). Зарегистрируйте redirect в Azure AD:
   * `{PUBLIC_API_URL}/v1/integrations/outlook-calendar/oauth/callback`
   */
  @Post('outlook-calendar/oauth/start')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'write')
  async outlookCalendarOauthStart(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: OutlookCalendarOAuthStartDto,
  ): Promise<{ url: string }> {
    const tenantId = user.tenantId;
    if (!tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }
    const uid = String(user.userId || user.id || user.sub || '').trim();
    if (!uid) {
      throw new BadRequestException('No user id in auth payload');
    }
    const url = await this.outlookCalendarOAuth.buildAuthorizeUrl(tenantId, uid, body);
    return { url };
  }

  /**
   * Публичный callback Microsoft (без JWT): целостность через подписанный state.
   */
  @Get('outlook-calendar/oauth/callback')
  async outlookCalendarOauthCallback(
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
        `${frontend}/integrations-hub?tab=connections&outlookCalendarOAuth=error`,
      );
    if (oauthError || !code?.trim() || !state?.trim()) {
      return fail();
    }
    try {
      const path = await this.outlookCalendarOAuth.completeRedirect(
        code.trim(),
        state.trim(),
      );
      const rel = path.startsWith('/') ? path : `/${path}`;
      return res.redirect(`${frontend}${rel}`);
    } catch {
      return fail();
    }
  }

  /**
   * OAuth Slack v2 (scope incoming-webhook). Зарегистрируйте redirect в api.slack.com/apps:
   * `{PUBLIC_API_URL}/v1/integrations/slack/oauth/callback`
   */
  @Post('slack/oauth/start')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'write')
  async slackOauthStart(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { redirectPath?: string },
  ): Promise<{ url: string }> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new BadRequestException('No tenant in auth payload');
    const uid = String(user.userId || user.id || user.sub || '').trim();
    if (!uid) throw new BadRequestException('No user id in auth payload');
    const url = await this.slackOAuth.buildAuthorizeUrl(tenantId, uid, body?.redirectPath);
    return { url };
  }

  /**
   * Публичный callback Slack (без JWT): целостность через подписанный state.
   */
  @Get('slack/oauth/callback')
  async slackOauthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Res() res: Response,
  ) {
    const frontend = (
      process.env.FRONTEND_URL || 'https://crm.lumiva.agency'
    ).replace(/\/$/, '');
    const fail = () =>
      res.redirect(`${frontend}/integrations-hub?tab=connections&slackOAuth=error`);
    if (oauthError || !code?.trim() || !state?.trim()) {
      return fail();
    }
    try {
      const path = await this.slackOAuth.completeRedirect(code.trim(), state.trim());
      const rel = path.startsWith('/') ? path : `/${path}`;
      return res.redirect(`${frontend}${rel}`);
    } catch {
      return fail();
    }
  }

  /**
   * OAuth HubSpot. Зарегистрируйте redirect в app.hubspot.com (Developer Account → App → Auth):
   * `{PUBLIC_API_URL}/v1/integrations/hubspot/oauth/callback`
   */
  @Post('hubspot/oauth/start')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'write')
  async hubspotOauthStart(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { redirectPath?: string },
  ): Promise<{ url: string }> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new BadRequestException('No tenant in auth payload');
    const uid = String(user.userId || user.id || user.sub || '').trim();
    if (!uid) throw new BadRequestException('No user id in auth payload');
    const url = await this.hubspotOAuth.buildAuthorizeUrl(tenantId, uid, body?.redirectPath);
    return { url };
  }

  /**
   * Публичный callback HubSpot (без JWT): целостность через подписанный state.
   */
  @Get('hubspot/oauth/callback')
  async hubspotOauthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Res() res: Response,
  ) {
    const frontend = (
      process.env.FRONTEND_URL || 'https://crm.lumiva.agency'
    ).replace(/\/$/, '');
    const fail = () =>
      res.redirect(`${frontend}/integrations-hub?tab=connections&hubspotOAuth=error`);
    if (oauthError || !code?.trim() || !state?.trim()) {
      return fail();
    }
    try {
      const path = await this.hubspotOAuth.completeRedirect(code.trim(), state.trim());
      const rel = path.startsWith('/') ? path : `/${path}`;
      return res.redirect(`${frontend}${rel}`);
    } catch {
      return fail();
    }
  }

  /**
   * OAuth Mailchimp. Зарегистрируйте redirect в admin.mailchimp.com (Account → Extras → Registered Apps):
   * `{PUBLIC_API_URL}/v1/integrations/mailchimp/oauth/callback`
   */
  @Post('mailchimp/oauth/start')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'write')
  async mailchimpOauthStart(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { redirectPath?: string },
  ): Promise<{ url: string }> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new BadRequestException('No tenant in auth payload');
    const uid = String(user.userId || user.id || user.sub || '').trim();
    if (!uid) throw new BadRequestException('No user id in auth payload');
    const url = await this.mailchimpOAuth.buildAuthorizeUrl(tenantId, uid, body?.redirectPath);
    return { url };
  }

  /**
   * Публичный callback Mailchimp (без JWT): целостность через подписанный state.
   */
  @Get('mailchimp/oauth/callback')
  async mailchimpOauthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Res() res: Response,
  ) {
    const frontend = (
      process.env.FRONTEND_URL || 'https://crm.lumiva.agency'
    ).replace(/\/$/, '');
    const fail = () =>
      res.redirect(`${frontend}/integrations-hub?tab=connections&mailchimpOAuth=error`);
    if (oauthError || !code?.trim() || !state?.trim()) {
      return fail();
    }
    try {
      const path = await this.mailchimpOAuth.completeRedirect(code.trim(), state.trim());
      const rel = path.startsWith('/') ? path : `/${path}`;
      return res.redirect(`${frontend}${rel}`);
    } catch {
      return fail();
    }
  }

  /**
   * OAuth Jira (Atlassian 3LO). Зарегистрируйте redirect в developer.atlassian.com/console/myapps:
   * `{PUBLIC_API_URL}/v1/integrations/jira/oauth/callback`
   */
  @Post('jira/oauth/start')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'write')
  async jiraOauthStart(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { redirectPath?: string },
  ): Promise<{ url: string }> {
    const tenantId = user.tenantId;
    if (!tenantId) throw new BadRequestException('No tenant in auth payload');
    const uid = String(user.userId || user.id || user.sub || '').trim();
    if (!uid) throw new BadRequestException('No user id in auth payload');
    const url = await this.jiraOAuth.buildAuthorizeUrl(tenantId, uid, body?.redirectPath);
    return { url };
  }

  /**
   * Публичный callback Jira (без JWT): целостность через подписанный state.
   */
  @Get('jira/oauth/callback')
  async jiraOauthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Res() res: Response,
  ) {
    const frontend = (
      process.env.FRONTEND_URL || 'https://crm.lumiva.agency'
    ).replace(/\/$/, '');
    const fail = () =>
      res.redirect(`${frontend}/integrations-hub?tab=connections&jiraOAuth=error`);
    if (oauthError || !code?.trim() || !state?.trim()) {
      return fail();
    }
    try {
      const path = await this.jiraOAuth.completeRedirect(code.trim(), state.trim());
      const rel = path.startsWith('/') ? path : `/${path}`;
      return res.redirect(`${frontend}${rel}`);
    } catch {
      return fail();
    }
  }

  /**
   * Снимок события из Google (Meet, участники, описание). Только события с меткой Lumiva в private props.
   * GET /v1/integrations/google-calendar/events/:eventId
   */
  @Get('google-calendar/events/:eventId')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'read')
  async googleCalendarEventSnapshot(
    @CurrentUser() user: CurrentUserPayload,
    @Param('eventId') eventId: string,
  ): Promise<GoogleCalendarEventSnapshotDto> {
    if (!user.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }
    return this.svc.getGoogleCalendarEventSnapshot(user.tenantId, eventId);
  }

  /**
   * Получить одно подключение (в рамках своего tenant)
   * GET /v1/integrations/:id
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'read')
  async getOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<IntegrationConnectionDto> {
    return this.svc.findOneForTenant(user.tenantId, id);
  }

  /**
   * Обновить подключение (в рамках своего tenant)
   * PATCH /v1/integrations/:id
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'write')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationConnectionDto,
  ): Promise<IntegrationConnectionDto> {
    return this.svc.updateForTenant(user.tenantId, id, dto);
  }

  /**
   * Мягкое удаление (в рамках своего tenant)
   * DELETE /v1/integrations/:id
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'write')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.svc.softDeleteForTenant(user.tenantId, id);
    return { ok: true };
  }

  /**
   * Тест подключения (в рамках своего tenant)
   * POST /v1/integrations/:id/test
   */
  @Post(':id/test')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'write')
  async test(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<TestConnectionResult> {
    return this.svc.testConnectionForTenant(user.tenantId, id);
  }

  /**
   * Превью заказов Woo как плоских колонок для импорта в таблицу рабочей области.
   * POST /v1/integrations/:id/woo-workspace-preview
   */
  @Post(':id/woo-workspace-preview')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'write')
  async wooWorkspacePreview(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: WooWorkspacePreviewDto,
  ) {
    return this.svc.previewWooWorkspaceImport(
      user.tenantId,
      id,
      body.customObjectId,
    );
  }

  /**
   * Превью данных Meta Ads (insights) для импорта в таблицу рабочей области.
   * POST /v1/integrations/:id/meta-ads-workspace-preview
   */
  @Post(':id/meta-ads-workspace-preview')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'write')
  async metaAdsWorkspacePreview(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: WooWorkspacePreviewDto,
  ) {
    return this.svc.previewMetaAdsWorkspaceImport(
      user.tenantId,
      id,
      body.customObjectId,
    );
  }

  /**
   * Запуск синхронизации (в рамках своего tenant)
   * POST /v1/integrations/:id/sync
   * Тело (опционально): { customObjectId, wooWorkspaceImport | metaAdsWorkspaceImport: { enabledWooColumns, wooColumnToFieldKey, statusFieldKey } }
   */
  @Post(':id/sync')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('tools_automation', 'write')
  async sync(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Query('customObjectId') customObjectIdQuery?: string,
    @Body() body?: SyncIntegrationDto,
  ): Promise<SyncResult> {
    const customObjectId =
      body?.customObjectId?.trim() || customObjectIdQuery?.trim() || undefined;
    return this.svc.syncForTenant(user.tenantId, id, {
      customObjectId,
      wooWorkspaceImport: body?.wooWorkspaceImport,
      metaAdsWorkspaceImport: body?.metaAdsWorkspaceImport,
    });
  }
}