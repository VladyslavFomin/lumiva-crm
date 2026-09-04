import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WorkspaceArea } from './workspace-area.entity';
import { StaffUser } from '../staff/staff-user.entity';
import type { WorkspaceAreaRole } from './workspace-area-role';

@Entity('workspace_area_members')
@Index(['workspaceAreaId', 'staffUserId'], { unique: true })
export class WorkspaceAreaMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  workspaceAreaId: string;

  @ManyToOne(() => WorkspaceArea, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceAreaId' })
  workspaceArea: WorkspaceArea;

  @Column({ type: 'uuid' })
  staffUserId: string;

  @ManyToOne(() => StaffUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffUserId' })
  staffUser: StaffUser;

  @Column({ type: 'varchar', length: 24 })
  role: WorkspaceAreaRole;

  @Column({ type: 'uuid', nullable: true })
  invitedByUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
