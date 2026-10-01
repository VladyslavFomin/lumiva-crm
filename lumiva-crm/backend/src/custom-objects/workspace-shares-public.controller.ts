import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WorkspaceSharesService } from './workspace-shares.service';
import { GeocodeService } from './geocode.service';

/** Публичная аналитика таблицы рабочей области по ссылке — без авторизации. */
@Controller('public/workspace-share')
export class WorkspaceSharesPublicController {
  constructor(
    private readonly shares: WorkspaceSharesService,
    private readonly geocode: GeocodeService,
  ) {}

  @Get(':clientKey/:objectId')
  info(
    @Param('clientKey') clientKey: string,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
  ) {
    return this.shares.publicInfo(clientKey, objectId);
  }

  /** Подбор пароля: не больше 10 попыток в минуту с одного IP. */
  @Post(':clientKey/:objectId/unlock')
  @Throttle({ long: { limit: 10, ttl: 60000 }, medium: { limit: 5, ttl: 10000 } })
  unlock(
    @Param('clientKey') clientKey: string,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @Body() body: { password?: string },
  ) {
    return this.shares.unlock(clientKey, objectId, String(body?.password ?? ''));
  }

  @Get(':clientKey/:objectId/data')
  data(
    @Param('clientKey') clientKey: string,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @Headers('x-share-token') token?: string,
  ) {
    return this.shares.publicData(clientKey, objectId, token);
  }

  /** Координаты городов для блока «Карта» — только для живой ссылки (и с паролем, если он есть). */
  @Post(':clientKey/:objectId/geocode')
  @Throttle({ long: { limit: 30, ttl: 60000 } })
  async geocodePublic(
    @Param('clientKey') clientKey: string,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
    @Body() body: { queries?: string[]; country?: string },
    @Headers('x-share-token') token?: string,
  ) {
    await this.shares.assertViewer(clientKey, objectId, token);
    return this.geocode.geocodeMany(body?.queries, body?.country);
  }
}
