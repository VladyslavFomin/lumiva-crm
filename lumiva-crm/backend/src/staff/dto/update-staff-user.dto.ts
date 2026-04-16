// src/staff/dto/update-staff-user.dto.ts
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';
import type { StaffRole } from '../staff-user.entity';

export class UpdateStaffUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsIn(['owner', 'manager', 'viewer'])
  role?: StaffRole;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}