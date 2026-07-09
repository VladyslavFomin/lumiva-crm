import { Body, Controller, Get, Headers, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { ProductsService } from './products.service';

@Controller('public/products')
@UseGuards(ApiTokenGuard)
export class ProductsPublicController {
  constructor(private readonly service: ProductsService) {}

  @Get()
  async list(@Req() req: Request) {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) return { ok: false, reason: 'Tenant not resolved' };
    return this.service.listPublicProducts(tenantId);
  }

  @Get(':externalIdOrSku')
  async getOne(@Req() req: Request, @Param('externalIdOrSku') externalIdOrSku: string) {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) return { ok: false, reason: 'Tenant not resolved' };
    return this.service.getPublicProduct(tenantId, externalIdOrSku);
  }

  @Post('ingest')
  async ingest(
    @Req() req: Request,
    @Body() body: any,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) return { ok: false, reason: 'Tenant not resolved' };
    return this.service.ingestPublicProduct(tenantId, body, idempotencyKey);
  }

  @Patch('stock')
  async adjustStock(@Req() req: Request, @Body() body: any) {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) return { ok: false, reason: 'Tenant not resolved' };
    return this.service.adjustStockPublic(tenantId, body);
  }
}
