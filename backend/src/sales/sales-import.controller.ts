// src/sales/sales-import.controller.ts
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SalesImportService } from './sales-import.service';
import type {
  ImportPreviewResponse,
  ImportApplyPayload,
  ImportApplyResult,
} from './sales-import.service';

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
  ): Promise<ImportApplyResult> {
    return this.importService.apply(payload);
  }
}