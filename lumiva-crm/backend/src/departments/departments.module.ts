// src/departments/departments.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { Department } from './department.entity';
import { StaffUser } from '../staff/staff-user.entity';
import { Lead } from '../leads/lead.entity';
import { Sale } from '../sales/sale.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Department, StaffUser, Lead, Sale])],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}










