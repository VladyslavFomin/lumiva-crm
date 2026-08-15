import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('sales_reply_poll_state')
export class SalesReplyPollState {
  @PrimaryColumn({ length: 32, default: 'default' })
  key: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastPolledAt: Date | null;

  @Column({ type: 'int', nullable: true })
  lastMatchCount: number | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
