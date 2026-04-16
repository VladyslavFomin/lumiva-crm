// src/smm/smm-profile-stat.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SmmProfile } from './smm-profile.entity';

@Entity('smm_profile_stats')
export class SmmProfileStat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'uuid' })
  profileId: string;

  @ManyToOne(() => SmmProfile, (profile) => profile.stats, {
    onDelete: 'CASCADE',
  })
  profile: SmmProfile;

  // YYYY-MM-DD
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'int', default: 0 })
  followers: number;

  @Column({ type: 'int', default: 0 })
  following: number;

  @Column({ type: 'int', default: 0 })
  posts: number;

  @Column({ type: 'int', default: 0 })
  impressions: number;

  @Column({ type: 'int', default: 0 })
  reach: number;

  @Column({ type: 'int', default: 0 })
  profileViews: number;

  @Column({ type: 'int', default: 0 })
  clicks: number;

  @Column({ type: 'int', default: 0 })
  likes: number;

  @Column({ type: 'int', default: 0 })
  comments: number;

  @Column({ type: 'int', default: 0 })
  saves: number;

  @Column({ type: 'int', default: 0 })
  videoViews: number;

  @Column({ type: 'jsonb', nullable: true })
  extra: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: string;
}