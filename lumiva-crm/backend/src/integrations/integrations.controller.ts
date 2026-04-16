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

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
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
  ) {}

  /**
   * Список всех подключений интеграций ТОЛЬКО своего tenant
   * GET /v1/integrations
   */
  @Get()
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  async listAdapters(): Promise<{ kind: IntegrationKind; label: string }[]> {
    return this.registry.listAdapters();
  }

  /**
   * Готовность OAuth-приложений платформы по каталогу (без секретов).
   * GET /v1/integrations/oauth-readiness
   */
  @Get('oauth-readiness')
  @UseGuards(JwtAuthGuard)
  async oauthReadiness(): Promise<Record<string, { oauthReady: boolean }>> {
    return this.platformSettings.getIntegrationOauthReadinessMap();
  }

  /**
   * Каталог интеграций для CRM-хаба: модули и возможности (без секретов).
   * GET /v1/integrations/hub/catalog
   */
  @Get('hub/catalog')
  @UseGuards(JwtAuthGuard)
  async getHubCatalog(): Promise<IntegrationHubCatalogEntry[]> {
    return this.integrationHubCatalog.getCatalog();
  }

  /**
   * Превью строк Google Sheets для настройки импорта (без сохранения подключения).
   * POST /v1/integrations/google-sheets/preview
   */
  @Post('google-sheets/preview')
  @UseGuards(JwtAuthGuard)
  async previewGoogleSheets(
    @Body() dto: GoogleSheetsPreviewDto,
  ): Promise<GoogleSheetsPreviewResult> {
    return this.googleSheetsSync.previewSheet(dto);
  }

  /**
   * Создать подключение (в рамках своего tenant)
   * POST /v1/integrations
   */
  @Post()
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
   * Снимок события из Google (Meet, участники, описание). Только события с меткой Lumiva в private props.
   * GET /v1/integrations/google-calendar/events/:eventId
   */
  @Get('google-calendar/events/:eventId')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  async test(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<TestConnectionResult> {
    return this.svc.testConnectionForTenant(user.tenantId, id);
  }

  /**
   * Запуск синхронизации (в рамках своего tenant)
   * POST /v1/integrations/:id/sync
   */
  @Post(':id/sync')
  @UseGuards(JwtAuthGuard)
  async sync(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<SyncResult> {
    return this.svc.syncForTenant(user.tenantId, id);
  }
}