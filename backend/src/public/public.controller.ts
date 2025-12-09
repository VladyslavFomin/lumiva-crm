// src/public/public.controller.ts
import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { ApiTokenGuard } from '../api-tokens/api-token.guard';

@Controller('public')
export class PublicController {
  // n8n / WordPress connector: тест соединения
  @Post('ping')
  @UseGuards(ApiTokenGuard)
  async ping(@Req() req: Request) {
    const tenantId = (req as any).tenantId as string | undefined;

    return {
      ok: true,
      tenantId: tenantId ?? null,
      ts: new Date().toISOString(),
    };
  }
}