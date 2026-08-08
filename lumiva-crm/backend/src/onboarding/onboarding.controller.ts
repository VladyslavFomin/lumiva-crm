// src/onboarding/onboarding.controller.ts
import { Controller, Get, Post, Delete, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('state')
  getState(@Req() req: any) {
    return this.onboarding.getState(req.user.tenantId as string);
  }

  @Post('complete')
  complete(@Req() req: any) {
    return this.onboarding.complete(req.user.tenantId as string);
  }

  @Post('sample-data')
  seedSampleData(@Req() req: any) {
    return this.onboarding.seedSampleData(req.user.tenantId as string);
  }

  @Delete('sample-data')
  removeSampleData(@Req() req: any) {
    return this.onboarding.removeSampleData(req.user.tenantId as string);
  }
}
