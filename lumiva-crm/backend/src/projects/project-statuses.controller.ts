// src/projects/project-statuses.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProjectStatusesService } from './project-statuses.service';
import { CreateProjectStatusDto } from './dto/create-project-status.dto';
import { UpdateProjectStatusDto } from './dto/update-project-status.dto';
import { ReorderProjectStatusesDto } from './dto/reorder-project-statuses.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';

@Controller('project-statuses')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ProjectStatusesController {
  constructor(private readonly service: ProjectStatusesService) {}

  @Get()
  @RequirePermission('projects', 'read')
  async findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.service.findAll(user.tenantId);
  }

  @Post()
  @RequirePermission('projects', 'write')
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateProjectStatusDto,
  ) {
    return this.service.create(user.tenantId, dto);
  }

  @Patch('reorder')
  @RequirePermission('projects', 'write')
  async reorder(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ReorderProjectStatusesDto,
  ) {
    return this.service.reorder(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermission('projects', 'write')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProjectStatusDto,
  ) {
    return this.service.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('projects', 'write')
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.service.delete(user.tenantId, id);
    return { success: true };
  }
}
