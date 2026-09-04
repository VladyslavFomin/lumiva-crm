// src/departments/departments.controller.ts
import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Реструктуризация отделов (создание/изменение/удаление, включая смену руководителя) —
// чувствительное административное действие, как приглашения сотрудников
// (assertOwnerForInvites в staff-users.service.ts) и права доступа (assertOwner в
// rbac.controller.ts). Раньше эти три эндпоинта не проверяли роль вообще — любой авторизованный
// сотрудник любой роли мог перекроить структуру компании. Чтение (GET) остаётся открытым для
// всех авторизованных — как и раньше, страница «Отделы» просто не показана в меню тем, у кого
// нет права 'staff' (см. MainLayout), но само чтение не настолько чувствительно, чтобы его
// закрывать полностью.
function assertOwner(req: any): void {
  if ((req.user?.role || '').toLowerCase() !== 'owner') {
    throw new ForbiddenException('Изменять структуру отделов может только владелец компании');
  }
}

@UseGuards(JwtAuthGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Get('tree')
  async getTree(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.service.getTreeForTenant(tenantId);
  }

  @Get('summary')
  async getSummary(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.service.getSummaryForTenant(tenantId);
  }

  @Get()
  async list(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.service.listForTenant(tenantId);
  }

  @Get(':id')
  async getOne(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    return this.service.getOneForTenant(tenantId, id);
  }

  @Get(':id/staff')
  async getStaff(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    return this.service.getStaffRecursive(tenantId, id);
  }

  @Get(':id/stats')
  async getStats(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    return this.service.getStatsForDepartment(tenantId, id);
  }

  @Post()
  async create(@Req() req: any, @Body() body: CreateDepartmentDto) {
    assertOwner(req);
    const tenantId = req.user.tenantId;
    return this.service.createForTenant(tenantId, body);
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateDepartmentDto,
  ) {
    assertOwner(req);
    const tenantId = req.user.tenantId;
    return this.service.updateForTenant(tenantId, id, body);
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    assertOwner(req);
    const tenantId = req.user.tenantId;
    await this.service.deleteForTenant(tenantId, id);
    return { success: true };
  }
}










