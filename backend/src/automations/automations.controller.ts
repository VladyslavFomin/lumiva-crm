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

  @Get(':id')
  @RequirePermission('tools_automation', 'read')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.automationsService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermission('tools_automation', 'write')
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateAutomationDto,
  ) {
    console.log('Controller received DTO:', JSON.stringify(dto, null, 2));
    console.log('Actions in DTO:', JSON.stringify(dto.actions, null, 2));
    return this.automationsService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermission('tools_automation', 'write')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    console.log('Controller received update DTO:', JSON.stringify(dto, null, 2));
    if (dto.actions) {
      console.log('Actions in update DTO:', JSON.stringify(dto.actions, null, 2));
    }
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

  @Get(':id/executions')
  @RequirePermission('tools_automation', 'read')
  async getExecutions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('limit') limit?: string,
  ) {
    return this.automationsService.getExecutions(
      user.tenantId,
      id,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}

