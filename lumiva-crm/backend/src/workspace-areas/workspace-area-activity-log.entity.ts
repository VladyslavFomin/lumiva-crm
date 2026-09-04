import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type WorkspaceAreaActivityKind =
  | 'sync'
  | 'import'
  | 'push'
  | 'mapping_change'
  | 'table_created'
  | 'error';

/** No FK on workspaceAreaId/relatedObjectId — matches the audit_logs precedent, so the log
 * can outlive its subject (deleted table/area) without cascade-delete ordering issues. */
@Entity('workspace_area_activity_log')
@Index(['tenantId', 'workspaceAreaId', 'createdAt'])
export class WorkspaceAreaActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  workspaceAreaId: string;

  @Column({ type: 'varchar', length: 24 })
  kind: WorkspaceAreaActivityKind;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  detail: string | null;

  @Column({ type: 'uuid', nullable: true })
  relatedObjectId: string | null;

  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
