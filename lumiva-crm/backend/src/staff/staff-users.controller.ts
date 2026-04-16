// backend/src/staff/staff-users.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StaffUsersService } from './staff-users.service';
import { StaffRole } from './staff-user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('staff-users')
export class StaffUsersController {
  constructor(private readonly service: StaffUsersService) {}

  @Get()
  async list(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.service.listForTenant(tenantId);
  }

  @Post('invite')
  async invite(@Req() req: any, @Body() body: any) {
    const tenantId = req.user.tenantId;
    return this.service.inviteStaffMember(tenantId, req.user.role, {
      email: String(body.email || ''),
      fullName: String(body.fullName || ''),
      role: body.role as StaffRole,
      departmentId:
        body.departmentId === undefined || body.departmentId === ''
          ? null
          : body.departmentId,
    });
  }

  @Post(':id/resend-invite')
  async resendInvite(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    return this.service.resendStaffInvite(tenantId, req.user.role, id);
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const tenantId = req.user.tenantId;
    return this.service.createForTenant(tenantId, {
      email: body.email,
      fullName: body.fullName,
      role: body.role as StaffRole,
      department: body.department ?? null,
      departmentId: body.departmentId ?? null,
      avatarUrl: body.avatarUrl ?? null,
      externalId: body.externalId ?? null,
    });
  }

  @Get(':id')
  async getOne(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    const row = await this.service.getOneForTenant(tenantId, id);
    return this.service.toPublicStaff(row);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const tenantId = req.user.tenantId;
    return this.service.updateForTenant(tenantId, id, body);
  }

  @Patch(':id/deactivate')
  async deactivate(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    return this.service.deactivateForTenant(tenantId, id);
  }

  @Patch(':id/activate')
  async activate(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    return this.service.activateForTenant(tenantId, id);
  }

  @Patch(':id/role')
  async updateRole(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { role: StaffRole },
  ) {
    const tenantId = req.user.tenantId;
    return this.service.updateRoleForTenant(tenantId, id, body.role);
  }

  @Patch(':id/department')
  async updateDepartment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { department: string | null },
  ) {
    const tenantId = req.user.tenantId;
    return this.service.updateDepartmentForTenant(
      tenantId,
      id,
      body.department ?? null,
    );
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    await this.service.deleteForTenant(tenantId, id);
    return { success: true };
  }
}