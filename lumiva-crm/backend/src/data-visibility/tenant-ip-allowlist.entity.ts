// src/data-visibility/tenant-ip-allowlist.entity.ts
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tenant_ip_allowlist')
export class TenantIpAllowlistEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenantId' })
  tenantId!: string;

  /** Bare IPv4 ('203.0.113.4') or CIDR range ('203.0.113.0/24') — see cidr.util.ts. */
  @Column({ type: 'varchar', length: 64 })
  cidr!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  label!: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;
}
