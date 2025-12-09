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
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { ListSalesQueryDto } from './dto/list-sales-query.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { SaleDetailDto } from './dto/sale-detail.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'; // путь как у других контроллеров

@UseGuards(JwtAuthGuard)
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

  @Get(':id')
  async getOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SaleDetailDto> {
    return this.salesService.findOneDetailed(user.tenantId, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSaleDto,
  ) {
    return this.salesService.update(user.tenantId, id, dto);
  }
}