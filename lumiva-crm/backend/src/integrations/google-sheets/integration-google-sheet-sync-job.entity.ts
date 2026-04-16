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
import { Tenant } from '../../tenants/tenant.entity';
import { IntegrationConnection } from '../integration-connection.entity';
import { IntegrationGoogleSheetSyncState } from './integration-google-sheet-sync-state.entity';

export type GoogleSheetSyncJobKind = 'pull_batch';
export type GoogleSheetSyncJobStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'error'
  | 'cancelled';

@Entity('integration_google_sheet_sync_jobs')
@Index(['tenantId', 'status', 'createdAt'])
export class IntegrationGoogleSheetSyncJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'uuid' })
  integrationConnectionId: string;

  @ManyToOne(() => IntegrationConnection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'integrationConnectionId' })
  integration: IntegrationConnection;

  @Column({ type: 'uuid' })
  syncStateId: string;

  @ManyToOne(() => IntegrationGoogleSheetSyncState, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'syncStateId' })
  syncState: IntegrationGoogleSheetSyncState;

  @Column({ type: 'varchar', length: 32, default: 'pull_batch' })
  kind: GoogleSheetSyncJobKind;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: GoogleSheetSyncJobStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'int', default: 8 })
  maxAttempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  lockedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
