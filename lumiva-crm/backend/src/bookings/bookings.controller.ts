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
import { BookingsProjectsService } from './bookings-projects.service';
import { BookingsCatalogService } from './bookings-catalog.service';
import { BookingsStaffService } from './bookings-staff.service';
import { BookingsAvailabilityService } from './bookings-availability.service';
import { ReservationsService, ReservationListFilters } from './reservations.service';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('bookings', 'read')
export class BookingsController {
  constructor(
    private readonly projects: BookingsProjectsService,
    private readonly catalog: BookingsCatalogService,
    private readonly staff: BookingsStaffService,
    private readonly availability: BookingsAvailabilityService,
    private readonly reservations: ReservationsService,
  ) {}

  /* ---------- project settings ---------- */

  @Get('project')
  getProject(@CurrentUser() user: CurrentUserPayload) {
    return this.projects.getOrCreateDefaultProject(user.tenantId);
  }

  @Patch('project')
  @RequirePermission('bookings_manage_settings', 'write')
  updateProject(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.projects.updateSettings(user.tenantId, dto);
  }

  /* ---------- locations ---------- */

  @Get('locations')
  listLocations(@CurrentUser() user: CurrentUserPayload) {
    return this.catalog.listLocations(user.tenantId);
  }

  @Post('locations')
  @RequirePermission('bookings_manage_settings', 'write')
  createLocation(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.catalog.createLocation(user.tenantId, dto);
  }

