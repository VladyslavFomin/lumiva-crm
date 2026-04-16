// src/staff/dto/create-staff-user.dto.ts
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import type { StaffRole } from '../staff-user.entity';

export class CreateStaffUserDto {
  @IsEmail()
  email: string;

  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsIn(['owner', 'manager', 'viewer'])
  role: StaffRole;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}