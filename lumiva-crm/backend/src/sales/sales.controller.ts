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
  NotFoundException,
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
import { DataVisibilityService } from '../data-visibility/data-visibility.service';

@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('sales', 'read')
@Controller('sales')
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly dataVisibility: DataVisibilityService,
  ) {}

  /** Same shape as ContactsController.resolveVisibility — see comments there. Sale has no
   * assignedUserId of its own, so "own" is resolved by DataVisibilityService via the sale's
   * linked lead/contact. */
  private async resolveVisibility(user: CurrentUserPayload): Promise<{
    ownScopeFilter: { sql: string; params: Record<string, unknown> } | undefined;
    staffId: string | null;
    maskAmount: boolean;
  }> {
    const ctx = await this.dataVisibility.getRequestContext(user.tenantId, user);
    if (ctx.privileged) return { ownScopeFilter: undefined, staffId: ctx.staffId, maskAmount: false };

    const [foreignRecords, amountsVisibility] = await Promise.all([
      this.dataVisibility.getRuleValue(user.tenantId, user.role as any, 'foreign_records'),
      this.dataVisibility.getRuleValue(user.tenantId, user.role as any, 'amounts_visibility'),
    ]);
    return {
      ownScopeFilter:
        foreignRecords === 'hide' && ctx.staffId ? this.dataVisibility.salesOwnFilterSql(ctx.staffId) : undefined,
      staffId: ctx.staffId,
      maskAmount: amountsVisibility === 'owner_manager' || amountsVisibility === 'hidden',
    };
  }

  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListSalesQueryDto,
  ) {
    const visibility = await this.resolveVisibility(user);
    const result = await this.salesService.list(user.tenantId, query, visibility.ownScopeFilter);
    if (!visibility.maskAmount) return result;
    const items = await Promise.all(
      result.items.map(async (sale: any) => {
        const isOwn = visibility.staffId
          ? await this.dataVisibility.isSaleOwnedByStaff(sale, visibility.staffId)
          : false;
        return isOwn ? sale : { ...sale, amount: null };
      }),
    );
    return { ...result, items };
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
    const detail = await this.salesService.findOneDetailed(user.tenantId, id);
    const visibility = await this.resolveVisibility(user);
    const isOwn = visibility.staffId
      ? await this.dataVisibility.isSaleOwnedByStaff(detail.sale as any, visibility.staffId)
      : false;
    if (visibility.ownScopeFilter && !isOwn) {
      throw new NotFoundException('Sale not found');
    }
    if (visibility.maskAmount && !isOwn) {
      return { ...detail, sale: { ...detail.sale, amount: null } };
    }
    return detail;
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
