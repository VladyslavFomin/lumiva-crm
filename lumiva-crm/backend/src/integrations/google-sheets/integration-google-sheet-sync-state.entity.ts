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

/** Куда пишем строки таблицы: лиды, workspace; projects/sales — пока без записи (см. sync). */
export type GoogleSheetSyncTargetKind = 'leads' | 'workspace' | 'projects' | 'sales';

@Entity('integration_google_sheet_sync_states')
@Index(['tenantId', 'integrationConnectionId'], { unique: true })
export class IntegrationGoogleSheetSyncState {
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

  @Column({ type: 'varchar', length: 64 })
  spreadsheetId: string;

  @Column({ type: 'varchar', length: 191, default: 'Sheet1' })
  sheetTabName: string;

  /** Номер строки заголовков в Google Sheet (обычно 1). */
  @Column({ type: 'int', default: 1 })
  headerRow: number;

  @Column({ type: 'varchar', length: 32, default: 'leads' })
  targetKind: GoogleSheetSyncTargetKind;

  @Column({ type: 'uuid', nullable: true })
  workspaceObjectId: string | null;

  /**
   * JSON: заголовок колонки (как в строке 1) → путь поля CRM.
   * Примеры значений: "email", "phone", "name", "status", "customFields.budget"
   */
  @Column({ type: 'text', nullable: true })
  columnMapJson: string | null;

  /** email | phone | external_id — как искать существующую запись при импорте. */
  @Column({ type: 'varchar', length: 32, default: 'email' })
  dedupeBy: string;

  /** Имя колонки-заголовка для внешнего ключа (если dedupeBy = external_id). */
  @Column({ type: 'varchar', length: 191, nullable: true })
  externalIdHeader: string | null;

  /**
   * range: nextRowCursor — номер следующей строки листа (1-based).
   * selected: nextRowCursor — индекс в массиве selectedRowsJson (0-based).
   */
  @Column({ type: 'varchar', length: 16, default: 'range' })
  importMode: 'range' | 'selected';

  /** JSON number[] — номера строк листа для импорта при importMode === 'selected'. */
  @Column({ type: 'text', nullable: true })
  selectedRowsJson: string | null;

  /** Следующая строка листа (1-based) или индекс в selectedRows — см. importMode. */
  @Column({ type: 'int', default: 2 })
  nextRowCursor: number;

  @Column({ type: 'int', default: 200 })
  batchSize: number;

  @Column({ type: 'varchar', length: 32, default: 'idle' })
  status: 'idle' | 'running' | 'error';

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastPullAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
