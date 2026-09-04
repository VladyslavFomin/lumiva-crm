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
import { ProjectTable } from './project-table.entity';
import { StaffUser } from '../staff/staff-user.entity';
import type { ProjectTableRole } from './project-table-role';

@Entity('project_table_members')
@Index(['projectTableId', 'staffUserId'], { unique: true })
export class ProjectTableMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  projectTableId: string;

  @ManyToOne(() => ProjectTable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectTableId' })
  projectTable: ProjectTable;

  @Column({ type: 'uuid' })
  staffUserId: string;

  @ManyToOne(() => StaffUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffUserId' })
  staffUser: StaffUser;

  @Column({ type: 'varchar', length: 24 })
  role: ProjectTableRole;

  @Column({ type: 'uuid', nullable: true })
  invitedByUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
