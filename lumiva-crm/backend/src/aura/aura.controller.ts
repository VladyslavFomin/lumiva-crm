import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { AuraService, type AuraAppInput } from './aura.service';
import { AuraAiService } from './aura-ai.service';
import { sanitizeAuraConfig } from './aura-catalog';

/** Aura — конструктор приложений-дашбордов. Доступ к самому конструктору — право «Аналитика»;
 * доступ к данным каждого раздела проверяется отдельно (AuraDataService.buildScope). */
@Controller('aura')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('analytics', 'read')
export class AuraController {
  constructor(
    private readonly aura: AuraService,
    private readonly ai: AuraAiService,
  ) {}

  @Get('apps')
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.aura.list(user);
  }

  @Get('apps/menu')
  menu(@CurrentUser() user: CurrentUserPayload) {
    return this.aura.menu(user);
  }

  @Get('apps/:id')
  get(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.aura.get(user, id);
  }

  @Post('apps')
  create(@CurrentUser() user: CurrentUserPayload, @Body() body: AuraAppInput) {
    return this.aura.create(user, body || {});
  }

  @Patch('apps/:id')
  update(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: AuraAppInput) {
    return this.aura.update(user, id, body || {});
  }

  @Delete('apps/:id')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.aura.remove(user, id);
  }

  @Post('apps/:id/duplicate')
  duplicate(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: { name?: string }) {
    return this.aura.duplicate(user, id, body?.name);
  }

  @Get('apps/:id/data')
  appData(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() q: { period?: string; filters?: string; tz?: string },
  ) {
    return this.aura.appData(user, id, q || {});
  }

  /** Данные черновика / превью шаблонов (конфиг в теле). */
  @Post('data')
  @Throttle({ long: { limit: 120, ttl: 60000 } })
  data(@CurrentUser() user: CurrentUserPayload, @Body() body: { config?: unknown; widgets?: string[]; period?: string; filters?: unknown; tz?: string }) {
    return this.aura.previewData(user, body || {});
  }

  @Get('apps/:id/share')
  getShare(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.aura.getShare(user, id);
  }

  @Put('apps/:id/share')
  saveShare(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { enabled?: boolean; password?: string | null; expiresAt?: string | null; regenerate?: boolean },
  ) {
    return this.aura.saveShare(user, id, body || {});
  }

  @Post('ai/brief')
  @Throttle({ long: { limit: 20, ttl: 60000 } })
  brief(@CurrentUser() user: CurrentUserPayload, @Body() body: { prompt?: string; lang?: string }) {
    return this.ai.brief(user.tenantId, AuraService.userIdOf(user), String(body?.prompt || ''), body?.lang, AuraController.viewer(user));
  }

  @Post('ai/answer')
  @Throttle({ long: { limit: 30, ttl: 60000 } })
  answer(@CurrentUser() user: CurrentUserPayload, @Body() body: { questionId?: string; text?: string; options?: string[] }) {
    return this.ai.answer(user.tenantId, AuraService.userIdOf(user), String(body?.questionId || ''), String(body?.text || ''), body?.options || []);
  }

  @Post('ai/edit')
  @Throttle({ long: { limit: 30, ttl: 60000 } })
  edit(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { config?: unknown; theme?: string; density?: string; title?: string; message?: string; lang?: string },
  ) {
    const state = {
      config: sanitizeAuraConfig(body?.config),
      theme: (['lumiva', 'bento', 'graphite', 'swiss', 'industry'].includes(String(body?.theme)) ? body!.theme : 'lumiva') as any,
      density: (['normal', 'compact', 'large'].includes(String(body?.density)) ? body!.density : 'normal') as any,
      title: String(body?.title || '').slice(0, 160),
    };
    return this.ai.edit(user.tenantId, AuraService.userIdOf(user), state, String(body?.message || ''), body?.lang, AuraController.viewer(user));
  }

  private static viewer(user: CurrentUserPayload) {
    return { userId: AuraService.userIdOf(user), role: user.role, email: user.email, staffUserId: user.staffUserId ?? null };
  }
}
