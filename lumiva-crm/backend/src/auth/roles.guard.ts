// src/auth/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import type { StaffRole } from '../staff/staff-user.entity';

// payload, который кладём в req.user через JwtStrategy
interface CurrentUserPayload {
  sub: string;
  tenantId: string;
  role?: StaffRole;   // ВАЖНО: сюда потом положим роль из staff_users
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<StaffRole[]>(ROLES_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]);

    // если на ручке нет @Roles — пропускаем всех авторизованных
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserPayload | undefined;

    if (!user?.role) {
      throw new ForbiddenException('Роль пользователя не определена');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Недостаточно прав для доступа');
    }

    return true;
  }
}