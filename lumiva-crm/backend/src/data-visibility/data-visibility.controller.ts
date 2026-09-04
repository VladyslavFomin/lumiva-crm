// src/data-visibility/data-visibility.controller.ts
import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { DataVisibilityService, DataVisibilityMatrix } from './data-visibility.service';
import type { StaffRole } from '../staff/staff-user.entity';

// Тот же принцип, что и assertOwner в rbac.controller.ts — эти правила определяют, кто что
// видит, поэтому смотреть и менять их может только владелец.
function assertOwner(user: CurrentUserPayload): void {
  if ((user.role || '').toLowerCase() !== 'owner') {
    throw new ForbiddenException('Видимость данных может просматривать и изменять только владелец компании');
  }
}

@Controller('data-visibility')
@UseGuards(JwtAuthGuard)
export class DataVisibilityController {
  constructor(private readonly service: DataVisibilityService) {}

  @Get('rules')
  async getRules(@CurrentUser() user: CurrentUserPayload): Promise<DataVisibilityMatrix> {
    assertOwner(user);
    return this.service.getRulesForTenant(user.tenantId);
  }

  @Post('rules')
  async saveRules(
    @CurrentUser() user: CurrentUserPayload,
    @Body() matrix: DataVisibilityMatrix,
  ): Promise<DataVisibilityMatrix> {
    assertOwner(user);
    return this.service.saveRules(user.tenantId, matrix, {
      actorUserId: user.userId ?? null,
      actorName: user.email ?? null,
    });
  }

  @Get('ip-allowlist')
  async getIpAllowlist(@CurrentUser() user: CurrentUserPayload) {
    assertOwner(user);
    return this.service.getIpAllowlist(user.tenantId);
  }

  @Post('ip-allowlist')
  async addIpEntry(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { cidr: string; label?: string },
  ) {
    assertOwner(user);
    return this.service.addIpEntry(user.tenantId, body.cidr, body.label);
  }

  @Delete('ip-allowlist/:id')
  async removeIpEntry(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    assertOwner(user);
    await this.service.removeIpEntry(user.tenantId, id);
    return { success: true };
  }

  @Get('simulate/:staffUserId')
  async simulate(@CurrentUser() user: CurrentUserPayload, @Param('staffUserId') staffUserId: string) {
    assertOwner(user);
    // роль сотрудника нужна, чтобы применить правильные правила — берём её у самого сотрудника,
    // не у вызывающего (owner всегда privileged и правила игнорирует)
    const staffRole = await this.service.getStaffRoleById(user.tenantId, staffUserId);
    return this.service.simulateForStaff(user.tenantId, staffUserId, (staffRole ?? 'sales') as StaffRole);
  }
}
