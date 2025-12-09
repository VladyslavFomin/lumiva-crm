// src/rbac/rbac.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService } from './rbac.service';
import { PERMISSION_META_KEY } from './require-permission.decorator';
import type { PermissionKey } from './permission.types';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<
      PermissionKey[] | PermissionKey | undefined
    >(PERMISSION_META_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as any; // тоже без отдельного типа
    if (!user) return false;

    const perms = Array.isArray(required) ? required : [required];

    for (const perm of perms) {
      const ok = await this.rbac.can(user.tenantId, user.role, perm);
      if (!ok) return false;
    }

    return true;
  }
}