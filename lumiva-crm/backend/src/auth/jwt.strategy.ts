// backend/src/auth/jwt.strategy.ts
import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';

import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Tenant } from '../tenants/tenant.entity';
import { getTenantBlockReason } from '../tenants/tenant-status.util';
import { TenantLogsService } from '../tenants/tenant-logs.service';
import { User } from '../users/user.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { UserSessionsService } from './user-sessions.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
    private readonly tenantLogs: TenantLogsService,
    private readonly userSessions: UserSessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: any): Promise<CurrentUserPayload> {
    const tenantId = payload?.tenantId as string | undefined;
    const tenant = tenantId
      ? await this.tenantsRepo.findOne({ where: { id: tenantId } })
      : null;

    const tenantBlockReason = getTenantBlockReason(tenant);
    if (tenantBlockReason === 'blocked') {
      const logTenantId = tenant?.id ?? tenantId ?? '';
      await this.tenantLogs.record({
        tenantId: logTenantId,
        type: 'jwt_denied',
        statusCode: 403,
        method: 'JWT',
        path: 'auth',
        message: `JWT blocked: ${tenantBlockReason}`,
        meta: {
          reason: tenantBlockReason,
          activeUntil: tenant?.activeUntil,
        },
      });

      throw new ForbiddenException({
        code: 'TENANT_INACTIVE',
        reason: tenantBlockReason,
        message: 'Тенант заблокирован',
        activeUntil: tenant?.activeUntil,
      });
    }

    if (!payload?.sid) {
      throw new UnauthorizedException({
        code: 'SESSION_INVALID',
        message: 'Войдите снова',
      });
    }

    const session = await this.userSessions.findActiveById(payload.sid);
    if (
      !session ||
      session.userId !== payload.sub ||
      session.tenantId !== payload.tenantId
    ) {
      throw new UnauthorizedException({
        code: 'SESSION_INVALID',
        message: 'Сессия завершена',
      });
    }

    void this.userSessions.touchSessionIfStale(session.id);

    const dbUser = await this.usersRepo.findOne({ where: { id: payload.sub } });
    if (!dbUser || dbUser.status !== 'active') {
      throw new UnauthorizedException('User is disabled');
    }
    if (dbUser.tenantId !== payload.tenantId) {
      throw new UnauthorizedException({
        code: 'SESSION_INVALID',
        message: 'Сессия недействительна',
      });
    }

    const staff = await this.staffRepo.findOne({
      where: { tenantId: dbUser.tenantId, email: dbUser.email },
    });
    if (staff && !staff.isActive) {
      throw new UnauthorizedException('User is disabled');
    }

    const user: CurrentUserPayload = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      email: dbUser.email?.trim() || payload.email,
    };

    Logger.debug(`JWT validate user = ${JSON.stringify(user)}`, 'JwtStrategy');
    return user;
  }
}
