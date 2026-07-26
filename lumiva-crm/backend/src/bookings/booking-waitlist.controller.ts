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
import { BookingsWaitlistService } from './bookings-waitlist.service';
import { ReservationsService } from './reservations.service';

@Controller('bookings/waitlist')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('bookings', 'read')
export class BookingWaitlistController {
  constructor(
    private readonly waitlist: BookingsWaitlistService,
    private readonly reservations: ReservationsService,
  ) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload, @Query('status') status?: string) {
    return this.waitlist.list(user.tenantId, status);
  }

  @Post()
  @RequirePermission('bookings', 'write')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.waitlist.create(user.tenantId, dto);
  }

  @Patch(':id/priority')
  @RequirePermission('bookings', 'write')
  updatePriority(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { priority: 'normal' | 'high' | 'vip' },
  ) {
    return this.waitlist.updatePriority(user.tenantId, id, dto.priority);
  }

  @Post(':id/offer')
  @RequirePermission('bookings', 'write')
  offer(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { startAt: string; endAt: string },
  ) {
    return this.waitlist.offerSlot(user.tenantId, id, dto);
  }

  @Post(':id/convert')
  @RequirePermission('bookings', 'write')
  async convert(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    const actingStaffUserId = await this.reservations.findActingStaffUserId(user.tenantId, user.email);
    return this.waitlist.convertToReservation(user.tenantId, id, actingStaffUserId);
  }

  @Delete(':id')
  @RequirePermission('bookings', 'write')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.waitlist.remove(user.tenantId, id);
  }
}
