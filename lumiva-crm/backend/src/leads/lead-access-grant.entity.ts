// src/leads/lead-access-grant.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type LeadAccessScopeType = 'source' | 'all';
export type LeadAccessTier = 'viewer' | 'analyst' | 'editor' | 'owner';

/** Grants a staff member visibility into leads outside their own assignments — either every
 * lead in the tenant (scopeType='all') or every lead whose `source` field matches scopeValue
 * (scopeType='source'). Tier controls what they can do with leads reached through this grant
 * (see LeadAccessService) — assignment itself always behaves like an implicit 'owner' tier
 * grant and doesn't need a row here. */
@Entity('lead_access_grants')
@Index(['tenantId', 'staffUserId'])
export class LeadAccessGrant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  staffUserId: string;

  @Column({ type: 'varchar', length: 16 })
  scopeType: LeadAccessScopeType;

  @Column({ type: 'varchar', length: 64, nullable: true })
  scopeValue: string | null;

  @Column({ type: 'varchar', length: 16 })
  tier: LeadAccessTier;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
