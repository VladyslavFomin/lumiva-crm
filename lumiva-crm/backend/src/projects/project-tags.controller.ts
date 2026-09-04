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
import { ProjectTagsService } from './project-tags.service';
import { CreateProjectTagDto } from './dto/create-project-tag.dto';
import { UpdateProjectTagDto } from './dto/update-project-tag.dto';
import { ReorderProjectTagsDto } from './dto/reorder-project-tags.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';

@Controller('project-tags')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ProjectTagsController {
  constructor(private readonly service: ProjectTagsService) {}

  @Get()
  @RequirePermission('projects', 'read')
  async findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.service.findAll(user.tenantId);
  }

  @Post()
  @RequirePermission('projects', 'write')
  async create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateProjectTagDto) {
    return this.service.create(user.tenantId, dto);
  }

  @Patch('reorder')
  @RequirePermission('projects', 'write')
  async reorder(@CurrentUser() user: CurrentUserPayload, @Body() dto: ReorderProjectTagsDto) {
    return this.service.reorder(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermission('projects', 'write')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProjectTagDto,
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
