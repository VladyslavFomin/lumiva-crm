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
      PermissionKey[] | PermissionKey | { resource: string; action: string } | undefined
    >(PERMISSION_META_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as any;
    if (!user) return false;

    // staff_users.id, не users.id — персональные права ключуются тем же id, что фронтенд берёт
    // из /staff-users (см. CurrentUserPayload.staffUserId). users.id !== staff_users.id для
    // одного и того же человека, это две разные таблицы со своими UUID.
    const staffUserId: string | undefined | null = user.staffUserId;

    // Новые модули без явной настройки разрешены всем по умолчанию (fail-open) — см. комментарий
    // ниже. Но явное индивидуальное разрешение/запрет (панель «Индивидуальные права») должен
    // побеждать это поведение в обе стороны: если owner намеренно запретил конкретному человеку
    // доступ к, скажем, 'telephony', это должно реально блокировать, а не потеряться в fail-open.
    const newModules = ['tools_automation', 'custom_objects', 'email', 'telegram', 'whatsapp', 'telephony', 'notes'];

    const checkOne = async (perm: PermissionKey): Promise<boolean> => {
      if (user.role === 'owner') return true;

      if (staffUserId) {
        const override = await this.rbac.getUserOverride(user.tenantId, staffUserId, perm);
        if (override !== null) return override;
      }

      // Для новых модулей разрешаем доступ по умолчанию
      // 'contacts'/'companies' removed 2026-08-05: verified zero explicit deny-rows exist in
      // production for either key, so enforcing them for real can't lock anyone out today — see
      // [[lumiva_rbac_granularity_normalization]] memory for the audit that confirmed this.
      if (newModules.includes(perm)) {
        return true;
      }

      // Для старых модулей проверяем строго
      try {
        return await this.rbac.can(user.tenantId, user.role, perm);
      } catch {
        return false;
      }
    };

    // Новый формат: { resource, action }
    if (typeof required === 'object' && 'resource' in required && 'action' in required) {
      return checkOne(required.resource as PermissionKey);
    }

    // Старый формат: PermissionKey или PermissionKey[]
    const perms = Array.isArray(required) ? required : [required];
    for (const perm of perms) {
      if (!(await checkOne(perm))) return false;
    }
    return true;
  }
}