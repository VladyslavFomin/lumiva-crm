// src/public/public.controller.ts
import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';

import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { TenantsService } from '../tenants/tenants.service';
import { SitesService } from '../sites/sites.service';
import { Site } from '../sites/site.entity';

@SkipThrottle()
@Controller('public')
export class PublicController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly sitesService: SitesService,
  ) {}

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

  // Получить модули тенента (для WordPress плагина)
  @Get('tenant/modules')
  @UseGuards(ApiTokenGuard)
  async getTenantModules(@Req() req: Request) {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) {
      return { modules: [] };
    }

    const rawSite =
      (req.headers['x-site-token'] as string | undefined) ||
      (req.headers['x-wp-site-token'] as string | undefined);
    const siteToken = rawSite?.trim();
    let site: Site | null = null;
    if (siteToken) {
      site = await this.sitesService.findActiveByTenantAndApiToken(tenantId, siteToken);
      if (!site) {
        throw new ForbiddenException(
          'Неверный токен сайта (X-Site-Token) для этой компании',
        );
      }
    }

    const modules = await this.tenantsService.getTenantModules(tenantId, site);
    return { modules, siteId: site?.id ?? null };
  }

  // Получить компоненты тенента (для CRM)
  @Get('tenant/components')
  @UseGuards(ApiTokenGuard)
  async getTenantComponents(@Req() req: Request) {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) {
      return { components: [] };
    }

    const components = await this.tenantsService.getTenantComponents(tenantId);
    return { components };
  }

  @Get('tenant/info')
  @UseGuards(ApiTokenGuard)
  async getTenantInfo(@Req() req: Request) {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) {
      return { tenant: null };
    }

    const tenant = await this.tenantsService.getTenantInfo(tenantId);
    return { tenant };
  }

  @Get('tenant/meta')
  @UseGuards(ApiTokenGuard)
  async getTenantMeta(@Req() req: Request) {
    const tenantId = (req as any).tenantId as string | undefined;
    if (!tenantId) {
      return { meta: null };
    }

    const meta = await this.tenantsService.getTenantMeta(tenantId);
    return { meta };
  }
}
