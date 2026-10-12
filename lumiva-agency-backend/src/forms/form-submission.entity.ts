import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('form_submissions')
export class FormSubmission {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ default: 'contact' })
  type: string // contact | newsletter | popup

  @Column({ nullable: true })
  name: string

  @Column({ nullable: true })
  email: string

  @Column({ nullable: true })
  phone: string

  @Column({ nullable: true })
  company: string

  @Column({ nullable: true })
  budget: string

  @Column({ type: 'text', nullable: true })
  message: string

  @Column({ default: 'new' })
  status: string // new | viewed | in_progress | done | spam

  @Column({ nullable: true })
  crmLeadId: string

  @Column({ nullable: true })
  source: string

  @Column({ nullable: true })
  userAgent: string

  @Column({ nullable: true })
  ip: string

  @Column({ type: 'text', nullable: true })
  notes: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
