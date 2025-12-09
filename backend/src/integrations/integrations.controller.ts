// src/integrations/integrations.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  IntegrationsService,
  type IntegrationConnectionDto,
} from './integrations.service';
import { CreateIntegrationConnectionDto } from './dto/create-integration-connection.dto';
import { UpdateIntegrationConnectionDto } from './dto/update-integration-connection.dto';
import { IntegrationRegistryService } from './integration-registry.service';
import type { IntegrationKind } from './integration-kind.enum';
import type {
  TestConnectionResult,
  SyncResult,
} from './sales-integration.adapter';

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly svc: IntegrationsService,
    private readonly registry: IntegrationRegistryService,
  ) {}

  /**
   * Список всех подключений интеграций
   * GET /v1/integrations
   */
  @Get()
  async list(): Promise<IntegrationConnectionDto[]> {
    return this.svc.findAll();
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
   * Создать подключение
   * POST /v1/integrations
   */
  @Post()
  async create(
    @Body() dto: CreateIntegrationConnectionDto,
  ): Promise<IntegrationConnectionDto> {
    return this.svc.create(dto);
  }

  /**
   * Получить одно подключение
   * GET /v1/integrations/:id
   */
  @Get(':id')
  async getOne(@Param('id') id: string): Promise<IntegrationConnectionDto> {
    return this.svc.findOne(id);
  }

  /**
   * Обновить подключение (имя, описание, канал, config, isEnabled и т.п.)
   * PATCH /v1/integrations/:id
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationConnectionDto,
  ): Promise<IntegrationConnectionDto> {
    return this.svc.update(id, dto);
  }

  /**
   * Мягкое удаление подключения
   * DELETE /v1/integrations/:id
   */
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ ok: true }> {
    await this.svc.softDelete(id);
    return { ok: true };
  }

  /**
   * Тест подключения
   * POST /v1/integrations/:id/test
   */
  @Post(':id/test')
  async test(@Param('id') id: string): Promise<TestConnectionResult> {
    return this.svc.testConnection(id);
  }

  /**
   * Запуск синхронизации
   * POST /v1/integrations/:id/sync
   */
  @Post(':id/sync')
  async sync(@Param('id') id: string): Promise<SyncResult> {
    return this.svc.sync(id);
  }
}