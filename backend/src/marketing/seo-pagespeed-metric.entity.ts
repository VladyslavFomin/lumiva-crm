import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('seo_pagespeed_metrics')
@Index(['tenantId', 'pageUrl', 'strategy'], { unique: true })
export class SeoPageSpeedMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'text' })
  pageUrl: string;

  @Column({ type: 'varchar', length: 16, default: 'mobile' })
  strategy: string;

  @Column({ type: 'int', default: 0 })
  performance: number;

  @Column({ type: 'int', default: 0 })
  accessibility: number;

  @Column({ type: 'int', default: 0 })
  bestPractices: number;

  @Column({ type: 'int', default: 0 })
  seo: number;

  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0 })
  lcp: string;

  @Column({ type: 'numeric', precision: 8, scale: 4, default: 0 })
  cls: string;

  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0 })
  fcp: string;

  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0 })
  tbt: string;

  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0 })
  speedIndex: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
