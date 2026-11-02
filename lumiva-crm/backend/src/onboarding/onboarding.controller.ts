// src/onboarding/onboarding.controller.ts
import { Body, Controller, Get, Post, Delete, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OnboardingService } from './onboarding.service';
import { OnboardingAiService, type OnboardingAiApplyInput } from './onboarding-ai.service';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly ai: OnboardingAiService,
  ) {}

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

  /** ИИ-настройка: описание бизнеса → план (ничего не применяет) */
  @Post('ai-plan')
  aiPlan(@Req() req: any, @Body() body: { description?: string; lang?: string }) {
    const u = req.user;
    return this.ai.plan(u.tenantId, String(u.userId ?? u.id ?? u.sub ?? '') || null, String(body?.description || ''), String(body?.lang || 'en').slice(0, 2));
  }

  /** Применить отмеченные пункты плана (владелец/админ) */
  @Post('ai-apply')
  aiApply(@Req() req: any, @Body() body: OnboardingAiApplyInput) {
    return this.ai.apply(req.user.tenantId, req.user.role, body);
  }

  @Delete('sample-data')
  removeSampleData(@Req() req: any) {
    return this.onboarding.removeSampleData(req.user.tenantId as string);
  }
}
