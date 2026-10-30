import { Controller, Delete, ForbiddenException, Get, MessageEvent, Param, ParseUUIDPipe, Post, Query, Sse, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable } from 'rxjs';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { User } from '../users/user.entity';
import { HotelLiveService } from './hotel-live.service';

const uid = (u: CurrentUserPayload) => u.userId ?? u.id ?? u.sub ?? '';

/** Живые обновления PMS (шахматка, экран дня, уборка, брони) и мягкие блокировки редактирования брони */
@Controller('hotels/live')
export class HotelLiveController {
  constructor(
    private readonly live: HotelLiveService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Одноразовый билет на поток (живёт 60 с) */
  @Post('ticket')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('hotels', 'read')
  ticket(@CurrentUser() user: CurrentUserPayload) {
    return this.live.issueTicket(user.tenantId, uid(user));
  }

  /** Поток событий компании (Server-Sent Events) — вход по билету */
  @Sse('stream')
  stream(@Query('ticket') ticket?: string): Observable<MessageEvent> {
    const t = this.live.redeemTicket(ticket);
    if (!t) throw new ForbiddenException({ code: 'HOTEL_LIVE_TICKET', message: 'Билет недействителен — запросите новый' });
    return this.live.stream(t.tenantId) as Observable<MessageEvent>;
  }

  @Get('locks')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('hotels', 'read')
  locks(@CurrentUser() user: CurrentUserPayload) {
    return this.live.listLocks(user.tenantId);
  }

  /** Взять или продлить блокировку брони (клиент продлевает каждые ~20 с, живёт 45 с) */
  @Post('locks/:reservationId')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('hotels_manage_reservations', 'write')
  async acquire(@CurrentUser() user: CurrentUserPayload, @Param('reservationId', new ParseUUIDPipe()) reservationId: string) {
    const id = uid(user);
    let name = user.name || '';
    if (!name) {
      const u = await this.users.findOne({ where: { id, tenantId: user.tenantId } });
      name = u?.name || u?.email || '—';
    }
    return this.live.acquire(user.tenantId, reservationId, id, name);
  }

  @Delete('locks/:reservationId')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @RequirePermission('hotels', 'read')
  release(@CurrentUser() user: CurrentUserPayload, @Param('reservationId', new ParseUUIDPipe()) reservationId: string) {
    return this.live.release(user.tenantId, reservationId, uid(user));
  }
}
