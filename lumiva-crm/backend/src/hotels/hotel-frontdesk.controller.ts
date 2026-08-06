import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelFrontDeskService } from './hotel-frontdesk.service';

@Controller('hotels/frontdesk')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelFrontDeskController {
  constructor(private readonly frontDesk: HotelFrontDeskService) {}

  @Get('today')
  today(
    @CurrentUser() user: CurrentUserPayload,
    @Query('date') date?: string,
    @Query('hotelId') hotelId?: string,
  ) {
    return this.frontDesk.today(user.tenantId, date, hotelId);
  }
}
