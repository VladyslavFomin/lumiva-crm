// src/onboarding/onboarding-sample-record.entity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type OnboardingSampleEntityType = 'company' | 'contact' | 'lead' | 'product' | 'sale';

/** One row per record created by the onboarding sample-data seeder — lets "remove example data"
 * delete exactly what it created, without an isSample column on every seedable entity. */
@Entity('onboarding_sample_records')
@Index(['tenantId'])
export class OnboardingSampleRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 32 })
  entityType: OnboardingSampleEntityType;

  @Column({ type: 'uuid' })
  entityId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
