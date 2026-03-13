// src/custom-fields/custom-fields.controller.ts
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
import { CustomFieldsService } from './custom-fields.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';

@Controller('custom-fields')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Get()
  @RequirePermission('settings', 'read')
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('entityType') entityType?: string,
  ) {
    return this.customFieldsService.findAll(user.tenantId, entityType);
  }

  @Get('entity/:entityType')
  @RequirePermission('settings', 'read')
  async findByEntityType(
    @CurrentUser() user: CurrentUserPayload,
    @Param('entityType') entityType: string,
  ) {
    return this.customFieldsService.findByEntityType(user.tenantId, entityType);
  }

  @Get(':id')
  @RequirePermission('settings', 'read')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.customFieldsService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermission('settings', 'write')
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateCustomFieldDto,
  ) {
    return this.customFieldsService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermission('settings', 'write')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCustomFieldDto,
  ) {
    return this.customFieldsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('settings', 'delete')
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.customFieldsService.delete(user.tenantId, id);
    return { success: true };
  }
}













