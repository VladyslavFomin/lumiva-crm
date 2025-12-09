// src/smm/smm-profile.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SmmProfileStat } from './smm-profile-stat.entity';

export type SmmPlatform = 'instagram' | 'facebook' | 'vk' | 'tiktok' | 'other';

@Entity('smm_profiles')
export class SmmProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 32 })
  platform: SmmPlatform;

  @Column({ type: 'varchar', length: 255 })
  handle: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  url: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, any> | null;

  @OneToMany(() => SmmProfileStat, (stat) => stat.profile)
  stats: SmmProfileStat[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: string;
}