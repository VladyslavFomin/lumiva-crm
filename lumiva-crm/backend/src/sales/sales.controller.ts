// backend/src/sales/sales.controller.ts
import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SalesService } from './sales.service';
import { ListSalesQueryDto } from './dto/list-sales-query.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { SaleDetailDto } from './dto/sale-detail.dto';
import { SalesAnalyticsQueryDto } from './dto/sales-analytics-query.dto';
import { SaveAnalyticsPresetDto } from './dto/save-analytics-preset.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'; // путь как у других контроллеров
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';

@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('sales', 'read')
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListSalesQueryDto,
  ) {
    return this.salesService.list(user.tenantId, query);
  }

  @Get('stats')
  async stats(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListSalesQueryDto,
  ) {
    return this.salesService.getStats(user.tenantId, query);
  }

  @Get('analytics')
  async analytics(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: SalesAnalyticsQueryDto,
  ) {
    return this.salesService.getAnalytics(user.tenantId, query);
  }

  @Get('analytics/preset')
  async getAnalyticsPreset(@CurrentUser() user: CurrentUserPayload) {
    const userId = user.userId || user.id || user.sub || null;
    return this.salesService.getAnalyticsPreset(user.tenantId, userId);
  }

  @Patch('analytics/preset')
  async saveAnalyticsPreset(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SaveAnalyticsPresetDto,
  ) {
    const userId = user.userId || user.id || user.sub || null;
    return this.salesService.saveAnalyticsPreset(user.tenantId, userId, dto);
  }

  @Get('analytics/export')
  async exportAnalytics(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: SalesAnalyticsQueryDto,
    @Query('format') format: 'csv' | 'xls' | 'xlsx' | 'excel' = 'csv',
    @Res() res: Response,
  ) {
    const result = await this.salesService.exportAnalytics(
      user.tenantId,
      query,
      format,
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=\"${result.filename}\"`,
    );
    return res.send(result.body);
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SaleDetailDto> {
    return this.salesService.findOneDetailed(user.tenantId, id);
  }

  @Get('recent')
  async recent(
    @CurrentUser() user: CurrentUserPayload,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.salesService.getRecent(user.tenantId, parsedLimit);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSaleDto,
  ) {
    return this.salesService.update(user.tenantId, id, dto, user.userId ?? user.id ?? user.sub);
  }
}
