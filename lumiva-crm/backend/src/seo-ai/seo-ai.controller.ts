import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.interface';
import { SeoAiService } from './seo-ai.service';

@Controller('marketing/seo/ai')
@UseGuards(JwtAuthGuard)
export class SeoAiController {
  constructor(private readonly seoAi: SeoAiService) {}

  private tenant(user: CurrentUserPayload): string {
    if (!user?.tenantId) throw new BadRequestException('No tenant in auth payload');
    return user.tenantId;
  }

  /** Есть ли активный ИИ-сотрудник «SEO-менеджер» (без него ИИ-SEO закрыт) и можно ли его нанять. */
  @Get('access')
  access(@CurrentUser() user: CurrentUserPayload) {
    return this.seoAi.getAccess(this.tenant(user));
  }

  @Get('agent')
  async agent(@CurrentUser() user: CurrentUserPayload, @Query('site') site?: string) {
    await this.seoAi.assertAccess(this.tenant(user));
    return this.seoAi.getAgentPublic(this.tenant(user), user.userId ?? null, site);
  }

  @Patch('agent')
  async patchAgent(@CurrentUser() user: CurrentUserPayload, @Query('site') site: string | undefined, @Body() body: Record<string, any>) {
    await this.seoAi.assertAccess(this.tenant(user));
    return this.seoAi.patchAgent(this.tenant(user), user.userId ?? null, site, body || {});
  }

  @Get('reports')
  async reports(@CurrentUser() user: CurrentUserPayload, @Query('site') site?: string) {
    await this.seoAi.assertAccess(this.tenant(user));
    return this.seoAi.listReports(this.tenant(user), site);
  }

  @Get('reports/:id')
  async report(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    await this.seoAi.assertAccess(this.tenant(user));
    return this.seoAi.getReport(this.tenant(user), id);
  }

  @Delete('reports/:id')
  async deleteReport(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    await this.seoAi.assertAccess(this.tenant(user));
    return this.seoAi.deleteReport(this.tenant(user), id);
  }

  @Post('run')
  async run(@CurrentUser() user: CurrentUserPayload, @Query('site') site: string | undefined, @Body() body: { email?: boolean }) {
    await this.seoAi.assertAccess(this.tenant(user));
    return this.seoAi.startRun(this.tenant(user), user.userId ?? null, site, { email: !!body?.email });
  }

  @Post('reports/:id/email')
  async email(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { to?: string[] },
  ) {
    await this.seoAi.assertAccess(this.tenant(user));
    return this.seoAi.emailReport(this.tenant(user), id, Array.isArray(body?.to) ? body.to : undefined);
  }
}
