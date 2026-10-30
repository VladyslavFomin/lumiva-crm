import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelsAgenciesService, type HotelPartnerInput } from './hotels-agencies.service';
import { HotelContractsService, type HotelContractInput, type HotelRoomBlockInput } from './hotel-contracts.service';
import { HotelDemoDataService } from './hotel-demo-data.service';
import { HotelPartnerStatementService } from './hotel-partner-statement.service';
import { HotelGuestRegisterService } from './hotel-guest-register.service';

const sendFile = (res: Response, f: { buffer: Buffer; name: string }, type: string) => {
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`);
  res.send(f.buffer);
};
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Партнёры, контракты (квоты/release/комиссии), блоки номеров, шахматка квот, тестовые брони.
 * Регистрируется в модуле раньше HotelsController (у него catch-all `GET hotels/:id`). */
@Controller('hotels')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelPartnersController {
  constructor(
    private readonly partners: HotelsAgenciesService,
    private readonly contracts: HotelContractsService,
    private readonly demo: HotelDemoDataService,
    private readonly statements: HotelPartnerStatementService,
    private readonly register: HotelGuestRegisterService,
  ) {}

  /* ---------- выписка партнёру ---------- */

  @Get('partners/:id/statement')
  statement(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Query() q: { from?: string; to?: string; basis?: string }) {
    return this.statements.build(user.tenantId, id, q);
  }

  @Get('partners/:id/statement.pdf')
  async statementPdf(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Query() q: { from?: string; to?: string; basis?: string }, @Res() res: Response) {
    sendFile(res, await this.statements.pdf(user.tenantId, id, q), 'application/pdf');
  }

  @Get('partners/:id/statement.xlsx')
  async statementXlsx(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Query() q: { from?: string; to?: string; basis?: string }, @Res() res: Response) {
    sendFile(res, await this.statements.xlsx(user.tenantId, id, q), XLSX);
  }

  @Post('partners/:id/statement/send')
  @RequirePermission('hotels_manage_reservations', 'write')
  statementSend(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() b: { from?: string; to?: string; basis?: string; email?: string }) {
    return this.statements.send(user.tenantId, id, { ...b, to_email: b?.email });
  }

  /* ---------- журнал гостей (KBS / МВД) ---------- */

  @Get('guest-register')
  guestRegister(@CurrentUser() user: CurrentUserPayload, @Query() q: { hotelId?: string; date?: string; mode?: string; regime?: string }) {
    return this.register.list(user.tenantId, q);
  }

  @Get('guest-register.xlsx')
  async guestRegisterXlsx(@CurrentUser() user: CurrentUserPayload, @Query() q: { hotelId?: string; date?: string; mode?: string; regime?: string }, @Res() res: Response) {
    sendFile(res, await this.register.exportXlsx(user.tenantId, q), XLSX);
  }

  @Post('guest-register/mark')
  @RequirePermission('hotels_manage_reservations', 'write')
  guestRegisterMark(@CurrentUser() user: CurrentUserPayload, @Body() b: { items: Array<{ reservationId: string; guestId: string | null }>; reported?: boolean }) {
    return this.register.markReported(user.tenantId, b?.items, b?.reported !== false);
  }

  /* ---------- партнёры ---------- */

  @Get('partners')
  listPartners(@CurrentUser() user: CurrentUserPayload) {
    return this.partners.listWithStats(user.tenantId);
  }

  @Post('partners')
  @RequirePermission('hotels_manage_reservations', 'write')
  createPartner(@CurrentUser() user: CurrentUserPayload, @Body() dto: HotelPartnerInput) {
    return this.partners.create(user.tenantId, dto);
  }

  @Post('partners/typical')
  @RequirePermission('hotels_manage_reservations', 'write')
  addTypical(@CurrentUser() user: CurrentUserPayload) {
    return this.partners.addTypical(user.tenantId);
  }

  @Get('partners/:id')
  getPartner(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.partners.get(user.tenantId, id);
  }

  @Patch('partners/:id')
  @RequirePermission('hotels_manage_reservations', 'write')
  updatePartner(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: HotelPartnerInput) {
    return this.partners.update(user.tenantId, id, dto);
  }

  @Delete('partners/:id')
  @RequirePermission('hotels_manage_reservations', 'delete')
  removePartner(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.partners.remove(user.tenantId, id);
  }

  /* ---------- контракты ---------- */

  @Get('contracts')
  listContracts(@CurrentUser() user: CurrentUserPayload, @Query('agencyId') agencyId?: string, @Query('hotelId') hotelId?: string) {
    return this.contracts.list(user.tenantId, { agencyId, hotelId });
  }

  @Post('contracts')
  @RequirePermission('hotels_manage_reservations', 'write')
  createContract(@CurrentUser() user: CurrentUserPayload, @Body() dto: HotelContractInput) {
    return this.contracts.create(user.tenantId, dto);
  }

  @Get('contracts/:id')
  getContract(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.contracts.get(user.tenantId, id);
  }

  @Get('contracts/:id/usage')
  contractUsage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.contracts.usage(user.tenantId, id, from, to);
  }

  @Patch('contracts/:id')
  @RequirePermission('hotels_manage_reservations', 'write')
  updateContract(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: HotelContractInput) {
    return this.contracts.update(user.tenantId, id, dto);
  }

  @Post('contracts/:id/duplicate')
  @RequirePermission('hotels_manage_reservations', 'write')
  duplicateContract(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.contracts.duplicate(user.tenantId, id);
  }

  @Delete('contracts/:id')
  @RequirePermission('hotels_manage_reservations', 'delete')
  removeContract(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.contracts.remove(user.tenantId, id);
  }

  /* ---------- блоки номеров ---------- */

  @Get('blocks')
  listBlocks(@CurrentUser() user: CurrentUserPayload, @Query('hotelId') hotelId?: string, @Query('agencyId') agencyId?: string) {
    return this.contracts.listBlocksWithPickup(user.tenantId, { hotelId, agencyId });
  }

  @Post('blocks')
  @RequirePermission('hotels_manage_reservations', 'write')
  createBlock(@CurrentUser() user: CurrentUserPayload, @Body() dto: HotelRoomBlockInput) {
    return this.contracts.createBlock(user.tenantId, dto);
  }

  @Patch('blocks/:id')
  @RequirePermission('hotels_manage_reservations', 'write')
  updateBlock(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: HotelRoomBlockInput) {
    return this.contracts.updateBlock(user.tenantId, id, dto);
  }

  @Delete('blocks/:id')
  @RequirePermission('hotels_manage_reservations', 'delete')
  removeBlock(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.contracts.removeBlock(user.tenantId, id);
  }

  /* ---------- шахматка квот ---------- */

  @Get('inventory/:hotelId')
  inventory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.contracts.inventory(user.tenantId, hotelId, from, to);
  }

  /* ---------- тестовые брони ---------- */

  @Get('demo-reservations')
  demoCount(@CurrentUser() user: CurrentUserPayload) {
    return this.demo.count(user.tenantId);
  }

  @Post('demo-reservations')
  @RequirePermission('hotels_manage_reservations', 'write')
  demoGenerate(@CurrentUser() user: CurrentUserPayload, @Body() dto: { hotelIds?: string[]; count?: number }) {
    return this.demo.generate(user.tenantId, dto || {});
  }

  @Delete('demo-reservations')
  @RequirePermission('hotels_manage_reservations', 'delete')
  demoClear(@CurrentUser() user: CurrentUserPayload) {
    return this.demo.clear(user.tenantId);
  }
}
