// src/contacts/contacts.controller.ts
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
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { BulkUpdateContactsDto } from './dto/bulk-update-contacts.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';

@Controller('contacts')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @RequirePermission('contacts', 'read')
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('assignedUserId') assignedUserId?: string,
    @Query('tags') tags?: string, // comma-separated
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const tagsArray = tags ? tags.split(',').filter(Boolean) : undefined;
    return this.contactsService.findAll(user.tenantId, {
      search,
      status,
      assignedUserId,
      tags: tagsArray,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id')
  @RequirePermission('contacts', 'read')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('withRelations') withRelations?: string,
  ) {
    if (withRelations === 'true') {
      return this.contactsService.findOneWithRelations(user.tenantId, id);
    }
    return this.contactsService.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermission('contacts', 'write')
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateContactDto,
  ) {
    return this.contactsService.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermission('contacts', 'write')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('contacts', 'delete')
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.contactsService.delete(user.tenantId, id);
    return { success: true };
  }

  // ========== BIRTHDAYS WIDGET ==========

  @Get('birthdays')
  @RequirePermission('contacts', 'read')
  async birthdays(
    @CurrentUser() _user: CurrentUserPayload,
  ) {
    // birthday field is not yet on the Contact entity — return empty list
    return { contacts: [] };
  }

  // ========== МАССОВЫЕ ОПЕРАЦИИ ==========

  @Post('bulk-update')
  @RequirePermission('contacts', 'write')
  async bulkUpdate(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BulkUpdateContactsDto,
  ) {
    return this.contactsService.bulkUpdate(user.tenantId, dto);
  }
}



