import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

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
