// src/sales/sales-import.controller.ts
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SalesImportService } from './sales-import.service';
import type {
  ImportPreviewResponse,
  ImportApplyPayload,
  ImportApplyResult,
} from './sales-import.service';

@UseGuards(JwtAuthGuard)
@Controller('sales/import')
export class SalesImportController {
  constructor(private readonly importService: SalesImportService) {}

  /**
   * Предпросмотр импорта: принимает файл (CSV), возвращает
   *  - importId
   *  - список колонок
   *  - пример строк
   *  - предложенный маппинг
   *
   * POST /v1/sales/import/preview
   * body: multipart/form-data, поле file
   */
  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  async preview(
    @UploadedFile() file: any, // без Express.Multer.File, чтобы не ломать isolatedModules
  ): Promise<ImportPreviewResponse> {
    return this.importService.preview(file);
  }

  /**
   * Применение импорта:
   *  - importId
   *  - опционально channelId
   *  - fieldMapping
   *
   * POST /v1/sales/import/apply
   * body: JSON
   */
  @Post('apply')
  async apply(
    @Body() payload: ImportApplyPayload,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ImportApplyResult> {
    return this.importService.apply(payload, user?.tenantId || null);
  }
}
