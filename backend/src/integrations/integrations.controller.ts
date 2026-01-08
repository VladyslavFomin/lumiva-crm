// src/integrations/integrations.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  IntegrationsService,
  type IntegrationConnectionDto,
} from './integrations.service';

import { CreateIntegrationConnectionDto } from './dto/create-integration-connection.dto';
import { UpdateIntegrationConnectionDto } from './dto/update-integration-connection.dto';

import { IntegrationRegistryService } from './integration-registry.service';
import type { IntegrationKind } from './integration-kind.enum';
import type { TestConnectionResult, SyncResult } from './sales-integration.adapter';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly svc: IntegrationsService,
    private readonly registry: IntegrationRegistryService,
  ) {}

  /**
   * Список всех подключений интеграций ТОЛЬКО своего tenant
   * GET /v1/integrations
   */
  @Get()
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
  async listAdapters(): Promise<{ kind: IntegrationKind; label: string }[]> {
    return this.registry.listAdapters();
  }

  /**
   * Создать подключение (в рамках своего tenant)
   * POST /v1/integrations
   */
  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateIntegrationConnectionDto,
  ): Promise<IntegrationConnectionDto> {
    return this.svc.createForTenant(user.tenantId, dto);
  }

  /**
   * Получить одно подключение (в рамках своего tenant)
   * GET /v1/integrations/:id
   */
  @Get(':id')
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
  async sync(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<SyncResult> {
    return this.svc.syncForTenant(user.tenantId, id);
  }
}