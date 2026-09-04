// backend/src/common/decorators/current-user.decorator.ts

import { createParamDecorator, ExecutionContext, Logger } from '@nestjs/common';

export type CurrentUserPayload = {
  userId?: string;
  id?: string; // Альтернативное имя для userId
  sub?: string; // JWT sub claim
  tenantId: string;
  role: string;
  email?: string;
  name?: string;
  /**
   * id строки staff_users (не users!) для этого человека, если такая строка есть — именно этим
   * id ключуются персональные права в staff_user_permissions/UserPermissionMatrix, потому что
   * это тот же id, что фронтенд получает из /staff-users и которым владелец выбирает сотрудника
   * на вкладке «Сотрудники». users.id и staff_users.id — разные UUID для одного и того же
   * человека (связаны только по tenantId+email), поэтому RbacGuard должен проверять
   * персональные права по staffUserId, а не по userId. Может отсутствовать (не у каждого User
   * есть строка в staff_users, напр. самый первый owner).
   */
  staffUserId?: string | null;
  /** id строки user_sessions для ТЕКУЩЕГО запроса — источник правды "это моя сессия" на странице аккаунта. */
  sessionId?: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as CurrentUserPayload | undefined;

    // Можно оставить лог на время отладки
    Logger.debug(
      `CurrentUser decorator user = ${JSON.stringify(user)}`,
      'CurrentUser',
    );

    // Если по какой-то причине user нет — вернём пустой объект,
    // чтобы Nest не упал. Но в норме он ДОЛЖЕН быть.
    return user ?? ({} as CurrentUserPayload);
  },
);