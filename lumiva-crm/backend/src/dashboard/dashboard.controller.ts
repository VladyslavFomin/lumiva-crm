import { Controller, Get, Req, UseGuards } from '@nestjs/common';
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
}
