import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SalesEmailStatus = 'unknown' | 'found' | 'not_found';
// 'skipped' = reviewed and rejected as a lead (no email sent, doesn't count as contacted) —
// kept in the list rather than hidden, so the business isn't reprocessed on future searches.
export type SalesOutreachStatus = 'not_contacted' | 'sent' | 'replied' | 'skipped';

@Entity('sales_prospects')
export class SalesProspect {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, unique: true })
  placeId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  formattedAddress: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  searchCity: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  searchBusinessType: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  website: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ length: 24, default: 'unknown' })
  emailStatus: SalesEmailStatus;

  @Column({ type: 'timestamptz', nullable: true })
  emailScrapedAt: Date | null;

  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng: number | null;

  @Column({ type: 'numeric', precision: 2, scale: 1, nullable: true })
  rating: string | null;

  @Column({ type: 'int', nullable: true })
  userRatingsTotal: number | null;

  @Column({ type: 'text', nullable: true })
  googleMapsUrl: string | null;

  @Column({ length: 24, default: 'not_contacted' })
  outreachStatus: SalesOutreachStatus;

  @Column({ type: 'timestamptz', nullable: true })
  lastContactedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastRepliedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  rawPlaceDetails: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  detailsFetchedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
