import { Body, Controller, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { CustomObjectsService } from './custom-objects.service';

@Controller('public/custom-objects')
@UseGuards(ApiTokenGuard)
export class CustomObjectsPublicController {
  constructor(private readonly service: CustomObjectsService) {}

  @Post(':slug/ingest')
  async ingest(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Body() body: any,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) return { ok: false, reason: 'Tenant not resolved' };
    return this.service.ingestRecords(tenantId, slug, body, idempotencyKey);
  }
}

