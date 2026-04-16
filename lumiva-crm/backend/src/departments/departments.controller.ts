// src/departments/departments.controller.ts
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
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Get('tree')
  async getTree(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.service.getTreeForTenant(tenantId);
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

  @Post()
  async create(@Req() req: any, @Body() body: CreateDepartmentDto) {
    const tenantId = req.user.tenantId;
    return this.service.createForTenant(tenantId, body);
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateDepartmentDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.service.updateForTenant(tenantId, id, body);
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    await this.service.deleteForTenant(tenantId, id);
    return { success: true };
  }
}










