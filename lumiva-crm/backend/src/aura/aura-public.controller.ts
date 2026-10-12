import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuraService } from './aura.service';

/** Публичная ссылка на приложение Aura (ТВ-экран, партнёры) — без авторизации CRM. */
@Controller('public/aura')
export class AuraPublicController {
  constructor(private readonly aura: AuraService) {}

  @Get(':shareKey')
  info(@Param('shareKey') shareKey: string) {
    return this.aura.publicInfo(String(shareKey).slice(0, 32));
  }

  /** Подбор пароля: не больше 10 попыток в минуту с одного IP. */
  @Post(':shareKey/unlock')
  @Throttle({ long: { limit: 10, ttl: 60000 }, medium: { limit: 5, ttl: 10000 } })
  unlock(@Param('shareKey') shareKey: string, @Body() body: { password?: string }) {
    return this.aura.publicUnlock(String(shareKey).slice(0, 32), String(body?.password ?? ''));
  }

  @Get(':shareKey/data')
  @Throttle({ long: { limit: 60, ttl: 60000 } })
  data(
    @Param('shareKey') shareKey: string,
    @Query() q: { period?: string; filters?: string; tz?: string },
    @Headers('x-share-token') token?: string,
  ) {
    return this.aura.publicData(String(shareKey).slice(0, 32), token, q || {});
  }
}
