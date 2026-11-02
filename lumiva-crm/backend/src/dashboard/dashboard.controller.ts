import { Body, Controller, Get, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardOverviewService } from './dashboard-overview.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly overviewSvc: DashboardOverviewService,
  ) {}

  /** Главная v3: KPI/цифры профиля/«Динамика» по выбранным ключам + таймлайн, лента, онлайн, медиа, заметки. */
  @UseGuards(JwtAuthGuard)
  @Get('overview')
  overview(
    @CurrentUser() user: CurrentUserPayload,
    @Query() q: { currency?: string; tz?: string; kpis?: string; stats?: string; series?: string; period?: string },
  ) {
    return this.overviewSvc.overview(user, q || {});
  }

  @UseGuards(JwtAuthGuard)
  @Patch('notes')
  saveNotes(@CurrentUser() user: CurrentUserPayload, @Body() body: { text?: string }) {
    return this.overviewSvc.saveNotes(user.tenantId, DashboardOverviewService.userIdOf(user), body?.text);
  }

  @UseGuards(JwtAuthGuard)
  @Get('home')
  async home(@Req() req: any) {
    const tenantId = req.user.tenantId as string;
    const userId = req.user.userId as string;
    return this.dashboard.getHome(tenantId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('layout')
  async getLayout(@Req() req: any) {
    const tenantId = req.user.tenantId as string;
    const userId = req.user.userId as string;
    return this.dashboard.getLayout(tenantId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('layout')
  async saveLayout(
    @Req() req: any,
    @Body() body: { layout: unknown; updatedAt?: string },
  ) {
    const tenantId = req.user.tenantId as string;
    const userId = req.user.userId as string;
    return this.dashboard.saveLayout(tenantId, userId, body?.layout, body?.updatedAt);
  }
}
