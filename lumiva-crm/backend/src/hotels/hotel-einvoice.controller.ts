import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelEInvoiceService } from './hotel-einvoice.service';

/** e-Fatura / e-Arşiv: подключение интегратора, черновик из фолио, выставление, PDF, отмена */
@Controller('hotels/einvoice')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelEInvoiceController {
  constructor(private readonly einvoice: HotelEInvoiceService) {}

  private actor(user: CurrentUserPayload) {
    return String((user as any).userId ?? (user as any).id ?? (user as any).sub ?? '') || null;
  }

  @Get('connection')
  connection(@CurrentUser() user: CurrentUserPayload, @Query('hotelId', new ParseUUIDPipe()) hotelId: string) {
    return this.einvoice.getConnection(user.tenantId, hotelId);
  }

  @Patch('connection')
  @RequirePermission('hotels_manage_pricing', 'write')
  saveConnection(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.einvoice.saveConnection(user.tenantId, dto || {});
  }

  @Post('connection/test')
  @RequirePermission('hotels_manage_pricing', 'write')
  test(@CurrentUser() user: CurrentUserPayload, @Body() dto: { hotelId: string }) {
    return this.einvoice.testConnection(user.tenantId, dto?.hotelId);
  }

  @Get('draft/:reservationId')
  draft(@CurrentUser() user: CurrentUserPayload, @Param('reservationId', new ParseUUIDPipe()) reservationId: string, @Query('folio') folio?: string) {
    return this.einvoice.draft(user.tenantId, reservationId, folio || 'guest');
  }

  @Post('issue/:reservationId')
  @RequirePermission('hotels_manage_reservations', 'write')
  issue(@CurrentUser() user: CurrentUserPayload, @Param('reservationId', new ParseUUIDPipe()) reservationId: string, @Body() dto: any) {
    return this.einvoice.issue(user.tenantId, reservationId, dto || {}, this.actor(user));
  }

  @Get('documents')
  list(@CurrentUser() user: CurrentUserPayload, @Query('hotelId') hotelId?: string, @Query('reservationId') reservationId?: string, @Query('status') status?: string) {
    return this.einvoice.list(user.tenantId, { hotelId, reservationId, status });
  }

  @Post('documents/:id/refresh')
  @RequirePermission('hotels_manage_reservations', 'write')
  refresh(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.einvoice.refresh(user.tenantId, id);
  }

  @Get('documents/:id/pdf')
  pdf(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.einvoice.pdf(user.tenantId, id);
  }

  @Post('documents/:id/cancel')
  @RequirePermission('hotels_manage_reservations', 'write')
  cancel(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.einvoice.cancel(user.tenantId, id);
  }
}
