// src/notes/notes.controller.ts
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
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { RbacGuard } from '../rbac/rbac.guard';

@Controller('notes')
@UseGuards(JwtAuthGuard, RbacGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @RequirePermission('notes', 'read')
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notesService.findAll(user.tenantId, {
      entityType,
      entityId,
      type,
      search,
      createdById: user.id || user.userId || user.sub,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('entity/:entityType/:entityId')
  @RequirePermission('notes', 'read')
  async findByEntity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('entityType') entityType: string,
    @Param('entityId', new ParseUUIDPipe()) entityId: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notesService.findByEntity(
      user.tenantId,
      entityType,
      entityId,
      {
        type,
        createdById: user.id || user.userId || user.sub,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      },
    );
  }

  @Get(':id')
  @RequirePermission('notes', 'read')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.notesService.findOne(user.tenantId, id, user.id || user.userId || user.sub);
  }

  @Post()
  @RequirePermission('notes', 'write')
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateNoteDto,
  ) {
    return this.notesService.create(
      user.tenantId,
      dto,
      user.id || user.userId || user.sub,
      user.name || user.email || undefined,
    );
  }

  @Patch(':id')
  @RequirePermission('notes', 'write')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.update(user.tenantId, id, dto, user.id || user.userId || user.sub);
  }

  @Delete(':id')
  @RequirePermission('notes', 'delete')
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.notesService.delete(user.tenantId, id, user.id || user.userId || user.sub);
    return { success: true };
  }
}

