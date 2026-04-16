// src/automations/automations.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { RunAutomationNowDto } from './dto/run-automation-now.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';

@Controller('automations')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get()
  @RequirePermission('tools_automation', 'read')
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('isActive') isActive?: string,
  ) {
    const active = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.automationsService.findAll(user.tenantId, active);
  }

  /** История запусков по всем сценариям тенанта */
  @Get('executions')
  @RequirePermission('tools_automation', 'read')
  async listExecutions(
    @CurrentUser() user: CurrentUserPayload,
    @Query('automationId') automationId?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const lim = limit ? parseInt(limit, 10) : 100;
    return this.automationsService.getExecutions(
      user.tenantId,
      automationId,
      lim,
      status,
    );
  }

  /** Сводка: запуски, топ сценариев, распределение по триггерам */
  @Get('usage')
  @RequirePermission('tools_automation', 'read')
  async usage(
    @CurrentUser() user: CurrentUserPayload,
    @Query('days') days?: string,
  ) {
    const d = days ? parseInt(days, 10) : 30;
    return this.automationsService.getUsageStats(user.tenantId, d);
  }

  @Post()
  @RequirePermission('tools_automation', 'write')
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateAutomationDto,
  ) {
    return this.automationsService.create(user.tenantId, dto);
  }

  /** Ручной запуск сценария (например отчёт «отправить сейчас») */
  @Post(':id/run-now')
  @RequirePermission('tools_automation', 'write')
  async runNow(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RunAutomationNowDto,
  ) {
    return this.automationsService.runNow(user.tenantId, id, dto);
  }

  @Get(':id/executions')
  @RequirePermission('tools_automation', 'read')
  async getExecutionsForOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const lim = limit ? parseInt(limit, 10) : 100;
    return this.automationsService.getExecutions(
      user.tenantId,
      id,
      lim,
      status,
    );
  }

  @Get(':id')
  @RequirePermission('tools_automation', 'read')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.automationsService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermission('tools_automation', 'write')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    return this.automationsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('tools_automation', 'delete')
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.automationsService.delete(user.tenantId, id);
    return { success: true };
  }
}
