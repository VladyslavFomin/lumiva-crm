// src/data-visibility/data-visibility-rule.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { StaffRole } from '../staff/staff-user.entity';

export type DataVisibilityRuleKey =
  | 'foreign_records'
  | 'amounts_visibility'
  | 'contact_masking'
  | 'ip_mode';

export type ForeignRecordsValue = 'hide' | 'masked' | 'full';
export type AmountsVisibilityValue = 'all' | 'owner_manager' | 'hidden';
export type ContactMaskingValue = 'show' | 'mask_until_assigned' | 'always_mask';
export type IpModeValue = 'off' | 'warn' | 'block';

@Entity('staff_data_visibility_rules')
export class StaffDataVisibilityRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenantId' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 32 })
  role!: StaffRole;

  @Column({ type: 'varchar', length: 32, name: 'ruleKey' })
  ruleKey!: DataVisibilityRuleKey;

  @Column({ type: 'varchar', length: 32 })
  value!: string;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
