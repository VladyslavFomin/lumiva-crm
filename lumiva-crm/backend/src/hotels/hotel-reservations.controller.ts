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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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
  @RequirePermission('hotels_manage_reservations', 'write')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.reservations.create(user.tenantId, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.reservations.get(user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermission('hotels_manage_reservations', 'write')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.reservations.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('hotels_manage_reservations', 'delete')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.reservations.remove(user.tenantId, id);
  }

  @Post(':id/check-in')
  @RequirePermission('hotels_manage_reservations', 'write')
  checkIn(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { roomUnitId?: string },
  ) {
    return this.reservations.checkIn(user.tenantId, id, dto?.roomUnitId, user.userId ?? user.id ?? user.sub);
  }

  @Post(':id/check-out')
  @RequirePermission('hotels_manage_reservations', 'write')
  checkOut(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.reservations.checkOut(user.tenantId, id, user.userId ?? user.id ?? user.sub);
  }

  @Post(':id/payments')
  @RequirePermission('hotels_manage_reservations', 'write')
  addPayment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { date: string; amount: string; method: string; note?: string },
  ) {
    return this.reservations.addPayment(user.tenantId, id, dto, user.userId ?? user.id ?? user.sub);
  }

  @Delete(':id/payments/:paymentId')
  @RequirePermission('hotels_manage_reservations', 'write')
  removePayment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.reservations.removePayment(user.tenantId, id, paymentId, user.userId ?? user.id ?? user.sub);
  }

  @Get(':id/folio.pdf')
  async folio(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reservations.renderFolio(user.tenantId, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="folio-${id}.pdf"`);
    res.send(buffer);
  }
}
