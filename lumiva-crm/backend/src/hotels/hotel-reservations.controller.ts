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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelReservationsService } from './hotel-reservations.service';
import { HotelFolioService } from './hotel-folio.service';
import { RbacService } from '../rbac/rbac.service';
import { scanIdDocument } from '../ai/id-document-scan.util';

@Controller('hotels/reservations')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelReservationsController {
  constructor(
    private readonly reservations: HotelReservationsService,
    private readonly moduleRef: ModuleRef,
    private readonly folioService: HotelFolioService,
    private readonly rbac: RbacService,
  ) {}

  /** Право менять деньги в закрытых аудитом днях (PMS-094) */
  private canOverride(user: CurrentUserPayload) {
    return this.rbac.canUserAccess(user.tenantId, user.role, (user as any).staffUserId, 'hotels_night_audit');
  }

  private actor(user: CurrentUserPayload) {
    return (user.userId ?? user.id ?? user.sub ?? null) as string | null;
  }

  @Get()
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('hotelId') hotelId?: string,
    @Query('roomTypeId') roomTypeId?: string,
    @Query('agencyId') agencyId?: string,
    @Query('status') status?: string,
    @Query('market') market?: string,
    @Query('search') search?: string,
    @Query('contractId') contractId?: string,
    @Query('blockId') blockId?: string,
    @Query('guestCountry') guestCountry?: string,
    @Query('source') source?: string,
  ) {
    return this.reservations.list(user.tenantId, {
      hotelId,
      roomTypeId,
      agencyId,
      status,
      market,
      search,
      contractId,
      blockId,
      guestCountry,
      source,
    });
  }

  @Post()
  @RequirePermission('hotels_manage_reservations', 'write')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    // привязка к каналу и источник «канал» — только у броней, загруженных из менеджера каналов
    const { channelConnectionId, channelBookingId, otaName, otaCode, paymentCollect, channelPaymentType, ...clean } = dto || {};
    if (clean.source === 'channel') delete clean.source;
    return this.reservations.create(user.tenantId, clean, user.userId ?? user.id ?? user.sub);
  }

  /** Фото паспорта / ID-карты → поля гостя для журнала. Фото не сохраняется. */
  @Post('scan-document')
  @RequirePermission('hotels_manage_reservations', 'write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  scanDocument(@CurrentUser() user: CurrentUserPayload, @UploadedFile() file: any, @Query('lang') lang?: string) {
    return scanIdDocument(this.moduleRef, user.tenantId, String(user.userId ?? user.id ?? user.sub ?? '') || null, file, String(lang || 'en').slice(0, 2));
  }

  /** Расчёт цены по ночам для формы брони / walk-in (ничего не сохраняет) */
  @Get('quote')
  quote(@CurrentUser() user: CurrentUserPayload, @Query() q: any) {
    return this.reservations.quote(user.tenantId, {
      roomTypeId: q.roomTypeId,
      occupancyTypeId: q.occupancyTypeId || null,
      checkIn: q.checkIn,
      checkOut: q.checkOut,
      marketId: q.marketId || null,
      market: q.market || null,
      guestCountry: q.guestCountry || null,
      contractId: q.contractId || null,
      blockId: q.blockId || null,
      // состав гостей: adults=2&childAges=5,8,- («-» — возраст не указан)
      adults: q.adults ? Number(q.adults) : null,
      childAges: typeof q.childAges === 'string' && q.childAges !== '' ? q.childAges.split(',').map((v: string) => (v === '-' || v === '' ? null : Number(v))) : null,
    });
  }

  @Get(':id')
  get(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.reservations.get(user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermission('hotels_manage_reservations', 'write')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    // данные канала (кто берёт оплату, способ оплаты) меняет только загрузка из менеджера каналов
    const { paymentCollect, channelPaymentType, ...clean } = dto || {};
    return this.reservations.update(user.tenantId, id, clean, this.actor(user), { allowClosed: await this.canOverride(user) });
  }

  @Delete(':id')
  @RequirePermission('hotels_manage_reservations', 'delete')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.reservations.remove(user.tenantId, id, user.userId ?? user.id ?? user.sub);
  }

  @Get(':id/cancellation-quote')
  cancellationQuote(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.reservations.cancellationQuote(user.tenantId, id);
  }

  /** Отмена с причиной; fee не передан — штраф по политике контракта */
  @Post(':id/cancel')
  @RequirePermission('hotels_manage_reservations', 'write')
  cancel(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { reason?: string; note?: string; fee?: string | number | null; refund?: { amount?: string | number | null; method?: string; folio?: 'guest' | 'partner'; note?: string | null } },
  ) {
    return this.reservations.cancel(user.tenantId, id, dto || {}, user.userId ?? user.id ?? user.sub);
  }

  @Post(':id/no-show')
  @RequirePermission('hotels_manage_reservations', 'write')
  noShow(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { fee?: string | number | null; note?: string; refund?: { amount?: string | number | null; method?: string; folio?: 'guest' | 'partner'; note?: string | null } },
  ) {
    return this.reservations.noShow(user.tenantId, id, dto || {}, user.userId ?? user.id ?? user.sub);
  }

  /** Перенос в шахматке: другой номер и/или даты, продление; swap — поменять местами с бронью, занимающей номер */
  @Post(':id/move')
  @RequirePermission('hotels_manage_reservations', 'write')
  move(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { roomUnitId?: string | null; checkIn?: string; checkOut?: string; reason?: string; swap?: boolean },
  ) {
    return this.reservations.move(user.tenantId, id, dto || {}, user.userId ?? user.id ?? user.sub);
  }

  /** История изменений брони (PMS-028): поле, было, стало, кто, когда */
  @Get(':id/history')
  history(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.reservations.history(user.tenantId, id);
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
  async addPayment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { date?: string; amount: string; method: string; note?: string; folio?: string; refund?: boolean },
  ) {
    return this.reservations.addPayment(user.tenantId, id, dto, this.actor(user), await this.canOverride(user));
  }

  @Delete(':id/payments/:paymentId')
  @RequirePermission('hotels_manage_reservations', 'write')
  async removePayment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.reservations.removePayment(user.tenantId, id, paymentId, this.actor(user), await this.canOverride(user));
  }

  /** Фолио брони (PMS-080…086): начисления, платежи, остаток по гостевому и партнёрскому счёту */
  @Get(':id/folio')
  getFolio(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.folioService.folio(user.tenantId, id);
  }

  @Post(':id/folio/lines')
  @RequirePermission('hotels_manage_reservations', 'write')
  async postFolioLine(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: any) {
    return this.folioService.postLine(user.tenantId, id, dto || {}, this.actor(user), await this.canOverride(user));
  }

  @Post(':id/folio/lines/:lineId/void')
  @RequirePermission('hotels_manage_reservations', 'write')
  voidFolioLine(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('lineId', new ParseUUIDPipe()) lineId: string,
    @Body() dto: { reason?: string },
  ) {
    return this.folioService.voidLine(user.tenantId, id, lineId, dto?.reason, this.actor(user));
  }

  @Patch(':id/folio-routing')
  @RequirePermission('hotels_manage_reservations', 'write')
  folioRouting(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: { accommodationFolio: string }) {
    return this.folioService.setRouting(user.tenantId, id, dto?.accommodationFolio);
  }

  @Get(':id/folio.pdf')
  async folio(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
    @Query('lang') lang?: string,
    @Query('folio') folio?: string,
  ) {
    const buffer = await this.reservations.renderFolio(user.tenantId, id, { lang, folio: folio === 'partner' ? 'partner' : 'guest' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="folio-${id}.pdf"`);
    res.send(buffer);
  }

  @Post(':id/send-folio-email')
  @RequirePermission('hotels_manage_reservations', 'write')
  sendFolioEmail(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.reservations.sendFolioEmail(user.tenantId, id);
  }
}
