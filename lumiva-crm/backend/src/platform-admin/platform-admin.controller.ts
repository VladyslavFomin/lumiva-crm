// src/platform-admin/platform-admin.controller.ts
import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminGuard } from './platform-admin.guard';

@Controller('platform')
@UseGuards(PlatformAdminGuard)
export class PlatformAdminController {
  constructor(private readonly service: PlatformAdminService) {}

  @Get('tenants/:id/modules')
  async getTenantModules(@Param('id') id: string) {
    return this.service.getTenantModules(id);
  }

  @Patch('tenants/:id/modules/:moduleKey')
  async toggleModule(
    @Param('id') id: string,
    @Param('moduleKey') moduleKey: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.service.toggleTenantModule(id, moduleKey, body.enabled);
  }

  @Get('billing/overview')
  async getBillingOverview() {
    return this.service.getBillingOverview();
  }
}
