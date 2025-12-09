// src/leads/lead-activity.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Lead } from './lead.entity';
import { StaffUser } from '../staff/staff-user.entity';

export type LeadActivityType =
  | 'created'
  | 'status_changed'
  | 'assignee_changed'
  | 'comment';

@Entity('lead_activity')
export class LeadActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  leadId: string;

  @ManyToOne(() => Lead, (lead) => lead.activity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'leadId' })
  lead: Lead;

  @Column({ nullable: true })
  userId: string | null;

  @ManyToOne(() => StaffUser, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: StaffUser | null;

  @Column({ type: 'varchar', length: 50 })
  type: LeadActivityType;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'text', nullable: true })
  fromValue: string | null;

  @Column({ type: 'text', nullable: true })
  toValue: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}