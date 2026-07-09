import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { MulterWorkspaceUploadFilter } from './multer-workspace-upload.filter';
import { CustomObjectsService } from './custom-objects.service';
import { WORKSPACE_ATTACHMENT_MAX_BYTES } from './workspace-attachment.constants';
import { CreateCustomObjectDto } from './dto/create-custom-object.dto';
import { UpdateCustomObjectDto } from './dto/update-custom-object.dto';
import { CreateCustomObjectFieldDto } from './dto/create-custom-object-field.dto';
import { UpdateCustomObjectFieldDto } from './dto/update-custom-object-field.dto';
import { CreateCustomObjectRecordDto } from './dto/create-custom-object-record.dto';
import { UpdateCustomObjectRecordDto } from './dto/update-custom-object-record.dto';
import { CreateCustomObjectViewDto } from './dto/create-custom-object-view.dto';
import { UpdateCustomObjectViewDto } from './dto/update-custom-object-view.dto';
import { PushRecordsToBoardDto } from './dto/push-records-to-board.dto';

@Controller('custom-objects')
@UseGuards(JwtAuthGuard)
export class CustomObjectsController {
  constructor(private readonly service: CustomObjectsService) {}

  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('workspaceAreaId') workspaceAreaId?: string,
  ) {
    const wid =
      workspaceAreaId && /^[0-9a-f-]{36}$/i.test(workspaceAreaId)
        ? workspaceAreaId
        : undefined;
    return this.service.listObjects(user.tenantId, wid);
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateCustomObjectDto,
  ) {
    return this.service.createObject(user.tenantId, dto);
  }

  @Post(':objectId/duplicate')
  async duplicate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
  ) {
    return this.service.duplicateObject(user.tenantId, objectId);
  }

  @Get(':objectId')
  async getOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
  ) {
    return this.service.getObject(user.tenantId, objectId);
  }

  @Patch(':objectId')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @Body() dto: UpdateCustomObjectDto,
  ) {
    return this.service.updateObject(user.tenantId, objectId, dto);
  }

  @Delete(':objectId')
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
  ) {
    return this.service.deleteObject(user.tenantId, objectId);
  }

  @Get(':objectId/fields')
  async listFields(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
  ) {
    return this.service.listFields(user.tenantId, objectId);
  }

  /** Ключи из jsonb values по записям объекта (для сопоставления колонок с импортом). */
  @Get(':objectId/value-keys')
  async listValueKeys(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
  ) {
    return this.service.listDistinctValueKeys(user.tenantId, objectId);
  }

  @Post(':objectId/attachments/upload')
  @UseFilters(MulterWorkspaceUploadFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: WORKSPACE_ATTACHMENT_MAX_BYTES },
    }),
  )
  async uploadWorkspaceAttachment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @UploadedFile() file: { buffer: Buffer; originalname?: string },
  ) {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant');
    }
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.service.uploadWorkspaceAttachment(
      user.tenantId,
      objectId,
      file,
      user.email?.trim() || undefined,
    );
  }

  @Post(':objectId/fields')
  async createField(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @Body() dto: CreateCustomObjectFieldDto,
  ) {
    return this.service.createField(user.tenantId, objectId, dto);
  }

  @Patch(':objectId/fields/:fieldId')
  async updateField(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @Param('fieldId', new ParseUUIDPipe()) fieldId: string,
    @Body() dto: UpdateCustomObjectFieldDto,
  ) {
    return this.service.updateField(user.tenantId, objectId, fieldId, dto);
  }

  @Delete(':objectId/fields/:fieldId')
  async deleteField(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @Param('fieldId', new ParseUUIDPipe()) fieldId: string,
  ) {
    return this.service.deleteField(user.tenantId, objectId, fieldId);
  }

  @Get(':objectId/views')
  async listViews(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
  ) {
    return this.service.listViews(user.tenantId, objectId);
  }

  @Post(':objectId/views')
  async createView(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @Body() dto: CreateCustomObjectViewDto,
  ) {
    return this.service.createView(user.tenantId, objectId, dto);
  }

  @Patch(':objectId/views/:viewId')
  async updateView(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @Param('viewId', new ParseUUIDPipe()) viewId: string,
    @Body() dto: UpdateCustomObjectViewDto,
  ) {
    return this.service.updateView(user.tenantId, objectId, viewId, dto);
  }

  @Delete(':objectId/views/:viewId')
  async deleteView(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @Param('viewId', new ParseUUIDPipe()) viewId: string,
  ) {
    return this.service.deleteView(user.tenantId, objectId, viewId);
  }

  @Get(':objectId/records')
  async listRecords(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
    @Query('search') search?: string,
    @Query('enrichColumnBindings') enrichColumnBindings?: string,
  ) {
    const ec =
      enrichColumnBindings === '1' ||
      enrichColumnBindings === 'true' ||
      enrichColumnBindings === 'yes';
    return this.service.listRecords(user.tenantId, objectId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      sortBy,
      sortOrder,
      search,
      enrichColumnBindings: ec,
    });
  }

  @Post(':objectId/records')
  async createRecord(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @Body() dto: CreateCustomObjectRecordDto,
  ) {
    return this.service.createRecord(user.tenantId, objectId, dto);
  }

  @Get(':objectId/records/distinct-values')
  async distinctFieldValues(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @Query('fieldKey') fieldKey?: string,
  ) {
    return this.service.listDistinctFieldValues(user.tenantId, objectId, (fieldKey || '').trim());
  }

  @Post(':objectId/records/clear')
  async clearAllRecords(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @Body() body: { confirm?: string },
  ) {
    if (body?.confirm !== 'CLEAR_ALL_RECORDS') {
      throw new BadRequestException('Send JSON body: { "confirm": "CLEAR_ALL_RECORDS" }');
    }
    return this.service.deleteAllRecordsForObject(user.tenantId, objectId);
  }

  /** Строки из таблицы данных → основная таблица (board) области. */
  @Post(':objectId/records/push-to-board')
  async pushRecordsToBoard(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @Body() dto: PushRecordsToBoardDto,
  ) {
    return this.service.pushRecordsToBoard(user.tenantId, objectId, {
      targetObjectId: dto.targetObjectId,
      recordIds: dto.recordIds,
      fieldMap: dto.fieldMap,
      omitAutoTargetKeys: dto.omitAutoTargetKeys,
      duplicateKeyTargetField: dto.duplicateKeyTargetField ?? null,
      skipDuplicates: dto.skipDuplicates,
    });
  }

  @Patch(':objectId/records/:recordId')
  async updateRecord(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @Param('recordId', new ParseUUIDPipe()) recordId: string,
    @Body() dto: UpdateCustomObjectRecordDto,
  ) {
    return this.service.updateRecord(user.tenantId, objectId, recordId, dto);
  }

  @Delete(':objectId/records/:recordId')
  async deleteRecord(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @Param('recordId', new ParseUUIDPipe()) recordId: string,
  ) {
    return this.service.deleteRecord(user.tenantId, objectId, recordId);
  }

  @Get(':objectId/analytics')
  async getAnalytics(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
  ) {
    return this.service.getAnalytics(user.tenantId, objectId);
  }

  /**
   * "Headless" preview — no target table yet. Used by the AI chat: a spreadsheet is
   * attached before the user (or the model) has picked/created a workspace table for it.
   */
  @Post('import/preview')
  @UseInterceptors(FileInterceptor('file'))
  async previewHeadlessImport(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: any,
  ) {
    return this.service.previewHeadlessImport(user.tenantId, file);
  }

  @Post(':objectId/import/preview')
  @UseInterceptors(FileInterceptor('file'))
  async previewImport(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @UploadedFile() file: any,
  ) {
    return this.service.previewImport(user.tenantId, objectId, file);
  }

  @Post(':objectId/import/apply')
  async applyImport(
    @CurrentUser() user: CurrentUserPayload,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @Body()
    payload: {
      importId: string;
      fieldMapping: Record<string, string | null>;
      externalIdField?: string;
      defaultValues?: Record<string, any>;
    },
  ) {
    return this.service.applyImport(user.tenantId, objectId, payload);
  }
}