  @Patch('locations/:id')
  @RequirePermission('bookings_manage_settings', 'write')
  updateLocation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.catalog.updateLocation(user.tenantId, id, dto);
  }

  @Delete('locations/:id')
  @RequirePermission('bookings_manage_settings', 'delete')
  deleteLocation(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalog.deleteLocation(user.tenantId, id);
  }

  @Post('locations/:id/closures')
  @RequirePermission('bookings_manage_settings', 'write')
  addLocationClosure(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { date: string; reason?: string },
  ) {
    return this.catalog.addLocationClosure(user.tenantId, id, {
      date: dto.date,
      reason: dto.reason || null,
    });
  }

  @Delete('locations/:id/closures/:index')
  @RequirePermission('bookings_manage_settings', 'write')
  removeLocationClosure(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('index') index: string,
  ) {
    return this.catalog.removeLocationClosure(user.tenantId, id, Number(index));
  }

  /* ---------- services ---------- */

  @Get('services')
  listServices(@CurrentUser() user: CurrentUserPayload) {
    return this.catalog.listServices(user.tenantId);
  }

  @Post('services')
  @RequirePermission('bookings_manage_settings', 'write')
  createService(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.catalog.createService(user.tenantId, dto);
  }

  @Patch('services/:id')
  @RequirePermission('bookings_manage_settings', 'write')
  updateService(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.catalog.updateService(user.tenantId, id, dto);
  }

  @Delete('services/:id')
  @RequirePermission('bookings_manage_settings', 'delete')
  deleteService(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalog.deleteService(user.tenantId, id);
  }

  /* ---------- resources ---------- */

  @Get('resources')
  listResources(@CurrentUser() user: CurrentUserPayload) {
    return this.catalog.listResources(user.tenantId);
  }

  @Post('resources')
  @RequirePermission('bookings_manage_settings', 'write')
  createResource(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.catalog.createResource(user.tenantId, dto);
  }

  @Patch('resources/:id')
  @RequirePermission('bookings_manage_settings', 'write')
  updateResource(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.catalog.updateResource(user.tenantId, id, dto);
  }

  @Delete('resources/:id')
  @RequirePermission('bookings_manage_settings', 'delete')
  deleteResource(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalog.deleteResource(user.tenantId, id);
  }

  /* ---------- staff booking profiles ---------- */

  @Get('staff')
  listStaff(@CurrentUser() user: CurrentUserPayload) {
    return this.staff.listStaff(user.tenantId);
  }

  @Patch('staff/:staffUserId')
  @RequirePermission('bookings_manage_settings', 'write')
  updateStaffProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Param('staffUserId', new ParseUUIDPipe()) staffUserId: string,
    @Body() dto: any,
  ) {
    return this.staff.upsertProfile(user.tenantId, staffUserId, dto);
  }

  /* ---------- availability ---------- */

  @Get('availability/staff-grid')
  getStaffGrid(
    @CurrentUser() user: CurrentUserPayload,
    @Query('date') date: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.availability.getStaffGrid(user.tenantId, date, locationId);
  }

  @Post('availability/inspect')
  inspectSlot(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.availability.inspectSlot(user.tenantId, {
      staffUserId: dto.staffUserId,
      resourceId: dto.resourceId,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
    });
  }

  @Post('availability/staff/:staffUserId/time-off')
  @RequirePermission('bookings_manage_settings', 'write')
  addStaffTimeOff(
    @CurrentUser() user: CurrentUserPayload,
    @Param('staffUserId', new ParseUUIDPipe()) staffUserId: string,
    @Body() dto: { from: string; to: string; reason?: string },
  ) {
    return this.availability.addStaffTimeOff(user.tenantId, staffUserId, {
      from: dto.from,
      to: dto.to,
      reason: dto.reason || null,
    });
  }

  @Delete('availability/staff/:staffUserId/time-off/:index')
  @RequirePermission('bookings_manage_settings', 'write')
  removeStaffTimeOff(
    @CurrentUser() user: CurrentUserPayload,
    @Param('staffUserId', new ParseUUIDPipe()) staffUserId: string,
    @Param('index') index: string,
  ) {
    return this.availability.removeStaffTimeOff(user.tenantId, staffUserId, Number(index));
  }

  @Post('availability/reassign')
  @RequirePermission('bookings', 'write')
  async reassign(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: { fromStaffUserId: string; toStaffUserId: string | null; fromDate: string; toDate: string },
  ) {
    const actingStaffUserId = await this.reservations.findActingStaffUserId(user.tenantId, user.email);
    return this.availability.reassignStaffBookings(user.tenantId, dto, actingStaffUserId);
  }

  /* ---------- reservations ---------- */

  @Get('reservations')
  listReservations(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ReservationListFilters,
  ) {
    return this.reservations.list(user.tenantId, query);
  }

  // ВАЖНО: перед 'reservations/:id' — иначе 'upcoming-by-lead'/'by-lead' попадут в
  // ParseUUIDPipe как :id и упадут (тот же принцип, что в ProductsModule).
  @Get('reservations/upcoming-by-lead')
  listUpcomingByLead(@CurrentUser() user: CurrentUserPayload) {
    return this.reservations.listUpcomingByLead(user.tenantId);
  }

  @Get('reservations/by-lead/:leadId')
  listByLead(
    @CurrentUser() user: CurrentUserPayload,
    @Param('leadId', new ParseUUIDPipe()) leadId: string,
  ) {
    return this.reservations.listByLead(user.tenantId, leadId);
  }

  @Get('reservations/customer-stats/:contactId')
  getCustomerStats(
    @CurrentUser() user: CurrentUserPayload,
    @Param('contactId', new ParseUUIDPipe()) contactId: string,
  ) {
    return this.reservations.getCustomerStats(user.tenantId, contactId);
  }

  @Get('reservations/:id')
  getReservation(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.reservations.findOne(user.tenantId, id);
  }

  @Get('reservations/:id/activity')
  getReservationActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.reservations.getActivity(user.tenantId, id);
  }

  @Post('reservations')
  @RequirePermission('bookings', 'write')
  async createReservation(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    const actingStaffUserId = await this.reservations.findActingStaffUserId(
      user.tenantId,
      user.email,
    );
    return this.reservations.create(user.tenantId, dto, actingStaffUserId);
  }

  @Patch('reservations/:id')
  @RequirePermission('bookings', 'write')
  async updateReservation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    const actingStaffUserId = await this.reservations.findActingStaffUserId(
      user.tenantId,
      user.email,
    );
    return this.reservations.update(user.tenantId, id, dto, actingStaffUserId);
  }

  @Post('reservations/:id/confirm')
  @RequirePermission('bookings', 'write')
  async confirm(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    const actingStaffUserId = await this.reservations.findActingStaffUserId(user.tenantId, user.email);
    return this.reservations.confirm(user.tenantId, id, actingStaffUserId);
  }

  @Post('reservations/:id/cancel')
  @RequirePermission('bookings', 'write')
  async cancel(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    const actingStaffUserId = await this.reservations.findActingStaffUserId(user.tenantId, user.email);
    return this.reservations.cancelByBusiness(user.tenantId, id, actingStaffUserId);
  }

  @Post('reservations/:id/reject')
  @RequirePermission('bookings', 'write')
  async reject(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    const actingStaffUserId = await this.reservations.findActingStaffUserId(user.tenantId, user.email);
    return this.reservations.reject(user.tenantId, id, actingStaffUserId);
  }

  @Post('reservations/:id/check-in')
  @RequirePermission('bookings', 'write')
  async checkIn(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    const actingStaffUserId = await this.reservations.findActingStaffUserId(user.tenantId, user.email);
    return this.reservations.checkIn(user.tenantId, id, actingStaffUserId);
  }

  @Post('reservations/:id/complete')
  @RequirePermission('bookings', 'write')
  async complete(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    const actingStaffUserId = await this.reservations.findActingStaffUserId(user.tenantId, user.email);
    return this.reservations.complete(user.tenantId, id, actingStaffUserId);
  }

  @Post('reservations/:id/no-show')
  @RequirePermission('bookings', 'write')
  async markNoShow(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    const actingStaffUserId = await this.reservations.findActingStaffUserId(user.tenantId, user.email);
    return this.reservations.markNoShow(user.tenantId, id, actingStaffUserId);
  }
}
