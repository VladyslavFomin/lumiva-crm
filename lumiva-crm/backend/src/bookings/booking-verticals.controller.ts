import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { getClientIp } from '../common/client-ip.util';
import { ReservationsService } from './reservations.service';
import { BookingsOrdersService } from './bookings-orders.service';
import { BookingsRestaurantService } from './bookings-restaurant.service';
import { BookingsClassesService } from './bookings-classes.service';
import { BookingsPassesService } from './bookings-passes.service';
import { BookingsRentalService } from './bookings-rental.service';
import { BookingsVerticalService } from './bookings-vertical.service';

const uuid = () => new ParseUUIDPipe();

/* ======================= СЧЕТА / ЗАКАЗЫ ======================= */

@Controller('bookings/orders')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('bookings', 'read')
export class BookingOrdersController {
  constructor(private readonly orders: BookingsOrdersService, private readonly reservations: ReservationsService) {}

  private actor(u: CurrentUserPayload) {
    return this.reservations.findActingStaffUserId(u.tenantId, u.email);
  }

  @Get()
  list(@CurrentUser() u: CurrentUserPayload, @Query() q: any) {
    return this.orders.list(u.tenantId, q);
  }

  @Get('summary')
  summary(@CurrentUser() u: CurrentUserPayload, @Query('from') from?: string, @Query('to') to?: string) {
    const f = from ? new Date(from) : new Date(Date.now() - 30 * 86400_000);
    const t = to ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59.999Z` : to) : new Date();
    return this.orders.summary(u.tenantId, f, t);
  }

  @Get('top-menu')
  topMenu(@CurrentUser() u: CurrentUserPayload, @Query('days') days?: string) {
    return this.orders.topMenuItems(u.tenantId, new Date(Date.now() - (Number(days) || 30) * 86400_000), new Date(), 20);
  }

  @Get(':id')
  get(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string) {
    return this.orders.get(u.tenantId, id);
  }

  @Post()
  @RequirePermission('bookings', 'write')
  async create(@CurrentUser() u: CurrentUserPayload, @Body() dto: any) {
    return this.orders.create(u.tenantId, dto, await this.actor(u));
  }

  @Patch(':id')
  @RequirePermission('bookings', 'write')
  update(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: any) {
    return this.orders.update(u.tenantId, id, dto);
  }

  @Post(':id/items')
  @RequirePermission('bookings', 'write')
  addItem(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: any) {
    return this.orders.addItem(u.tenantId, id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermission('bookings', 'write')
  updateItem(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Param('itemId', uuid()) itemId: string, @Body() dto: any) {
    return this.orders.updateItem(u.tenantId, id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @RequirePermission('bookings', 'write')
  removeItem(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Param('itemId', uuid()) itemId: string) {
    return this.orders.removeItem(u.tenantId, id, itemId);
  }

  @Post(':id/bill')
  @RequirePermission('bookings', 'write')
  bill(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string) {
    return this.orders.bill(u.tenantId, id);
  }

  @Post(':id/reopen')
  @RequirePermission('bookings', 'write')
  reopen(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string) {
    return this.orders.reopen(u.tenantId, id);
  }

  @Post(':id/pay')
  @RequirePermission('bookings', 'write')
  pay(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: any) {
    return this.orders.pay(u.tenantId, id, dto);
  }

  @Post(':id/payment-link')
  @RequirePermission('bookings', 'write')
  paymentLink(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: any, @Req() req: Request) {
    return this.orders.createPaymentLink(u.tenantId, id, dto || {}, getClientIp(req) || '0.0.0.0');
  }

  @Post(':id/cancel')
  @RequirePermission('bookings', 'write')
  cancel(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string) {
    return this.orders.cancel(u.tenantId, id);
  }
}

/* ======================= РЕСТОРАН ======================= */

@Controller('bookings/restaurant')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('bookings', 'read')
export class BookingRestaurantController {
  constructor(private readonly restaurant: BookingsRestaurantService, private readonly reservations: ReservationsService) {}

  private actor(u: CurrentUserPayload) {
    return this.reservations.findActingStaffUserId(u.tenantId, u.email);
  }

  @Get('zones')
  zones(@CurrentUser() u: CurrentUserPayload, @Query('locationId') locationId?: string) {
    return this.restaurant.listZones(u.tenantId, locationId);
  }

  @Post('zones')
  @RequirePermission('bookings_manage_settings', 'write')
  createZone(@CurrentUser() u: CurrentUserPayload, @Body() dto: any) {
    return this.restaurant.createZone(u.tenantId, dto);
  }

  @Patch('zones/:id')
  @RequirePermission('bookings_manage_settings', 'write')
  updateZone(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: any) {
    return this.restaurant.updateZone(u.tenantId, id, dto);
  }

  @Delete('zones/:id')
  @RequirePermission('bookings_manage_settings', 'delete')
  deleteZone(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string) {
    return this.restaurant.deleteZone(u.tenantId, id);
  }

  @Put('zones/:id/layout')
  @RequirePermission('bookings_manage_settings', 'write')
  saveLayout(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: any) {
    return this.restaurant.saveLayout(u.tenantId, id, dto || { tables: [] });
  }

  @Get('floor')
  floor(@CurrentUser() u: CurrentUserPayload, @Query('locationId', uuid()) locationId: string, @Query('at') at?: string) {
    return this.restaurant.floorState(u.tenantId, locationId, at);
  }

  @Get('suggest-tables')
  suggest(@CurrentUser() u: CurrentUserPayload, @Query('locationId', uuid()) locationId: string, @Query('startAt') startAt: string, @Query('endAt') endAt: string, @Query('guests') guests: string) {
    return this.restaurant.suggestTables(u.tenantId, locationId, startAt, endAt, Math.max(1, Number(guests) || 1));
  }

  @Post('tables/:id/seat')
  @RequirePermission('bookings', 'write')
  async seat(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: any) {
    return this.restaurant.seat(u.tenantId, id, dto || {}, await this.actor(u));
  }

  @Post('tables/:id/release')
  @RequirePermission('bookings', 'write')
  async release(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string) {
    return this.restaurant.release(u.tenantId, id, await this.actor(u));
  }

  @Post('tables/:id/move')
  @RequirePermission('bookings', 'write')
  async move(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: { toTableId: string }) {
    return this.restaurant.move(u.tenantId, id, dto?.toTableId, await this.actor(u));
  }

  @Get('menu')
  menu(@CurrentUser() u: CurrentUserPayload) {
    return this.restaurant.getMenu(u.tenantId);
  }

  @Post('menu/categories')
  @RequirePermission('bookings_manage_settings', 'write')
  createCategory(@CurrentUser() u: CurrentUserPayload, @Body() dto: any) {
    return this.restaurant.createCategory(u.tenantId, dto);
  }

  @Put('menu/categories/order')
  @RequirePermission('bookings_manage_settings', 'write')
  reorder(@CurrentUser() u: CurrentUserPayload, @Body() dto: { ids: string[] }) {
    return this.restaurant.reorderCategories(u.tenantId, Array.isArray(dto?.ids) ? dto.ids : []);
  }

  @Patch('menu/categories/:id')
  @RequirePermission('bookings_manage_settings', 'write')
  updateCategory(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: any) {
    return this.restaurant.updateCategory(u.tenantId, id, dto);
  }

  @Delete('menu/categories/:id')
  @RequirePermission('bookings_manage_settings', 'delete')
  deleteCategory(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string) {
    return this.restaurant.deleteCategory(u.tenantId, id);
  }

  @Post('menu/items')
  @RequirePermission('bookings_manage_settings', 'write')
  createItem(@CurrentUser() u: CurrentUserPayload, @Body() dto: any) {
    return this.restaurant.createMenuItem(u.tenantId, dto);
  }

  /** Стоп-лист доступен и официанту (bookings:write), а не только администратору меню. */
  @Patch('menu/items/:id/availability')
  @RequirePermission('bookings', 'write')
  setAvailability(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: { available: boolean }) {
    return this.restaurant.updateMenuItem(u.tenantId, id, { available: !!dto?.available });
  }

  @Patch('menu/items/:id')
  @RequirePermission('bookings_manage_settings', 'write')
  updateItem(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: any) {
    return this.restaurant.updateMenuItem(u.tenantId, id, dto);
  }

  @Delete('menu/items/:id')
  @RequirePermission('bookings_manage_settings', 'delete')
  deleteItem(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string) {
    return this.restaurant.deleteMenuItem(u.tenantId, id);
  }
}

/* ======================= ГРУППОВЫЕ ЗАНЯТИЯ ======================= */

@Controller('bookings/classes')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('bookings', 'read')
export class BookingClassesController {
  constructor(private readonly classes: BookingsClassesService, private readonly reservations: ReservationsService) {}

  private actor(u: CurrentUserPayload) {
    return this.reservations.findActingStaffUserId(u.tenantId, u.email);
  }

  @Get()
  list(@CurrentUser() u: CurrentUserPayload, @Query() q: any) {
    return this.classes.list(u.tenantId, { ...q, includeCancelled: q.includeCancelled === '1' || q.includeCancelled === 'true' });
  }

  @Get('stats')
  stats(@CurrentUser() u: CurrentUserPayload) {
    return this.classes.stats(u.tenantId);
  }

  @Post('series')
  @RequirePermission('bookings', 'write')
  series(@CurrentUser() u: CurrentUserPayload, @Body() dto: any) {
    return this.classes.createSeries(u.tenantId, dto);
  }

  @Post('waitlist/:entryId/remove')
  @RequirePermission('bookings', 'write')
  removeWait(@CurrentUser() u: CurrentUserPayload, @Param('entryId', uuid()) entryId: string) {
    return this.classes.removeFromWaitlist(u.tenantId, entryId);
  }

  @Post('enrollments/:reservationId/cancel')
  @RequirePermission('bookings', 'write')
  async cancelEnrollment(@CurrentUser() u: CurrentUserPayload, @Param('reservationId', uuid()) rid: string, @Body() dto: { byCustomer?: boolean }) {
    return this.classes.cancelEnrollment(u.tenantId, rid, dto?.byCustomer !== false, await this.actor(u));
  }

  @Post('enrollments/:reservationId/mark')
  @RequirePermission('bookings', 'write')
  async mark(@CurrentUser() u: CurrentUserPayload, @Param('reservationId', uuid()) rid: string, @Body() dto: { mark: 'attended' | 'no_show' | 'reset' }) {
    return this.classes.mark(u.tenantId, rid, dto?.mark, await this.actor(u));
  }

  @Get(':id')
  get(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string) {
    return this.classes.get(u.tenantId, id);
  }

  @Get(':id/roster')
  roster(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string) {
    return this.classes.roster(u.tenantId, id);
  }

  @Post()
  @RequirePermission('bookings', 'write')
  create(@CurrentUser() u: CurrentUserPayload, @Body() dto: any) {
    return this.classes.create(u.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermission('bookings', 'write')
  update(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: any) {
    return this.classes.update(u.tenantId, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermission('bookings', 'write')
  async cancel(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: { scope?: 'one' | 'future' }) {
    return this.classes.cancel(u.tenantId, id, await this.actor(u), dto?.scope === 'future' ? 'future' : 'one');
  }

  @Post(':id/complete')
  @RequirePermission('bookings', 'write')
  async complete(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string) {
    return this.classes.complete(u.tenantId, id, await this.actor(u));
  }

  @Post(':id/enroll')
  @RequirePermission('bookings', 'write')
  async enroll(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: any) {
    return this.classes.enroll(u.tenantId, id, dto || {}, await this.actor(u));
  }
}

/* ======================= АБОНЕМЕНТЫ / ПАКЕТЫ ======================= */

@Controller('bookings/passes')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('bookings', 'read')
export class BookingPassesController {
  constructor(private readonly passes: BookingsPassesService, private readonly reservations: ReservationsService) {}

  @Get('plans')
  plans(@CurrentUser() u: CurrentUserPayload) {
    return this.passes.listPlans(u.tenantId);
  }

  @Post('plans')
  @RequirePermission('bookings_manage_settings', 'write')
  createPlan(@CurrentUser() u: CurrentUserPayload, @Body() dto: any) {
    return this.passes.createPlan(u.tenantId, dto);
  }

  @Patch('plans/:id')
  @RequirePermission('bookings_manage_settings', 'write')
  updatePlan(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: any) {
    return this.passes.updatePlan(u.tenantId, id, dto);
  }

  @Delete('plans/:id')
  @RequirePermission('bookings_manage_settings', 'delete')
  deletePlan(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string) {
    return this.passes.deletePlan(u.tenantId, id);
  }

  @Get()
  list(@CurrentUser() u: CurrentUserPayload, @Query() q: any) {
    return this.passes.list(u.tenantId, q);
  }

  @Get('stats')
  stats(@CurrentUser() u: CurrentUserPayload) {
    return this.passes.stats(u.tenantId);
  }

  @Get('usable')
  usable(@CurrentUser() u: CurrentUserPayload, @Query('contactId', uuid()) contactId: string, @Query('serviceId') serviceId?: string) {
    return this.passes.usableFor(u.tenantId, contactId, serviceId);
  }

  @Post()
  @RequirePermission('bookings', 'write')
  async sell(@CurrentUser() u: CurrentUserPayload, @Body() dto: any) {
    return this.passes.sell(u.tenantId, dto, await this.reservations.findActingStaffUserId(u.tenantId, u.email));
  }

  @Get(':id')
  get(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string) {
    return this.passes.get(u.tenantId, id);
  }

  @Post(':id/freeze')
  @RequirePermission('bookings', 'write')
  freeze(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: any) {
    return this.passes.freeze(u.tenantId, id, dto || {});
  }

  @Post(':id/unfreeze')
  @RequirePermission('bookings', 'write')
  unfreeze(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string) {
    return this.passes.unfreeze(u.tenantId, id);
  }

  @Post(':id/adjust')
  @RequirePermission('bookings', 'write')
  adjust(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: any) {
    return this.passes.adjust(u.tenantId, id, dto || {});
  }

  @Post(':id/cancel')
  @RequirePermission('bookings', 'write')
  cancel(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string) {
    return this.passes.cancel(u.tenantId, id);
  }
}

/* ======================= АРЕНДА ======================= */

@Controller('bookings/rental')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('bookings', 'read')
export class BookingRentalController {
  constructor(private readonly rental: BookingsRentalService, private readonly reservations: ReservationsService) {}

  private actor(u: CurrentUserPayload) {
    return this.reservations.findActingStaffUserId(u.tenantId, u.email);
  }

  @Get('desk')
  desk(@CurrentUser() u: CurrentUserPayload, @Query('date') date?: string) {
    return this.rental.desk(u.tenantId, date);
  }

  @Get('timeline')
  timeline(@CurrentUser() u: CurrentUserPayload, @Query() q: any) {
    return this.rental.timeline(u.tenantId, q);
  }

  @Post('quote')
  quote(@CurrentUser() u: CurrentUserPayload, @Body() dto: any) {
    return this.rental.quote(u.tenantId, dto);
  }

  @Post('rentals')
  @RequirePermission('bookings', 'write')
  async create(@CurrentUser() u: CurrentUserPayload, @Body() dto: any) {
    return this.rental.createRental(u.tenantId, dto, await this.actor(u));
  }

  @Post('rentals/:id/issue')
  @RequirePermission('bookings', 'write')
  async issue(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: any) {
    return this.rental.issue(u.tenantId, id, dto || {}, await this.actor(u));
  }

  @Post('rentals/:id/return')
  @RequirePermission('bookings', 'write')
  async ret(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: any) {
    return this.rental.returnItem(u.tenantId, id, dto || {}, await this.actor(u));
  }

  @Post('rentals/:id/extend')
  @RequirePermission('bookings', 'write')
  async extend(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: any) {
    return this.rental.extend(u.tenantId, id, dto || {}, await this.actor(u));
  }
}

/* ======================= ВЕРТИКАЛЬ: настройки, обзор, консультации ======================= */

@Controller('bookings/vertical')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('bookings', 'read')
export class BookingVerticalController {
  constructor(private readonly vertical: BookingsVerticalService, private readonly reservations: ReservationsService) {}

  @Get('settings')
  settings(@CurrentUser() u: CurrentUserPayload) {
    return this.vertical.getSettings(u.tenantId);
  }

  @Patch('settings')
  @RequirePermission('bookings_manage_settings', 'write')
  updateSettings(@CurrentUser() u: CurrentUserPayload, @Body() dto: any) {
    return this.vertical.updateSettings(u.tenantId, dto || {});
  }

  @Get('overview')
  overview(@CurrentUser() u: CurrentUserPayload, @Query('locationId') locationId?: string) {
    return this.vertical.overview(u.tenantId, locationId);
  }

  @Get('follow-ups')
  followUps(@CurrentUser() u: CurrentUserPayload, @Query('days') days?: string) {
    return this.vertical.followUps(u.tenantId, Math.min(365, Math.max(1, Number(days) || 14)));
  }

  @Post('reservations/:id/meeting')
  @RequirePermission('bookings', 'write')
  async meeting(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: any) {
    return this.vertical.setMeeting(u.tenantId, id, dto || {}, await this.reservations.findActingStaffUserId(u.tenantId, u.email));
  }

  @Post('reservations/:id/session')
  @RequirePermission('bookings', 'write')
  async session(@CurrentUser() u: CurrentUserPayload, @Param('id', uuid()) id: string, @Body() dto: any) {
    return this.vertical.saveSession(u.tenantId, id, dto || {}, await this.reservations.findActingStaffUserId(u.tenantId, u.email));
  }
}
