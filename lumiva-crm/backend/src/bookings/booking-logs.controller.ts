import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { ReservationsService } from './reservations.service';

@Controller('bookings/logs')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('bookings', 'read')
export class BookingLogsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload, @Query('limit') limit?: string) {
    return this.reservations.listLogs(user.tenantId, limit ? Number(limit) : undefined);
  }
}
