import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** A separate, independently-scoped set of Projects rows ("Таблица" tab).
 * Every tenant has exactly one default table (`slug = 'main'`, lazily created on first
 * access — see ProjectTablesService.ensureDefaultTable). Any staff member can create
 * additional tables and share them with specific coworkers via ProjectTableMember. */
@Entity('project_tables')
export class ProjectTable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 180 })
  slug: string;

  @Column({ type: 'uuid', nullable: true })
  createdByStaffId: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
