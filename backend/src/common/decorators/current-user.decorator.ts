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