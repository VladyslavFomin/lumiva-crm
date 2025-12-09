// backend/src/tenants/tenants.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type CurrentUserPayload, // <-- ВАЖНО: type-импорт
} from '../common/decorators/current-user.decorator';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  async getTenants() {
    return this.tenantsService.findAll();
  }

  // ---- Получить настройки компании ----
  @UseGuards(JwtAuthGuard)
  @Get('settings')
  async getSettings(@CurrentUser() user: CurrentUserPayload) {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }

    return this.tenantsService.getCompanySettings(user.tenantId);
  }

  // ---- Обновить настройки компании (только owner) ----
  @UseGuards(JwtAuthGuard)
  @Patch('settings')
  async updateSettings(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: UpdateTenantSettingsDto,
  ) {
    if (!user?.tenantId) {
      throw new BadRequestException('No tenant in auth payload');
    }

    const role = (user.role || '').toLowerCase();
    if (role !== 'owner') {
      throw new ForbiddenException('Only owner can update settings');
    }

    return this.tenantsService.updateCompanySettings(user.tenantId, body);
  }
}