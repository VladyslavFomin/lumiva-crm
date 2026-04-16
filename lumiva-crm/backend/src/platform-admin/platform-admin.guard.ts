// src/platform-admin/platform-admin.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Гард для платформенного админа.
 * Просто проверяет, что токен валиден по стратегии "platform-admin-jwt".
 * Никаких дополнительных проверок (role, isPlatformAdmin) здесь не делаем.
 */
@Injectable()
export class PlatformAdminGuard extends AuthGuard('platform-admin-jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;
    console.log(`[PlatformAdminGuard] ${request.method} ${request.url}`, {
      hasAuthHeader: !!authHeader,
      authHeaderPreview: authHeader ? authHeader.substring(0, 30) + '...' : null,
    });
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      console.error('[PlatformAdminGuard] Auth failed:', { err, info });
      throw err || new Error('Unauthorized');
    }
    console.log('[PlatformAdminGuard] Auth successful for user:', user.email);
    return user;
  }
}