import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelRatePlansService, HotelRatePlanInput } from './hotel-rate-plans.service';
import { HotelChannelsService } from './hotel-channels.service';

/** Тарифы отеля: питание, невозвратный, условия отмены и предоплаты. Правка — сразу в каналы (изменения цен). */
@Controller('hotels/rate-plans')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelRatePlansController {
  constructor(private readonly plans: HotelRatePlansService, private readonly channels: HotelChannelsService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload, @Query('hotelId', new ParseUUIDPipe()) hotelId: string) {
    return this.plans.list(user.tenantId, hotelId);
  }

  @Post()
  @RequirePermission('hotels_manage_pricing', 'write')
  async create(@CurrentUser() user: CurrentUserPayload, @Body() dto: HotelRatePlanInput & { hotelId?: string }) {
    const p = await this.plans.create(user.tenantId, dto || {});
    this.channels.markRatesDirty(user.tenantId, p.hotelId);
    return p;
  }

  @Patch(':id')
  @RequirePermission('hotels_manage_pricing', 'write')
  async update(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: HotelRatePlanInput) {
    const p = await this.plans.update(user.tenantId, id, dto || {});
    this.channels.markRatesDirty(user.tenantId, p.hotelId);
    return p;
  }

  @Post(':id/default')
  @RequirePermission('hotels_manage_pricing', 'write')
  makeDefault(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.plans.makeDefault(user.tenantId, id);
  }

  @Delete(':id')
  @RequirePermission('hotels_manage_pricing', 'delete')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.plans.remove(user.tenantId, id);
  }
}
