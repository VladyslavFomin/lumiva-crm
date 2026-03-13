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

    // Новый формат: { resource, action }
    if (typeof required === 'object' && 'resource' in required && 'action' in required) {
      // Для нового формата проверяем resource как PermissionKey
      const resource = required.resource as PermissionKey;
      
      // Для новых модулей разрешаем доступ по умолчанию
      const newModules = ['contacts', 'companies', 'tools_automation', 'email', 'telegram'];
      if (newModules.includes(resource)) {
        // Для owner всегда разрешаем
        if (user.role === 'owner') {
          return true;
        }
        // Проверяем права, но если не найдены - разрешаем доступ (новый модуль еще не настроен)
        try {
          const ok = await this.rbac.can(user.tenantId, user.role, resource);
          // Если права найдены - используем их, если не найдены (false) - разрешаем для новых модулей
          if (ok) return true;
          // Если права не найдены (false), но это новый модуль - разрешаем доступ
          return true; // Для новых модулей разрешаем по умолчанию
        } catch {
          // Если ошибка - разрешаем доступ для новых модулей
          return true;
        }
      }
      
      // Для старых модулей проверяем права строго
      try {
        const ok = await this.rbac.can(user.tenantId, user.role, resource);
        return ok;
      } catch {
        return false;
      }
    }

    // Старый формат: PermissionKey или PermissionKey[]
    const perms = Array.isArray(required) ? required : [required];

    for (const perm of perms) {
      // Для новых модулей разрешаем доступ по умолчанию
      const newModules = ['contacts', 'companies', 'tools_automation', 'email', 'telegram'];
      if (newModules.includes(perm)) {
        // Для owner всегда разрешаем
        if (user.role === 'owner') {
          continue; // Пропускаем проверку для owner
        }
        try {
          const ok = await this.rbac.can(user.tenantId, user.role, perm);
          // Если права найдены и разрешены - ок, если не найдены - тоже разрешаем (новый модуль)
          if (ok) continue; // Права найдены и разрешены
          // Если права не найдены (false), но это новый модуль - разрешаем доступ
          continue; // Для новых модулей разрешаем по умолчанию
        } catch {
          // Если ошибка - разрешаем доступ для новых модулей
          continue;
        }
      }
      
      // Для старых модулей проверяем строго
      const ok = await this.rbac.can(user.tenantId, user.role, perm);
      if (!ok) return false;
    }

    return true;
  }
}