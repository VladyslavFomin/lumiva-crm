import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * «Мозг → Доступы»: какой подключённый сервис каким отделам доступен.
 * Сами токены живут в integration_connections (существующее хранилище интеграций); здесь — только
 * область видимости по отделам. Агент отдела использует коннектор, только если отдел в scope.
 */
@Entity('ai_office_access')
@Index('UQ_ai_office_access_conn', ['tenantId', 'connector', 'connectionId'], { unique: true })
export class AiOfficeAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  /** Ключ коннектора офиса (email, telegram, meta_ads, notion, github, …) */
  @Column({ type: 'varchar', length: 40 })
  connector: string;

  /** integration_connections.id / email_accounts.id / telegram_bots.id — или '' для коннектора без отдельной записи */
  @Column({ name: 'connection_id', type: 'varchar', length: 64, default: '' })
  connectionId: string;

  @Column({ type: 'varchar', length: 190, default: '' })
  label: string;

  @Column({ name: 'department_ids', type: 'uuid', array: true, default: () => "'{}'" })
  departmentIds: string[];

  @Column({ name: 'granted_by', type: 'uuid', nullable: true })
  grantedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
