// src/audit-log/audit-log.controller.ts
import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RbacService } from '../rbac/rbac.service';
import type { PermissionKey } from '../rbac/permission.types';
import { AuditLogService } from './audit-log.service';
import type { AuditLogAction, AuditLogEntityType } from './audit-log.entity';

// entityType -> базовое право модуля, тем же ключом что и на GET/:id самой сущности. Просмотр
// истории ОДНОЙ записи, которую сотрудник и так может открыть — не "настройка" (см. коммент ниже),
// поэтому не требуем 'settings'. Глобальная лента без entityId — другое дело (обзор across
// модулей, без привязки к конкретной записи), там ownership-фильтров нет вообще ни на одном
// уровне, поэтому оставляем её строго за 'settings', как было изначально.
const ENTITY_PERMISSION: Partial<Record<AuditLogEntityType, PermissionKey>> = {
  lead: 'leads',
  project: 'projects',
  sale: 'sales',
  contact: 'contacts',
  company: 'companies',
  reservation: 'bookings',
  hotel_reservation: 'hotels',
  product: 'products',
};

@Controller('audit-log')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AuditLogController {
  constructor(
    private readonly service: AuditLogService,
    private readonly rbac: RbacService,
  ) {}

  // Раньше весь эндпоинт был за @RequirePermission('settings', 'read') — по дефолтной матрице
  // это только owner/developer, то есть manager/sales/viewer/finance/support не могли увидеть
  // историю изменений СВОЕЙ же продажи/контакта/компании на детали записи (тот же класс бага,
  // что и с custom-fields в этой сессии). Теперь: если запрошена история одной сущности
  // (entityId+entityType) — требуем только базовое право модуля; если entityId не передан
  // (глобальная лента) — по-прежнему требуем 'settings', т.к. там нет privacy-фильтра по записям.
  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('entityType') entityType?: AuditLogEntityType,
    @Query('entityId') entityId?: string,
    @Query('action') action?: AuditLogAction,
    @Query('actorUserId') actorUserId?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const requiredPermission: PermissionKey =
      entityId && entityType && ENTITY_PERMISSION[entityType]
        ? ENTITY_PERMISSION[entityType]!
        : 'settings';

    const allowed = await this.rbac.canForUser(
      user.tenantId,
      user.staffUserId || '',
      user.role as any,
      requiredPermission,
    );
    if (!allowed) {
      throw new ForbiddenException('Недостаточно прав для просмотра истории');
    }

    return this.service.findGlobal(user.tenantId, {
      entityType,
      entityId,
      action,
      actorUserId,
      search,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
