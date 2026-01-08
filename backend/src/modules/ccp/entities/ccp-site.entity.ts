import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('ccp_sites')
@Index(['tenantId', 'siteUrl'], { unique: true })
export class CcpSiteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  siteUrl: string; // https://site.com/

  @Column({ type: 'varchar', length: 255, nullable: true })
  siteHost: string | null; // site.com

  @Column({ type: 'varchar', length: 255, nullable: true })
  wpRestBase: string | null; // https://site.com/wp-json/ccp/v1

  @Column({ type: 'varchar', length: 255, nullable: true })
  wpToken: string | null; // token for WP REST access

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}