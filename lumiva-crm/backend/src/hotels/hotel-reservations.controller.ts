import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelReservationsService } from './hotel-reservations.service';

@Controller('hotels/reservations')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelReservationsController {
  constructor(private readonly reservations: HotelReservationsService) {}

  @Get()
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('hotelId') hotelId?: string,
    @Query('roomTypeId') roomTypeId?: string,
    @Query('agencyId') agencyId?: string,
    @Query('status') status?: string,
    @Query('market') market?: string,
    @Query('search') search?: string,
  ) {
    return this.reservations.list(user.tenantId, {
      hotelId,
      roomTypeId,
      agencyId,
      status,
      market,
      search,
    });
  }

  @Post()
  @RequirePermission('hotels', 'write')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.reservations.create(user.tenantId, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.reservations.get(user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermission('hotels', 'write')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.reservations.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('hotels', 'delete')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.reservations.remove(user.tenantId, id);
  }
}
