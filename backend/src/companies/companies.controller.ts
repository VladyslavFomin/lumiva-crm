// src/companies/companies.controller.ts
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
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { BulkUpdateCompaniesDto } from './dto/bulk-update-companies.dto';
import { CreateCompanyTaskDto } from './dto/create-company-task.dto';
import { UpdateCompanyTaskDto } from './dto/update-company-task.dto';
import type { CompanyTaskStatus } from './company-task.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';

@Controller('companies')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @RequirePermission('companies', 'read')
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('industry') industry?: string,
    @Query('assignedUserId') assignedUserId?: string,
    @Query('tags') tags?: string, // comma-separated
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const tagsArray = tags ? tags.split(',').filter(Boolean) : undefined;
    return this.companiesService.findAll(user.tenantId, {
      search,
      status,
      type,
      industry,
      assignedUserId,
      tags: tagsArray,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id')
  @RequirePermission('companies', 'read')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('withRelations') withRelations?: string,
  ) {
    if (withRelations === 'true') {
      return this.companiesService.findOneWithRelations(user.tenantId, id);
    }
    return this.companiesService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermission('companies', 'write')
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateCompanyDto,
  ) {
    return this.companiesService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermission('companies', 'write')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('companies', 'delete')
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.companiesService.delete(user.tenantId, id);
    return { success: true };
  }

  @Get(':id/analytics')
  @RequirePermission('companies', 'read')
  async getCompanyAnalytics(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.companiesService.getCompanyAnalytics(user.tenantId, id);
  }

  @Get('analytics/all')
  @RequirePermission('companies', 'read')
  async getAllCompaniesAnalytics(@CurrentUser() user: CurrentUserPayload) {
    return this.companiesService.getAllCompaniesAnalytics(user.tenantId);
  }

  // ========== ЗАДАЧИ КОМПАНИЙ ==========

  @Get(':companyId/tasks')
  @RequirePermission('companies', 'read')
  async getCompanyTasks(
    @CurrentUser() user: CurrentUserPayload,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Query('status') status?: CompanyTaskStatus,
  ) {
    return this.companiesService.findCompanyTasks(user.tenantId, companyId, status);
  }

  @Get('tasks/:taskId')
  @RequirePermission('companies', 'read')
  async getTask(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
  ) {
    return this.companiesService.findTask(user.tenantId, taskId);
  }

  @Post('tasks')
  @RequirePermission('companies', 'write')
  async createTask(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateCompanyTaskDto,
  ) {
    return this.companiesService.createTask(user.tenantId, dto);
  }

  @Patch('tasks/:taskId')
  @RequirePermission('companies', 'write')
  async updateTask(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body() dto: UpdateCompanyTaskDto,
  ) {
    return this.companiesService.updateTask(user.tenantId, taskId, dto);
  }

  @Patch('tasks/:taskId/status')
  @RequirePermission('companies', 'write')
  async changeTaskStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body() body: { status: CompanyTaskStatus; order?: number },
  ) {
    return this.companiesService.changeTaskStatus(
      user.tenantId,
      taskId,
      body.status,
      body.order,
    );
  }

  @Delete('tasks/:taskId')
  @RequirePermission('companies', 'delete')
  async deleteTask(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
  ) {
    await this.companiesService.deleteTask(user.tenantId, taskId);
    return { success: true };
  }

  // ========== МАССОВЫЕ ОПЕРАЦИИ ==========

  @Post('bulk-update')
  @RequirePermission('companies', 'write')
  async bulkUpdate(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BulkUpdateCompaniesDto,
  ) {
    return this.companiesService.bulkUpdate(user.tenantId, dto);
  }
}



