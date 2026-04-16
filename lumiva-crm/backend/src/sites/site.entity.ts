import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Lead } from '../leads/lead.entity';

@Entity('sites')
export class Site {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @ManyToOne(() => Tenant, (tenant: Tenant) => tenant.sites, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column()
  domain: string;

  @Column({ nullable: true })
  name: string;

  @Column({ unique: true })
  apiToken: string;

  /**
   * Переопределения модулей Lumiva для этого сайта (WordPress).
   * Ключи как в MODULE_KEYS; отсутствие ключа = наследовать настройки компании.
   */
  @Column({ type: 'jsonb', nullable: true })
  enabledModules: Record<string, boolean> | null;

  @Column({ default: 'active' })
  status: string; // active, disabled

  @OneToMany(() => Lead, (lead: Lead) => lead.site)
  leads: Lead[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
