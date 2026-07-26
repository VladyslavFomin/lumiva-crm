import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export interface HotelInfoImportItemRow {
  kind: string;
  name: string;
  description: string | null;
  hours: string | null;
  paid: boolean | null;
  extra: Record<string, string>;
}

@Entity('hotel_info_import_sessions')
@Index(['tenantId'])
export class HotelInfoImportSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  originalFileName: string | null;

  @Column({ type: 'jsonb', default: {} })
  infoFields: Record<string, string>;

  @Column({ type: 'jsonb', default: [] })
  items: HotelInfoImportItemRow[];

  @Column({ type: 'jsonb', default: [] })
  unmatchedLabels: string[];

  @Column({ type: 'varchar', length: 16, default: 'preview' })
  status: 'preview' | 'applied';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
