import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { AuditLogService } from '../audit-log/audit-log.service';
import { HotelGuestProfilesService, HotelGuestProfileInput } from './hotel-guest-profiles.service';

/** Профили гостей: список, карточка с историей, подсказки для формы брони, дубли и слияние, анонимизация */
@Controller('hotels/guests')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelGuestProfilesController {
  constructor(private readonly guests: HotelGuestProfilesService, private readonly auditLog: AuditLogService) {}

  private actor(user: CurrentUserPayload) {
    return String((user as any).userId ?? (user as any).id ?? (user as any).sub ?? '') || null;
  }

  @Get()
  list(@CurrentUser() user: CurrentUserPayload, @Query() q: { search?: string; filter?: string; country?: string; sort?: string; page?: string; pageSize?: string }) {
    return this.guests.list(user.tenantId, { ...q, page: Number(q.page) || 1, pageSize: Number(q.pageSize) || 50 });
  }

  @Get('lookup')
  lookup(@CurrentUser() user: CurrentUserPayload, @Query('q') q: string) {
    return this.guests.lookup(user.tenantId, q);
  }

  @Get('duplicates')
  duplicates(@CurrentUser() user: CurrentUserPayload) {
    return this.guests.duplicates(user.tenantId);
  }

  /** Собрать профили из броней без профиля — пачкой, фронт вызывает, пока remaining > 0 */
  @Post('backfill')
  @RequirePermission('hotels_manage_reservations', 'write')
  backfill(@CurrentUser() user: CurrentUserPayload) {
    return this.guests.backfill(user.tenantId, 300);
  }

  @Post('merge')
  @RequirePermission('hotels_manage_reservations', 'delete')
  async merge(@CurrentUser() user: CurrentUserPayload, @Body() dto: { targetId: string; sourceIds: string[] }) {
    const res = await this.guests.merge(user.tenantId, dto?.targetId, dto?.sourceIds || []);
    void this.auditLog.log({ tenantId: user.tenantId, entityType: 'hotel_guest_profile', entityId: res.id, entityLabel: null as any, action: 'update', summary: `Объединены профили гостя (${res.merged})`, actorUserId: this.actor(user) } as any);
    return res;
  }

  /** Короткая сводка для карточки брони и стойки: VIP, чёрный список, предпочтения, сколько раз был */
  @Get(':id/brief')
  brief(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.guests.brief(user.tenantId, id);
  }

  @Get(':id')
  get(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.guests.get(user.tenantId, id);
  }

  @Post()
  @RequirePermission('hotels_manage_reservations', 'write')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: HotelGuestProfileInput) {
    return this.guests.create(user.tenantId, dto || {});
  }

  @Patch(':id')
  @RequirePermission('hotels_manage_reservations', 'write')
  update(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: HotelGuestProfileInput) {
    return this.guests.update(user.tenantId, id, dto || {});
  }

  @Post(':id/anonymize')
  @RequirePermission('hotels_manage_reservations', 'delete')
  async anonymize(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    const p = await this.guests.anonymize(user.tenantId, id);
    void this.auditLog.log({ tenantId: user.tenantId, entityType: 'hotel_guest_profile', entityId: id, entityLabel: p.fullName, action: 'update', summary: 'Профиль гостя анонимизирован (KVKK / GDPR)', actorUserId: this.actor(user) } as any);
    return p;
  }
}
