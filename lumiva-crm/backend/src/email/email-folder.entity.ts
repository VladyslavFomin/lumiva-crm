import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { EmailAccount } from './email-account.entity';

@Entity('email_folders')
@Index(['tenantId', 'accountId'])
@Index(['accountId', 'systemKey'])
export class EmailFolder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'uuid' })
  accountId: string;

  @ManyToOne(() => EmailAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountId' })
  account: EmailAccount;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** inbox | sent | trash — нельзя удалить/переименовать с фронта */
  @Column({ type: 'varchar', length: 32, nullable: true })
  systemKey: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
