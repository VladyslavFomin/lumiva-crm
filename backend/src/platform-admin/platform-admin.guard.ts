// src/platform-admin/platform-admin.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Гард для платформенного админа.
 * Просто проверяет, что токен валиден по стратегии "platform-admin-jwt".
 * Никаких дополнительных проверок (role, isPlatformAdmin) здесь не делаем.
 */
@Injectable()
export class PlatformAdminGuard extends AuthGuard('platform-admin-jwt') {}