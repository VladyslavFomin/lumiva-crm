import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('sales_api_usage')
export class SalesApiUsage {
  @PrimaryColumn({ type: 'date' })
  usageDate: string;

  @Column({ type: 'int', default: 0 })
  placesTextSearchCalls: number;

  @Column({ type: 'int', default: 0 })
  placesDetailsCalls: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
