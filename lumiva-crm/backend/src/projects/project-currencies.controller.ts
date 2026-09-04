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
import { ProjectCurrenciesService } from './project-currencies.service';
import { CreateProjectCurrencyDto } from './dto/create-project-currency.dto';
import { UpdateProjectCurrencyDto } from './dto/update-project-currency.dto';
import { ReorderProjectCurrenciesDto } from './dto/reorder-project-currencies.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';

@Controller('project-currencies')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ProjectCurrenciesController {
  constructor(private readonly service: ProjectCurrenciesService) {}

  @Get()
  @RequirePermission('projects', 'read')
  async findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.service.findAll(user.tenantId);
  }

  @Post()
  @RequirePermission('projects', 'write')
  async create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateProjectCurrencyDto) {
    return this.service.create(user.tenantId, dto);
  }

  @Patch('reorder')
  @RequirePermission('projects', 'write')
  async reorder(@CurrentUser() user: CurrentUserPayload, @Body() dto: ReorderProjectCurrenciesDto) {
    return this.service.reorder(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermission('projects', 'write')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProjectCurrencyDto,
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
