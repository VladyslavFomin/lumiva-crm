// src/platform-admin/platform-admin.controller.ts
import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminGuard } from './platform-admin.guard';

@Controller('platform')
@UseGuards(PlatformAdminGuard)
export class PlatformAdminController {
  constructor(private readonly service: PlatformAdminService) {}

  @Get('tenants')
  async getTenants() {
    return this.service.listTenants();
  }

  @Patch('tenants/:id/enable')
  async enableTenant(@Param('id') id: string) {
    await this.service.setStatus(id, 'active');
    return { success: true };
  }

  @Patch('tenants/:id/disable')
  async disableTenant(@Param('id') id: string) {
    await this.service.setStatus(id, 'blocked');
    return { success: true };
  }

  @Patch('tenants/:id/api/on')
  async enableApi(@Param('id') id: string) {
    await this.service.setApiEnabled(id, true);
    return { success: true };
  }

  @Patch('tenants/:id/api/off')
  async disableApi(@Param('id') id: string) {
    await this.service.setApiEnabled(id, false);
    return { success: true };
  }

  @Get('tenants/:id/modules')
  async getTenantModules(@Param('id') id: string) {
    return this.service.getTenantModules(id);
  }

  @Get('tenants/:id/components')
  async getTenantComponents(@Param('id') id: string) {
    return this.service.getTenantComponents(id);
  }

  @Patch('tenants/:id/modules/:moduleKey')
  async toggleModule(
    @Param('id') id: string,
    @Param('moduleKey') moduleKey: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.service.toggleTenantModule(id, moduleKey, body.enabled);
  }

  @Patch('tenants/:id/components/:componentKey')
  async toggleComponent(
    @Param('id') id: string,
    @Param('componentKey') componentKey: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.service.toggleTenantComponent(id, componentKey, body.enabled);
  }
}
