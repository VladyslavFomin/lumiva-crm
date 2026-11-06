// src/projects/project-statuses.controller.ts
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
import { normStatusKind, ProjectStatusesService } from './project-statuses.service';
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
  async findAll(@CurrentUser() user: CurrentUserPayload, @Query('kind') kind?: string) {
    return this.service.findAll(user.tenantId, normStatusKind(kind));
  }

  @Post()
  @RequirePermission('projects', 'write')
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateProjectStatusDto,
    @Query('kind') kind?: string,
  ) {
    return this.service.create(user.tenantId, dto, normStatusKind(kind));
  }

  @Patch('reorder')
  @RequirePermission('projects', 'write')
  async reorder(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ReorderProjectStatusesDto,
    @Query('kind') kind?: string,
  ) {
    return this.service.reorder(user.tenantId, dto, normStatusKind(kind));
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
